# บทที่ 43: LLM Observability & Tracing

---

## 🪝 ตี 2 ครึ่ง — Phone ดัง

มินต์ตื่นขึ้นมากลางดึกด้วยเสียง PagerDuty alert

> *🛑 CRITICAL: AI Chatbot — 2,400 users ได้รับผลกระทบ*

เธอเปิด Laptop ด้วยมือที่ยังหนักอยู่ เปิด Dashboard ขึ้นมา แต่ไม่มีอะไรเลย มีแต่ `console.log("AI responded")` อยู่เต็มไปหมด

*เกิดอะไรขึ้น?*

มินต์ใช้เวลา 3 ชั่วโมงจึงพบว่า Prompt หนึ่งตัวกิน Token มากผิดปกติ 40 เท่า และมันรันซ้ำๆ มาตลอด 6 ชั่วโมงก่อนหน้า นั่นคือสาเหตุที่ทำให้ Rate Limit ตี และ Chatbot ไม่ตอบสนอง

**ถ้ามี Observability — เธอจะเห็น Spike นั้นใน  30 วินาทีแรก**

แต่เธอไม่มี เพราะไม่เคยติดตั้งไว้ เพราะเคยคิดว่า `console.log` น่าจะพอ

**บทนี้จะแก้ปัญหานั้นครับ**

---

## 👁️ Observability คืออะไร (อธิบายให้ไม่ใช่ Dev ก็เข้าใจ)

ลองนึกถึงเครื่องบิน — นักบินมีแผงหน้าปัดเต็มไปหมด: ความเร็ว, ความสูง, แรงดันเครื่องยนต์, เชื้อเพลิง

ถ้าไม่มีแผงหน้าปัด นักบินก็ยังบินได้ — แต่จะรู้ว่ามีปัญหา "หลังจากตก" แล้วเท่านั้น

**Observability สำหรับ AI = แผงหน้าปัดของระบบ AI คุณ**

มีสามเสาหลัก:
- **Logs** — "อะไรเกิดขึ้น?" (AI รับ input อะไร, ตอบอะไร, error อะไร)
- **Metrics** — "เป็นอย่างนั้นบ่อยแค่ไหน?" (latency เฉลี่ย, token/request, error rate)
- **Traces** — "เกิดขึ้นที่ไหน?" (request นี้วิ่งผ่าน function อะไรบ้าง กินเวลาเท่าไหร่แต่ละขั้น)

---

## 🏗️ Architecture: AI Observability Stack

```
User Request
     │
     ▼
[Your AI Application]
     │
     ├── Traces ──────► [LangSmith / Langfuse]
     │                   ดู prompt/response ทุก call
     │
     ├── Metrics ─────► [Prometheus + Grafana]
     │                   latency, token count, cost
     │
     └── Logs ────────► [CloudWatch / Loki]
                         error, warning, structured logs
```

ในบทนี้เราจะ implement ครบทั้ง 3 เสา โดยเริ่มจาก **Langfuse** (open-source, self-hostable) สำหรับ LLM-specific tracing

---

## 📁 Project Structure

```
src/
├── observability/
│   ├── langfuse.client.ts    ← LLM trace wrapper
│   ├── metrics.ts            ← Prometheus metrics
│   ├── logger.ts             ← Structured logger
│   └── middleware.ts         ← Express middleware รวมทุกอย่าง
├── ai/
│   └── claude.service.ts     ← AI service ที่ต่อ observability
└── index.ts
```

---

## 📦 Dependencies

```bash
npm install langfuse @anthropic-ai/sdk pino pino-pretty
npm install prom-client express
npm install --save-dev @types/express
```

---

## 🔍 Step 1: Langfuse — LLM-Specific Tracing

Langfuse คือ open-source tool ที่ออกแบบมาเพื่อ LLM โดยเฉพาะ — บันทึก prompt, response, token count, latency, และ cost ทุก call

```typescript
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
```

---

## 📊 Step 2: Prometheus Metrics

Langfuse ดีสำหรับดู individual traces — แต่สำหรับ aggregate metrics (เฉลี่ย latency, total cost, error rate) เราใช้ Prometheus

```typescript
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
```

---

## 📝 Step 3: Structured Logger

