import { getTransactions } from '../services/ingestion';
import { buildFinancialSummary, buildDualSummary } from '../services/financial-summary';
import { getUpcomingSubscriptions, detectRecurringCandidates } from '../services/subscription-analysis';
import {
  searchTransactions, getTransactionById, listTransactionStats, detectAnomalies,
} from '../services/retrieval';
import { Adapters } from '../adapters';
import { getDb } from '../db/database';

export interface ToolContext {
  userId: string;
  adapters: Adapters;
}

export interface ToolDefinition {
  name: string;
  description: string;
  execute: (ctx: ToolContext, params: Record<string, any>) => Promise<any>;
}

export const TOOLS: ToolDefinition[] = [
  {
    name: 'get_transactions',
    description: 'Get user transactions for a date range. Params: start (YYYY-MM-DD), end (YYYY-MM-DD), include_pending (bool), category (optional), merchant (optional)',
    execute: async (ctx, params) => {
      return getTransactions(ctx.userId, params.start, params.end, {
        includePending: params.include_pending ?? false,
        category: params.category,
        merchant: params.merchant,
      });
    },
  },
  {
    name: 'get_financial_summary',
    description: 'Get financial summary for 7-day and 30-day windows. No params needed.',
    execute: async (ctx) => {
      return buildDualSummary(ctx.userId);
    },
  },
  {
    name: 'get_budgets',
    description: 'Get user budgets. No params needed.',
    execute: async (ctx) => {
      return ctx.adapters.budget.getBudgets(ctx.userId);
    },
  },
  {
    name: 'get_recurring_candidates',
    description: 'Get detected recurring/subscription charges. Params: lookback_days (optional, default 90)',
    execute: async (ctx, params) => {
      return detectRecurringCandidates(ctx.userId, params.lookback_days ?? 90);
    },
  },
  {
    name: 'get_upcoming_subscriptions',
    description: 'Get upcoming subscription charges. Params: days_ahead (optional, default 30)',
    execute: async (ctx, params) => {
      return getUpcomingSubscriptions(ctx.userId, params.days_ahead ?? 30);
    },
  },
  {
    name: 'get_active_quest',
    description: 'Get the current active quest for the user. No params needed.',
    execute: async (ctx) => {
      const db = getDb();
      const row = db.prepare(
        `SELECT * FROM quest WHERE user_id = ? AND status = 'ACTIVE' LIMIT 1`
      ).get(ctx.userId) as any;
      if (!row) return null;
      return {
        ...row,
        metric_params: JSON.parse(row.metric_params || '{}'),
      };
    },
  },
  {
    name: 'get_recent_insights',
    description: 'Get recent insights for the user. Params: days (optional, default 7)',
    execute: async (ctx, params) => {
      const db = getDb();
      const daysAgo = new Date();
      daysAgo.setDate(daysAgo.getDate() - (params.days ?? 7));
      return db.prepare(
        `SELECT * FROM insight WHERE user_id = ? AND date >= ? ORDER BY date DESC`
      ).all(ctx.userId, daysAgo.toISOString().split('T')[0]);
    },
  },
  {
    name: 'get_scotty_state',
    description: 'Get current Scotty pet state (happiness, mood, credits). No params needed.',
    execute: async (ctx) => {
      const db = getDb();
      return db.prepare('SELECT * FROM scotty_state WHERE user_id = ?').get(ctx.userId) || {
        happiness: 70,
        mood: 'content',
        food_credits: 10,
        last_reward_food: null,
        last_reward_at: null,
      };
    },
  },
  // ─── Retrieval Tools ───
  {
    name: 'search_transactions',
    description: 'Search transactions with filters. Params: query_text (optional), date_start, date_end, amount_min, amount_max, categories[] (optional), merchant_keys[] (optional), pending (bool), sort_by (date|amount|relevance), limit (default 25, max 100), offset',
    execute: async (ctx, params) => {
      return searchTransactions({ user_id: ctx.userId, ...params });
    },
  },
  {
    name: 'get_transaction_by_id',
    description: 'Get full details for a specific transaction. Params: transaction_id',
    execute: async (ctx, params) => {
      return getTransactionById(ctx.userId, params.transaction_id);
    },
  },
  {
    name: 'list_transaction_stats',
    description: 'Compute aggregate stats for any time span. Params: date_start, date_end, group_by (category|merchant|day|week|month), category (optional), merchant_key (optional), amount_min/max (optional), limit',
    execute: async (ctx, params) => {
      return listTransactionStats({ user_id: ctx.userId, ...params } as any);
    },
  },
  {
    name: 'detect_anomalies',
    description: 'Find stand-out transactions. Params: date_start (optional), date_end (optional), anomaly_types[] (optional: large_vs_baseline, new_merchant, spike_category, duplicate_charge, subscription_jump, refund_outlier), sensitivity (low|med|high), limit',
    execute: async (ctx, params) => {
      return detectAnomalies({ user_id: ctx.userId, ...params });
    },
  },
  {
    name: 'get_quest_history',
    description: 'Get quest history. Params: status (optional), limit (default 10)',
    execute: async (ctx, params) => {
      const db = getDb();
      let sql = 'SELECT * FROM quest WHERE user_id = ?';
      const p: any[] = [ctx.userId];
      if (params.status) { sql += ' AND status = ?'; p.push(params.status); }
      sql += ' ORDER BY created_at DESC LIMIT ?';
      p.push(params.limit ?? 10);
      const rows = db.prepare(sql).all(...p) as any[];
      return rows.map(r => ({ ...r, metric_params: JSON.parse(r.metric_params || '{}') }));
    },
  },
  {
    name: 'get_budget_state',
    description: 'Get budgets with remaining amounts. No params needed.',
    execute: async (ctx) => {
      const budgets = await ctx.adapters.budget.getBudgets(ctx.userId);
      // Compute remaining for each budget
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
      const monthEnd = now.toISOString().split('T')[0];
      const stats = listTransactionStats({
        user_id: ctx.userId, date_start: monthStart, date_end: monthEnd, group_by: 'category',
      });
      const spentMap = new Map(stats.rows.map(r => [r.group_key, r.total_spend]));
      return budgets.map((b: any) => ({
        ...b,
        spent: spentMap.get(b.category) || 0,
        remaining: b.amount - (spentMap.get(b.category) || 0),
      }));
    },
  },
];

export function getToolByName(name: string): ToolDefinition | undefined {
  return TOOLS.find(t => t.name === name);
}
