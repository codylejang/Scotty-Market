import { Router, Request, Response } from 'express';
import { Orchestrator } from '../orchestrator';
import { AgentRunner } from '../agents/runner';
import { Adapters } from '../adapters';
import { evaluateQuest, evaluateUserQuests } from '../services/quest-evaluation';
import { getUpcomingSubscriptions, detectRecurringCandidates } from '../services/subscription-analysis';
import { computeHealthMetrics } from '../services/health-metrics';
import { searchTransactions, getTransactionById, listTransactionStats, detectAnomalies } from '../services/retrieval';
import { resetAndSeedNessieDummyData, getTransactionHistory, inferNessieCategory } from '../services/nessie';
import { listBudgets, createBudget, updateBudget, validateBudgetInput, BudgetFrequency } from '../services/budget';
import { getDb } from '../db/database';
import { TransactionSchema } from '../schemas';
import { z } from 'zod';
import { v4 as uuid } from 'uuid';

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
          growthLevel: 1,
          happinessPercent: 70,
          staminaPercent: 100,
        });
      }

      res.json({
        happiness: state.happiness,
        mood: state.mood,
        last_fed: state.last_fed,
        food_credits: state.food_credits,
        last_reward_food: state.last_reward_food,
        last_reward_at: state.last_reward_at,
        growthLevel: state.growth_level || 1,
        happinessPercent: state.happiness,
        staminaPercent: state.stamina ?? 100,
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ─── POST /v1/scotty/feed (legacy credit-based) ───
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

  // ─── GET /v1/budget ───
  router.get('/v1/budget', async (req: Request, res: Response) => {
    try {
      const userId = req.query.user_id as string;
      if (!userId) return res.status(400).json({ error: 'user_id required' });
      const budgets = listBudgets(userId);
      res.json({ budgets });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ─── POST /v1/budget ───
  router.post('/v1/budget', async (req: Request, res: Response) => {
    try {
      const validation = validateBudgetInput(req.body);
      if (validation.error) return res.status(400).json({ error: validation.error });

      const budget = createBudget(
        req.body.user_id,
        req.body.category,
        req.body.limit_amount,
        req.body.frequency || 'Month',
      );
      res.status(201).json(budget);
    } catch (err: any) {
      if (err.message?.includes('UNIQUE constraint')) {
        return res.status(409).json({ error: 'Budget already exists for this category' });
      }
      res.status(500).json({ error: err.message });
    }
  });

  // ─── PUT /v1/budget/:id ───
  router.put('/v1/budget/:id', async (req: Request, res: Response) => {
    try {
      const updates: { limit_amount?: number; frequency?: BudgetFrequency; category?: string } = {};
      if (req.body.limit_amount !== undefined) updates.limit_amount = req.body.limit_amount;
      if (req.body.frequency) updates.frequency = req.body.frequency;
      if (req.body.category) updates.category = req.body.category;

      const budget = updateBudget(req.params.id as string, updates);
      if (!budget) return res.status(404).json({ error: 'Budget not found' });
      res.json(budget);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ─── GET /v1/finance/transactions (Nessie-backed) ───
  router.get('/v1/finance/transactions', async (req: Request, res: Response) => {
    try {
      const q = req.query.q as string | undefined;
      const amountMin = req.query.amount_min ? parseFloat(req.query.amount_min as string) : undefined;
      const amountMax = req.query.amount_max ? parseFloat(req.query.amount_max as string) : undefined;
      const dateStart = req.query.date_start as string | undefined;
      const dateEnd = req.query.date_end as string | undefined;
      const category = req.query.category as string | undefined;
      const limit = Math.min(parseInt(req.query.limit as string || '25'), 100);
      const page = parseInt(req.query.page as string || '1');

      const now = new Date();
      const start = dateStart ? new Date(dateStart) : new Date(now.getFullYear(), now.getMonth() - 3, now.getDate());
      const end = dateEnd ? new Date(dateEnd) : now;

      const allTxns = await getTransactionHistory(start, end);

      // Apply filters
      let filtered = allTxns;

      if (q) {
        const lower = q.toLowerCase();
        // Smart search: detect amount pattern like "$83"
        const amountMatch = lower.match(/\$(\d+(?:\.\d+)?)/);
        if (amountMatch) {
          const amt = parseFloat(amountMatch[1]);
          filtered = filtered.filter(t => Math.abs(t.amount) >= amt - 1 && Math.abs(t.amount) <= amt + 1);
        } else {
          filtered = filtered.filter(t =>
            t.description.toLowerCase().includes(lower) ||
            (t.type && t.type.toLowerCase().includes(lower))
          );
        }
      }

      if (amountMin !== undefined) {
        filtered = filtered.filter(t => t.amount >= amountMin);
      }
      if (amountMax !== undefined) {
        filtered = filtered.filter(t => t.amount <= amountMax);
      }

      if (category) {
        filtered = filtered.filter(t => {
          const cat = inferNessieCategory(t.type, t.description);
          return cat.toLowerCase() === category.toLowerCase();
        });
      }

      // Summary
      const totalSpend = filtered
        .filter(t => t.amount < 0)
        .reduce((sum, t) => sum + Math.abs(t.amount), 0);

      // Paginate
      const offset = (page - 1) * limit;
      const paginated = filtered.slice(offset, offset + limit);
      const nextCursor = offset + limit < filtered.length ? page + 1 : null;

      res.json({
        transactions: paginated,
        next_cursor: nextCursor,
        summary: {
          count: filtered.length,
          total_spend: Math.round(totalSpend * 100) / 100,
        },
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ─── GET /v1/finance/accounts (Nessie-backed) ───
  router.get('/v1/finance/accounts', async (req: Request, res: Response) => {
    try {
      const baseUrl = process.env.NESSIE_BASE_URL || 'http://api.nessieisreal.com';
      const apiKey = process.env.NESSIE_API_KEY;
      if (!apiKey) return res.status(500).json({ error: 'NESSIE_API_KEY not configured' });

      const url = `${baseUrl}/accounts?key=${encodeURIComponent(apiKey)}`;
      const resp = await fetch(url);
      if (!resp.ok) throw new Error(`Nessie ${resp.status}`);
      const accounts = await resp.json() as any[];

      const mapped = accounts.map((a: any) => ({
        id: a._id,
        type: a.type,
        nickname: a.nickname || a.type,
        balance: a.balance,
        currency: 'USD',
      }));

      const totalBalance = mapped.reduce((sum: number, a: any) => sum + (a.balance || 0), 0);

      res.json({
        accounts: mapped,
        totalBalance: Math.round(totalBalance * 100) / 100,
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ─── GET /v1/scotty/inventory ───
  router.get('/v1/scotty/inventory', async (req: Request, res: Response) => {
    try {
      const userId = req.query.user_id as string;
      if (!userId) return res.status(400).json({ error: 'user_id required' });

      const db = getDb();
      const items = db.prepare(
        'SELECT * FROM inventory_item WHERE user_id = ? AND quantity > 0 ORDER BY item_type'
      ).all(userId) as any[];

      res.json({ inventory: items });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ─── POST /v1/scotty/inventory (admin: add reward items) ───
  router.post('/v1/scotty/inventory', async (req: Request, res: Response) => {
    try {
      const { user_id, item_type, quantity, source_quest_id } = req.body;
      if (!user_id || !item_type) return res.status(400).json({ error: 'user_id and item_type required' });
      const qty = quantity || 1;

      const db = getDb();
      db.prepare(`
        INSERT INTO inventory_item (id, user_id, item_type, quantity, source_quest_id)
        VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(user_id, item_type) DO UPDATE SET
          quantity = quantity + excluded.quantity,
          updated_at = datetime('now')
      `).run(uuid(), user_id, item_type, qty, source_quest_id || null);

      const item = db.prepare(
        'SELECT * FROM inventory_item WHERE user_id = ? AND item_type = ?'
      ).get(user_id, item_type);

      res.status(201).json(item);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ─── POST /v1/scotty/inventory/feed ───
  router.post('/v1/scotty/inventory/feed', async (req: Request, res: Response) => {
    try {
      const { user_id, item_type, quantity } = req.body;
      if (!user_id || !item_type) return res.status(400).json({ error: 'user_id and item_type required' });
      const qty = quantity || 1;

      // Food effect mapping
      const FOOD_EFFECTS: Record<string, { happiness: number; stamina: number }> = {
        kibble: { happiness: 5, stamina: 10 },
        bone: { happiness: 8, stamina: 15 },
        steak: { happiness: 15, stamina: 20 },
        salmon: { happiness: 12, stamina: 25 },
        truffle: { happiness: 20, stamina: 10 },
      };
      const effect = FOOD_EFFECTS[item_type] || { happiness: 5, stamina: 5 };

      const db = getDb();

      // Atomic: check inventory, decrement, update scotty, log feeding
      const feedTransaction = db.transaction(() => {
        const inv = db.prepare(
          'SELECT * FROM inventory_item WHERE user_id = ? AND item_type = ?'
        ).get(user_id, item_type) as any;

        if (!inv || inv.quantity < qty) {
          throw new Error(`Not enough ${item_type}: have ${inv?.quantity || 0}, need ${qty}`);
        }

        // Decrement inventory
        db.prepare(
          'UPDATE inventory_item SET quantity = quantity - ?, updated_at = datetime(\'now\') WHERE user_id = ? AND item_type = ?'
        ).run(qty, user_id, item_type);

        // Ensure scotty_state exists
        let state = db.prepare('SELECT * FROM scotty_state WHERE user_id = ?').get(user_id) as any;
        if (!state) {
          db.prepare(`
            INSERT INTO scotty_state (user_id, happiness, mood, food_credits, growth_level, stamina)
            VALUES (?, 70, 'content', 10, 1, 100)
          `).run(user_id);
          state = { happiness: 70, stamina: 100, growth_level: 1 };
        }

        const deltaH = effect.happiness * qty;
        const deltaS = effect.stamina * qty;
        const newHappiness = Math.min(100, Math.max(0, (state.happiness || 70) + deltaH));
        const newStamina = Math.min(100, Math.max(0, (state.stamina || 100) + deltaS));
        const newMood = newHappiness >= 80 ? 'happy' : newHappiness >= 60 ? 'content' : newHappiness >= 40 ? 'worried' : 'sad';

        // Growth level: every 20 feeding events = +1 level
        const feedCount = (db.prepare(
          'SELECT COUNT(*) as cnt FROM feeding_event WHERE user_id = ?'
        ).get(user_id) as any).cnt;
        const newGrowthLevel = Math.max(state.growth_level || 1, Math.floor((feedCount + 1) / 20) + 1);

        db.prepare(`
          UPDATE scotty_state
          SET happiness = ?, stamina = ?, mood = ?, growth_level = ?,
              last_fed = datetime('now'), updated_at = datetime('now')
          WHERE user_id = ?
        `).run(newHappiness, newStamina, newMood, newGrowthLevel, user_id);

        // Log feeding event
        db.prepare(`
          INSERT INTO feeding_event (id, user_id, item_type, delta_happiness, delta_stamina)
          VALUES (?, ?, ?, ?, ?)
        `).run(uuid(), user_id, item_type, deltaH, deltaS);

        // Return updated state
        const updatedInv = db.prepare(
          'SELECT * FROM inventory_item WHERE user_id = ? AND quantity > 0 ORDER BY item_type'
        ).all(user_id);
        return {
          scottyState: {
            happiness: newHappiness,
            stamina: newStamina,
            mood: newMood,
            growthLevel: newGrowthLevel,
          },
          inventory: updatedInv,
        };
      });

      const result = feedTransaction();
      res.json(result);
    } catch (err: any) {
      if (err.message?.includes('Not enough')) {
        return res.status(400).json({ error: err.message });
      }
      res.status(500).json({ error: err.message });
    }
  });

  // ─── GET /v1/scotty/status ───
  router.get('/v1/scotty/status', async (req: Request, res: Response) => {
    try {
      const userId = req.query.user_id as string;
      if (!userId) return res.status(400).json({ error: 'user_id required' });

      const db = getDb();
      const state = db.prepare('SELECT * FROM scotty_state WHERE user_id = ?').get(userId) as any;

      if (!state) {
        return res.json({
          growthLevel: 1,
          happinessPercent: 70,
          staminaPercent: 100,
        });
      }

      res.json({
        growthLevel: state.growth_level || 1,
        happinessPercent: state.happiness,
        staminaPercent: state.stamina ?? 100,
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

      const today = new Date().toISOString().split('T')[0];
      const billDays = subs
        .filter((s): s is typeof s & { next_expected_date: string } => !!s.next_expected_date)
        .map(s => new Date(s.next_expected_date).getDate());
      const dueToday = subs.filter(s => s.next_expected_date === today);

      res.json({
        subscriptions: subs,
        bill_days: [...new Set(billDays)],
        due_today: dueToday,
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ─── GET /v1/quests/list ───
  router.get('/v1/quests/list', async (req: Request, res: Response) => {
    try {
      const userId = req.query.user_id as string;
      if (!userId) return res.status(400).json({ error: 'user_id required' });

      const db = getDb();
      const quests = db.prepare(
        `SELECT * FROM quest WHERE user_id = ? ORDER BY created_at DESC`
      ).all(userId) as any[];

      const mapped = quests.map((q: any) => {
        const params = JSON.parse(q.metric_params || '{}');
        // Get latest progress snapshot
        const snapshot = db.prepare(
          `SELECT * FROM quest_progress_snapshot WHERE quest_id = ? ORDER BY created_at DESC LIMIT 1`
        ).get(q.id) as any;

        return {
          id: q.id,
          title: q.title,
          status: q.status,
          metric_type: q.metric_type,
          metric_params: params,
          reward_food_type: q.reward_food_type,
          happiness_delta: q.happiness_delta,
          window_start: q.window_start,
          window_end: q.window_end,
          confirmed_value: snapshot?.confirmed_value ?? 0,
          pending_value: snapshot?.pending_value ?? 0,
          explanation: snapshot?.explanation ?? '',
        };
      });

      res.json(mapped);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ─── POST /v1/quests/refresh ───
  router.post('/v1/quests/refresh', async (req: Request, res: Response) => {
    try {
      const userId = (req.body?.user_id as string) || (req.query.user_id as string);
      if (!userId) return res.status(400).json({ error: 'user_id required' });

      // Trigger daily digest which generates new quests
      const result = await orchestrator.runDailyDigest(userId);

      // Re-evaluate active quests
      evaluateUserQuests(userId);

      // Return updated quest list
      const db = getDb();
      const quests = db.prepare(
        `SELECT * FROM quest WHERE user_id = ? ORDER BY created_at DESC`
      ).all(userId) as any[];

      const mapped = quests.map((q: any) => {
        const params = JSON.parse(q.metric_params || '{}');
        const snapshot = db.prepare(
          `SELECT * FROM quest_progress_snapshot WHERE quest_id = ? ORDER BY created_at DESC LIMIT 1`
        ).get(q.id) as any;

        return {
          id: q.id,
          title: q.title,
          status: q.status,
          metric_type: q.metric_type,
          metric_params: params,
          reward_food_type: q.reward_food_type,
          happiness_delta: q.happiness_delta,
          window_start: q.window_start,
          window_end: q.window_end,
          confirmed_value: snapshot?.confirmed_value ?? 0,
          pending_value: snapshot?.pending_value ?? 0,
          explanation: snapshot?.explanation ?? '',
        };
      });

      res.json(mapped);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ─── GET /v1/finance/spending-trend ───
  router.get('/v1/finance/spending-trend', async (req: Request, res: Response) => {
    try {
      const userId = req.query.user_id as string || 'user_1';
      const months = parseInt(req.query.months as string || '6');

      const db = getDb();
      const now = new Date();
      const result: { month: string; total: number }[] = [];

      for (let i = months - 1; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const start = d.toISOString().split('T')[0];
        const endDate = new Date(d.getFullYear(), d.getMonth() + 1, 0);
        const end = endDate.toISOString().split('T')[0];
        const monthLabel = d.toLocaleString('en-US', { month: 'short' });

        const row = db.prepare(`
          SELECT COALESCE(SUM(ABS(amount)), 0) as total
          FROM transaction_
          WHERE user_id = ? AND date >= ? AND date <= ? AND amount < 0 AND pending = 0
        `).get(userId, start, end) as any;

        result.push({
          month: monthLabel,
          total: Math.round((row?.total || 0) * 100) / 100,
        });
      }

      res.json({ trend: result });
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

  // ─── AI Retrieval Endpoints ───

  // ─── GET /ai/scotty/insights — anomaly-driven insights with evidence ───
  router.get('/ai/scotty/insights', async (req: Request, res: Response) => {
    try {
      const userId = req.query.user_id as string;
      if (!userId) return res.status(400).json({ error: 'user_id required' });

      const anomalyResult = detectAnomalies({ user_id: userId, sensitivity: 'med', limit: 10 });

      const now = new Date();
      const d7 = new Date(now); d7.setDate(d7.getDate() - 7);
      const d90 = new Date(now); d90.setDate(d90.getDate() - 90);

      const stats7d = listTransactionStats({
        user_id: userId,
        date_start: d7.toISOString().split('T')[0],
        date_end: now.toISOString().split('T')[0],
        group_by: 'category',
      });
      const stats90d = listTransactionStats({
        user_id: userId,
        date_start: d90.toISOString().split('T')[0],
        date_end: now.toISOString().split('T')[0],
        group_by: 'category',
      });

      // Build insights from anomalies + stats
      const insights: any[] = [];
      const topAnomalies = anomalyResult.anomalies.slice(0, 3);

      for (const anomaly of topAnomalies) {
        let actionable = '';
        if (anomaly.type === 'spike_category') {
          actionable = `Consider setting a ${anomaly.computed_metrics.merchant || 'category'} spending cap.`;
        } else if (anomaly.type === 'duplicate_charge') {
          actionable = 'Review these charges — one may be a duplicate.';
        } else if (anomaly.type === 'subscription_jump') {
          actionable = `Review this subscription; charges increased.`;
        } else if (anomaly.type === 'large_vs_baseline') {
          actionable = 'This is unusually large for this category.';
        } else if (anomaly.type === 'new_merchant') {
          actionable = 'New merchant detected — keep an eye on it.';
        } else {
          actionable = 'Worth reviewing.';
        }

        insights.push({
          title: anomaly.type.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase()),
          blurb: anomaly.explanation_short.substring(0, 200),
          confidence: anomaly.severity_score > 0.7 ? 'HIGH' : anomaly.severity_score > 0.4 ? 'MEDIUM' : 'LOW',
          evidence: {
            transaction_ids: anomaly.transaction_ids,
            time_window: anomaly.baseline_window,
            computed_metrics: anomaly.computed_metrics,
          },
          followup: actionable,
        });
      }

      // If no anomalies, generate a summary insight
      if (insights.length === 0 && stats7d.rows.length > 0) {
        const topCat = stats7d.rows[0];
        insights.push({
          title: 'Weekly Summary',
          blurb: `Top spending: ${topCat.group_key} at $${topCat.total_spend.toFixed(2)} this week.`,
          confidence: 'HIGH',
          evidence: {
            transaction_ids: [],
            time_window: `${d7.toISOString().split('T')[0]} to ${now.toISOString().split('T')[0]}`,
            computed_metrics: { total_7d: stats7d.overall.total_spend, category: topCat.group_key },
          },
          followup: 'Ask me about your spending trends!',
        });
      }

      // Log decision
      const logId = runner.logDecisionPublic(userId, 'DAILY_DIGEST', {
        anomaly_count: anomalyResult.anomalies.length,
        insight_count: insights.length,
        tools_called: ['detect_anomalies', 'list_transaction_stats'],
      }, { insights });

      res.json({
        insights,
        log_id: logId,
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ─── POST /ai/quests/generate — full-history quest generation with evidence ───
  router.post('/ai/quests/generate', async (req: Request, res: Response) => {
    try {
      const userId = req.body.user_id as string;
      if (!userId) return res.status(400).json({ error: 'user_id required' });

      const now = new Date();
      const d7 = new Date(now); d7.setDate(d7.getDate() - 7);
      const d30 = new Date(now); d30.setDate(d30.getDate() - 30);
      const d90 = new Date(now); d90.setDate(d90.getDate() - 90);
      const nowStr = now.toISOString().split('T')[0];

      // Gather multi-window stats
      const stats7d = listTransactionStats({ user_id: userId, date_start: d7.toISOString().split('T')[0], date_end: nowStr, group_by: 'category' });
      const stats30d = listTransactionStats({ user_id: userId, date_start: d30.toISOString().split('T')[0], date_end: nowStr, group_by: 'category' });
      const stats90d = listTransactionStats({ user_id: userId, date_start: d90.toISOString().split('T')[0], date_end: nowStr, group_by: 'category' });

      const anomalies = detectAnomalies({ user_id: userId, sensitivity: 'med', limit: 10 });
      const recurring = detectRecurringCandidates(userId, 90);

      // Generate quest proposals based on data
      const quests: any[] = [];

      // 1. Category spike quests
      for (const anomaly of anomalies.anomalies.filter(a => a.type === 'spike_category')) {
        const cat = anomaly.computed_metrics.merchant as string || 'spending';
        const recentDaily = anomaly.computed_metrics.recent_daily as number;
        const cap = Math.round(recentDaily * 0.8 * 100) / 100;
        quests.push({
          title: `Keep ${cat} under $${cap.toFixed(2)} today`,
          metric_type: 'CATEGORY_SPEND_CAP',
          metric_params: { category: cat, cap },
          reward_food_type: 'bone',
          happiness_delta: 8,
          window_hours: 24,
          explanation: anomaly.explanation_short,
          evidence: {
            transaction_ids: anomaly.transaction_ids,
            time_window: anomaly.baseline_window,
            computed_metrics: anomaly.computed_metrics,
          },
        });
      }

      // 2. Subscription verification quests
      for (const anomaly of anomalies.anomalies.filter(a => a.type === 'subscription_jump')) {
        const merchant = anomaly.computed_metrics.merchant as string || 'merchant';
        quests.push({
          title: `Verify ${merchant} subscription charge`,
          metric_type: 'NO_MERCHANT_CHARGE',
          metric_params: { merchant_key: merchant },
          reward_food_type: 'steak',
          happiness_delta: 10,
          window_hours: 168,
          explanation: anomaly.explanation_short,
          evidence: {
            transaction_ids: anomaly.transaction_ids,
            time_window: anomaly.baseline_window,
            computed_metrics: anomaly.computed_metrics,
          },
        });
      }

      // 3. Top-category budget quest (always provide at least one)
      if (stats7d.rows.length > 0) {
        const topCat = stats7d.rows[0];
        const dailyAvg = topCat.total_spend / 7;
        const cap = Math.round(dailyAvg * 0.8 * 100) / 100;
        quests.push({
          title: `Keep ${topCat.group_key} under $${cap.toFixed(2)} today`,
          metric_type: 'CATEGORY_SPEND_CAP',
          metric_params: { category: topCat.group_key, cap },
          reward_food_type: 'kibble',
          happiness_delta: 5,
          window_hours: 24,
          explanation: `Your top spending category this week is ${topCat.group_key} at $${topCat.total_spend.toFixed(2)}.`,
          evidence: {
            transaction_ids: [],
            time_window: `${d7.toISOString().split('T')[0]} to ${nowStr}`,
            computed_metrics: { total_7d: topCat.total_spend, daily_avg: dailyAvg },
          },
        });
      }

      // Deduplicate by metric_type + category
      const seen = new Set<string>();
      const dedupedQuests = quests.filter(q => {
        const key = `${q.metric_type}:${q.metric_params.category || q.metric_params.merchant_key}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      }).slice(0, 5);

      const logId = runner.logDecisionPublic(userId, 'DAILY_DIGEST', {
        tools_called: ['list_transaction_stats', 'detect_anomalies', 'detectRecurringCandidates'],
        quest_count: dedupedQuests.length,
      }, { quests: dedupedQuests });

      res.json({ quests: dedupedQuests, log_id: logId });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ─── POST /ai/quests/evaluate ───
  router.post('/ai/quests/evaluate', async (req: Request, res: Response) => {
    try {
      const questId = req.body.quest_id as string;
      if (!questId) return res.status(400).json({ error: 'quest_id required' });
      const result = evaluateQuest(questId);
      res.json(result);
    } catch (err: any) {
      res.status(404).json({ error: err.message });
    }
  });

  // ─── GET /ai/transactions/recurring ───
  router.get('/ai/transactions/recurring', async (req: Request, res: Response) => {
    try {
      const userId = req.query.user_id as string;
      if (!userId) return res.status(400).json({ error: 'user_id required' });
      const lookbackDays = parseInt(req.query.lookback_days as string || '180');
      const candidates = detectRecurringCandidates(userId, lookbackDays);
      res.json(candidates);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ─── POST /ai/goals/breakdown ───
  router.post('/ai/goals/breakdown', async (req: Request, res: Response) => {
    try {
      const { user_id, goal_name, target_amount, deadline_days } = req.body;
      if (!user_id || !target_amount) return res.status(400).json({ error: 'user_id and target_amount required' });

      const days = deadline_days || 30;
      const dailyTarget = Math.round((target_amount / days) * 100) / 100;

      // Get current savings rate context
      const now = new Date();
      const d30 = new Date(now); d30.setDate(d30.getDate() - 30);
      const stats = listTransactionStats({
        user_id, date_start: d30.toISOString().split('T')[0],
        date_end: now.toISOString().split('T')[0], group_by: 'category',
      });

      const questChain = [];
      for (let d = 0; d < Math.min(days, 7); d++) {
        const windowStart = new Date(now);
        windowStart.setDate(windowStart.getDate() + d);
        questChain.push({
          title: `${goal_name || 'Savings'}: save $${dailyTarget.toFixed(2)} today`,
          metric_type: 'TRANSFER_AMOUNT',
          metric_params: { target_amount: dailyTarget },
          reward_food_type: d === 0 ? 'salmon' : 'kibble',
          happiness_delta: 5,
          window_hours: 24,
          day: d + 1,
        });
      }

      res.json({
        goal: { name: goal_name, target_amount, deadline_days: days, daily_target: dailyTarget },
        quest_chain: questChain,
        context: { total_30d_spend: stats.overall.total_spend, top_category: stats.rows[0]?.group_key },
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ─── Retrieval API Endpoints (for direct use or agent tools) ───

  // ─── POST /v1/search/transactions ───
  router.post('/v1/search/transactions', async (req: Request, res: Response) => {
    try {
      const { user_id, ...params } = req.body;
      if (!user_id) return res.status(400).json({ error: 'user_id required' });
      const result = searchTransactions({ user_id, ...params });
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ─── GET /v1/transactions/:id ───
  router.get('/v1/transactions/:id', async (req: Request, res: Response) => {
    try {
      const userId = req.query.user_id as string;
      if (!userId) return res.status(400).json({ error: 'user_id required' });
      const txn = getTransactionById(userId, req.params.id as string);
      if (!txn) return res.status(404).json({ error: 'Transaction not found' });
      res.json(txn);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ─── POST /v1/stats/transactions ───
  router.post('/v1/stats/transactions', async (req: Request, res: Response) => {
    try {
      const { user_id, ...params } = req.body;
      if (!user_id) return res.status(400).json({ error: 'user_id required' });
      if (!params.date_start || !params.date_end || !params.group_by) {
        return res.status(400).json({ error: 'date_start, date_end, and group_by required' });
      }
      const result = listTransactionStats({ user_id, ...params });
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ─── POST /v1/anomalies/detect ───
  router.post('/v1/anomalies/detect', async (req: Request, res: Response) => {
    try {
      const { user_id, ...params } = req.body;
      if (!user_id) return res.status(400).json({ error: 'user_id required' });
      const result = detectAnomalies({ user_id, ...params });
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ─── POST /v1/goals ───
  router.post('/v1/goals', async (req: Request, res: Response) => {
    try {
      const { user_id, name, target_amount, deadline, saved_so_far, budget_percent } = req.body;
      if (!user_id || !name || !target_amount) {
        return res.status(400).json({ error: 'user_id, name, and target_amount required' });
      }
      if (typeof target_amount !== 'number' || target_amount <= 0) {
        return res.status(400).json({ error: 'target_amount must be a positive number' });
      }

      const db = getDb();
      const id = uuid();
      db.prepare(`
        INSERT INTO goal (id, user_id, name, target_amount, saved_so_far, deadline, budget_percent)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(
        id, user_id, name, target_amount,
        saved_so_far || 0,
        deadline || null,
        budget_percent || 10
      );

      const goal = db.prepare('SELECT * FROM goal WHERE id = ?').get(id);
      res.status(201).json(goal);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ─── GET /v1/goals ───
  router.get('/v1/goals', async (req: Request, res: Response) => {
    try {
      const userId = req.query.user_id as string;
      if (!userId) return res.status(400).json({ error: 'user_id required' });

      const db = getDb();
      const goals = db.prepare(
        `SELECT * FROM goal WHERE user_id = ? ORDER BY created_at DESC`
      ).all(userId);

      res.json({ goals });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ─── GET /v1/goals/:id/progress ───
  router.get('/v1/goals/:id/progress', async (req: Request, res: Response) => {
    try {
      const db = getDb();
      const goal = db.prepare('SELECT * FROM goal WHERE id = ?').get(req.params.id) as any;
      if (!goal) return res.status(404).json({ error: 'Goal not found' });

      const remaining = Math.max(0, goal.target_amount - goal.saved_so_far);
      let monthsLeft = 6;
      if (goal.deadline) {
        const daysLeft = Math.max(1, Math.ceil(
          (new Date(goal.deadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
        ));
        monthsLeft = Math.max(1, daysLeft / 30);
      }
      const monthlyPace = remaining / monthsLeft;

      res.json({
        goal,
        progress: {
          target_amount: goal.target_amount,
          current_amount: goal.saved_so_far,
          remaining,
          monthly_pace_needed: Math.round(monthlyPace * 100) / 100,
          percent_complete: Math.round((goal.saved_so_far / goal.target_amount) * 100),
        },
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ─── POST /v1/budgets/generate ───
  router.post('/v1/budgets/generate', async (req: Request, res: Response) => {
    try {
      const userId = req.body.user_id as string;
      if (!userId) return res.status(400).json({ error: 'user_id required' });
      const apply = req.body.apply === true;

      const suggestions = await runner.generateBudgetSuggestions(userId, { apply });
      res.json({ budgets: suggestions, applied: apply });
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
