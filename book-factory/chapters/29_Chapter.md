# บทที่ 29: [Capstone Vol 2] The AI-Powered SaaS Backend

---

## 🎯 สิ่งที่เราจะสร้าง

**TechDesk AI** — Customer Support Backend ที่รวมทุกสิ่งจาก Volume 2:

```
ลูกค้าถาม → Streaming response
            + RAG ค้นหาเอกสาร (Ch 25-26)
            + Tool Use สร้าง Jira ticket (Ch 22)
            + Structured Output เก็บ analytics (Ch 20)
            + Model Routing ตามความซับซ้อน (Ch 16)
            + Prompt Caching ประหยัด cost (Ch 17)
```

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────┐
│                     TechDesk AI                         │
├─────────────────────────────────────────────────────────┤
│  POST /api/support/chat        ← Streaming chat         │
│  POST /api/support/analyze     ← Structured analysis    │
│  POST /api/docs/index          ← RAG document indexing  │
│  GET  /api/analytics/today     ← Usage dashboard        │
├─────────────────────────────────────────────────────────┤
│  Services:                                              │
│  ├── RAGService       ← pgvector + embeddings           │
│  ├── TicketService    ← Tool Use → Jira API             │
│  ├── RouterService    ← Haiku/Sonnet/Opus selection     │
│  ├── CacheService     ← Prompt caching                  │
│  └── AnalyticsService ← Structured output tracking      │
└─────────────────────────────────────────────────────────┘
```

---

## 📦 Setup

```bash
mkdir techdesk-ai && cd techdesk-ai
npm install @anthropic-ai/sdk openai @prisma/client prisma \
            express zod axios dotenv cors
npm install -D typescript ts-node @types/node @types/express
```

---

## 🧩 Service 1: Smart Router

```typescript
// src/services/router.service.ts
import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic();

type Complexity = 'simple' | 'moderate' | 'complex';

export async function classifyComplexity(question: string): Promise<Complexity> {
  const res = await client.messages.create({
    model: 'claude-haiku-4-5', // ใช้ Haiku classify (ถูกมาก)
    max_tokens: 20,
    system: 'Reply with ONE word only: SIMPLE, MODERATE, or COMPLEX',
    messages: [{ role: 'user', content: question }],
  });
  const word = res.content[0].type === 'text' ? res.content[0].text.trim().toUpperCase() : '';
  if (word === 'SIMPLE') return 'simple';
  if (word === 'COMPLEX') return 'complex';
  return 'moderate';
}

export function selectModel(complexity: Complexity): string {
  return {
    simple:   'claude-haiku-4-5',
    moderate: 'claude-sonnet-4-5',
    complex:  'claude-opus-4-5',
  }[complexity];
}
```

---

## 🧩 Service 2: RAG Search

```typescript
// src/services/rag.service.ts
import { OpenAI } from 'openai';
import { PrismaClient } from '@prisma/client';

const openai = new OpenAI();
const prisma = new PrismaClient();

// System prompt ที่ใช้ซ้ำ — cache ไว้ที่ Anthropic
export const SUPPORT_SYSTEM = `คุณคือ TechDesk AI ผู้เชี่ยวชาญ Customer Support
ตอบเป็นภาษาไทย กระชับ มีประโยชน์
อ้างอิงจาก Context เท่านั้น ถ้าไม่รู้บอกตรงๆ
ถ้าเป็น bug ให้บอกว่าจะสร้าง ticket ให้`;

export async function searchDocs(query: string, limit = 4): Promise<Array<{text: string; source: string}>> {
  const res = await openai.embeddings.create({
    input: query, model: 'text-embedding-3-small',
  });
  const vec = `[${res.data[0].embedding.join(',')}]`;

  const results = await prisma.$queryRaw<Array<{text: string; title: string; distance: number}>>`
    SELECT c.text, d.title,
           (c.embedding <=> ${vec}::vector) AS distance
    FROM "Chunk" c JOIN "Document" d ON c."documentId" = d.id
    ORDER BY distance ASC LIMIT ${limit}
  `;

  return results
    .filter(r => r.distance < 0.7)
    .map(r => ({ text: r.text, source: r.title }));
}
```

---

## 🧩 Service 3: Analytics (Structured Output)

```typescript
// src/services/analytics.service.ts
import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import { PrismaClient } from '@prisma/client';

const client = new Anthropic();
const prisma = new PrismaClient();

const TicketClassSchema = z.object({
  category: z.enum(['billing', 'technical', 'feature_request', 'bug', 'general']),
  sentiment: z.enum(['positive', 'neutral', 'negative', 'frustrated']),
  urgency: z.enum(['low', 'medium', 'high', 'critical']),
  requiresHuman: z.boolean(),
  tags: z.array(z.string()).max(5),
});

