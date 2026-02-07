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

export type ChatActionIcon = 'wallet' | 'savings' | 'trophy' | 'receipt' | 'alert' | 'chart';
export type ChatActionCategory = 'finances' | 'budget' | 'goal' | 'spending';

export interface ChatAction {
  id: string;
  label: string;
  icon: ChatActionIcon;
  category: ChatActionCategory;
  prompt: string;
  description?: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'scotty';
  content: string;
  timestamp: Date;
  actions?: ChatAction[];
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

// Account data from backend
export interface AccountInfo {
  id: string;
  type: string;
  nickname: string;
  balance: number;
}
