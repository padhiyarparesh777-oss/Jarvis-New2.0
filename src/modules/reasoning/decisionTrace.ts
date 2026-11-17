/**
 * User-safe decision audit trail.
 * Store decisions, tool names, durations and outcomes — never hidden chain-of-thought,
 * raw prompts, credentials, or private message bodies.
 */
export interface DecisionTraceEntry {
  readonly id: string;
  readonly timestamp: number;
  readonly stage: 'routing' | 'planning' | 'tool' | 'agent' | 'reflection';
  readonly decision: string;
  readonly outcome: 'selected' | 'completed' | 'rejected' | 'failed' | 'needs_confirmation';
  readonly durationMs?: number;
  readonly metadata?: Readonly<Record<string, string | number | boolean>>;
}

export class DecisionTrace {
  private readonly entries: DecisionTraceEntry[] = [];

  constructor(private readonly capacity = 200) {
    if (!Number.isInteger(capacity) || capacity < 1) {
      throw new Error('DecisionTrace capacity must be a positive integer.');
    }
  }

  record(entry: DecisionTraceEntry): void {
    if (!entry.id.trim() || !entry.decision.trim()) {
      throw new Error('Decision trace entries require an id and concise decision summary.');
    }
    this.entries.push(Object.freeze({ ...entry, metadata: entry.metadata ? Object.freeze({ ...entry.metadata }) : undefined }));
    if (this.entries.length > this.capacity) {
      this.entries.splice(0, this.entries.length - this.capacity);
    }
  }

  list(): readonly DecisionTraceEntry[] {
    return this.entries.slice();
  }

  clear(): void {
    this.entries.length = 0;
  }
}

export const decisionTrace = new DecisionTrace();