export async function analyzeTicket(question: string) {
  const res = await client.messages.create({
    model: 'claude-haiku-4-5',
    max_tokens: 200,
    system: 'ตอบ JSON เท่านั้น ตาม schema ที่กำหนด',
    messages: [
      { role: 'user', content: `วิเคราะห์: "${question}"
Schema: { category: billing|technical|feature_request|bug|general, sentiment: positive|neutral|negative|frustrated, urgency: low|medium|high|critical, requiresHuman: boolean, tags: string[] }` },
      { role: 'assistant', content: '{' },
    ],
  });

  const text = '{' + (res.content[0].type === 'text' ? res.content[0].text : '');
  return TicketClassSchema.parse(JSON.parse(text));
}
```

---

## 🧩 Service 4: Jira Tool Use

```typescript
// src/services/ticket.service.ts
import Anthropic from '@anthropic-ai/sdk';
import axios from 'axios';

const client = new Anthropic();

const jiraTools: Anthropic.Tool[] = [{
  name: 'create_support_ticket',
  description: 'สร้าง Jira ticket สำหรับ bug หรือปัญหาที่ลูกค้าพบ',
  input_schema: {
    type: 'object' as const,
    properties: {
      summary:     { type: 'string', description: 'หัวข้อสั้นๆ' },
      description: { type: 'string', description: 'รายละเอียด + steps' },
      priority:    { type: 'string', enum: ['High', 'Medium', 'Low'] },
    },
    required: ['summary', 'description', 'priority'],
  },
}];

export async function handleWithTicketing(
  question: string,
  context: string,
  model: string
): Promise<string> {
  const messages: Anthropic.MessageParam[] = [{
    role: 'user',
    content: `Context:\n${context}\n\nคำถาม: ${question}`,
  }];

  let finalAnswer = '';

  for (let turn = 0; turn < 3; turn++) {
    const res = await client.messages.create({
      model, max_tokens: 2048,
      system: `คุณคือ TechDesk AI ถ้าพบ bug ให้สร้าง ticket ทันที`,
      tools: jiraTools,
      messages,
    });

    if (res.stop_reason === 'end_turn') {
      finalAnswer = res.content.find(b => b.type === 'text')?.type === 'text'
        ? (res.content.find(b => b.type === 'text') as any).text
        : '';
      break;
    }

    messages.push({ role: 'assistant', content: res.content });

    const toolResults: Anthropic.ToolResultBlockParam[] = [];
    for (const block of res.content) {
      if (block.type !== 'tool_use') continue;
      const input = block.input as any;
      let result: string;

      try {
        const jiraRes = await axios.post(
          `${process.env.JIRA_BASE_URL}/rest/api/3/issue`,
          {
            fields: {
              project: { key: process.env.JIRA_PROJECT_KEY },
              summary: input.summary,
              issuetype: { name: 'Bug' },
              priority: { name: input.priority },
              description: { type: 'doc', version: 1, content: [{ type: 'paragraph', content: [{ type: 'text', text: input.description }] }] },
            },
          },
          { auth: { username: process.env.JIRA_EMAIL!, password: process.env.JIRA_TOKEN! } }
        );
        result = `Ticket created: ${process.env.JIRA_BASE_URL}/browse/${jiraRes.data.key}`;
      } catch {
        result = 'Ticket creation failed - will retry later';
      }

      toolResults.push({ type: 'tool_result', tool_use_id: block.id, content: result });
    }

    messages.push({ role: 'user', content: toolResults });
  }

  return finalAnswer;
}
```

---

## 🌐 Main API: Streaming Chat Endpoint

```typescript
// src/routes/support.ts
import express from 'express';
import Anthropic from '@anthropic-ai/sdk';
import { classifyComplexity, selectModel } from '../services/router.service';
import { searchDocs, SUPPORT_SYSTEM } from '../services/rag.service';
import { analyzeTicket } from '../services/analytics.service';
import { handleWithTicketing } from '../services/ticket.service';

const router = express.Router();
const client = new Anthropic();

// Streaming Chat — ใช้ทุก feature รวมกัน
router.post('/chat', async (req, res) => {
  const { question, sessionId = 'anon' } = req.body;
  if (!question) return res.status(400).json({ error: 'question required' });

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.flushHeaders();

  const send = (data: object) => res.write(`data: ${JSON.stringify(data)}\n\n`);

  try {
    // Step 1: Classify complexity (parallel กับ RAG search)
    send({ type: 'status', message: 'Analyzing question...' });
    const [complexity, docs] = await Promise.all([
      classifyComplexity(question),
      searchDocs(question),
    ]);

    const model = selectModel(complexity);
    send({ type: 'status', message: `Using ${model} (${complexity})` });

    // Step 2: Analyze for analytics (background, ไม่รอ)
    analyzeTicket(question).then(analysis => {
      send({ type: 'analytics', data: analysis });
    }).catch(() => {});

    // Step 3: Build context from RAG
    const context = docs.length > 0
      ? docs.map((d, i) => `[${i+1}: ${d.source}]\n${d.text}`).join('\n\n')
      : 'ไม่พบเอกสารที่เกี่ยวข้อง';

    send({ type: 'sources', data: docs.map(d => d.source) });

    // Step 4: Stream response with Prompt Caching
    send({ type: 'start' });

    const stream = await client.messages.stream({
      model,
      max_tokens: 2048,
      system: [
        {
          type: 'text',
          text: SUPPORT_SYSTEM,
          cache_control: { type: 'ephemeral' }, // ← Prompt Caching!
        },
      ] as any,
      messages: [{
        role: 'user',
        content: `Context:\n${context}\n\nคำถาม: ${question}`,
      }],
    });

    let fullText = '';
    for await (const event of stream) {
      if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
        fullText += event.delta.text;
        send({ type: 'text', text: event.delta.text });
      }
    }

    const final = await stream.finalMessage();
    send({
      type: 'done',
      usage: final.usage,
      model,
      complexity,
    });

  } catch (err: any) {
    send({ type: 'error', message: err.message });
  }

  res.end();
});

