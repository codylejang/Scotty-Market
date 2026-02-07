import { Transaction, TransactionCategory, Achievement, UserProfile, Quest } from '../types';
import seedSuite from '../data/nessie-seed-transactions.json';

type SeedTransactionKind = 'purchase' | 'deposit' | 'withdrawal' | 'transfer';

interface SeedTransaction {
  kind: SeedTransactionKind;
  account: string;
  payeeAccount?: string;
  date: string;
  amount: number;
  description: string;
}

interface SeedSuite {
  transactions: SeedTransaction[];
}

const parsedSeed = seedSuite as SeedSuite;

function generateId(): string {
  return Math.random().toString(36).substring(2, 11);
}

function mapDescriptionToCategory(description: string): TransactionCategory {
  const text = description.toLowerCase();
  if (text.includes('subscription') || text.includes('netflix') || text.includes('spotify') || text.includes('disney+') || text.includes('icloud') || text.includes('chatgpt')) {
    return 'subscriptions';
  }
  if (text.includes('grocer')) return 'groceries';
  if (text.includes('dining') || text.includes('coffee') || text.includes('brunch') || text.includes('dinner') || text.includes('lunch') || text.includes('pizza')) {
    return 'food_dining';
  }
  if (text.includes('travel') || text.includes('rideshare') || text.includes('train') || text.includes('flight') || text.includes('airport') || text.includes('bus') || text.includes('shuttle') || text.includes('rental')) {
    return 'transport';
  }
  if (text.includes('fun') || text.includes('movie') || text.includes('concert') || text.includes('museum') || text.includes('theme park') || text.includes('escape room')) {
    return 'entertainment';
  }
  if (text.includes('shopping') || text.includes('jacket') || text.includes('shoes') || text.includes('headphones') || text.includes('sale') || text.includes('gift') || text.includes('clothes')) {
    return 'shopping';
  }
  if (text.includes('self-care') || text.includes('pharmacy') || text.includes('haircut') || text.includes('dental') || text.includes('wellness') || text.includes('salon') || text.includes('vitamins')) {
    return 'health';
  }
  if (text.includes('utility') || text.includes('internet') || text.includes('rent')) {
    return 'utilities';
  }
  return 'other';
}

function toMerchant(description: string): string {
  const [, detail] = description.split(' - ');
  return (detail || description).trim();
}

function isSpendingTransaction(seed: SeedTransaction): boolean {
  return seed.kind === 'purchase' || seed.kind === 'withdrawal';
}

function toAppTransaction(seed: SeedTransaction, index: number): Transaction {
  return {
    id: `seed_${index}_${seed.kind}_${seed.date}`,
    amount: Math.abs(seed.amount),
    category: mapDescriptionToCategory(seed.description),
    merchant: toMerchant(seed.description),
    date: new Date(seed.date),
    isSubscription: mapDescriptionToCategory(seed.description) === 'subscriptions',
  };
}

const SEEDED_SPENDING: Transaction[] = parsedSeed.transactions
  .filter(isSpendingTransaction)
  .map(toAppTransaction)
  .sort((a, b) => b.date.getTime() - a.date.getTime());

export function generateTransaction(daysAgo: number = 0): Transaction {
  const target = new Date();
  target.setDate(target.getDate() - daysAgo);
  const targetStr = target.toISOString().slice(0, 10);
  const forDay = SEEDED_SPENDING.filter(
    (tx) => tx.date.toISOString().slice(0, 10) === targetStr
  );
  const picked = forDay[0] || SEEDED_SPENDING[daysAgo % SEEDED_SPENDING.length];
  return { ...picked, date: new Date(picked.date) };
}

export function generateTransactionHistory(
  days: number = 30,
  _transactionsPerDay: number = 3
): Transaction[] {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);

  return SEEDED_SPENDING
    .filter((tx) => tx.date >= cutoff)
    .map((tx) => ({ ...tx, date: new Date(tx.date) }))
    .sort((a, b) => b.date.getTime() - a.date.getTime());
}

