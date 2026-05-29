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
