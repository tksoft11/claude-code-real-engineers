# บทที่ 26: [Hands-on] Building a RAG Pipeline — The Company Brain

---

## 🪝 The Company Brain Killer Example

> "นโยบายลาป่วยของบริษัทเป็นยังไง?" → AI ตอบได้จากเอกสาร HR
> "ขั้นตอน deploy to production คือ?" → AI ตอบได้จาก Runbook
> "SLA ของ API ที่ขายให้ลูกค้าคือ?" → AI ตอบได้จากสัญญา

**The Company Brain** = RAG system ที่อ่านเอกสารทั้งหมดของบริษัทได้ Production-ready

บทที่ 25 สร้าง prototype ด้วย ChromaDB ในหน่วยความจำ บทนี้จะสร้างระบบจริงด้วย **pgvector + Prisma + Express + Claude**

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────┐
│              Company Brain Stack                │
├─────────────────────────────────────────────────┤
│  Frontend: Slack Bot / Web Chat UI              │
│  Backend:  Express.js API                       │
│  AI:       Claude claude-haiku-4-5 (ตอบ)        │
│            OpenAI text-embedding-3-small (embed) │
│  Database: PostgreSQL + pgvector extension      │
│  ORM:      Prisma                               │
└─────────────────────────────────────────────────┘
```

---

## 📦 Setup Project

```bash
mkdir company-brain && cd company-brain
npm init -y
npm install @anthropic-ai/sdk openai @prisma/client prisma \
            express multer pdf-parse dotenv cors
npm install -D typescript ts-node @types/node @types/express

npx prisma init
```

```env
# .env
DATABASE_URL="postgresql://postgres:password@localhost:5432/company_brain"
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...
```

---

## 🗄️ Database Schema

```sql
-- migrations: enable pgvector
CREATE EXTENSION IF NOT EXISTS vector;
```

```prisma
// prisma/schema.prisma
generator client {
  provider        = "prisma-client-js"
  previewFeatures = ["postgresqlExtensions"]
}

datasource db {
  provider   = "postgresql"
  url        = env("DATABASE_URL")
  extensions = [vector]
}

model Document {
  id        String   @id @default(cuid())
  filename  String
  title     String
  category  String   @default("general")
  content   String
  createdAt DateTime @default(now())
  chunks    Chunk[]
}

model Chunk {
  id         String                  @id @default(cuid())
  documentId String
  document   Document                @relation(fields: [documentId], references: [id], onDelete: Cascade)
  text       String
  chunkIndex Int
  embedding  Unsupported("vector(1536)")?
  createdAt  DateTime               @default(now())

  @@index([documentId])
}
```

```bash
npx prisma migrate dev --name init
```

---

## 🔧 Core Services

```typescript
// src/services/embedding.service.ts
import { OpenAI } from 'openai';
import { PrismaClient } from '@prisma/client';

const openai = new OpenAI();
const prisma = new PrismaClient();

export async function embedText(text: string): Promise<number[]> {
  const res = await openai.embeddings.create({
    input: text.slice(0, 8000), // max input length
    model: 'text-embedding-3-small',
  });
  return res.data[0].embedding;
}

export function chunkText(text: string, size = 400, overlap = 50): string[] {
  const words = text.split(/\s+/);
  const chunks: string[] = [];
  for (let i = 0; i < words.length; i += size - overlap) {
    chunks.push(words.slice(i, i + size).join(' '));
  }
  return chunks.filter(c => c.length > 50);
}

export async function indexDocument(
  filename: string,
  title: string,
  content: string,
  category = 'general'
): Promise<string> {
  // สร้าง Document record
  const doc = await prisma.document.create({
    data: { filename, title, content, category },
  });

  // แบ่งเป็น chunks และ embed
  const chunks = chunkText(content);
  console.log(`Indexing ${chunks.length} chunks for "${title}"...`);

  for (let i = 0; i < chunks.length; i++) {
    const embedding = await embedText(chunks[i]);
    const vector = `[${embedding.join(',')}]`;

    await prisma.$executeRaw`
      INSERT INTO "Chunk" (id, "documentId", text, "chunkIndex", embedding, "createdAt")
      VALUES (
        gen_random_uuid()::text,
        ${doc.id},
        ${chunks[i]},
        ${i},
        ${vector}::vector,
        NOW()
      )
    `;
  }

  console.log(`✅ Indexed "${title}" (${chunks.length} chunks)`);
  return doc.id;
}

