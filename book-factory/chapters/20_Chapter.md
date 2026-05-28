# บทที่ 20: Structured Outputs — บังคับ JSON Schema ทุกกระเบียดนิ้ว

---

## 🪝 เมื่อ AI ตอบแบบ "ไม่อยู่กับร่องกับรอย"

ระบบ E-Commerce ต้องการให้ Claude วิเคราะห์ feedback จากลูกค้าแล้วส่งผลลัพธ์ไปเก็บ Database

```javascript
const result = await claude.analyze(feedback);
database.save(result); // 💥 ERROR ทุกวัน
```

ลอง log ดูว่า result เป็นอะไร:

```
// วันที่ 1:
"Sentiment: Positive. Score: 8/10. Category: Delivery"

// วันที่ 2:
{ "feeling": "good", "rating": "8 out of 10" }

// วันที่ 3:
"The customer seems happy about the delivery speed! I'd rate this 8/10."

// วันที่ 4:
{ sentiment: "positive", score: 8, category: "delivery" }
```

**Claude ตอบได้ถูกต้องทุกครั้ง — แต่ format ต่างกันทุกวัน**

ปัญหาคือ Claude เป็น Language Model — ถ้าไม่บังคับ format อย่างเข้มงวด มันจะเลือก format ที่ "สื่อสารได้ดีที่สุด" ไม่ใช่ format ที่โค้ดคุณต้องการ

**Structured Outputs** แก้ปัญหานี้โดยบังคับให้ Claude ตอบใน JSON Schema ที่คุณกำหนด

---

## 🧠 วิธีที่ Structured Outputs ทำงาน

มี 3 approach ตามระดับความเข้มงวด:

```
Level 1: Prompt Engineering      → บอกใน system prompt ว่าต้องการ JSON
                                   ง่ายสุด แต่ไม่ reliable 100%

Level 2: JSON Mode               → บังคับให้ตอบ valid JSON เสมอ
                                   ดีกว่า แต่ schema ยังไม่แน่นอน

Level 3: Schema + Validation     → บังคับ JSON + validate ด้วย Zod
                                   ดีที่สุด Production-grade
```

---

## 📐 Level 1: Prompt Engineering

```typescript
// วิธีนี้ใช้ได้แต่ไม่น่าเชื่อถือ 100%
const response = await client.messages.create({
  model: 'claude-haiku-4-5',
  max_tokens: 512,
  system: `ตอบด้วย JSON เท่านั้น ไม่มีข้อความอื่น
  Format ที่ต้องการ:
  {
    "sentiment": "positive" | "negative" | "neutral",
    "score": number (0-10),
    "category": "product" | "delivery" | "service" | "other",
    "summary": string
  }`,
  messages: [{ role: 'user', content: feedback }],
});

// ปัญหา: Claude อาจเพิ่ม markdown code block หรือ prefix text
const raw = response.content[0].text;
// "```json\n{ ... }\n```"  ← parse ไม่ได้ทันที!
```

**ทางแก้สำหรับ Level 1:**

