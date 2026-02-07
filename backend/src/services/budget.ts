import { v4 as uuid } from 'uuid';
import { getDb } from '../db/database';

export type BudgetFrequency = 'Day' | 'Week' | 'Month';

export interface Budget {
  id: string;
  user_id: string;
  category: string;
  frequency: BudgetFrequency;
  limit_amount: number;
  derived_daily_limit: number;
  created_at: string;
  updated_at: string;
}

// Supported categories (7 as referenced in project)
const VALID_CATEGORIES = [
  'Food & Drink', 'Groceries', 'Transportation', 'Entertainment',
  'Shopping', 'Health', 'Subscription',
];

/**
 * Compute derived daily limit from frequency and limit_amount.
 * Uses actual days in current month for monthly budgets.
 */
export function computeDerivedDailyLimit(
  limitAmount: number,
  frequency: BudgetFrequency,
  referenceDate?: Date
): number {
  const ref = referenceDate || new Date();
  switch (frequency) {
    case 'Day':
      return Math.round(limitAmount * 100) / 100;
    case 'Week':
      return Math.round((limitAmount / 7) * 100) / 100;
    case 'Month': {
      // Use actual days in the current month
      const year = ref.getFullYear();
      const month = ref.getMonth();
      const daysInMonth = new Date(year, month + 1, 0).getDate();
      return Math.round((limitAmount / daysInMonth) * 100) / 100;
    }
    default:
      return Math.round((limitAmount / 30) * 100) / 100;
  }
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
  if (body.frequency && !['Day', 'Week', 'Month'].includes(body.frequency)) {
    return { error: 'frequency must be Day, Week, or Month' };
  }
  return {};
}

export function listBudgets(userId: string): Budget[] {
  const db = getDb();
  const rows = db.prepare(
    'SELECT * FROM budget WHERE user_id = ? ORDER BY category'
  ).all(userId) as any[];

  return rows.map(r => ({
    id: r.id,
    user_id: r.user_id,
    category: r.category,
    frequency: (r.frequency || 'Month') as BudgetFrequency,
    limit_amount: r.amount,
    derived_daily_limit: r.derived_daily_limit ?? computeDerivedDailyLimit(r.amount, r.frequency || 'Month'),
    created_at: r.created_at,
    updated_at: r.updated_at,
  }));
}

export function createBudget(
  userId: string,
  category: string,
  limitAmount: number,
  frequency: BudgetFrequency = 'Month'
): Budget {
  const db = getDb();
  const id = uuid();
  const derivedDaily = computeDerivedDailyLimit(limitAmount, frequency);

  db.prepare(`
    INSERT INTO budget (id, user_id, category, amount, period, frequency, derived_daily_limit)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(id, userId, category, limitAmount, frequency.toLowerCase(), frequency, derivedDaily);

  const row = db.prepare('SELECT * FROM budget WHERE id = ?').get(id) as any;
  return {
    id: row.id,
    user_id: row.user_id,
    category: row.category,
    frequency,
    limit_amount: row.amount,
    derived_daily_limit: derivedDaily,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
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
    const frequency: BudgetFrequency = (row.frequency || 'Month') as BudgetFrequency;
    const limitAmount: number = row.amount;

    // Determine period boundaries
    let periodStart: Date;
    let periodEnd: Date;
    if (frequency === 'Day') {
      periodStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      periodEnd = new Date(periodStart.getTime() + 86400000);
    } else if (frequency === 'Week') {
      const dayOfWeek = now.getDay();
      periodStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - dayOfWeek);
      periodEnd = new Date(periodStart.getTime() + 7 * 86400000);
    } else {
      periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
      periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    }

    const periodStartStr = periodStart.toISOString().split('T')[0];
    const periodEndStr = periodEnd.toISOString().split('T')[0];

    // Current period spend (group Groceries into Food & Drink)
    const categoryClause = row.category === 'Food & Drink'
      ? `AND category_primary IN ('Food & Drink', 'Groceries')`
      : `AND category_primary = ?`;
    const categoryParams = row.category === 'Food & Drink'
      ? [userId, periodStartStr, today]
      : [userId, row.category, periodStartStr, today];
    const spendRow = db.prepare(`
      SELECT COALESCE(SUM(ABS(amount)), 0) as total
      FROM transaction_
      WHERE user_id = ? ${categoryClause} AND amount < 0 AND pending = 0
        AND date >= ? AND date <= ?
    `).get(...categoryParams) as any;
    const currentSpent = Math.round((spendRow?.total || 0) * 100) / 100;

    // Days elapsed and remaining in period
    const msPerDay = 86400000;
    const daysElapsed = Math.max(1, Math.ceil((now.getTime() - periodStart.getTime()) / msPerDay));
    const totalPeriodDays = Math.max(1, Math.ceil((periodEnd.getTime() - periodStart.getTime()) / msPerDay));
    const daysRemaining = Math.max(0, totalPeriodDays - daysElapsed);

    // Full-period daily rate
    const dailyRatePeriod = currentSpent / daysElapsed;

    // Recent 7-day rate
    const d7 = new Date(now);
    d7.setDate(d7.getDate() - 7);
    const d7Str = d7.toISOString().split('T')[0];
    const params7d = row.category === 'Food & Drink'
      ? [userId, d7Str, today]
      : [userId, row.category, d7Str, today];
    const spend7dRow = db.prepare(`
      SELECT COALESCE(SUM(ABS(amount)), 0) as total
      FROM transaction_
      WHERE user_id = ? ${categoryClause} AND amount < 0 AND pending = 0
        AND date >= ? AND date <= ?
    `).get(...params7d) as any;
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
    return sum + computeDerivedDailyLimit(row.amount, (row.frequency || 'Month') as BudgetFrequency);
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
  updates: { limit_amount?: number; frequency?: BudgetFrequency; category?: string }
): Budget | null {
  const db = getDb();
  const existing = db.prepare('SELECT * FROM budget WHERE id = ?').get(budgetId) as any;
  if (!existing) return null;

  const limitAmount = updates.limit_amount ?? existing.amount;
  const frequency = updates.frequency ?? (existing.frequency || 'Month') as BudgetFrequency;
  const category = updates.category ?? existing.category;
  const derivedDaily = computeDerivedDailyLimit(limitAmount, frequency);

  db.prepare(`
    UPDATE budget SET category = ?, amount = ?, frequency = ?, derived_daily_limit = ?,
    period = ?, updated_at = datetime('now')
    WHERE id = ?
  `).run(category, limitAmount, frequency, derivedDaily, frequency.toLowerCase(), budgetId);

  return {
    id: existing.id,
    user_id: existing.user_id,
    category,
    frequency,
    limit_amount: limitAmount,
    derived_daily_limit: derivedDaily,
    created_at: existing.created_at,
    updated_at: new Date().toISOString(),
  };
}
