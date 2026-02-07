You are a senior full-stack engineer. Your task is to implement and debug the “Standard Backend APIs (Non-AI)” for our gamified financial management app (pixel/retro dog avatar “Scotty”), AND fix a critical UI integration bug: AI Insights are generated, stored, fetched into frontend state, but never displayed.

This is a DEVELOPMENT TASK PROMPT for a coding LLM. You must produce code-level changes, not high-level suggestions. Make reasonable assumptions, do not ask questions unless absolutely necessary.

========================================================
0) PROJECT CONTEXT
========================================================
We have two groups of APIs:

(1) AI-Driven Agentic APIs (already exist or in progress)
- LLM generates insights -> stored in database
- Frontend AppContext fetches insights -> stored in state dailyInsight
- BUT insights are NOT displayed in UI

(2) Standard Backend APIs (Non-AI) (this task)
These manage persistent app state and the mathematical roll-ups for budgets.

We are using Nessie for transactions/accounts in the non-AI layer.

========================================================
1) OBJECTIVES
========================================================
A) Implement/complete Standard Backend APIs (Non-AI):
1) Flexible Budget Manager (GET/POST/PUT /budget)
   - Store limit_amount, category, frequency (Day/Week/Month)
   - Compute Derived Daily Limit regardless of input frequency
   - Derived Daily Limit powers:
       - “Daily Spend” HUD
       - Scotty stamina constraints
2) Transaction Activity (GET /finance/transactions)
   - Pull from Nessie
   - Support “Smart Search” (query by merchant/name, amount, date range, category)
   - Provide pagination and stable sorting
3) Inventory & Feed Manager (GET/POST /scotty/inventory)
   - Tracks food earned from quests
   - Feed action consumes an item and increases Scotty Happiness or Stamina
4) Scotty Game State (GET /scotty/status)
   - Returns Growth Level, Happiness %, current Stamina
   - Supports Home screen consumption
5) Account Totals (GET /finance/accounts)
   - Fetch real-time balances from linked Nessie accounts

B) Fix the Insights UI pipeline so insights actually appear:
- Backend: insights generated -> stored in DB ✅
- Frontend: AppContext fetches insights -> dailyInsight state ✅
- UI: InsightBubble component exists but NOT rendered ❌
- Home screen currently shows hardcoded blurb ❌
- Objective: Replace hardcoded blurb with rendered InsightBubble using dailyInsight

========================================================
2) CRITICAL BUG DETAILS (UI)
========================================================
Problem statement:
- Insights are fetched but not displayed.
Evidence:
- AppContext.tsx fetches insights and stores them in dailyInsight state (lines 54, 95, 162 in AppContext.tsx).
- InsightBubble component exists but is not rendered anywhere.
- Home screen does not use dailyInsight; shows a hardcoded blurb instead.
Goal:
- Render InsightBubble in Home screen (or wherever the speech bubble is) using the dailyInsight state.
- Handle loading/empty/error states gracefully.
- Ensure dailyInsight updates trigger UI rerender.

You must implement this fix end-to-end:
- Verify that the GET endpoint used by AppContext returns correct data shape
- Ensure AppContext parsing aligns with DB schema / API response
- Render the InsightBubble component in the correct place
- Replace hardcoded blurb

========================================================
3) DELIVERABLES
========================================================
You must produce:
1) Backend routes + controllers + services + DB schema changes/migrations
2) Nessie adapter/service for transactions/accounts
3) Budget math utilities (Derived Daily Limit)
4) Inventory + feeding logic
5) Scotty status endpoint and update logic for stamina/happiness/level
6) Frontend fixes:
   - Update Home screen to render InsightBubble with dailyInsight
   - Ensure InsightBubble props match dailyInsight shape
   - Remove hardcoded blurb or use it only as fallback
7) Tests:
   - Backend unit tests for budget math, feeding logic
   - API integration tests for endpoints
   - Frontend component test (or at minimum runtime checks) to ensure InsightBubble renders from state
8) A short README runbook explaining how to verify insights display.

========================================================
4) IMPLEMENTATION REQUIREMENTS (BACKEND)
========================================================
Assume typical stack:
- Backend: Node/TypeScript (Express/Fastify) OR Python/FastAPI
- DB: Postgres (or SQLite in dev)
- Frontend: React Native or React (TypeScript)
If repo already uses a different stack, follow it.

### 4.1 Budget Manager (/budget)
Data model:
- budget(id, user_id, category, frequency, limit_amount, derived_daily_limit, created_at, updated_at)

Frequency rules:
- Day: derived_daily_limit = limit_amount
- Week: derived_daily_limit = limit_amount / 7
- Month: derived_daily_limit = limit_amount / days_in_current_month (or standardized 30)
Choose one rule and document it:
- Preferred: use actual days in the specific month for the relevant date context.
- If budgets are “rolling,” use 30.437 (avg month length). If unsure, choose calendar-month actual days.

Endpoints:
- GET /budget
  - returns list of budgets with derived_daily_limit
- POST /budget
  - creates new budget
