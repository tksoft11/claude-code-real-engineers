// src/ai-gateway/providers/ollama.provider.ts
// Ollama = run Llama 3 locally, ฟรี 100% แต่ต้องมี GPU
import { AIProvider, AIResponse } from './types';

export class OllamaProvider implements AIProvider {
  name = 'ollama';
  private baseUrl = process.env.OLLAMA_URL || 'http://localhost:11434';

  async complete(prompt: string, system?: string, maxTokens = 1024): Promise<AIResponse> {
    const start = Date.now();
    const body = {
      model: 'llama3.2',
      prompt: system ? `${system}\n\n${prompt}` : prompt,
      stream: false,
      options: { num_predict: maxTokens },
    };

    const res = await fetch(`${this.baseUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!res.ok) throw new Error(`Ollama error: ${res.status}`);
    const data = await res.json() as { response: string; eval_count?: number };

    return {
      text: data.response,
      provider: 'ollama',
      model: 'llama3.2',
      inputTokens: 0,           // Ollama ไม่รายงาน input tokens
      outputTokens: data.eval_count || 0,
      latencyMs: Date.now() - start,
    };
  }
}
