# Scotty Backend — Agentic AI Integration

Backend service for the Scotty gamified financial management app. Provides AI-powered insights, transaction-verified quests, subscription analysis, and coaching chat.

## Architecture

```
backend/
├── src/
│   ├── index.ts              # Express server + cron setup
│   ├── db/
│   │   ├── database.ts       # SQLite connection + migrations
│   │   ├── schema.ts         # All table definitions
│   │   ├── migrate.ts        # Run migrations CLI
│   │   └── seed.ts           # Seed demo data
│   ├── adapters/             # External service interfaces
│   │   ├── types.ts          # BankDataProvider, BudgetProvider, etc.
│   │   ├── mock-bank.ts      # Mock Plaid-like bank data
│   │   ├── mock-budget.ts    # Budget CRUD
│   │   └── mock-notification.ts
│   ├── services/
│   │   ├── ingestion.ts      # Transaction ingest + dedup + pending linking
│   │   ├── retrieval.ts      # Search, stats, anomaly detection (tool-driven)
│   │   ├── financial-summary.ts  # 7d/30d summaries
│   │   ├── health-metrics.ts # Financial health scoring
│   │   ├── quest-evaluation.ts   # Quest progress verification
│   │   └── subscription-analysis.ts  # Recurring charge detection
│   ├── agents/
│   │   ├── runner.ts         # AgentRunner: LLM orchestration + fallback
│   │   └── tools.ts          # Tool registry for agent context
│   ├── orchestrator/
│   │   └── index.ts          # Workflow flows: daily digest, webhooks, etc.
│   ├── api/
│   │   └── routes.ts         # REST endpoints
│   └── schemas/
│       └── index.ts          # Zod schemas for all data models
├── tests/
│   ├── fixtures/transactions.ts
│   ├── ingestion.test.ts
│   ├── retrieval.test.ts     # Search, stats, anomaly detection, merchant normalization
│   ├── quest-evaluation.test.ts
│   ├── workflow.test.ts
│   └── daily-digest.test.ts
└── data/                     # SQLite database (auto-created)
```

## Retrieval Architecture

The agent uses a **tool-driven retrieval** pattern: the LLM never sees the full database. Instead, it calls bounded query tools that return paginated, indexed results.

```
User question / daily trigger
  → (1) Retrieval tools query DB (search, stats, anomaly detection)
  → (2) Code computes features & aggregates (not LLM)
  → (3) LLM produces insights/quests grounded in retrieved facts + evidence
  → (4) Results persisted + logged in agent_decision_log
```

### Retrieval Tools (in `services/retrieval.ts`)

| Tool | Purpose | Key Features |
|------|---------|-------------|
| `search_transactions` | Find specific transactions | Text search, amount/date/category filters, pagination, relevance sort |
| `get_transaction_by_id` | Full details for evidence | User-scoped, includes metadata + merchant_key |
| `list_transaction_stats` | Aggregates over any time span | Group by category/merchant/day/week/month, stddev |
| `detect_anomalies` | Find stand-out transactions | 6 algorithms, configurable sensitivity |

### Anomaly Detection Algorithms (computed in code, not LLM)

| Type | Detection Method |
|------|-----------------|
| `large_vs_baseline` | Z-score vs 90-day category average |
| `new_merchant` | merchant_key first seen in detection window |
| `duplicate_charge` | Same merchant + same amount within time window |
| `spike_category` | Recent daily spend rate vs 90-day baseline rate |
| `subscription_jump` | Latest charge vs recurring_candidate typical_amount |
| `refund_outlier` | Z-score vs baseline refund average |

## Setup

```bash
cd backend
npm install
npm run migrate    # Create database + tables
npm run seed       # Seed demo user + 30 days of transactions
npm run dev        # Start dev server (port 3001)
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3001` | Server port |
| `DB_PATH` | `./data/scotty.db` | SQLite database path |
| `DEDALUS_API_KEY` | *(none)* | Dedalus multi-model API key (preferred LLM provider) |
| `ANTHROPIC_API_KEY` | *(none)* | Claude API key (fallback if Dedalus unavailable) |
| `ENABLE_CRON` | `true` | Enable daily digest cron (5 AM) |

## API Endpoints

Base URL: `http://localhost:3001/api`

### GET /v1/home/daily
Daily payload for app home screen.

```bash
curl "http://localhost:3001/api/v1/home/daily?user_id=demo-user-1"
```

Response:
```json
{
  "insights": [
    { "id": "...", "title": "Great Week!", "blurb": "You've spent $142.50...", "confidence": "HIGH", "metrics": {} }
  ],
  "activeQuest": {
    "id": "...", "title": "Keep Food & Drink under $18.00 today",
    "metric_type": "CATEGORY_SPEND_CAP", "metric_params": { "category": "Food & Drink", "cap": 18 },
    "reward_food_type": "bone", "happiness_delta": 5
  },
  "optionalActions": [],
  "scottyState": { "happiness": 70, "mood": "content", "food_credits": 10 }
}
```

### GET /v1/quests/active
```bash
curl "http://localhost:3001/api/v1/quests/active?user_id=demo-user-1"
```

### POST /v1/quests/:id/evaluate
```bash
curl -X POST "http://localhost:3001/api/v1/quests/QUEST_ID/evaluate"
```

