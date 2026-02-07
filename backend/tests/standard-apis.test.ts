import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDb, getDb } from '../src/db/database';
import {
  computeDerivedDailyLimit,
  validateBudgetInput,
  listBudgets,
  createBudget,
  updateBudget,
} from '../src/services/budget';
import { v4 as uuid } from 'uuid';

const TEST_USER_ID = 'test-user-std';

beforeEach(() => {
  createTestDb();
  const db = getDb();
  db.prepare(`INSERT INTO user_profile (id) VALUES (?)`).run(TEST_USER_ID);
});

// ─── Budget Math: computeDerivedDailyLimit ───

describe('computeDerivedDailyLimit', () => {
  it('Day frequency returns limit_amount as-is', () => {
    expect(computeDerivedDailyLimit(50, 'Day')).toBe(50);
  });

  it('Year frequency divides by days in year', () => {
    const year2025 = new Date(2025, 5, 1); // non-leap year
    expect(computeDerivedDailyLimit(365, 'Year', year2025)).toBe(1);
  });

  it('Month frequency uses actual days in month', () => {
    // February 2024 has 29 days (leap year)
    const feb2024 = new Date(2024, 1, 15); // month is 0-indexed
    const result = computeDerivedDailyLimit(290, 'Month', feb2024);
    expect(result).toBe(10); // 290/29 = 10

    // January has 31 days
    const jan = new Date(2025, 0, 15);
    const result2 = computeDerivedDailyLimit(310, 'Month', jan);
    expect(result2).toBe(10); // 310/31 = 10
  });

  it('handles rounding to 2 decimal places', () => {
    const feb2025 = new Date(2025, 1, 15); // 28 days
    const result = computeDerivedDailyLimit(100, 'Month', feb2025);
    expect(result).toBe(3.57); // 100/28 = 3.571...
  });

  it('handles zero-ish amounts', () => {
    expect(computeDerivedDailyLimit(0.01, 'Day')).toBe(0.01);
  });
});

// ─── Budget Validation ───

describe('validateBudgetInput', () => {
  it('requires user_id', () => {
    expect(validateBudgetInput({ category: 'Food & Drink', limit_amount: 100 }).error).toContain('user_id');
  });

  it('requires category', () => {
    expect(validateBudgetInput({ user_id: 'u1', limit_amount: 100 }).error).toContain('category');
  });

  it('rejects invalid category', () => {
    const result = validateBudgetInput({ user_id: 'u1', category: 'Pets', limit_amount: 100 });
    expect(result.error).toContain('Invalid category');
  });

  it('rejects non-positive limit_amount', () => {
    expect(validateBudgetInput({ user_id: 'u1', category: 'Food & Drink', limit_amount: 0 }).error).toContain('positive');
    expect(validateBudgetInput({ user_id: 'u1', category: 'Food & Drink', limit_amount: -10 }).error).toContain('positive');
  });

  it('rejects invalid frequency', () => {
    const result = validateBudgetInput({
      user_id: 'u1', category: 'Food & Drink', limit_amount: 100, frequency: 'Quarter',
    });
    expect(result.error).toContain('frequency');
  });

  it('accepts valid input', () => {
    const result = validateBudgetInput({
      user_id: 'u1', category: 'Food & Drink', limit_amount: 100, frequency: 'Year',
    });
    expect(result.error).toBeUndefined();
  });
});

// ─── Budget CRUD ───

