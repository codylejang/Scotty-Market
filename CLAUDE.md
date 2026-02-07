You are a senior full-stack engineer building the “agentic AI integration” layer for a gamified financial management app (pixel/retro dog avatar “Scotty”). This is a DEVELOPMENT TASK PROMPT for a coding agent: you must design and implement backend services + orchestration that power AI insights, quests, subscription analysis, and chat—strictly based on bank transactions (no honor/self-report). You are NOT writing the in-app agent prompts for runtime; you are implementing the infrastructure and code needed to run agents safely, deterministically, and with auditability.

========================
0) HIGH-LEVEL GOAL
========================
Implement an Agentic AI Integration module that:
- Ingests bank transactions (posted + pending) and recurring candidates
- Computes daily “AI insights” blurbs
- Generates a single daily “quest” (transaction-trackable only)
- Tracks quest progress automatically via transactions updates
- Detects recurring subscriptions and surfaces “review/cancel” opportunities (without claiming cancellation happened unless integrated)
- Provides a coaching chat endpoint powered by an LLM, grounded in the app’s computed state
- Orchestrates multiple agent roles through shared state (not agents talking to agents)
- Maintains logs/audit trails and avoids spamming nudges

Use:
- Claude Agent SDK for tool-based agent loop (if available in this environment)
- Dedalus-based orchestration (or equivalent workflow runner) for event-driven pipelines and coordination
If either is unavailable, implement a drop-in orchestration abstraction and a provider interface.

========================
1) HARD CONSTRAINTS / NON-NEGOTIABLES
========================
- Transaction-based tracking only. No “honesty mode” or self-report check-ins.
- Posted transactions = ground truth for quest completion.
- Pending transactions may be shown as “provisional progress” but cannot finalize completion.
- Never claim subscription cancellation occurred unless a cancellation integration returns success. Otherwise: “review”, “guide”, “verify by absence of future charges.”
- One primary quest/day (or per session) maximum.
- Agent outputs must be structured JSON payloads validated by schema.
- All agent decisions must be logged with inputs used (summaries/hashes), outputs, and confidence.

========================
2) EXPECTED PRODUCT FEATURES (AGENTIC SIDE ONLY)
========================
A) Home Screen “AI Insights”
- 1–3 short blurbs/day, computed from last 7–30 days transactions and budgets.
- Should include at least one “win” (positive reinforcement) when possible.
- Must include confidence level and time window.

B) Quest System (Pet-based budgeting)
- Generate at most one active quest at a time, typically daily.
- Quest must be measurable using transactions:
  - category spend caps (e.g., Dining <= $18 today)
  - merchant spend caps (only if merchant mapping is reliable)
  - subscription verification quests (e.g., “No posted charge from X this month”)
  - savings transfer detection quests (only if transfers are detectable reliably)
- Provide reward metadata (food type among exactly 5 + happiness delta) but only “award” when verified completion is achieved.

C) Achievements Overlay
- Milestones that trigger when a set of verified quests or savings thresholds are met.

D) Subscriptions / Recurring Charges
- Detect recurring candidates; estimate next charge date and amount.
- Surface “review” actions; optionally integrate cancellation provider if available (otherwise track verification via absence of charges).

E) Chat Coaching
- Chat endpoint that answers questions about insights, quests, and budgets.
- Must ground responses in computed app state and tool outputs.

F) Orchestration
- Event-driven runs: daily digest, webhook transaction update, user opens app, goal created.
- Shared artifacts: UserProfile, FinancialSummary, QuestPlan, ActiveQuest, ActionQueue, NotificationBudget.

========================
3) TECH STACK ASSUMPTIONS (IF NOT PROVIDED)
========================
Default implementation:
- Backend: TypeScript (Node.js) with Fastify or Express
- DB: PostgreSQL (or SQLite for prototype)
- Job runner: BullMQ / Temporal / custom queue
- LLM: Claude via Anthropic API
- Plaid for transactions ingestion (or mock adapters if not available)
If the repo already uses Python, mirror in Python (FastAPI + Celery/RQ). Pick one and implement consistently.

========================
4) DELIVERABLES
========================
Deliver code + docs:
1) Data models + migrations (SQL)
2) Ingestion service + webhook handlers
3) Financial summarization module
4) Quest generation module + schema validation
5) Quest progress evaluation module
6) Subscription analysis module
7) Orchestrator workflows (daily digest, sync updates)
8) Agent runtime wrapper:
   - tool registry
   - structured output validation
   - safety checks
   - audit logging
