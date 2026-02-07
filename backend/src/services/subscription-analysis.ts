import { v4 as uuid } from 'uuid';
import { getDb } from '../db/database';
import { getTransactions } from './ingestion';
import { RecurringCandidate } from '../schemas';

interface MerchantHistory {
  merchant: string;
  amounts: number[];
  dates: string[];
}

/**
 * Detect recurring/subscription charges from transaction history.
 * Looks for merchants with repeated similar-amount charges at regular intervals.
 */
export function detectRecurringCandidates(userId: string, lookbackDays = 90): RecurringCandidate[] {
  const now = new Date();
  const start = new Date(now);
  start.setDate(start.getDate() - lookbackDays);

  const txns = getTransactions(
    userId,
    start.toISOString().split('T')[0],
    now.toISOString().split('T')[0],
    { includePending: false }
  );

  // Group by merchant
  const byMerchant = new Map<string, MerchantHistory>();
  for (const txn of txns) {
    if (txn.amount >= 0) continue; // skip income/refunds
    const key = (txn.merchant_name || txn.name).toLowerCase().trim();
    if (!byMerchant.has(key)) {
      byMerchant.set(key, { merchant: txn.merchant_name || txn.name, amounts: [], dates: [] });
    }
    const entry = byMerchant.get(key)!;
    entry.amounts.push(Math.abs(txn.amount));
    entry.dates.push(txn.date);
  }

  const candidates: RecurringCandidate[] = [];

  for (const [key, history] of byMerchant) {
    if (history.dates.length < 2) continue;

    // Check amount consistency (coefficient of variation < 0.15)
    const avg = history.amounts.reduce((a, b) => a + b, 0) / history.amounts.length;
    const variance = history.amounts.reduce((s, a) => s + (a - avg) ** 2, 0) / history.amounts.length;
    const cv = Math.sqrt(variance) / avg;
    if (cv > 0.15 && avg > 5) continue; // amounts too variable unless very small

    // Check date regularity
    const sortedDates = [...history.dates].sort();
    const intervals: number[] = [];
    for (let i = 1; i < sortedDates.length; i++) {
      const d1 = new Date(sortedDates[i - 1]);
      const d2 = new Date(sortedDates[i]);
      intervals.push(Math.round((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24)));
    }

    if (intervals.length === 0) continue;
    const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;

    let cadence: 'weekly' | 'monthly' | 'annual' | 'unknown' = 'unknown';
    let confidence = 0.3;

    if (avgInterval >= 5 && avgInterval <= 10) {
      cadence = 'weekly';
      confidence = 0.7;
    } else if (avgInterval >= 25 && avgInterval <= 35) {
      cadence = 'monthly';
      confidence = 0.8;
    } else if (avgInterval >= 350 && avgInterval <= 380) {
      cadence = 'annual';
      confidence = 0.6;
    }

    if (cadence === 'unknown') continue;

    // Boost confidence if amounts are very consistent
    if (cv < 0.02) confidence = Math.min(confidence + 0.15, 1.0);

    // Estimate next charge
    const lastDate = new Date(sortedDates[sortedDates.length - 1]);
    const nextDate = new Date(lastDate);
    if (cadence === 'weekly') nextDate.setDate(nextDate.getDate() + 7);
    else if (cadence === 'monthly') nextDate.setMonth(nextDate.getMonth() + 1);
    else if (cadence === 'annual') nextDate.setFullYear(nextDate.getFullYear() + 1);

    candidates.push({
      id: uuid(),
      user_id: userId,
      merchant_key: key,
      typical_amount: Math.round(avg * 100) / 100,
      cadence,
      next_expected_date: nextDate.toISOString().split('T')[0],
      confidence: Math.round(confidence * 100) / 100,
      source: {
        transaction_count: history.dates.length,
        avg_interval_days: Math.round(avgInterval),
        amount_cv: Math.round(cv * 1000) / 1000,
      },
    });
  }

  return candidates;
}

/**
 * Upsert recurring candidates into the database.
 */
export function upsertRecurringCandidates(candidates: RecurringCandidate[]): number {
  const db = getDb();
  const upsert = db.prepare(`
    INSERT INTO recurring_candidate (id, user_id, merchant_key, typical_amount, cadence, next_expected_date, confidence, source)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      typical_amount = excluded.typical_amount,
      cadence = excluded.cadence,
      next_expected_date = excluded.next_expected_date,
      confidence = excluded.confidence,
      source = excluded.source,
      updated_at = datetime('now')
  `);

  let count = 0;
  const txn = db.transaction(() => {
    for (const c of candidates) {
      upsert.run(c.id, c.user_id, c.merchant_key, c.typical_amount, c.cadence, c.next_expected_date, c.confidence, JSON.stringify(c.source));
      count++;
    }
  });
  txn();
  return count;
}

/**
 * Advance a stale next_expected_date forward to the current or next occurrence.
 * If the date is in the past, roll it forward by the cadence interval until it's today or in the future.
 */
function advanceToUpcoming(dateStr: string, cadence: string): string {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(dateStr + 'T00:00:00');

  while (d < today) {
    if (cadence === 'weekly') d.setDate(d.getDate() + 7);
    else if (cadence === 'monthly') d.setMonth(d.getMonth() + 1);
    else if (cadence === 'annual') d.setFullYear(d.getFullYear() + 1);
    else break;
  }

  return d.toISOString().split('T')[0];
}

/**
 * Get upcoming subscription charges for a user.
 */
export function getUpcomingSubscriptions(userId: string, daysAhead = 30): RecurringCandidate[] {
  const db = getDb();
  const futureDate = new Date();
  futureDate.setDate(futureDate.getDate() + daysAhead);
  const futureDateStr = futureDate.toISOString().split('T')[0];

  const rows = db.prepare(`
    SELECT * FROM recurring_candidate
    WHERE user_id = ? AND next_expected_date IS NOT NULL
    ORDER BY next_expected_date ASC
  `).all(userId) as any[];

  return rows
    .map(r => {
      const advanced = advanceToUpcoming(r.next_expected_date, r.cadence);
      return {
        id: r.id,
        user_id: r.user_id,
        merchant_key: r.merchant_key,
        typical_amount: r.typical_amount,
        cadence: r.cadence,
        next_expected_date: advanced,
        confidence: r.confidence,
        source: JSON.parse(r.source || '{}'),
      };
    })
    .filter(r => r.next_expected_date <= futureDateStr);
}
