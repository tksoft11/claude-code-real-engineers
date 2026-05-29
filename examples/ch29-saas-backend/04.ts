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
