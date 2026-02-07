import { v4 as uuid } from 'uuid';
import { z } from 'zod';
import { getDb } from '../db/database';
import { TOOLS, ToolContext, ToolDefinition } from './tools';
import { DailyDigestOutput, ChatResponseOutput, TriggerType } from '../schemas';
import { Adapters } from '../adapters';
import { buildDualSummary } from '../services/financial-summary';

export type JobType = 'generate_daily_payload' | 'generate_chat_response' | 'propose_subscription_actions';

interface AgentRunnerConfig {
  adapters: Adapters;
  llmProvider?: LLMProvider;
}

export interface LLMProvider {
  generate(systemPrompt: string, userPrompt: string, schema?: z.ZodSchema, model?: string[]): Promise<string>;
}

interface AgentResult<T> {
  output: T;
  logId: string;
}

/**
 * Mock LLM provider that generates structured outputs without calling an API.
 * In production, this would be replaced with a Claude API provider.
 */
export class MockLLMProvider implements LLMProvider {
  async generate(_systemPrompt: string, _userPrompt: string, _schema?: z.ZodSchema, _model?: string[]): Promise<string> {
    // Returns empty — callers use fallback generation
    return '';
  }
}

/**
 * Claude LLM provider using the Anthropic SDK (fallback).
 */
export class ClaudeLLMProvider implements LLMProvider {
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async generate(systemPrompt: string, userPrompt: string, _schema?: z.ZodSchema, _model?: string[]): Promise<string> {
    // Dynamic import to avoid requiring the SDK when using mock
    const { default: Anthropic } = await import('@anthropic-ai/sdk');
    const client = new Anthropic({ apiKey: this.apiKey });

    const response = await client.messages.create({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 2048,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    });

    const textBlock = response.content.find(b => b.type === 'text');
    return textBlock?.text || '';
  }
}

/**
 * Dedalus LLM provider using DedalusRunner API.
 * Supports multi-model selection and MCP servers.
 * API docs: https://docs.dedaluslabs.ai/api
 */
export class DedalusProvider implements LLMProvider {
  private apiKey: string;
  private baseUrl: string = 'https://api.dedaluslabs.ai';
  private client: any;
  private runner: any;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  private async getClient() {
    if (!this.client) {
      try {
        // Try to use the dedalus-labs SDK if available
        const dedalusModule = await import('dedalus-labs');
        const Dedalus = dedalusModule.default || dedalusModule.Dedalus || dedalusModule;
        const { DedalusRunner } = dedalusModule;
        
        this.client = new Dedalus({ apiKey: this.apiKey });
        this.runner = new DedalusRunner(this.client);
      } catch (error: any) {
        // If SDK not available, we'll use HTTP API directly
        console.log('[DedalusProvider] SDK not available, using HTTP API directly');
        this.client = null;
        this.runner = null;
      }
    }
    return { client: this.client, runner: this.runner };
  }