```typescript
// src/observability/logger.ts
import pino from 'pino';

export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  // Production: JSON logs สำหรับ log aggregation (CloudWatch, Loki)
  // Development: pretty print
  transport: process.env.NODE_ENV === 'development'
    ? { target: 'pino-pretty', options: { colorize: true } }
    : undefined,
  base: {
    service: 'ai-service',
    version: process.env.npm_package_version,
    env: process.env.NODE_ENV,
  },
});

// Helper สำหรับ log AI-specific events
export const aiLogger = {
  request: (data: { feature: string; model: string; userId?: string; promptLen: number }) => {
    logger.info({ event: 'ai.request', ...data });
  },
  response: (data: {
    feature: string; model: string; durationMs: number;
    inputTokens: number; outputTokens: number; costUsd: number;
  }) => {
    logger.info({ event: 'ai.response', ...data });
  },
  error: (data: { feature: string; model: string; error: string; userId?: string }) => {
    logger.error({ event: 'ai.error', ...data });
  },
};
```

---

## 🔗 Step 4: Claude Service พร้อม Observability ครบ

```typescript
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
```

---

## ⚡ Step 5: Express Middleware รวมทุกอย่าง

```typescript
// src/observability/middleware.ts
import { Request, Response, NextFunction } from 'express';
import { getMetrics } from './metrics';
import { logger } from './logger';

// Request logging middleware
export function requestLogger(req: Request, res: Response, next: NextFunction) {
  const start = Date.now();
  res.on('finish', () => {
    logger.info({
      event: 'http.request',
      method: req.method,
      path: req.path,
      status: res.statusCode,
      durationMs: Date.now() - start,
      userId: (req as any).userId,
    });
  });
  next();
}

// Prometheus metrics endpoint
export async function metricsEndpoint(req: Request, res: Response) {
  res.set('Content-Type', 'text/plain');
  res.send(await getMetrics());
}
```

```typescript
// src/index.ts
import express from 'express';
import { requestLogger, metricsEndpoint } from './observability/middleware';
import { callClaude } from './ai/claude.service';
import { logger } from './observability/logger';
import { langfuse } from './observability/langfuse.client';

const app = express();
app.use(express.json());
app.use(requestLogger);

// Health check
app.get('/health', (req, res) => res.json({ status: 'ok' }));

// Prometheus scrape endpoint
app.get('/metrics', metricsEndpoint);

// ตัวอย่าง AI endpoint
app.post('/api/summarize', async (req, res) => {
  const { text, userId } = req.body;
  try {
    const summary = await callClaude(
      `สรุปข้อความต่อไปนี้เป็นภาษาไทย ไม่เกิน 3 ประโยค:\n\n${text}`,
      { feature: 'summarize', userId, model: 'claude-haiku-4-5' }
    );
    res.json({ summary });
  } catch (error) {
    res.status(500).json({ error: 'AI service unavailable' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  logger.info({ event: 'server.start', port: PORT });
});

// Flush Langfuse ก่อน shutdown
process.on('SIGTERM', async () => {
  logger.info('Shutting down...');
  await langfuse.shutdownAsync();
  process.exit(0);
});
```

---

## 📊 Grafana Dashboard — 4 Panel ที่ต้องมี

หลัง setup Prometheus + Grafana แล้ว สร้าง dashboard ด้วย 4 panels นี้:

```
┌─────────────────────┬─────────────────────┐
│  AI Requests/min    │  Avg Latency (p95)  │
│  [Line Chart]       │  [Gauge]            │
│  แยกตาม feature     │  เป้า: < 3 วินาที   │
├─────────────────────┼─────────────────────┤
│  Token Usage/hour   │  Estimated Cost/day │
│  [Stacked Bar]      │  [Stat Panel]       │
│  input vs output    │  💰 ไม่เกิน $50/วัน │
└─────────────────────┴─────────────────────┘
```

**PromQL Queries ที่ใช้:**

```promql
# Request rate แยกตาม feature
rate(ai_api_calls_total[5m])

# p95 latency
histogram_quantile(0.95, rate(ai_response_duration_ms_bucket[5m]))

# Cost สะสมวันนี้
increase(ai_estimated_cost_usd_total[24h])

# Error rate
rate(ai_errors_total[5m]) / rate(ai_api_calls_total[5m])
```

