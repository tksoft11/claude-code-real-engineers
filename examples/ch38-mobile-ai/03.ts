// backend/src/routes/ai.route.ts
import { Router, Request, Response } from 'express';
import { streamChat, ChatMessage } from '../services/claude.service';
import { authMiddleware } from '../middleware/auth';
import { rateLimitMiddleware } from '../middleware/rateLimit';

const router = Router();

// POST /api/ai/chat — Streaming endpoint
router.post('/chat',
  authMiddleware,
  rateLimitMiddleware,
  async (req: Request, res: Response) => {
    const { messages, system } = req.body as {
      messages: ChatMessage[];
      system?: string;
    };

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: 'messages is required' });
    }

    // ตั้ง headers สำหรับ Server-Sent Events (SSE)
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    try {
      await streamChat(
        messages,
        system || 'คุณคือ AI assistant ที่ช่วยเหลือผู้ใช้',
        (text) => {
          // ส่ง chunk กลับไป Mobile แบบ real-time
          res.write(`data: ${JSON.stringify({ type: 'chunk', text })}\n\n`);
        },
        (inputTokens, outputTokens) => {
          res.write(`data: ${JSON.stringify({ type: 'done', inputTokens, outputTokens })}\n\n`);
        }
      );
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      res.write(`data: ${JSON.stringify({ type: 'error', message: msg })}\n\n`);
    } finally {
      res.end();
    }
  }
);

export default router;
