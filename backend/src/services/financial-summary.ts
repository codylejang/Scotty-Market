import { getTransactions } from './ingestion';
import { FinancialSummary } from '../schemas';

/**
 * Build a financial summary for a user over a given date range.
 * Amounts are signed: negative = spending, positive = income/refunds.
 */
export function buildFinancialSummary(
  userId: string,
  periodStart: string,
  periodEnd: string
): FinancialSummary {
  const posted = getTransactions(userId, periodStart, periodEnd, { includePending: false });
  const pending = getTransactions(userId, periodStart, periodEnd, { includePending: true });
  const pendingOnly = pending.filter(t => t.pending);

  const byCategory: Record<string, number> = {};
  const byMerchant: Record<string, number> = {};
  let totalSpent = 0;
  let totalIncome = 0;

  for (const txn of posted) {
    // Negative amounts = spending
    if (txn.amount < 0) {
      totalSpent += Math.abs(txn.amount);
    } else {
      totalIncome += txn.amount;
    }

    const cat = txn.category_primary || 'Other';
    byCategory[cat] = (byCategory[cat] || 0) + Math.abs(txn.amount);

    const merchant = txn.merchant_name || txn.name;
    byMerchant[merchant] = (byMerchant[merchant] || 0) + Math.abs(txn.amount);
  }

  // Top merchants by total spend
  const topMerchants = Object.entries(byMerchant)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10)
    .map(([name, total]) => ({ name, total: Math.round(total * 100) / 100 }));

  const pendingTotal = pendingOnly.reduce((sum, t) => sum + Math.abs(t.amount), 0);

  return {
    user_id: userId,
    period_start: periodStart,
    period_end: periodEnd,
    total_spent: Math.round(totalSpent * 100) / 100,
    total_income: Math.round(totalIncome * 100) / 100,
    by_category: Object.fromEntries(
      Object.entries(byCategory).map(([k, v]) => [k, Math.round(v * 100) / 100])
    ),
    by_merchant: Object.fromEntries(
      Object.entries(byMerchant).map(([k, v]) => [k, Math.round(v * 100) / 100])
    ),
    top_merchants: topMerchants,
    pending_total: Math.round(pendingTotal * 100) / 100,
    transaction_count: posted.length,
  };
}

/**
 * Build summaries for both 7-day and 30-day windows.
 */
export function buildDualSummary(userId: string): {
  summary7d: FinancialSummary;
  summary30d: FinancialSummary;
} {
  const now = new Date();
  const end = now.toISOString().split('T')[0];

  const d7 = new Date(now);
  d7.setDate(d7.getDate() - 7);
  const start7 = d7.toISOString().split('T')[0];

  const d30 = new Date(now);
  d30.setDate(d30.getDate() - 30);
  const start30 = d30.toISOString().split('T')[0];

  return {
    summary7d: buildFinancialSummary(userId, start7, end),
    summary30d: buildFinancialSummary(userId, start30, end),
  };
}
