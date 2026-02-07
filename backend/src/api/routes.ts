import { Router, Request, Response } from 'express';
import { Orchestrator } from '../orchestrator';
import { AgentRunner } from '../agents/runner';
import { Adapters } from '../adapters';
import { evaluateQuest } from '../services/quest-evaluation';
import { getUpcomingSubscriptions } from '../services/subscription-analysis';
import { getTransactions } from '../services/ingestion';
import { computeHealthMetrics } from '../services/health-metrics';
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

      const txns = getTransactions(userId, start, end, { includePending });
      res.json(txns);
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

  return router;
}
