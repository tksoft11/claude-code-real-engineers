// src/index.ts
import express from 'express';
import { requestLogger, metricsEndpoint } from './observability/middleware';
import { callClaude } from './ai/claude.service';
import { logger } from './observability/logger';
import { langfuse } from './observability/langfuse.client';

const app = express();
app.use(express.json());
app.use(requestLogger);

// Health check
app.get('/health', (req, res) => res.json({ status: 'ok' }));

// Prometheus scrape endpoint
app.get('/metrics', metricsEndpoint);

// ตัวอย่าง AI endpoint
app.post('/api/summarize', async (req, res) => {
  const { text, userId } = req.body;
  try {
    const summary = await callClaude(
      `สรุปข้อความต่อไปนี้เป็นภาษาไทย ไม่เกิน 3 ประโยค:\n\n${text}`,
      { feature: 'summarize', userId, model: 'claude-haiku-4-5' }
    );
    res.json({ summary });
  } catch (error) {
    res.status(500).json({ error: 'AI service unavailable' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  logger.info({ event: 'server.start', port: PORT });
});

// Flush Langfuse ก่อน shutdown
process.on('SIGTERM', async () => {
  logger.info('Shutting down...');
  await langfuse.shutdownAsync();
  process.exit(0);
});
