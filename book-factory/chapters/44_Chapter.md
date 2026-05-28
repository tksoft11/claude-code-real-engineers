# บทที่ 44: Graceful AI Degradation & Multi-Model Fallbacks — ระบบ AI ที่ไม่มีวันพัง

---

## 💥 วันที่ Anthropic API ล่ม และ Business หยุดชะงัก

วันที่ 15 มีนาคม เวลา 14:00 น. — บริษัท E-commerce ของคุณมียอด order วันหยุดพิเศษ

```
14:00 — ยอด order สูงสุดของปี: 2,400 orders/ชั่วโมง
14:07 — Anthropic status page เปลี่ยนเป็น "Investigating"
14:08 — AI product recommendation ล่ม
14:09 — AI chatbot ล่ม
14:10 — Support tickets ถาม "เว็บเสียไหม?" พุ่งขึ้น 800%
14:45 — Anthropic แก้ไขเสร็จ
```

**ยอดขายที่หายไป 35 นาที: ประมาณ 1,400 orders**

แต่ถ้าคุณมี Fallback ไว้:

```
14:07 — Anthropic API เริ่มช้าผิดปกติ
14:07:03 — Circuit Breaker ตรวจจับ latency spike
14:07:05 — สลับไป OpenAI GPT-4o อัตโนมัติ (ผู้ใช้ไม่รู้)
14:45 — Anthropic กลับมา → สลับกลับอัตโนมัติ
```

**ยอดขายที่หาย: 0 orders**

ความต่างระหว่าง "AI Feature" กับ "AI System" คือ Resilience ครับ

---

## 🏗️ Architecture: The Immortal AI

```
User Request
     │
     ▼
[AI Gateway Layer]
     │
     ├─ Circuit Breaker (ตรวจจับ failure)
     │
     ├─ Provider Selection (เลือก provider)
     │        │
     │   Priority 1: Claude (primary)
     │   Priority 2: OpenAI GPT-4o (fallback)
     │   Priority 3: Llama 3 Local (last resort)
     │
     ├─ Retry with Exponential Backoff
     │
     └─ Cache Layer (ถ้า prompt เหมือนกัน)
          │
          ▼
     Response (ผู้ใช้ไม่รู้ว่า provider เปลี่ยน)
```

---

## 📁 Project Structure

```
src/
├── ai-gateway/
│   ├── gateway.ts           ← Main AI Gateway
│   ├── circuit-breaker.ts   ← Circuit Breaker pattern
│   ├── providers/
│   │   ├── claude.provider.ts
│   │   ├── openai.provider.ts
│   │   └── ollama.provider.ts  ← Local Llama fallback
│   └── cache.ts             ← Response caching
└── index.ts
```

---

## ⚡ Circuit Breaker Pattern

**อธิบายแบบเข้าใจง่าย:** ลองนึกถึงคัตเอาท์ไฟฟ้าในบ้าน — เมื่อไฟเกิน มันตัดวงจรทันที ไม่รอให้ไฟไหม้บ้าน แล้วพอไฟปกติก็รีเซ็ตเอง

Circuit Breaker สำหรับ API ทำงานเหมือนกันทุกประการ

```typescript
// src/ai-gateway/circuit-breaker.ts

type State = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

interface CircuitBreakerOptions {
  failureThreshold: number;   // จำนวน failure ที่ยอมรับได้
  successThreshold: number;   // จำนวน success ที่ต้องการก่อนปิด circuit
  timeout: number;            // ms ที่รอก่อน try อีกครั้ง
  volumeThreshold: number;    // requests ขั้นต่ำก่อนนับ failure rate
}

export class CircuitBreaker {
  private state: State = 'CLOSED';
  private failures = 0;
  private successes = 0;
  private nextAttempt = 0;
  private callCount = 0;

  constructor(
    private readonly name: string,
    private readonly opts: CircuitBreakerOptions
  ) {}

  get isOpen(): boolean {
    if (this.state === 'OPEN') {
      // ถ้าถึงเวลา retry แล้ว → ลองเปิด HALF_OPEN
      if (Date.now() >= this.nextAttempt) {
        this.state = 'HALF_OPEN';
        console.log(`[CircuitBreaker] ${this.name}: OPEN → HALF_OPEN`);
        return false;
      }
      return true;
    }
    return false;
  }

  recordSuccess(): void {
    this.failures = 0;
    this.callCount++;

    if (this.state === 'HALF_OPEN') {
      this.successes++;
      if (this.successes >= this.opts.successThreshold) {
        this.state = 'CLOSED';
        this.successes = 0;
        console.log(`[CircuitBreaker] ${this.name}: HALF_OPEN → CLOSED ✅`);
      }
    }
  }

  recordFailure(): void {
    this.failures++;
    this.successes = 0;
    this.callCount++;

    if (this.state === 'HALF_OPEN') {
      // HALF_OPEN fail → กลับไป OPEN
      this.trip();
      return;
    }

    if (
      this.callCount >= this.opts.volumeThreshold &&
      this.failures >= this.opts.failureThreshold
    ) {
      this.trip();
    }
  }

  private trip(): void {
    this.state = 'OPEN';
    this.nextAttempt = Date.now() + this.opts.timeout;
    console.log(`[CircuitBreaker] ${this.name}: TRIPPED 🔴 (retry in ${this.opts.timeout}ms)`);
  }

  getState(): State { return this.state; }
}
```

