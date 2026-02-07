import { v4 as uuid } from 'uuid';
import { getDb } from '../db/database';
import { AgentRunner } from '../agents/runner';
import { Adapters } from '../adapters';
import { ingestTransactions } from '../services/ingestion';
import { evaluateUserQuests } from '../services/quest-evaluation';
import { detectRecurringCandidates, upsertRecurringCandidates } from '../services/subscription-analysis';
import { Transaction } from '../schemas';
import { WorkflowEngine, WorkflowDefinition, WorkflowStep, WorkflowContext } from './workflow';

export class Orchestrator {
  private runner: AgentRunner;
  private adapters: Adapters;
  private workflowEngine: WorkflowEngine;

  constructor(adapters: Adapters, runner: AgentRunner) {
    this.adapters = adapters;
    this.runner = runner;
    this.workflowEngine = new WorkflowEngine();
  }

  /**
   * Flow 1: Daily Digest (cron)
   * For each active user:
   * 1) Build FinancialSummary
   * 2) Generate 1-3 insights
   * 3) If no ACTIVE quest, generate one
   * 4) Generate at most 1 ActionQueueItem
   * 5) Log decision
   */
  async runDailyDigest(userId: string): Promise<{ success: boolean; idempotencyKey: string }> {
    const today = new Date().toISOString().split('T')[0];
    const idempotencyKey = `daily_digest:${userId}:${today}`;

    const workflow: WorkflowDefinition<{ userId: string }, { success: boolean; idempotencyKey: string }> = {
      id: 'daily_digest',
      name: 'Daily Digest Workflow',
      idempotencyKey: () => idempotencyKey,
      steps: [
        {
          name: 'ensure_user_exists',
          execute: async (input) => {
            const db = getDb();
            const existing = db.prepare('SELECT id FROM user_profile WHERE id = ?').get(input.userId);
            if (!existing) {
              db.prepare('INSERT INTO user_profile (id) VALUES (?)').run(input.userId);
            }
            return input;
          },
        },
        {
          name: 'sync_transactions',
          execute: async (input, context) => {
            await this.adapters.bank.syncTransactions(input.userId);
            return input;
          },
          retryPolicy: { maxAttempts: 3, backoffMs: 1000, exponential: true },
        },
        {
          name: 'detect_recurring',
          execute: async (input) => {
            const candidates = detectRecurringCandidates(input.userId);
            if (candidates.length > 0) {
              upsertRecurringCandidates(candidates);
            }
            return input;
          },
        },
        {
          name: 'generate_payload',
          execute: async (input) => {
            // Uses Sonnet (cost-effective) with Haiku fallback for daily digest
            const { output } = await this.runner.generateDailyPayload(input.userId);
            return { ...input, output };
          },
          retryPolicy: { maxAttempts: 2, backoffMs: 2000, exponential: true },
          timeoutMs: 30000, // 30 second timeout for LLM call
        },
        {
          name: 'persist_insights',
          execute: async (input) => {
            const db = getDb();
            const today = new Date().toISOString().split('T')[0];
            for (const insight of input.output.insights) {
              const id = uuid();
              db.prepare(`
                INSERT OR IGNORE INTO insight (id, user_id, date, title, blurb, confidence, metrics)
                VALUES (?, ?, ?, ?, ?, ?, ?)
              `).run(id, input.userId, today, insight.title, insight.blurb, insight.confidence, JSON.stringify(insight.metrics));
            }
            return input;
          },
        },
        {
          name: 'persist_quest',
          execute: async (input) => {
            if (input.output.quest) {
              const db = getDb();
              const questId = uuid();
              const now = new Date();
              const windowEnd = new Date(now.getTime() + input.output.quest.window_hours * 60 * 60 * 1000);
              db.prepare(`
                INSERT INTO quest (id, user_id, status, title, window_start, window_end, metric_type, metric_params, reward_food_type, happiness_delta, created_by)
                VALUES (?, ?, 'ACTIVE', ?, ?, ?, ?, ?, ?, ?, 'agent')
              `).run(
                questId, input.userId, input.output.quest.title,
                now.toISOString().split('T')[0],
                windowEnd.toISOString().split('T')[0],
                input.output.quest.metric_type,
                JSON.stringify(input.output.quest.metric_params),
                input.output.quest.reward_food_type,
                input.output.quest.happiness_delta
              );
            }
            return input;
          },
        },
        {
          name: 'persist_action',
          execute: async (input) => {
            if (input.output.action) {
              const db = getDb();
              db.prepare(`
                INSERT INTO action_queue_item (id, user_id, type, payload, requires_approval, status)
                VALUES (?, ?, ?, ?, ?, 'OPEN')
              `).run(
                uuid(), input.userId, input.output.action.type,
                JSON.stringify(input.output.action.payload),
                input.output.action.requires_approval ? 1 : 0
              );
            }
            return input;
          },
        },
        {
          name: 'send_notification',
          execute: async (input) => {
            if (await this.adapters.notification.enforceDailyLimit(input.userId)) {
              await this.adapters.notification.schedule(input.userId, {
                title: 'Scotty has your daily update!',
                body: input.output.insights[0]?.blurb || 'Check in with Scotty today!',
              });
            }
            return { success: true, idempotencyKey };
          },
          retryPolicy: { maxAttempts: 2, backoffMs: 500 },
        },
      ],
    };

    const result = await this.workflowEngine.execute(workflow, { userId });
    return result;
  }

