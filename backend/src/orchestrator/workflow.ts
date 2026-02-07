import { v4 as uuid } from 'uuid';
import { getDb } from '../db/database';

/**
 * Dedalus Workflow Engine
 * 
 * A lightweight event-driven workflow orchestration system that:
 * - Ensures idempotency per workflow execution
 * - Provides retry logic with exponential backoff
 * - Logs workflow execution for observability
 * - Supports step-by-step execution with data passing
 */

export interface WorkflowStep<TInput = any, TOutput = any> {
  name: string;
  execute: (input: TInput, context: WorkflowContext) => Promise<TOutput>;
  retryPolicy?: {
    maxAttempts: number;
    backoffMs: number;
    exponential?: boolean;
  };
  timeoutMs?: number;
}

export interface WorkflowContext {
  workflowId: string;
  userId?: string;
  metadata?: Record<string, any>;
}

export interface WorkflowDefinition<TInput = any, TOutput = any> {
  id: string;
  name: string;
  idempotencyKey: (input: TInput) => string;
  steps: WorkflowStep<any, any>[];
}

export interface WorkflowExecution {
  id: string;
  workflowId: string;
  status: 'RUNNING' | 'COMPLETED' | 'FAILED';
  currentStep?: string;
  error?: string;
  startedAt: string;
  completedAt?: string;
}

export class WorkflowEngine {
  private db = getDb();

  constructor() {
    this.ensureTables();
  }

  private ensureTables() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS workflow_execution_log (
        id TEXT PRIMARY KEY,
        workflow_id TEXT NOT NULL,
        workflow_name TEXT NOT NULL,
        status TEXT NOT NULL CHECK(status IN ('RUNNING', 'COMPLETED', 'FAILED')),
        current_step TEXT,
        error TEXT,
        input_summary TEXT,
        output_summary TEXT,
        started_at TEXT NOT NULL DEFAULT (datetime('now')),
        completed_at TEXT
      );

      CREATE INDEX IF NOT EXISTS idx_workflow_execution_workflow_id ON workflow_execution_log(workflow_id);
      CREATE INDEX IF NOT EXISTS idx_workflow_execution_status ON workflow_execution_log(status);

