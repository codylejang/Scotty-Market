import { v4 as uuid } from 'uuid';
import { getDb } from '../db/database';
import { Transaction } from '../schemas';

export interface IngestionResult {
  inserted: number;
  updated: number;
  pendingLinked: number;
}

/** Normalize merchant name to a stable key for grouping/dedup. */
export function normalizeMerchantKey(merchantName: string | null, name: string): string {
  const raw = (merchantName || name || '').toLowerCase().trim();
  // Remove trailing IDs, hashes, location suffixes (e.g., "STARBUCKS #1234 NYC" → "starbucks")
  return raw
    .replace(/\s*#\d+/g, '')
    .replace(/\s*\d{4,}/g, '')
    .replace(/\s+(llc|inc|corp|ltd)\.?$/i, '')
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Ingest a batch of transactions. Handles:
 * - Insert new transactions (by provider_txn_id uniqueness)
 * - Update pending->posted linking via pending_transaction_id
 * - Skip duplicates via provider_txn_id
 */
export function ingestTransactions(transactions: Transaction[]): IngestionResult {
  const db = getDb();
  let inserted = 0;
  let updated = 0;
  let pendingLinked = 0;

  const insertStmt = db.prepare(`
    INSERT OR IGNORE INTO transaction_
    (id, user_id, provider, provider_txn_id, date, amount, currency, name, merchant_name,
     category_primary, category_detailed, pending, pending_transaction_id, metadata, merchant_key)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const updatePendingStmt = db.prepare(`
    UPDATE transaction_ SET pending = 0, updated_at = datetime('now')
    WHERE provider_txn_id = ? AND user_id = ? AND pending = 1
  `);

  const checkExistsStmt = db.prepare(
    `SELECT id FROM transaction_ WHERE provider_txn_id = ?`
  );

  const ingestAll = db.transaction(() => {
    for (const txn of transactions) {
      // If this is a posted transaction that replaces a pending one
      if (!txn.pending && txn.pending_transaction_id) {
        const result = updatePendingStmt.run(txn.pending_transaction_id, txn.user_id);
        if (result.changes > 0) {
          pendingLinked++;
          updated += result.changes;
        }
      }

      // Check for duplicate
      const existing = checkExistsStmt.get(txn.provider_txn_id);
      if (existing) continue;

      const id = txn.id || uuid();
      const merchantKey = normalizeMerchantKey(txn.merchant_name, txn.name);
      const result = insertStmt.run(
        id, txn.user_id, txn.provider, txn.provider_txn_id,
        txn.date, txn.amount, txn.currency, txn.name,
        txn.merchant_name, txn.category_primary, txn.category_detailed,
        txn.pending ? 1 : 0, txn.pending_transaction_id,
        JSON.stringify(txn.metadata || {}), merchantKey
      );

      if (result.changes > 0) inserted++;
    }
  });

  ingestAll();
  return { inserted, updated, pendingLinked };
}

/**
 * Get transactions for a user within a date range.
 */
export function getTransactions(
  userId: string,
  start: string,
  end: string,
  options: { includePending?: boolean; category?: string; merchant?: string; merchant_key?: string } = {}
): Transaction[] {
  const db = getDb();
  let sql = `SELECT * FROM transaction_ WHERE user_id = ? AND date >= ? AND date <= ?`;
  const params: any[] = [userId, start, end];

  if (!options.includePending) {
    sql += ` AND pending = 0`;
  }
  if (options.category) {
    sql += ` AND category_primary = ?`;
    params.push(options.category);
  }
  if (options.merchant_key) {
    sql += ` AND LOWER(merchant_key) = LOWER(?)`;
    params.push(options.merchant_key);
  } else if (options.merchant) {
    sql += ` AND merchant_name = ?`;
    params.push(options.merchant);
  }

  sql += ` ORDER BY date DESC`;
  const rows = db.prepare(sql).all(...params) as any[];

  return rows.map(row => ({
    id: row.id,
    user_id: row.user_id,
    provider: row.provider,
    provider_txn_id: row.provider_txn_id,
    date: row.date,
    amount: row.amount,
    currency: row.currency,
    name: row.name,
    merchant_name: row.merchant_name,
    merchant_key: row.merchant_key || null,
    category_primary: row.category_primary,
    category_detailed: row.category_detailed,
    pending: !!row.pending,
    pending_transaction_id: row.pending_transaction_id,
    metadata: JSON.parse(row.metadata || '{}'),
  }));
}
