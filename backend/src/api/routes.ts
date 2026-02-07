import { Router, Request, Response } from 'express';
import { Orchestrator } from '../orchestrator';
import { AgentRunner } from '../agents/runner';
import { Adapters } from '../adapters';
import { evaluateQuest } from '../services/quest-evaluation';
import { getUpcomingSubscriptions } from '../services/subscription-analysis';
import { computeHealthMetrics } from '../services/health-metrics';
import { resetAndSeedNessieDummyData } from '../services/nessie';
import { getDb } from '../db/database';
import { TransactionSchema } from '../schemas';
import { z } from 'zod';

export function createRouter(adapters: Adapters, runner: AgentRunner): Router {
  const router = Router();
  const orchestrator = new Orchestrator(adapters, runner);

  // ─── GET /v1/transactions ───
  router.get('/v1/transactions', async (req: Request, res: Response) => {
    try {
      const userId = req.query.user_id as string;
      if (!userId) return res.status(400).json({ error: 'user_id required' });

      const now = new Date();
      const end = req.query.end as string || now.toISOString().split('T')[0];
      const d30 = new Date(now);
      d30.setDate(d30.getDate() - (parseInt(req.query.days as string) || 30));
      const start = req.query.start as string || d30.toISOString().split('T')[0];
      const includePending = req.query.include_pending === 'true';

      // Refresh from Nessie when due (adapter throttles and only ingests new rows).
      await adapters.bank.syncTransactions(userId);

      const txns = await adapters.bank.listTransactions(userId, start, end, includePending);
      res.json(txns);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ─── GET /v1/profile ───
  router.get('/v1/profile', async (req: Request, res: Response) => {
    try {
      const userId = req.query.user_id as string;
      if (!userId) return res.status(400).json({ error: 'user_id required' });

      const db = getDb();
      const user = db
        .prepare('SELECT id, timezone, preferences FROM user_profile WHERE id = ?')
        .get(userId) as
        | { id: string; timezone: string; preferences: string }
        | undefined;
      if (!user) return res.status(404).json({ error: 'User not found' });

      const now = new Date();
      const end = now.toISOString().split('T')[0];
      const d30 = new Date(now);
      d30.setDate(d30.getDate() - 30);
      const start = d30.toISOString().split('T')[0];

      const budgetRows = db
        .prepare('SELECT amount, period FROM budget WHERE user_id = ?')
        .all(userId) as Array<{ amount: number; period: string }>;
      const monthlyBudget = budgetRows.reduce((sum, row) => {
        if (row.period === 'weekly') return sum + row.amount * 4;
        return sum + row.amount;
      }, 0) || 1500;

      const txRows = db
        .prepare(
          `SELECT amount FROM transaction_
           WHERE user_id = ?
             AND date BETWEEN ? AND ?
             AND pending = 0`
        )
        .all(userId, start, end) as Array<{ amount: number }>;

      const totals = txRows.reduce(
        (acc, row) => {
          if (row.amount < 0) acc.spent += Math.abs(row.amount);
          else acc.income += row.amount;
          return acc;
        },
        { spent: 0, income: 0 }
      );

      const monthlySavingsGoal = Math.round(monthlyBudget * 0.2);
      const inferredCurrentBalance = Math.round((2000 + totals.income - totals.spent) * 100) / 100;
      res.json({
        id: user.id,
        timezone: user.timezone,
        preferences: JSON.parse(user.preferences || '{}'),
        monthly_budget: Math.round(monthlyBudget * 100) / 100,
        monthly_savings_goal: monthlySavingsGoal,
        current_balance: inferredCurrentBalance,
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ─── GET /v1/budgets ───
  router.get('/v1/budgets', async (req: Request, res: Response) => {
    try {
      const userId = req.query.user_id as string;
      if (!userId) return res.status(400).json({ error: 'user_id required' });

      const db = getDb();
      const now = new Date();
      const end = now.toISOString().split('T')[0];
      const d30 = new Date(now);
      d30.setDate(d30.getDate() - 30);
      const start = d30.toISOString().split('T')[0];

      const rows = db
        .prepare(
          `SELECT
             b.category AS category,
             b.amount AS amount,
             b.period AS period,
             COALESCE(SUM(
               CASE
                 WHEN t.amount < 0 THEN ABS(t.amount)
                 ELSE 0
               END
             ), 0) AS spent
           FROM budget b
           LEFT JOIN transaction_ t
             ON t.user_id = b.user_id
            AND t.category_primary = b.category
            AND t.date BETWEEN ? AND ?
            AND t.pending = 0
           WHERE b.user_id = ?
           GROUP BY b.category, b.amount, b.period
           ORDER BY b.category ASC`
        )
        .all(start, end, userId) as Array<{
        category: string;
        amount: number;
        period: string;
        spent: number;
      }>;

      res.json(
        rows.map((row) => ({
          category: row.category,
          amount: Math.round(row.amount * 100) / 100,
          period: row.period,
          spent: Math.round(row.spent * 100) / 100,
        }))
      );
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ─── GET /v1/health-metrics ───
  router.get('/v1/health-metrics', async (req: Request, res: Response) => {
    try {
      const userId = req.query.user_id as string;
      if (!userId) return res.status(400).json({ error: 'user_id required' });

      const metrics = computeHealthMetrics(userId);
      res.json(metrics);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ─── GET /v1/scotty/state ───
  router.get('/v1/scotty/state', async (req: Request, res: Response) => {
    try {
      const userId = req.query.user_id as string;
      if (!userId) return res.status(400).json({ error: 'user_id required' });

      const db = getDb();
      const state = db.prepare('SELECT * FROM scotty_state WHERE user_id = ?').get(userId) as any;

      if (!state) {
        return res.json({
          happiness: 70,
          mood: 'content',
          last_fed: null,
          food_credits: 10,
          last_reward_food: null,
          last_reward_at: null,
        });
      }

      res.json({
        happiness: state.happiness,
        mood: state.mood,
        last_fed: state.last_fed,
        food_credits: state.food_credits,
        last_reward_food: state.last_reward_food,
        last_reward_at: state.last_reward_at,
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ─── POST /v1/scotty/feed ───
  router.post('/v1/scotty/feed', async (req: Request, res: Response) => {
    try {
      const { user_id, food_type } = req.body;
      if (!user_id || !food_type) {
        return res.status(400).json({ error: 'user_id and food_type required' });
      }

      const cost = food_type === 'meal' ? 5 : 2;
      const happinessBoost = food_type === 'meal' ? 15 : 5;

      const db = getDb();
      let state = db.prepare('SELECT * FROM scotty_state WHERE user_id = ?').get(user_id) as any;

      if (!state) {
        // Initialize scotty state
        db.prepare(`
          INSERT INTO scotty_state (user_id, happiness, mood, food_credits)
          VALUES (?, 70, 'content', 10)
        `).run(user_id);
        state = { happiness: 70, mood: 'content', food_credits: 10, last_fed: null };
      }

      if (state.food_credits < cost) {
        return res.status(400).json({ error: 'Not enough food credits', food_credits: state.food_credits });
      }

      const newHappiness = Math.min(100, state.happiness + happinessBoost);
      const newCredits = state.food_credits - cost;
      const newMood = newHappiness >= 80 ? 'happy' : newHappiness >= 60 ? 'content' : newHappiness >= 40 ? 'worried' : 'sad';
      const now = new Date().toISOString();

      db.prepare(`
        UPDATE scotty_state
        SET happiness = ?, mood = ?, food_credits = ?, last_fed = ?, updated_at = datetime('now')
        WHERE user_id = ?
      `).run(newHappiness, newMood, newCredits, now, user_id);

      res.json({
        happiness: newHappiness,
        mood: newMood,
        last_fed: now,
        food_credits: newCredits,
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ─── GET /v1/home/daily ───
  router.get('/v1/home/daily', async (req: Request, res: Response) => {
    try {
      const userId = req.query.user_id as string;
      if (!userId) return res.status(400).json({ error: 'user_id required' });

      const payload = await orchestrator.getAppOpenPayload(userId);
      res.json(payload);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ─── GET /v1/quests/active ───
  router.get('/v1/quests/active', async (req: Request, res: Response) => {
    try {
      const userId = req.query.user_id as string;
      if (!userId) return res.status(400).json({ error: 'user_id required' });

      const db = getDb();
      const quest = db.prepare(
        `SELECT * FROM quest WHERE user_id = ? AND status = 'ACTIVE' LIMIT 1`
      ).get(userId) as any;

      if (!quest) return res.json(null);

      res.json({
        ...quest,
        metric_params: JSON.parse(quest.metric_params || '{}'),
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ─── POST /v1/quests/:id/evaluate ───
  router.post('/v1/quests/:id/evaluate', async (req: Request, res: Response) => {
    try {
      const result = evaluateQuest(req.params.id as string);
      res.json(result);
    } catch (err: any) {
      res.status(404).json({ error: err.message });
    }
  });

  // ─── GET /v1/subscriptions/upcoming ───
  router.get('/v1/subscriptions/upcoming', async (req: Request, res: Response) => {
    try {
      const userId = req.query.user_id as string;
      if (!userId) return res.status(400).json({ error: 'user_id required' });

      const daysAhead = parseInt(req.query.days_ahead as string || '30');
      const subs = getUpcomingSubscriptions(userId, daysAhead);
      res.json(subs);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ─── POST /v1/actions/:id/approve ───
  router.post('/v1/actions/:id/approve', async (req: Request, res: Response) => {
    try {
      const db = getDb();
      const action = db.prepare('SELECT * FROM action_queue_item WHERE id = ?').get(req.params.id) as any;
      if (!action) return res.status(404).json({ error: 'Action not found' });
      if (action.status !== 'OPEN') return res.status(400).json({ error: `Action is ${action.status}, not OPEN` });

      db.prepare(`UPDATE action_queue_item SET status = 'APPROVED', updated_at = datetime('now') WHERE id = ?`)
        .run(req.params.id);

      res.json({ id: req.params.id, status: 'APPROVED' });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ─── POST /v1/webhooks/transactions ───
  router.post('/v1/webhooks/transactions', async (req: Request, res: Response) => {
    try {
      const { user_id, transactions, webhook_event_id } = req.body;
      if (!user_id || !transactions) {
        return res.status(400).json({ error: 'user_id and transactions required' });
      }

      // Validate transactions loosely
      const txns = z.array(TransactionSchema).parse(transactions);

      const result = await orchestrator.handleTransactionUpdate(user_id, txns, webhook_event_id);
      res.json(result);
    } catch (err: any) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ error: 'Invalid transaction format', details: err.errors });
      }
      res.status(500).json({ error: err.message });
    }
  });

  // ─── POST /v1/chat ───
  router.post('/v1/chat', async (req: Request, res: Response) => {
    try {
      const { user_id, message } = req.body;
      if (!user_id || !message) {
        return res.status(400).json({ error: 'user_id and message required' });
      }

      const { output } = await runner.generateChatResponse(user_id, message);
      // Frontend expects { response: string, actions?: any[] }
      res.json({ response: output.message, actions: output.recommended_actions });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ─── POST /v1/admin/daily-digest (trigger digest manually) ───
  router.post('/v1/admin/daily-digest', async (req: Request, res: Response) => {
    try {
      const { user_id } = req.body;
      if (user_id) {
        const result = await orchestrator.runDailyDigest(user_id);
        return res.json(result);
      }
      const result = await orchestrator.runDailyDigestAll();
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ─── POST /v1/admin/nessie/sync ───
  router.post('/v1/admin/nessie/sync', async (req: Request, res: Response) => {
    try {
      const userId = (req.body?.user_id as string) || 'user_1';
      const force = req.body?.force === true;
      const result = await adapters.bank.syncTransactions(userId, force ? 'force' : undefined);
      res.json({
        userId,
        synced: result.transactions.length,
        cursor: result.cursor,
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ─── POST /v1/admin/nessie/seed ───
  router.post('/v1/admin/nessie/seed', async (_req: Request, res: Response) => {
    try {
      const result = await resetAndSeedNessieDummyData();
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  return router;
}
