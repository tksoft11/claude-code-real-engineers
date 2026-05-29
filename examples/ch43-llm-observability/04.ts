// src/observability/logger.ts
import pino from 'pino';

export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  // Production: JSON logs สำหรับ log aggregation (CloudWatch, Loki)
  // Development: pretty print
  transport: process.env.NODE_ENV === 'development'
    ? { target: 'pino-pretty', options: { colorize: true } }
    : undefined,
  base: {
    service: 'ai-service',
    version: process.env.npm_package_version,
    env: process.env.NODE_ENV,
  },
});

// Helper สำหรับ log AI-specific events
export const aiLogger = {
  request: (data: { feature: string; model: string; userId?: string; promptLen: number }) => {
    logger.info({ event: 'ai.request', ...data });
  },
  response: (data: {
    feature: string; model: string; durationMs: number;
    inputTokens: number; outputTokens: number; costUsd: number;
  }) => {
    logger.info({ event: 'ai.response', ...data });
  },
  error: (data: { feature: string; model: string; error: string; userId?: string }) => {
    logger.error({ event: 'ai.error', ...data });
  },
};
