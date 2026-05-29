// src/ai-gateway/providers/claude.provider.ts
import Anthropic from '@anthropic-ai/sdk';
import { AIProvider, AIResponse } from './types';

export class ClaudeProvider implements AIProvider {
  name = 'claude';
  private client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  async complete(prompt: string, system?: string, maxTokens = 1024): Promise<AIResponse> {
    const start = Date.now();
    const response = await this.client.messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: maxTokens,
      system,
      messages: [{ role: 'user', content: prompt }],
    });
    return {
      text: response.content[0].type === 'text' ? response.content[0].text : '',
      provider: 'anthropic',
      model: 'claude-sonnet-4-5',
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
      latencyMs: Date.now() - start,
    };
  }
}
