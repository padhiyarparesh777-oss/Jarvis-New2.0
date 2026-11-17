import assert from 'node:assert/strict';
import { AgentRegistry, ExecutionContext, ToolRegistry } from '../src/core';
import { createContextSnapshot } from '../src/modules/awareness/contextSnapshot';
import { DecisionTrace } from '../src/modules/reasoning/decisionTrace';

const context: ExecutionContext = {
  sessionId: 'test-session',
  startedAt: 1,
  metadata: {},
};

async function run(): Promise<void> {
  const tools = new ToolRegistry();
  tools.register({
    name: 'echo',
    description: 'Returns the provided string.',
    execute: (input: string) => input,
  });
  assert.equal(await tools.execute('echo', 'hello', context), 'hello');
  assert.throws(() => tools.register({
    name: 'echo',
    description: 'Duplicate.',
    execute: () => 'no',
  }), /already registered/);
  await assert.rejects(() => tools.execute('missing', {}, context), /Unknown tool/);

  const agents = new AgentRegistry();
  agents.register({
    name: 'researcher',
    description: 'Research specialist.',
    run: async ({ task }) => ({ output: task, status: 'completed' }),
  });
  assert.equal(agents.get('researcher')?.name, 'researcher');
  assert.throws(() => agents.register({
    name: 'researcher',
    description: 'Duplicate.',
    run: async () => ({ output: '', status: 'failed' }),
  }), /already registered/);

  const snapshot = createContextSnapshot({
    sessionId: 'session-1',
    recentMemoryFacts: ['a', 'b', 'c'],
    maxMemoryFacts: 2,
    activeExecutionIds: ['job-1'],
    now: 123,
  });
  assert.deepEqual(snapshot.recentMemoryFacts, ['a', 'b']);
  assert.equal(snapshot.capturedAt, 123);
  assert.equal(Object.isFrozen(snapshot), true);

  const trace = new DecisionTrace(2);
  trace.record({ id: '1', timestamp: 1, stage: 'routing', decision: 'simple response', outcome: 'selected' });
  trace.record({ id: '2', timestamp: 2, stage: 'tool', decision: 'calculator', outcome: 'completed' });
  trace.record({ id: '3', timestamp: 3, stage: 'agent', decision: 'researcher', outcome: 'selected' });
  assert.deepEqual(trace.list().map((entry) => entry.id), ['2', '3']);
  trace.clear();
  assert.equal(trace.list().length, 0);

  console.log('Core architecture tests passed.');
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
