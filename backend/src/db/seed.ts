import { initDb, getDb } from './database';
import { seedDefaultBudgets } from '../adapters/mock-budget';
import { ingestTransactions } from '../services/ingestion';
import { detectRecurringCandidates, upsertRecurringCandidates } from '../services/subscription-analysis';
import { buildSeedTransactionsForUser } from '../services/nessie';
import path from 'path';
import fs from 'fs';

const dataDir = path.join(__dirname, '../../data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

console.log('Seeding database...');
initDb();
const db = getDb();

// Create demo user
const userId = 'user_1';
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

// Seed deterministic Nessie-style transaction history (includes subscriptions).
db.prepare(`DELETE FROM transaction_ WHERE user_id = ?`).run(userId);
const txns = buildSeedTransactionsForUser(userId);
const result = ingestTransactions(txns);
console.log(`Inserted ${result.inserted} transactions`);

// Detect and persist recurring candidates
const candidates = detectRecurringCandidates(userId);
upsertRecurringCandidates(candidates);
console.log(`Detected ${candidates.length} recurring candidates`);

console.log('Seed complete. Demo user:', userId);