### GET /v1/subscriptions/upcoming
```bash
curl "http://localhost:3001/api/v1/subscriptions/upcoming?user_id=demo-user-1"
```

### POST /v1/actions/:id/approve
```bash
curl -X POST "http://localhost:3001/api/v1/actions/ACTION_ID/approve"
```

### POST /v1/webhooks/transactions
```bash
curl -X POST "http://localhost:3001/api/v1/webhooks/transactions" \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "demo-user-1",
    "webhook_event_id": "evt_123",
    "transactions": [{
      "id": "txn_1", "user_id": "demo-user-1", "provider": "plaid",
      "provider_txn_id": "plaid_txn_abc", "date": "2026-02-06",
      "amount": -12.50, "currency": "USD", "name": "Chipotle",
      "merchant_name": "Chipotle", "category_primary": "Food & Drink",
      "category_detailed": "Restaurants", "pending": false,
      "pending_transaction_id": null, "metadata": {}
    }]
  }'
```

### POST /v1/chat
```bash
curl -X POST "http://localhost:3001/api/v1/chat" \
  -H "Content-Type: application/json" \
  -d '{"user_id": "demo-user-1", "message": "How am I doing?"}'
```

Response:
```json
{
  "message": "Woof! Here's your snapshot: You've spent $142.50 this week...",
  "recommended_actions": []
}
```

### AI Endpoints

#### GET /ai/scotty/insights
Anomaly-driven insights with evidence grounding.

```bash
curl "http://localhost:3001/api/ai/scotty/insights?user_id=user_1"
```

Response:
```json
{
  "insights": [
    {
      "title": "Spike Category",
      "blurb": "Food & Drink spending is up 45% vs your 90-day average",
      "confidence": "HIGH",
      "evidence": {
        "transaction_ids": ["txn_abc", "txn_def"],
        "time_window": "2026-01-08 to 2026-02-07",
        "computed_metrics": { "recent_daily": 28.5, "baseline_daily": 19.6, "pct_increase": 45 }
      },
      "followup": "Consider setting a Food & Drink spending cap."
    }
  ],
  "log_id": "..."
}
```

#### POST /ai/quests/generate
Generate quests grounded in full-history data with evidence.

```bash
curl -X POST "http://localhost:3001/api/ai/quests/generate" \
  -H "Content-Type: application/json" \
  -d '{"user_id": "user_1"}'
```

#### POST /v1/search/transactions
Search transactions with filters, pagination, and summary.

```bash
curl -X POST "http://localhost:3001/api/v1/search/transactions" \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "user_1",
    "query_text": "starbucks",
    "amount_min": -50,
    "amount_max": -5,
    "sort_by": "relevance",
    "limit": 10
  }'
```

#### GET /v1/transactions/:id
Get full transaction details (evidence retrieval).

```bash
curl "http://localhost:3001/api/v1/transactions/txn_abc?user_id=user_1"
```

#### POST /v1/stats/transactions
Compute aggregates for any time span.

```bash
curl -X POST "http://localhost:3001/api/v1/stats/transactions" \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "user_1",
    "date_start": "2026-01-01",
    "date_end": "2026-02-07",
    "group_by": "category"
  }'
```

#### POST /v1/anomalies/detect
Find stand-out transactions across full history.

```bash
curl -X POST "http://localhost:3001/api/v1/anomalies/detect" \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "user_1",
    "anomaly_types": ["large_vs_baseline", "duplicate_charge", "new_merchant"],
    "sensitivity": "med",
    "limit": 10
  }'
```

### Admin Endpoints

### POST /v1/admin/daily-digest
Trigger daily digest manually.
```bash
curl -X POST "http://localhost:3001/api/v1/admin/daily-digest" \
  -H "Content-Type: application/json" \
  -d '{"user_id": "demo-user-1"}'
```

## Testing

```bash
npm test           # Run all tests
npm run test:watch # Watch mode
```

## Key Design Decisions

- **Transaction-based verification only**: No self-report or honor system. Quest completion requires posted bank transactions.
- **Pending = provisional**: Pending transactions inform progress UI but never confirm quest completion.
- **Subscription cancellation**: Never claimed unless an integration confirms it. Uses "verify by absence of charges" approach.
- **Idempotent orchestration**: Daily digest keyed by `userId + date`, webhooks keyed by event ID.
- **Fallback generation**: Works without an LLM API key using deterministic heuristics. Claude API adds natural language variety.
- **Audit trail**: Every agent decision logged with inputs, outputs, and model info in `agent_decision_log`.

## Quest Types

| Type | Metric | Verification |
|------|--------|-------------|
| `CATEGORY_SPEND_CAP` | Sum of posted amounts in category ≤ cap | Posted transactions |
| `MERCHANT_SPEND_CAP` | Sum of posted amounts at merchant ≤ cap | Posted transactions |
| `NO_MERCHANT_CHARGE` | Zero posted charges from merchant | Absence of transactions |
| `TRANSFER_AMOUNT` | Transfer-like transactions ≥ target | Posted transfer transactions |

## Food Rewards

| Food Type | Earned Via |
|-----------|-----------|
| `kibble` | Easy quests |
| `bone` | Standard quests |
| `steak` | Challenging quests |
| `salmon` | Merchant-specific quests |
| `truffle` | Subscription verification quests |
