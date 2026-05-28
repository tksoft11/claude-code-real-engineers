# บทที่ 14: Bridging the Gap — จาก CLI สู่ Anthropic SDK

---

## 🪝 เมื่อ CLI ไม่เพียงพออีกต่อไป

นายนิว Full-Stack Developer สร้างเครื่องมือวิเคราะห์ feedback จากลูกค้าด้วย Claude Code CLI — ทำงานได้ดีมากบนเครื่องตัวเอง

แต่แล้วหัวหน้าขอว่า:

> "เยี่ยมมาก! เอาไปใส่ใน Dashboard ของ Customer Service Team ได้ไหม? ให้ทีมกดปุ่มแล้วได้ผลเลยโดยไม่ต้องเปิด Terminal"

นิวเริ่มตระหนักว่า **Claude Code CLI** คือเครื่องมือสำหรับ Developer — แต่ระบบจริงในองค์กรต้องการ **Anthropic SDK** ที่ฝังอยู่ในแอปพลิเคชัน

นั่นคือจุดที่บทนี้เริ่มต้นครับ

---

## 🧠 CLI vs SDK: เลือกอะไรเมื่อไหร่

```
┌─────────────────────────────────────────────────────────────┐
│                    Claude Code CLI                          │
│                                                             │
│  ✅ เขียนโค้ด, Debug, Refactor ส่วนตัว                      │
│  ✅ Ralph Loop ข้ามคืน                                       │
│  ✅ Explore codebase ใหม่                                    │
│  ❌ ฝังใน Web App ไม่ได้                                     │
│  ❌ ให้ Users อื่นใช้ไม่ได้โดยตรง                            │
│  ❌ Automate ใน production pipeline ยาก                     │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                    Anthropic SDK                            │
│                                                             │
│  ✅ ฝังใน Web App, Mobile App, Backend Service              │
│  ✅ ให้ Users ทั่วไปใช้โดยไม่ต้อง Install อะไร              │
│  ✅ Control ทุกอย่างจาก Code: Model, Parameters, Cost       │
│  ✅ Streaming, Tool Use, Vision — ทุก Feature ของ Claude    │
│  ❌ ต้องเขียนโค้ดมากกว่า CLI                                │
└─────────────────────────────────────────────────────────────┘
```

**กฎง่ายๆ:**
- ใช้งานส่วนตัวในฐานะ Developer → **Claude Code CLI**
- สร้างระบบให้คนอื่นใช้ → **Anthropic SDK**

---

## 🔐 ก่อนเริ่ม: API Key อย่างปลอดภัย

นี่คือสิ่งสำคัญที่สุดก่อนเริ่มใช้ SDK ครับ

### ❌ วิธีที่ผิด (อย่าทำ)

```python
# อย่าทำแบบนี้เด็ดขาด!
client = anthropic.Anthropic(api_key="sk-ant-xxxxxxxxxxxxx")
```

```javascript
// หรือแบบนี้
const client = new Anthropic({ apiKey: "sk-ant-xxxxxxxxxxxxx" });
```

ถ้า commit ขึ้น Git → Key หลุด → มีคนอื่นใช้ → บิลล์บาน

### ✅ วิธีที่ถูก: Environment Variables

```bash
# สร้างไฟล์ .env (ห้าม commit!)
echo "ANTHROPIC_API_KEY=sk-ant-xxxxxxxxxxxxx" > .env
echo ".env" >> .gitignore
```

```python
# Python — โหลดจาก .env
from dotenv import load_dotenv
import os

load_dotenv()
# SDK จะอ่าน ANTHROPIC_API_KEY จาก environment อัตโนมัติ
client = anthropic.Anthropic()  # ไม่ต้องใส่ api_key!
```

```typescript
// Node.js — โหลดจาก .env
import 'dotenv/config';
// SDK จะอ่าน ANTHROPIC_API_KEY จาก environment อัตโนมัติ
const client = new Anthropic();  // ไม่ต้องใส่ apiKey!
```

---

## 💻 Installation & First Call

### Python

```bash
pip install anthropic python-dotenv
```

