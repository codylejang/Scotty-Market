import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDb, getDb } from '../src/db/database';
import { ingestTransactions } from '../src/services/ingestion';
import {
  searchTransactions,
  getTransactionById,
  listTransactionStats,
  detectAnomalies,
} from '../src/services/retrieval';
import {
  diningSpikesFixture,
  edgeCaseFixture,
  TEST_USER_ID,
} from './fixtures/transactions';
import { v4 as uuid } from 'uuid';

beforeEach(() => {
  createTestDb();
  const db = getDb();
  db.prepare(`INSERT INTO user_profile (id) VALUES (?)`).run(TEST_USER_ID);
});

// ─── Fixtures ───

function duplicateChargeFixture() {
  const today = new Date().toISOString().split('T')[0];
  return [
    {
      id: 'dup1', user_id: TEST_USER_ID, provider: 'plaid',
      provider_txn_id: `dup_1_${uuid()}`, date: today,
      amount: -42.50, currency: 'USD', name: 'Starbucks #1234 NYC',
      merchant_name: 'Starbucks', category_primary: 'Food & Drink',
      category_detailed: null, pending: false,
      pending_transaction_id: null, metadata: {},
    },
    {
      id: 'dup2', user_id: TEST_USER_ID, provider: 'plaid',
      provider_txn_id: `dup_2_${uuid()}`, date: today,
      amount: -42.50, currency: 'USD', name: 'Starbucks #1234 NYC',
      merchant_name: 'Starbucks', category_primary: 'Food & Drink',
      category_detailed: null, pending: false,
      pending_transaction_id: null, metadata: {},
    },
  ];
}

/** 90 days of baseline + recent spending for anomaly detection. */
function baselineFixture() {
  const txns: any[] = [];
  // 90 days of normal dining: ~$15/day
  for (let d = 120; d >= 31; d--) {
    const date = new Date();
    date.setDate(date.getDate() - d);
    txns.push({
      id: uuid(), user_id: TEST_USER_ID, provider: 'plaid',
      provider_txn_id: `baseline_${d}_${uuid()}`,
      date: date.toISOString().split('T')[0],
      amount: -(12 + Math.random() * 6), // $12-$18
      currency: 'USD', name: 'Chipotle',
      merchant_name: 'Chipotle', category_primary: 'Food & Drink',
      category_detailed: 'Restaurants', pending: false,
      pending_transaction_id: null, metadata: {},
    });
  }
  // Recent: a big spike charge
  const today = new Date().toISOString().split('T')[0];
  txns.push({
    id: 'spike-txn', user_id: TEST_USER_ID, provider: 'plaid',
    provider_txn_id: `spike_${uuid()}`, date: today,
    amount: -250.00, currency: 'USD', name: 'Fancy Restaurant',
    merchant_name: 'Fancy Restaurant', category_primary: 'Food & Drink',
    category_detailed: 'Restaurants', pending: false,
    pending_transaction_id: null, metadata: {},
  });
  // Recent: a large refund
  txns.push({
    id: 'big-refund', user_id: TEST_USER_ID, provider: 'plaid',
    provider_txn_id: `refund_${uuid()}`, date: today,
    amount: 150.00, currency: 'USD', name: 'Department Store Refund',
    merchant_name: 'Department Store', category_primary: 'Shopping',
    category_detailed: null, pending: false,
    pending_transaction_id: null, metadata: {},
  });
  return txns;
}

// ─── search_transactions ───

