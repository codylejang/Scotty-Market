import { Transaction, HealthMetrics, MoodState, ScottyState } from '../types';
import { getTotalSpending } from './transactionMetrics';

const IMPULSE_MERCHANTS = ['DoorDash', 'Uber Eats', 'Amazon', 'Shein', 'Steam'];
const IMPULSE_THRESHOLD = 5; // More than 5 impulse purchases is concerning

interface HealthScoreParams {
  transactions: Transaction[];
  monthlyBudget: number;
  monthlySavingsGoal: number;
  currentBalance: number;
}

export function calculateHealthMetrics(params: HealthScoreParams): HealthMetrics {
  const { transactions, monthlyBudget, monthlySavingsGoal, currentBalance } = params;

  // Budget adherence (0-100)
  const totalSpent = getTotalSpending(transactions, 30);
  const budgetAdherence = Math.max(0, Math.min(100,
    ((monthlyBudget - totalSpent) / monthlyBudget) * 100 + 50
  ));

  // Savings rate (0-100)
  // Assume income is budget + savings goal
  const estimatedIncome = monthlyBudget + monthlySavingsGoal;
  const actualSavings = estimatedIncome - totalSpent;
  const savingsRate = Math.max(0, Math.min(100,
    (actualSavings / monthlySavingsGoal) * 50
  ));

  // Impulse score (0-100, higher = fewer impulse purchases)
  const impulseCount = transactions.filter(t =>
    IMPULSE_MERCHANTS.includes(t.merchant)
  ).length;
  const impulseScore = Math.max(0, Math.min(100,
    100 - (impulseCount / IMPULSE_THRESHOLD) * 50
  ));

  // Overall score (weighted average)
  const overallScore = Math.round(
    budgetAdherence * 0.4 +
    savingsRate * 0.3 +
    impulseScore * 0.3
  );

  return {
    budgetAdherence: Math.round(budgetAdherence),
    savingsRate: Math.round(savingsRate),
    impulseScore: Math.round(impulseScore),
    overallScore,
  };
}

export function getMoodFromScore(score: number): MoodState {
  if (score >= 80) return 'happy';
  if (score >= 60) return 'content';
  if (score >= 40) return 'worried';
  return 'sad';
}

export function getHappinessFromMetrics(metrics: HealthMetrics, lastFed: Date | null): number {
  let happiness = metrics.overallScore;

  // Reduce happiness if not fed recently
  if (lastFed) {
    const hoursSinceFeeding = (Date.now() - lastFed.getTime()) / (1000 * 60 * 60);
    if (hoursSinceFeeding > 24) {
      happiness = Math.max(0, happiness - 20);
    } else if (hoursSinceFeeding > 12) {
      happiness = Math.max(0, happiness - 10);
    }
  } else {
    happiness = Math.max(0, happiness - 15);
  }

  return Math.round(happiness);
}

export function calculateScottyState(
  metrics: HealthMetrics,
  lastFed: Date | null,
  foodCredits: number
): ScottyState {
  const happiness = getHappinessFromMetrics(metrics, lastFed);
  const mood = getMoodFromScore(happiness);

  return {
    mood,
    happiness,
    lastFed,
    foodCredits,
  };
}

// Calculate credits earned from achievements
export function calculateCreditsEarned(achievementId: string): number {
  // Base credits for completing any achievement
  return 10;
}

// Determine food credits based on financial behavior
export function calculateDailyCredits(metrics: HealthMetrics): number {
  // Earn 1-5 credits per day based on overall score
  if (metrics.overallScore >= 80) return 5;
  if (metrics.overallScore >= 60) return 3;
  if (metrics.overallScore >= 40) return 2;
  return 1;
}

// Get insight message based on current state
export function getStateInsight(metrics: HealthMetrics, mood: MoodState): string {
  const insights: Record<MoodState, string[]> = {
    happy: [
      "Woof! You're doing amazing! Keep it up! 🐕",
      "I'm so happy! Your budget is looking great!",
      "*tail wagging intensifies* You're crushing it!",
      "Best. Human. Ever. Your savings are on point!",
    ],
    content: [
      "Things are looking good! Just a few tweaks and we're golden!",
      "Not bad at all! You're on the right track.",
      "I'm feeling pretty good about your spending!",
      "Steady progress! Keep watching those impulse buys.",
    ],
    worried: [
      "Hmm, I'm a bit concerned... Let's review your spending?",
      "We might want to cut back a little this week...",
      "I believe in you! But maybe fewer DoorDash orders?",
      "*concerned head tilt* Let's work on this together!",
    ],
    sad: [
      "I'm worried about you... Let's make a plan?",
      "Things are tough, but we can turn this around!",
      "*whimper* Please check your spending...",
      "I'm here for you. Let's set some goals together.",
    ],
  };

  const moodInsights = insights[mood];
  return moodInsights[Math.floor(Math.random() * moodInsights.length)];
}
