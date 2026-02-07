import { v4 as uuid } from 'uuid';
import { getDb } from '../db/database';
import { buildDualSummary } from './financial-summary';

interface GoalRow {
  id: string;
  user_id: string;
  name: string;
  target_amount: number;
  saved_so_far: number;
  deadline: string | null;
  status: string;
}

const DISCRETIONARY_CATEGORIES = ['Entertainment', 'Shopping', 'Food & Drink'];

function toDateString(value: Date): string {
  return value.toISOString().split('T')[0];
}

export async function generateGoalQuests(userId: string, goal: GoalRow): Promise<number> {
  if (!goal || goal.user_id !== userId || goal.status !== 'ACTIVE') return 0;

  const remaining = Math.max(0, goal.target_amount - (goal.saved_so_far || 0));
  if (remaining <= 0) return 0;

  const now = new Date();
  let daysToDeadline = 28;
  if (goal.deadline) {
    const deadlineMs = new Date(goal.deadline).getTime();
    if (Number.isFinite(deadlineMs)) {
      daysToDeadline = Math.max(1, Math.ceil((deadlineMs - now.getTime()) / 86400000));
    }
  }

  const weeksToDeadline = Math.max(1, Math.ceil(daysToDeadline / 7));
  const questWeeks = Math.min(weeksToDeadline, 4);
  const weeklySavings = remaining / weeksToDeadline;

  const { summary30d } = buildDualSummary(userId);
  const byCategory = summary30d.by_category as Record<string, number>;

  const topCategories = DISCRETIONARY_CATEGORIES
    .map((category) => ({ category, spend30d: byCategory[category] || 0 }))
    .filter((item) => item.spend30d > 0)
    .sort((a, b) => b.spend30d - a.spend30d)
    .slice(0, 3);

  if (topCategories.length === 0) return 0;

  const totalTopSpend = topCategories.reduce((sum, item) => sum + item.spend30d, 0);
  if (totalTopSpend <= 0) return 0;

  const db = getDb();
  const insertQuest = db.prepare(`
    INSERT INTO quest (
      id, user_id, goal_id, status, title, description, window_start, window_end,
      metric_type, metric_params, reward_food_type, happiness_delta, created_by
    )
    VALUES (?, ?, ?, 'ACTIVE', ?, ?, ?, ?, 'CATEGORY_SPEND_CAP', ?, 'bone', 6, 'goal_workshop')
  `);

  let inserted = 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const write = db.transaction(() => {
    for (const item of topCategories) {
      const weeklyAvg = item.spend30d / (30 / 7);
      const share = item.spend30d / totalTopSpend;
      const rawCap = weeklyAvg - weeklySavings * share;
      const cap = Math.max(weeklyAvg * 0.5, rawCap);
      const roundedCap = Math.max(5, Math.round(cap * 100) / 100);

      for (let week = 0; week < questWeeks; week += 1) {
        const start = new Date(today);
        start.setDate(start.getDate() + week * 7);
        const end = new Date(start);
        end.setDate(end.getDate() + 6);

        const title = `Weekly ${item.category} cap`;
        const description = `Keep ${item.category} spending under $${Math.round(roundedCap)} this week for ${goal.name}.`;
        const metricParams = JSON.stringify({
          category: item.category,
          cap: roundedCap,
          goal_id: goal.id,
          week_index: week + 1,
        });

        insertQuest.run(
          uuid(),
          userId,
          goal.id,
          title,
          description,
          toDateString(start),
          toDateString(end),
          metricParams
        );
        inserted += 1;
      }
    }
  });

  write();
  return inserted;
}
