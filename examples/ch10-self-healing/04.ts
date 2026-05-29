// src/utils/auto-fixer.ts
type FixResult = { fixed: boolean; action: string };

const knownFixes: Record<string, (error: Error) => Promise<FixResult>> = {
  // Fix: Database connection pool exhausted
  'connection pool exhausted': async () => {
    await prisma.$disconnect();
    await sleep(2000);
    await prisma.$connect();
    return { fixed: true, action: 'Reconnected database pool' };
  },

  // Fix: Redis connection lost
  'ECONNREFUSED redis': async () => {
    await redisClient.disconnect();
    await sleep(1000);
    await redisClient.connect();
    return { fixed: true, action: 'Reconnected to Redis' };
  },

  // Fix: Temp directory full
  'ENOSPC': async () => {
    const cleaned = await cleanTempDirectory();
    return { fixed: cleaned > 0, action: `Freed ${cleaned}MB from temp directory` };
  },

  // Fix: JWT token expired (สำหรับ script ที่ใช้ API)
  'token expired': async () => {
    const newToken = await refreshAuthToken();
    process.env.AUTH_TOKEN = newToken;
    return { fixed: true, action: 'Refreshed expired auth token' };
  },

  // Fix: File lock โดย process อื่น
  'EBUSY': async () => {
    await sleep(5000); // รอ 5 วินาที
    return { fixed: true, action: 'Waited for file lock to release' };
  },
};

export async function tryAutoFix(error: Error): Promise<FixResult> {
  const errorMessage = error.message.toLowerCase();

  for (const [pattern, fixer] of Object.entries(knownFixes)) {
    if (errorMessage.includes(pattern.toLowerCase())) {
      try {
        const result = await fixer(error);
        logger.info(`Auto-fix applied: ${result.action}`);
        return result;
      } catch (fixError) {
        logger.warn(`Auto-fix failed for "${pattern}": ${fixError.message}`);
      }
    }
  }

  return { fixed: false, action: 'No known fix available' };
}