  async generate(
    systemPrompt: string,
    userPrompt: string,
    schema?: z.ZodSchema,
    models?: string[]
  ): Promise<string> {
    // Default to Haiku (cheapest) if not specified
    // Dedalus model format: anthropic/claude-{model}-{version}
    // Based on docs example: anthropic/claude-opus-4-6
    // Try standard Anthropic model names
    const modelList = models || ['anthropic/claude-3-haiku-20240307'];
    // Use first model for now (Dedalus may have issues with arrays)
    const model = Array.isArray(modelList) ? modelList[0] : modelList;

    try {
      const { runner } = await this.getClient();

      // If SDK is available, try DedalusRunner first
      if (runner) {
        try {
          // DedalusRunner.run() expects:
          // - input: user message (string)
          // - model: model name (string)
          // - instructions: optional system instructions
          // - stream: optional boolean
          // Note: Per docs, input should be the user message, not combined with system
          const result = await runner.run({
            input: userPrompt, // User message only (per docs)
            model: model, // Single model string
            instructions: systemPrompt, // System prompt as instructions (if supported)
            stream: false,
          });

          // Extract final_output from DedalusRunner response
          let content = result.final_output || result.content || result.text || JSON.stringify(result);
          
          // Log the raw response for debugging
          if (!content || content.trim() === '') {
            console.warn('[DedalusProvider] Empty response from SDK:', JSON.stringify(result));
          }
          
          // Return content as-is - let the caller handle schema validation
          return typeof content === 'string' ? content : JSON.stringify(content);
        } catch (sdkError: any) {
          // If SDK fails (500 errors, etc.), fall back to HTTP API
          if (sdkError.status === 500 || sdkError.status >= 500) {
            console.warn(`[DedalusProvider] SDK returned ${sdkError.status}, falling back to HTTP API`);
            // Fall through to HTTP API below
          } else {
            // Re-throw non-500 errors (auth, validation, etc.)
            throw sdkError;
          }
        }
      }

      // Fallback: Use HTTP API directly (OpenAI-compatible format)
      const modelName = Array.isArray(model) ? model[0] : model;
      const isOpenAIModel = typeof modelName === 'string' && modelName.startsWith('openai/');
      
      // Build request body
      const requestBody: any = {
        model: modelName,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        max_tokens: 2048,
        temperature: 0.7,
      };
      
      // Only include response_format for OpenAI models
      if (schema && isOpenAIModel) {
        requestBody.response_format = { type: 'json_object' };
      }
      
      // Log request for debugging (without sensitive data)
      console.log(`[DedalusProvider] HTTP API request: model=${modelName}, messages=${requestBody.messages.length}`);
      
      const response = await fetch(`${this.baseUrl}/v1/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[DedalusProvider] HTTP API error (${response.status}):`, errorText);
        console.error(`[DedalusProvider] Request body:`, JSON.stringify(requestBody, null, 2));
        throw new Error(`Dedalus API error (${response.status}): ${errorText}`);
      }

      const data: any = await response.json();
      const content = data.choices?.[0]?.message?.content;
      
      if (!content) {
        console.error('[DedalusProvider] No content in response. Full response:', JSON.stringify(data, null, 2));
        throw new Error('No content in Dedalus API response');
      }

      // Log the content for debugging
      console.log('[DedalusProvider] Received content length:', content.length);
      console.log('[DedalusProvider] Content preview:', content.substring(0, 200));

      // Return content as-is - let the caller handle schema validation
      // The parseAndValidate function will handle JSON extraction and validation
      return content;
    } catch (error: any) {
      console.error('[DedalusProvider] Error:', error);
      
      // If it's a 500 error, it might be a temporary Dedalus issue
      // Log detailed error for debugging
      if (error.status === 500 || error.message?.includes('500')) {
        console.error('[DedalusProvider] Dedalus API returned 500 - this may be a temporary issue with Dedalus service');
        console.error('[DedalusProvider] Check your API key and model name format');
      }
      
      throw new Error(`Dedalus API call failed: ${error.message}`);
    }
  }
}

/**
 * AgentRunner: orchestrates LLM calls with tool context, schema validation,
 * retry/repair, policy enforcement, and audit logging.
 */
export class AgentRunner {
  private adapters: Adapters;
  private llm: LLMProvider;

  constructor(config: AgentRunnerConfig) {
    this.adapters = config.adapters;
    this.llm = config.llmProvider || new MockLLMProvider();
  }

