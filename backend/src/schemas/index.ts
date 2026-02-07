import { z } from 'zod';

// ─── Enums ───
export const QuestStatus = z.enum([
  'ACTIVE', 'COMPLETED_PROVISIONAL', 'COMPLETED_VERIFIED', 'FAILED', 'EXPIRED',
]);
export type QuestStatus = z.infer<typeof QuestStatus>;

export const MetricType = z.enum([
  'CATEGORY_SPEND_CAP', 'MERCHANT_SPEND_CAP', 'NO_MERCHANT_CHARGE', 'TRANSFER_AMOUNT',
]);
export type MetricType = z.infer<typeof MetricType>;

export const FoodType = z.enum(['kibble', 'bone', 'steak', 'salmon', 'truffle']);
export type FoodType = z.infer<typeof FoodType>;

export const Confidence = z.enum(['HIGH', 'MEDIUM', 'LOW']);
export type Confidence = z.infer<typeof Confidence>;

export const ActionType = z.enum([
  'SUBSCRIPTION_REVIEW', 'BUDGET_SUGGESTION', 'SAVINGS_TIP', 'SPENDING_ALERT',
]);
export type ActionType = z.infer<typeof ActionType>;

export const ActionStatus = z.enum(['OPEN', 'DISMISSED', 'APPROVED', 'COMPLETED']);
export type ActionStatus = z.infer<typeof ActionStatus>;

export const TriggerType = z.enum([
  'DAILY_DIGEST', 'TXN_UPDATE', 'USER_CHAT', 'APP_OPEN', 'GOAL_CREATED',
]);
export type TriggerType = z.infer<typeof TriggerType>;

// ─── Transaction ───
export const TransactionSchema = z.object({
  id: z.string(),
  user_id: z.string(),
  provider: z.string().default('plaid'),
  provider_txn_id: z.string().nullable(),
  date: z.string(),
  amount: z.number(),
  currency: z.string().default('USD'),
  name: z.string(),
  merchant_name: z.string().nullable(),
  category_primary: z.string().nullable(),
  category_detailed: z.string().nullable(),
  pending: z.boolean(),
  pending_transaction_id: z.string().nullable(),
  metadata: z.record(z.unknown()).default({}),
});
export type Transaction = z.infer<typeof TransactionSchema>;

// ─── Insight ───
export const InsightSchema = z.object({
  id: z.string(),
  user_id: z.string(),
  date: z.string(),
  title: z.string().max(80),
  blurb: z.string().max(280),
  confidence: Confidence,
  metrics: z.record(z.unknown()).default({}),
});
export type Insight = z.infer<typeof InsightSchema>;

// ─── Quest ───
export const QuestSchema = z.object({
  id: z.string(),
  user_id: z.string(),
  status: QuestStatus,
  title: z.string().max(120),
  window_start: z.string(),
  window_end: z.string(),
  metric_type: MetricType,
  metric_params: z.record(z.unknown()),
  reward_food_type: FoodType,
  happiness_delta: z.number().int().min(1).max(20),
  created_by: z.string().default('agent'),
});
export type Quest = z.infer<typeof QuestSchema>;

// ─── Agent Output Schemas ───
export const AgentInsightOutput = z.object({
  title: z.string().max(80),
  blurb: z.string().max(280),
  confidence: Confidence,
  metrics: z.record(z.unknown()),
});

export const AgentQuestOutput = z.object({
  title: z.string().max(120),
  metric_type: MetricType,
  metric_params: z.record(z.unknown()),
  reward_food_type: FoodType,
  happiness_delta: z.number().int().min(1).max(20),
  window_hours: z.number().int().min(1).max(168),
});

export const AgentActionOutput = z.object({
  type: ActionType,
  payload: z.record(z.unknown()),
  requires_approval: z.boolean(),
});

export const DailyDigestOutput = z.object({
  insights: z.array(AgentInsightOutput).min(1).max(3),
  quest: AgentQuestOutput.nullable(),
  action: AgentActionOutput.nullable(),
});
export type DailyDigestOutput = z.infer<typeof DailyDigestOutput>;

export const ChatResponseOutput = z.object({
  message: z.string().max(1000),
  recommended_actions: z.array(AgentActionOutput).max(2),
});
export type ChatResponseOutput = z.infer<typeof ChatResponseOutput>;

