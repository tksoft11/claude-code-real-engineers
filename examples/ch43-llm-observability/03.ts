// src/observability/metrics.ts
import { Counter, Histogram, Gauge, register } from 'prom-client';

// ลงทะเบียน metrics ทั้งหมด
export const metrics = {
  // นับ API calls แยกตาม model และ status
  apiCalls: new Counter({
    name: 'ai_api_calls_total',
    help: 'Total number of AI API calls',
    labelNames: ['model', 'status', 'feature'] as const,
  }),

  // วัด latency (histogram เพื่อ percentiles)
  latency: new Histogram({
    name: 'ai_response_duration_ms',
    help: 'AI response latency in milliseconds',
    labelNames: ['model', 'feature'] as const,
    buckets: [100, 500, 1000, 2000, 5000, 10000, 30000],
  }),

  // นับ tokens (เพื่อคำนวณ cost)
  tokensUsed: new Counter({
    name: 'ai_tokens_used_total',
    help: 'Total tokens consumed',
    labelNames: ['model', 'type', 'feature'] as const, // type: input|output
  }),

  // ค่าใช้จ่ายสะสม (USD)
  estimatedCost: new Counter({
    name: 'ai_estimated_cost_usd_total',
    help: 'Estimated cost in USD',
    labelNames: ['model', 'feature'] as const,
  }),

  // error rate
  errors: new Counter({
    name: 'ai_errors_total',
    help: 'Total AI errors',
    labelNames: ['model', 'error_type', 'feature'] as const,
  }),

  // concurrent requests
  activeRequests: new Gauge({
    name: 'ai_active_requests',
    help: 'Number of active AI requests',
    labelNames: ['model'] as const,
  }),
};

// คำนวณ cost ตาม model
const COST_PER_1K_TOKENS: Record<string, { input: number; output: number }> = {
  'claude-haiku-4-5':  { input: 0.00025, output: 0.00125 },
  'claude-sonnet-4-5': { input: 0.003,   output: 0.015   },
  'claude-opus-4-5':   { input: 0.015,   output: 0.075   },
};

export function recordAICall(opts: {
  model: string;
  feature: string;
  status: 'success' | 'error';
  durationMs: number;
  inputTokens?: number;
  outputTokens?: number;
  errorType?: string;
}) {
  const { model, feature, status, durationMs, inputTokens, outputTokens, errorType } = opts;

  metrics.apiCalls.inc({ model, status, feature });
  metrics.latency.observe({ model, feature }, durationMs);

  if (inputTokens) {
    metrics.tokensUsed.inc({ model, type: 'input', feature }, inputTokens);
  }
  if (outputTokens) {
    metrics.tokensUsed.inc({ model, type: 'output', feature }, outputTokens);
  }

  // คำนวณ cost
  const pricing = COST_PER_1K_TOKENS[model];
  if (pricing && inputTokens && outputTokens) {
    const cost = (inputTokens / 1000) * pricing.input + (outputTokens / 1000) * pricing.output;
    metrics.estimatedCost.inc({ model, feature }, cost);
  }

  if (status === 'error' && errorType) {
    metrics.errors.inc({ model, error_type: errorType, feature });
  }
}

// Endpoint สำหรับ Prometheus scrape
export async function getMetrics(): Promise<string> {
  return register.metrics();
}
