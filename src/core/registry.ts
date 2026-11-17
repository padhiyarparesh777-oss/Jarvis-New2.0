import { AgentDefinition, assertValidName, ToolDefinition } from './contracts';

/**
 * Explicit registries avoid runtime filesystem scanning, which is unreliable
 * in browser and Capacitor builds. Registration happens at the composition root.
 */
export class ToolRegistry {
  private readonly tools = new Map<string, ToolDefinition<unknown, unknown>>();

  register<TInput, TOutput>(tool: ToolDefinition<TInput, TOutput>): void {
    assertValidName(tool.name, 'Tool');
    if (this.tools.has(tool.name)) {
      throw new Error(`Tool already registered: ${tool.name}`);
    }
    this.tools.set(tool.name, tool as ToolDefinition<unknown, unknown>);
  }

  get(name: string): ToolDefinition<unknown, unknown> | undefined {
    return this.tools.get(name);
  }

  list(): readonly Pick<ToolDefinition<unknown, unknown>, 'name' | 'description'>[] {
    return Array.from(this.tools.values(), ({ name, description }) => ({ name, description }));
  }

  async execute(
    name: string,
    input: unknown,
    context: Parameters<ToolDefinition<unknown, unknown>['execute']>[1]
  ): Promise<unknown> {
    const tool = this.get(name);
    if (!tool) throw new Error(`Unknown tool: ${name}`);
    if (context.signal?.aborted) throw new Error('Tool execution cancelled.');
    return tool.execute(input, context);
  }
}

export class AgentRegistry {
  private readonly agents = new Map<string, AgentDefinition>();

  register(agent: AgentDefinition): void {
    assertValidName(agent.name, 'Agent');
    if (this.agents.has(agent.name)) {
      throw new Error(`Agent already registered: ${agent.name}`);
    }
    this.agents.set(agent.name, agent);
  }

  get(name: string): AgentDefinition | undefined {
    return this.agents.get(name);
  }

  list(): readonly Pick<AgentDefinition, 'name' | 'description'>[] {
    return Array.from(this.agents.values(), ({ name, description }) => ({ name, description }));
  }
}

export const toolRegistry = new ToolRegistry();
export const agentRegistry = new AgentRegistry();
