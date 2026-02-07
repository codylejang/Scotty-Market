import { Transaction, TransactionCategory, Achievement, UserProfile, Quest } from '../types';

// Realistic college student merchants by category
const MERCHANTS: Record<TransactionCategory, string[]> = {
  food_dining: ['Chipotle', 'Chick-fil-A', 'Starbucks', 'Dominos', 'DoorDash', 'Uber Eats', 'Taco Bell', 'McDonalds', 'Panda Express', 'Subway'],
  groceries: ['Trader Joes', 'Walmart', 'Target', 'Aldi', 'Kroger', 'Costco', 'Whole Foods'],
  transport: ['Uber', 'Lyft', 'Shell Gas', 'BP', 'Campus Parking', 'Bus Pass'],
  entertainment: ['Netflix', 'Spotify', 'Steam', 'PlayStation', 'AMC Theaters', 'Dave & Busters', 'TopGolf'],
  shopping: ['Amazon', 'Target', 'Shein', 'Urban Outfitters', 'Nike', 'Best Buy', 'Etsy'],
  subscriptions: ['Netflix', 'Spotify', 'Apple Music', 'Disney+', 'Hulu', 'HBO Max', 'Crunchyroll', 'ChatGPT Plus', 'iCloud'],
  utilities: ['Verizon', 'AT&T', 'Xfinity', 'Electric Co', 'Water Utility'],
  education: ['Campus Bookstore', 'Chegg', 'Coursera', 'Quizlet Plus'],
  health: ['CVS', 'Walgreens', 'Campus Health', 'GoodRx'],
  other: ['Venmo', 'ATM Withdrawal', 'Cash App'],
};

// Typical spending ranges for college students
const SPENDING_RANGES: Record<TransactionCategory, [number, number]> = {
  food_dining: [8, 45],
  groceries: [25, 120],
  transport: [10, 50],
  entertainment: [10, 60],
  shopping: [15, 100],
  subscriptions: [5, 20],
  utilities: [30, 80],
  education: [20, 150],
  health: [10, 50],
  other: [10, 100],
};

// Category weights for realistic distribution
const CATEGORY_WEIGHTS: Record<TransactionCategory, number> = {
  food_dining: 0.35,
  groceries: 0.12,
  transport: 0.12,
  entertainment: 0.10,
  shopping: 0.12,
  subscriptions: 0.08,
  utilities: 0.04,
  education: 0.03,
  health: 0.02,
  other: 0.02,
};

function generateId(): string {
  return Math.random().toString(36).substring(2, 11);
}

function randomInRange(min: number, max: number): number {
  return Math.round((Math.random() * (max - min) + min) * 100) / 100;
}

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function weightedRandomCategory(): TransactionCategory {
  const random = Math.random();
  let cumulative = 0;

  for (const [category, weight] of Object.entries(CATEGORY_WEIGHTS)) {
    cumulative += weight;
    if (random <= cumulative) {
      return category as TransactionCategory;
    }
  }

  return 'other';
}

export function generateTransaction(daysAgo: number = 0): Transaction {
  const category = weightedRandomCategory();
  const [min, max] = SPENDING_RANGES[category];
  const merchants = MERCHANTS[category];

  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  date.setHours(Math.floor(Math.random() * 14) + 8); // 8am - 10pm
  date.setMinutes(Math.floor(Math.random() * 60));

  return {
    id: generateId(),
    amount: randomInRange(min, max),
    category,
    merchant: pickRandom(merchants),
    date,
    isSubscription: category === 'subscriptions',
  };
}

export function generateTransactionHistory(days: number = 30, transactionsPerDay: number = 3): Transaction[] {
  const transactions: Transaction[] = [];

  for (let day = 0; day < days; day++) {
    // Vary transactions per day (1-5, averaging around transactionsPerDay)
    const count = Math.max(1, Math.floor(transactionsPerDay + (Math.random() - 0.5) * 4));

    for (let i = 0; i < count; i++) {
      transactions.push(generateTransaction(day));
    }
  }

  // Sort by date descending (most recent first)
  return transactions.sort((a, b) => b.date.getTime() - a.date.getTime());
}

export function generateSubscriptions(): Transaction[] {
  const subscriptionMerchants = MERCHANTS.subscriptions;
  const numSubscriptions = Math.floor(Math.random() * 4) + 3; // 3-6 subscriptions
  const selected = new Set<string>();
  const subscriptions: Transaction[] = [];

  while (selected.size < numSubscriptions) {
    const merchant = pickRandom(subscriptionMerchants);
    if (!selected.has(merchant)) {
      selected.add(merchant);
      subscriptions.push({
        id: generateId(),
        amount: randomInRange(5, 20),
        category: 'subscriptions',
        merchant,
        date: new Date(),
        isSubscription: true,
      });
    }
  }

  return subscriptions;
}

export function generateUserProfile(): UserProfile {
  return {
    monthlyBudget: randomInRange(800, 1500),
    monthlySavingsGoal: randomInRange(100, 300),
    currentBalance: randomInRange(500, 3000),
  };
}

// Sample AI-generated achievements based on spending patterns
export function generateSampleAchievements(transactions: Transaction[]): Achievement[] {
  const categorySpending: Record<string, number> = {};

  // Calculate spending by category for last 30 days
  transactions.forEach(t => {
    categorySpending[t.category] = (categorySpending[t.category] || 0) + t.amount;
  });

  const achievements: Achievement[] = [];

  // Find top spending category and create achievement
  const topCategory = Object.entries(categorySpending)
    .sort(([, a], [, b]) => b - a)[0];

  if (topCategory) {
    const [category, amount] = topCategory;
    achievements.push({
      id: generateId(),
      title: `Reduce ${category.replace('_', ' ')} spending`,
      description: `You spent $${amount.toFixed(0)} on ${category.replace('_', ' ')} this month. Try cutting back by 20%!`,
      targetAmount: Math.round(amount * 0.8),
      currentAmount: amount,
      completed: false,
      category: category as TransactionCategory,
      aiGenerated: true,
    });
  }

  // Count food delivery orders
  const deliveryCount = transactions.filter(t =>
    ['DoorDash', 'Uber Eats'].includes(t.merchant)
  ).length;

  if (deliveryCount > 5) {
    achievements.push({
      id: generateId(),
      title: 'Cook More Challenge',
      description: `You ordered delivery ${deliveryCount} times this month. Try cooking 3 meals this week instead!`,
      completed: false,
      aiGenerated: true,
    });
  }

  // Coffee challenge
  const coffeeSpend = transactions
    .filter(t => t.merchant === 'Starbucks')
    .reduce((sum, t) => sum + t.amount, 0);

  if (coffeeSpend > 30) {
    achievements.push({
      id: generateId(),
      title: 'Brew Your Own',
      description: `$${coffeeSpend.toFixed(0)} on Starbucks! Make coffee at home for a week and treat yourself on Friday.`,
      targetAmount: 10,
      currentAmount: coffeeSpend,
      completed: false,
      aiGenerated: true,
    });
  }

  // General savings goal
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

// Get spending by category for charts
export function getSpendingByCategory(transactions: Transaction[]): Record<TransactionCategory, number> {
  const spending: Partial<Record<TransactionCategory, number>> = {};

  transactions.forEach(t => {
    spending[t.category] = (spending[t.category] || 0) + t.amount;
  });

  return spending as Record<TransactionCategory, number>;
}

// Get total spending for a time period
export function getTotalSpending(transactions: Transaction[], days: number = 30): number {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);

  return transactions
    .filter(t => t.date >= cutoff)
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
