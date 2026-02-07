import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDb, getDb } from '../src/db/database';
import { ingestTransactions } from '../src/services/ingestion';
import { createAdapters } from '../src/adapters';
import { AgentRunner, MockLLMProvider } from '../src/agents/runner';
import { Orchestrator } from '../src/orchestrator';
import { diningSpikesFixture, TEST_USER_ID } from './fixtures/transactions';
import { seedDefaultBudgets } from '../src/adapters/mock-budget';

beforeEach(() => {
  createTestDb();
  const db = getDb();
  db.prepare(`INSERT INTO user_profile (id) VALUES (?)`).run(TEST_USER_ID);
  db.prepare(`INSERT INTO scotty_state (user_id, happiness, mood, food_credits) VALUES (?, 70, 'content', 10)`).run(TEST_USER_ID);
  seedDefaultBudgets(TEST_USER_ID);
});

describe('Daily Digest', () => {
  it('should generate insights with correct count constraints (1-3)', async () => {
    const txns = diningSpikesFixture();
    ingestTransactions(txns);

    const adapters = createAdapters();
    const runner = new AgentRunner({ adapters, llmProvider: new MockLLMProvider() });
    const { output } = await runner.generateDailyPayload(TEST_USER_ID);

    expect(output.insights.length).toBeGreaterThanOrEqual(1);
    expect(output.insights.length).toBeLessThanOrEqual(3);

    for (const insight of output.insights) {
      expect(insight.title.length).toBeLessThanOrEqual(80);
      expect(insight.blurb.length).toBeLessThanOrEqual(280);
      expect(['HIGH', 'MEDIUM', 'LOW']).toContain(insight.confidence);
    }
  });

  it('should generate a quest when no active quest exists', async () => {
    const txns = diningSpikesFixture();
    ingestTransactions(txns);

    const adapters = createAdapters();
    const runner = new AgentRunner({ adapters, llmProvider: new MockLLMProvider() });
    const { output } = await runner.generateDailyPayload(TEST_USER_ID);

    expect(output.quest).not.toBeNull();
    if (output.quest) {
      expect(['CATEGORY_SPEND_CAP', 'MERCHANT_SPEND_CAP', 'NO_MERCHANT_CHARGE', 'TRANSFER_AMOUNT'])
        .toContain(output.quest.metric_type);
      expect(output.quest.happiness_delta).toBeGreaterThanOrEqual(1);
      expect(output.quest.happiness_delta).toBeLessThanOrEqual(20);
      expect(['kibble', 'bone', 'steak', 'salmon', 'truffle']).toContain(output.quest.reward_food_type);
    }
  });

  it('should NOT generate a quest when one is already active', async () => {
    const txns = diningSpikesFixture();
    ingestTransactions(txns);

    const db = getDb();
    const today = new Date().toISOString().split('T')[0];
    const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];

    db.prepare(`
      INSERT INTO quest (id, user_id, status, title, window_start, window_end, metric_type, metric_params, reward_food_type, happiness_delta)
      VALUES ('existing-quest', ?, 'ACTIVE', 'Existing quest', ?, ?, 'CATEGORY_SPEND_CAP', '{"category":"Food & Drink","cap":50}', 'bone', 5)
    `).run(TEST_USER_ID, today, tomorrow);

    const adapters = createAdapters();
    const runner = new AgentRunner({ adapters, llmProvider: new MockLLMProvider() });
    const { output } = await runner.generateDailyPayload(TEST_USER_ID);

    expect(output.quest).toBeNull();
  });

  it('should log the agent decision', async () => {
    const txns = diningSpikesFixture();
    ingestTransactions(txns);

    const adapters = createAdapters();
    const runner = new AgentRunner({ adapters, llmProvider: new MockLLMProvider() });
    const { logId } = await runner.generateDailyPayload(TEST_USER_ID);

    const db = getDb();
    const log = db.prepare('SELECT * FROM agent_decision_log WHERE id = ?').get(logId) as any;
    expect(log).toBeDefined();
    expect(log.trigger).toBe('DAILY_DIGEST');
    expect(JSON.parse(log.input_summary)).toHaveProperty('summary7d_total');
  });
});

describe('Orchestrator Idempotency', () => {
  it('should not double-process daily digest for same user/date', async () => {
    const txns = diningSpikesFixture();
    ingestTransactions(txns);

    const adapters = createAdapters();
    const runner = new AgentRunner({ adapters, llmProvider: new MockLLMProvider() });
    const orchestrator = new Orchestrator(adapters, runner);

    const result1 = await orchestrator.runDailyDigest(TEST_USER_ID);
    expect(result1.success).toBe(true);

    const result2 = await orchestrator.runDailyDigest(TEST_USER_ID);
    expect(result2.success).toBe(true);
    expect(result2.idempotencyKey).toBe(result1.idempotencyKey);

    // Should only have one set of insights
    const db = getDb();
    const today = new Date().toISOString().split('T')[0];
    const insights = db.prepare(
      'SELECT * FROM insight WHERE user_id = ? AND date = ?'
    ).all(TEST_USER_ID, today);

    // First run created insights; second run was idempotent
    expect(insights.length).toBeGreaterThanOrEqual(1);
    expect(insights.length).toBeLessThanOrEqual(3);
  });
});

describe('Schema Validation', () => {
  it('should validate insight output schema', async () => {
    const txns = diningSpikesFixture();
    ingestTransactions(txns);

    const adapters = createAdapters();
    const runner = new AgentRunner({ adapters, llmProvider: new MockLLMProvider() });
    const { output } = await runner.generateDailyPayload(TEST_USER_ID);

    for (const insight of output.insights) {
      expect(typeof insight.title).toBe('string');
      expect(typeof insight.blurb).toBe('string');
      expect(typeof insight.confidence).toBe('string');
      expect(typeof insight.metrics).toBe('object');
    }
  });
});