  /**
   * Flow 2: Transactions Update (webhook)
   * - Ingest new/updated transactions
   * - Recompute quest progress
   * - Handle completions, failures, expiries
   */
  async handleTransactionUpdate(
    userId: string,
    transactions: Transaction[],
    webhookEventId?: string
  ): Promise<{ ingested: number; questResults: any[] }> {
    const idempotencyKey = webhookEventId ? `webhook:${webhookEventId}` : `webhook:${userId}:${Date.now()}`;

    const workflow: WorkflowDefinition<
      { userId: string; transactions: Transaction[] },
      { ingested: number; questResults: any[] }
    > = {
      id: 'transaction_update',
      name: 'Transaction Update Workflow',
      idempotencyKey: () => idempotencyKey,
      steps: [
        {
          name: 'ingest_transactions',
          execute: async (input) => {
            const result = ingestTransactions(input.transactions);
            return { ...input, ingestionResult: result };
          },
        },
        {
          name: 'evaluate_quests',
          execute: async (input) => {
            const questResults = evaluateUserQuests(input.userId);
            return {
              ingested: input.ingestionResult.inserted,
              questResults,
            };
          },
        },
      ],
    };

    return await this.workflowEngine.execute(workflow, { userId, transactions });
  }

  /**
   * Flow 3: User Opens App
   * Return daily payload; run on-demand if missing.
   */
  async getAppOpenPayload(userId: string): Promise<any> {
    const db = getDb();
    const today = new Date().toISOString().split('T')[0];

    // Check if digest ran today
    const insights = db.prepare(
      `SELECT * FROM insight WHERE user_id = ? AND date = ? ORDER BY created_at`
    ).all(userId, today) as any[];

    if (insights.length === 0) {
      // Run on-demand digest (throttled by idempotency)
      try {
        await this.runDailyDigest(userId);
      } catch (err: any) {
        console.warn(`[Orchestrator] On-demand digest failed for ${userId}:`, err.message);
      }
      // Re-check insights (non-recursive — if still empty, return empty)
      const freshInsights = db.prepare(
        `SELECT * FROM insight WHERE user_id = ? AND date = ? ORDER BY created_at`
      ).all(userId, today) as any[];
      if (freshInsights.length > 0) {
        insights.push(...freshInsights);
      }
    }

    const activeQuest = db.prepare(
      `SELECT * FROM quest WHERE user_id = ? AND status = 'ACTIVE' LIMIT 1`
    ).get(userId) as any;

    const actions = db.prepare(
      `SELECT * FROM action_queue_item WHERE user_id = ? AND status = 'OPEN' ORDER BY created_at DESC LIMIT 1`
    ).all(userId) as any[];

    const scottyState = db.prepare(
      'SELECT * FROM scotty_state WHERE user_id = ?'
    ).get(userId) as any || {
      happiness: 70, mood: 'content', food_credits: 10,
      last_reward_food: null, last_reward_at: null,
    };

    return {
      insights: insights.map((i: any) => ({
        ...i,
        metrics: JSON.parse(i.metrics || '{}'),
      })),
      activeQuest: activeQuest ? {
        ...activeQuest,
        metric_params: JSON.parse(activeQuest.metric_params || '{}'),
      } : null,
      optionalActions: actions.map((a: any) => ({
        ...a,
        payload: JSON.parse(a.payload || '{}'),
        requires_approval: !!a.requires_approval,
      })),
      scottyState: {
        happiness: scottyState.happiness,
        mood: scottyState.mood,
        last_reward_food: scottyState.last_reward_food,
        last_reward_at: scottyState.last_reward_at,
        food_credits: scottyState.food_credits,
      },
    };
  }

  /**
   * Flow 4: User Creates Goal -> queue quest chain
   */
  async createGoalQuests(
    userId: string,
    goal: { title: string; metric_type: string; metric_params: Record<string, any>; days: number }
  ): Promise<{ queued: number }> {
    const workflow: WorkflowDefinition<
      { userId: string; goal: typeof goal },
      { queued: number }
    > = {
      id: 'create_goal_quests',
      name: 'Create Goal Quests Workflow',
      idempotencyKey: (input) => `goal_quests:${input.userId}:${input.goal.title}:${Date.now()}`,
      steps: [
        {
          name: 'queue_quests',
          execute: async (input) => {
            const db = getDb();
            let queued = 0;

            for (let d = 0; d < input.goal.days; d++) {
              const startDate = new Date();
              startDate.setDate(startDate.getDate() + d);

              db.prepare(`
                INSERT INTO action_queue_item (id, user_id, type, payload, requires_approval, status)
                VALUES (?, ?, 'FUTURE_QUEST', ?, 0, 'OPEN')
              `).run(
                uuid(), input.userId,
                JSON.stringify({
                  title: `${input.goal.title} - Day ${d + 1}`,
                  metric_type: input.goal.metric_type,
                  metric_params: input.goal.metric_params,
                  scheduled_date: startDate.toISOString().split('T')[0],
                })
              );
              queued++;
            }

            return { queued };
          },
        },
      ],
    };

    return await this.workflowEngine.execute(workflow, { userId, goal });
  }

  /**
   * Run digest for all active users.
   */
  async runDailyDigestAll(): Promise<{ processed: number; errors: string[] }> {
    const db = getDb();
    const users = db.prepare('SELECT id FROM user_profile').all() as { id: string }[];
    const errors: string[] = [];
    let processed = 0;

    for (const user of users) {
      try {
        await this.runDailyDigest(user.id);
        processed++;
      } catch (err: any) {
        errors.push(`User ${user.id}: ${err.message}`);
      }
    }

    return { processed, errors };
  }

  /**
   * Get workflow execution history for debugging
   */
  getWorkflowHistory(workflowId: string, limit: number = 10) {
    return this.workflowEngine.getExecutionHistory(workflowId, limit);
  }
}
