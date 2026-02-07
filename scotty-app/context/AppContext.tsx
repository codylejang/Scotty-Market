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
  Quest,
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
  fetchUserProfile,
  feedScottyAPI,
  sendChatMessageAPI,
  fetchActiveQuest,
  mapInsightToFrontend,
  fetchBudgets,
  fetchAccounts,
  fetchTodaySpend,
  fetchDailyQuests,
  fetchSpendingTrend,
  fetchUpcomingBills,
  UpcomingBillsData,
} from '../services/api';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { TUTORIAL_STEPS } from '../constants/Tutorial';

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

  // Quests & trends
  quests: Quest[];
  spendingTrend: { months: string[]; totals: number[] };
  upcomingBills: UpcomingBillsData | null;

  // Chat
  chatMessages: ChatMessage[];

  // Connection status
  backendConnected: boolean;

  // Onboarding
  onboarding: {
    agreedToPact: boolean;
  };

  // Tutorial
  tutorial: {
    active: boolean;
    step: number;
  };

  // Actions
  feedScotty: (type: FoodType) => void;
  completeAchievement: (id: string) => void;
  dismissAchievement: (id: string) => void;
  sendChatMessage: (message: string) => Promise<void>;
  refreshInsight: () => Promise<void>;
  setOnboardingAgreed: (value: boolean) => void;
  advanceTutorial: () => void;
  skipTutorial: () => void;
  completeTutorial: () => void;
  resetTutorial: () => void;
}

const defaultScottyState: ScottyState = {
  mood: 'content',
  happiness: 70,
  lastFed: null,
  foodCredits: 10,
};

const defaultProfile: UserProfile = {
  monthlyBudget: 1500,
  monthlySavingsGoal: 300,
  currentBalance: 2400,
};

const defaultHealthMetrics: HealthMetrics = {
  budgetAdherence: 70,
  savingsRate: 50,
  impulseScore: 60,
  overallScore: 65,
};

const DAILY_HAPPINESS_DECAY = 20;
const HAPPINESS_DECAY_INTERVAL_MS = 60_000;


