// backend/src/middleware/rateLimit.ts
import { Request, Response, NextFunction } from 'express';

// Simple in-memory rate limiter (production: ใช้ Redis)
const userRequests = new Map<string, { count: number; resetAt: number }>();

const LIMIT = 20;       // 20 requests
const WINDOW = 60_000;  // ต่อนาที

export function rateLimitMiddleware(req: Request, res: Response, next: NextFunction) {
  const userId = (req as any).userId as string;
  const now = Date.now();
  const entry = userRequests.get(userId);

  if (!entry || entry.resetAt < now) {
    userRequests.set(userId, { count: 1, resetAt: now + WINDOW });
    return next();
  }

  if (entry.count >= LIMIT) {
    return res.status(429).json({
      error: 'Rate limit exceeded',
      retryAfter: Math.ceil((entry.resetAt - now) / 1000),
    });
  }

  entry.count++;
  next();
}
