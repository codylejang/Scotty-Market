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