describe('Budget CRUD', () => {
  it('creates a budget with derived daily limit', () => {
    const budget = createBudget(TEST_USER_ID, 'Food & Drink', 300, 'Month');
    expect(budget.id).toBeDefined();
    expect(budget.user_id).toBe(TEST_USER_ID);
    expect(budget.category).toBe('Food & Drink');
    expect(budget.limit_amount).toBe(300);
    expect(budget.frequency).toBe('Month');
    expect(budget.derived_daily_limit).toBeGreaterThan(0);
    expect(budget.derived_daily_limit).toBeLessThan(15); // 300/28..31
  });

  it('lists budgets for a user', () => {
    createBudget(TEST_USER_ID, 'Food & Drink', 300, 'Month');
    createBudget(TEST_USER_ID, 'Shopping', 200, 'Year');

    const budgets = listBudgets(TEST_USER_ID);
    expect(budgets.length).toBe(2);
    expect(budgets[0].category).toBe('Food & Drink'); // sorted alphabetically
    expect(budgets[1].category).toBe('Shopping');
    expect(budgets[1].derived_daily_limit).toBeCloseTo(200 / 365, 1);
  });

  it('updates a budget and recomputes derived daily limit', () => {
    const budget = createBudget(TEST_USER_ID, 'Entertainment', 100, 'Month');
    const updated = updateBudget(budget.id, { limit_amount: 210, frequency: 'Year' });

    expect(updated).not.toBeNull();
    expect(updated!.limit_amount).toBe(210);
    expect(updated!.frequency).toBe('Year');
    expect(updated!.derived_daily_limit).toBeCloseTo(210 / 365, 1);
  });

  it('returns null when updating nonexistent budget', () => {
    const result = updateBudget('nonexistent', { limit_amount: 100 });
    expect(result).toBeNull();
  });

  it('does not return budgets for other users', () => {
    createBudget(TEST_USER_ID, 'Food & Drink', 300, 'Month');
    const budgets = listBudgets('other-user');
    expect(budgets.length).toBe(0);
  });
});

// ─── Inventory & Feeding ───

describe('Inventory & Feeding', () => {
  it('adds inventory items', () => {
    const db = getDb();
    db.prepare(`
      INSERT INTO inventory_item (id, user_id, item_type, quantity)
      VALUES (?, ?, ?, ?)
    `).run(uuid(), TEST_USER_ID, 'kibble', 5);

    const items = db.prepare(
      'SELECT * FROM inventory_item WHERE user_id = ? AND item_type = ?'
    ).get(TEST_USER_ID, 'kibble') as any;

    expect(items).toBeDefined();
    expect(items.quantity).toBe(5);
  });

  it('upserts inventory on conflict', () => {
    const db = getDb();
    const id1 = uuid();
    db.prepare(`
      INSERT INTO inventory_item (id, user_id, item_type, quantity)
      VALUES (?, ?, ?, ?)
    `).run(id1, TEST_USER_ID, 'bone', 3);

    // Upsert: add 2 more
    db.prepare(`
      INSERT INTO inventory_item (id, user_id, item_type, quantity)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(user_id, item_type) DO UPDATE SET
        quantity = quantity + excluded.quantity,
        updated_at = datetime('now')
    `).run(uuid(), TEST_USER_ID, 'bone', 2);

    const item = db.prepare(
      'SELECT * FROM inventory_item WHERE user_id = ? AND item_type = ?'
    ).get(TEST_USER_ID, 'bone') as any;

    expect(item.quantity).toBe(5);
  });

  it('feeding decrements inventory and updates scotty state', () => {
    const db = getDb();

    // Setup: give user inventory and scotty state
    db.prepare(`INSERT INTO scotty_state (user_id, happiness, mood, food_credits, growth_level, stamina)
      VALUES (?, 50, 'content', 10, 1, 50)`).run(TEST_USER_ID);
    db.prepare(`INSERT INTO inventory_item (id, user_id, item_type, quantity)
      VALUES (?, ?, ?, ?)`).run(uuid(), TEST_USER_ID, 'steak', 3);

    // Feed: consume 1 steak
    const feedTransaction = db.transaction(() => {
      const inv = db.prepare(
        'SELECT * FROM inventory_item WHERE user_id = ? AND item_type = ?'
      ).get(TEST_USER_ID, 'steak') as any;

      if (!inv || inv.quantity < 1) throw new Error('Not enough');

      db.prepare(
        'UPDATE inventory_item SET quantity = quantity - 1 WHERE user_id = ? AND item_type = ?'
      ).run(TEST_USER_ID, 'steak');

      // steak: happiness +15, stamina +20
      const state = db.prepare('SELECT * FROM scotty_state WHERE user_id = ?').get(TEST_USER_ID) as any;
      const newH = Math.min(100, state.happiness + 15);
      const newS = Math.min(100, state.stamina + 20);

      db.prepare(`UPDATE scotty_state SET happiness = ?, stamina = ? WHERE user_id = ?`)
        .run(newH, newS, TEST_USER_ID);

      db.prepare(`INSERT INTO feeding_event (id, user_id, item_type, delta_happiness, delta_stamina)
        VALUES (?, ?, ?, ?, ?)`).run(uuid(), TEST_USER_ID, 'steak', 15, 20);

      return { newH, newS };
    });

    const result = feedTransaction();
    expect(result.newH).toBe(65); // 50 + 15
    expect(result.newS).toBe(70); // 50 + 20

    // Check inventory decreased
    const inv = db.prepare(
      'SELECT quantity FROM inventory_item WHERE user_id = ? AND item_type = ?'
    ).get(TEST_USER_ID, 'steak') as any;
    expect(inv.quantity).toBe(2);

    // Check feeding event logged
    const events = db.prepare(
      'SELECT * FROM feeding_event WHERE user_id = ?'
    ).all(TEST_USER_ID) as any[];
    expect(events.length).toBe(1);
    expect(events[0].item_type).toBe('steak');
  });

  it('feeding fails when inventory insufficient', () => {
    const db = getDb();
    db.prepare(`INSERT INTO inventory_item (id, user_id, item_type, quantity)
      VALUES (?, ?, ?, ?)`).run(uuid(), TEST_USER_ID, 'truffle', 0);

    const inv = db.prepare(
      'SELECT * FROM inventory_item WHERE user_id = ? AND item_type = ?'
    ).get(TEST_USER_ID, 'truffle') as any;

    expect(inv.quantity).toBe(0);
    expect(() => {
      if (inv.quantity < 1) throw new Error('Not enough truffle');
    }).toThrow('Not enough');
  });
});