---

## 🤖 AI Providers Interface

```typescript
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
```

```typescript
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
```

```typescript
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
```

```typescript
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
```

---

## 🚪 AI Gateway — ตัวจัดการทั้งหมด

```typescript
// src/ai-gateway/gateway.ts
import { AIProvider, AIResponse } from './providers/types';
import { CircuitBreaker } from './circuit-breaker';

interface GatewayOptions {
  maxRetries?: number;
  retryDelayMs?: number;
  timeoutMs?: number;
  enableCache?: boolean;
}

interface ProviderEntry {
  provider: AIProvider;
  breaker: CircuitBreaker;
  priority: number;
}

export class AIGateway {
  private providers: ProviderEntry[] = [];
  private responseCache = new Map<string, { response: AIResponse; expiresAt: number }>();

  constructor(private opts: GatewayOptions = {}) {
    this.opts = {
      maxRetries: 2,
      retryDelayMs: 500,
      timeoutMs: 30000,
      enableCache: true,
      ...opts,
    };
  }

  addProvider(provider: AIProvider, priority: number): this {
    this.providers.push({
      provider,
      priority,
      breaker: new CircuitBreaker(provider.name, {
        failureThreshold: 3,
        successThreshold: 2,
        timeout: 60_000,     // 1 นาที ก่อน retry
        volumeThreshold: 5,
      }),
    });
    // เรียงตาม priority (น้อย = สูงกว่า)
    this.providers.sort((a, b) => a.priority - b.priority);
    return this;
  }

  async complete(
    prompt: string,
    system?: string,
    maxTokens?: number
  ): Promise<AIResponse & { cached?: boolean }> {
    // ตรวจ cache ก่อน
    if (this.opts.enableCache) {
      const cached = this.getFromCache(prompt, system);
      if (cached) return { ...cached, cached: true };
    }

    // วนหา provider ที่ใช้ได้
    for (const entry of this.providers) {
      if (entry.breaker.isOpen) {
        console.log(`[Gateway] Skipping ${entry.provider.name} (circuit open)`);
        continue;
      }

      try {
        const response = await this.callWithTimeout(
          entry.provider,
          prompt,
          system,
          maxTokens
        );
        entry.breaker.recordSuccess();

        // log ว่าใช้ provider ไหน (สำหรับ monitoring)
        if (entry.priority > 1) {
          console.warn(`[Gateway] Using fallback provider: ${entry.provider.name}`);
        }

        // เก็บ cache
        if (this.opts.enableCache) {
          this.saveToCache(prompt, system, response);
        }

        return response;
      } catch (error) {
        entry.breaker.recordFailure();
        const msg = error instanceof Error ? error.message : 'unknown';
        console.error(`[Gateway] ${entry.provider.name} failed: ${msg}`);
        // ลอง provider ถัดไป
      }
    }

    throw new Error('All AI providers are unavailable. Please try again later.');
  }

  private async callWithTimeout(
    provider: AIProvider,
    prompt: string,
    system?: string,
    maxTokens?: number
  ): Promise<AIResponse> {
    return Promise.race([
      provider.complete(prompt, system, maxTokens),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error(`Timeout after ${this.opts.timeoutMs}ms`)), this.opts.timeoutMs)
      ),
    ]);
  }

  private getCacheKey(prompt: string, system?: string): string {
    return `${system || ''}::${prompt}`;
  }

  private getFromCache(prompt: string, system?: string): AIResponse | null {
    const key = this.getCacheKey(prompt, system);
    const entry = this.responseCache.get(key);
    if (entry && entry.expiresAt > Date.now()) return entry.response;
    this.responseCache.delete(key);
    return null;
  }

  private saveToCache(prompt: string, system?: string, response: AIResponse): void {
    const key = this.getCacheKey(prompt, system);
    this.responseCache.set(key, {
      response,
      expiresAt: Date.now() + 5 * 60 * 1000, // cache 5 นาที
    });
  }

  getProviderStatus(): Record<string, string> {
    return Object.fromEntries(
      this.providers.map(e => [e.provider.name, e.breaker.getState()])
    );
  }
}
```

---

## 🚀 Setup และใช้งาน

