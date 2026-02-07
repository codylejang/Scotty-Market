import { v4 as uuid } from 'uuid';
import { BankDataProvider } from './types';
import { Transaction, RecurringCandidate } from '../schemas';
import { getDb } from '../db/database';

const MERCHANTS: Record<string, { category_primary: string; category_detailed: string }> = {
  'Chipotle': { category_primary: 'Food & Drink', category_detailed: 'Restaurants' },
  'Starbucks': { category_primary: 'Food & Drink', category_detailed: 'Coffee Shops' },
  'Uber Eats': { category_primary: 'Food & Drink', category_detailed: 'Delivery' },
  'DoorDash': { category_primary: 'Food & Drink', category_detailed: 'Delivery' },
  'Trader Joes': { category_primary: 'Food & Drink', category_detailed: 'Groceries' },
  'Whole Foods': { category_primary: 'Food & Drink', category_detailed: 'Groceries' },
  'Target': { category_primary: 'Shopping', category_detailed: 'General Merchandise' },
  'Amazon': { category_primary: 'Shopping', category_detailed: 'Online' },
  'Uber': { category_primary: 'Transportation', category_detailed: 'Rideshare' },
  'Shell Gas': { category_primary: 'Transportation', category_detailed: 'Gas Stations' },
  'Netflix': { category_primary: 'Entertainment', category_detailed: 'Streaming' },
  'Spotify': { category_primary: 'Entertainment', category_detailed: 'Streaming' },
  'Apple.com': { category_primary: 'Technology', category_detailed: 'Software' },
  'Steam': { category_primary: 'Entertainment', category_detailed: 'Games' },
  'Venmo Transfer': { category_primary: 'Transfer', category_detailed: 'Peer to Peer' },
  'ATM Withdrawal': { category_primary: 'Transfer', category_detailed: 'ATM' },
};

function randomAmount(min: number, max: number): number {
  return Math.round((Math.random() * (max - min) + min) * 100) / 100;
}

function randomMerchant(): string {
  const keys = Object.keys(MERCHANTS);
  return keys[Math.floor(Math.random() * keys.length)];
}

export class MockBankDataProvider implements BankDataProvider {
  async listTransactions(
    userId: string,
    start: string,
    end: string,
    includePending: boolean
  ): Promise<Transaction[]> {
    const db = getDb();
    let sql = `SELECT * FROM transaction_ WHERE user_id = ? AND date >= ? AND date <= ?`;
    const params: any[] = [userId, start, end];
    if (!includePending) {
      sql += ` AND pending = 0`;
    }
    sql += ` ORDER BY date DESC`;
    const rows = db.prepare(sql).all(...params) as any[];
    return rows.map(rowToTransaction);
  }

  async syncTransactions(
    userId: string,
    _cursor?: string
  ): Promise<{ transactions: Transaction[]; cursor: string }> {
    const txns = generateMockTransactions(userId, 3);
    const db = getDb();
    const insert = db.prepare(`
      INSERT OR IGNORE INTO transaction_ (id, user_id, provider, provider_txn_id, date, amount, currency, name, merchant_name, category_primary, category_detailed, pending, pending_transaction_id, metadata)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const t of txns) {
      insert.run(
        t.id, t.user_id, t.provider, t.provider_txn_id, t.date,
        t.amount, t.currency, t.name, t.merchant_name,
        t.category_primary, t.category_detailed,
        t.pending ? 1 : 0, t.pending_transaction_id,
        JSON.stringify(t.metadata)
      );
    }

    return { transactions: txns, cursor: `cursor_${Date.now()}` };
  }

  async listRecurringCandidates(
    userId: string,
    _lookbackDays: number
  ): Promise<RecurringCandidate[]> {
    const db = getDb();
    const rows = db.prepare('SELECT * FROM recurring_candidate WHERE user_id = ?').all(userId) as any[];
    return rows.map(r => ({
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

export function generateMockTransactions(userId: string, days: number): Transaction[] {
  const txns: Transaction[] = [];
  const now = new Date();

  for (let d = 0; d < days; d++) {
    const date = new Date(now);
    date.setDate(date.getDate() - d);
    const dateStr = date.toISOString().split('T')[0];
    const txnCount = Math.floor(Math.random() * 4) + 2;

    for (let t = 0; t < txnCount; t++) {
      const merchant = randomMerchant();
      const info = MERCHANTS[merchant];
      const isPending = d === 0 && Math.random() > 0.5;

      txns.push({
        id: uuid(),
        user_id: userId,
        provider: 'plaid',
        provider_txn_id: `mock_${uuid()}`,
        date: dateStr,
        amount: -randomAmount(3, 65),
        currency: 'USD',
        name: merchant,
        merchant_name: merchant,
        category_primary: info.category_primary,
        category_detailed: info.category_detailed,
        pending: isPending,
        pending_transaction_id: null,
        metadata: {},
      });
    }
  }

  return txns;
}
