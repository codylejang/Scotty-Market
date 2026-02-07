import { getTransactions } from './ingestion';
import { getDb } from '../db/database';

const IMPULSE_MERCHANTS = ['DoorDash', 'Uber Eats', 'Amazon', 'Shein', 'Steam'];
const IMPULSE_THRESHOLD = 5;

export interface HealthMetrics {
  budgetAdherence: number;
  savingsRate: number;
  impulseScore: number;
  overallScore: number;
}

/**
 * Compute health metrics for a user based on their transactions and budgets.
 */
export function computeHealthMetrics(userId: string): HealthMetrics {
  const db = getDb();
  const now = new Date();
  const end = now.toISOString().split('T')[0];
  const d30 = new Date(now);
  d30.setDate(d30.getDate() - 30);
  const start = d30.toISOString().split('T')[0];

  const transactions = getTransactions(userId, start, end, { includePending: false });

  // Total spent (negative amounts = spending)
  const totalSpent = transactions
    .filter(t => t.amount < 0)
    .reduce((sum, t) => sum + Math.abs(t.amount), 0);

  // Get budget total from budget table
  const budgets = db.prepare('SELECT * FROM budget WHERE user_id = ?').all(userId) as any[];
  const monthlyBudget = budgets.reduce((sum: number, b: any) => sum + b.amount, 0) || 1500;

  // Budget adherence (0-100)
  const budgetAdherence = Math.max(0, Math.min(100,
    ((monthlyBudget - totalSpent) / monthlyBudget) * 100 + 50
  ));

  // Savings rate (0-100) - estimate income as budget * 1.3
  const estimatedIncome = monthlyBudget * 1.3;
  const actualSavings = estimatedIncome - totalSpent;
  const monthlySavingsGoal = monthlyBudget * 0.2;
  const savingsRate = Math.max(0, Math.min(100,
    (actualSavings / (monthlySavingsGoal || 1)) * 50
  ));

  // Impulse score (0-100, higher = fewer impulse purchases)
  const impulseCount = transactions.filter(t => {
    const merchant = t.merchant_name || t.name;
    return IMPULSE_MERCHANTS.some(m => merchant.toLowerCase().includes(m.toLowerCase()));
  }).length;
  const impulseScore = Math.max(0, Math.min(100,
    100 - (impulseCount / IMPULSE_THRESHOLD) * 50
  ));

  // Overall score (weighted average)
  const overallScore = Math.round(
    budgetAdherence * 0.4 +
    savingsRate * 0.3 +
    impulseScore * 0.3
  );

  return {
    budgetAdherence: Math.round(budgetAdherence),
    savingsRate: Math.round(savingsRate),
    impulseScore: Math.round(impulseScore),
    overallScore,
  };
}
