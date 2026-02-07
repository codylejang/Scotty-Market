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
  calculateDailyCredits,
} from '../services/healthScore';
import { generateDailyInsight, generateChatResponse } from '../services/ai';

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
  // Initialize with mock data
  const [profile] = useState<UserProfile>(() => generateUserProfile());
  const [transactions] = useState<Transaction[]>(() => generateTransactionHistory(30, 3));
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [scottyState, setScottyState] = useState<ScottyState>(defaultScottyState);
  const [healthMetrics, setHealthMetrics] = useState<HealthMetrics>(defaultHealthMetrics);
  const [dailyInsight, setDailyInsight] = useState<DailyInsight | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'scotty',
      content: "Woof! I'm Scotty, your financial buddy! 🐕 Ask me anything about your spending!",
      timestamp: new Date(),
    },
  ]);

  // Initialize on mount
  useEffect(() => {
    // Calculate initial metrics
    const metrics = calculateHealthMetrics({
      transactions,
      monthlyBudget: profile.monthlyBudget,
      monthlySavingsGoal: profile.monthlySavingsGoal,
      currentBalance: profile.currentBalance,
    });
    setHealthMetrics(metrics);

    // Calculate Scotty state
    const scotty = calculateScottyState(metrics, null, 10);
    setScottyState(scotty);

    // Generate achievements
    const newAchievements = generateSampleAchievements(transactions);
    setAchievements(newAchievements);

    // Generate daily insight
    generateDailyInsight(transactions).then(setDailyInsight);
  }, [transactions, profile]);

  // Feed Scotty
  const feedScotty = (type: FoodType) => {
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
    // Add user message
    const userMessage: ChatMessage = {
      id: `user_${Date.now()}`,
      role: 'user',
      content: message,
      timestamp: new Date(),
    };
    setChatMessages((prev) => [...prev, userMessage]);

    // Get AI response
    try {
      const response = await generateChatResponse(message, transactions, chatMessages);
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
