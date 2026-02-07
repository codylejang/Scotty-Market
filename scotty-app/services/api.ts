import {
  Transaction,
  TransactionCategory,
  Achievement,
  ScottyState,
  HealthMetrics,
  DailyInsight,
  FoodType,
} from '../types';
import { getTransactionHistory, resetAndSeedNessieDummyData } from './nessie';

// Configure this to point to your backend
const API_BASE_URL = __DEV__
  ? 'http://localhost:3001/api'
  : 'http://localhost:3001/api';

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

/**
 * Infers a frontend TransactionCategory from Nessie transaction `type` and `description`.
 *
 * @param type - Nessie transaction type (e.g., "deposit", "payment")
 * @param description - Nessie transaction description or merchant text
 * @returns The corresponding frontend TransactionCategory such as `groceries`, `food_dining`, `transport`, `entertainment`, `shopping`, `health`, or `other`
 */
function mapNessieCategory(type: string, description: string): TransactionCategory {
  const text = `${type} ${description}`.toLowerCase();

  if (text.includes('grocer')) return 'groceries';
  if (text.includes('dining') || text.includes('restaurant') || text.includes('cafe')) {
    return 'food_dining';
  }
  if (text.includes('travel') || text.includes('rideshare') || text.includes('train')) {
    return 'transport';
  }
  if (text.includes('fun') || text.includes('movie') || text.includes('concert')) {
    return 'entertainment';
  }
  if (text.includes('shopping') || text.includes('store') || text.includes('gift')) {
    return 'shopping';
  }
  if (text.includes('self-care') || text.includes('wellness') || text.includes('pharmacy')) {
    return 'health';
  }
  if (type.toLowerCase().includes('deposit') || type.toLowerCase().includes('transfer')) {
    return 'other';
  }

  return mapCategory(type);
}

/**
 * Convert a backend transaction record into the frontend Transaction shape.
 *
 * @param bt - The backend transaction to convert
 * @returns A Transaction where `amount` is non-negative, `category` is derived from `bt.category_primary`, `merchant` is `bt.merchant_name` or `bt.name`, `date` is a Date object parsed from `bt.date`, and `isSubscription` is `true` when `bt.category_primary` contains `subscription` (case-insensitive), `false` otherwise.
 */
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

/**
 * Fetches recent transactions for the default prototype user.
 *
 * When the environment variable EXPO_PUBLIC_USE_NESSIE is `'true'`, transactions are sourced from the Nessie sandbox and mapped to the frontend Transaction shape; otherwise they are fetched from the backend API.
 *
 * @param days - Number of days of history to include (counting backwards from today)
 * @returns An array of frontend-formatted Transaction objects for the requested time window
 */

export async function fetchTransactions(days: number = 30): Promise<Transaction[]> {
  if (process.env.EXPO_PUBLIC_USE_NESSIE === 'true') {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - days);

    const nessieTransactions = await getTransactionHistory(startDate, endDate);
    return nessieTransactions.map((tx) => ({
      id: tx._id,
      amount: Math.abs(tx.amount), // Frontend currently expects absolute amounts
      category: mapNessieCategory(tx.type, tx.description || ''),
      merchant: tx.description || tx.type,
      date: new Date(tx.date),
      isSubscription: tx.type.toLowerCase().includes('subscription'),
    }));
  }

  const data = await apiFetch<BackendTransaction[]>(
    `/v1/transactions?user_id=${DEFAULT_USER_ID}&days=${days}&include_pending=true`
  );
  return data.map(mapTransaction);
}

/**
 * Seed the Nessie sandbox with dummy transaction data.
 *
 * @returns The result returned by the Nessie sandbox seeding operation.
 */
export async function seedNessieSandboxData() {
  return resetAndSeedNessieDummyData();
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

/**
 * Check if backend is reachable.
 */
export async function checkBackendHealth(): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);
    const response = await fetch(`${API_BASE_URL.replace('/api', '')}/health`, {
      signal: controller.signal,
    });
    clearTimeout(timeout);
    return response.ok;
  } catch {
    return false;
  }
}