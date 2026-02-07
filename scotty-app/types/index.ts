// Core types for Scotty app

export type MoodState = 'happy' | 'content' | 'worried' | 'sad';

export interface Transaction {
  id: string;
  amount: number;
  category: TransactionCategory;
  merchant: string;
  date: Date;
  isSubscription?: boolean;
}

export type TransactionCategory =
  | 'food_dining'
  | 'groceries'
  | 'transport'
  | 'entertainment'
  | 'shopping'
  | 'subscriptions'
  | 'utilities'
  | 'education'
  | 'health'
  | 'other';

export interface Achievement {
  id: string;
  title: string;
  description: string;
  targetAmount?: number;
  currentAmount?: number;
  deadline?: Date;
  completed: boolean;
  category?: TransactionCategory;
  aiGenerated: boolean;
}

export interface Quest {
  id: string;
  title: string;
  subtitle: string; // e.g., "Meat Treat", "Sugar Free"
  emoji: string;
  xpReward: number;
  progress: number; // current progress
  goal: number; // total needed
  progressUnit: string; // e.g., "days", "skips", "cups", "pack"
  bgColor: string;
  goalTarget?: string; // Which savings goal this quest contributes to
}

export interface ScottyState {
  mood: MoodState;
  happiness: number; // 0-100
  lastFed: Date | null;
  foodCredits: number;
}

export interface HealthMetrics {
  budgetAdherence: number; // 0-100
  savingsRate: number; // 0-100
  impulseScore: number; // 0-100 (higher = fewer impulse purchases)
  overallScore: number; // 0-100
}

export interface UserProfile {
  monthlyBudget: number;
  monthlySavingsGoal: number;
  currentBalance: number;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'scotty';
  content: string;
  timestamp: Date;
}

export interface DailyInsight {
  id: string;
  message: string;
  type: 'positive' | 'neutral' | 'warning';
  date: Date;
}

// Food types for feeding Scotty
export type FoodType = 'treat' | 'meal';

export interface FoodItem {
  type: FoodType;
  name: string;
  happinessBoost: number;
  cost: number; // credits required
}

// Budget data from backend
export interface BudgetItem {
  id: string;
  category: string;
  frequency: 'Day' | 'Week' | 'Month';
  limitAmount: number;
  derivedDailyLimit: number;
  spent: number; // computed client-side from transactions
}

// Goal data from backend
export interface GoalData {
  id: string;
  name: string;
  targetAmount: number;
  savedSoFar: number;
  deadline: string | null;
  budgetPercent: number;
  status: string;
}

// Account data from backend
export interface AccountInfo {
  id: string;
  type: string;
  nickname: string;
  balance: number;
}
