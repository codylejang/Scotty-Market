import { getDb } from '../db/database';
import { normalizeMerchantKey } from './ingestion';

// ─── Types ───

export interface SearchTransactionsInput {
  user_id: string;
  query_text?: string;
  date_start?: string;
  date_end?: string;
  amount_min?: number;
  amount_max?: number;
  categories?: string[];
  merchant_keys?: string[];
  pending?: boolean;
  sort_by?: 'date' | 'amount' | 'relevance';
  limit?: number;
  offset?: number;
}

export interface TransactionResult {
  id: string;
  date: string;
  amount: number;
  merchant_name: string | null;
  merchant_key: string | null;
  name: string;
  category_primary: string | null;
  pending: boolean;
  currency: string;
}

export interface SearchTransactionsOutput {
  transactions: TransactionResult[];
  next_offset: number | null;
  summary: {
    count: number;
    total: number;
    min: number;
    max: number;
  };
}

export interface TransactionDetail extends TransactionResult {
  user_id: string;
  provider: string;
  provider_txn_id: string | null;
  category_detailed: string | null;
  pending_transaction_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface StatsInput {
  user_id: string;
  date_start: string;
  date_end: string;
  group_by: 'category' | 'merchant' | 'day' | 'week' | 'month';
  category?: string;
  merchant_key?: string;
  amount_min?: number;
  amount_max?: number;
  limit?: number;
}

export interface StatsRow {
  group_key: string;
  count: number;
  total_spend: number;
  avg: number;
  stddev: number;
  last_seen: string;
  first_seen: string;
}

export interface StatsOutput {
  rows: StatsRow[];
  overall: {
    total_count: number;
    total_spend: number;
    avg: number;
  };
}

export type AnomalyType =
  | 'large_vs_baseline'
  | 'new_merchant'
  | 'spike_category'
  | 'duplicate_charge'
  | 'subscription_jump'
  | 'refund_outlier';

export interface DetectAnomaliesInput {
  user_id: string;
  date_start?: string;
  date_end?: string;
  anomaly_types?: AnomalyType[];
  sensitivity?: 'low' | 'med' | 'high';
  limit?: number;
}

export interface Anomaly {
  type: AnomalyType;
  severity_score: number; // 0-1
  transaction_ids: string[];
  explanation_short: string;
  baseline_window: string;
  computed_metrics: Record<string, number | string>;
}

export interface AnomalyOutput {
  anomalies: Anomaly[];
}

// ─── Sensitivity thresholds ───
const SENSITIVITY: Record<string, { zThreshold: number; spikeMultiplier: number; dupWindowHours: number }> = {
  low:  { zThreshold: 3.0, spikeMultiplier: 2.0, dupWindowHours: 1 },
  med:  { zThreshold: 2.0, spikeMultiplier: 1.5, dupWindowHours: 12 },
  high: { zThreshold: 1.5, spikeMultiplier: 1.2, dupWindowHours: 24 },
};

// ─── Tool 1: search_transactions ───

export function searchTransactions(input: SearchTransactionsInput): SearchTransactionsOutput {
  const db = getDb();
  const limit = Math.min(input.limit || 25, 100);
  const offset = input.offset || 0;

  // Default date range: last 30 days
  const now = new Date();
  const d30 = new Date(now);
  d30.setDate(d30.getDate() - 30);
  const dateStart = input.date_start || d30.toISOString().split('T')[0];
  const dateEnd = input.date_end || now.toISOString().split('T')[0];

  let where = 'user_id = ? AND date >= ? AND date <= ?';
  const params: any[] = [input.user_id, dateStart, dateEnd];

  if (input.pending !== undefined) {
    where += ' AND pending = ?';
    params.push(input.pending ? 1 : 0);
  }

  if (input.amount_min !== undefined) {
    where += ' AND amount >= ?';
    params.push(input.amount_min);
  }
  if (input.amount_max !== undefined) {
    where += ' AND amount <= ?';
    params.push(input.amount_max);
  }

  if (input.categories && input.categories.length > 0) {
    where += ` AND category_primary IN (${input.categories.map(() => '?').join(',')})`;
    params.push(...input.categories);
  }

  if (input.merchant_keys && input.merchant_keys.length > 0) {
    where += ` AND merchant_key IN (${input.merchant_keys.map(() => '?').join(',')})`;
    params.push(...input.merchant_keys);
  }

  if (input.query_text) {
    const q = `%${input.query_text.toLowerCase()}%`;
    where += ' AND (LOWER(name) LIKE ? OR LOWER(merchant_name) LIKE ? OR LOWER(merchant_key) LIKE ?)';
    params.push(q, q, q);
  }

  // Sort
  let orderBy = 'date DESC';
  if (input.sort_by === 'amount') orderBy = 'ABS(amount) DESC';
  else if (input.sort_by === 'relevance' && input.query_text) {
    // Relevance: exact merchant_key match first, then by date
    orderBy = `CASE WHEN LOWER(merchant_key) = ? THEN 0 ELSE 1 END, date DESC`;
    params.push(input.query_text.toLowerCase());
  }

  // Summary query (without pagination)
  const summaryRow = db.prepare(
    `SELECT COUNT(*) as count, COALESCE(SUM(ABS(amount)),0) as total,
            COALESCE(MIN(amount),0) as min, COALESCE(MAX(amount),0) as max
     FROM transaction_ WHERE ${where}`
  ).get(...params) as any;

  // Paginated data query
  const dataParams = [...params, limit, offset];
  const rows = db.prepare(
    `SELECT id, date, amount, merchant_name, merchant_key, name, category_primary, pending, currency
     FROM transaction_ WHERE ${where} ORDER BY ${orderBy} LIMIT ? OFFSET ?`
  ).all(...dataParams) as any[];

  const transactions: TransactionResult[] = rows.map(r => ({
    id: r.id,
    date: r.date,
    amount: r.amount,
    merchant_name: r.merchant_name,
    merchant_key: r.merchant_key,
    name: r.name,
    category_primary: r.category_primary,
    pending: !!r.pending,
    currency: r.currency,
  }));

  const totalCount = summaryRow.count as number;
  const hasMore = offset + limit < totalCount;

  return {
    transactions,
    next_offset: hasMore ? offset + limit : null,
    summary: {
      count: totalCount,
      total: Math.round(summaryRow.total * 100) / 100,
      min: summaryRow.min,
      max: summaryRow.max,
    },
  };
}

// ─── Tool 2: get_transaction_by_id ───

export function getTransactionById(userId: string, transactionId: string): TransactionDetail | null {
  const db = getDb();
  const row = db.prepare(
    'SELECT * FROM transaction_ WHERE id = ? AND user_id = ?'
  ).get(transactionId, userId) as any;

  if (!row) return null;

  return {
    id: row.id,
    user_id: row.user_id,
    provider: row.provider,
    provider_txn_id: row.provider_txn_id,
    date: row.date,
    amount: row.amount,
    merchant_name: row.merchant_name,
    merchant_key: row.merchant_key || normalizeMerchantKey(row.merchant_name, row.name),
    name: row.name,
    category_primary: row.category_primary,
    category_detailed: row.category_detailed,
    pending: !!row.pending,
    pending_transaction_id: row.pending_transaction_id,
    currency: row.currency,
    metadata: JSON.parse(row.metadata || '{}'),
    created_at: row.created_at,
  };
}

// ─── Tool 3: list_transaction_stats ───

export function listTransactionStats(input: StatsInput): StatsOutput {
  const db = getDb();
  const limit = Math.min(input.limit || 50, 200);

  let where = 'user_id = ? AND date >= ? AND date <= ? AND pending = 0';
  const params: any[] = [input.user_id, input.date_start, input.date_end];

  if (input.category) {
    where += ' AND category_primary = ?';
    params.push(input.category);
  }
  if (input.merchant_key) {
    where += ' AND merchant_key = ?';
    params.push(input.merchant_key);
  }
  if (input.amount_min !== undefined) {
    where += ' AND amount >= ?';
    params.push(input.amount_min);
  }
  if (input.amount_max !== undefined) {
    where += ' AND amount <= ?';
    params.push(input.amount_max);
  }

  // Only count spending (negative amounts)
  const spendFilter = 'AND amount < 0';

  let groupExpr: string;
  switch (input.group_by) {
    case 'category':
      groupExpr = "COALESCE(category_primary, 'Other')";
      break;
    case 'merchant':
      groupExpr = "COALESCE(merchant_key, LOWER(name))";
      break;
    case 'day':
      groupExpr = "date";
      break;
    case 'week':
      // SQLite: strftime('%Y-W%W', date) gives year-week
      groupExpr = "strftime('%Y-W%W', date)";
      break;
    case 'month':
      groupExpr = "strftime('%Y-%m', date)";
      break;
    default:
      groupExpr = "COALESCE(category_primary, 'Other')";
  }

  const sql = `
    SELECT
      ${groupExpr} as group_key,
      COUNT(*) as count,
      ROUND(SUM(ABS(amount)), 2) as total_spend,
      ROUND(AVG(ABS(amount)), 2) as avg,
      MIN(date) as first_seen,
      MAX(date) as last_seen
    FROM transaction_
    WHERE ${where} ${spendFilter}
    GROUP BY group_key
    ORDER BY total_spend DESC
    LIMIT ?
  `;

  const rows = db.prepare(sql).all(...params, limit) as any[];

  // Compute stddev in JS (SQLite doesn't have it natively)
  const statsRows: StatsRow[] = rows.map(r => {
    // Get individual amounts for stddev
    const amounts = db.prepare(
      `SELECT ABS(amount) as amt FROM transaction_
       WHERE ${where} ${spendFilter} AND ${groupExpr} = ?`
    ).all(...params, r.group_key) as any[];

    const avg = r.avg;
    const variance = amounts.length > 1
      ? amounts.reduce((s: number, a: any) => s + (a.amt - avg) ** 2, 0) / amounts.length
      : 0;

    return {
      group_key: r.group_key,
      count: r.count,
      total_spend: r.total_spend,
      avg: r.avg,
      stddev: Math.round(Math.sqrt(variance) * 100) / 100,
      first_seen: r.first_seen,
      last_seen: r.last_seen,
    };
  });

  // Overall
  const overallRow = db.prepare(
    `SELECT COUNT(*) as count, COALESCE(SUM(ABS(amount)),0) as total, COALESCE(AVG(ABS(amount)),0) as avg
     FROM transaction_ WHERE ${where} ${spendFilter}`
  ).get(...params) as any;

  return {
    rows: statsRows,
    overall: {
      total_count: overallRow.count,
      total_spend: Math.round(overallRow.total * 100) / 100,
      avg: Math.round(overallRow.avg * 100) / 100,
    },
  };
}

// ─── Tool 4: detect_anomalies ───

export function detectAnomalies(input: DetectAnomaliesInput): AnomalyOutput {
  const db = getDb();
  const sensitivity = SENSITIVITY[input.sensitivity || 'med'];
  const limit = Math.min(input.limit || 20, 50);

  const now = new Date();
  const dateEnd = input.date_end || now.toISOString().split('T')[0];
  // Default window: last 30 days for detection
  const d30 = new Date(now);
  d30.setDate(d30.getDate() - 30);
  const dateStart = input.date_start || d30.toISOString().split('T')[0];

  // Baseline: 90 days before the detection window start
  const baselineEnd = dateStart;
  const d90 = new Date(dateStart);
  d90.setDate(d90.getDate() - 90);
  const baselineStart = d90.toISOString().split('T')[0];

  const types = input.anomaly_types || [
    'large_vs_baseline', 'new_merchant', 'spike_category',
    'duplicate_charge', 'subscription_jump', 'refund_outlier',
  ];

  const anomalies: Anomaly[] = [];

  if (types.includes('large_vs_baseline')) {
    anomalies.push(...detectLargeVsBaseline(db, input.user_id, dateStart, dateEnd, baselineStart, baselineEnd, sensitivity));
  }
  if (types.includes('new_merchant')) {
    anomalies.push(...detectNewMerchant(db, input.user_id, dateStart, dateEnd, baselineStart));
  }
  if (types.includes('spike_category')) {
    anomalies.push(...detectSpikeCategory(db, input.user_id, dateStart, dateEnd, baselineStart, baselineEnd, sensitivity));
  }
  if (types.includes('duplicate_charge')) {
    anomalies.push(...detectDuplicateCharge(db, input.user_id, dateStart, dateEnd, sensitivity));
  }
  if (types.includes('subscription_jump')) {
    anomalies.push(...detectSubscriptionJump(db, input.user_id, dateStart, dateEnd));
  }
  if (types.includes('refund_outlier')) {
    anomalies.push(...detectRefundOutlier(db, input.user_id, dateStart, dateEnd, baselineStart, baselineEnd, sensitivity));
  }

  // Sort by severity and limit
  anomalies.sort((a, b) => b.severity_score - a.severity_score);
  return { anomalies: anomalies.slice(0, limit) };
}

// ─── Anomaly Detection Algorithms ───

function detectLargeVsBaseline(
  db: any, userId: string,
  dateStart: string, dateEnd: string,
  baselineStart: string, baselineEnd: string,
  sensitivity: typeof SENSITIVITY['med']
): Anomaly[] {
  // Get baseline stats per category
  const baselineStats = db.prepare(`
    SELECT category_primary as cat,
           AVG(ABS(amount)) as avg_amt,
           COUNT(*) as cnt
    FROM transaction_
    WHERE user_id = ? AND date >= ? AND date < ? AND pending = 0 AND amount < 0
    GROUP BY category_primary
    HAVING cnt >= 3
  `).all(userId, baselineStart, baselineEnd) as any[];

  const statsMap = new Map(baselineStats.map((r: any) => [r.cat, r]));

  // Compute stddev per category
  for (const s of baselineStats) {
    const amounts = db.prepare(`
      SELECT ABS(amount) as amt FROM transaction_
      WHERE user_id = ? AND date >= ? AND date < ? AND pending = 0 AND amount < 0
        AND category_primary = ?
    `).all(userId, baselineStart, baselineEnd, s.cat) as any[];
    const variance = amounts.reduce((sum: number, a: any) => sum + (a.amt - s.avg_amt) ** 2, 0) / amounts.length;
    s.stddev = Math.sqrt(variance);
  }

  // Find transactions in detection window that exceed baseline
  const recentTxns = db.prepare(`
    SELECT id, date, amount, merchant_name, merchant_key, category_primary
    FROM transaction_
    WHERE user_id = ? AND date >= ? AND date <= ? AND pending = 0 AND amount < 0
    ORDER BY ABS(amount) DESC
  `).all(userId, dateStart, dateEnd) as any[];

  const anomalies: Anomaly[] = [];
  for (const txn of recentTxns) {
    const baseline = statsMap.get(txn.category_primary);
    if (!baseline || baseline.stddev < 0.01) continue;

    const absAmt = Math.abs(txn.amount);
    const zScore = (absAmt - baseline.avg_amt) / baseline.stddev;
    if (zScore >= sensitivity.zThreshold) {
      const severity = Math.min(1, zScore / 5);
      anomalies.push({
        type: 'large_vs_baseline',
        severity_score: Math.round(severity * 100) / 100,
        transaction_ids: [txn.id],
        explanation_short: `$${absAmt.toFixed(2)} at ${txn.merchant_name || txn.merchant_key} is ${zScore.toFixed(1)}x std dev above your ${txn.category_primary} avg of $${baseline.avg_amt.toFixed(2)}`,
        baseline_window: `${baselineStart} to ${baselineEnd}`,
        computed_metrics: { z_score: Math.round(zScore * 100) / 100, baseline_avg: baseline.avg_amt, baseline_stddev: baseline.stddev },
      });
    }
  }
  return anomalies;
}

function detectNewMerchant(
  db: any, userId: string,
  dateStart: string, dateEnd: string,
  baselineStart: string
): Anomaly[] {
  // Find merchant_keys in detection window that don't appear before
  const newMerchants = db.prepare(`
    SELECT merchant_key, MIN(date) as first_date,
           GROUP_CONCAT(id) as txn_ids,
           SUM(ABS(amount)) as total_spend,
           COUNT(*) as cnt
    FROM transaction_
    WHERE user_id = ? AND date >= ? AND date <= ? AND pending = 0 AND amount < 0
      AND merchant_key IS NOT NULL
      AND merchant_key NOT IN (
        SELECT DISTINCT merchant_key FROM transaction_
        WHERE user_id = ? AND date >= ? AND date < ? AND merchant_key IS NOT NULL
      )
    GROUP BY merchant_key
    HAVING total_spend > 5
    ORDER BY total_spend DESC
    LIMIT 10
  `).all(userId, dateStart, dateEnd, userId, baselineStart, dateStart) as any[];

  return newMerchants.map((m: any) => ({
    type: 'new_merchant' as const,
    severity_score: Math.min(1, Math.round((m.total_spend / 50) * 100) / 100),
    transaction_ids: (m.txn_ids as string).split(',').slice(0, 5),
    explanation_short: `New merchant "${m.merchant_key}" — $${m.total_spend.toFixed(2)} across ${m.cnt} transaction(s)`,
    baseline_window: `before ${dateStart}`,
    computed_metrics: { total_spend: m.total_spend, transaction_count: m.cnt, first_seen: m.first_date },
  }));
}

function detectSpikeCategory(
  db: any, userId: string,
  dateStart: string, dateEnd: string,
  baselineStart: string, baselineEnd: string,
  sensitivity: typeof SENSITIVITY['med']
): Anomaly[] {
  // Compare recent window category totals vs baseline average per-period
  const recentDays = Math.max(1, Math.round((new Date(dateEnd).getTime() - new Date(dateStart).getTime()) / 86400000));
  const baselineDays = Math.max(1, Math.round((new Date(baselineEnd).getTime() - new Date(baselineStart).getTime()) / 86400000));

  const recentCats = db.prepare(`
    SELECT category_primary as cat, SUM(ABS(amount)) as total, COUNT(*) as cnt,
           GROUP_CONCAT(id) as txn_ids
    FROM transaction_
    WHERE user_id = ? AND date >= ? AND date <= ? AND pending = 0 AND amount < 0
    GROUP BY category_primary
  `).all(userId, dateStart, dateEnd) as any[];

  const baselineCats = db.prepare(`
    SELECT category_primary as cat, SUM(ABS(amount)) as total, COUNT(*) as cnt
    FROM transaction_
    WHERE user_id = ? AND date >= ? AND date < ? AND pending = 0 AND amount < 0
    GROUP BY category_primary
  `).all(userId, baselineStart, baselineEnd) as any[];

  const baselineMap = new Map(baselineCats.map((r: any) => [r.cat, r]));

  const anomalies: Anomaly[] = [];
  for (const rc of recentCats) {
    const bl = baselineMap.get(rc.cat);
    if (!bl) continue;

    // Normalize to daily rate
    const recentDaily = rc.total / recentDays;
    const baselineDaily = bl.total / baselineDays;
    if (baselineDaily < 1) continue; // skip tiny categories

    const ratio = recentDaily / baselineDaily;
    if (ratio >= sensitivity.spikeMultiplier) {
      const severity = Math.min(1, (ratio - 1) / 3);
      const pctIncrease = Math.round((ratio - 1) * 100);
      anomalies.push({
        type: 'spike_category',
        severity_score: Math.round(severity * 100) / 100,
        transaction_ids: (rc.txn_ids as string).split(',').slice(0, 5),
        explanation_short: `${rc.cat} spending is up ${pctIncrease}% vs your 90-day average ($${recentDaily.toFixed(0)}/day vs $${baselineDaily.toFixed(0)}/day)`,
        baseline_window: `${baselineStart} to ${baselineEnd}`,
        computed_metrics: { recent_daily: recentDaily, baseline_daily: baselineDaily, ratio, pct_increase: pctIncrease },
      });
    }
  }
  return anomalies;
}

function detectDuplicateCharge(
  db: any, userId: string,
  dateStart: string, dateEnd: string,
  sensitivity: typeof SENSITIVITY['med']
): Anomaly[] {
  // Find same merchant_key + same amount within short time window
  const txns = db.prepare(`
    SELECT id, date, amount, merchant_key, merchant_name, created_at
    FROM transaction_
    WHERE user_id = ? AND date >= ? AND date <= ? AND pending = 0 AND amount < 0
      AND merchant_key IS NOT NULL
    ORDER BY merchant_key, date, created_at
  `).all(userId, dateStart, dateEnd) as any[];

  const anomalies: Anomaly[] = [];
  const windowMs = sensitivity.dupWindowHours * 3600000;

  for (let i = 0; i < txns.length; i++) {
    for (let j = i + 1; j < txns.length; j++) {
      if (txns[j].merchant_key !== txns[i].merchant_key) break;

      const t1 = new Date(txns[i].created_at || txns[i].date).getTime();
      const t2 = new Date(txns[j].created_at || txns[j].date).getTime();
      if (t2 - t1 > windowMs) break;

      // Same amount (within 1 cent)?
      if (Math.abs(txns[i].amount - txns[j].amount) < 0.02) {
        const amt = Math.abs(txns[i].amount);
        anomalies.push({
          type: 'duplicate_charge',
          severity_score: Math.min(1, amt / 100),
          transaction_ids: [txns[i].id, txns[j].id],
          explanation_short: `Possible duplicate: 2x $${amt.toFixed(2)} at ${txns[i].merchant_name || txns[i].merchant_key} within ${Math.round((t2 - t1) / 3600000)}h`,
          baseline_window: `${dateStart} to ${dateEnd}`,
          computed_metrics: { amount: amt, time_gap_hours: Math.round((t2 - t1) / 3600000), merchant: txns[i].merchant_key },
        });
      }
    }
  }
  return anomalies;
}

function detectSubscriptionJump(
  db: any, userId: string,
  dateStart: string, dateEnd: string
): Anomaly[] {
  // Compare recurring_candidate typical_amount vs latest charge
  const recurring = db.prepare(`
    SELECT * FROM recurring_candidate WHERE user_id = ? AND confidence >= 0.5
  `).all(userId) as any[];

  const anomalies: Anomaly[] = [];
  for (const rc of recurring) {
    const latestCharge = db.prepare(`
      SELECT id, date, amount FROM transaction_
      WHERE user_id = ? AND merchant_key = ? AND date >= ? AND date <= ?
        AND pending = 0 AND amount < 0
      ORDER BY date DESC LIMIT 1
    `).get(userId, rc.merchant_key, dateStart, dateEnd) as any;

    if (!latestCharge) continue;

    const latestAmt = Math.abs(latestCharge.amount);
    const typical = rc.typical_amount;
    if (typical < 1) continue;

    const deviation = (latestAmt - typical) / typical;
    if (deviation > 0.1) { // >10% increase
      anomalies.push({
        type: 'subscription_jump',
        severity_score: Math.min(1, Math.round(deviation * 100) / 100),
        transaction_ids: [latestCharge.id],
        explanation_short: `${rc.merchant_key} charged $${latestAmt.toFixed(2)}, up from typical $${typical.toFixed(2)} (+${Math.round(deviation * 100)}%)`,
        baseline_window: `recurring history`,
        computed_metrics: { latest_amount: latestAmt, typical_amount: typical, deviation_pct: Math.round(deviation * 100) },
      });
    }
  }
  return anomalies;
}

function detectRefundOutlier(
  db: any, userId: string,
  dateStart: string, dateEnd: string,
  baselineStart: string, baselineEnd: string,
  sensitivity: typeof SENSITIVITY['med']
): Anomaly[] {
  // Find unusually large positive amounts (refunds) compared to baseline refund avg
  const baselineRefunds = db.prepare(`
    SELECT AVG(amount) as avg_refund, COUNT(*) as cnt
    FROM transaction_
    WHERE user_id = ? AND date >= ? AND date < ? AND pending = 0 AND amount > 0
      AND category_primary != 'Transfer'
  `).get(userId, baselineStart, baselineEnd) as any;

  if (!baselineRefunds || baselineRefunds.cnt < 2) return [];

  const baselineAvg = baselineRefunds.avg_refund;
  // Compute stddev
  const refundAmts = db.prepare(`
    SELECT amount FROM transaction_
    WHERE user_id = ? AND date >= ? AND date < ? AND pending = 0 AND amount > 0
      AND category_primary != 'Transfer'
  `).all(userId, baselineStart, baselineEnd) as any[];

  const variance = refundAmts.reduce((s: number, r: any) => s + (r.amount - baselineAvg) ** 2, 0) / refundAmts.length;
  const stddev = Math.sqrt(variance);
  if (stddev < 1) return [];

  const recentRefunds = db.prepare(`
    SELECT id, date, amount, merchant_name, merchant_key
    FROM transaction_
    WHERE user_id = ? AND date >= ? AND date <= ? AND pending = 0 AND amount > 0
      AND category_primary != 'Transfer'
    ORDER BY amount DESC
  `).all(userId, dateStart, dateEnd) as any[];

  const anomalies: Anomaly[] = [];
  for (const r of recentRefunds) {
    const z = (r.amount - baselineAvg) / stddev;
    if (z >= sensitivity.zThreshold) {
      anomalies.push({
        type: 'refund_outlier',
        severity_score: Math.min(1, Math.round((z / 5) * 100) / 100),
        transaction_ids: [r.id],
        explanation_short: `Unusually large refund of $${r.amount.toFixed(2)} from ${r.merchant_name || r.merchant_key} (avg refund: $${baselineAvg.toFixed(2)})`,
        baseline_window: `${baselineStart} to ${baselineEnd}`,
        computed_metrics: { z_score: Math.round(z * 100) / 100, amount: r.amount, baseline_avg: baselineAvg },
      });
    }
  }
  return anomalies;
}
