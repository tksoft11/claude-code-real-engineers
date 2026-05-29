// src/observability/langfuse.client.ts
import { Langfuse } from 'langfuse';

// Langfuse client — connect ไป Langfuse Cloud หรือ self-hosted
export const langfuse = new Langfuse({
  publicKey: process.env.LANGFUSE_PUBLIC_KEY!,
  secretKey: process.env.LANGFUSE_SECRET_KEY!,
  baseUrl: process.env.LANGFUSE_BASE_URL || 'https://cloud.langfuse.com',
  flushAt: 10,           // batch 10 events แล้วส่ง
  flushInterval: 5000,   // หรือทุก 5 วินาที
});

export interface TraceContext {
  userId?: string;
  sessionId?: string;
  tags?: string[];
  metadata?: Record<string, unknown>;
}

/**
 * Wrapper สำหรับ Claude API call — auto-trace ทุก call
 */
export async function traceClaudeCall<T>(
  name: string,
  input: { prompt: string; system?: string; model: string },
  fn: () => Promise<T>,
  ctx: TraceContext = {}
): Promise<T> {
  const trace = langfuse.trace({
    name,
    userId: ctx.userId,
    sessionId: ctx.sessionId,
    tags: ctx.tags,
    metadata: ctx.metadata,
    input: { prompt: input.prompt, system: input.system },
  });

  const generation = trace.generation({
    name: `${name}-generation`,
    model: input.model,
    input: [
      ...(input.system ? [{ role: 'system', content: input.system }] : []),
      { role: 'user', content: input.prompt },
    ],
    modelParameters: { model: input.model },
  });

  const startTime = Date.now();

  try {
    const result = await fn();
    const durationMs = Date.now() - startTime;

    // บันทึก result — ถ้าเป็น Anthropic response จะ extract ค่าได้
    const output = extractOutput(result);
    const usage = extractUsage(result);

    generation.end({
      output,
      usage: usage ? {
        input: usage.input_tokens,
        output: usage.output_tokens,
      } : undefined,
      metadata: { durationMs },
    });

    trace.update({ output, metadata: { durationMs, ...ctx.metadata } });
    return result;
  } catch (error) {
    const durationMs = Date.now() - startTime;
    generation.end({
      level: 'ERROR',
      statusMessage: error instanceof Error ? error.message : 'Unknown error',
      metadata: { durationMs },
    });
    trace.update({ metadata: { error: true, durationMs } });
    throw error;
  }
}

function extractOutput(result: unknown): string {
  if (result && typeof result === 'object' && 'content' in result) {
    const content = (result as any).content;
    if (Array.isArray(content) && content[0]?.type === 'text') {
      return content[0].text;
    }
  }
  return JSON.stringify(result);
}

function extractUsage(result: unknown): { input_tokens: number; output_tokens: number } | null {
  if (result && typeof result === 'object' && 'usage' in result) {
    return (result as any).usage;
  }
  return null;
}
