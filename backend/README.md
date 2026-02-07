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
│   │   ├── financial-summary.ts  # 7d/30d summaries
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
│   ├── quest-evaluation.test.ts
│   └── daily-digest.test.ts
└── data/                     # SQLite database (auto-created)
```

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
| `ANTHROPIC_API_KEY` | *(none)* | Claude API key (optional; uses fallback generation if not set) |
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
