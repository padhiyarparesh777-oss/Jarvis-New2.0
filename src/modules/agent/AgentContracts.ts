export type AgentRisk = 'read' | 'local_write' | 'external' | 'destructive';

export interface AgentToolDefinition {
  id: string;
  name: string;
  description: string;
  risk: AgentRisk;
  requiresPermission?: string;
}

export interface AgentStep {
  id: string;
  toolId: string;
  input: Record<string, unknown>;
  dependsOn?: string[];
  description?: string;
}

export interface AgentPlan {
  id: string;
  goal: string;
  createdAt: number;
  steps: AgentStep[];
}

export interface AgentToolResult {
  success: boolean;
  output?: unknown;
  error?: string;
  verified?: boolean;
}

export interface AgentStepReport {
  stepId: string;
  toolId: string;
  status: 'succeeded' | 'failed' | 'blocked' | 'cancelled';
  result?: AgentToolResult;
  detail: string;
}

export interface AgentExecutionReport {
  planId: string;
  status: 'completed' | 'partial' | 'failed' | 'cancelled';
  steps: AgentStepReport[];
  startedAt: number;
  finishedAt: number;
}

export interface AgentToolContext {
  signal: AbortSignal;
  plan: AgentPlan;
  step: AgentStep;
}

export type AgentToolHandler = (
  input: Record<string, unknown>,
  context: AgentToolContext
) => Promise<AgentToolResult>;

export interface AgentExecutionPolicy {
  /** Tool IDs explicitly trusted by the owner for repeat execution. */
  trustedToolIds: string[];
  /** If true, external and destructive tools still require per-run approval. */
  requireApprovalForExternal: boolean;
  /** If true, destructive tools always require per-run approval. */
  requireApprovalForDestructive: boolean;
}