export async function searchSimilar(
  query: string,
  limit = 5,
  category?: string
): Promise<Array<{ text: string; title: string; score: number }>> {
  const queryEmbedding = await embedText(query);
  const vector = `[${queryEmbedding.join(',')}]`;

  const categoryFilter = category ? `AND d.category = '${category}'` : '';

  const results = await prisma.$queryRaw<Array<{
    text: string; title: string; distance: number;
  }>>`
    SELECT c.text, d.title, 
           (c.embedding <=> ${vector}::vector) AS distance
    FROM "Chunk" c
    JOIN "Document" d ON c."documentId" = d.id
    WHERE 1=1 ${prisma.$queryRaw([categoryFilter] as any)}
    ORDER BY distance ASC
    LIMIT ${limit}
  `;

  return results.map(r => ({
    text: r.text,
    title: r.title,
    score: 1 - r.distance,
  }));
}
```

---

## 🤖 RAG Query Service

```typescript
// src/services/rag.service.ts
import Anthropic from '@anthropic-ai/sdk';
import { searchSimilar } from './embedding.service';

const claude = new Anthropic();

export interface RAGResponse {
  answer: string;
  sources: string[];
  confidence: 'high' | 'medium' | 'low';
}

export async function queryCompanyBrain(
  question: string,
  category?: string
): Promise<RAGResponse> {
  // 1. Retrieve relevant chunks
  const chunks = await searchSimilar(question, 4, category);

  if (chunks.length === 0 || chunks[0].score < 0.3) {
    return {
      answer: 'ไม่พบข้อมูลที่เกี่ยวข้องในเอกสารบริษัท กรุณาติดต่อ HR หรือ IT โดยตรง',
      sources: [],
      confidence: 'low',
    };
  }

  // 2. Build context
  const context = chunks
    .map((c, i) => `[แหล่งที่มา ${i + 1}: ${c.title}]\n${c.text}`)
    .join('\n\n---\n\n');

  // 3. Ask Claude
  const response = await claude.messages.create({
    model: 'claude-haiku-4-5',
    max_tokens: 1024,
    system: `คุณคือ Company Brain AI ผู้ช่วยของบริษัท
ตอบคำถามโดยอ้างอิงจาก Context เท่านั้น
ถ้าไม่มีข้อมูลเพียงพอ บอกตรงๆ
ตอบเป็นภาษาไทย กระชับ ชัดเจน`,
    messages: [{
      role: 'user',
      content: `Context:\n${context}\n\nคำถาม: ${question}`,
    }],
  });

  const answer = response.content[0].type === 'text' ? response.content[0].text : '';
  const sources = [...new Set(chunks.map(c => c.title))];
  const avgScore = chunks.reduce((s, c) => s + c.score, 0) / chunks.length;

  return {
    answer,
    sources,
    confidence: avgScore > 0.7 ? 'high' : avgScore > 0.5 ? 'medium' : 'low',
  };
}
```

---

## 🌐 Express API

```typescript
// src/server.ts
import express from 'express';
import multer from 'multer';
import pdfParse from 'pdf-parse';
import fs from 'fs';
import { indexDocument } from './services/embedding.service';
import { queryCompanyBrain } from './services/rag.service';

const app = express();
const upload = multer({ dest: 'uploads/' });

app.use(express.json());

