# บทที่ 16: Model Routing & Spend Limits — ประหยัดค่า API อย่างชาญฉลาด

---

## 🪝 บิลล์ที่ช็อคทั้งออฟฟิศ

สิงหาคม 2025 — บริษัท Startup แห่งหนึ่งเปิดตัว AI Feature ใหม่ และได้รับ Response ที่ดีมากจากผู้ใช้

สิ้นเดือน CFO โทรมาหา CTO:

> "ค่า Anthropic API เดือนนี้ **$4,200** ครับ เดือนก่อนแค่ $180"

ปรากฏว่าทีม Dev ใช้ `claude-opus-4-5` สำหรับ **ทุก request** รวมถึง request ง่ายๆ อย่าง "แปลงวันที่" และ "จัดรูปแบบ JSON"

Opus เก่งมาก — แต่ใช้ Opus สำหรับ "บวกเลข 1+1" คือการสิ้นเปลืองที่ไม่จำเป็น

**Model Routing** แก้ปัญหานี้โดยเลือก Model อัตโนมัติตามความซับซ้อนของงาน

---

## 🧠 Model Landscape: รู้จัก 3 ระดับ

```
┌─────────────────────────────────────────────────────────────┐
│  🐇 claude-haiku-4-5    → เร็ว ถูก เหมาะงาน simple         │
│  Input:  $0.80/1M tokens                                    │
│  Output: $4.00/1M tokens                                    │
│  ใช้กับ: Classify, Format, Translate, Simple Q&A            │
├─────────────────────────────────────────────────────────────┤
│  ⚖️  claude-sonnet-4-5   → สมดุล เหมาะงานทั่วไป             │
│  Input:  $3.00/1M tokens                                    │
│  Output: $15.00/1M tokens                                   │
│  ใช้กับ: Code generation, Analysis, Content writing         │
├─────────────────────────────────────────────────────────────┤
│  🧠 claude-opus-4-5     → ทรงพลัง เหมาะงานซับซ้อน           │
│  Input:  $15.00/1M tokens                                   │
│  Output: $75.00/1M tokens                                   │
│  ใช้กับ: Complex reasoning, Multi-step planning, Research   │
└─────────────────────────────────────────────────────────────┘
```

**ความต่างด้านราคา:**

```
งาน: วิเคราะห์ feedback 10,000 รายการ (100 tokens/รายการ)

ถ้าใช้ Opus ทั้งหมด:
10,000 × 100 × $0.000015 = $15.00/ครั้ง = ~540 บาท

ถ้า Route ถูก (Haiku 80%, Sonnet 20%):
Haiku:  8,000 × 100 × $0.000004 = $3.20
Sonnet: 2,000 × 100 × $0.000015 = $3.00
รวม: $6.20 = ~223 บาท

ประหยัดได้: 59% ทันที
```

---

## 🔀 Model Router: เลือก Model อัตโนมัติ

### กลยุทธ์ที่ 1: Rule-Based Routing

```typescript
// src/routing/model-router.ts

type ModelTier = 'fast' | 'balanced' | 'powerful';

interface RoutingConfig {
  model: string;
  maxTokens: number;
  reasoning: string;
}

const MODELS: Record<ModelTier, string> = {
  fast:     'claude-haiku-4-5',
  balanced: 'claude-sonnet-4-5',
  powerful: 'claude-opus-4-5',
};

interface RoutingRequest {
  prompt: string;
  taskType?: string;
  requiresCode?: boolean;
  requiresReasoning?: boolean;
  maxComplexity?: 'low' | 'medium' | 'high';
}

export function routeModel(req: RoutingRequest): RoutingConfig {
  const promptLength = req.prompt.length;

  // ===== FAST (Haiku) =====
  // งานง่าย ไม่ต้องการ reasoning ซับซ้อน
  if (
    req.taskType === 'classify' ||
    req.taskType === 'format' ||
    req.taskType === 'translate' ||
    req.maxComplexity === 'low' ||
    (promptLength < 500 && !req.requiresCode && !req.requiresReasoning)
  ) {
    return {
      model: MODELS.fast,
      maxTokens: 512,
      reasoning: 'Simple task — Haiku sufficient',
    };
  }

  // ===== POWERFUL (Opus) =====
  // งานที่ต้องการ reasoning ระดับสูง
  if (
    req.taskType === 'architecture-review' ||
    req.taskType === 'security-audit' ||
    req.requiresReasoning ||
    req.maxComplexity === 'high' ||
    promptLength > 10000
  ) {
    return {
      model: MODELS.powerful,
      maxTokens: 4096,
      reasoning: 'Complex reasoning required — Opus needed',
    };
  }

  // ===== BALANCED (Sonnet) =====
  // งานทั่วไป
  return {
    model: MODELS.balanced,
    maxTokens: 2048,
    reasoning: 'General task — Sonnet balanced choice',
  };
}

// ใช้งาน
const config = routeModel({
  prompt: userMessage,
  taskType: 'classify',
});

const response = await client.messages.create({
  model: config.model,
  max_tokens: config.maxTokens,
  messages: [{ role: 'user', content: userMessage }],
});

console.log(`Used: ${config.model} (${config.reasoning})`);
```