```typescript
// src/index.ts
import { AIGateway } from './ai-gateway/gateway';
import { ClaudeProvider } from './ai-gateway/providers/claude.provider';
import { OpenAIProvider } from './ai-gateway/providers/openai.provider';
import { OllamaProvider } from './ai-gateway/providers/ollama.provider';

// สร้าง Gateway พร้อม fallback chain
export const aiGateway = new AIGateway({
  timeoutMs: 25_000,
  enableCache: true,
})
  .addProvider(new ClaudeProvider(), 1)   // Primary
  .addProvider(new OpenAIProvider(), 2)   // Fallback 1
  .addProvider(new OllamaProvider(), 3);  // Last resort (local)

// ใช้งานแทน client.messages.create() โดยตรง
async function handleUserMessage(userInput: string): Promise<string> {
  const response = await aiGateway.complete(
    userInput,
    'คุณคือ AI assistant ที่ช่วยตอบคำถามลูกค้าของเรา',
    1024
  );

  if (response.cached) {
    console.log('Cache hit!');
  }
  console.log(`Provider used: ${response.provider} (${response.latencyMs}ms)`);

  return response.text;
}

// Health check endpoint
import express from 'express';
const app = express();

app.get('/health/ai', (req, res) => {
  const status = aiGateway.getProviderStatus();
  const hasAvailable = Object.values(status).some(s => s !== 'OPEN');
  res.status(hasAvailable ? 200 : 503).json({ providers: status });
});
```

---

## 🧪 จำลอง Failure — ทดสอบ Fallback

```typescript
// test/gateway.test.ts
import { AIGateway } from '../src/ai-gateway/gateway';
import { AIProvider, AIResponse } from '../src/ai-gateway/providers/types';

// Mock provider ที่ fail ตลอด
class FailingProvider implements AIProvider {
  name = 'failing';
  async complete(): Promise<AIResponse> {
    throw new Error('Service unavailable');
  }
}

// Mock provider ที่ทำงานปกติ
class WorkingProvider implements AIProvider {
  name = 'working';
  async complete(prompt: string): Promise<AIResponse> {
    return {
      text: `Response from working provider: ${prompt.slice(0, 50)}`,
      provider: 'working', model: 'mock-v1',
      inputTokens: 10, outputTokens: 20, latencyMs: 100,
    };
  }
}

async function testFallback() {
  const gateway = new AIGateway()
    .addProvider(new FailingProvider(), 1)  // Primary จะ fail
    .addProvider(new WorkingProvider(), 2); // Fallback จะรับ

  const response = await gateway.complete('test prompt');
  console.assert(response.provider === 'working', 'Should use fallback provider');
  console.log('✅ Fallback test passed:', response.provider);
}

testFallback().catch(console.error);
```

```bash
# รัน test
npx ts-node test/gateway.test.ts

# จำลอง Claude API timeout โดยลด timeout เป็น 1ms
# gateway = new AIGateway({ timeoutMs: 1 }) → ทุก provider timeout → ลอง next
```

---

## 📊 Monitoring ระบบ Fallback

ต่อจากบทที่ 36 — เพิ่ม metrics สำหรับ fallback tracking:

```typescript
// เพิ่มใน metrics.ts
export const fallbackCounter = new Counter({
  name: 'ai_fallback_total',
  help: 'Number of times fallback providers were used',
  labelNames: ['from_provider', 'to_provider'] as const,
});

export const circuitBreakerState = new Gauge({
  name: 'ai_circuit_breaker_state',
  help: '0=CLOSED, 1=OPEN, 2=HALF_OPEN',
  labelNames: ['provider'] as const,
});
```

**Grafana Alert ที่ต้องมี:**
```yaml
- alert: AIFallbackActivated
  expr: rate(ai_fallback_total[5m]) > 0
  annotations:
    summary: "Primary AI provider ล้มเหลว — Fallback กำลังทำงาน"
    description: "Switching from {{ $labels.from_provider }} to {{ $labels.to_provider }}"
```

---

## 🎯 สรุปบทที่ 44

| Component | หน้าที่ |
|-----------|--------|
| `CircuitBreaker` | ตัดการเชื่อมต่อ provider ที่ fail อัตโนมัติ ป้องกัน cascade |
| `ClaudeProvider` | Primary — claude-sonnet-4-5 |
| `OpenAIProvider` | Fallback 1 — gpt-4o-mini (cost-efficient) |
| `OllamaProvider` | Last Resort — Llama 3.2 local (ฟรี, ต้องการ GPU) |
| `AIGateway` | Orchestrator — routing, timeout, cache, fallback logic |
| Health endpoint | `/health/ai` — แสดง circuit state ทุก provider |

**กุญแจสำคัญ:** ผู้ใช้ไม่รู้ว่า provider เปลี่ยน — นั่นคือ Graceful Degradation ที่แท้จริง

---

## 📋 Action Items ก่อนไปบทที่ 45

- [ ] สมัคร OpenAI API key ไว้เป็น fallback (จ่ายตามใช้ ไม่มีค่าสมัคร)
- [ ] ติดตั้ง Ollama + download llama3.2: `ollama pull llama3.2`
- [ ] Setup `AIGateway` แทน direct client calls ทั้ง codebase
- [ ] เพิ่ม `/health/ai` ใน load balancer health check
- [ ] จำลอง failure: ปิด Anthropic API key ชั่วคราว — ดู fallback ทำงานจริง

---

*ใน **บทที่ 45** เราจะยกระดับความเร็วในการประมวลผลและการประหยัดค่าใช้จ่ายด้วย LLM Cache & Semantic Caching — ตอบสนองทันทีใน 0.01 วินาที ด้วยความจำส่วนกลางกันครับ*