// ─── API Response Schemas ───
export const DailyPayloadSchema = z.object({
  insights: z.array(InsightSchema),
  activeQuest: QuestSchema.nullable(),
  optionalActions: z.array(z.object({
    id: z.string(),
    type: ActionType,
    payload: z.record(z.unknown()),
    requires_approval: z.boolean(),
    status: ActionStatus,
  })).max(1),
  scottyState: z.object({
    happiness: z.number(),
    mood: z.string(),
    last_reward_food: z.string().nullable(),
    last_reward_at: z.string().nullable(),
    food_credits: z.number(),
  }),
});
export type DailyPayload = z.infer<typeof DailyPayloadSchema>;

// ─── Evidence-based Output Schemas (retrieval-grounded) ───

export const EvidenceObject = z.object({
  transaction_ids: z.array(z.string()),
  time_window: z.string(),
  computed_metrics: z.record(z.union([z.number(), z.string()])),
});
export type EvidenceObject = z.infer<typeof EvidenceObject>;

export const InsightWithEvidence = z.object({
  title: z.string().max(80),
  blurb: z.string().max(200),
  confidence: Confidence,
  evidence: EvidenceObject,
  followup: z.string().max(120).optional(),
});
export type InsightWithEvidence = z.infer<typeof InsightWithEvidence>;

export const InsightResponseSchema = z.object({
  insights: z.array(InsightWithEvidence).min(1).max(3),
});
export type InsightResponse = z.infer<typeof InsightResponseSchema>;

export const QuestWithEvidence = z.object({
  title: z.string().max(120),
  metric_type: MetricType,
  metric_params: z.record(z.unknown()),
  reward_food_type: FoodType,
  happiness_delta: z.number().int().min(1).max(20),
  window_hours: z.number().int().min(1).max(168),
  explanation: z.string().max(200),
  evidence: EvidenceObject,
});
export type QuestWithEvidence = z.infer<typeof QuestWithEvidence>;

export const QuestGenerateResponseSchema = z.object({
  quests: z.array(QuestWithEvidence).min(1).max(5),
});
export type QuestGenerateResponse = z.infer<typeof QuestGenerateResponseSchema>;

export const TransactionSearchResultSchema = z.object({
  id: z.string(),
  date: z.string(),
  amount: z.number(),
  merchant_name: z.string().nullable(),
  merchant_key: z.string().nullable(),
  name: z.string(),
  category_primary: z.string().nullable(),
  pending: z.boolean(),
  currency: z.string(),
});

export const TransactionSearchResponseSchema = z.object({
  transactions: z.array(TransactionSearchResultSchema),
  next_offset: z.number().nullable(),
  summary: z.object({
    count: z.number(),
    total: z.number(),
    min: z.number(),
    max: z.number(),
  }),
});
export type TransactionSearchResponse = z.infer<typeof TransactionSearchResponseSchema>;

export const AnomalySchema = z.object({
  type: z.enum([
    'large_vs_baseline', 'new_merchant', 'spike_category',
    'duplicate_charge', 'subscription_jump', 'refund_outlier',
  ]),
  severity_score: z.number().min(0).max(1),
  transaction_ids: z.array(z.string()),
  explanation_short: z.string(),
  baseline_window: z.string(),
  computed_metrics: z.record(z.union([z.number(), z.string()])),
});

export const AnomalyResponseSchema = z.object({
  anomalies: z.array(AnomalySchema),
});
export type AnomalyResponse = z.infer<typeof AnomalyResponseSchema>;

export const RetrievalChatResponseSchema = z.object({
  message: z.string().max(1000),
  evidence: EvidenceObject.optional(),
  recommended_actions: z.array(AgentActionOutput).max(2),
});
export type RetrievalChatResponse = z.infer<typeof RetrievalChatResponseSchema>;

// ─── Financial Summary ───
export const FinancialSummarySchema = z.object({
  user_id: z.string(),
  period_start: z.string(),
  period_end: z.string(),
  total_spent: z.number(),
  total_income: z.number(),
  by_category: z.record(z.number()),
  by_merchant: z.record(z.number()),
  top_merchants: z.array(z.object({ name: z.string(), total: z.number() })),
  pending_total: z.number(),
  transaction_count: z.number(),
});
export type FinancialSummary = z.infer<typeof FinancialSummarySchema>;

// ─── Recurring Candidate ───
export const RecurringCandidateSchema = z.object({
  id: z.string(),
  user_id: z.string(),
  merchant_key: z.string(),
  typical_amount: z.number(),
  cadence: z.enum(['monthly', 'weekly', 'annual', 'unknown']),
  next_expected_date: z.string().nullable(),
  confidence: z.number().min(0).max(1),
  source: z.record(z.unknown()).default({}),
});
export type RecurringCandidate = z.infer<typeof RecurringCandidateSchema>;
