import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { validateAgentPlan } from '../src/modules/agent/AgentPlanner';
import { AgentRuntime } from '../src/modules/agent/AgentRuntime';
import { DEFAULT_AGENT_POLICY, evaluateToolPolicy } from '../src/modules/agent/AgentExecutionPolicy';
import type { AgentPlan, AgentToolDefinition } from '../src/modules/agent/AgentContracts';

const tools: AgentToolDefinition[] = [
  { id: 'read.status', name: 'Read status', description: 'Read device status', risk: 'read' },
  { id: 'message.send', name: 'Send message', description: 'Send an external message', risk: 'external' },
];

describe('JARVIS Agent foundation', () => {
  test('validates a plan and orders dependent steps', () => {
    const plan: AgentPlan = {
      id: 'plan-1', goal: 'Read then summarize', createdAt: 1,
      steps: [
        { id: 'second', toolId: 'read.status', input: {}, dependsOn: ['first'] },
        { id: 'first', toolId: 'read.status', input: {} },
      ],
    };
    const result = validateAgentPlan(plan, tools);
    assert.equal(result.valid, true);
    assert.deepEqual(result.orderedSteps.map((step) => step.id), ['first', 'second']);
  });

  test('rejects unknown tools and dependency cycles', () => {
    const unknown: AgentPlan = {
      id: 'plan-2', goal: 'Unknown tool', createdAt: 1,
      steps: [{ id: 'a', toolId: 'missing.tool', input: {} }],
    };
    assert.equal(validateAgentPlan(unknown, tools).valid, false);

    const cyclic: AgentPlan = {
      id: 'plan-3', goal: 'Cycle', createdAt: 1,
      steps: [
        { id: 'a', toolId: 'read.status', input: {}, dependsOn: ['b'] },
        { id: 'b', toolId: 'read.status', input: {}, dependsOn: ['a'] },
      ],
    };
    assert.match(validateAgentPlan(cyclic, tools).errors.join(' '), /cycle/i);
  });

  test('keeps read/local actions direct and gates external actions by default', () => {
    assert.equal(evaluateToolPolicy(tools[0], DEFAULT_AGENT_POLICY).approvalRequired, false);
    assert.equal(evaluateToolPolicy(tools[1], DEFAULT_AGENT_POLICY).approvalRequired, true);
  });

  test('executes registered adapters sequentially and reports verified success', async () => {
    const runtime = new AgentRuntime();
    const calls: string[] = [];
    runtime.registerTool(tools[0], async (_input, context) => {
      calls.push(context.step.id);
      return { success: true, output: { battery: 80 }, verified: true };
    });
    const plan: AgentPlan = {
      id: 'plan-4', goal: 'Read status twice', createdAt: 1,
      steps: [
        { id: 'a', toolId: 'read.status', input: {} },
        { id: 'b', toolId: 'read.status', input: {}, dependsOn: ['a'] },
      ],
    };
    const report = await runtime.executePlan(plan, new AbortController().signal);
    assert.equal(report.status, 'completed');
    assert.deepEqual(calls, ['a', 'b']);
    assert.equal(report.steps[0].detail, 'Action completed and verified.');
  });

  test('does not execute external tools without owner approval', async () => {
    const runtime = new AgentRuntime();
    let executed = false;
    runtime.registerTool(tools[1], async () => {
      executed = true;
      return { success: true, verified: true };
    });
    const report = await runtime.executePlan({
      id: 'plan-5', goal: 'Send a message', createdAt: 1,
      steps: [{ id: 'send', toolId: 'message.send', input: {} }],
    }, new AbortController().signal);
    assert.equal(executed, false);
    assert.equal(report.status, 'failed');
    assert.equal(report.steps[0].status, 'blocked');
  });
});
