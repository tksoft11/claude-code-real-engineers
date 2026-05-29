// src/utils/retry.ts
interface RetryOptions {
  maxAttempts: number;
  initialDelayMs: number;
  maxDelayMs: number;
  shouldRetry?: (error: Error, attempt: number) => boolean;
  onRetry?: (error: Error, attempt: number, delayMs: number) => void;
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions
): Promise<T> {
  const {
    maxAttempts,
    initialDelayMs,
    maxDelayMs,
    shouldRetry = () => true,
    onRetry,
  } = options;

  let lastError: Error;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;

      if (attempt === maxAttempts) break;
      if (!shouldRetry(lastError, attempt)) break;

      // Exponential backoff with jitter
      const baseDelay = Math.min(
        initialDelayMs * Math.pow(2, attempt - 1),
        maxDelayMs
      );
      const jitter = Math.random() * baseDelay * 0.1;
      const delay = baseDelay + jitter;

      onRetry?.(lastError, attempt, delay);
      await sleep(delay);
    }
  }

  throw lastError!;
}

// ใช้งาน
const data = await withRetry(
  () => fetchFromAPI(url),
  {
    maxAttempts: 5,
    initialDelayMs: 1000,  // 1 วินาที
    maxDelayMs: 30000,      // สูงสุด 30 วินาที
    shouldRetry: (error) => {
      // Retry เฉพาะ network errors ไม่ retry validation errors
      return error.name === 'NetworkError' ||
             error.message.includes('ECONNRESET') ||
             error.message.includes('timeout');
    },
    onRetry: (error, attempt, delay) => {
      logger.warn(`Attempt ${attempt} failed: ${error.message}. Retrying in ${delay}ms`);
    },
  }
);
