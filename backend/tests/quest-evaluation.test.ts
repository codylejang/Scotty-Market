import { describe, it, expect, beforeEach } from 'vitest';
import { v4 as uuid } from 'uuid';
import { createTestDb, getDb } from '../src/db/database';
import { ingestTransactions } from '../src/services/ingestion';
import { evaluateQuest } from '../src/services/quest-evaluation';
import {
  diningSpikesFixture,
  stoppedSubscriptionFixture,
  TEST_USER_ID,
} from './fixtures/transactions';

beforeEach(() => {
  createTestDb();
  const db = getDb();
  db.prepare(`INSERT INTO user_profile (id) VALUES (?)`).run(TEST_USER_ID);
  db.prepare(`INSERT INTO scotty_state (user_id, happiness, mood, food_credits) VALUES (?, 70, 'content', 10)`).run(TEST_USER_ID);
});

describe('Category Spend Cap Evaluation', () => {
  it('should mark quest as FAILED when spend exceeds cap', () => {
    const txns = diningSpikesFixture();
    ingestTransactions(txns);

    const db = getDb();
    const questId = uuid();
    const start = new Date();
    start.setDate(start.getDate() - 7);
    const end = new Date();

    db.prepare(`
      INSERT INTO quest (id, user_id, status, title, window_start, window_end, metric_type, metric_params, reward_food_type, happiness_delta)
      VALUES (?, ?, 'ACTIVE', 'Keep dining low', ?, ?, 'CATEGORY_SPEND_CAP', ?, 'bone', 5)
    `).run(
      questId, TEST_USER_ID,
      start.toISOString().split('T')[0],
      end.toISOString().split('T')[0],
      JSON.stringify({ category: 'Food & Drink', cap: 50 })
    );

    const result = evaluateQuest(questId);
    // Dining spike fixture has well over $50 in food spending
    expect(result.newStatus).toBe('FAILED');
    expect(result.confirmedValue).toBeGreaterThan(50);
    expect(result.rewardGranted).toBe(false);
  });

  it('should mark quest as COMPLETED_VERIFIED when under cap and window expired', () => {
    const db = getDb();
    const questId = uuid();

    // Use a past window with no transactions
    const start = '2020-01-01';
    const end = '2020-01-02';

    db.prepare(`
      INSERT INTO quest (id, user_id, status, title, window_start, window_end, metric_type, metric_params, reward_food_type, happiness_delta)
      VALUES (?, ?, 'ACTIVE', 'Low spend day', ?, ?, 'CATEGORY_SPEND_CAP', ?, 'steak', 10)
    `).run(
      questId, TEST_USER_ID, start, end,
      JSON.stringify({ category: 'Food & Drink', cap: 20 })
    );

    const result = evaluateQuest(questId);
    expect(result.newStatus).toBe('COMPLETED_VERIFIED');
    expect(result.confirmedValue).toBe(0);
    expect(result.rewardGranted).toBe(true);

    // Verify scotty state updated
    const scotty = db.prepare('SELECT * FROM scotty_state WHERE user_id = ?').get(TEST_USER_ID) as any;
    expect(scotty.happiness).toBe(80); // 70 + 10
    expect(scotty.last_reward_food).toBe('steak');
  });
});

describe('Merchant Spend Cap Evaluation', () => {
  it('should track spending at specific merchant', () => {
    const txns = diningSpikesFixture();
    ingestTransactions(txns);

    const db = getDb();
    const questId = uuid();
    const start = new Date();
    start.setDate(start.getDate() - 7);
    const end = new Date();

    db.prepare(`
      INSERT INTO quest (id, user_id, status, title, window_start, window_end, metric_type, metric_params, reward_food_type, happiness_delta)
      VALUES (?, ?, 'ACTIVE', 'No DoorDash week', ?, ?, 'MERCHANT_SPEND_CAP', ?, 'salmon', 8)
    `).run(
      questId, TEST_USER_ID,
      start.toISOString().split('T')[0],
      end.toISOString().split('T')[0],
      JSON.stringify({ merchant_key: 'DoorDash', cap: 20 })
    );

    const result = evaluateQuest(questId);
    // DoorDash appears on spike days at $45 each
    expect(result.confirmedValue).toBeGreaterThan(20);
    expect(result.newStatus).toBe('FAILED');
  });
});

describe('No Merchant Charge Evaluation', () => {
  it('should verify subscription cancellation by absence of charges', () => {
    const txns = stoppedSubscriptionFixture();
    ingestTransactions(txns);

    const db = getDb();
    const questId = uuid();

    // Window covers last 30 days (subscription stopped)
    const start = new Date();
    start.setDate(start.getDate() - 30);
    const end = new Date();
    end.setDate(end.getDate() - 1); // ended yesterday

    db.prepare(`
      INSERT INTO quest (id, user_id, status, title, window_start, window_end, metric_type, metric_params, reward_food_type, happiness_delta)
      VALUES (?, ?, 'ACTIVE', 'Verify gym cancellation', ?, ?, 'NO_MERCHANT_CHARGE', ?, 'truffle', 15)
    `).run(
      questId, TEST_USER_ID,
      start.toISOString().split('T')[0],
      end.toISOString().split('T')[0],
      JSON.stringify({ merchant_key: 'Planet Fitness' })
    );

    const result = evaluateQuest(questId);
    expect(result.newStatus).toBe('COMPLETED_VERIFIED');
    expect(result.confirmedValue).toBe(0); // No charges in window
    expect(result.rewardGranted).toBe(true);
  });
});

describe('Quest Progress Snapshots', () => {
  it('should create a snapshot on each evaluation', () => {
    const db = getDb();
    const questId = uuid();

    db.prepare(`
      INSERT INTO quest (id, user_id, status, title, window_start, window_end, metric_type, metric_params, reward_food_type, happiness_delta)
      VALUES (?, ?, 'ACTIVE', 'Test quest', '2020-01-01', '2020-01-02', 'CATEGORY_SPEND_CAP', ?, 'kibble', 3)
    `).run(questId, TEST_USER_ID, JSON.stringify({ category: 'Food & Drink', cap: 100 }));

    evaluateQuest(questId);
    evaluateQuest(questId);

    const snapshots = db.prepare(
      'SELECT * FROM quest_progress_snapshot WHERE quest_id = ?'
    ).all(questId);

    expect(snapshots.length).toBe(2);
  });
});