---

### กลยุทธ์ที่ 2: Two-Stage Routing (ใช้ AI เลือก AI)

```typescript
// ใช้ Haiku ราคาถูกเพื่อ classify งาน แล้วส่งต่อ model ที่เหมาะสม
async function twoStageRoute(userPrompt: string): Promise<string> {
  // Stage 1: ใช้ Haiku classify complexity (ถูกมาก ~$0.00005)
  const classifyResponse = await client.messages.create({
    model: 'claude-haiku-4-5',
    max_tokens: 50,
    system: 'Classify the complexity of this task. Reply with ONLY one word: SIMPLE, MODERATE, or COMPLEX',
    messages: [{ role: 'user', content: userPrompt }],
  });

  const complexity = classifyResponse.content[0].type === 'text'
    ? classifyResponse.content[0].text.trim().toUpperCase()
    : 'MODERATE';

  // Stage 2: เลือก model ตาม complexity
  const modelMap: Record<string, string> = {
    SIMPLE:   'claude-haiku-4-5',
    MODERATE: 'claude-sonnet-4-5',
    COMPLEX:  'claude-opus-4-5',
  };

  const selectedModel = modelMap[complexity] || 'claude-sonnet-4-5';
  console.log(`Classified as ${complexity} → Using ${selectedModel}`);

  // Stage 2: ทำงานจริงด้วย model ที่เหมาะสม
  const mainResponse = await client.messages.create({
    model: selectedModel,
    max_tokens: 2048,
    messages: [{ role: 'user', content: userPrompt }],
  });

  return mainResponse.content[0].type === 'text'
    ? mainResponse.content[0].text
    : '';
}
```

---

### กลยุทธ์ที่ 3: Cascading Fallback (ลองถูกก่อน ถ้าไม่ดีค่อยขยับ)

```typescript
// ลอง Haiku ก่อน ถ้า output ไม่ดีพอ ขยับไป Sonnet → Opus
async function cascadeRoute(
  prompt: string,
  qualityChecker: (response: string) => boolean
): Promise<{ response: string; modelUsed: string }> {
  const cascade: Array<{ model: string; maxTokens: number }> = [
    { model: 'claude-haiku-4-5',  maxTokens: 1024 },
    { model: 'claude-sonnet-4-5', maxTokens: 2048 },
    { model: 'claude-opus-4-5',   maxTokens: 4096 },
  ];

  for (const { model, maxTokens } of cascade) {
    const response = await client.messages.create({
      model,
      max_tokens: maxTokens,
      messages: [{ role: 'user', content: prompt }],
    });

    const text = response.content[0].type === 'text' ? response.content[0].text : '';

    if (qualityChecker(text)) {
      return { response: text, modelUsed: model };
    }

    console.log(`${model} quality insufficient, escalating...`);
  }

  throw new Error('All models failed quality check');
}

// ตัวอย่าง: เช็คว่า response มี JSON valid หรือเปล่า
const result = await cascadeRoute(
  'Extract data as JSON from: ' + rawText,
  (response) => {
    try {
      JSON.parse(response);
      return true;
    } catch {
      return false; // escalate ไป model ที่ดีกว่า
    }
  }
);

console.log(`Final answer from: ${result.modelUsed}`);
```

---

## 💰 Spend Limits: ควบคุมค่าใช้จ่าย

### ระดับที่ 1: Anthropic Console (Organization Level)

```
console.anthropic.com → Settings → Billing → Spend Limits

- Monthly Limit: $200    ← หยุดทันทีเมื่อถึงวงเงิน
- Alert at 80%:          ← แจ้งเตือนก่อน
- Alert at 90%:          ← แจ้งเตือนอีกครั้ง
```

### ระดับที่ 2: Application Level (ควบคุมละเอียดกว่า)

