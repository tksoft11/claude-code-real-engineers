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