const TUTORIAL_STORAGE_KEY = 'scotty_tutorial_completed';

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
  const [profile, setProfile] = useState<UserProfile>(defaultProfile);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [scottyState, setScottyState] = useState<ScottyState>(defaultScottyState);
  const [healthMetrics, setHealthMetrics] = useState<HealthMetrics>(defaultHealthMetrics);
  const [dailyInsight, setDailyInsight] = useState<DailyInsight | null>(null);
  const [budgets, setBudgets] = useState<BudgetItem[]>([]);
  const [accounts, setAccounts] = useState<AccountInfo[]>([]);
  const [totalBalance, setTotalBalance] = useState(0);
  const [dailySpend, setDailySpend] = useState(0);
  const [quests, setQuests] = useState<Quest[]>([]);
  const [spendingTrend, setSpendingTrend] = useState<{ months: string[]; totals: number[] }>({ months: [], totals: [] });
  const [upcomingBills, setUpcomingBills] = useState<UpcomingBillsData | null>(null);
  const [backendConnected, setBackendConnected] = useState(false);
  const [onboardingAgreed, setOnboardingAgreed] = useState(false);
  const [tutorialActive, setTutorialActive] = useState(false);
  const [tutorialStep, setTutorialStep] = useState(0);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'scotty',
      content: "Woof! I'm Scotty, your financial buddy! Ask me anything about your spending!",
      timestamp: new Date(),
    },
  ]);

  useEffect(() => {
    const decayPerMinute = DAILY_HAPPINESS_DECAY / (24 * 60);
    const intervalId = setInterval(() => {
      setScottyState((prev) => {
        const nextHappiness = Math.max(0, prev.happiness - decayPerMinute);
        const nextMood =
          nextHappiness >= 80
            ? 'happy'
            : nextHappiness >= 60
            ? 'content'
            : nextHappiness >= 40
            ? 'worried'
            : 'sad';

        if (nextHappiness === prev.happiness && nextMood === prev.mood) {
          return prev;
        }

        return {
          ...prev,
          happiness: nextHappiness,
          mood: nextMood,
        };
      });
    }, HAPPINESS_DECAY_INTERVAL_MS);

    return () => clearInterval(intervalId);
  }, []);

  // Initialize on mount: show mock data immediately, then try backend in background
  useEffect(() => {
    initializeApp();
  }, []);

  useEffect(() => {
    let isMounted = true;

    AsyncStorage.getItem(TUTORIAL_STORAGE_KEY)
      .then((value) => {
        if (!isMounted) return;
        if (value === 'true') {
          setTutorialActive(false);
          setTutorialStep(0);
        } else {
          setTutorialActive(true);
          setTutorialStep(0);
        }
      })
      .catch(() => {
        if (!isMounted) return;
        setTutorialActive(true);
        setTutorialStep(0);
      });

    return () => {
      isMounted = false;
    };
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


  async function initializeApp() {
    const isHealthy = await checkBackendHealth();
    if (!isHealthy) {
      initializeFallbackState();
      return;
    }
    setBackendConnected(true);

    try {
      await withTimeout(loadFromBackend(), 15000);
    } catch (err) {
      console.warn('[AppContext] Backend upgrade failed, using fallback state:', err);
      setBackendConnected(false);
      initializeFallbackState();
    }
  }

  async function loadFromBackend() {
    console.log('[AppContext] Loading data from backend...');
    
    const [txns, metrics, scotty, userProfile] = await Promise.all([
      fetchTransactions(30),
      fetchHealthMetrics(),
      fetchScottyState(),
      fetchUserProfile(),
    ]);

    console.log('[AppContext] Core data loaded:', {
      transactions: txns.length,
      profile: userProfile,
      scottyHappiness: scotty.happiness,
    });

    setTransactions(txns);
    setProfile(userProfile);
    setScottyState(scotty);
    setHealthMetrics(metrics);

    // Fetch budgets, accounts, daily spend (non-critical, don't block)
    try {
      const [budgetData, accountData, todaySpend] = await Promise.all([
        fetchBudgets().catch((err) => { console.warn('[AppContext] Budget fetch failed:', err); return []; }),
        fetchAccounts().catch((err) => { console.warn('[AppContext] Accounts fetch failed:', err); return { accounts: [] as AccountInfo[], totalBalance: 0 }; }),
        fetchTodaySpend().catch((err) => { console.warn('[AppContext] Daily spend fetch failed:', err); return 0; }),
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
      
      console.log('[AppContext] Financial data loaded:', {
        budgets: budgetData.length,
        accounts: accountData.accounts.length,
        totalBalance: accountData.totalBalance,
        dailySpend: todaySpend,
      });
    } catch (err) {
      console.warn('[AppContext] Failed to fetch non-critical financial data:', err);
      // Non-critical data — keep defaults
    }

    // Fetch quests, spending trend, upcoming bills (non-critical)
    try {
      const [questsData, trendData, billsData] = await Promise.all([
        fetchDailyQuests().catch(() => []),
        fetchSpendingTrend().catch(() => ({ months: [], totals: [] })),
        fetchUpcomingBills().catch(() => null),
      ]);

      if (questsData.length > 0) setQuests(questsData);
      if (trendData.months.length > 0) setSpendingTrend(trendData);
      if (billsData) setUpcomingBills(billsData);
    } catch {
      // Non-critical data
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
    const happinessBoost = 5;

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

  const completeTutorial = () => {
    setTutorialActive(false);
    setTutorialStep(0);
    AsyncStorage.setItem(TUTORIAL_STORAGE_KEY, 'true').catch(() => undefined);
  };

  const advanceTutorial = () => {
    setTutorialStep((prev) => {
      const next = Math.min(prev + 1, TUTORIAL_STEPS.length - 1);
      if (next === prev && prev === TUTORIAL_STEPS.length - 1) {
        return prev;
      }
      return next;
    });
  };

  const skipTutorial = () => {
    completeTutorial();
  };

  const resetTutorial = () => {
    AsyncStorage.removeItem(TUTORIAL_STORAGE_KEY).catch(() => undefined);
    setTutorialStep(0);
    setTutorialActive(true);
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
        quests,
        spendingTrend,
        upcomingBills,
        chatMessages,
        backendConnected,
        onboarding: { agreedToPact: onboardingAgreed },
        tutorial: { active: tutorialActive, step: tutorialStep },
        feedScotty,
        completeAchievement,
        dismissAchievement,
        sendChatMessage,
        refreshInsight,
        setOnboardingAgreed,
        advanceTutorial,
        skipTutorial,
        completeTutorial,
        resetTutorial,
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