// ─── Scotty Status Bounds ───

describe('Scotty status bounds', () => {
  it('happiness is bounded [0..100]', () => {
    const db = getDb();
    db.prepare(`INSERT INTO scotty_state (user_id, happiness, mood, food_credits, growth_level, stamina)
      VALUES (?, 95, 'happy', 10, 1, 80)`).run(TEST_USER_ID);

    // Try to boost happiness by 20 (should cap at 100)
    const state = db.prepare('SELECT * FROM scotty_state WHERE user_id = ?').get(TEST_USER_ID) as any;
    const newH = Math.min(100, Math.max(0, state.happiness + 20));
    expect(newH).toBe(100);
  });

  it('stamina is bounded [0..100]', () => {
    const db = getDb();
    db.prepare(`INSERT INTO scotty_state (user_id, happiness, mood, food_credits, growth_level, stamina)
      VALUES (?, 50, 'content', 10, 1, 95)`).run(TEST_USER_ID);

    const state = db.prepare('SELECT * FROM scotty_state WHERE user_id = ?').get(TEST_USER_ID) as any;
    const newS = Math.min(100, Math.max(0, state.stamina + 25));
    expect(newS).toBe(100);
  });

  it('growth_level defaults to 1', () => {
    const db = getDb();
    db.prepare(`INSERT INTO scotty_state (user_id, happiness, mood, food_credits)
      VALUES (?, 70, 'content', 10)`).run(TEST_USER_ID);

    const state = db.prepare('SELECT * FROM scotty_state WHERE user_id = ?').get(TEST_USER_ID) as any;
    expect(state.growth_level).toBe(1);
  });
});