```typescript
// src/billing/spend-tracker.ts
import { redis } from '../lib/redis';

interface SpendLimit {
  daily: number;   // USD
  monthly: number; // USD
  perUser: number; // USD per user per day
}

const LIMITS: SpendLimit = {
  daily:   50,    // $50/วัน
  monthly: 500,   // $500/เดือน
  perUser: 1,     // $1/user/วัน
};

// Token pricing (USD per token)
const PRICING: Record<string, { input: number; output: number }> = {
  'claude-haiku-4-5':  { input: 0.0000008,  output: 0.000004  },
  'claude-sonnet-4-5': { input: 0.000003,   output: 0.000015  },
  'claude-opus-4-5':   { input: 0.000015,   output: 0.000075  },
};

export async function checkAndTrackSpend(
  userId: string,
  model: string,
  inputTokens: number,
  outputTokens: number
): Promise<void> {
  const pricing = PRICING[model];
  if (!pricing) return;

  const cost = (inputTokens * pricing.input) + (outputTokens * pricing.output);
  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  const month = today.slice(0, 7); // YYYY-MM

  // อัปเดต counters ใน Redis (atomic)
  const pipeline = redis.pipeline();
  pipeline.incrbyfloat(`spend:daily:${today}`, cost);
  pipeline.incrbyfloat(`spend:monthly:${month}`, cost);
  pipeline.incrbyfloat(`spend:user:${userId}:${today}`, cost);
  pipeline.expire(`spend:daily:${today}`, 86400 * 2);      // TTL 2 วัน
  pipeline.expire(`spend:user:${userId}:${today}`, 86400 * 2);
  await pipeline.exec();

  // ตรวจ limits
  const [dailySpend, monthlySpend, userSpend] = await Promise.all([
    redis.get(`spend:daily:${today}`),
    redis.get(`spend:monthly:${month}`),
    redis.get(`spend:user:${userId}:${today}`),
  ]);

  const errors: string[] = [];
  if (parseFloat(dailySpend || '0') > LIMITS.daily) {
    errors.push(`Daily limit exceeded ($${LIMITS.daily})`);
  }
  if (parseFloat(monthlySpend || '0') > LIMITS.monthly) {
    errors.push(`Monthly limit exceeded ($${LIMITS.monthly})`);
  }
  if (parseFloat(userSpend || '0') > LIMITS.perUser) {
    errors.push(`User daily limit exceeded ($${LIMITS.perUser})`);
  }

  if (errors.length > 0) {
    // แจ้งเตือนทีม
    await notifySlack(`⚠️ Spend Alert: ${errors.join(', ')}`);
    throw new SpendLimitExceededError(errors.join('; '));
  }
}

// Middleware สำหรับ Express
export async function spendLimitMiddleware(req, res, next) {
  // ตรวจก่อนรับ request
  const today = new Date().toISOString().split('T')[0];
  const dailySpend = parseFloat(await redis.get(`spend:daily:${today}`) || '0');

  if (dailySpend >= LIMITS.daily * 0.9) {
    return res.status(429).json({
      error: 'Service temporarily limited due to high usage',
      resetAt: 'Tomorrow midnight',
    });
  }

  next();
}
```

### ระดับที่ 3: Dashboard ติดตาม Cost แบบ Real-time

```typescript
// src/billing/cost-dashboard.ts
export async function getCostDashboard(): Promise<CostReport> {
  const today = new Date().toISOString().split('T')[0];
  const month = today.slice(0, 7);

  const [dailyCost, monthlyCost] = await Promise.all([
    redis.get(`spend:daily:${today}`),
    redis.get(`spend:monthly:${month}`),
  ]);

  const daily   = parseFloat(dailyCost || '0');
  const monthly = parseFloat(monthlyCost || '0');

  return {
    daily: {
      spent: daily,
      limit: LIMITS.daily,
      percentUsed: (daily / LIMITS.daily) * 100,
      remaining: Math.max(0, LIMITS.daily - daily),
      status: daily > LIMITS.daily * 0.9 ? 'critical' :
              daily > LIMITS.daily * 0.7 ? 'warning' : 'ok',
    },
    monthly: {
      spent: monthly,
      limit: LIMITS.monthly,
      percentUsed: (monthly / LIMITS.monthly) * 100,
      remaining: Math.max(0, LIMITS.monthly - monthly),
      status: monthly > LIMITS.monthly * 0.9 ? 'critical' :
              monthly > LIMITS.monthly * 0.7 ? 'warning' : 'ok',
    },
  };
}
```

แสดงผลใน Terminal:

```
💰 SPEND DASHBOARD — 15 พ.ค. 2568
══════════════════════════════════════
📅 Daily:   $12.45 / $50.00  (24.9%) ✅
📆 Monthly: $127.80 / $500.00 (25.6%) ✅

Top Spenders Today:
  claude-opus-4-5:   $8.20 (65.9%)
  claude-sonnet-4-5: $3.90 (31.3%)
  claude-haiku-4-5:  $0.35  (2.8%)

💡 Recommendation: Consider routing simple tasks to Haiku
   Potential savings: ~$5/day (~$150/month)
```

---

## 📊 Cost Optimization Strategies

### Strategy 1: Token Budget per Request