```python
# hello_claude.py
import anthropic
from dotenv import load_dotenv

load_dotenv()
client = anthropic.Anthropic()

message = client.messages.create(
    model="claude-sonnet-4-5",
    max_tokens=1024,
    messages=[
        {"role": "user", "content": "สวัสดี Claude! แนะนำตัวเองสั้นๆ เป็นภาษาไทย"}
    ]
)

print(message.content[0].text)
```

### Node.js / TypeScript

```bash
npm install @anthropic-ai/sdk dotenv
```

```typescript
// hello_claude.ts
import Anthropic from '@anthropic-ai/sdk';
import 'dotenv/config';

const client = new Anthropic();

async function main() {
  const message = await client.messages.create({
    model: 'claude-sonnet-4-5',
    max_tokens: 1024,
    messages: [
      { role: 'user', content: 'สวัสดี Claude! แนะนำตัวเองสั้นๆ เป็นภาษาไทย' }
    ],
  });

  console.log(message.content[0].type === 'text' ? message.content[0].text : '');
}

main();
```

---

## 🏗️ เข้าใจโครงสร้าง Message API

### The Message Object

```typescript
// โครงสร้างสมบูรณ์ของ API Call
const response = await client.messages.create({
  // 1. Model ที่จะใช้
  model: 'claude-sonnet-4-5',

  // 2. จำนวน tokens สูงสุดที่ต้องการใน response
  max_tokens: 2048,

  // 3. System Prompt — บุคลิกและกฎของ AI (ไม่บังคับ)
  system: `คุณคือ Customer Service AI สำหรับร้าน TechShop
  ตอบเป็นภาษาไทยเสมอ
  ถ้าไม่รู้คำตอบ ให้บอกตรงๆ อย่าเดา
  ห้ามให้ส่วนลดเกิน 10% โดยไม่ได้รับอนุมัติ`,

  // 4. รายการ messages (conversation history)
  messages: [
    { role: 'user', content: 'สินค้า iPhone 16 มีในสต็อกไหมครับ?' },
    { role: 'assistant', content: 'มีในสต็อกครับ มีทั้งสี Natural Titanium และ Black Titanium' },
    { role: 'user', content: 'ราคาเท่าไหร่?' },
    // Claude จะตอบ message ล่าสุดนี้
  ],
});
```

### The Response Object

```typescript
console.log(response.id);              // msg_xxxxx
console.log(response.model);           // claude-sonnet-4-5
console.log(response.stop_reason);     // 'end_turn' | 'max_tokens' | 'stop_sequence'

// Content ที่ Claude ตอบ
const text = response.content[0].text; // string

// Token Usage (สำคัญสำหรับ Cost Control)
console.log(response.usage.input_tokens);  // tokens ที่ส่งไป
console.log(response.usage.output_tokens); // tokens ที่ได้กลับมา

// คำนวณค่าใช้จ่าย (Sonnet pricing)
const inputCost  = response.usage.input_tokens  * 0.000003;  // $3/1M tokens
const outputCost = response.usage.output_tokens * 0.000015;  // $15/1M tokens
const totalUSD   = inputCost + outputCost;
console.log(`Cost: $${totalUSD.toFixed(6)}`);
```

---

## 🔄 Conversation Management: จำประวัติการสนทนา

Claude API เป็น Stateless — ทุก call คือ "ความทรงจำใหม่"

ต้องจัดการประวัติการสนทนาเองถ้าต้องการให้ Claude จำสิ่งที่คุยไปแล้ว:

```typescript
// conversation-manager.ts
interface Message {
  role: 'user' | 'assistant';
  content: string;
}

class ConversationManager {
  private history: Message[] = [];
  private systemPrompt: string;
  private client: Anthropic;

  constructor(systemPrompt: string) {
    this.systemPrompt = systemPrompt;
    this.client = new Anthropic();
  }

  async chat(userMessage: string): Promise<string> {
    // เพิ่ม user message เข้า history
    this.history.push({ role: 'user', content: userMessage });

    // ส่ง history ทั้งหมดไปกับทุก request
    const response = await this.client.messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: 2048,
      system: this.systemPrompt,
      messages: this.history,
    });

    const assistantMessage = response.content[0].type === 'text'
      ? response.content[0].text
      : '';

    // เพิ่ม assistant response เข้า history
    this.history.push({ role: 'assistant', content: assistantMessage });

    return assistantMessage;
  }

  clearHistory(): void {
    this.history = [];
  }

  getHistory(): Message[] {
    return [...this.history];
  }
}

// ใช้งาน
const chat = new ConversationManager(
  'คุณคือ AI ที่ช่วยวิเคราะห์ code ตอบเป็นภาษาไทย'
);

const reply1 = await chat.chat('ช่วยอธิบาย async/await ให้หน่อย');
const reply2 = await chat.chat('แล้วมันต่างจาก Promise ยังไง?'); // จำบริบทก่อนหน้า
const reply3 = await chat.chat('ให้ตัวอย่างโค้ดสักอัน');        // ยังจำทั้งหมด
```

