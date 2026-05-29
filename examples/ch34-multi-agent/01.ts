// src/agents/base.agent.ts
import Anthropic from '@anthropic-ai/sdk';

export interface AgentConfig {
  name: string;
  model: 'claude-haiku-4-5' | 'claude-sonnet-4-5' | 'claude-opus-4-5';
  systemPrompt: string;
  maxTokens?: number;
  temperature?: number;
}

export interface AgentResult<T = string> {
  agentName: string;
  success: boolean;
  data?: T;
  error?: string;
  tokensUsed: number;
  durationMs: number;
}

export abstract class BaseAgent<TInput, TOutput> {
  protected client: Anthropic;
  protected config: AgentConfig;

  constructor(config: AgentConfig) {
    this.client = new Anthropic();
    this.config = config;
  }

  async run(input: TInput): Promise<AgentResult<TOutput>> {
    const startTime = Date.now();
    console.log(`[${this.config.name}] Starting...`);

    try {
      const data = await this.execute(input);
      const durationMs = Date.now() - startTime;

      console.log(`[${this.config.name}] Done in ${durationMs}ms`);

      return {
        agentName: this.config.name,
        success: true,
        data,
        tokensUsed: 0, // อัปเดตใน execute ถ้าต้องการ
        durationMs,
      };
    } catch (error: any) {
      const durationMs = Date.now() - startTime;
      console.error(`[${this.config.name}] Error: ${error.message}`);

      return {
        agentName: this.config.name,
        success: false,
        error: error.message,
        tokensUsed: 0,
        durationMs,
      };
    }
  }

  protected abstract execute(input: TInput): Promise<TOutput>;

  protected async ask(userMessage: string): Promise<{ text: string; tokens: number }> {
    const response = await this.client.messages.create({
      model: this.config.model,
      max_tokens: this.config.maxTokens || 2048,
      system: this.config.systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
    });

    const text = response.content[0].type === 'text' ? response.content[0].text : '';
    const tokens = response.usage.input_tokens + response.usage.output_tokens;

    return { text, tokens };
  }

  protected parseJSON<T>(text: string, fallback: T): T {
    try {
      const match = text.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
      return match ? JSON.parse(match[0]) : fallback;
    } catch {
      return fallback;
    }
  }
}