```typescript
// กำหนด max_tokens ให้พอดี — ไม่เผื่อมากเกิน
const tokenBudgets: Record<string, number> = {
  classify:      100,   // แค่ 1-2 คำ
  summarize:     300,   // ย่อหน้าเดียว
  translate:     500,   // ขึ้นอยู่กับ input
  explain:      1000,   // อธิบายพอสมควร
  code_review:  2000,   // review ละเอียด
  full_analysis: 4096,  // วิเคราะห์เต็มที่
};
```

### Strategy 2: Response Cache (อย่าถาม Claude คำถามเดิมซ้ำๆ)

```typescript
import { createHash } from 'crypto';

const responseCache = new Map<string, { response: string; cachedAt: Date }>();
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 ชั่วโมง

async function cachedClaude(prompt: string, systemPrompt: string): Promise<string> {
  // สร้าง cache key จาก hash ของ prompt
  const cacheKey = createHash('sha256')
    .update(systemPrompt + prompt)
    .digest('hex');

  // ตรวจ cache ก่อน
  const cached = responseCache.get(cacheKey);
  if (cached && Date.now() - cached.cachedAt.getTime() < CACHE_TTL_MS) {
    console.log('[Cache HIT] Saved API call');
    return cached.response;
  }

  // ถ้า miss → เรียก API
  const response = await client.messages.create({
    model: 'claude-haiku-4-5',
    max_tokens: 1024,
    system: systemPrompt,
    messages: [{ role: 'user', content: prompt }],
  });

  const text = response.content[0].type === 'text' ? response.content[0].text : '';

  // บันทึก cache
  responseCache.set(cacheKey, { response: text, cachedAt: new Date() });
  return text;
}
```

---

## 💻 Hands-On: Smart Router + Spend Tracker

**สร้างระบบที่ route model อัตโนมัติ พร้อม cost tracking ครบถ้วน:**

```bash
claude
```

```
"สร้าง Smart AI Router สำหรับ Node.js TypeScript:

1. ModelRouter class ที่:
   - รับ prompt + taskHints (classify/analyze/generate/reason)
   - เลือก model อัตโนมัติ: Haiku/Sonnet/Opus
   - Log ทุก decision ว่าเลือก model อะไร ทำไม

2. SpendTracker class ที่:
   - บันทึก cost ทุก API call ใน memory (ไม่ต้องใช้ Redis ในตอนนี้)
   - คำนวณ cost จาก input+output tokens ตาม pricing จริง
   - warn เมื่อ daily spend เกิน $10
   - สรุป report เมื่อจบ session

3. Main function ทดสอบด้วย 5 prompts ที่ต่างกัน:
   - 'แปลคำว่า Hello เป็นภาษาไทย' → ควรใช้ Haiku
   - 'เขียน REST API สำหรับ user management' → ควรใช้ Sonnet
   - 'วิเคราะห์ระบบ microservices ที่ scale ได้ดีที่สุด' → ควรใช้ Opus
   - 'สรุปข้อความ: Hello world' → ควรใช้ Haiku
   - 'ออกแบบ database schema สำหรับ e-commerce' → ควรใช้ Sonnet

แสดง cost comparison ในตอนท้ายว่าถ้าใช้ Opus ทั้งหมด vs Router จะต่างกันแค่ไหน"
```

---

## 🎯 สรุปบทที่ 16

| หัวข้อ | สิ่งที่ต้องจำ |
|--------|--------------|
| 3 Model Tiers | Haiku (ถูก/เร็ว) → Sonnet (สมดุล) → Opus (ซับซ้อน) |
| Rule-Based Routing | ตั้งกฎตาม taskType / promptLength / complexity |
| Two-Stage Routing | ใช้ Haiku classify งาน → ส่งต่อ model ที่เหมาะ |
| Cascading Fallback | ลอง Haiku ก่อน → escalate ถ้า quality ไม่พอ |
| Spend Limits | Console limit + App-level Redis tracking + per-user limit |
| Response Cache | Cache คำตอบเดิม TTL 1 ชั่วโมง — ประหยัดได้ 30-50% |

---

## 📋 Action Items ก่อนไปบทที่ 17

- [ ] implement Rule-Based Router สำหรับโปรเจกต์ปัจจุบัน
- [ ] ตั้ง Spend Limit ที่ Anthropic Console
- [ ] เพิ่ม Cost Tracking ในทุก API call
- [ ] ทดสอบ Two-Stage Routing ว่าเลือก model ได้ถูกต้องไหม
- [ ] คำนวณว่าถ้า Route ถูกจะประหยัดเท่าไหร่ต่อเดือน

---

*ใน **บทที่ 17** เราจะเรียนรู้ Prompt Caching & Batch API — เทคนิคที่ประหยัดค่า API ได้ 90% สำหรับงานที่ใช้ System Prompt เดิมซ้ำๆ และวิธีประมวลผลข้อมูลขนาดใหญ่ด้วยค่าใช้จ่ายที่ถูกที่สุดครับ*