- PUT /budget/:id
  - updates existing budget and recomputes derived_daily_limit

Validation:
- limit_amount > 0
- category must be one of supported categories (7 categories referenced in project)
- frequency enum Day/Week/Month

### 4.2 Transaction Activity (/finance/transactions)
Source: Nessie
- Implement Nessie client with env-config API key + base URL
- Provide GET /finance/transactions with filters:
  - q (text search over merchant/name)
  - amount_min, amount_max
  - date_start, date_end
  - category (if category mapping exists; otherwise provide merchant/name + tags)
  - sort (date_desc default)
  - limit (default 25, max 100)
  - cursor/page
Return:
- transactions[]
- next_cursor
- summary (count, total_spend)

Smart Search:
- Implement backend parsing of q:
  - Recognize patterns like “$83”, “coffee”, “yesterday”, “last week”
  - If natural language parsing is too heavy, implement robust basic filters and pass q to text search.
- Do NOT use AI for this endpoint. Keep deterministic.

### 4.3 Inventory & Feed Manager (/scotty/inventory)
Data model:
- inventory_item(id, user_id, item_type, quantity, source_quest_id, created_at, updated_at)
- feeding_event(id, user_id, item_type, delta_happiness, delta_stamina, created_at)

Food types:
- Match your project’s reward items (e.g., “Meat Treat”, “Kibble Pack”) plus any others defined.

Endpoints:
- GET /scotty/inventory
- POST /scotty/inventory (admin/internal: add rewards; typically called by quest evaluation)
- POST /scotty/inventory/feed
  - body: { item_type, quantity? default 1 }
  - atomically:
     - ensure inventory quantity >= requested
     - decrement inventory
     - increment Scotty happiness/stamina
     - write feeding_event
Return updated inventory + scotty status.

### 4.4 Scotty Status (/scotty/status)
Data model:
- scotty_state(user_id, growth_level, happiness, stamina, updated_at)
Rules:
- Happiness and stamina are bounded [0..100]
- Feeding increases happiness/stamina based on item type
- Growth level may increase when happiness crosses thresholds or via XP; implement a simple deterministic rule and document it.

Endpoint:
- GET /scotty/status
Return:
- growthLevel
- happinessPercent
- staminaPercent (or raw stamina value used for “Daily Spend HUD” stamina system)

### 4.5 Account Totals (/finance/accounts)
Source: Nessie
Endpoint:
- GET /finance/accounts
Return:
- accounts[]: {id, type, nickname, balance, currency}
- totalBalance

========================================================
5) IMPLEMENTATION REQUIREMENTS (FRONTEND INSIGHTS BUGFIX)
========================================================
You must locate and modify:
- AppContext.tsx:
  - Ensure dailyInsight state is set from API response correctly
  - Ensure state is exported in context and consumed by Home screen
  - Ensure fetch runs on app load and/or when Home screen focused
- Home screen component:
  - Replace hardcoded Scotty blurb with InsightBubble rendering
  - Render logic:
     - if dailyInsight exists -> <InsightBubble text={dailyInsight.blurb} />
     - else show fallback hardcoded blurb (optional)
  - Ensure InsightBubble is imported and placed where Scotty speech bubble should be
- InsightBubble component:
  - Verify expected props (string? object?)
  - Align with dailyInsight data shape from AppContext
  - Ensure styling works and text wraps/clamps

Also implement:
- Loading state (e.g., “…” or skeleton bubble)
- Error state (fallback copy)
- Empty state (fallback copy)

IMPORTANT: Ensure this is not just “stored”; it must actually render and update.

========================================================
6) ENDPOINT FOR FETCHING INSIGHTS (BACKEND CONTRACT)
========================================================
Ensure there is a stable non-AI GET endpoint that frontend consumes:
- GET /ai/scotty/insights OR GET /insights/daily
Return shape MUST match what AppContext expects.
Preferred shape:
{
  "date": "YYYY-MM-DD",
  "insights": [
     {"id": "...", "title": "...", "blurb": "...", "confidence": "high"}
  ],
  "primaryInsight": {"id": "...", "blurb": "..."}   // optional convenience
}

If AppContext currently expects a different shape, update AppContext OR backend for consistency. Do not leave mismatch.

========================================================
7) TESTS / VERIFICATION
========================================================
Backend tests:
- budget derived daily limit math (Day/Week/Month, month day count edge cases)
- feed endpoint atomicity (cannot feed more than owned; decrements correctly; bounds)
- scotty status bounds
- transactions endpoint filter/sort correctness with fixtures

Frontend verification:
- Home screen renders InsightBubble with dailyInsight
- When dailyInsight changes, bubble updates (react state wiring)
- Fallback text shows when insight missing

========================================================
8) OUTPUT FORMAT FOR YOUR WORK
========================================================
Produce:
- Folder structure changes
- Updated/added files with code
- Migrations or schema updates
- Sample curl requests for each endpoint
- A short “How to verify insights display” checklist

Do not ask questions. Make reasonable assumptions and proceed.

BEGIN IMPLEMENTATION.
