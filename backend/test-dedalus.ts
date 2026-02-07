/**
 * Manual test script for Dedalus Workflow Engine
 * 
 * Run with: npx tsx test-dedalus.ts
 */

import { WorkflowEngine, WorkflowDefinition } from './src/orchestrator/workflow';
import { initDb } from './src/db/database';

// Initialize database
initDb();

const engine = new WorkflowEngine();

console.log('🧪 Testing Dedalus Workflow Engine...\n');

// Test 1: Simple workflow execution
console.log('Test 1: Simple workflow execution');
const simpleWorkflow: WorkflowDefinition<{ name: string }, { greeting: string }> = {
  id: 'simple_test',
  name: 'Simple Test Workflow',
  idempotencyKey: (input) => `simple:${input.name}`,
  steps: [
    {
      name: 'greet',
      execute: async (input) => {
        return { greeting: `Hello, ${input.name}!` };
      },
    },
  ],
};

const result1 = await engine.execute(simpleWorkflow, { name: 'Scotty' });
console.log('✅ Result:', result1);
console.log('');

// Test 2: Multi-step workflow
console.log('Test 2: Multi-step workflow with data passing');
const multiStepWorkflow: WorkflowDefinition<
  { start: number },
  { final: number; steps: string[] }
> = {
  id: 'multi_step_test',
  name: 'Multi-Step Test',
  idempotencyKey: (input) => `multi:${input.start}:${Date.now()}`,
  steps: [
    {
      name: 'double',
      execute: async (input) => {
        return { ...input, doubled: input.start * 2, steps: ['doubled'] };
      },
    },
    {
      name: 'add_ten',
      execute: async (input) => {
        return {
          ...input,
          final: input.doubled + 10,
          steps: [...input.steps, 'added_ten'],
        };
      },
    },
    {
      name: 'finalize',
      execute: async (input) => {
        return {
          final: input.final,
          steps: [...input.steps, 'finalized'],
        };
      },
    },
  ],
};

const result2 = await engine.execute(multiStepWorkflow, { start: 5 });
console.log('✅ Result:', result2);
console.log('   Expected: final = 20 (5 * 2 + 10)');
console.log('');

// Test 3: Idempotency
console.log('Test 3: Idempotency check');
const idempotentWorkflow: WorkflowDefinition<{ id: string }, { count: number }> = {
  id: 'idempotency_demo',
  name: 'Idempotency Demo',
  idempotencyKey: (input) => `idempotent:${input.id}`,
  steps: [
    {
      name: 'count',
      execute: async (input) => {
        console.log(`   Executing for id: ${input.id}`);
        return { count: Math.random() };
      },
    },
  ],
};

const result3a = await engine.execute(idempotentWorkflow, { id: 'test-123' });
console.log('✅ First execution - count:', result3a.count);

const result3b = await engine.execute(idempotentWorkflow, { id: 'test-123' });
console.log('✅ Second execution (should be cached) - count:', result3b.count);
console.log('   Same count?', result3a.count === result3b.count);
console.log('');

// Test 4: Workflow history
console.log('Test 4: Workflow execution history');
const history = engine.getExecutionHistory('simple_test', 5);
console.log(`✅ Found ${history.length} execution(s) for 'simple_test'`);
if (history.length > 0) {
  console.log('   Latest execution:', {
    status: history[0].status,
    startedAt: history[0].startedAt,
    completedAt: history[0].completedAt,
  });
}
console.log('');

console.log('🎉 All Dedalus tests completed successfully!');
console.log('\nTo run the full test suite: npm test');

