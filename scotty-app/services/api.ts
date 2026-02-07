import {
  Transaction,
  TransactionCategory,
  Achievement,
  ScottyState,
  HealthMetrics,
  DailyInsight,
  FoodType,
  BudgetItem,
  AccountInfo,
  Quest,
  UserProfile,
  ChatAction,
  BudgetProjectionsResponse,
} from '../types';

// Configure this to point to your backend
// 
// IMPORTANT: For Expo Go on physical devices, you MUST use your computer's IP address!
// 
// Set the IP via environment variable:
//   EXPO_PUBLIC_API_HOST=192.168.1.100 npx expo start
//
// Or find your IP manually:
//   Mac/Linux: ifconfig | grep "inet " | grep -v 127.0.0.1
//   Windows: ipconfig (look for IPv4 Address)
//
// Make sure:
// - Your phone and computer are on the same Wi-Fi network
// - Your firewall allows connections on port 3001
// - The backend server is running

import { Platform } from 'react-native';
import Constants from 'expo-constants';

// Auto-detect the development server IP from Expo
const getDevServerHost = (): string => {
  // Check environment variable first (highest priority, works everywhere)
  if (process.env.EXPO_PUBLIC_API_HOST) {
    console.log(`[API] Using IP from EXPO_PUBLIC_API_HOST: ${process.env.EXPO_PUBLIC_API_HOST}`);
    return process.env.EXPO_PUBLIC_API_HOST;
  }

  // For web platform, localhost works fine
  if (Platform.OS === 'web') {
    return 'localhost';
  }

  // For native (iOS/Android), try to get IP from Expo Constants
  // This auto-detects the dev machine's LAN IP when running in Expo Go
  const debuggerHost =
    Constants.expoConfig?.hostUri ||
    Constants.manifest2?.extra?.expoGo?.debuggerHost ||
    (Constants.manifest as any)?.debuggerHost ||
    (Constants.manifest as any)?.hostUri;

  if (debuggerHost) {
    // Extract IP from "192.168.1.100:8081" format
    const cleanHost = debuggerHost.replace(/^exp:\/\//, '').replace(/^http:\/\//, '');
    const ip = cleanHost.split(':')[0];
    if (ip && ip !== 'localhost' && ip !== '127.0.0.1') {
      console.log(`[API] Auto-detected dev server IP: ${ip}`);
      return ip;
    }
  }

  // Android emulator special IP
  if (Platform.OS === 'android') {
    console.log(`[API] Using Android emulator default: 10.0.2.2`);
    return '10.0.2.2';
  }

  // iOS simulator can use localhost
  return 'localhost';
};

const getApiBaseUrl = () => {
  const host = getDevServerHost();
  return `http://${host}:3001/api`;
};

const API_BASE_URL = getApiBaseUrl();

if (__DEV__) {
  console.log(`[API] Base URL: ${API_BASE_URL} (platform: ${Platform.OS})`);
}

// Default user for prototype (matches seed data)
const DEFAULT_USER_ID = 'user_1';

// ─── Category Mapping ───
// Backend uses Plaid-style categories, frontend uses enum keys
const BACKEND_TO_FRONTEND_CATEGORY: Record<string, TransactionCategory> = {
  'Food & Drink': 'food_dining',
  'Food and Drink': 'food_dining',
  'Groceries': 'groceries',
  'Transportation': 'transport',
  'Travel': 'transport',
  'Entertainment': 'entertainment',
  'Recreation': 'entertainment',
  'Shopping': 'shopping',
  'Merchandise': 'shopping',
  'Subscription': 'subscriptions',
  'Service': 'subscriptions',
  'Utilities': 'utilities',
  'Education': 'education',
  'Health': 'health',
  'Healthcare': 'health',
  'Medical': 'health',
  'Transfer': 'other',
  'Payment': 'other',
  'Other': 'other',
};

function mapCategory(backendCategory: string | null): TransactionCategory {
  if (!backendCategory) return 'other';
  // Try exact match first
  if (BACKEND_TO_FRONTEND_CATEGORY[backendCategory]) {
    return BACKEND_TO_FRONTEND_CATEGORY[backendCategory];
  }
  // Try partial match
  const lower = backendCategory.toLowerCase();
  for (const [key, value] of Object.entries(BACKEND_TO_FRONTEND_CATEGORY)) {
    if (lower.includes(key.toLowerCase())) return value;
  }
  return 'other';
}

// ─── API Helpers ───
async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const url = `${API_BASE_URL}${path}`;

  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`API ${response.status}: ${body}`);
  }

  return response.json();
}

