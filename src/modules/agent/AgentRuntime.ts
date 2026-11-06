import type {
  AgentExecutionPolicy,
  AgentExecutionReport,
  AgentPlan,
  AgentStepReport,
  AgentToolDefinition,
  AgentToolHandler,
} from './AgentContracts';
import { DEFAULT_AGENT_POLICY, evaluateToolPolicy } from './AgentExecutionPolicy';
import { validateAgentPlan } from './AgentPlanner';

export interface AgentRuntimeOptions {
  policy?: AgentExecutionPolicy;
  approve?: (tool: AgentToolDefinition, stepId: string) => Promise<boolean>;
  onStep?: (report: AgentStepReport) => void;
}

/**
 * Sequential, cancellable tool runtime. Tool execution is always delegated to
 * explicitly registered native/backend adapters; this class never fabricates success.
 */
export class AgentRuntime {
  private readonly definitions = new Map<string, AgentToolDefinition>();
  private readonly handlers = new Map<string, AgentToolHandler>();

  registerTool(definition: AgentToolDefinition, handler: AgentToolHandler): void {
    if (!definition.id.trim()) throw new Error('Tool ID is required.');
    if (this.definitions.has(definition.id)) throw new Error(`Tool already registered: ${definition.id}`);
    this.definitions.set(definition.id, definition);
    this.handlers.set(definition.id, handler);
  }

  listTools(): AgentToolDefinition[] {
    return [...this.definitions.values()];
  }

  async executePlan(plan: AgentPlan, signal: AbortSignal, options: AgentRuntimeOptions = {}): Promise<AgentExecutionReport> {
    const startedAt = Date.now();
    const policy = options.policy ?? DEFAULT_AGENT_POLICY;
    const validation = validateAgentPlan(plan, this.listTools());
    const reports: AgentStepReport[] = [];

    if (!validation.valid) {
      return {
        planId: plan.id, status: 'failed', steps: [{
          stepId: 'validation', toolId: 'planner', status: 'failed',
          detail: validation.errors.join(' '),
        }], startedAt, finishedAt: Date.now(),
      };
    }

    for (const step of validation.orderedSteps) {
      if (signal.aborted) {
        reports.push({ stepId: step.id, toolId: step.toolId, status: 'cancelled', detail: 'Execution cancelled by owner.' });
        break;
      }

      const definition = this.definitions.get(step.toolId)!;
      const handler = this.handlers.get(step.toolId)!;
      const decision = evaluateToolPolicy(definition, policy);

      if (!decision.allowed) {
        const report: AgentStepReport = { stepId: step.id, toolId: step.toolId, status: 'blocked', detail: decision.reason };
        reports.push(report);
        options.onStep?.(report);
        break;
      }

      if (decision.approvalRequired) {
        const approved = options.approve ? await options.approve(definition, step.id) : false;
        if (!approved) {
          const report: AgentStepReport = { stepId: step.id, toolId: step.toolId, status: 'blocked', detail: 'Owner approval was not granted.' };
          reports.push(report);
          options.onStep?.(report);
          break;
        }
      }

      try {
        const result = await handler(step.input, { signal, plan, step });
        const report: AgentStepReport = {
          stepId: step.id,
          toolId: step.toolId,
          status: result.success ? 'succeeded' : 'failed',
          result,
          detail: result.success ? (result.verified ? 'Action completed and verified.' : 'Action completed; verification unavailable.') : (result.error || 'Tool execution failed.'),
        };
        reports.push(report);
        options.onStep?.(report);
        if (!result.success) break;
      } catch (error) {
        const report: AgentStepReport = {
          stepId: step.id, toolId: step.toolId, status: 'failed',
          detail: error instanceof Error ? error.message : 'Unknown tool execution error.',
        };
        reports.push(report);
        options.onStep?.(report);
        break;
      }
    }

    const hasFailure = reports.some((item) => item.status === 'failed' || item.status === 'blocked');
    const cancelled = signal.aborted || reports.some((item) => item.status === 'cancelled');
    const completedCount = reports.filter((item) => item.status === 'succeeded').length;
    const status = cancelled ? 'cancelled' : hasFailure ? (completedCount > 0 ? 'partial' : 'failed') : 'completed';

    return { planId: plan.id, status, steps: reports, startedAt, finishedAt: Date.now() };
  }
}