// Non-streaming with Jira integration
router.post('/chat/sync', async (req, res) => {
  const { question } = req.body;
  const [complexity, docs] = await Promise.all([
    classifyComplexity(question),
    searchDocs(question),
  ]);

  const context = docs.map((d, i) => `[${i+1}] ${d.text}`).join('\n\n');
  const model = selectModel(complexity);

  const answer = await handleWithTicketing(question, context, model);
  const analysis = await analyzeTicket(question);

  res.json({ answer, analysis, sources: docs.map(d => d.source), model });
});

export default router;
```

---

## 🧪 ทดสอบ TechDesk AI

```bash
# Start server
ts-node src/server.ts

# Test 1: Simple question (จะใช้ Haiku)
curl -N -X POST http://localhost:3000/api/support/chat \
  -H "Content-Type: application/json" \
  -d '{"question": "สวัสดี คุณทำอะไรได้บ้าง?"}'

# Test 2: Technical bug (จะสร้าง Jira ticket)
curl -X POST http://localhost:3000/api/support/chat/sync \
  -H "Content-Type: application/json" \
  -d '{"question": "login ไม่ได้เลย กด submit แล้วหน้าขาว"}'

# Response:
# {
#   "answer": "ขอโทษที่พบปัญหานี้ครับ ได้สร้าง ticket TECH-789 ให้แล้ว...",
#   "analysis": { "category": "bug", "urgency": "high", "requiresHuman": true },
#   "model": "claude-sonnet-4-5"
# }
```

---

## 📊 Analytics Dashboard Endpoint

```typescript
// src/routes/analytics.ts
router.get('/today', async (req, res) => {
  // ดึง analytics จาก database
  const stats = await prisma.ticketLog.groupBy({
    by: ['category', 'urgency'],
    _count: true,
    where: {
      createdAt: { gte: new Date(new Date().setHours(0,0,0,0)) }
    },
  });

  const tokenUsage = await prisma.apiLog.aggregate({
    _sum: { inputTokens: true, outputTokens: true },
    where: { createdAt: { gte: new Date(new Date().setHours(0,0,0,0)) } },
  });

  res.json({
    date: new Date().toISOString().split('T')[0],
    ticketStats: stats,
    tokenUsage: tokenUsage._sum,
    estimatedCost: ((tokenUsage._sum.inputTokens || 0) * 0.000003)
                 + ((tokenUsage._sum.outputTokens || 0) * 0.000015),
  });
});
```

---

## ✅ Volume 2 Checklist

```
เทคนิคที่ใช้ใน TechDesk AI Capstone:

✅ Ch 13: Sold to management (Business case + ROI)
✅ Ch 14: SDK setup, environment variables, error handling
✅ Ch 15: Streaming responses พร้อม SSE events
✅ Ch 16: Model routing Haiku/Sonnet/Opus ตาม complexity
✅ Ch 17: Prompt Caching สำหรับ SUPPORT_SYSTEM
✅ Ch 18: CLAUDE.md + TASKS.md + DESIGN.md Trinity
✅ Ch 19: Advanced CLAUDE.md Zero Trust rules
✅ Ch 20: Structured Output ด้วย Zod schema
✅ Ch 21: Analytics ไม่เก็บ PII, ใช้ anonymized data
✅ Ch 22: Tool Use สร้าง Jira ticket เมื่อพบ bug
✅ Ch 25-26: RAG ค้นหาเอกสารบริษัท
✅ Ch 27: Understand CLI loop ที่อยู่เบื้องหลัง
✅ Ch 28: Bug Hunter สำหรับ fix tests
```

---

## 🎯 สรุปบทที่ 29

Volume 2 สมบูรณ์แล้ว คุณตอนนี้:

| สิ่งที่ทำได้แล้ว | ตัวอย่าง |
|----------------|---------|
| Embed AI ใน Backend | Express + Streaming SSE |
| ควบคุม Cost อัตโนมัติ | Model Routing + Caching |
| ทำให้ AI มีความจำ | RAG + pgvector |
| ให้ AI ลงมือทำ | Tool Use → Jira |
| รับ Output ที่ reliable | Zod Structured Output |
| ปกป้องข้อมูล | PII Filter + PDPA-ready |

---

*ใน **Volume 3** เราจะก้าวสู่ระดับ Enterprise: **Model Context Protocol (MCP)**, Security & RBAC, Multi-Agent Orchestration, CI/CD Integration, และ Database Migration Safety ครับ*