// ─── Transaction Mapping ───
interface BackendTransaction {
  id: string;
  user_id: string;
  date: string;
  amount: number;
  name: string;
  merchant_name: string | null;
  category_primary: string | null;
  category_detailed: string | null;
  pending: boolean;
}

function mapTransaction(bt: BackendTransaction): Transaction {
  return {
    id: bt.id,
    amount: Math.abs(bt.amount),
    category: mapCategory(bt.category_primary),
    merchant: bt.merchant_name || bt.name,
    date: new Date(bt.date),
    isSubscription: bt.category_primary?.toLowerCase().includes('subscription') || false,
    isIncoming: bt.amount > 0,
  };
}

// ─── Public API Functions ───

export async function fetchTransactions(days: number = 30): Promise<Transaction[]> {
  const data = await apiFetch<BackendTransaction[]>(
    `/v1/transactions?user_id=${DEFAULT_USER_ID}&days=${days}&include_pending=true`
  );
  return data.map(mapTransaction);
}

export async function seedNessieDemo(): Promise<void> {
  await apiFetch('/v1/admin/nessie/seed', { method: 'POST' });
}

export async function runFullSeed(): Promise<void> {
  await apiFetch('/v1/admin/seed', { method: 'POST' });
}

export interface DailyPayload {
  insights: Array<{
    id: string;
    title: string;
    blurb: string;
    confidence: string;
    metrics: Record<string, any>;
  }>;
  activeQuest: {
    id: string;
    title: string;
    status: string;
    metric_type: string;
    metric_params: Record<string, any>;
    reward_food_type: string;
    happiness_delta: number;
    window_start: string;
    window_end: string;
  } | null;
  optionalActions: Array<{
    id: string;
    type: string;
    payload: Record<string, any>;
  }>;
  scottyState: {
    happiness: number;
    mood: string;
    food_credits: number;
    last_reward_food: string | null;
    last_reward_at: string | null;
  };
}

export async function fetchDailyPayload(): Promise<DailyPayload> {
  return apiFetch<DailyPayload>(`/v1/home/daily?user_id=${DEFAULT_USER_ID}`);
}

export async function fetchHealthMetrics(): Promise<HealthMetrics> {
  return apiFetch<HealthMetrics>(`/v1/health-metrics?user_id=${DEFAULT_USER_ID}`);
}

export async function fetchUserProfile(): Promise<UserProfile> {
  const data = await apiFetch<{
    monthly_budget: number;
    monthly_savings_goal: number;
    current_balance: number;
  }>(`/v1/profile?user_id=${DEFAULT_USER_ID}`);

  return {
    monthlyBudget: data.monthly_budget,
    monthlySavingsGoal: data.monthly_savings_goal,
    currentBalance: data.current_balance,
  };
}

export interface BudgetProgress {
  category: string;
  amount: number;
  spent: number;
  period: 'monthly' | 'weekly' | string;
}


export async function fetchScottyState(): Promise<ScottyState> {
  const data = await apiFetch<{
    happiness: number;
    mood: string;
    last_fed: string | null;
    food_credits: number;
  }>(`/v1/scotty/state?user_id=${DEFAULT_USER_ID}`);

  return {
    happiness: data.happiness,
    mood: data.mood as ScottyState['mood'],
    lastFed: data.last_fed ? new Date(data.last_fed) : null,
    foodCredits: data.food_credits,
  };
}

export async function feedScottyAPI(foodType: FoodType): Promise<ScottyState> {
  const data = await apiFetch<{
    happiness: number;
    mood: string;
    last_fed: string;
    food_credits: number;
  }>('/v1/scotty/feed', {
    method: 'POST',
    body: JSON.stringify({
      user_id: DEFAULT_USER_ID,
      food_type: foodType,
    }),
  });

  return {
    happiness: data.happiness,
    mood: data.mood as ScottyState['mood'],
    lastFed: new Date(data.last_fed),
    foodCredits: data.food_credits,
  };
}

export async function sendChatMessageAPI(message: string): Promise<{ response: string; actions: ChatAction[] }> {
  const data = await apiFetch<{ response: string; actions?: any[]; suggested_actions?: ChatAction[] }>('/v1/chat', {
    method: 'POST',
    body: JSON.stringify({
      user_id: DEFAULT_USER_ID,
      message,
    }),
  });

  return { response: data.response, actions: data.suggested_actions || [] };
}