---

## ⚠️ Error Handling ที่ต้องรู้

```typescript
import Anthropic, { APIError, RateLimitError, APIConnectionError } from '@anthropic-ai/sdk';

async function safeCall(prompt: string): Promise<string> {
  try {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }],
    });
    return response.content[0].type === 'text' ? response.content[0].text : '';

  } catch (error) {
    if (error instanceof RateLimitError) {
      // 429: ส่ง request เร็วเกินไป
      console.log('Rate limited. Waiting 60 seconds...');
      await sleep(60000);
      return safeCall(prompt); // retry

    } else if (error instanceof APIConnectionError) {
      // Network error — retry ได้
      console.log('Connection error. Retrying...');
      await sleep(5000);
      return safeCall(prompt);

    } else if (error instanceof APIError) {
      // API error อื่นๆ
      console.error(`API Error ${error.status}: ${error.message}`);

      if (error.status === 400) {
        throw new Error(`Invalid request: ${error.message}`);
      } else if (error.status === 401) {
        throw new Error('Invalid API key — check ANTHROPIC_API_KEY');
      } else if (error.status === 529) {
        // Claude overloaded
        console.log('Claude overloaded. Waiting 30 seconds...');
        await sleep(30000);
        return safeCall(prompt);
      }
      throw error;
    }
    throw error;
  }
}
```

---

## 💡 Model Selection: เลือก Model ให้ถูก

```typescript
// src/config/models.ts
export const MODELS = {
  // ถูกที่สุด — ใช้กับงาน simple, repetitive
  FAST: 'claude-haiku-4-5',

  // สมดุลที่ดี — ใช้กับงานทั่วไป
  BALANCED: 'claude-sonnet-4-5',

  // ทรงพลังที่สุด — ใช้กับงานซับซ้อน
  POWERFUL: 'claude-opus-4-5',
} as const;

// เลือก model ตามประเภทงาน
function selectModel(taskType: 'classify' | 'analyze' | 'generate' | 'reason'): string {
  switch (taskType) {
    case 'classify':  return MODELS.FAST;      // จัดหมวดหมู่ — ง่าย
    case 'analyze':   return MODELS.BALANCED;  // วิเคราะห์ — กลาง
    case 'generate':  return MODELS.BALANCED;  // สร้าง content — กลาง
    case 'reason':    return MODELS.POWERFUL;  // ใช้เหตุผลซับซ้อน — สูง
  }
}
```

**ตัวอย่าง Cost Comparison จริง:**

```
งาน: จัดหมวดหมู่ feedback 1,000 รายการ (~100 tokens/รายการ)

Haiku:  1,000 × 100 tokens × $0.00000025 = $0.025 (~0.90 บาท)
Sonnet: 1,000 × 100 tokens × $0.000003   = $0.30  (~11 บาท)
Opus:   1,000 × 100 tokens × $0.000015   = $1.50  (~54 บาท)

→ ใช้ Haiku สำหรับ classification ประหยัดได้ 60x เทียบกับ Opus
```

---

## 💻 Hands-On: Customer Feedback Analyzer

สร้างระบบวิเคราะห์ feedback จริงโดยใช้ SDK:

