import { v4 as uuid } from 'uuid';
import { getDb } from '../db/database';

interface GoalRow {
  id: string;
  user_id: string;
  name: string;
  target_amount: number;
  saved_so_far: number;
  deadline: string | null;
  status: string;
}

type RewardFood = 'kibble' | 'bone' | 'steak';

interface GoalQuestTemplate {
  category: 'Food & Drink' | 'Shopping' | 'Entertainment';
  title: string;
  tip: string;
  reward: RewardFood;
  happinessDelta: number;
  fallbackWeeklySpend: number;
}

const GOAL_QUEST_TEMPLATES: GoalQuestTemplate[] = [
  {
    category: 'Food & Drink',
    title: 'Cook-at-Home Week',
    tip: 'Swap at least two takeout orders for home meals.',
    reward: 'bone',
    happinessDelta: 6,
    fallbackWeeklySpend: 70,
  },
  {
    category: 'Shopping',
    title: 'Impulse Pause Challenge',
    tip: 'Use a 24-hour wait before non-essential buys.',
    reward: 'steak',
    happinessDelta: 8,
    fallbackWeeklySpend: 60,
  },
  {
    category: 'Entertainment',
    title: 'Low-Cost Fun Week',
    tip: 'Choose free or low-cost plans for weekend activities.',
    reward: 'kibble',
    happinessDelta: 5,
    fallbackWeeklySpend: 45,
  },
];

function toDateString(value: Date): string {
  return value.toISOString().split('T')[0];
}

function getGoalWindow(deadline: string | null): { start: string; end: string } {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const end = new Date(today);
  end.setDate(end.getDate() + 6);

  if (deadline) {
    const deadlineDate = new Date(deadline);
    if (Number.isFinite(deadlineDate.getTime())) {
      deadlineDate.setHours(0, 0, 0, 0);
      if (deadlineDate.getTime() < end.getTime()) {
        end.setTime(deadlineDate.getTime());
      }
    }
  }

  if (end.getTime() < today.getTime()) {
    end.setTime(today.getTime());
  }

  return {
    start: toDateString(today),
    end: toDateString(end),
  };
}

function getWeeklyCategorySpend(userId: string): Record<string, number> {
  const db = getDb();
  const lookback = new Date();
  lookback.setDate(lookback.getDate() - 90);
  const lookbackStart = toDateString(lookback);

  const spendByCategory: Record<string, number> = {};
  for (const template of GOAL_QUEST_TEMPLATES) {
    const row = db.prepare(`
      SELECT COALESCE(SUM(ABS(amount)), 0) as spend_90d
      FROM transaction_
      WHERE user_id = ?
        AND amount < 0
        AND pending = 0
        AND date >= ?
        AND category_primary = ?
    `).get(userId, lookbackStart, template.category) as { spend_90d: number };

    const weekly = (row?.spend_90d || 0) / 13;
    spendByCategory[template.category] = Math.max(0, weekly);
  }

  return spendByCategory;
}

export async function generateGoalQuests(userId: string, goal: GoalRow): Promise<number> {
  if (!goal || goal.user_id !== userId || goal.status !== 'ACTIVE') return 0;

  const remaining = Math.max(0, goal.target_amount - (goal.saved_so_far || 0));
  if (remaining <= 0) return 0;

  const now = new Date();
  let daysToDeadline = 56;
  if (goal.deadline) {
    const deadlineMs = new Date(goal.deadline).getTime();
    if (Number.isFinite(deadlineMs)) {
      daysToDeadline = Math.max(1, Math.ceil((deadlineMs - now.getTime()) / 86400000));
    }
  }
  const weeksToDeadline = Math.max(1, Math.ceil(daysToDeadline / 7));
  const weeklySavings = remaining / weeksToDeadline;
  const window = getGoalWindow(goal.deadline);

  const weeklySpend = getWeeklyCategorySpend(userId);
  const weightedSpend = GOAL_QUEST_TEMPLATES.map((template) => {
    const observed = weeklySpend[template.category] || 0;
    const base = observed > 0 ? observed : template.fallbackWeeklySpend;
    return {
      template,
      baseWeeklySpend: base,
      weight: base + 1,
    };
  });
  const totalWeight = weightedSpend.reduce((sum, item) => sum + item.weight, 0);

  const db = getDb();
  const deleteExisting = db.prepare(
    `DELETE FROM quest WHERE user_id = ? AND goal_id = ? AND created_by = 'goal_workshop'`
  );
  const insertQuest = db.prepare(`
    INSERT INTO quest (
      id, user_id, goal_id, status, title, description, window_start, window_end,
      metric_type, metric_params, reward_food_type, happiness_delta, created_by
    )
    VALUES (?, ?, ?, 'ACTIVE', ?, ?, ?, ?, 'CATEGORY_SPEND_CAP', ?, ?, ?, 'goal_workshop')
  `);

  let inserted = 0;
  const write = db.transaction(() => {
    deleteExisting.run(userId, goal.id);

    for (const item of weightedSpend) {
      const share = totalWeight > 0 ? item.weight / totalWeight : 1 / GOAL_QUEST_TEMPLATES.length;
      const targetReduction = weeklySavings * share;
      const unclampedCap = item.baseWeeklySpend - targetReduction;
      const minCap = Math.max(15, item.baseWeeklySpend * 0.55);
      const cap = Math.max(minCap, unclampedCap);
      const roundedCap = Math.max(15, Math.round(cap / 5) * 5);

      const description = `${item.template.tip} Keep ${item.template.category} spending under $${roundedCap} this week to move toward ${goal.name}.`;
      const metricParams = JSON.stringify({
        category: item.template.category,
        cap: roundedCap,
        goal_id: goal.id,
      });

      insertQuest.run(
        uuid(),
        userId,
        goal.id,
        item.template.title,
        description,
        window.start,
        window.end,
        metricParams,
        item.template.reward,
        item.template.happinessDelta
      );
      inserted += 1;
    }
  });

  write();
  return inserted;
}
