import { Transaction, TransactionCategory } from '../types';

export function getSpendingByCategory(
  transactions: Transaction[]
): Record<TransactionCategory, number> {
  const spending: Partial<Record<TransactionCategory, number>> = {};
  for (const tx of transactions) {
    if (tx.isIncoming) continue; // Exclude income (e.g. paychecks)
    spending[tx.category] = (spending[tx.category] || 0) + tx.amount;
  }
  return spending as Record<TransactionCategory, number>;
}

export function getTotalSpending(transactions: Transaction[], days: number = 30): number {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);

  return transactions
    .filter((tx) => tx.date >= cutoff && !tx.isIncoming)
    .reduce((sum, tx) => sum + tx.amount, 0);
}

export function getSpendingSince(transactions: Transaction[], start: Date): number {
  return transactions
    .filter((tx) => tx.date >= start && !tx.isIncoming)
    .reduce((sum, tx) => sum + tx.amount, 0);
}

export function getTopSpendingCategories(
  transactions: Transaction[],
  limit: number = 3
): Array<{ category: TransactionCategory; amount: number }> {
  return Object.entries(getSpendingByCategory(transactions))
    .filter(([, amount]) => amount > 0)
    .sort(([, a], [, b]) => b - a)
    .slice(0, limit)
    .map(([category, amount]) => ({
      category: category as TransactionCategory,
      amount,
    }));
}