export async function setScottyHappiness(happiness: number): Promise<void> {
  await apiFetch('/v1/scotty/set-happiness', {
    method: 'POST',
    body: JSON.stringify({ user_id: DEFAULT_USER_ID, happiness }),
  });
}

export async function fetchChatSuggestedActions(): Promise<ChatAction[]> {
  try {
    const data = await apiFetch<{ actions: ChatAction[] }>(
      `/v1/chat/suggested-actions?user_id=${DEFAULT_USER_ID}`
    );
    return data.actions || [];
  } catch {
    return [];
  }
}

export async function fetchActiveQuest(): Promise<Achievement | null> {
  const quest = await apiFetch<any>(`/v1/quests/active?user_id=${DEFAULT_USER_ID}`);
  if (!quest) return null;

  // Map backend quest -> frontend Achievement
  return {
    id: quest.id,
    title: quest.title,
    description: buildQuestDescription(quest),
    targetAmount: quest.metric_params?.cap || quest.metric_params?.amount,
    currentAmount: 0, // Updated via progress snapshots
    completed: quest.status === 'COMPLETED_VERIFIED',
    category: mapCategory(quest.metric_params?.category),
    aiGenerated: quest.created_by === 'agent',
  };
}

function buildQuestDescription(quest: any): string {
  // Use agent-generated description if available
  if (quest.description && quest.description.trim().length > 10) return quest.description;

  const params = quest.metric_params || {};
  const cap = params.cap || params.target_amount || 0;
  const cat = params.category || '';
  const merchant = params.merchant || params.merchant_key || params.merchant_name || '';

  switch (quest.metric_type) {
    case 'CATEGORY_SPEND_CAP':
      return cap > 0
        ? `Keep your ${cat} spending under $${cap.toFixed(2)} today. Try cooking at home, skipping impulse buys, or finding a free alternative.`
        : `Watch your ${cat} spending today. Aim to cut back by skipping one unnecessary purchase.`;
    case 'MERCHANT_SPEND_CAP':
      return cap > 0
        ? `Limit your spending at ${merchant || 'this merchant'} to $${cap.toFixed(2)}. Consider smaller orders or bringing your own instead.`
        : `Cut back on spending at ${merchant || 'this merchant'} today. Every dollar saved counts!`;
    case 'NO_MERCHANT_CHARGE':
      return `Avoid making any purchases at ${merchant || 'this merchant'} today. Find a free or cheaper alternative to break the habit.`;
    case 'TRANSFER_AMOUNT':
      return cap > 0
        ? `Transfer $${cap.toFixed(2)} to your savings. Set it up now so you don't forget!`
        : `Make a savings transfer today. Even a small amount helps build the habit.`;
    default:
      return `Complete this quest to earn rewards and keep your finances on track!`;
  }
}

export async function fetchSubscriptions(): Promise<Array<{
  merchant: string;
  amount: number;
  nextDate: string;
  cadence: string;
}>> {
  const data = await apiFetch<any[]>(
    `/v1/subscriptions/upcoming?user_id=${DEFAULT_USER_ID}`
  );
  return data.map((sub: any) => ({
    merchant: sub.merchant_key,
    amount: sub.typical_amount,
    nextDate: sub.next_expected_date,
    cadence: sub.cadence,
  }));
}

/**
 * Map backend daily payload insights -> frontend DailyInsight
 */
export function mapInsightToFrontend(
  insight: DailyPayload['insights'][0]
): DailyInsight {
  const type: DailyInsight['type'] =
    insight.confidence === 'HIGH' ? 'positive' :
    insight.confidence === 'LOW' ? 'warning' : 'neutral';

  return {
    id: insight.id,
    message: insight.blurb,
    type,
    date: new Date(),
  };
}

// ─── Budget API ───

export async function fetchBudgets(): Promise<BudgetItem[]> {
  const data = await apiFetch<{ budgets: Array<{
    id: string;
    category: string;
    frequency: string;
    limit_amount: number;
    derived_daily_limit: number;
    adaptive_enabled?: boolean;
    adaptive_max_adjust_pct?: number;
    last_auto_adjusted_at?: string | null;
  }> }>(`/v1/budget?user_id=${DEFAULT_USER_ID}`);

  return data.budgets.map(b => ({
    id: b.id,
    category: b.category,
    frequency: (b.frequency === 'Day' || b.frequency === 'Year' ? b.frequency : 'Month') as BudgetItem['frequency'],
    limitAmount: b.limit_amount,
    derivedDailyLimit: b.derived_daily_limit,
    adaptiveEnabled: b.adaptive_enabled ?? true,
    adaptiveMaxAdjustPct: b.adaptive_max_adjust_pct ?? 10,
    lastAutoAdjustedAt: b.last_auto_adjusted_at ?? null,
    spent: 0, // computed client-side
  }));
}