describe('search_transactions', () => {
  it('should search by amount range', () => {
    const txns = diningSpikesFixture();
    ingestTransactions(txns);

    const result = searchTransactions({
      user_id: TEST_USER_ID,
      amount_min: -50,
      amount_max: -40,
    });

    // Should find the $45 DoorDash charges
    expect(result.transactions.length).toBeGreaterThan(0);
    result.transactions.forEach(t => {
      expect(Math.abs(t.amount)).toBeGreaterThanOrEqual(40);
      expect(Math.abs(t.amount)).toBeLessThanOrEqual(50);
    });
  });

  it('should search by merchant text', () => {
    const txns = diningSpikesFixture();
    ingestTransactions(txns);

    const result = searchTransactions({
      user_id: TEST_USER_ID,
      query_text: 'chipotle',
    });

    expect(result.transactions.length).toBe(7); // 1 per day for 7 days
    result.transactions.forEach(t => {
      expect(t.name.toLowerCase()).toContain('chipotle');
    });
  });

  it('should search by date range', () => {
    const txns = diningSpikesFixture();
    ingestTransactions(txns);

    const now = new Date();
    const d3 = new Date(now);
    d3.setDate(d3.getDate() - 3);

    const result = searchTransactions({
      user_id: TEST_USER_ID,
      date_start: d3.toISOString().split('T')[0],
      date_end: now.toISOString().split('T')[0],
    });

    // Should only include last 3 days
    result.transactions.forEach(t => {
      expect(new Date(t.date).getTime()).toBeGreaterThanOrEqual(d3.getTime() - 86400000);
    });
  });

  it('should paginate results', () => {
    const txns = diningSpikesFixture();
    ingestTransactions(txns);

    const page1 = searchTransactions({
      user_id: TEST_USER_ID,
      limit: 3,
      offset: 0,
    });
    expect(page1.transactions.length).toBe(3);
    expect(page1.next_offset).toBe(3);

    const page2 = searchTransactions({
      user_id: TEST_USER_ID,
      limit: 3,
      offset: 3,
    });
    expect(page2.transactions.length).toBe(3);
    // IDs should not overlap
    const ids1 = new Set(page1.transactions.map(t => t.id));
    page2.transactions.forEach(t => expect(ids1.has(t.id)).toBe(false));
  });

  it('should return correct summary', () => {
    const txns = edgeCaseFixture();
    ingestTransactions(txns);

    const result = searchTransactions({
      user_id: TEST_USER_ID,
      date_start: new Date(Date.now() - 3 * 86400000).toISOString().split('T')[0],
      date_end: new Date().toISOString().split('T')[0],
    });

    expect(result.summary.count).toBe(4);
    expect(result.summary.min).toBeLessThan(0);
    expect(result.summary.max).toBeGreaterThan(0);
  });

  it('should enforce user_id scoping (no cross-user leaks)', () => {
    const txns = diningSpikesFixture();
    ingestTransactions(txns);

    const result = searchTransactions({
      user_id: 'nonexistent-user',
    });
    expect(result.transactions.length).toBe(0);
    expect(result.summary.count).toBe(0);
  });
});

// ─── get_transaction_by_id ───

describe('get_transaction_by_id', () => {
  it('should return full transaction details', () => {
    const txns = edgeCaseFixture();
    ingestTransactions(txns);

    const detail = getTransactionById(TEST_USER_ID, txns[0].id);
    expect(detail).not.toBeNull();
    expect(detail!.id).toBe(txns[0].id);
    expect(detail!.merchant_key).toBeDefined();
    expect(detail!.metadata).toBeDefined();
  });

  it('should return null for other users transaction', () => {
    const txns = edgeCaseFixture();
    ingestTransactions(txns);

    const detail = getTransactionById('wrong-user', txns[0].id);
    expect(detail).toBeNull();
  });
});

// ─── list_transaction_stats ───

describe('list_transaction_stats', () => {
  it('should group by category', () => {
    const txns = diningSpikesFixture();
    ingestTransactions(txns);

    const now = new Date();
    const d10 = new Date(now); d10.setDate(d10.getDate() - 10);

    const result = listTransactionStats({
      user_id: TEST_USER_ID,
      date_start: d10.toISOString().split('T')[0],
      date_end: now.toISOString().split('T')[0],
      group_by: 'category',
    });

    expect(result.rows.length).toBeGreaterThan(0);
    const foodRow = result.rows.find(r => r.group_key === 'Food & Drink');
    expect(foodRow).toBeDefined();
    expect(foodRow!.total_spend).toBeGreaterThan(0);
    expect(foodRow!.count).toBeGreaterThan(0);
  });

  it('should group by merchant', () => {
    const txns = diningSpikesFixture();
    ingestTransactions(txns);

    const now = new Date();
    const d10 = new Date(now); d10.setDate(d10.getDate() - 10);

    const result = listTransactionStats({
      user_id: TEST_USER_ID,
      date_start: d10.toISOString().split('T')[0],
      date_end: now.toISOString().split('T')[0],
      group_by: 'merchant',
    });

    expect(result.rows.length).toBeGreaterThan(0);
    // Should have chipotle, doordash, uber eats
    const merchants = result.rows.map(r => r.group_key);
    expect(merchants.some(m => m.includes('chipotle'))).toBe(true);
  });

  it('should compute correct overall totals', () => {
    const txns = diningSpikesFixture();
    ingestTransactions(txns);

    const now = new Date();
    const d10 = new Date(now); d10.setDate(d10.getDate() - 10);

    const result = listTransactionStats({
      user_id: TEST_USER_ID,
      date_start: d10.toISOString().split('T')[0],
      date_end: now.toISOString().split('T')[0],
      group_by: 'category',
    });

    expect(result.overall.total_count).toBeGreaterThan(0);
    expect(result.overall.total_spend).toBeGreaterThan(0);
  });
});

