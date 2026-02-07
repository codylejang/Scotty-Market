import { v4 as uuid } from 'uuid';
import { getDb } from '../db/database';

export type BudgetFrequency = 'Day' | 'Month' | 'Year';

export interface Budget {
  id: string;
  user_id: string;
  category: string;
  frequency: BudgetFrequency;
  limit_amount: number;
  derived_daily_limit: number;
  adaptive_enabled: boolean;
  adaptive_max_adjust_pct: number;
  last_auto_adjusted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface AdaptiveAdjustment {
  budget_id: string;
  category: string;
  old_limit_amount: number;
  new_limit_amount: number;
  reason: string;
}

export interface AdaptiveAdjustmentResult {
  adjustments: AdaptiveAdjustment[];
  skipped: number;
}

const MS_PER_DAY = 86400000;

// Supported categories (7 as referenced in project)
const VALID_CATEGORIES = [
  'Food & Drink', 'Groceries', 'Transportation', 'Entertainment',
  'Shopping', 'Health', 'Subscription',
];

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function getDaysInPeriod(frequency: BudgetFrequency, referenceDate: Date = new Date()): number {
  if (frequency === 'Day') return 1;
  if (frequency === 'Year') {
    const year = referenceDate.getFullYear();
    const start = new Date(year, 0, 1);
    const end = new Date(year + 1, 0, 1);
    return Math.round((end.getTime() - start.getTime()) / MS_PER_DAY);
  }

  const year = referenceDate.getFullYear();
  const month = referenceDate.getMonth();
  return new Date(year, month + 1, 0).getDate();
}

function toPeriodString(frequency: BudgetFrequency): 'daily' | 'monthly' | 'yearly' {
  if (frequency === 'Day') return 'daily';
  if (frequency === 'Year') return 'yearly';
  return 'monthly';
}

function normalizeFrequency(value: unknown): BudgetFrequency {
  if (value === 'Day' || value === 'Month' || value === 'Year') return value;
  // Legacy support for older clients/data.
  if (value === 'Week') return 'Month';
  return 'Month';
}

function buildCategoryClause(category: string): { clause: string; params: any[] } {
  if (category === 'Food & Drink') {
    return {
      clause: `AND category_primary IN ('Food & Drink', 'Groceries')`,
      params: [],
    };
  }

  return {
    clause: 'AND category_primary = ?',
    params: [category],
  };
}

function mapBudgetRow(row: any): Budget {
  const frequency = normalizeFrequency(row.frequency || 'Month');
  const limitAmount = Number(row.amount) || 0;

  return {
    id: row.id,
    user_id: row.user_id,
    category: row.category,
    frequency,
    limit_amount: limitAmount,
    derived_daily_limit: row.derived_daily_limit ?? computeDerivedDailyLimit(limitAmount, frequency),
    adaptive_enabled: row.adaptive_enabled !== 0,
    adaptive_max_adjust_pct: row.adaptive_max_adjust_pct ?? 10,
    last_auto_adjusted_at: row.last_auto_adjusted_at ?? null,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

/**
 * Compute derived daily limit from frequency and limit_amount.
 * Uses actual days in the active month/year for Month and Year budgets.
 */
export function computeDerivedDailyLimit(
  limitAmount: number,
  frequency: BudgetFrequency,
  referenceDate?: Date
): number {
  const periodDays = getDaysInPeriod(frequency, referenceDate || new Date());
  return Math.round((limitAmount / periodDays) * 100) / 100;
}

export function validateBudgetInput(body: any): { error?: string } {
  if (!body.user_id) return { error: 'user_id required' };
  if (!body.category) return { error: 'category required' };
  if (!VALID_CATEGORIES.includes(body.category)) {
    return { error: `Invalid category. Must be one of: ${VALID_CATEGORIES.join(', ')}` };
  }
  if (typeof body.limit_amount !== 'number' || body.limit_amount <= 0) {
    return { error: 'limit_amount must be a positive number' };
  }
  if (body.frequency && !['Day', 'Month', 'Year'].includes(body.frequency)) {
    return { error: 'frequency must be Day, Month, or Year' };
  }
  if (body.adaptive_enabled !== undefined && typeof body.adaptive_enabled !== 'boolean') {
    return { error: 'adaptive_enabled must be a boolean' };
  }
  if (
    body.adaptive_max_adjust_pct !== undefined &&
    (typeof body.adaptive_max_adjust_pct !== 'number' || body.adaptive_max_adjust_pct < 1 || body.adaptive_max_adjust_pct > 30)
  ) {
    return { error: 'adaptive_max_adjust_pct must be a number between 1 and 30' };
  }
  return {};
}

export function listBudgets(userId: string): Budget[] {
  const db = getDb();
  const rows = db.prepare(
    'SELECT * FROM budget WHERE user_id = ? ORDER BY category'
  ).all(userId) as any[];

  return rows.map(mapBudgetRow);
}

export function createBudget(
  userId: string,
  category: string,
  limitAmount: number,
  frequency: BudgetFrequency = 'Month',
  adaptiveEnabled: boolean = true,
  adaptiveMaxAdjustPct: number = 10
): Budget {
  const db = getDb();
  const id = uuid();
  const normalizedFrequency = normalizeFrequency(frequency);
  const maxAdjustPct = clamp(adaptiveMaxAdjustPct, 1, 30);
  const derivedDaily = computeDerivedDailyLimit(limitAmount, normalizedFrequency);

  db.prepare(`
    INSERT INTO budget (
      id,
      user_id,
      category,
      amount,
      period,
      frequency,
      derived_daily_limit,
      adaptive_enabled,
      adaptive_max_adjust_pct
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    userId,
    category,
    limitAmount,
    toPeriodString(normalizedFrequency),
    normalizedFrequency,
    derivedDaily,
    adaptiveEnabled ? 1 : 0,
    maxAdjustPct,
  );

  const row = db.prepare('SELECT * FROM budget WHERE id = ?').get(id) as any;
  return mapBudgetRow(row);
}

export function upsertBudget(
  userId: string,
  category: string,
  limitAmount: number,
  frequency: BudgetFrequency = 'Month'
): Budget {
  const db = getDb();
  const normalizedFrequency = normalizeFrequency(frequency);
  const derivedDaily = computeDerivedDailyLimit(limitAmount, normalizedFrequency);

  db.prepare(`
    INSERT INTO budget (
      id,
      user_id,
      category,
      amount,
      period,
      frequency,
      derived_daily_limit
    )
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(user_id, category)
    DO UPDATE SET
      amount = excluded.amount,
      period = excluded.period,
      frequency = excluded.frequency,
      derived_daily_limit = excluded.derived_daily_limit,
      updated_at = datetime('now')
  `).run(
    uuid(),
    userId,
    category,
    limitAmount,
    toPeriodString(normalizedFrequency),
    normalizedFrequency,
    derivedDaily
  );

  const row = db.prepare(
    'SELECT * FROM budget WHERE user_id = ? AND category = ?'
  ).get(userId, category) as any;

  return mapBudgetRow(row);
}

export interface BudgetProjection {
  category: string;
  currentSpent: number;
  budgetLimit: number;
  projectedSpend: number;
  projectedPercent: number;
  overBudget: boolean;
  dailyRate7d: number;
  dailyRatePeriod: number;
}

export interface ProjectionsResult {
  projections: BudgetProjection[];
  dailySummary: {
    totalDailySpent: number;
    totalDailyLimit: number;
    projectedDailyPercent: number;
  };
}

function getCurrentPeriodBounds(frequency: BudgetFrequency, now: Date): { start: Date; periodDays: number } {
  if (frequency === 'Day') {
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    return { start, periodDays: 1 };
  }

  if (frequency === 'Year') {
    const start = new Date(now.getFullYear(), 0, 1);
    const periodDays = getDaysInPeriod('Year', now);
    return { start, periodDays };
  }

  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const periodDays = getDaysInPeriod('Month', now);
  return { start, periodDays };
}

/**
 * Compute AI-informed spending projections for each budget category.
 * Uses a weighted daily spend rate: 60% recent 7-day rate, 40% full-period rate.
 */
export function computeProjections(userId: string): ProjectionsResult {
  const db = getDb();
  const now = new Date();
  const today = now.toISOString().split('T')[0];

  const budgetRows = db.prepare(
    'SELECT * FROM budget WHERE user_id = ? ORDER BY category'
  ).all(userId) as any[];

  const projections: BudgetProjection[] = [];

  for (const row of budgetRows) {
    const frequency = normalizeFrequency(row.frequency || 'Month');
    const limitAmount = Number(row.amount) || 0;

    const { start: periodStart, periodDays: totalPeriodDays } = getCurrentPeriodBounds(frequency, now);
    const periodStartStr = periodStart.toISOString().split('T')[0];

    // Current period spend (group Groceries into Food & Drink)
    const { clause, params } = buildCategoryClause(row.category);
    const spendRow = db.prepare(`
      SELECT COALESCE(SUM(ABS(amount)), 0) as total
      FROM transaction_
      WHERE user_id = ? ${clause} AND amount < 0 AND pending = 0
        AND date >= ? AND date <= ?
    `).get(userId, ...params, periodStartStr, today) as any;
    const currentSpent = Math.round((spendRow?.total || 0) * 100) / 100;

    const daysElapsed = Math.max(
      1,
      Math.min(totalPeriodDays, Math.ceil((now.getTime() - periodStart.getTime()) / MS_PER_DAY) + 1)
    );
    const daysRemaining = Math.max(0, totalPeriodDays - daysElapsed);

    // Full-period daily rate
    const dailyRatePeriod = currentSpent / daysElapsed;

    // Recent 7-day rate
    const d7 = new Date(now);
    d7.setDate(d7.getDate() - 6);
    const d7Str = d7.toISOString().split('T')[0];
    const spend7dRow = db.prepare(`
      SELECT COALESCE(SUM(ABS(amount)), 0) as total
      FROM transaction_
      WHERE user_id = ? ${clause} AND amount < 0 AND pending = 0
        AND date >= ? AND date <= ?
    `).get(userId, ...params, d7Str, today) as any;
    const spend7d = spend7dRow?.total || 0;
    const dailyRate7d = spend7d / 7;

    // Weighted daily rate: 60% recent, 40% full period
    const weightedDailyRate = dailyRate7d * 0.6 + dailyRatePeriod * 0.4;

    const projectedSpend = Math.round((currentSpent + weightedDailyRate * daysRemaining) * 100) / 100;
    const projectedPercent = limitAmount > 0 ? Math.round((projectedSpend / limitAmount) * 100) : 0;

    projections.push({
      category: row.category,
      currentSpent,
      budgetLimit: limitAmount,
      projectedSpend,
      projectedPercent,
      overBudget: projectedPercent > 100,
      dailyRate7d: Math.round(dailyRate7d * 100) / 100,
      dailyRatePeriod: Math.round(dailyRatePeriod * 100) / 100,
    });
  }

  // Daily summary: sum of all category daily projections vs total daily limit
  const totalDailySpent = projections.reduce((sum, p) => sum + p.dailyRate7d, 0);
  const totalDailyLimit = budgetRows.reduce((sum, row) => {
    return sum + computeDerivedDailyLimit(Number(row.amount) || 0, normalizeFrequency(row.frequency || 'Month'));
  }, 0);
  const projectedDailyPercent = totalDailyLimit > 0
    ? Math.round((totalDailySpent / totalDailyLimit) * 100)
    : 0;

  return {
    projections,
    dailySummary: {
      totalDailySpent: Math.round(totalDailySpent * 100) / 100,
      totalDailyLimit: Math.round(totalDailyLimit * 100) / 100,
      projectedDailyPercent,
    },
  };
}

export function updateBudget(
  budgetId: string,
  updates: {
    limit_amount?: number;
    frequency?: BudgetFrequency;
    category?: string;
    adaptive_enabled?: boolean;
    adaptive_max_adjust_pct?: number;
  }
): Budget | null {
  const db = getDb();
  const existing = db.prepare('SELECT * FROM budget WHERE id = ?').get(budgetId) as any;
  if (!existing) return null;

  if (updates.limit_amount !== undefined && (typeof updates.limit_amount !== 'number' || updates.limit_amount <= 0)) {
    throw new Error('limit_amount must be a positive number');
  }
  if (
    updates.adaptive_max_adjust_pct !== undefined &&
    (typeof updates.adaptive_max_adjust_pct !== 'number' || updates.adaptive_max_adjust_pct < 1 || updates.adaptive_max_adjust_pct > 30)
  ) {
    throw new Error('adaptive_max_adjust_pct must be a number between 1 and 30');
  }

  const limitAmount = updates.limit_amount ?? existing.amount;
  const frequency = normalizeFrequency(updates.frequency ?? existing.frequency ?? 'Month');
  const category = updates.category ?? existing.category;
  const adaptiveEnabled = updates.adaptive_enabled ?? existing.adaptive_enabled !== 0;
  const adaptiveMaxAdjustPct = clamp(updates.adaptive_max_adjust_pct ?? existing.adaptive_max_adjust_pct ?? 10, 1, 30);
  const derivedDaily = computeDerivedDailyLimit(limitAmount, frequency);

  db.prepare(`
    UPDATE budget
    SET category = ?,
        amount = ?,
        frequency = ?,
        derived_daily_limit = ?,
        period = ?,
        adaptive_enabled = ?,
        adaptive_max_adjust_pct = ?,
        updated_at = datetime('now')
    WHERE id = ?
  `).run(
    category,
    limitAmount,
    frequency,
    derivedDaily,
    toPeriodString(frequency),
    adaptiveEnabled ? 1 : 0,
    adaptiveMaxAdjustPct,
    budgetId,
  );

  const row = db.prepare('SELECT * FROM budget WHERE id = ?').get(budgetId) as any;
  return row ? mapBudgetRow(row) : null;
}

function percentile(sortedValues: number[], p: number): number {
  if (sortedValues.length === 0) return 0;
  const idx = Math.min(sortedValues.length - 1, Math.max(0, Math.floor((sortedValues.length - 1) * p)));
  return sortedValues[idx];
}

function roundToNearestFive(value: number): number {
  return Math.max(5, Math.round(value / 5) * 5);
}

/**
 * Adaptive mode algorithm:
 * - Blend spend rates (7/30/90-day)
 * - Apply trend factor (clamped to +/- 15%)
 * - Clamp each adjustment to budget's adaptive max percentage
 * - Skip noisy/sparse data and small changes
 */
export function applyAdaptiveAdjustments(userId: string): AdaptiveAdjustmentResult {
  const db = getDb();
  const now = new Date();
  const today = now.toISOString().split('T')[0];
  const d90 = new Date(now);
  d90.setDate(d90.getDate() - 89);
  const d90Str = d90.toISOString().split('T')[0];

  const rows = db.prepare(
    `SELECT * FROM budget
     WHERE user_id = ? AND COALESCE(adaptive_enabled, 1) = 1
     ORDER BY category`
  ).all(userId) as any[];

  const adjustments: AdaptiveAdjustment[] = [];
  let skipped = 0;

  for (const row of rows) {
    const budget = mapBudgetRow(row);

    const cooldownRef = budget.last_auto_adjusted_at || budget.updated_at;
    if (cooldownRef) {
      const msSince = now.getTime() - new Date(cooldownRef).getTime();
      if (msSince < 7 * MS_PER_DAY) {
        skipped += 1;
        continue;
      }
    }

    const { clause, params } = buildCategoryClause(budget.category);
    const txRows = db.prepare(`
      SELECT ABS(amount) as amount, date
      FROM transaction_
      WHERE user_id = ? ${clause}
        AND amount < 0
        AND pending = 0
        AND date >= ?
        AND date <= ?
    `).all(userId, ...params, d90Str, today) as Array<{ amount: number; date: string }>;

    if (txRows.length < 6) {
      skipped += 1;
      continue;
    }

    const sortedAmounts = txRows.map((t) => Number(t.amount) || 0).sort((a, b) => a - b);
    const p95 = percentile(sortedAmounts, 0.95);

    const d7 = new Date(now);
    d7.setDate(d7.getDate() - 6);
    const d30 = new Date(now);
    d30.setDate(d30.getDate() - 29);

    let sum7 = 0;
    let sum30 = 0;
    let sum90 = 0;

    for (const tx of txRows) {
      const capped = Math.min(Number(tx.amount) || 0, p95);
      const txTime = new Date(`${tx.date}T00:00:00`).getTime();
      if (txTime >= d7.getTime()) sum7 += capped;
      if (txTime >= d30.getTime()) sum30 += capped;
      sum90 += capped;
    }

    const r7 = sum7 / 7;
    const r30 = sum30 / 30;
    const r90 = sum90 / 90;

    const currentDaily = computeDerivedDailyLimit(budget.limit_amount, budget.frequency, now);
    if (currentDaily <= 0) {
      skipped += 1;
      continue;
    }

    const trendPct = r30 > 0 ? clamp((r7 - r30) / r30, -0.15, 0.15) : 0;
    const blendedDaily = (0.5 * r30) + (0.3 * r7) + (0.2 * r90);
    const targetDaily = blendedDaily * (1 + trendPct);

    const maxPct = clamp(budget.adaptive_max_adjust_pct || 10, 1, 30);
    const minDaily = currentDaily * (1 - maxPct / 100);
    const maxDaily = currentDaily * (1 + maxPct / 100);
    const proposedDaily = clamp(targetDaily, minDaily, maxDaily);

    const periodDays = getDaysInPeriod(budget.frequency, now);
    const rawLimit = proposedDaily * periodDays;
    const newLimit = roundToNearestFive(rawLimit);

    const deltaAbs = newLimit - budget.limit_amount;
    const deltaPct = budget.limit_amount > 0 ? Math.abs((deltaAbs / budget.limit_amount) * 100) : 0;

    if (Math.abs(deltaAbs) < 10 && deltaPct < 5) {
      skipped += 1;
      continue;
    }

    const newDailyLimit = computeDerivedDailyLimit(newLimit, budget.frequency, now);
    db.prepare(`
      UPDATE budget
      SET amount = ?,
          derived_daily_limit = ?,
          last_auto_adjusted_at = datetime('now'),
          updated_at = datetime('now')
      WHERE id = ?
    `).run(newLimit, newDailyLimit, budget.id);

    const direction = deltaAbs >= 0 ? 'increase' : 'decrease';
    adjustments.push({
      budget_id: budget.id,
      category: budget.category,
      old_limit_amount: budget.limit_amount,
      new_limit_amount: newLimit,
      reason: `Adaptive ${direction}: 7d/30d/90d blended spend trend (${Math.round(maxPct)}% max step).`,
    });
  }

  return { adjustments, skipped };
}