```typescript
function extractJSON(raw: string): unknown {
  // ลบ markdown code blocks
  const cleaned = raw
    .replace(/```json\n?/g, '')
    .replace(/```\n?/g, '')
    .trim();

  try {
    return JSON.parse(cleaned);
  } catch {
    // ลอง extract JSON object/array จาก text
    const match = cleaned.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
    if (match) return JSON.parse(match[0]);
    throw new Error(`Cannot extract JSON from: ${raw.slice(0, 100)}`);
  }
}
```

---

## 🔒 Level 2: JSON Mode (Reliable)

บังคับ valid JSON ด้วยการใช้ stop sequence:

```typescript
const response = await client.messages.create({
  model: 'claude-haiku-4-5',
  max_tokens: 512,
  system: `ตอบด้วย JSON object เท่านั้น
  Schema:
  {
    "sentiment": "positive" | "negative" | "neutral",
    "score": number ระหว่าง 0-10,
    "category": "product" | "delivery" | "service" | "other",
    "summary": string ภาษาไทย ไม่เกิน 50 คำ,
    "actionRequired": boolean
  }
  
  กฎเหล็ก:
  - เริ่มต้นด้วย { เสมอ
  - ไม่มีข้อความนอก JSON
  - ห้ามมี trailing comma
  - ใช้ double quotes เสมอ`,
  messages: [
    {
      role: 'user',
      content: `วิเคราะห์ feedback นี้: "${feedback}"`,
    },
    {
      role: 'assistant',
      content: '{', // ← "pre-fill" บังคับให้เริ่มด้วย {
    },
  ],
});

// Claude จะต่อจาก { ที่เราใส่ไว้
const fullJSON = '{' + response.content[0].text;
const parsed = JSON.parse(fullJSON);
```

> **เทคนิค Assistant Pre-fill:** ใส่ `{ role: 'assistant', content: '{' }` เป็น message สุดท้ายก่อนส่ง Claude จะต่อจากนั้นเสมอ → รับประกันว่าเริ่มด้วย `{`

---

## 🛡️ Level 3: Schema + Validation (Production-Grade)

ใช้ **Zod** validate ทุก response — วิธีที่ดีที่สุดสำหรับ Production:

```typescript
// src/schemas/feedback-analysis.schema.ts
import { z } from 'zod';

export const FeedbackAnalysisSchema = z.object({
  sentiment: z.enum(['positive', 'negative', 'neutral']),
  score: z.number().min(0).max(10),
  category: z.enum(['product', 'delivery', 'service', 'pricing', 'other']),
  summary: z.string().min(5).max(200),
  actionRequired: z.boolean(),
  suggestedAction: z.string().optional(),
  tags: z.array(z.string()).max(5).default([]),
});

export type FeedbackAnalysis = z.infer<typeof FeedbackAnalysisSchema>;
```

```typescript
// src/services/feedback.service.ts
import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import { FeedbackAnalysisSchema, type FeedbackAnalysis } from '../schemas/feedback-analysis.schema';

const client = new Anthropic();

async function analyzeFeedback(
  feedback: string,
  maxRetries = 3
): Promise<FeedbackAnalysis> {
  const systemPrompt = `วิเคราะห์ feedback ของลูกค้าและตอบใน JSON format นี้เท่านั้น:
${JSON.stringify(FeedbackAnalysisSchema.shape, null, 2)}

กฎ:
- sentiment: "positive" ถ้าลูกค้าพอใจ, "negative" ถ้าไม่พอใจ, "neutral" ถ้ากลางๆ
- score: 0 (แย่สุด) ถึง 10 (ดีสุด)
- actionRequired: true ถ้าต้องการ follow-up จากทีม
- suggestedAction: ใส่เฉพาะเมื่อ actionRequired = true
ตอบ JSON เท่านั้น ไม่มี markdown`;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await client.messages.create({
        model: 'claude-haiku-4-5',
        max_tokens: 512,
        system: systemPrompt,
        messages: [
          { role: 'user', content: feedback },
          { role: 'assistant', content: '{' }, // Pre-fill
        ],
      });

      const raw = '{' + (response.content[0].type === 'text' ? response.content[0].text : '');

      // Parse JSON
      let parsed: unknown;
      try {
        parsed = JSON.parse(raw);
      } catch (parseError) {
        throw new Error(`Invalid JSON on attempt ${attempt}: ${raw.slice(0, 100)}`);
      }

      // Validate Schema
      const validated = FeedbackAnalysisSchema.parse(parsed);
      return validated; // ✅ สำเร็จ

    } catch (error) {
      if (error instanceof z.ZodError) {
        console.warn(`Schema validation failed (attempt ${attempt}):`, error.flatten());
        if (attempt === maxRetries) {
          throw new Error(`All ${maxRetries} attempts failed schema validation`);
        }
        // ลองใหม่ด้วย feedback เพิ่มเติม
      } else if (attempt === maxRetries) {
        throw error;
      }
    }
  }

  throw new Error('Unreachable');
}
```

---

## 🏗️ Structured Output Patterns ขั้นสูง

### Pattern 1: Nested Schema

```typescript
// Schema ซ้อนกันหลายชั้น
const OrderExtractionSchema = z.object({
  customer: z.object({
    name: z.string(),
    email: z.string().email(),
    phone: z.string().regex(/^0[0-9]{9}$/).optional(),
  }),
  items: z.array(z.object({
    name: z.string(),
    quantity: z.number().int().positive(),
    unitPrice: z.number().positive(), // สตางค์
  })).min(1),
  shipping: z.object({
    address: z.string(),
    province: z.string(),
    postalCode: z.string().regex(/^[0-9]{5}$/),
    method: z.enum(['standard', 'express', 'same_day']),
  }),
  totalAmount: z.number().positive(),
  specialInstructions: z.string().optional(),
});

// ใช้กับการแปลง email/chat → structured order
async function extractOrderFromText(text: string) {
  // ส่ง schema เป็น string ใน prompt
  const schemaDescription = `{
  "customer": { "name": string, "email": string, "phone": string? },
  "items": [{ "name": string, "quantity": integer, "unitPrice": number }],
  "shipping": { "address": string, "province": string, "postalCode": "5 digits", "method": "standard|express|same_day" },
  "totalAmount": number (สตางค์),
  "specialInstructions": string?
}`;

  // ... (เรียก Claude แล้ว validate ด้วย OrderExtractionSchema)
}
```

### Pattern 2: Union Types (หลาย Shape)

```typescript
// Claude ต้องเลือก shape ตาม type
const EventSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('payment_success'),
    orderId: z.string(),
    amount: z.number(),
    paymentMethod: z.string(),
  }),
  z.object({
    type: z.literal('payment_failed'),
    orderId: z.string(),
    errorCode: z.string(),
    retryable: z.boolean(),
  }),
  z.object({
    type: z.literal('refund_requested'),
    orderId: z.string(),
    amount: z.number(),
    reason: z.string(),
  }),
]);

type Event = z.infer<typeof EventSchema>;

async function classifyEvent(description: string): Promise<Event> {
  // ส่ง schema ทุก variant ไปใน prompt
  // ...
}
```

### Pattern 3: Schema Generation จาก TypeScript Types

```typescript
// ถ้ามี TypeScript interface อยู่แล้ว ใช้ zodToJsonSchema แปลงเป็น prompt
import { zodToJsonSchema } from 'zod-to-json-schema';

const jsonSchema = zodToJsonSchema(FeedbackAnalysisSchema);

const systemPrompt = `ตอบใน JSON ที่ตรงกับ schema นี้:
${JSON.stringify(jsonSchema, null, 2)}`;
```

---

## 🔄 Structured Output Pipeline

สำหรับ Production ให้สร้าง pipeline ที่ handle ทุกกรณี:

```typescript
// src/utils/structured-claude.ts
import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';

const client = new Anthropic();

interface StructuredCallOptions<T extends z.ZodTypeAny> {
  prompt: string;
  schema: T;
  systemPrompt?: string;
  model?: string;
  maxRetries?: number;
  onRetry?: (attempt: number, error: Error) => void;
}

export async function structuredClaude<T extends z.ZodTypeAny>(
  options: StructuredCallOptions<T>
): Promise<z.infer<T>> {
  const {
    prompt,
    schema,
    systemPrompt = '',
    model = 'claude-haiku-4-5',
    maxRetries = 3,
    onRetry,
  } = options;

  // สร้าง schema description สำหรับ prompt
  const schemaStr = JSON.stringify(zodToJsonSchema(schema), null, 2);

  const fullSystem = `${systemPrompt}

ตอบด้วย JSON ที่ตรงกับ schema นี้เท่านั้น:
${schemaStr}

กฎ: ตอบ JSON เท่านั้น ไม่มี markdown ไม่มีข้อความอื่น`;

  let lastError: Error = new Error('Unknown error');

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await client.messages.create({
        model,
        max_tokens: 2048,
        system: fullSystem,
        messages: [
          { role: 'user', content: prompt },
          { role: 'assistant', content: '{' },
        ],
      });

      const raw = '{' + (response.content[0].type === 'text' ? response.content[0].text : '');
      const parsed = JSON.parse(raw);
      return schema.parse(parsed);

    } catch (error) {
      lastError = error as Error;
      if (attempt < maxRetries) {
        onRetry?.(attempt, lastError);
      }
    }
  }

  throw new Error(`structuredClaude failed after ${maxRetries} attempts: ${lastError.message}`);
}

// ใช้งาน — สะอาด กระชับ type-safe
const analysis = await structuredClaude({
  prompt: `วิเคราะห์: "${feedback}"`,
  schema: FeedbackAnalysisSchema,
  model: 'claude-haiku-4-5',
  onRetry: (attempt, error) => logger.warn(`Retry ${attempt}:`, error.message),
});

// TypeScript รู้ type ของ analysis ทันที!
console.log(analysis.sentiment);     // "positive" | "negative" | "neutral"
console.log(analysis.score);         // number
console.log(analysis.actionRequired); // boolean
```

---

## 💻 Hands-On: Invoice Parser

**สร้างระบบแปลงข้อความ invoice → structured data:**

```typescript
// invoice-parser.ts
import { z } from 'zod';
import { structuredClaude } from './utils/structured-claude';

const InvoiceSchema = z.object({
  invoiceNumber: z.string(),
  issueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), // YYYY-MM-DD
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  vendor: z.object({
    name: z.string(),
    taxId: z.string().optional(),
    address: z.string().optional(),
  }),
  lineItems: z.array(z.object({
    description: z.string(),
    quantity: z.number().positive(),
    unitPrice: z.number().nonnegative(),
    total: z.number().nonnegative(),
  })),
  subtotal: z.number().nonnegative(),
  vat: z.number().nonnegative(),
  grandTotal: z.number().positive(),
  currency: z.string().default('THB'),
  notes: z.string().optional(),
});

type Invoice = z.infer<typeof InvoiceSchema>;

async function parseInvoice(rawText: string): Promise<Invoice> {
  return structuredClaude({
    prompt: `แปลงข้อมูล invoice ต่อไปนี้เป็น structured data:\n\n${rawText}`,
    schema: InvoiceSchema,
    systemPrompt: 'คุณคือ AI ที่ expert ด้านการอ่านและแปลง invoice ภาษาไทย',
    onRetry: (attempt) => console.log(`Invoice parse retry: ${attempt}`),
  });
}

// ทดสอบ
const rawInvoice = `
ใบแจ้งหนี้ เลขที่ INV-2025-001
วันที่ออก: 15 พฤษภาคม 2568
ครบกำหนด: 30 พฤษภาคม 2568

จาก: บริษัท ABC จำกัด
เลขภาษี: 0105565012345

รายการ:
1. Software License x 1 @ 15,000 บาท = 15,000 บาท
2. Support Fee x 12 เดือน @ 2,500 บาท = 30,000 บาท

ยอดรวม: 45,000 บาท
VAT 7%: 3,150 บาท
ยอดสุทธิ: 48,150 บาท
`;

const invoice = await parseInvoice(rawInvoice);
console.log('Invoice Number:', invoice.invoiceNumber);
console.log('Grand Total:', invoice.grandTotal);
console.log('Line Items:', invoice.lineItems.length);
```

---

## 🎯 สรุปบทที่ 20

| หัวข้อ | สิ่งที่ต้องจำ |
|--------|--------------|
| ปัญหา | Claude ตอบ format ต่างกันทุกครั้ง — production ใช้ไม่ได้ |
| Level 1 | Prompt engineering + extractJSON() — ง่ายแต่ไม่ reliable |
| Level 2 | Assistant pre-fill `{` — บังคับเริ่มต้นด้วย JSON |
| Level 3 | Zod schema validation — ดีที่สุด Production-grade |
| Pattern | `structuredClaude()` utility ที่ใช้ซ้ำได้ทุกโปรเจกต์ |
| Retry | Schema fail → retry สูงสุด 3 ครั้ง ก่อน throw |

---

## 📋 Action Items ก่อนไปบทที่ 21

- [ ] ติดตั้ง `zod` และ `zod-to-json-schema` ใน project
- [ ] สร้าง `structuredClaude()` utility function
- [ ] เปลี่ยน AI call ที่ parse JSON เองมาใช้ Zod validation
- [ ] สร้าง Invoice Parser ด้วยโค้ดในบทนี้
- [ ] เพิ่ม onRetry logging ใน production API calls

---

*ใน **บทที่ 21** เราจะเรียนรู้ AI Ethics & IP in Commercial Projects — เส้นแดงที่ห้ามข้าม เรื่อง PDPA, ลิขสิทธิ์โค้ดที่ AI เขียน, และการ compliance ที่ทีม Legal ต้องการก่อนอนุมัติ AI ใน enterprise ครับ*
