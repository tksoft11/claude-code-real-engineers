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
