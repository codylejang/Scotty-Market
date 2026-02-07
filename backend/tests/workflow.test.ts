import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDb, getDb } from '../src/db/database';
import { WorkflowEngine, WorkflowDefinition, WorkflowStep } from '../src/orchestrator/workflow';

beforeEach(() => {
  createTestDb();
});

describe('Dedalus Workflow Engine', () => {
  it('should execute a simple workflow with multiple steps', async () => {
    const engine = new WorkflowEngine();
    let step1Executed = false;
    let step2Executed = false;
    let step3Executed = false;

    const workflow: WorkflowDefinition<{ value: number }, { result: number }> = {
      id: 'test_workflow',
      name: 'Test Workflow',
      idempotencyKey: (input) => `test:${input.value}`,
      steps: [
        {
          name: 'step1',
          execute: async (input) => {
            step1Executed = true;
            return { ...input, step1: true };
          },
        },
        {
          name: 'step2',
          execute: async (input) => {
            step2Executed = true;
            return { ...input, step2: true };
          },
        },
        {
          name: 'step3',
          execute: async (input) => {
            step3Executed = true;
            return { result: input.value * 2 };
          },
        },
      ],
    };

    const result = await engine.execute(workflow, { value: 5 });

    expect(step1Executed).toBe(true);
    expect(step2Executed).toBe(true);
    expect(step3Executed).toBe(true);
    expect(result.result).toBe(10);
  });

  it('should enforce idempotency - second call returns cached result', async () => {
    const engine = new WorkflowEngine();
    let executionCount = 0;

    const workflow: WorkflowDefinition<{ id: string }, { count: number }> = {
      id: 'idempotency_test',
      name: 'Idempotency Test',
      idempotencyKey: (input) => `idempotent:${input.id}`,
      steps: [
        {
          name: 'count_step',
          execute: async (input) => {
            executionCount++;
            return { count: executionCount };
          },
        },
      ],
    };

    const result1 = await engine.execute(workflow, { id: 'test-123' });
    expect(executionCount).toBe(1);
    expect(result1.count).toBe(1);

    // Second execution should return cached result
    const result2 = await engine.execute(workflow, { id: 'test-123' });
    expect(executionCount).toBe(1); // Should still be 1, not 2
    expect(result2.count).toBe(1); // Should return cached result
  });

  it('should retry failed steps with exponential backoff', async () => {
    const engine = new WorkflowEngine();
    let attemptCount = 0;

    const workflow: WorkflowDefinition<{}, { success: boolean }> = {
      id: 'retry_test',
      name: 'Retry Test',
      idempotencyKey: () => `retry:${Date.now()}`,
      steps: [
        {
          name: 'flaky_step',
          execute: async () => {
            attemptCount++;
            if (attemptCount < 3) {
              throw new Error('Temporary failure');
            }
            return { success: true };
          },
          retryPolicy: {
            maxAttempts: 3,
            backoffMs: 10, // Short backoff for testing
            exponential: true,
          },
        },
      ],
    };

    const result = await engine.execute(workflow, {});
    expect(attemptCount).toBe(3);
    expect(result.success).toBe(true);
  });

  it('should fail workflow if retries are exhausted', async () => {
    const engine = new WorkflowEngine();

    const workflow: WorkflowDefinition<{}, { success: boolean }> = {
      id: 'failure_test',
      name: 'Failure Test',
      idempotencyKey: () => `failure:${Date.now()}`,
      steps: [
        {
          name: 'always_fails',
          execute: async () => {
            throw new Error('Always fails');
          },
          retryPolicy: {
            maxAttempts: 2,
            backoffMs: 10,
          },
        },
      ],
    };

    await expect(engine.execute(workflow, {})).rejects.toThrow();
  });

  it('should log workflow execution to database', async () => {
    const engine = new WorkflowEngine();

    const workflow: WorkflowDefinition<{ test: string }, { result: string }> = {
      id: 'logging_test',
      name: 'Logging Test',
      idempotencyKey: (input) => `log:${input.test}`,
      steps: [
        {
          name: 'log_step',
          execute: async (input) => {
            return { result: `processed:${input.test}` };
          },
        },
      ],
    };

    await engine.execute(workflow, { test: 'hello' });

    const db = getDb();
    const logs = db
      .prepare(
        `SELECT * FROM workflow_execution_log WHERE workflow_id = 'logging_test' ORDER BY started_at DESC LIMIT 1`
      )
      .get() as any;

    expect(logs).toBeDefined();
    expect(logs.workflow_id).toBe('logging_test');
    expect(logs.status).toBe('COMPLETED');
    expect(logs.current_step).toBeNull(); // Should be null when completed
  });

  it('should track current step during execution', async () => {
    const engine = new WorkflowEngine();

    const workflow: WorkflowDefinition<{}, { done: boolean }> = {
      id: 'step_tracking_test',
      name: 'Step Tracking Test',
      idempotencyKey: () => `track:${Date.now()}`,
      steps: [
        {
          name: 'step_a',
          execute: async () => {
            // Small delay to ensure step is logged
            await new Promise(resolve => setTimeout(resolve, 10));
            return {};
          },
        },
        {
          name: 'step_b',
          execute: async () => {
            return { done: true };
          },
        },
      ],
    };

    await engine.execute(workflow, {});

    const db = getDb();
    const logs = db
      .prepare(
        `SELECT * FROM workflow_execution_log WHERE workflow_id = 'step_tracking_test' ORDER BY started_at DESC LIMIT 1`
      )
      .get() as any;

    expect(logs).toBeDefined();
    expect(logs.status).toBe('COMPLETED');
  });

  it('should pass data between workflow steps', async () => {
    const engine = new WorkflowEngine();

    const workflow: WorkflowDefinition<{ start: number }, { final: number }> = {
      id: 'data_passing_test',
      name: 'Data Passing Test',
      idempotencyKey: (input) => `data:${input.start}`,
      steps: [
        {
          name: 'multiply',
          execute: async (input) => {
            return { ...input, multiplied: input.start * 2 };
          },
        },
        {
          name: 'add',
          execute: async (input) => {
            return { final: input.multiplied + 10 };
          },
        },
      ],
    };

    const result = await engine.execute(workflow, { start: 5 });
    expect(result.final).toBe(20); // (5 * 2) + 10
  });

  it('should return workflow execution history', async () => {
    const engine = new WorkflowEngine();

    const workflow: WorkflowDefinition<{ id: string }, { done: boolean }> = {
      id: 'history_test',
      name: 'History Test',
      idempotencyKey: (input) => `history:${input.id}`,
      steps: [
        {
          name: 'complete',
          execute: async () => {
            return { done: true };
          },
        },
      ],
    };

    // Execute workflow twice (second will be idempotent)
    await engine.execute(workflow, { id: 'test-1' });
    await engine.execute(workflow, { id: 'test-1' });

    const history = engine.getExecutionHistory('history_test', 10);
    expect(history.length).toBeGreaterThan(0);
    expect(history[0].workflowId).toBe('history_test');
    expect(history[0].status).toBe('COMPLETED');
  });

  it('should handle workflow context with userId', async () => {
    const engine = new WorkflowEngine();
    let capturedUserId: string | undefined;

    const workflow: WorkflowDefinition<{ userId: string }, { processed: boolean }> = {
      id: 'context_test',
      name: 'Context Test',
      idempotencyKey: (input) => `context:${input.userId}`,
      steps: [
        {
          name: 'capture_context',
          execute: async (input, context) => {
            capturedUserId = context.userId;
            return { processed: true };
          },
        },
      ],
    };

    await engine.execute(workflow, { userId: 'user-123' });
    expect(capturedUserId).toBe('user-123');
  });
});

