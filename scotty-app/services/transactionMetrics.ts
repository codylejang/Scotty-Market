import { Transaction, TransactionCategory } from '../types';

export function getSpendingByCategory(
  transactions: Transaction[]
): Record<TransactionCategory, number> {
  const spending: Partial<Record<TransactionCategory, number>> = {};
  for (const tx of transactions) {
    spending[tx.category] = (spending[tx.category] || 0) + tx.amount;
  }
  return spending as Record<TransactionCategory, number>;
}

export function getTotalSpending(transactions: Transaction[], days: number = 30): number {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);

  return transactions
    .filter((tx) => tx.date >= cutoff)
    .reduce((sum, tx) => sum + tx.amount, 0);
}