// Upload & index document
app.post('/api/documents', upload.single('file'), async (req, res) => {
  const file = req.file!;
  const { title, category } = req.body;

  try {
    let content = '';

    if (file.mimetype === 'application/pdf') {
      const pdfData = await pdfParse(fs.readFileSync(file.path));
      content = pdfData.text;
    } else {
      content = fs.readFileSync(file.path, 'utf-8');
    }

    fs.unlinkSync(file.path); // cleanup

    const docId = await indexDocument(file.originalname, title || file.originalname, content, category);
    res.json({ success: true, documentId: docId, message: 'Document indexed successfully' });

  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Query
app.post('/api/query', async (req, res) => {
  const { question, category } = req.body;
  if (!question) return res.status(400).json({ error: 'question required' });

  const result = await queryCompanyBrain(question, category);
  res.json(result);
});

// Streaming query
app.post('/api/query/stream', async (req, res) => {
  const { question, category } = req.body;

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.flushHeaders();

  const { searchSimilar } = await import('./services/embedding.service');
  const Anthropic = (await import('@anthropic-ai/sdk')).default;
  const claude = new Anthropic();

  const chunks = await searchSimilar(question, 4, category);
  const context = chunks.map((c, i) => `[${i+1}: ${c.title}]\n${c.text}`).join('\n\n');

  const stream = await claude.messages.stream({
    model: 'claude-haiku-4-5',
    max_tokens: 1024,
    system: 'คุณคือ Company Brain AI ตอบจาก Context เท่านั้น ตอบภาษาไทย',
    messages: [{ role: 'user', content: `Context:\n${context}\n\nคำถาม: ${question}` }],
  });

  for await (const event of stream) {
    if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
      res.write(`data: ${JSON.stringify({ text: event.delta.text })}\n\n`);
    }
  }

  const sources = [...new Set(chunks.map(c => c.title))];
  res.write(`data: ${JSON.stringify({ done: true, sources })}\n\n`);
  res.end();
});

app.listen(3000, () => console.log('Company Brain running on :3000'));
```

---

## 💻 ทดสอบ: Index เอกสารและถาม

```bash
# 1. Start server
ts-node src/server.ts

# 2. Upload เอกสาร (PDF หรือ .txt)
curl -X POST http://localhost:3000/api/documents \
  -F "file=@hr-policy.pdf" \
  -F "title=HR Policy 2025" \
  -F "category=hr"

# 3. ถาม
curl -X POST http://localhost:3000/api/query \
  -H "Content-Type: application/json" \
  -d '{"question": "ลาพักร้อนได้กี่วัน?", "category": "hr"}'

# Response:
# {
#   "answer": "พนักงานมีสิทธิ์ลาพักร้อน 10 วันต่อปี...",
#   "sources": ["HR Policy 2025"],
#   "confidence": "high"
# }
```

---

## ⚡ Performance Optimizations

```typescript
// 1. Cache embeddings สำหรับ query เดิม
const queryCache = new Map<string, number[]>();

async function cachedEmbed(text: string): Promise<number[]> {
  if (queryCache.has(text)) return queryCache.get(text)!;
  const embedding = await embedText(text);
  queryCache.set(text, embedding);
  return embedding;
}

// 2. Batch indexing (ประหยัด API calls)
async function batchIndex(files: string[]) {
  for (const file of files) {
    await indexDocument(/* ... */);
    await new Promise(r => setTimeout(r, 200)); // rate limit
  }
}

// 3. Index ด้วย Claude ช่วย generate metadata
async function smartIndex(content: string): Promise<{ title: string; category: string; summary: string }> {
  const response = await claude.messages.create({
    model: 'claude-haiku-4-5',
    max_tokens: 200,
    system: 'ตอบ JSON เท่านั้น',
    messages: [{
      role: 'user',
      content: `วิเคราะห์เอกสาร: "${content.slice(0, 500)}..."
ตอบ: {"title": "...", "category": "hr|it|legal|finance|ops", "summary": "สรุป 1 ประโยค"}`
    }],
  });
  return JSON.parse(response.content[0].type === 'text' ? response.content[0].text : '{}');
}
```

---

## 🎯 สรุปบทที่ 26

| Component | Technology |
|-----------|-----------|
| Vector Store | PostgreSQL + pgvector |
| ORM | Prisma |
| Embedding Model | OpenAI text-embedding-3-small |
| LLM | Claude claude-haiku-4-5 |
| API | Express.js + Streaming |
| File Ingestion | Multer + pdf-parse |

**กุญแจสำคัญ:** `<=>` operator ใน pgvector คือ cosine distance — ยิ่งน้อย ยิ่งใกล้กัน

---

## 📋 Action Items ก่อนไปบทที่ 27

- [ ] ติดตั้ง pgvector extension ใน PostgreSQL
- [ ] Run `prisma migrate dev` สร้าง schema
- [ ] Index เอกสารจริงของบริษัท 5 ไฟล์แรก
- [ ] ทดสอบ query 10 คำถามจริง วัด accuracy
- [ ] เพิ่ม Smart Indexing ที่ Claude ช่วย generate metadata

---

*ใน **บทที่ 27** เราจะสร้าง CLI AI Assistant ของตัวเอง — จำลอง Claude Code CLI ด้วย Node.js + Ink เพื่อเข้าใจว่าเครื่องมือที่เราใช้มาตลอดสร้างขึ้นมาได้อย่างไรครับ*