      CREATE TABLE IF NOT EXISTS idempotency_key (
        key TEXT PRIMARY KEY,
        result TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
    `);
  }

  /**
   * Execute a workflow with idempotency checking
   */
  async execute<TInput, TOutput>(
    workflow: WorkflowDefinition<TInput, TOutput>,
    input: TInput
  ): Promise<TOutput> {
    const idempotencyKey = workflow.idempotencyKey(input);
    const db = this.db;

    // Atomic idempotency claim: INSERT OR IGNORE so only the first caller wins
    const insertResult = db.prepare(
      'INSERT OR IGNORE INTO idempotency_key (key, result) VALUES (?, NULL)'
    ).run(idempotencyKey);

    if (insertResult.changes === 0) {
      // Key already existed — another run claimed it. Return cached result if available.
      const existing = db.prepare('SELECT result, created_at FROM idempotency_key WHERE key = ?').get(idempotencyKey) as any;
      if (existing?.result) {
        console.log(`[WorkflowEngine] Idempotency hit for ${workflow.id}:${idempotencyKey}`);
        return JSON.parse(existing.result);
      }
      // Key claimed but no result yet — check if it's stale (older than 2 minutes)
      const ageMs = Date.now() - new Date(existing?.created_at || 0).getTime();
      if (ageMs > 120_000) {
        // Stale in-progress key — previous run crashed. Delete and re-claim.
        console.warn(`[WorkflowEngine] Stale idempotency key (${Math.round(ageMs / 1000)}s old), clearing: ${idempotencyKey}`);
        db.prepare('DELETE FROM idempotency_key WHERE key = ? AND result IS NULL').run(idempotencyKey);
        db.prepare('INSERT OR IGNORE INTO idempotency_key (key, result) VALUES (?, NULL)').run(idempotencyKey);
        // Fall through to re-execute the workflow
      } else {
        // Recent concurrent run in progress — return empty to avoid double-execution
        console.log(`[WorkflowEngine] Idempotency claimed (in-progress) for ${workflow.id}:${idempotencyKey}`);
        return {} as TOutput;
      }
    }

    const workflowId = uuid();
    const executionId = uuid();
    const context: WorkflowContext = {
      workflowId,
      userId: (input as any).userId,
      metadata: {},
    };

    // Log workflow start
    db.prepare(`
      INSERT INTO workflow_execution_log (id, workflow_id, workflow_name, status, input_summary, started_at)
      VALUES (?, ?, ?, 'RUNNING', ?, datetime('now'))
    `).run(executionId, workflow.id, workflow.name, JSON.stringify(this.summarizeInput(input)));

    let lastOutput: any = input;
    let currentStepName = '';

    try {
      for (let i = 0; i < workflow.steps.length; i++) {
        const step = workflow.steps[i];
        currentStepName = step.name;

        db.prepare(`
          UPDATE workflow_execution_log SET current_step = ? WHERE id = ?
        `).run(currentStepName, executionId);

        console.log(`[WorkflowEngine] Executing step: ${workflow.id} -> ${currentStepName}`);

        const stepOutput = await this.executeStep(step, lastOutput, context);
        lastOutput = stepOutput;
      }

      // Mark workflow as completed
      db.prepare(`
        UPDATE workflow_execution_log
        SET status = 'COMPLETED', current_step = NULL, output_summary = ?, completed_at = datetime('now')
        WHERE id = ?
      `).run(JSON.stringify(this.summarizeInput(lastOutput)), executionId);

      // Store result for idempotency (UPDATE the placeholder row)
      db.prepare('UPDATE idempotency_key SET result = ? WHERE key = ?')
        .run(JSON.stringify(lastOutput), idempotencyKey);

      console.log(`[WorkflowEngine] Workflow ${workflow.id} completed successfully`);
      return lastOutput as TOutput;
    } catch (error: any) {
      const errorMessage = error?.message || String(error);

      db.prepare(`
        UPDATE workflow_execution_log
        SET status = 'FAILED', error = ?, completed_at = datetime('now')
        WHERE id = ?
      `).run(errorMessage, executionId);

      // Remove the idempotency placeholder so the workflow can be retried
      db.prepare('DELETE FROM idempotency_key WHERE key = ? AND result IS NULL').run(idempotencyKey);

      console.error(`[WorkflowEngine] Workflow ${workflow.id} failed at step ${currentStepName}:`, errorMessage);
      throw new Error(`Workflow ${workflow.id} failed at step ${currentStepName}: ${errorMessage}`);
    }
  }

  private async executeStep<TInput, TOutput>(
    step: WorkflowStep<TInput, TOutput>,
    input: TInput,
    context: WorkflowContext
  ): Promise<TOutput> {
    const retryPolicy = step.retryPolicy || { maxAttempts: 1, backoffMs: 0 };
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= retryPolicy.maxAttempts; attempt++) {
      try {
        // Execute with timeout if specified
        if (step.timeoutMs) {
          return await Promise.race([
            step.execute(input, context),
            new Promise<TOutput>((_, reject) =>
              setTimeout(() => reject(new Error(`Step ${step.name} timed out after ${step.timeoutMs}ms`)), step.timeoutMs)
            ),
          ]);
        } else {
          return await step.execute(input, context);
        }
      } catch (error: any) {
        lastError = error;
        if (attempt < retryPolicy.maxAttempts) {
          const backoff = retryPolicy.exponential
            ? retryPolicy.backoffMs * Math.pow(2, attempt - 1)
            : retryPolicy.backoffMs;
          console.warn(
            `[WorkflowEngine] Step ${step.name} failed (attempt ${attempt}/${retryPolicy.maxAttempts}), retrying in ${backoff}ms...`
          );
          await this.sleep(backoff);
        }
      }
    }

    throw lastError || new Error(`Step ${step.name} failed after ${retryPolicy.maxAttempts} attempts`);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private summarizeInput(input: any): any {
    if (typeof input === 'object' && input !== null) {
      const summary: any = {};
      for (const [key, value] of Object.entries(input)) {
        if (typeof value === 'string' && value.length > 100) {
          summary[key] = value.substring(0, 100) + '...';
        } else if (typeof value === 'object' && value !== null) {
          summary[key] = Array.isArray(value) ? `[Array(${value.length})]` : '{...}';
        } else {
          summary[key] = value;
        }
      }
      return summary;
    }
    return input;
  }

  /**
   * Get workflow execution history
   */
  getExecutionHistory(workflowId: string, limit: number = 10): WorkflowExecution[] {
    const rows = this.db
      .prepare(
        `SELECT * FROM workflow_execution_log 
         WHERE workflow_id = ? 
         ORDER BY started_at DESC 
         LIMIT ?`
      )
      .all(workflowId, limit) as any[];

    return rows.map(row => ({
      id: row.id,
      workflowId: row.workflow_id,
      status: row.status as WorkflowExecution['status'],
      currentStep: row.current_step || undefined,
      error: row.error || undefined,
      startedAt: row.started_at,
      completedAt: row.completed_at || undefined,
    }));
  }
}

