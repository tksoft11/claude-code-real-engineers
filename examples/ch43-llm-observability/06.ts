// src/observability/middleware.ts
import { Request, Response, NextFunction } from 'express';
import { getMetrics } from './metrics';
import { logger } from './logger';

// Request logging middleware
export function requestLogger(req: Request, res: Response, next: NextFunction) {
  const start = Date.now();
  res.on('finish', () => {
    logger.info({
      event: 'http.request',
      method: req.method,
      path: req.path,
      status: res.statusCode,
      durationMs: Date.now() - start,
      userId: (req as any).userId,
    });
  });
  next();
}

// Prometheus metrics endpoint
export async function metricsEndpoint(req: Request, res: Response) {
  res.set('Content-Type', 'text/plain');
  res.send(await getMetrics());
}