9) API endpoints for the app to consume
10) Unit tests + integration tests + fixture data
11) README with setup, env vars, runbook, and example curl requests

========================
5) CORE DATA MODELS (IMPLEMENT THESE TABLES / STRUCTS)
========================
A) user_profile
- id (pk)
- timezone
- preferences JSON (quest types to avoid, notification limits)
- created_at, updated_at

B) transaction
- id (pk)
- user_id (fk)
- provider (e.g., plaid)
- provider_txn_id (unique)
- date (date or timestamp)
- amount (signed, normalized)
- currency
- name (raw)
- merchant_name (normalized if available)
- category_primary, category_detailed (strings)
- pending (bool)
- pending_transaction_id (nullable; used to link pending -> posted)
- metadata JSON (raw provider fields)
- created_at, updated_at

C) recurring_candidate
- id (pk)
- user_id
- merchant_key (normalized identifier)
- typical_amount
- cadence (monthly/weekly/annual/unknown)
- next_expected_date (nullable)
- confidence (0–1)
- source JSON
- created_at, updated_at

D) quest
- id (pk)
- user_id
- status (ACTIVE, COMPLETED_PROVISIONAL, COMPLETED_VERIFIED, FAILED, EXPIRED)
- title
- window_start, window_end
- metric_type (CATEGORY_SPEND_CAP, MERCHANT_SPEND_CAP, NO_MERCHANT_CHARGE, TRANSFER_AMOUNT, etc.)
- metric_params JSON (category, cap, merchant_key, transfer_type, etc.)
- reward_food_type (enum: 5 values)
- happiness_delta (int)
- created_by (agent/manual)
- created_at, updated_at

E) quest_progress_snapshot
- id (pk)
- quest_id
- as_of_time
- confirmed_value (numeric)
- pending_value (numeric)
- status (same enum)
- explanation (short)
- created_at

F) insight
- id (pk)
- user_id
- date (daily)
- title
- blurb
- confidence (HIGH/MEDIUM/LOW)
- metrics JSON (numbers, windows)
- created_at

G) action_queue_item
- id (pk)
- user_id
- type (SUBSCRIPTION_REVIEW, BUDGET_SUGGESTION, etc.)
- payload JSON
- requires_approval (bool)
- status (OPEN, DISMISSED, APPROVED, COMPLETED)
- created_at, updated_at

H) agent_decision_log
- id (pk)
- user_id
- trigger (DAILY_DIGEST, TXN_UPDATE, USER_CHAT, etc.)
- input_summary JSON (hashes, counts, time windows)
- output JSON
- model_info JSON (provider, model, tokens)
- created_at

========================
6) EVENT FLOWS TO IMPLEMENT
========================
Flow 1: Daily Digest (cron)
- For each active user:
  1) Build FinancialSummary (last 7/30 days) from posted + pending txns
  2) Generate 1–3 insights and upsert into insight table for that date
  3) If no ACTIVE quest, generate one daily quest (transaction-trackable) and insert quest
  4) Generate at most 1 ActionQueueItem (e.g., subscription review) if relevant
  5) Log decision

Flow 2: Transactions Update (webhook + sync)
- Ingest new/updated transactions
- Recompute quest progress for ACTIVE quests whose windows include now
- If provisional completion -> keep provisional
- If posted confirms completion -> mark COMPLETED_VERIFIED, award reward (update Scotty state through app DB/API), create achievement if milestone
- If quest window elapsed without success -> EXPIRED/FAILED
- Log updates and snapshots

Flow 3: User Opens App (optional)
- Return the daily payload: insights + active quest + optional action
- If missing due to no digest run, run on-demand for that user with throttling

Flow 4: User Creates Goal (if goals exist)
- Convert goal -> quest chain plan (store in future_quest_plan table or reuse action_queue)
- Do NOT activate multiple quests at once; queue them.

========================
7) “AGENT” IMPLEMENTATION (RUNTIME WRAPPER, NOT PROMPTS)
========================
Implement an AgentRunner abstraction that:
- Accepts a “job” type (generate_daily_payload, generate_chat_response, propose_subscription_actions)
- Builds tool context objects from DB and adapters
- Calls LLM with a strict schema requirement:
  - Use JSON schema validation (zod / ajv)
  - Retry with a repair prompt once if invalid
- Enforces output limits:
  - insights count 1–3
  - primary quest max 1
  - optional actions max 1
- Enforces policy:
  - quest must be transaction-trackable
  - no self-report fields
  - must label pending-derived items as provisional/confidence medium/low
