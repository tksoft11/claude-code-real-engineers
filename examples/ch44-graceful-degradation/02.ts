// src/ai-gateway/providers/types.ts
export interface AIProvider {
  name: string;
  complete(prompt: string, system?: string, maxTokens?: number): Promise<AIResponse>;
}

export interface AIResponse {
  text: string;
  provider: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  latencyMs: number;
}
