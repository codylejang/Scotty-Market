import { v4 as uuid } from 'uuid';
import { initDb, getDb } from './database';
import { generateMockTransactions } from '../adapters/mock-bank';
import { seedDefaultBudgets } from '../adapters/mock-budget';
import { ingestTransactions } from '../services/ingestion';
import { detectRecurringCandidates, upsertRecurringCandidates } from '../services/subscription-analysis';
import path from 'path';
import fs from 'fs';

const dataDir = path.join(__dirname, '../../data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

console.log('Seeding database...');
initDb();
const db = getDb();

// Create demo user
const userId = 'demo-user-1';
db.prepare(`
  INSERT OR IGNORE INTO user_profile (id, timezone, preferences)
  VALUES (?, 'America/New_York', '{"quest_types_avoid": [], "notification_limit": 5}')
`).run(userId);

// Create scotty state
db.prepare(`
  INSERT OR IGNORE INTO scotty_state (user_id, happiness, mood, food_credits)
  VALUES (?, 70, 'content', 10)
`).run(userId);

// Seed budgets
seedDefaultBudgets(userId);

// Generate 30 days of mock transactions
const txns = generateMockTransactions(userId, 30);
const result = ingestTransactions(txns);
console.log(`Inserted ${result.inserted} transactions`);

// Add some subscription-like recurring charges
const subscriptionMerchants = [
  { name: 'Netflix', amount: -15.99, day: 3 },
  { name: 'Spotify', amount: -9.99, day: 7 },
  { name: 'Apple.com', amount: -2.99, day: 15 },
];

for (const sub of subscriptionMerchants) {
  for (let month = 0; month < 3; month++) {
    const date = new Date();
    date.setMonth(date.getMonth() - month);
    date.setDate(sub.day);
    const txnId = uuid();
    db.prepare(`
      INSERT OR IGNORE INTO transaction_
      (id, user_id, provider, provider_txn_id, date, amount, currency, name, merchant_name, category_primary, category_detailed, pending, metadata)
      VALUES (?, ?, 'plaid', ?, ?, ?, 'USD', ?, ?, 'Entertainment', 'Streaming', 0, '{}')
    `).run(
      txnId, userId, `sub_${txnId}`,
      date.toISOString().split('T')[0],
      sub.amount, sub.name, sub.name
    );
  }
}

// Detect and persist recurring candidates
const candidates = detectRecurringCandidates(userId);
upsertRecurringCandidates(candidates);
console.log(`Detected ${candidates.length} recurring candidates`);

console.log('Seed complete. Demo user:', userId);
