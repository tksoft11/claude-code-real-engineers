// src/ai/claude.service.ts
import Anthropic from '@anthropic-ai/sdk';
import { traceClaudeCall } from '../observability/langfuse.client';
import { recordAICall } from '../observability/metrics';
import { aiLogger } from '../observability/logger';

const client = new Anthropic();

export interface AICallOptions {
  feature: string;       // ชื่อ feature (e.g. "chat", "summarize", "review")
  userId?: string;
  sessionId?: string;
  model?: string;
  maxTokens?: number;
  system?: string;
}

export async function callClaude(
  prompt: string,
  opts: AICallOptions
): Promise<string> {
  const model = opts.model || 'claude-haiku-4-5';
  const startTime = Date.now();

  aiLogger.request({
    feature: opts.feature,
    model,
    userId: opts.userId,
    promptLen: prompt.length,
  });

  try {
    const response = await traceClaudeCall(
      opts.feature,
      { prompt, system: opts.system, model },
      () => client.messages.create({
        model,
        max_tokens: opts.maxTokens || 1024,
        system: opts.system,
        messages: [{ role: 'user', content: prompt }],
      }),
      { userId: opts.userId, sessionId: opts.sessionId, tags: [opts.feature] }
    );

    const durationMs = Date.now() - startTime;
    const inputTokens = response.usage.input_tokens;
    const outputTokens = response.usage.output_tokens;
    const costUsd = estimateCost(model, inputTokens, outputTokens);
    const text = response.content[0].type === 'text' ? response.content[0].text : '';

    recordAICall({ model, feature: opts.feature, status: 'success', durationMs, inputTokens, outputTokens });
    aiLogger.response({ feature: opts.feature, model, durationMs, inputTokens, outputTokens, costUsd });

    return text;
  } catch (error) {
    const durationMs = Date.now() - startTime;
    const errorType = error instanceof Anthropic.APIError ? `${error.status}` : 'unknown';

    recordAICall({ model, feature: opts.feature, status: 'error', durationMs, errorType });
    aiLogger.error({
      feature: opts.feature, model,
      error: error instanceof Error ? error.message : 'Unknown error',
      userId: opts.userId,
    });
    throw error;
  }
}

function estimateCost(model: string, input: number, output: number): number {
  const pricing: Record<string, { input: number; output: number }> = {
    'claude-haiku-4-5':  { input: 0.00025, output: 0.00125 },
    'claude-sonnet-4-5': { input: 0.003,   output: 0.015   },
    'claude-opus-4-5':   { input: 0.015,   output: 0.075   },
  };
  const p = pricing[model] || pricing['claude-haiku-4-5'];
  return (input / 1000) * p.input + (output / 1000) * p.output;
}
