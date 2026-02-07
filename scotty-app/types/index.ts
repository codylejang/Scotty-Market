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