  /**
   * Generate daily digest: insights + quest + optional action.
   * Uses cost-effective models: Sonnet (primary) with Haiku fallback.
   */
  async generateDailyPayload(userId: string, models?: string[]): Promise<AgentResult<DailyDigestOutput>> {
    const ctx: ToolContext = { userId, adapters: this.adapters };

    // Gather context
    const { summary7d, summary30d } = buildDualSummary(userId);
    const budgets = await this.adapters.budget.getBudgets(userId);
    const activeQuest = await TOOLS.find(t => t.name === 'get_active_quest')!.execute(ctx, {});
    const recurring = await TOOLS.find(t => t.name === 'get_recurring_candidates')!.execute(ctx, {});

    const contextPrompt = buildDailyContextPrompt(summary7d, summary30d, budgets, activeQuest, recurring);

    // Use Sonnet (cost-effective, good quality) with Haiku fallback
    // Dedalus model format: anthropic/claude-{model}-{version}
    const modelList = models || ['anthropic/claude-3-5-sonnet-20241022', 'anthropic/claude-3-haiku-20240307'];

    let output: DailyDigestOutput;

    // Try LLM first
    const rawOutput = await this.llm.generate(DAILY_SYSTEM_PROMPT, contextPrompt, DailyDigestOutput, modelList);

    if (rawOutput) {
      const parsed = this.parseAndValidate(rawOutput, DailyDigestOutput);
      if (parsed) {
        output = this.enforceDailyPolicies(parsed, !!activeQuest);
      } else {
        // Retry with repair prompt
        const repairOutput = await this.llm.generate(
          DAILY_SYSTEM_PROMPT,
          `Your previous output was invalid JSON. Please try again with valid JSON.\n\n${contextPrompt}`,
          DailyDigestOutput,
          modelList
        );
        const repaired = this.parseAndValidate(repairOutput, DailyDigestOutput);
        output = repaired
          ? this.enforceDailyPolicies(repaired, !!activeQuest)
          : this.generateFallbackPayload(userId, summary7d, summary30d, budgets, !!activeQuest);
      }
    } else {
      // Fallback: deterministic generation
      output = this.generateFallbackPayload(userId, summary7d, summary30d, budgets, !!activeQuest);
    }

    // Log the decision
    const logId = this.logDecision(userId, 'DAILY_DIGEST', {
      summary7d_total: summary7d.total_spent,
      summary30d_total: summary30d.total_spent,
      has_active_quest: !!activeQuest,
      budget_count: budgets.length,
    }, output);

    return { output, logId };
  }

  /**
   * Generate a chat response grounded in app state.
   * Uses Haiku (cheapest, fastest) for real-time chat with Sonnet fallback.
   */
  async generateChatResponse(userId: string, userMessage: string, models?: string[]): Promise<AgentResult<ChatResponseOutput>> {
    const ctx: ToolContext = { userId, adapters: this.adapters };

    const { summary7d, summary30d } = buildDualSummary(userId);
    const budgets = await this.adapters.budget.getBudgets(userId);
    const activeQuest = await TOOLS.find(t => t.name === 'get_active_quest')!.execute(ctx, {});
    const scottyState = await TOOLS.find(t => t.name === 'get_scotty_state')!.execute(ctx, {});

    const contextPrompt = `User message: "${userMessage}"

Context:
- 7-day spending: $${summary7d.total_spent} across ${summary7d.transaction_count} transactions
- 30-day spending: $${summary30d.total_spent}
- Top categories (7d): ${JSON.stringify(summary7d.by_category)}
- Budgets: ${JSON.stringify(budgets)}
- Active quest: ${activeQuest ? activeQuest.title : 'none'}
- Scotty happiness: ${scottyState.happiness}/100

Respond as Scotty, a friendly Scottish Terrier financial buddy. Keep it concise and grounded in the data above.`;

    // Use Haiku (cheapest, fastest) for chat with Sonnet fallback
    // Dedalus model format: anthropic/claude-{model}-{version}
    const modelList = models || ['anthropic/claude-3-haiku-20240307', 'anthropic/claude-3-5-sonnet-20241022'];

    let output: ChatResponseOutput;
    const rawOutput = await this.llm.generate(CHAT_SYSTEM_PROMPT, contextPrompt, ChatResponseOutput, modelList);

    if (rawOutput) {
      const parsed = this.parseAndValidate(rawOutput, ChatResponseOutput);
      if (parsed) {
        output = parsed;
      } else {
        // Try to fix the response if it has validation issues
        try {
          const jsonMatch = rawOutput.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            const rawJson = JSON.parse(jsonMatch[0]);
            
            // Fix recommended_actions if they're strings
            if (Array.isArray(rawJson.recommended_actions) && rawJson.recommended_actions.length > 0) {
              if (typeof rawJson.recommended_actions[0] === 'string') {
                console.warn('[AgentRunner] Converting string recommended_actions to empty array');
                rawJson.recommended_actions = [];
              } else {
                // Truncate to max 2 items if there are more
                if (rawJson.recommended_actions.length > 2) {
                  console.warn(`[AgentRunner] Truncating recommended_actions from ${rawJson.recommended_actions.length} to 2 items`);
                  rawJson.recommended_actions = rawJson.recommended_actions.slice(0, 2);
                }
              }
            }
            
            // Validate again
            const fixed = ChatResponseOutput.parse(rawJson);
            output = fixed;
          } else {
            output = this.generateFallbackChat(userMessage, summary7d, summary30d);
          }
        } catch {
          output = this.generateFallbackChat(userMessage, summary7d, summary30d);
        }
      }
    } else {
      output = this.generateFallbackChat(userMessage, summary7d, summary30d);
    }

