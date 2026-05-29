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
