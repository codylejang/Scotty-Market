export const MIGRATIONS = [
  {
    version: 1,
    name: 'initial_schema',
    sql: `
      CREATE TABLE IF NOT EXISTS user_profile (
        id TEXT PRIMARY KEY,
        timezone TEXT NOT NULL DEFAULT 'America/New_York',
        preferences TEXT NOT NULL DEFAULT '{}',
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS transaction_ (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES user_profile(id),
        provider TEXT NOT NULL DEFAULT 'plaid',
        provider_txn_id TEXT UNIQUE,
        date TEXT NOT NULL,
        amount REAL NOT NULL,
        currency TEXT NOT NULL DEFAULT 'USD',
        name TEXT NOT NULL,
        merchant_name TEXT,
        category_primary TEXT,
        category_detailed TEXT,
        pending INTEGER NOT NULL DEFAULT 0,
        pending_transaction_id TEXT,
        metadata TEXT NOT NULL DEFAULT '{}',
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE INDEX IF NOT EXISTS idx_txn_user_date ON transaction_(user_id, date);
      CREATE INDEX IF NOT EXISTS idx_txn_provider_id ON transaction_(provider_txn_id);
      CREATE INDEX IF NOT EXISTS idx_txn_merchant_date ON transaction_(merchant_name, date);
      CREATE INDEX IF NOT EXISTS idx_txn_pending_id ON transaction_(pending_transaction_id);

      CREATE TABLE IF NOT EXISTS recurring_candidate (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES user_profile(id),
        merchant_key TEXT NOT NULL,
        typical_amount REAL NOT NULL,
        cadence TEXT NOT NULL DEFAULT 'monthly',
        next_expected_date TEXT,
        confidence REAL NOT NULL DEFAULT 0.5,
        source TEXT NOT NULL DEFAULT '{}',
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE INDEX IF NOT EXISTS idx_recurring_user ON recurring_candidate(user_id);

      CREATE TABLE IF NOT EXISTS quest (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES user_profile(id),
        status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK(status IN ('ACTIVE','COMPLETED_PROVISIONAL','COMPLETED_VERIFIED','FAILED','EXPIRED')),
        title TEXT NOT NULL,
        window_start TEXT NOT NULL,
        window_end TEXT NOT NULL,
        metric_type TEXT NOT NULL CHECK(metric_type IN ('CATEGORY_SPEND_CAP','MERCHANT_SPEND_CAP','NO_MERCHANT_CHARGE','TRANSFER_AMOUNT')),
        metric_params TEXT NOT NULL DEFAULT '{}',
        reward_food_type TEXT NOT NULL CHECK(reward_food_type IN ('kibble','bone','steak','salmon','truffle')),
        happiness_delta INTEGER NOT NULL DEFAULT 5,
        created_by TEXT NOT NULL DEFAULT 'agent',
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE INDEX IF NOT EXISTS idx_quest_user_status ON quest(user_id, status);

      CREATE TABLE IF NOT EXISTS quest_progress_snapshot (
        id TEXT PRIMARY KEY,
        quest_id TEXT NOT NULL REFERENCES quest(id),
        as_of_time TEXT NOT NULL DEFAULT (datetime('now')),
        confirmed_value REAL NOT NULL DEFAULT 0,
        pending_value REAL NOT NULL DEFAULT 0,
        status TEXT NOT NULL,
        explanation TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE INDEX IF NOT EXISTS idx_snapshot_quest ON quest_progress_snapshot(quest_id);

      CREATE TABLE IF NOT EXISTS insight (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES user_profile(id),
        date TEXT NOT NULL,
        title TEXT NOT NULL,
        blurb TEXT NOT NULL,
        confidence TEXT NOT NULL DEFAULT 'MEDIUM' CHECK(confidence IN ('HIGH','MEDIUM','LOW')),
        metrics TEXT NOT NULL DEFAULT '{}',
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE INDEX IF NOT EXISTS idx_insight_user_date ON insight(user_id, date);
      CREATE UNIQUE INDEX IF NOT EXISTS idx_insight_unique ON insight(user_id, date, title);

      CREATE TABLE IF NOT EXISTS action_queue_item (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES user_profile(id),
        type TEXT NOT NULL,
        payload TEXT NOT NULL DEFAULT '{}',
        requires_approval INTEGER NOT NULL DEFAULT 1,
        status TEXT NOT NULL DEFAULT 'OPEN' CHECK(status IN ('OPEN','DISMISSED','APPROVED','COMPLETED')),
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE INDEX IF NOT EXISTS idx_action_user_status ON action_queue_item(user_id, status);

      CREATE TABLE IF NOT EXISTS agent_decision_log (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES user_profile(id),
        trigger TEXT NOT NULL,
        input_summary TEXT NOT NULL DEFAULT '{}',
        output TEXT NOT NULL DEFAULT '{}',
        model_info TEXT NOT NULL DEFAULT '{}',
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE INDEX IF NOT EXISTS idx_log_user ON agent_decision_log(user_id);

      CREATE TABLE IF NOT EXISTS scotty_state (
        user_id TEXT PRIMARY KEY REFERENCES user_profile(id),
        happiness INTEGER NOT NULL DEFAULT 70,
        mood TEXT NOT NULL DEFAULT 'content',
        last_fed TEXT,
        food_credits INTEGER NOT NULL DEFAULT 10,
        last_reward_food TEXT,
        last_reward_at TEXT,
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS budget (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES user_profile(id),
        category TEXT NOT NULL,
        amount REAL NOT NULL,
        period TEXT NOT NULL DEFAULT 'monthly',
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now')),
        UNIQUE(user_id, category)
      );

      CREATE TABLE IF NOT EXISTS idempotency_key (
        key TEXT PRIMARY KEY,
        result TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
    `,
  },
  {
    version: 2,
    name: 'bank_sync_state',
    sql: `
      CREATE TABLE IF NOT EXISTS bank_sync_state (
        user_id TEXT NOT NULL REFERENCES user_profile(id),
        provider TEXT NOT NULL,
        cursor TEXT,
        last_sync_at TEXT,
        last_error TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now')),
        PRIMARY KEY(user_id, provider)
      );

      CREATE INDEX IF NOT EXISTS idx_bank_sync_provider_time
      ON bank_sync_state(provider, last_sync_at);
    `,
  },
  {
    version: 3,
    name: 'retrieval_indexes_and_merchant_key',
    sql: `
      -- Add merchant_key column for stable grouping (normalized from merchant_name)
      ALTER TABLE transaction_ ADD COLUMN merchant_key TEXT;

      -- Composite indexes for retrieval tools
      CREATE INDEX IF NOT EXISTS idx_txn_user_amount ON transaction_(user_id, amount);
      CREATE INDEX IF NOT EXISTS idx_txn_user_merchant_key_date ON transaction_(user_id, merchant_key, date);
      CREATE INDEX IF NOT EXISTS idx_txn_user_category_date ON transaction_(user_id, category_primary, date);
      CREATE INDEX IF NOT EXISTS idx_recurring_user_merchant ON recurring_candidate(user_id, merchant_key);

      -- Backfill merchant_key from existing data
      UPDATE transaction_ SET merchant_key = LOWER(TRIM(COALESCE(merchant_name, name)))
      WHERE merchant_key IS NULL;
    `,
  },
  {
    version: 4,
    name: 'standard_apis',
    sql: `
      -- Budget: add frequency and derived_daily_limit columns
      ALTER TABLE budget ADD COLUMN frequency TEXT NOT NULL DEFAULT 'Month';
      ALTER TABLE budget ADD COLUMN derived_daily_limit REAL;

      -- Backfill: existing budgets assumed monthly
      UPDATE budget SET frequency = 'Month',
        derived_daily_limit = ROUND(amount / 30.0, 2)
      WHERE derived_daily_limit IS NULL;

      -- Scotty state: add growth_level and stamina
      ALTER TABLE scotty_state ADD COLUMN growth_level INTEGER NOT NULL DEFAULT 1;
      ALTER TABLE scotty_state ADD COLUMN stamina INTEGER NOT NULL DEFAULT 100;

      -- Inventory: tracks food items earned from quests
      CREATE TABLE IF NOT EXISTS inventory_item (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES user_profile(id),
        item_type TEXT NOT NULL,
        quantity INTEGER NOT NULL DEFAULT 0,
        source_quest_id TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now')),
        UNIQUE(user_id, item_type)
      );

      CREATE INDEX IF NOT EXISTS idx_inventory_user ON inventory_item(user_id);

      -- Feeding events: audit trail
      CREATE TABLE IF NOT EXISTS feeding_event (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES user_profile(id),
        item_type TEXT NOT NULL,
        delta_happiness INTEGER NOT NULL DEFAULT 0,
        delta_stamina INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE INDEX IF NOT EXISTS idx_feeding_user ON feeding_event(user_id);
    `,
  },
  {
    version: 5,
    name: 'goals_and_chat_memory',
    sql: `
      -- Goals: user savings targets
      CREATE TABLE IF NOT EXISTS goal (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES user_profile(id),
        name TEXT NOT NULL,
        target_amount REAL NOT NULL,
        saved_so_far REAL NOT NULL DEFAULT 0,
        deadline TEXT,
        budget_percent INTEGER NOT NULL DEFAULT 10,
        status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK(status IN ('ACTIVE','COMPLETED','CANCELLED')),
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE INDEX IF NOT EXISTS idx_goal_user_status ON goal(user_id, status);

      -- Chat memory: conversational preferences and summaries
      CREATE TABLE IF NOT EXISTS chat_memory (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES user_profile(id),
        type TEXT NOT NULL CHECK(type IN ('preference','summary','goal_context')),
        content TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE INDEX IF NOT EXISTS idx_chat_memory_user ON chat_memory(user_id, type);
    `,
  },
  {
    version: 6,
    name: 'quest_description',
    sql: `
      ALTER TABLE quest ADD COLUMN description TEXT NOT NULL DEFAULT '';
    `,
  },
];