```typescript
// feedback-analyzer.ts
import Anthropic from '@anthropic-ai/sdk';
import 'dotenv/config';

const client = new Anthropic();

interface FeedbackAnalysis {
  sentiment: 'positive' | 'negative' | 'neutral';
  category: string;
  priority: 'high' | 'medium' | 'low';
  summary: string;
  suggestedAction: string;
}

async function analyzeFeedback(feedback: string): Promise<FeedbackAnalysis> {
  const response = await client.messages.create({
    model: 'claude-haiku-4-5', // ใช้ Haiku เพราะงานนี้ไม่ซับซ้อน
    max_tokens: 512,
    system: `วิเคราะห์ feedback ของลูกค้าและตอบในรูปแบบ JSON เท่านั้น
    ห้ามเพิ่มข้อความอื่น ตอบแค่ JSON object`,
    messages: [{
      role: 'user',
      content: `วิเคราะห์ feedback นี้:
"${feedback}"

ตอบในรูปแบบ JSON:
{
  "sentiment": "positive|negative|neutral",
  "category": "product|service|delivery|price|other",
  "priority": "high|medium|low",
  "summary": "สรุปสั้นๆ ภาษาไทย",
  "suggestedAction": "การกระทำที่แนะนำ"
}`
    }],
  });

  const text = response.content[0].type === 'text' ? response.content[0].text : '{}';
  return JSON.parse(text) as FeedbackAnalysis;
}

// ทดสอบ
const feedbacks = [
  'ส่งของเร็วมากครับ แต่กล่องยุบนิดหน่อย สินค้าโอเค',
  'รอนาน 2 อาทิตย์แล้วยังไม่ได้ของเลย โกรธมากๆ',
  'ราคาดีครับ คุณภาพคุ้มค่า จะสั่งอีกแน่นอน',
];

for (const feedback of feedbacks) {
  const analysis = await analyzeFeedback(feedback);
  console.log(`\nFeedback: "${feedback}"`);
  console.log(`Sentiment: ${analysis.sentiment} | Priority: ${analysis.priority}`);
  console.log(`Summary: ${analysis.summary}`);
  console.log(`Action: ${analysis.suggestedAction}`);
}
```

**ผลลัพธ์:**
```
Feedback: "ส่งของเร็วมากครับ แต่กล่องยุบนิดหน่อย สินค้าโอเค"
Sentiment: positive | Priority: low
Summary: ลูกค้าพอใจการจัดส่งแต่มีปัญหาบรรจุภัณฑ์เล็กน้อย
Action: ส่งอีเมลขอโทษและแนะนำวิธีปรับปรุงการจัดส่ง

Feedback: "รอนาน 2 อาทิตย์แล้วยังไม่ได้ของเลย โกรธมากๆ"
Sentiment: negative | Priority: high
Summary: ลูกค้าไม่ได้รับสินค้าหลังรอ 2 สัปดาห์
Action: ติดต่อกลับทันทีและตรวจสอบสถานะการจัดส่ง
```

---

## 🎯 สรุปบทที่ 14

| หัวข้อ | สิ่งที่ต้องจำ |
|--------|--------------|
| CLI vs SDK | CLI = Dev tool ส่วนตัว / SDK = ฝังในระบบ |
| API Key | `.env` + `gitignore` เสมอ — ห้าม hardcode |
| Message Structure | system (บุคลิก) + messages (ประวัติ) |
| Stateless API | ต้องส่ง history ทุกครั้ง ถ้าต้องการให้จำ |
| Error Handling | RateLimitError → retry / APIConnectionError → retry |
| Model Selection | Haiku (ถูก/เร็ว) → Sonnet (สมดุล) → Opus (ซับซ้อน) |

---

## 📋 Action Items ก่อนไปบทที่ 15

- [ ] ติดตั้ง Anthropic SDK สำหรับภาษาที่ใช้ (Python หรือ Node.js)
- [ ] สร้าง `.env` + `.gitignore` อย่างถูกต้อง
- [ ] รัน "First API Call" ให้สำเร็จ
- [ ] สร้าง Feedback Analyzer ด้วยโค้ดในบทนี้
- [ ] วัด token usage และคำนวณ cost per call

---

*ใน **บทที่ 15** เราจะเรียนรู้ Streaming Responses — เทคนิคที่ทำให้ AI ตอบ "ทีละตัวอักษร" แบบ real-time เหมือน Claude.ai ซึ่งเป็นความต่างระหว่าง "รอนาน 5 วินาทีแล้วได้คำตอบ" กับ "เห็น AI กำลังคิดแบบ live" ครับ*
