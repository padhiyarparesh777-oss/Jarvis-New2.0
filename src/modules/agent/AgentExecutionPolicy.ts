import type { AgentExecutionPolicy, AgentRisk, AgentToolDefinition } from './AgentContracts';

export type PolicyDecision =
  | { allowed: true; approvalRequired: false; reason: string }
  | { allowed: true; approvalRequired: true; reason: string }
  | { allowed: false; approvalRequired: false; reason: string };

export const DEFAULT_AGENT_POLICY: AgentExecutionPolicy = {
  trustedToolIds: [],
  requireApprovalForExternal: true,
  requireApprovalForDestructive: true,
};

export function evaluateToolPolicy(
  tool: AgentToolDefinition,
  policy: AgentExecutionPolicy = DEFAULT_AGENT_POLICY
): PolicyDecision {
  const risk: AgentRisk = tool.risk;
  const trusted = policy.trustedToolIds.includes(tool.id);

  if (risk === 'read' || risk === 'local_write') {
    return { allowed: true, approvalRequired: false, reason: 'Local/read action is allowed by default.' };
  }
  if (risk === 'external' && policy.requireApprovalForExternal && !trusted) {
    return { allowed: true, approvalRequired: true, reason: 'External communication or service action needs owner approval.' };
  }
  if (risk === 'destructive' && policy.requireApprovalForDestructive) {
    return { allowed: true, approvalRequired: true, reason: 'Irreversible action needs owner approval.' };
  }
  return { allowed: true, approvalRequired: false, reason: trusted ? 'Owner-trusted tool.' : 'Allowed by configured policy.' };
}
