import express from 'express';
import path from 'path';
import fs from 'fs';
import cron from 'node-cron';
import { initDb } from './db/database';
import { createAdapters } from './adapters';
import { AgentRunner, DedalusProvider, ClaudeLLMProvider, MockLLMProvider } from './agents/runner';
import { createRouter } from './api/routes';
import { Orchestrator } from './orchestrator';

// Config: loaded from .env via --env-file flag in dev script, or from config.local.ts
let DEDALUS_API_KEY = process.env.DEDALUS_API_KEY || '';
let ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || '';

// Also check config.local.ts if it exists (legacy support)
try {
  const configModule = require('../config.local');
  DEDALUS_API_KEY = DEDALUS_API_KEY || configModule.CONFIG?.dedalus?.apiKey || '';
} catch {
  // No config.local.ts — using .env or environment variables
}

const PORT = parseInt(process.env.PORT || '3001');
const NESSIE_SYNC_INTERVAL_MINUTES = Math.max(
  1,
  Math.min(59, parseInt(process.env.NESSIE_SYNC_INTERVAL_MINUTES || '30', 10) || 30)
);

// Ensure data directory exists
const dataDir = path.join(__dirname, '../data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// Initialize database
console.log('Initializing database...');
const db = initDb();

// Initialize adapters
const adapters = createAdapters();

// Initialize LLM provider - prefer Dedalus, fallback to Anthropic, then mock
let llmProvider;
if (DEDALUS_API_KEY && DEDALUS_API_KEY !== 'your-dedalus-api-key-here') {
  console.log('Using Dedalus provider with multi-model support');
  llmProvider = new DedalusProvider(DEDALUS_API_KEY);
} else if (ANTHROPIC_API_KEY) {
  console.log('Using Claude provider (Anthropic SDK)');
  llmProvider = new ClaudeLLMProvider(ANTHROPIC_API_KEY);
} else {
  console.log('No API key set — using mock LLM provider (fallback generation).');
  llmProvider = new MockLLMProvider();
}

// Initialize agent runner
const runner = new AgentRunner({
  adapters,
  llmProvider,
});

// Create Express app
const app = express();
app.use(express.json({ limit: '10mb' }));

// CORS for local development
app.use((_req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  if (_req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API routes
app.use('/api', createRouter(adapters, runner));

// Start cron for daily digest (5:00 AM daily)
const orchestrator = new Orchestrator(adapters, runner);

if (process.env.ENABLE_CRON !== 'false') {
  if (process.env.NESSIE_API_KEY) {
    const syncSchedule = `*/${NESSIE_SYNC_INTERVAL_MINUTES} * * * *`;
    cron.schedule(syncSchedule, async () => {
      console.log(`[cron] Running Nessie sync for all users (every ${NESSIE_SYNC_INTERVAL_MINUTES} min)...`);
      try {
        const users = db.prepare('SELECT id FROM user_profile').all() as { id: string }[];
        for (const user of users) {
          await adapters.bank.syncTransactions(user.id);
        }
        console.log(`[cron] Nessie sync complete for ${users.length} users`);
      } catch (err) {
        console.error('[cron] Nessie sync failed:', err);
      }
    });
    console.log(`Nessie sync cron scheduled (${syncSchedule}).`);
  } else {
    console.log('NESSIE_API_KEY not set — skipping Nessie sync cron.');
  }

  cron.schedule('0 5 * * *', async () => {
    console.log('[cron] Running daily digest for all users...');
    try {
      const result = await orchestrator.runDailyDigestAll();
      console.log(`[cron] Daily digest complete: ${result.processed} users processed, ${result.errors.length} errors`);
    } catch (err) {
      console.error('[cron] Daily digest failed:', err);
    }
  });
  console.log('Daily digest cron scheduled (5:00 AM).');
}

// Start server
app.listen(PORT, () => {
  console.log(`Scotty backend running on http://localhost:${PORT}`);
  console.log(`API base: http://localhost:${PORT}/api/v1`);
});

export { app };
