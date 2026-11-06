import type { AgentPlan, AgentStep, AgentToolDefinition } from './AgentContracts';

export interface PlanValidationResult {
  valid: boolean;
  errors: string[];
  orderedSteps: AgentStep[];
}

/**
 * Validates a tool plan and returns a dependency-safe execution order.
 * It does not invent tools or execute actions.
 */
export function validateAgentPlan(
  plan: AgentPlan,
  tools: AgentToolDefinition[],
  maxSteps = 20
): PlanValidationResult {
  const errors: string[] = [];
  const orderedSteps: AgentStep[] = [];
  const toolIds = new Set(tools.map((tool) => tool.id));
  const stepIds = new Set<string>();

  if (!plan.id.trim()) errors.push('Plan ID is required.');
  if (!plan.goal.trim()) errors.push('Plan goal is required.');
  if (!Array.isArray(plan.steps) || plan.steps.length === 0) {
    errors.push('Plan must contain at least one step.');
    return { valid: false, errors, orderedSteps };
  }
  if (plan.steps.length > maxSteps) errors.push(`Plan exceeds the ${maxSteps}-step limit.`);

  for (const step of plan.steps) {
    if (!step.id.trim()) errors.push('Every step must have an ID.');
    if (stepIds.has(step.id)) errors.push(`Duplicate step ID: ${step.id}`);
    stepIds.add(step.id);
    if (!toolIds.has(step.toolId)) errors.push(`Unknown tool: ${step.toolId}`);
    if (!step.input || typeof step.input !== 'object' || Array.isArray(step.input)) {
      errors.push(`Step ${step.id} input must be an object.`);
    }
  }

  if (errors.length) return { valid: false, errors, orderedSteps };

  const byId = new Map(plan.steps.map((step) => [step.id, step]));
  const pending = new Set(plan.steps.map((step) => step.id));
  const completed = new Set<string>();

  while (pending.size > 0) {
    let progressed = false;
    for (const step of plan.steps) {
      if (!pending.has(step.id)) continue;
      const dependencies = step.dependsOn ?? [];
      const missing = dependencies.filter((id) => !byId.has(id));
      if (missing.length) {
        errors.push(`Step ${step.id} depends on missing step(s): ${missing.join(', ')}`);
        pending.delete(step.id);
        progressed = true;
        continue;
      }
      if (dependencies.every((id) => completed.has(id))) {
        orderedSteps.push(step);
        completed.add(step.id);
        pending.delete(step.id);
        progressed = true;
      }
    }
    if (!progressed) {
      errors.push('Plan contains a dependency cycle.');
      break;
    }
  }

  return { valid: errors.length === 0, errors, orderedSteps };
}