// ─── Budget Projections API ───

export async function fetchBudgetProjections(): Promise<BudgetProjectionsResponse> {
  return apiFetch<BudgetProjectionsResponse>(
    `/v1/budget/projections?user_id=${DEFAULT_USER_ID}`
  );
}

// ─── Account API ───

export async function fetchAccounts(): Promise<{ accounts: AccountInfo[]; totalBalance: number }> {
  try {
    // Try Nessie-backed accounts first (external API)
    const data = await apiFetch<{
      accounts: Array<{ id: string; type: string; nickname: string; balance: number }>;
      totalBalance: number;
    }>('/v1/finance/accounts');

    return {
      accounts: data.accounts,
      totalBalance: data.totalBalance,
    };
  } catch (error) {
    // Fallback: calculate from user profile
    console.warn('[API] Failed to fetch accounts, using profile balance:', error);
    const profile = await fetchUserProfile();
    return {
      accounts: [{
        id: 'default',
        type: 'checking',
        nickname: 'Primary Account',
        balance: profile.currentBalance,
      }],
      totalBalance: profile.currentBalance,
    };
  }
}

// ─── Daily Spend ───

export async function fetchTodaySpend(): Promise<number> {
  // Calculate today's spend from user transactions
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  try {
    // Fetch recent transactions and filter for today
    const transactions = await fetchTransactions(7); // Get last week to ensure we have today
    
    const todaySpend = transactions
      .filter(t => {
        const txDate = new Date(t.date);
        txDate.setHours(0, 0, 0, 0);
        return txDate.getTime() === today.getTime() && !t.isIncoming;
      })
      .reduce((sum, t) => sum + t.amount, 0);
    
    return Math.round(todaySpend * 100) / 100;
  } catch (error) {
    console.warn('[API] Failed to fetch today spend:', error);
    return 0;
  }
}

/**
 * Check if backend is reachable.
 */
export async function checkBackendHealth(): Promise<boolean> {
  try {
    const healthUrl = `${API_BASE_URL.replace('/api', '')}/health`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2000);
    const response = await fetch(healthUrl, { signal: controller.signal });
    clearTimeout(timeout);
    if (__DEV__) {
      console.log(`[API] Health check: ${response.ok ? 'OK' : 'FAILED'} (${healthUrl})`);
    }
    return response.ok;
  } catch (error: any) {
    if (__DEV__) {
      console.warn(`[API] Health check failed: ${error.message} (target: ${API_BASE_URL})`);
    }
    return false;
  }
}

// ─── Backend quest shape ───
interface BackendQuest {
  id: string;
  title: string;
  description?: string;
  status: string;
  metric_type: string;
  metric_params: Record<string, any>;
  reward_food_type: string;
  happiness_delta: number;
  window_start: string;
  window_end: string;
  confirmed_value: number;
  pending_value: number;
  explanation: string;
}

const QUEST_EMOJI: Record<string, string> = {
  'CATEGORY_SPEND_CAP': '🍖',
  'MERCHANT_SPEND_CAP': '☕',
  'NO_MERCHANT_CHARGE': '🚫',
  'TRANSFER_AMOUNT': '💰',
};

const QUEST_COLORS = ['#ffb3ba', '#fff9c4', '#c8e6c9', '#bbdefb', '#e1bee7'];

function mapBackendQuest(q: BackendQuest, index: number): Quest {
  const cap = q.metric_params?.cap || q.metric_params?.target_amount || 0;
  return {
    id: q.id,
    title: q.title,
    subtitle: buildQuestDescription(q),
    emoji: QUEST_EMOJI[q.metric_type] || '🎯',
    xpReward: q.happiness_delta * 5,
    progress: Math.round(q.confirmed_value * 100) / 100,
    goal: cap,
    progressUnit: q.metric_type === 'NO_MERCHANT_CHARGE' ? 'charges' : 'spent',
    bgColor: QUEST_COLORS[index % QUEST_COLORS.length],
    goalTarget: q.explanation || undefined,
  };
}

/**
 * Fetch daily quests for the user.
 */
export async function fetchDailyQuests(userId: string = DEFAULT_USER_ID): Promise<Quest[]> {
  const quests = await apiFetch<BackendQuest[]>(`/v1/quests/list?user_id=${userId}`);
  return quests.map(mapBackendQuest);
}

