/** Shared, UI-agnostic contracts for JARVIS orchestration. */

export interface ExecutionLogger {
  info(event: string, metadata?: Record<string, unknown>): void;
  warn(event: string, metadata?: Record<string, unknown>): void;
  error(event: string, metadata?: Record<string, unknown>): void;
}

export interface ExecutionContext {
  readonly sessionId: string;
  readonly startedAt: number;
  readonly signal?: AbortSignal;
  readonly metadata: Readonly<Record<string, unknown>>;
  readonly logger?: ExecutionLogger;
}

export interface ToolDefinition<TInput = unknown, TOutput = unknown> {
  readonly name: string;
  readonly description: string;
  execute(input: TInput, context: ExecutionContext): Promise<TOutput> | TOutput;
}

export interface AgentRequest {
  readonly task: string;
  readonly context: ExecutionContext;
  readonly input?: unknown;
}

export interface AgentResult {
  readonly output: string;
  readonly status: 'completed' | 'delegated' | 'needs_confirmation' | 'failed';
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export interface AgentDefinition {
  readonly name: string;
  readonly description: string;
  run(request: AgentRequest): Promise<AgentResult>;
}

export function assertValidName(name: string, kind: string): void {
  if (!name || !name.trim()) {
    throw new Error(`${kind} name must not be empty.`);
  }
}
