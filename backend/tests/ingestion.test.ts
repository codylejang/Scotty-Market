import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDb, getDb } from '../src/db/database';
import { ingestTransactions, getTransactions } from '../src/services/ingestion';
import {
  diningSpikesFixture,
  pendingToPostedSubscription,
  edgeCaseFixture,
  TEST_USER_ID,
} from './fixtures/transactions';

beforeEach(() => {
  createTestDb();
  const db = getDb();
  db.prepare(`INSERT INTO user_profile (id) VALUES (?)`).run(TEST_USER_ID);
});

describe('Transaction Ingestion', () => {
  it('should ingest transactions and report correct counts', () => {
    const txns = diningSpikesFixture();
    const result = ingestTransactions(txns);

    expect(result.inserted).toBe(txns.length);
    expect(result.pendingLinked).toBe(0);
  });

  it('should skip duplicate transactions by provider_txn_id', () => {
    const txns = diningSpikesFixture();
    ingestTransactions(txns);

    const result2 = ingestTransactions(txns);
    expect(result2.inserted).toBe(0);
  });

  it('should link pending to posted via pending_transaction_id', () => {
    const { pending, posted } = pendingToPostedSubscription();

    // Ingest pending first
    ingestTransactions([pending]);

    const db = getDb();
    const pendingRow = db.prepare(
      `SELECT * FROM transaction_ WHERE provider_txn_id = ?`
    ).get(pending.provider_txn_id!) as any;
    expect(pendingRow.pending).toBe(1);

    // Ingest posted (should link and mark pending as posted)
    const result = ingestTransactions([posted]);
    expect(result.pendingLinked).toBe(1);

    const updatedPending = db.prepare(
      `SELECT * FROM transaction_ WHERE provider_txn_id = ?`
    ).get(pending.provider_txn_id!) as any;
    expect(updatedPending.pending).toBe(0);
  });

  it('should handle edge cases: refunds, small charges, pending', () => {
    const txns = edgeCaseFixture();
    const result = ingestTransactions(txns);
    expect(result.inserted).toBe(txns.length);

    const today = new Date().toISOString().split('T')[0];
    const startDate = new Date(Date.now() - 2 * 86400000).toISOString().split('T')[0];

    // Without pending
    const posted = getTransactions(TEST_USER_ID, startDate, today, { includePending: false });
    expect(posted.length).toBe(3); // refund + small + large

    // With pending
    const all = getTransactions(TEST_USER_ID, startDate, today, { includePending: true });
    expect(all.length).toBe(4);

    // Verify refund has positive amount
    const refund = all.find(t => t.name === 'Amazon Refund');
    expect(refund).toBeDefined();
    expect(refund!.amount).toBe(25.00);
  });
});