// ─── detect_anomalies ───

describe('detect_anomalies', () => {
  it('should detect large_vs_baseline anomaly', () => {
    const txns = baselineFixture();
    ingestTransactions(txns);

    const result = detectAnomalies({
      user_id: TEST_USER_ID,
      anomaly_types: ['large_vs_baseline'],
      sensitivity: 'med',
    });

    // The $250 spike should be detected
    const largeAnomaly = result.anomalies.find(
      a => a.type === 'large_vs_baseline' && a.transaction_ids.includes('spike-txn')
    );
    expect(largeAnomaly).toBeDefined();
    expect(largeAnomaly!.severity_score).toBeGreaterThan(0);
    expect(largeAnomaly!.explanation_short).toContain('$250');
  });

  it('should detect duplicate charges', () => {
    const txns = duplicateChargeFixture();
    ingestTransactions(txns);

    const result = detectAnomalies({
      user_id: TEST_USER_ID,
      anomaly_types: ['duplicate_charge'],
      sensitivity: 'high', // wide window
    });

    expect(result.anomalies.length).toBeGreaterThanOrEqual(1);
    const dup = result.anomalies[0];
    expect(dup.type).toBe('duplicate_charge');
    expect(dup.transaction_ids.length).toBe(2);
    expect(dup.explanation_short).toContain('42.50');
  });

  it('should detect new merchants', () => {
    const txns = baselineFixture();
    ingestTransactions(txns);

    const result = detectAnomalies({
      user_id: TEST_USER_ID,
      anomaly_types: ['new_merchant'],
    });

    // "Fancy Restaurant" has no baseline history
    const newMerchant = result.anomalies.find(a => a.type === 'new_merchant');
    expect(newMerchant).toBeDefined();
    expect(newMerchant!.explanation_short.toLowerCase()).toContain('fancy restaurant');
  });

  it('should respect sensitivity levels', () => {
    const txns = baselineFixture();
    ingestTransactions(txns);

    const highSens = detectAnomalies({
      user_id: TEST_USER_ID,
      anomaly_types: ['large_vs_baseline'],
      sensitivity: 'high',
    });
    const lowSens = detectAnomalies({
      user_id: TEST_USER_ID,
      anomaly_types: ['large_vs_baseline'],
      sensitivity: 'low',
    });

    // High sensitivity should find more (or equal) anomalies
    expect(highSens.anomalies.length).toBeGreaterThanOrEqual(lowSens.anomalies.length);
  });

  it('should not leak data across users', () => {
    const txns = baselineFixture();
    ingestTransactions(txns);

    const result = detectAnomalies({
      user_id: 'other-user',
      anomaly_types: ['large_vs_baseline', 'new_merchant', 'duplicate_charge'],
    });

    expect(result.anomalies.length).toBe(0);
  });
});

// ─── merchant_key normalization ───

describe('merchant_key normalization', () => {
  it('should normalize merchant names consistently', () => {
    const txns = [
      {
        id: uuid(), user_id: TEST_USER_ID, provider: 'plaid',
        provider_txn_id: `mk1_${uuid()}`,
        date: new Date().toISOString().split('T')[0],
        amount: -10, currency: 'USD',
        name: 'STARBUCKS #1234', merchant_name: 'Starbucks #1234',
        category_primary: 'Food & Drink', category_detailed: null,
        pending: false, pending_transaction_id: null, metadata: {},
      },
      {
        id: uuid(), user_id: TEST_USER_ID, provider: 'plaid',
        provider_txn_id: `mk2_${uuid()}`,
        date: new Date().toISOString().split('T')[0],
        amount: -12, currency: 'USD',
        name: 'Starbucks #5678', merchant_name: 'Starbucks #5678',
        category_primary: 'Food & Drink', category_detailed: null,
        pending: false, pending_transaction_id: null, metadata: {},
      },
    ];

    ingestTransactions(txns);

    const db = getDb();
    const rows = db.prepare(
      'SELECT merchant_key FROM transaction_ WHERE user_id = ? AND merchant_key LIKE ?'
    ).all(TEST_USER_ID, '%starbucks%') as any[];

    expect(rows.length).toBe(2);
    // Both should normalize to the same key
    expect(rows[0].merchant_key).toBe(rows[1].merchant_key);
  });
});
