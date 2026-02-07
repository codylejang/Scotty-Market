import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import {
  Transaction,
  Achievement,
  ScottyState,
  HealthMetrics,
  UserProfile,
  DailyInsight,
  ChatMessage,
  FoodType,
  BudgetItem,
  AccountInfo,
  TransactionCategory,
} from '../types';
import {
  calculateHealthMetrics,
  calculateScottyState,
} from '../services/healthScore';
import { generateDailyInsight, generateChatResponse } from '../services/ai';
import { getSpendingByCategory } from '../services/transactionMetrics';
import {
  checkBackendHealth,
  fetchDailyPayload,
  fetchTransactions,
  fetchHealthMetrics,
  fetchScottyState,
  feedScottyAPI,
  sendChatMessageAPI,
  fetchActiveQuest,
  mapInsightToFrontend,
  fetchBudgets,
  fetchAccounts,
  fetchTodaySpend,
} from '../services/api';

/** Race a promise against a timeout. Rejects if the promise doesn't resolve in time. */
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timed out after ${ms}ms`)), ms);
    promise.then(
      (val) => { clearTimeout(timer); resolve(val); },
      (err) => { clearTimeout(timer); reject(err); },
    );
  });
}

interface AppState {
  // User data
  profile: UserProfile;
  transactions: Transaction[];
  achievements: Achievement[];

  // Scotty state
  scottyState: ScottyState;
  healthMetrics: HealthMetrics;
  dailyInsight: DailyInsight | null;

  // Financial data
  budgets: BudgetItem[];
  accounts: AccountInfo[];
  totalBalance: number;
  dailySpend: number;

  // Chat
  chatMessages: ChatMessage[];

  // Connection status
  backendConnected: boolean;

  // Actions
  feedScotty: (type: FoodType) => void;
  completeAchievement: (id: string) => void;
  dismissAchievement: (id: string) => void;
  sendChatMessage: (message: string) => Promise<void>;
  refreshInsight: () => Promise<void>;
}

const defaultScottyState: ScottyState = {
  mood: 'content',
  happiness: 70,
  lastFed: null,
  foodCredits: 10,
};

const defaultHealthMetrics: HealthMetrics = {
  budgetAdherence: 70,
  savingsRate: 50,
  impulseScore: 60,
  overallScore: 65,
};

const defaultProfile: UserProfile = {
  monthlyBudget: 1500,
  monthlySavingsGoal: 300,
  currentBalance: 2400,
};

const AppContext = createContext<AppState | null>(null);

function buildLocalAchievements(transactions: Transaction[]): Achievement[] {
  const spending = getSpendingByCategory(transactions);
  const topCategory = Object.entries(spending)
    .filter(([, amount]) => amount > 0)
    .sort(([, a], [, b]) => b - a)[0];

  const achievements: Achievement[] = [];
  if (topCategory) {
    const [category, amount] = topCategory;
    achievements.push({
      id: `top_cat_${Date.now()}`,
      title: `Reduce ${category.replace('_', ' ')} spending`,
      description: `You spent $${amount.toFixed(0)} on ${category.replace('_', ' ')} recently. Try cutting back by 20%.`,
      targetAmount: Math.round(amount * 0.8),
      currentAmount: amount,
      completed: false,
      category: category as TransactionCategory,
      aiGenerated: true,
    });
  }

  achievements.push({
    id: `weekend_${Date.now()}`,
    title: 'Weekend Saver',
    description: 'Keep weekend spending under $50 for entertainment and dining.',
    targetAmount: 50,
    currentAmount: 0,
    completed: false,
    aiGenerated: true,
  });

  return achievements;
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [profile] = useState<UserProfile>(defaultProfile);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [scottyState, setScottyState] = useState<ScottyState>(defaultScottyState);
  const [healthMetrics, setHealthMetrics] = useState<HealthMetrics>(defaultHealthMetrics);
  const [dailyInsight, setDailyInsight] = useState<DailyInsight | null>(null);
  const [budgets, setBudgets] = useState<BudgetItem[]>([]);
  const [accounts, setAccounts] = useState<AccountInfo[]>([]);
  const [totalBalance, setTotalBalance] = useState(0);
  const [dailySpend, setDailySpend] = useState(0);
  const [backendConnected, setBackendConnected] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'scotty',
      content: "Woof! I'm Scotty, your financial buddy! Ask me anything about your spending!",
      timestamp: new Date(),
    },
  ]);

  // Initialize on mount: show mock data immediately, then try backend in background
  useEffect(() => {
    // Show something right away
    initializeFromMock();
    // Then try to upgrade to backend data (non-blocking)
    tryBackendUpgrade();
  }, []);

  function initializeFromMock() {
    const metrics = calculateHealthMetrics({
      transactions,
      monthlyBudget: profile.monthlyBudget,
      monthlySavingsGoal: profile.monthlySavingsGoal,
      currentBalance: profile.currentBalance,
    });
    setHealthMetrics(metrics);

    const scotty = calculateScottyState(metrics, null, 10);
    setScottyState(scotty);

    const newAchievements = buildLocalAchievements(transactions);
    setAchievements(newAchievements);

    generateDailyInsight(transactions).then(setDailyInsight);
  }

  async function tryBackendUpgrade() {
    const isHealthy = await checkBackendHealth();
    if (!isHealthy) return;
    setBackendConnected(true);

    // Fetch backend data with a global timeout so the app never hangs
    // Keep backendConnected=true even if data loading times out, because
    // individual features (like chat) may still work fine with the backend.
    try {
      await withTimeout(loadFromBackend(), 15000);
    } catch (err) {
      console.warn('[AppContext] Backend data loading timed out, keeping mock data. Chat still uses backend.', err);
    }
  }

  async function loadFromBackend() {
    // Fetch non-blocking data first (fast endpoints) — each catches individually
    // so one failure doesn't block the rest
    const [txns, metrics, scotty] = await Promise.all([
      fetchTransactions(30).catch((e) => { console.warn('[AppContext] fetchTransactions failed:', e.message); return [] as Transaction[]; }),
      fetchHealthMetrics().catch((e) => { console.warn('[AppContext] fetchHealthMetrics failed:', e.message); return defaultHealthMetrics; }),
      fetchScottyState().catch((e) => { console.warn('[AppContext] fetchScottyState failed:', e.message); return defaultScottyState; }),
    ]);

    if (txns.length > 0) setTransactions(txns);
    setScottyState(scotty);
    setHealthMetrics(metrics);

    // Fetch budgets, accounts, daily spend (non-critical, don't block)
    try {
      const [budgetData, accountData, todaySpend] = await Promise.all([
        fetchBudgets().catch(() => []),
        fetchAccounts().catch(() => ({ accounts: [] as AccountInfo[], totalBalance: 0 })),
        fetchTodaySpend().catch(() => 0),
      ]);

      if (budgetData.length > 0) {
        // Compute spent per budget category from transactions
        const today = new Date();
        const budgetsWithSpend = budgetData.map(b => {
          const catTxns = txns.filter(t => {
            const catMap: Record<string, string> = {
              'Food & Drink': 'food_dining', 'Groceries': 'groceries',
              'Transportation': 'transport', 'Entertainment': 'entertainment',
              'Shopping': 'shopping', 'Health': 'health', 'Subscription': 'subscriptions',
            };
            return t.category === (catMap[b.category] || 'other');
          });
          // Sum spending in current period
          const periodDays = b.frequency === 'Day' ? 1 : b.frequency === 'Week' ? 7 : 30;
          const periodStart = new Date(today);
          periodStart.setDate(periodStart.getDate() - periodDays);
          const periodTxns = catTxns.filter(t => t.date >= periodStart);
          const spent = periodTxns.reduce((sum, t) => sum + t.amount, 0);
          return { ...b, spent: Math.round(spent * 100) / 100 };
        });
        setBudgets(budgetsWithSpend);
      }

      setAccounts(accountData.accounts);
      setTotalBalance(accountData.totalBalance);
      setDailySpend(todaySpend);
    } catch {
      // Non-critical data — keep defaults
    }

    // Daily payload may trigger LLM on first run — fetch separately so it doesn't block above
    try {
      const payload = await withTimeout(fetchDailyPayload(), 10000);
      if (payload.insights.length > 0) {
        setDailyInsight(mapInsightToFrontend(payload.insights[0]));
      }
    } catch {
      // Daily payload timed out (LLM generating) — keep mock insight, that's fine
    }

    // Quest -> achievement mapping
    try {
      const questAchievement = await fetchActiveQuest();
      const baseAchievements = buildLocalAchievements(txns.length > 0 ? txns : transactions);
      if (questAchievement) {
        setAchievements([questAchievement, ...baseAchievements.slice(0, 2)]);
      } else {
        setAchievements(baseAchievements);
      }
    } catch {
      // Keep existing achievements
    }
  }

  // Feed Scotty
  const feedScotty = async (type: FoodType) => {
    if (backendConnected) {
      try {
        const newState = await feedScottyAPI(type);
        setScottyState(newState);
        return;
      } catch (err) {
        console.warn('Backend feed failed, using local:', err);
      }
    }

    // Local fallback
    const cost = type === 'meal' ? 5 : 2;
    const happinessBoost = type === 'meal' ? 15 : 5;

    if (scottyState.foodCredits < cost) return;

    setScottyState((prev) => ({
      ...prev,
      happiness: Math.min(100, prev.happiness + happinessBoost),
      lastFed: new Date(),
      foodCredits: prev.foodCredits - cost,
      mood:
        prev.happiness + happinessBoost >= 80
          ? 'happy'
          : prev.happiness + happinessBoost >= 60
          ? 'content'
          : prev.mood,
    }));
  };

  // Complete achievement
  const completeAchievement = (id: string) => {
    setAchievements((prev) =>
      prev.map((a) => (a.id === id ? { ...a, completed: true } : a))
    );

    // Award credits
    setScottyState((prev) => ({
      ...prev,
      foodCredits: prev.foodCredits + 10,
      happiness: Math.min(100, prev.happiness + 10),
    }));
  };

  // Dismiss achievement
  const dismissAchievement = (id: string) => {
    setAchievements((prev) => prev.filter((a) => a.id !== id));
  };

  // Send chat message
  const sendChatMessage = async (message: string) => {
    const userMessage: ChatMessage = {
      id: `user_${Date.now()}`,
      role: 'user',
      content: message,
      timestamp: new Date(),
    };
    setChatMessages((prev) => [...prev, userMessage]);

    try {
      let response: string;

      if (backendConnected) {
        try {
          response = await sendChatMessageAPI(message);
        } catch {
          response = await generateChatResponse(message, transactions, chatMessages);
        }
      } else {
        response = await generateChatResponse(message, transactions, chatMessages);
      }

      const scottyMessage: ChatMessage = {
        id: `scotty_${Date.now()}`,
        role: 'scotty',
        content: response,
        timestamp: new Date(),
      };
      setChatMessages((prev) => [...prev, scottyMessage]);
    } catch (error) {
      const errorMessage: ChatMessage = {
        id: `scotty_${Date.now()}`,
        role: 'scotty',
        content: "Woof! I had trouble understanding that. Can you try again?",
        timestamp: new Date(),
      };
      setChatMessages((prev) => [...prev, errorMessage]);
    }
  };

  // Refresh insight
  const refreshInsight = async () => {
    if (backendConnected) {
      try {
        const payload = await fetchDailyPayload();
        if (payload.insights.length > 0) {
          // Pick a random insight from the list for variety
          const idx = Math.floor(Math.random() * payload.insights.length);
          setDailyInsight(mapInsightToFrontend(payload.insights[idx]));
          return;
        }
      } catch {
        // Fall through to mock
      }
    }

    const insight = await generateDailyInsight(transactions);
    setDailyInsight(insight);
  };

  return (
    <AppContext.Provider
      value={{
        profile,
        transactions,
        achievements,
        scottyState,
        healthMetrics,
        dailyInsight,
        budgets,
        accounts,
        totalBalance,
        dailySpend,
        chatMessages,
        backendConnected,
        feedScotty,
        completeAchievement,
        dismissAchievement,
        sendChatMessage,
        refreshInsight,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
}

export default AppContext;