---

## 🚨 Alerting Rules

```yaml
# prometheus/alerts.yml
groups:
  - name: ai-alerts
    rules:
      - alert: AIHighLatency
        expr: histogram_quantile(0.95, rate(ai_response_duration_ms_bucket[5m])) > 10000
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "AI p95 latency สูงเกิน 10 วินาที"
          description: "Feature {{ $labels.feature }} latency: {{ $value }}ms"

      - alert: AIHighErrorRate
        expr: rate(ai_errors_total[5m]) / rate(ai_api_calls_total[5m]) > 0.05
        for: 2m
        labels:
          severity: critical
        annotations:
          summary: "AI error rate เกิน 5%"

      - alert: AIDailyCostOverrun
        expr: increase(ai_estimated_cost_usd_total[24h]) > 100
        labels:
          severity: warning
        annotations:
          summary: "AI cost วันนี้เกิน $100"
```

---

## 🧪 ทดสอบ: ดู Traces ใน Langfuse

```bash
# 1. สมัคร Langfuse Cloud (ฟรี) หรือ self-host
# https://langfuse.com

# 2. ตั้ง environment variables
export LANGFUSE_PUBLIC_KEY=pk-lf-...
export LANGFUSE_SECRET_KEY=sk-lf-...
export ANTHROPIC_API_KEY=sk-ant-...

# 3. Run server
npm run dev

# 4. ส่ง test request
curl -X POST http://localhost:3000/api/summarize \
  -H "Content-Type: application/json" \
  -d '{"text": "การ AI ทำให้โลกเปลี่ยนไปอย่างรวดเร็ว...", "userId": "user-123"}'

# 5. เปิด Langfuse dashboard → ดู trace ของ call นี้
# จะเห็น: prompt, response, token count, latency, cost
```

---

## 💡 Langfuse vs LangSmith — เลือกอะไร?

| | **Langfuse** | **LangSmith** |
|--|---|---|
| License | Open-source (MIT) | Commercial |
| Self-host | ✅ ได้ | ❌ ไม่ได้ |
| ราคา | ฟรี (self-host) | $39+/เดือน |
| Framework | Framework-agnostic | LangChain-focused |
| Production | ✅ พร้อม | ✅ พร้อม |

**แนะนำ:** Langfuse ถ้า sensitive data หรืองบจำกัด, LangSmith ถ้าใช้ LangChain ครบ ecosystem

---

## 🎯 สรุปบทที่ 43

| Component | ทำอะไร |
|-----------|--------|
| `langfuse.client.ts` | Trace ทุก LLM call — prompt, response, tokens, cost |
| `metrics.ts` | Prometheus metrics: latency, token count, error rate, cost |
| `logger.ts` | Structured JSON logs สำหรับ log aggregation |
| `claude.service.ts` | AI wrapper ที่ต่อ observability ทั้งหมดโดยอัตโนมัติ |
| Grafana Dashboard | 4-panel view: requests, latency, tokens, cost |
| Alerting Rules | แจ้งเตือนเมื่อ latency สูง, error rate เกิน, cost overrun |

**กฎทอง:** ทุก AI call ต้องผ่าน `callClaude()` wrapper — ห้าม call `client.messages.create()` โดยตรงใน production

---

## 📋 Action Items ก่อนไปบทที่ 44

- [ ] สมัคร Langfuse Cloud หรือ setup self-hosted ด้วย Docker
- [ ] เพิ่ม `callClaude()` wrapper แทนทุก `client.messages.create()` ใน codebase
- [ ] Setup Grafana + Prometheus ด้วย Docker Compose
- [ ] ตั้ง alert: cost > $X/วัน ส่ง Slack notification
- [ ] ดู Langfuse dashboard หลัง run 1 วัน — มี call ไหนแพงผิดปกติ?

---

*ใน **บทที่ 44** เราจะเรียนรู้เกี่ยวกับ Graceful AI Degradation & Multi-Model Fallbacks — สถาปัตยกรรม High Availability เมื่อ API โมเดลหลักล่ม เพื่อให้แอปไม่ล่มตามครับ*