/**
 * Refresh/generate new daily quests.
 */
export async function refreshDailyQuests(userId: string = DEFAULT_USER_ID): Promise<Quest[]> {
  const quests = await apiFetch<BackendQuest[]>('/v1/quests/refresh', {
    method: 'POST',
    body: JSON.stringify({ user_id: userId }),
  });
  return quests.map(mapBackendQuest);
}

// ─── Spending Trend API ───

export async function fetchSpendingTrend(): Promise<{ months: string[]; totals: number[] }> {
  const data = await apiFetch<{ trend: Array<{ month: string; total: number }> }>(
    `/v1/finance/spending-trend?user_id=${DEFAULT_USER_ID}`
  );
  return {
    months: data.trend.map(t => t.month),
    totals: data.trend.map(t => t.total),
  };
}

// ─── Upcoming Bills API ───

export interface UpcomingBillsData {
  subscriptions: Array<{
    merchant_key: string;
    typical_amount: number;
    next_expected_date: string;
    cadence: string;
  }>;
  bill_days: number[];
  due_today: Array<{
    merchant_key: string;
    typical_amount: number;
    next_expected_date: string;
  }>;
}

export async function fetchUpcomingBills(): Promise<UpcomingBillsData> {
  return apiFetch<UpcomingBillsData>(
    `/v1/subscriptions/upcoming?user_id=${DEFAULT_USER_ID}`
  );
}

// ─── Create Budget API ───

// ─── Goal API ───

export interface GoalData {
  id: string;
  name: string;
  target_amount: number;
  saved_so_far: number;
  deadline: string | null;
  budget_percent: number;
  status: string;
  created_at: string;
}

export async function createGoal(
  name: string,
  targetAmount: number,
  deadline?: string,
  savedSoFar?: number,
  budgetPercent?: number
): Promise<GoalData> {
  return apiFetch<GoalData>('/v1/goals', {
    method: 'POST',
    body: JSON.stringify({
      user_id: DEFAULT_USER_ID,
      name,
      target_amount: targetAmount,
      deadline: deadline || null,
      saved_so_far: savedSoFar || 0,
      budget_percent: budgetPercent || 10,
    }),
  });
}

export async function fetchGoals(): Promise<GoalData[]> {
  const data = await apiFetch<{ goals: GoalData[] }>(
    `/v1/goals?user_id=${DEFAULT_USER_ID}`
  );
  return data.goals;
}

// ─── Budget Generation API ───

export async function generateBudgets(apply: boolean = true): Promise<{
  budgets: Array<{ category: string; limit_amount: number; frequency: string; reasoning: string }>;
  applied: boolean;
}> {
  return apiFetch('/v1/budgets/generate', {
    method: 'POST',
    body: JSON.stringify({ user_id: DEFAULT_USER_ID, apply }),
  });
}

// ─── Create Budget API ───

export async function createBudget(
  category: string,
  limitAmount: number,
  frequency: 'Day' | 'Month' | 'Year' = 'Month',
  adaptiveEnabled: boolean = true,
  adaptiveMaxAdjustPct: number = 10,
): Promise<any> {
  return apiFetch('/v1/budget', {
    method: 'POST',
    body: JSON.stringify({
      user_id: DEFAULT_USER_ID,
      category,
      limit_amount: limitAmount,
      frequency,
      adaptive_enabled: adaptiveEnabled,
      adaptive_max_adjust_pct: adaptiveMaxAdjustPct,
    }),
  });
}

export async function updateBudget(
  budgetId: string,
  updates: {
    category?: string;
    limitAmount?: number;
    frequency?: 'Day' | 'Month' | 'Year';
    adaptiveEnabled?: boolean;
    adaptiveMaxAdjustPct?: number;
  }
): Promise<any> {
  return apiFetch(`/v1/budget/${budgetId}`, {
    method: 'PUT',
    body: JSON.stringify({
      category: updates.category,
      limit_amount: updates.limitAmount,
      frequency: updates.frequency,
      adaptive_enabled: updates.adaptiveEnabled,
      adaptive_max_adjust_pct: updates.adaptiveMaxAdjustPct,
    }),
  });
}

export async function autoAdjustBudgets(): Promise<{
  adjustments: Array<{
    budget_id: string;
    category: string;
    old_limit_amount: number;
    new_limit_amount: number;
    reason: string;
  }>;
  skipped: number;
}> {
  return apiFetch('/v1/budget/auto-adjust', {
    method: 'POST',
    body: JSON.stringify({ user_id: DEFAULT_USER_ID }),
  });
}
