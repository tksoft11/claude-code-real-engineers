// src/ai-gateway/providers/openai.provider.ts
import OpenAI from 'openai';
import { AIProvider, AIResponse } from './types';

export class OpenAIProvider implements AIProvider {
  name = 'openai';
  private client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  async complete(prompt: string, system?: string, maxTokens = 1024): Promise<AIResponse> {
    const start = Date.now();
    const response = await this.client.chat.completions.create({
      model: 'gpt-4o-mini',  // ใช้ mini เพื่อ cost efficiency ตอน fallback
      max_tokens: maxTokens,
      messages: [
        ...(system ? [{ role: 'system' as const, content: system }] : []),
        { role: 'user' as const, content: prompt },
      ],
    });
    return {
      text: response.choices[0]?.message?.content || '',
      provider: 'openai',
      model: 'gpt-4o-mini',
      inputTokens: response.usage?.prompt_tokens || 0,
      outputTokens: response.usage?.completion_tokens || 0,
      latencyMs: Date.now() - start,
    };
  }
}