    const logId = this.logDecision(userId, 'USER_CHAT', {
      user_message_length: userMessage.length,
    }, output);

    return { output, logId };
  }

  private parseAndValidate<T>(raw: string, schema: z.ZodSchema<T>): T | null {
    try {
      // Try to parse the entire response as JSON first
      let parsed: any;
      try {
        parsed = JSON.parse(raw);
      } catch {
        // If that fails, try to extract JSON from the response
        const jsonMatch = raw.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
          console.warn('[AgentRunner] No JSON found in response:', raw.substring(0, 200));
          return null;
        }
        parsed = JSON.parse(jsonMatch[0]);
      }
      return schema.parse(parsed);
    } catch (error: any) {
      console.warn('[AgentRunner] Schema validation failed:', error.message);
      console.warn('[AgentRunner] Raw response:', raw.substring(0, 500));
      return null;
    }
  }

  private enforceDailyPolicies(output: DailyDigestOutput, hasActiveQuest: boolean): DailyDigestOutput {
    // Enforce insights count 1-3
    if (output.insights.length > 3) output.insights = output.insights.slice(0, 3);
    if (output.insights.length === 0) {
      output.insights = [{
        title: 'Daily Check-in',
        blurb: 'Scotty is keeping an eye on your spending today!',
        confidence: 'MEDIUM',
        metrics: {},
      }];
    }

    // No quest if one is already active
    if (hasActiveQuest) output.quest = null;

    // Validate quest is transaction-trackable (no self-report)
    if (output.quest) {
      const validTypes = ['CATEGORY_SPEND_CAP', 'MERCHANT_SPEND_CAP', 'NO_MERCHANT_CHARGE', 'TRANSFER_AMOUNT'];
      if (!validTypes.includes(output.quest.metric_type)) {
        output.quest = null;
      }
    }

    return output;
  }

  private generateFallbackPayload(
    userId: string,
    summary7d: any,
    summary30d: any,
    budgets: any[],
    hasActiveQuest: boolean
  ): DailyDigestOutput {
    const insights: DailyDigestOutput['insights'] = [];
    const today = new Date().toISOString().split('T')[0];

    // Win insight
    if (summary7d.total_spent < summary30d.total_spent / 4) {
      insights.push({
        title: 'Great Week!',
        blurb: `You've spent $${summary7d.total_spent.toFixed(2)} this week, which is below your 30-day average pace. Keep it up!`,
        confidence: 'HIGH',
        metrics: { window: '7d', total_spent: summary7d.total_spent },
      });
    } else {
      insights.push({
        title: 'Weekly Summary',
        blurb: `You've spent $${summary7d.total_spent.toFixed(2)} over the past 7 days across ${summary7d.transaction_count} transactions.`,
        confidence: 'HIGH',
        metrics: { window: '7d', total_spent: summary7d.total_spent },
      });
    }

    // Top category insight
    const topCat = Object.entries(summary7d.by_category as Record<string, number>)
      .sort(([, a], [, b]) => b - a)[0];
    if (topCat) {
      const budget = budgets.find(b => b.category === topCat[0]);
      const pct = budget ? Math.round((topCat[1] as number / budget.amount) * 100) : null;
      insights.push({
        title: `Top Spending: ${topCat[0]}`,
        blurb: pct !== null
          ? `${topCat[0]} leads at $${(topCat[1] as number).toFixed(2)} this week (${pct}% of your $${budget!.amount} monthly budget).`
          : `${topCat[0]} is your top category at $${(topCat[1] as number).toFixed(2)} this week.`,
        confidence: 'HIGH',
        metrics: { category: topCat[0], amount: topCat[1], budget_pct: pct },
      });
    }

    // Quest generation
    let quest: DailyDigestOutput['quest'] = null;
    if (!hasActiveQuest && topCat) {
      const dailyAvg = (topCat[1] as number) / 7;
      const cap = Math.round(dailyAvg * 0.8 * 100) / 100; // 20% reduction target
      quest = {
        title: `Keep ${topCat[0]} under $${cap.toFixed(2)} today`,
        metric_type: 'CATEGORY_SPEND_CAP',
        metric_params: { category: topCat[0], cap, window: 'daily' },
        reward_food_type: 'bone',
        happiness_delta: 5,
        window_hours: 24,
      };
    }

    return {
      insights,
      quest,
      action: null,
    };
  }

  private generateFallbackChat(
    userMessage: string,
    summary7d: any,
    summary30d: any
  ): ChatResponseOutput {
    const msg = userMessage.toLowerCase();

    if (msg.includes('how') && (msg.includes('doing') || msg.includes('am i'))) {
      return {
        message: `Woof! Here's your snapshot: You've spent $${summary7d.total_spent.toFixed(2)} this week and $${summary30d.total_spent.toFixed(2)} this month. ${summary7d.total_spent < summary30d.total_spent / 4 ? 'You\'re doing great — on track!' : 'Let\'s keep an eye on that spending together!'}`,
        recommended_actions: [],
      };
    }

    if (msg.includes('save') || msg.includes('budget')) {
      const topCat = Object.entries(summary7d.by_category as Record<string, number>)
        .sort(([, a], [, b]) => b - a)[0];
      return {
        message: topCat
          ? `Your biggest spending area is ${topCat[0]} at $${(topCat[1] as number).toFixed(2)} this week. Want me to set a quest to cut back?`
          : `You're doing well! I don't see any big spending spikes to worry about right now.`,
        recommended_actions: [],
      };
    }

    if (msg.includes('expense') || msg.includes('top') || msg.includes('spend')) {
      const merchants = summary7d.top_merchants?.slice(0, 3) || [];
      const list = merchants.map((m: any) => `${m.name}: $${m.total.toFixed(2)}`).join(', ');
      return {
        message: `Your top expenses this week: ${list || 'No transactions yet!'}`,
        recommended_actions: [],
      };
    }

    return {
      message: `Woof! I'm Scotty, your financial buddy. This week you've spent $${summary7d.total_spent.toFixed(2)}. Ask me about your spending, savings goals, or subscriptions!`,
      recommended_actions: [],
    };
  }

  private logDecision(
    userId: string,
    trigger: string,
    inputSummary: Record<string, any>,
    output: any
  ): string {
    const db = getDb();
    const id = uuid();
    db.prepare(`
      INSERT INTO agent_decision_log (id, user_id, trigger, input_summary, output, model_info)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      id, userId, trigger,
      JSON.stringify(inputSummary),
      JSON.stringify(output),
      JSON.stringify({
        provider: this.llm instanceof DedalusProvider ? 'dedalus' : this.llm instanceof ClaudeLLMProvider ? 'anthropic' : 'mock',
        model: 'dedalus-multi-model'
      })
    );
    return id;
  }
}

// ─── System Prompts ───

const DAILY_SYSTEM_PROMPT = `You are the AI engine for Scotty, a gamified financial management app with a pixel-art Scottish Terrier mascot.

Generate a daily digest as valid JSON matching this schema:
{
  "insights": [{ "title": string (max 80 chars), "blurb": string (max 280 chars), "confidence": "HIGH"|"MEDIUM"|"LOW", "metrics": {} }],
  "quest": { "title": string, "metric_type": "CATEGORY_SPEND_CAP"|"MERCHANT_SPEND_CAP"|"NO_MERCHANT_CHARGE"|"TRANSFER_AMOUNT", "metric_params": {}, "reward_food_type": "kibble"|"bone"|"steak"|"salmon"|"truffle", "happiness_delta": 1-20, "window_hours": 1-168 } or null,
  "action": { "type": "SUBSCRIPTION_REVIEW"|"BUDGET_SUGGESTION"|"SAVINGS_TIP"|"SPENDING_ALERT", "payload": {}, "requires_approval": true } or null
}

Rules:
- 1-3 insights per day. Include at least one positive/"win" when possible.
- At most 1 quest. Must be measurable via bank transactions only — no self-report.
- Quest types: category spend cap, merchant spend cap, no-merchant-charge verification, savings transfer detection.
- Label pending-derived data as provisional with MEDIUM/LOW confidence.
- Be concise, friendly, dog-themed.`;

const CHAT_SYSTEM_PROMPT = `You are Scotty, a friendly Scottish Terrier financial buddy in a gamified budgeting app.

Respond as valid JSON with this exact structure:
{
  "message": "your response message (max 1000 chars)",
  "recommended_actions": []
}

IMPORTANT: recommended_actions must be an empty array [] or an array of objects with this structure:
[
  {
    "type": "SAVINGS_TIP" | "BUDGET_SUGGESTION" | "SPENDING_ALERT" | "SUBSCRIPTION_REVIEW",
    "payload": {},
    "requires_approval": false
  }
]

Do NOT put strings in recommended_actions. Use an empty array [] if you have no structured actions to recommend.

Rules:
- Ground all responses in the provided financial data. Never make up numbers.
- Be friendly, concise, and use occasional dog puns.
- Never claim you can cancel subscriptions. Instead suggest "reviewing" or "verifying by absence of charges."
- Keep responses under 1000 characters.`;

function buildDailyContextPrompt(summary7d: any, summary30d: any, budgets: any[], activeQuest: any, recurring: any[]): string {
  return `Generate today's daily digest.

Financial Data:
- 7-day spending: $${summary7d.total_spent} across ${summary7d.transaction_count} transactions
- 30-day spending: $${summary30d.total_spent} across ${summary30d.transaction_count} transactions
- Categories (7d): ${JSON.stringify(summary7d.by_category)}
- Categories (30d): ${JSON.stringify(summary30d.by_category)}
- Top merchants (7d): ${JSON.stringify(summary7d.top_merchants)}
- Budgets: ${JSON.stringify(budgets)}
- Active quest: ${activeQuest ? JSON.stringify(activeQuest) : 'none'}
- Recurring charges detected: ${recurring.length > 0 ? JSON.stringify(recurring.slice(0, 5)) : 'none'}
- Pending transactions total: $${summary7d.pending_total}

Today: ${new Date().toISOString().split('T')[0]}`;
}

