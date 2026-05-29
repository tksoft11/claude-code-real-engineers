// src/routes/chat.ts
import express from 'express';
import Anthropic from '@anthropic-ai/sdk';

const router = express.Router();
const client = new Anthropic();

router.post('/stream', async (req, res) => {
  const { messages, systemPrompt } = req.body;

  // ตั้งค่า SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.flushHeaders(); // ส่ง headers ทันที

  try {
    const stream = await client.messages.stream({
      model: 'claude-sonnet-4-5',
      max_tokens: 2048,
      system: systemPrompt || 'ตอบเป็นภาษาไทยเสมอ',
      messages,
    });

    // Forward แต่ละ token ไปยัง client
    for await (const chunk of stream) {
      if (
        chunk.type === 'content_block_delta' &&
        chunk.delta.type === 'text_delta'
      ) {
        // SSE format: "data: {json}\n\n"
        res.write(`data: ${JSON.stringify({ text: chunk.delta.text })}\n\n`);
      }
    }

    // บอก client ว่าเสร็จแล้ว
    const finalMsg = await stream.finalMessage();
    res.write(`data: ${JSON.stringify({
      done: true,
      usage: finalMsg.usage,
    })}\n\n`);

  } catch (error) {
    res.write(`data: ${JSON.stringify({ error: 'Streaming failed' })}\n\n`);
  } finally {
    res.end();
  }
});

export default router;
