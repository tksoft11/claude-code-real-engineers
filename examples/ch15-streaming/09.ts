// src/server.ts — Complete Streaming Chat Server
import express from 'express';
import cors from 'cors';
import Anthropic from '@anthropic-ai/sdk';
import 'dotenv/config';
import path from 'path';

const app = express();
const client = new Anthropic();

app.use(cors());
app.use(express.json());
app.use(express.static('public')); // serve HTML

// Streaming chat endpoint
app.post('/api/chat', async (req, res) => {
  const { messages, system = 'ตอบเป็นภาษาไทย กระชับ ชัดเจน' } = req.body;

  if (!messages?.length) {
    return res.status(400).json({ error: 'messages required' });
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const sendEvent = (data: object) => {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  try {
    const stream = await client.messages.stream({ model: 'claude-sonnet-4-5', max_tokens: 2048, system, messages });

    for await (const event of stream) {
      if (event.type === 'message_start') {
        sendEvent({ type: 'start', inputTokens: event.message.usage.input_tokens });
      }
      if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
        sendEvent({ type: 'text', text: event.delta.text });
      }
      if (event.type === 'message_delta') {
        sendEvent({ type: 'done', outputTokens: event.usage.output_tokens, stopReason: event.delta.stop_reason });
      }
    }
  } catch (error: any) {
    sendEvent({ type: 'error', message: error.message });
  }

  res.end();
});

app.listen(3000, () => console.log('Server: http://localhost:3000'));
