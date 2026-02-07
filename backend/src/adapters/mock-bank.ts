import { BankDataProvider } from './types';
import { Transaction, RecurringCandidate } from '../schemas';
import { getDb } from '../db/database';
import { ingestTransactions } from '../services/ingestion';
import {
  getTransactionHistory,
  mapNessieTransactionsToBackendTransactions,
} from '../services/nessie';

const NESSIE_PROVIDER = 'nessie';
const DEFAULT_INITIAL_LOOKBACK_DAYS = 120;
const DEFAULT_SYNC_INTERVAL_MINUTES = 30;
const DEFAULT_RESYNC_BUFFER_DAYS = 7;

type SyncStateRow = {
  cursor: string | null;
  last_sync_at: string | null;
  last_error: string | null;
};

function parsePositiveInt(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(value || '', 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return parsed;
}

function toDateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function getSyncState(userId: string): SyncStateRow | null {
  const db = getDb();
  const row = db
    .prepare(
      `
      SELECT cursor, last_sync_at, last_error
      FROM bank_sync_state
      WHERE user_id = ? AND provider = ?
      LIMIT 1
    `
    )
    .get(userId, NESSIE_PROVIDER) as SyncStateRow | undefined;

  return row || null;
}

function upsertSyncState(
  userId: string,
  cursor: string,
  lastSyncAt: string,
  lastError: string | null
): void {
  const db = getDb();
  db.prepare(
    `
      INSERT INTO bank_sync_state (user_id, provider, cursor, last_sync_at, last_error)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(user_id, provider) DO UPDATE SET
        cursor = excluded.cursor,
        last_sync_at = excluded.last_sync_at,
        last_error = excluded.last_error,
        updated_at = datetime('now')
    `
  ).run(userId, NESSIE_PROVIDER, cursor, lastSyncAt, lastError);
}

function getLatestStoredDate(userId: string): string | null {
  const db = getDb();
  const row = db
    .prepare(
      `
      SELECT MAX(date) AS latest_date
      FROM transaction_
      WHERE user_id = ? AND provider = ?
    `
    )
    .get(userId, NESSIE_PROVIDER) as { latest_date: string | null } | undefined;

  return row?.latest_date || null;
}

function subtractDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() - days);
  return next;
}

function computeSyncStart(userId: string, cursor?: string): Date {
  const now = new Date();
  const initialLookbackDays = parsePositiveInt(
    process.env.NESSIE_INITIAL_LOOKBACK_DAYS,
    DEFAULT_INITIAL_LOOKBACK_DAYS
  );
  const resyncBufferDays = parsePositiveInt(
    process.env.NESSIE_RESYNC_BUFFER_DAYS,
    DEFAULT_RESYNC_BUFFER_DAYS
  );

  const cursorDate = cursor ? new Date(cursor) : null;
  if (cursorDate && !Number.isNaN(cursorDate.getTime())) {
    return subtractDays(cursorDate, resyncBufferDays);
  }

  const latestStoredDate = getLatestStoredDate(userId);
  if (latestStoredDate) {
    const parsed = new Date(latestStoredDate);
    if (!Number.isNaN(parsed.getTime())) {
      return subtractDays(parsed, resyncBufferDays);
    }
  }

  return subtractDays(now, initialLookbackDays);
}

function isSyncDue(lastSyncAt: string | null): boolean {
  if (!lastSyncAt) return true;
  const parsed = new Date(lastSyncAt);
  if (Number.isNaN(parsed.getTime())) return true;

  const minIntervalMinutes = parsePositiveInt(
    process.env.NESSIE_SYNC_INTERVAL_MINUTES,
    DEFAULT_SYNC_INTERVAL_MINUTES
  );

  const elapsedMs = Date.now() - parsed.getTime();
  return elapsedMs >= minIntervalMinutes * 60 * 1000;
}

function rowToTransaction(row: any): Transaction {
  return {
    id: row.id,
    user_id: row.user_id,
    provider: row.provider,
    provider_txn_id: row.provider_txn_id,
    date: row.date,
    amount: row.amount,
    currency: row.currency,
    name: row.name,
    merchant_name: row.merchant_name,
    category_primary: row.category_primary,
    category_detailed: row.category_detailed,
    pending: !!row.pending,
    pending_transaction_id: row.pending_transaction_id,
    metadata: JSON.parse(row.metadata || '{}'),
  };
}

export class MockBankDataProvider implements BankDataProvider {
  async listTransactions(
    userId: string,
    start: string,
    end: string,
    includePending: boolean
  ): Promise<Transaction[]> {
    const db = getDb();
    let sql =
      `SELECT * FROM transaction_ WHERE user_id = ? AND provider = ? AND date >= ? AND date <= ?`;
    const params: any[] = [userId, NESSIE_PROVIDER, start, end];

    if (!includePending) {
      sql += ` AND pending = 0`;
    }

    sql += ` ORDER BY date DESC`;
    const rows = db.prepare(sql).all(...params) as any[];
    return rows.map(rowToTransaction);
  }

  async syncTransactions(
    userId: string,
    cursor?: string
  ): Promise<{ transactions: Transaction[]; cursor: string }> {
    const db = getDb();
    db.prepare('INSERT OR IGNORE INTO user_profile (id) VALUES (?)').run(userId);

    const state = getSyncState(userId);
    const forceSync = cursor === 'force';
    if (!forceSync && !isSyncDue(state?.last_sync_at || null)) {
      return {
        transactions: [],
        cursor: state?.cursor || toDateKey(new Date()),
      };
    }

    if (!process.env.NESSIE_API_KEY) {
      return {
        transactions: [],
        cursor: state?.cursor || toDateKey(new Date()),
      };
    }

    const startDate = computeSyncStart(userId, forceSync ? undefined : state?.cursor || undefined);
    const endDate = new Date();

    try {
      const nessieTransactions = await getTransactionHistory(startDate, endDate);
      const mapped = mapNessieTransactionsToBackendTransactions(userId, nessieTransactions);
      db.prepare(`DELETE FROM transaction_ WHERE user_id = ? AND provider <> ?`).run(
        userId,
        NESSIE_PROVIDER
      );
      ingestTransactions(mapped);

      const latestDate = mapped.reduce<string>((latest, tx) => {
        if (!latest) return tx.date;
        return tx.date > latest ? tx.date : latest;
      }, state?.cursor || '');

      const nextCursor = latestDate || toDateKey(endDate);
      upsertSyncState(userId, nextCursor, endDate.toISOString(), null);

      return {
        transactions: mapped,
        cursor: nextCursor,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      upsertSyncState(userId, state?.cursor || toDateKey(endDate), endDate.toISOString(), message);
      throw error;
    }
  }

  async listRecurringCandidates(
    userId: string,
    _lookbackDays: number
  ): Promise<RecurringCandidate[]> {
    const db = getDb();
    const rows = db
      .prepare('SELECT * FROM recurring_candidate WHERE user_id = ?')
      .all(userId) as any[];

    return rows.map((r) => ({
      id: r.id,
      user_id: r.user_id,
      merchant_key: r.merchant_key,
      typical_amount: r.typical_amount,
      cadence: r.cadence,
      next_expected_date: r.next_expected_date,
      confidence: r.confidence,
      source: JSON.parse(r.source || '{}'),
    }));
  }
}
