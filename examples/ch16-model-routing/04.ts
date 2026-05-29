// src/billing/spend-tracker.ts
import { redis } from '../lib/redis';

interface SpendLimit {
  daily: number;   // USD
  monthly: number; // USD
  perUser: number; // USD per user per day
}

const LIMITS: SpendLimit = {
  daily:   50,    // $50/วัน
  monthly: 500,   // $500/เดือน
  perUser: 1,     // $1/user/วัน
};

// Token pricing (USD per token)
const PRICING: Record<string, { input: number; output: number }> = {
  'claude-haiku-4-5':  { input: 0.0000008,  output: 0.000004  },
  'claude-sonnet-4-5': { input: 0.000003,   output: 0.000015  },
  'claude-opus-4-5':   { input: 0.000015,   output: 0.000075  },
};

export async function checkAndTrackSpend(
  userId: string,
  model: string,
  inputTokens: number,
  outputTokens: number
): Promise<void> {
  const pricing = PRICING[model];
  if (!pricing) return;

  const cost = (inputTokens * pricing.input) + (outputTokens * pricing.output);
  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  const month = today.slice(0, 7); // YYYY-MM

  // อัปเดต counters ใน Redis (atomic)
  const pipeline = redis.pipeline();
  pipeline.incrbyfloat(`spend:daily:${today}`, cost);
  pipeline.incrbyfloat(`spend:monthly:${month}`, cost);
  pipeline.incrbyfloat(`spend:user:${userId}:${today}`, cost);
  pipeline.expire(`spend:daily:${today}`, 86400 * 2);      // TTL 2 วัน
  pipeline.expire(`spend:user:${userId}:${today}`, 86400 * 2);
  await pipeline.exec();

  // ตรวจ limits
  const [dailySpend, monthlySpend, userSpend] = await Promise.all([
    redis.get(`spend:daily:${today}`),
    redis.get(`spend:monthly:${month}`),
    redis.get(`spend:user:${userId}:${today}`),
  ]);

  const errors: string[] = [];
  if (parseFloat(dailySpend || '0') > LIMITS.daily) {
    errors.push(`Daily limit exceeded ($${LIMITS.daily})`);
  }
  if (parseFloat(monthlySpend || '0') > LIMITS.monthly) {
    errors.push(`Monthly limit exceeded ($${LIMITS.monthly})`);
  }
  if (parseFloat(userSpend || '0') > LIMITS.perUser) {
    errors.push(`User daily limit exceeded ($${LIMITS.perUser})`);
  }

  if (errors.length > 0) {
    // แจ้งเตือนทีม
    await notifySlack(`⚠️ Spend Alert: ${errors.join(', ')}`);
    throw new SpendLimitExceededError(errors.join('; '));
  }
}

// Middleware สำหรับ Express
export async function spendLimitMiddleware(req, res, next) {
  // ตรวจก่อนรับ request
  const today = new Date().toISOString().split('T')[0];
  const dailySpend = parseFloat(await redis.get(`spend:daily:${today}`) || '0');

  if (dailySpend >= LIMITS.daily * 0.9) {
    return res.status(429).json({
      error: 'Service temporarily limited due to high usage',
      resetAt: 'Tomorrow midnight',
    });
  }

  next();
}