- Writes outputs to DB and logs everything

If using Claude Agent SDK:
- Register tools as functions (get_transactions, get_recurring_candidates, get_budgets, etc.)
- Ensure tools return typed outputs and error handling
If using Dedalus orchestration:
- Wrap AgentRunner calls in workflows and ensure idempotency keys per user/date/trigger

========================
8) TOOL / ADAPTER INTERFACES (IMPLEMENT WITH MOCKS IF NEEDED)
========================
A) BankDataProvider
- listTransactions(userId, start, end, includePending)
- syncTransactions(userId, cursor?) (if provider supports sync/cursor)
- listRecurringCandidates(userId, lookbackDays)

B) BudgetProvider
- getBudgets(userId)
- setBudget(userId, category, amount) [if feature exists; approval gated elsewhere]

C) CancellationProvider (optional)
- initiateCancel(userId, merchantKey) -> returns confirmed success/failure
(If not available, do not implement cancellation; implement “verify stopped charges” tracking.)

D) NotificationProvider
- schedule(userId, payload)
- enforce daily limits

========================
9) QUEST GENERATION RULES (ENFORCE IN CODE)
========================
Only allow quest types with measurable transaction proxies:
- Category spend cap: sum posted amounts in category within window <= cap
- Merchant spend cap: sum posted amounts for merchantKey within window <= cap (only if merchantKey confidence high)
- No merchant charge: count posted transactions for merchantKey in window == 0 (good for “verify cancellation”)
- Transfer to savings: detect transfer-like txns to savings accounts if available

Reject quests that rely on behavior without transactions:
- “Cook at home”, “buy fewer coffees” unless you have a robust merchant mapping and the quest is merchant-based (e.g., “no Starbucks posted txns this week”)

========================
10) PROGRESS EVALUATION SPEC
========================
Implement evaluateQuest(questId):
- Pull quest definition and transactions in [window_start, window_end]
- Compute confirmed_value (posted) and pending_value (pending)
- Derive status:
  - ACTIVE if within window and not meeting confirmed completion
  - COMPLETED_PROVISIONAL if pending suggests completion but confirmed not yet
  - COMPLETED_VERIFIED if confirmed meets criteria
  - EXPIRED if now > window_end and not completed
- Store quest_progress_snapshot each evaluation run
- If COMPLETED_VERIFIED transitions from other status:
  - create reward event (food + happiness delta) and persist
  - optionally create achievement events

========================
11) API ENDPOINTS (MINIMUM)
========================
GET /v1/home/daily
- returns:
  - insights[1..3]
  - activeQuest (or null)
  - optionalActions[0..1]
  - scottyState (current happiness + last reward info)

GET /v1/quests/active
POST /v1/quests/:id/evaluate (admin/internal; typically run by jobs)
GET /v1/subscriptions/upcoming
POST /v1/actions/:id/approve (if you support approval gated actions)

POST /v1/webhooks/transactions (provider webhook)
POST /v1/chat
- input: user message
- output: grounded response + optional recommended next actions (not automatically applied)

========================
12) TESTING REQUIREMENTS
========================
Write tests for:
- Transaction ingestion and pending->posted linking using pending_transaction_id
- Category spend cap evaluation
- Merchant spend cap evaluation (with merchant mapping)
- “No merchant charge” verification across billing periods
- Daily digest creation (insights count, quest constraints)
- Schema validation and repair path for agent outputs
- Idempotency for daily digest and webhook replays

Include fixture datasets:
- A week of transactions with dining spikes
- A subscription that appears pending then posts
- A subscription that stops charging (verification quest passes)
- Edge cases: refunds, chargebacks, split transactions, negative amounts

========================
13) PERFORMANCE / RELIABILITY
========================
- Use cursors/sync APIs when supported to avoid full transaction pulls
- Use indexes: (user_id, date), (provider_txn_id), (merchant_key, date)
- Orchestrator must be idempotent:
  - daily digest key = userId + date
  - transaction webhook key = provider event id
- Ensure retry logic on external calls; do not double-insert

========================
14) OUTPUT FORMAT FOR YOUR WORK
========================
Deliver:
- A directory structure proposal
- Concrete code stubs for key modules
- Migrations/schema files
- Example JSON schemas (Quest, Insight, DailyPayload)
- Example requests/responses
- A short README with local run steps

Do not ask me questions unless absolutely required. Make reasonable assumptions and proceed.
If you must choose, prioritize correctness + auditability + measurable quests.

BEGIN IMPLEMENTATION.