export function generateSubscriptions(): Transaction[] {
  const latestByMerchant = new Map<string, Transaction>();
  for (const tx of SEEDED_SPENDING.filter((t) => t.category === 'subscriptions')) {
    const existing = latestByMerchant.get(tx.merchant);
    if (!existing || tx.date > existing.date) {
      latestByMerchant.set(tx.merchant, tx);
    }
  }
  return Array.from(latestByMerchant.values()).map((tx) => ({
    ...tx,
    date: new Date(tx.date),
    isSubscription: true,
  }));
}

export function generateUserProfile(): UserProfile {
  return {
    monthlyBudget: 1500,
    monthlySavingsGoal: 300,
    currentBalance: 2400,
  };
}

export function generateSampleAchievements(transactions: Transaction[]): Achievement[] {
  const categorySpending: Record<string, number> = {};

  transactions.forEach((t) => {
    categorySpending[t.category] = (categorySpending[t.category] || 0) + t.amount;
  });

  const achievements: Achievement[] = [];
  const topCategory = Object.entries(categorySpending).sort(([, a], [, b]) => b - a)[0];

  if (topCategory) {
    const [category, amount] = topCategory;
    achievements.push({
      id: generateId(),
      title: `Reduce ${category.replace('_', ' ')} spending`,
      description: `You spent $${amount.toFixed(0)} on ${category.replace('_', ' ')} recently. Try cutting back by 20%.`,
      targetAmount: Math.round(amount * 0.8),
      currentAmount: amount,
      completed: false,
      category: category as TransactionCategory,
      aiGenerated: true,
    });
  }

  const subscriptionSpend = transactions
    .filter((t) => t.category === 'subscriptions')
    .reduce((sum, t) => sum + t.amount, 0);
  if (subscriptionSpend > 0) {
    achievements.push({
      id: generateId(),
      title: 'Subscription Audit',
      description: `Recurring subscriptions total $${subscriptionSpend.toFixed(2)}. Consider canceling one you barely use.`,
      completed: false,
      category: 'subscriptions',
      aiGenerated: true,
    });
  }

  achievements.push({
    id: generateId(),
    title: 'Weekend Saver',
    description: 'Keep weekend spending under $50 for entertainment and dining.',
    targetAmount: 50,
    currentAmount: 0,
    completed: false,
    aiGenerated: true,
  });

  return achievements;
}

export function getSpendingByCategory(
  transactions: Transaction[]
): Record<TransactionCategory, number> {
  const spending: Partial<Record<TransactionCategory, number>> = {};
  transactions.forEach((t) => {
    spending[t.category] = (spending[t.category] || 0) + t.amount;
  });
  return spending as Record<TransactionCategory, number>;
}

export function getTotalSpending(transactions: Transaction[], days: number = 30): number {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);

  return transactions
    .filter((t) => t.date >= cutoff)
    .reduce((sum, t) => sum + t.amount, 0);
}

// Generate quests that tie to user's savings goals
export function generateDailyQuests(): Quest[] {
  return [
    {
      id: generateId(),
      title: 'Save $10 on dining',
      subtitle: 'Meat Treat',
      emoji: '🍖',
      xpReward: 50,
      progress: 2,
      goal: 5,
      progressUnit: 'days',
      bgColor: '#ffb3ba',
      goalTarget: 'Juicy Meat Fund',
    },
    {
      id: generateId(),
      title: 'Skip 1 boba run',
      subtitle: 'Sugar Free',
      emoji: '🧋',
      xpReward: 30,
      progress: 0,
      goal: 1,
      progressUnit: 'skips',
      bgColor: '#fff9c4',
      goalTarget: 'Boba Run Savings',
    },
    {
      id: generateId(),
      title: 'Drink water',
      subtitle: 'Daily Hydration',
      emoji: '💧',
      xpReward: 10,
      progress: 6,
      goal: 8,
      progressUnit: 'cups',
      bgColor: '#bae1ff',
    },
    {
      id: generateId(),
      title: 'Buy Bulk Kibble',
      subtitle: 'Big Savings',
      emoji: '🦴',
      xpReward: 100,
      progress: 0,
      goal: 1,
      progressUnit: 'pack',
      bgColor: '#baffc9',
      goalTarget: 'Ice Cream Party',
    },
  ];
}

// Get quests for specific goals
export function getQuestsForGoal(goalName: string, transactions: Transaction[]): Quest[] {
  const allQuests = generateDailyQuests();
  return allQuests.filter(q => q.goalTarget === goalName);
}
