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
} from '../types';
import {
  generateTransactionHistory,
  generateUserProfile,
  generateSampleAchievements,
} from '../services/mockData';
import {
  calculateHealthMetrics,
  calculateScottyState,
} from '../services/healthScore';
import { generateDailyInsight, generateChatResponse } from '../services/ai';
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

const AppContext = createContext<AppState | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  // Initialize with mock data (used as fallback)
  const [profile] = useState<UserProfile>(() => generateUserProfile());
  const [transactions, setTransactions] = useState<Transaction[]>(() =>
    generateTransactionHistory(30, 3)
  );
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [scottyState, setScottyState] = useState<ScottyState>(defaultScottyState);
  const [healthMetrics, setHealthMetrics] = useState<HealthMetrics>(defaultHealthMetrics);
  const [dailyInsight, setDailyInsight] = useState<DailyInsight | null>(null);
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

    const newAchievements = generateSampleAchievements(transactions);
    setAchievements(newAchievements);

    generateDailyInsight(transactions).then(setDailyInsight);
  }

  async function tryBackendUpgrade() {
    const isHealthy = await checkBackendHealth();
    if (!isHealthy) return;
    setBackendConnected(true);

    // Fetch backend data with a global timeout so the app never hangs
    try {
      await withTimeout(loadFromBackend(), 15000);
    } catch (err) {
      console.warn('[AppContext] Backend upgrade failed, keeping mock data:', err);
      setBackendConnected(false);
    }
  }

  async function loadFromBackend() {
    // Fetch non-blocking data first (fast endpoints)
    const [txns, metrics, scotty] = await Promise.all([
      fetchTransactions(30),
      fetchHealthMetrics(),
      fetchScottyState(),
    ]);

    if (txns.length > 0) setTransactions(txns);
    setScottyState(scotty);
    setHealthMetrics(metrics);

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
      const baseAchievements = generateSampleAchievements(txns.length > 0 ? txns : transactions);
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
