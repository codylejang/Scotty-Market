// Core types for Scotty app

export type MoodState = 'happy' | 'sad';

export interface Transaction {
  id: string;
  amount: number;
  category: TransactionCategory;
  merchant: string;
  date: Date;
  isSubscription?: boolean;
  isIncoming?: boolean;
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

export type QuestStatus = 'active' | 'completed' | 'failed';

export interface Quest {
  id: string;
  title: string;
  subtitle: string; // e.g., "Meat Treat", "Sugar Free"
  emoji: string;
  xpReward: number;
  progress: number; // current progress (e.g., amount spent so far)
  goal: number; // cap / target (e.g., max spend allowed)
  progressUnit: string; // e.g., "days", "skips", "cups", "pack"
  bgColor: string;
  status: QuestStatus; // validated by backend agent
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

// Budget projection data from backend
export interface BudgetProjection {
  category: string;
  currentSpent: number;
  budgetLimit: number;
  projectedSpend: number;
  projectedPercent: number;
  overBudget: boolean;
  dailyRate7d: number;
  dailyRatePeriod: number;
}

export interface BudgetProjectionsResponse {
  projections: BudgetProjection[];
  dailySummary: {
    totalDailySpent: number;
    totalDailyLimit: number;
    projectedDailyPercent: number;
  };
}

// Account data from backend
export interface AccountInfo {
  id: string;
  type: string;
  nickname: string;
  balance: number;
}
