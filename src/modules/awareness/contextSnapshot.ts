/**
 * Small, explicit context snapshot passed into orchestration/model calls.
 * Keep it bounded: do not place full chat transcripts, secrets or attachments here.
 */
export interface ContextSnapshot {
  readonly sessionId: string;
  readonly capturedAt: number;
  readonly currentTask?: string;
  readonly recentMemoryFacts: readonly string[];
  readonly activeExecutionIds: readonly string[];
  readonly environment: Readonly<Record<string, string | number | boolean>>;
}

export interface ContextSnapshotInput {
  sessionId: string;
  currentTask?: string;
  recentMemoryFacts?: readonly string[];
  activeExecutionIds?: readonly string[];
  environment?: Readonly<Record<string, string | number | boolean>>;
  now?: number;
  maxMemoryFacts?: number;
  maxExecutionIds?: number;
}

export function createContextSnapshot(input: ContextSnapshotInput): ContextSnapshot {
  if (!input.sessionId.trim()) throw new Error('Context snapshot requires a sessionId.');

  const maxMemoryFacts = Math.max(0, Math.min(input.maxMemoryFacts ?? 8, 20));
  const maxExecutionIds = Math.max(0, Math.min(input.maxExecutionIds ?? 10, 50));

  return Object.freeze({
    sessionId: input.sessionId,
    capturedAt: input.now ?? Date.now(),
    ...(input.currentTask ? { currentTask: input.currentTask.slice(0, 500) } : {}),
    recentMemoryFacts: Object.freeze((input.recentMemoryFacts ?? []).slice(0, maxMemoryFacts)),
    activeExecutionIds: Object.freeze((input.activeExecutionIds ?? []).slice(0, maxExecutionIds)),
    environment: Object.freeze({ ...(input.environment ?? {}) }),
  });
}
