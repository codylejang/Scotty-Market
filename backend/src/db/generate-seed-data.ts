/**
 * One-time script to generate AI-powered seed transaction data.
 * Writes output to ../data/nessie-seed-transactions.json.
 *
 * Usage:
 *   npx tsx src/db/generate-seed-data.ts
 *
 * After running, use `npm run seed` as normal — it reads the generated JSON.
 */

import { ClaudeLLMProvider } from '../agents/runner';
import path from 'path';
import fs from 'fs';

const OUTPUT_PATH = path.join(__dirname, '../data/nessie-seed-transactions.json');

const AI_SEED_PROMPT = `Generate realistic transaction data for a college student / young professional user of a budgeting app.

Return a JSON object with this exact shape:
{
  "transactions": [ ... ]
}

Each transaction in the array has this shape:
{
  "kind": "purchase" | "deposit" | "withdrawal" | "transfer",
  "account": "primary_checking" | "savings" | "travel_card",
  "date": "YYYY-MM-DD",
  "amount": <positive number>,
  "description": "Category - Merchant details"
}

Requirements:
- Generate 90-120 transactions spanning the last 90 days ending today (${new Date().toISOString().split('T')[0]})
- Include 2 paychecks/deposits per month (~$2400-2800 each) to primary_checking
- Include realistic daily spending: coffee shops ($4-7), grocery runs ($40-120), dining out ($12-45), rideshares ($8-25), online shopping ($15-80)
- Include 3-5 recurring subscriptions that repeat monthly: Netflix ($15.99), Spotify ($10.99), gym membership ($29.99), iCloud ($2.99), etc.
- Include seasonal spending: occasional travel, holiday gifts, textbook purchases
- Use the "Category - Merchant details" format for descriptions. Valid category prefixes:
  Income, Groceries, Dining, Travel, Fun, Shopping, Self-Care, Subscription, Misc, Transfer
- Include a few larger purchases ($100-400) for electronics, clothes, concerts
- Include 1-2 transfers from primary_checking to savings ($200-500 each)
- Make it feel like a real person's spending — vary merchants, amounts, and frequency naturally
- Dates should be spread across all 90 days, with more transactions on weekends

Return ONLY the JSON object, no markdown fences or explanation.`;

interface ProviderConfig {
  type: 'dedalus' | 'anthropic';
  apiKey: string;
}

function getProviderConfig(): ProviderConfig | null {
  let dedalusKey = process.env.DEDALUS_API_KEY || '';
  let anthropicKey = process.env.ANTHROPIC_API_KEY || '';

  try {
    const configModule = require('../../config.local');
    dedalusKey = dedalusKey || configModule.CONFIG?.dedalus?.apiKey || '';
    anthropicKey = anthropicKey || configModule.CONFIG?.anthropic?.apiKey || '';
  } catch {
    // No config.local.ts
  }

  if (dedalusKey && dedalusKey !== 'your-dedalus-api-key-here') {
    return { type: 'dedalus', apiKey: dedalusKey };
  }
  if (anthropicKey) {
    return { type: 'anthropic', apiKey: anthropicKey };
  }
  return null;
}

/**
 * Call Dedalus HTTP API directly with a long timeout (bypasses SDK which times out).
 */
async function callDedalusHTTP(apiKey: string, systemPrompt: string, userPrompt: string): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 120_000); // 2 minute timeout

  try {
    const response = await fetch('https://api.dedaluslabs.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'anthropic/claude-sonnet-4-5',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        max_tokens: 8192,
        temperature: 0.8,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Dedalus API ${response.status}: ${text}`);
    }

    const data: any = await response.json();
    return data.choices?.[0]?.message?.content || '';
  } catch (err: any) {
    clearTimeout(timeout);
    if (err.name === 'AbortError') {
      throw new Error('Request timed out after 120s');
    }
    throw err;
  }
}

async function generateWithProvider(config: ProviderConfig, systemPrompt: string, userPrompt: string): Promise<string> {
  if (config.type === 'dedalus') {
    console.log('Using Dedalus HTTP API (120s timeout)...');
    return callDedalusHTTP(config.apiKey, systemPrompt, userPrompt);
  } else {
    console.log('Using Claude API...');
    const llm = new ClaudeLLMProvider(config.apiKey);
    return llm.generate(systemPrompt, userPrompt);
  }
}

async function main() {
  const config = getProviderConfig();
  if (!config) {
    console.error('No API key found. Set DEDALUS_API_KEY or ANTHROPIC_API_KEY, or add to config.local.ts');
    process.exit(1);
  }

  console.log('Generating AI seed transaction data...');
  const raw = await generateWithProvider(
    config,
    'You are a financial data generator. Output only valid JSON, no markdown.',
    AI_SEED_PROMPT
  );

  if (!raw || raw.trim().length === 0) {
    console.error('LLM returned empty response');
    process.exit(1);
  }

  // Extract JSON object
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    console.error('Could not extract JSON from response. Raw output:');
    console.error(raw.substring(0, 500));
    process.exit(1);
  }

  const parsed = JSON.parse(jsonMatch[0]);
  if (!Array.isArray(parsed.transactions) || parsed.transactions.length === 0) {
    console.error('No transactions in parsed output');
    process.exit(1);
  }

  // Validate structure
  let valid = 0;
  for (const tx of parsed.transactions) {
    if (tx.kind && tx.account && tx.date && typeof tx.amount === 'number' && tx.description) {
      valid++;
    }
  }

  console.log(`Generated ${parsed.transactions.length} transactions (${valid} valid)`);

  // Write to file
  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(parsed, null, 2) + '\n');
  console.log(`Written to ${OUTPUT_PATH}`);
  console.log('Now run: npm run seed');
}

main().catch(err => {
  console.error('Failed:', err.message);
  process.exit(1);
});
