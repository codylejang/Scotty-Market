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
    amount: Math.abs(bt.amount), // Frontend uses positive amounts
    category: mapCategory(bt.category_primary),
    merchant: bt.merchant_name || bt.name,
    date: new Date(bt.date),
    isSubscription: bt.category_primary?.toLowerCase().includes('subscription') || false,
  };
}

// ─── Public API Functions ───

export async function fetchTransactions(days: number = 30): Promise<Transaction[]> {
  const data = await apiFetch<BackendTransaction[]>(
    `/v1/transactions?user_id=${DEFAULT_USER_ID}&days=${days}&include_pending=true`
  );
  return data.map(mapTransaction);
}

export async function seedNessieSandboxData() {
  return apiFetch<{ customerIds: string[]; accountIds: string[]; transactionsCreated: number }>(
    '/v1/admin/nessie/seed',
    { method: 'POST' }
  );
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

export async function sendChatMessageAPI(message: string): Promise<string> {
  const data = await apiFetch<{ response: string; actions?: any[] }>('/v1/chat', {
    method: 'POST',
    body: JSON.stringify({
      user_id: DEFAULT_USER_ID,
      message,
    }),
  });

  return data.response;
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
  const params = quest.metric_params || {};
  switch (quest.metric_type) {
    case 'CATEGORY_SPEND_CAP':
      return `Keep ${params.category || 'spending'} under $${params.cap || 0} today`;
    case 'MERCHANT_SPEND_CAP':
      return `Spend less than $${params.cap || 0} at ${params.merchant_key || 'merchant'}`;
    case 'NO_MERCHANT_CHARGE':
      return `No charges from ${params.merchant_key || 'merchant'} this period`;
    case 'TRANSFER_AMOUNT':
      return `Transfer $${params.amount || 0} to savings`;
    default:
      return quest.title;
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
  }> }>(`/v1/budget?user_id=${DEFAULT_USER_ID}`);

  return data.budgets.map(b => ({
    id: b.id,
    category: b.category,
    frequency: b.frequency as BudgetItem['frequency'],
    limitAmount: b.limit_amount,
    derivedDailyLimit: b.derived_daily_limit,
    spent: 0, // computed client-side
  }));
}

// ─── Account API ───

export async function fetchAccounts(): Promise<{ accounts: AccountInfo[]; totalBalance: number }> {
  const data = await apiFetch<{
    accounts: Array<{ id: string; type: string; nickname: string; balance: number }>;
    totalBalance: number;
  }>('/v1/finance/accounts');

  return {
    accounts: data.accounts,
    totalBalance: data.totalBalance,
  };
}

// ─── Daily Spend ───

export async function fetchTodaySpend(): Promise<number> {
  const today = new Date().toISOString().split('T')[0];
  const data = await apiFetch<{ summary: { total_spend: number } }>(
    `/v1/finance/transactions?date_start=${today}&date_end=${today}&limit=1`
  );
  return data.summary.total_spend;
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
