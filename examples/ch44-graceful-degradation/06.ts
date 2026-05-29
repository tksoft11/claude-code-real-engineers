// src/ai-gateway/gateway.ts
import { AIProvider, AIResponse } from './providers/types';
import { CircuitBreaker } from './circuit-breaker';

interface GatewayOptions {
  maxRetries?: number;
  retryDelayMs?: number;
  timeoutMs?: number;
  enableCache?: boolean;
}

interface ProviderEntry {
  provider: AIProvider;
  breaker: CircuitBreaker;
  priority: number;
}

export class AIGateway {
  private providers: ProviderEntry[] = [];
  private responseCache = new Map<string, { response: AIResponse; expiresAt: number }>();

  constructor(private opts: GatewayOptions = {}) {
    this.opts = {
      maxRetries: 2,
      retryDelayMs: 500,
      timeoutMs: 30000,
      enableCache: true,
      ...opts,
    };
  }

  addProvider(provider: AIProvider, priority: number): this {
    this.providers.push({
      provider,
      priority,
      breaker: new CircuitBreaker(provider.name, {
        failureThreshold: 3,
        successThreshold: 2,
        timeout: 60_000,     // 1 นาที ก่อน retry
        volumeThreshold: 5,
      }),
    });
    // เรียงตาม priority (น้อย = สูงกว่า)
    this.providers.sort((a, b) => a.priority - b.priority);
    return this;
  }

  async complete(
    prompt: string,
    system?: string,
    maxTokens?: number
  ): Promise<AIResponse & { cached?: boolean }> {
    // ตรวจ cache ก่อน
    if (this.opts.enableCache) {
      const cached = this.getFromCache(prompt, system);
      if (cached) return { ...cached, cached: true };
    }

    // วนหา provider ที่ใช้ได้
    for (const entry of this.providers) {
      if (entry.breaker.isOpen) {
        console.log(`[Gateway] Skipping ${entry.provider.name} (circuit open)`);
        continue;
      }

      try {
        const response = await this.callWithTimeout(
          entry.provider,
          prompt,
          system,
          maxTokens
        );
        entry.breaker.recordSuccess();

        // log ว่าใช้ provider ไหน (สำหรับ monitoring)
        if (entry.priority > 1) {
          console.warn(`[Gateway] Using fallback provider: ${entry.provider.name}`);
        }

        // เก็บ cache
        if (this.opts.enableCache) {
          this.saveToCache(prompt, system, response);
        }

        return response;
      } catch (error) {
        entry.breaker.recordFailure();
        const msg = error instanceof Error ? error.message : 'unknown';
        console.error(`[Gateway] ${entry.provider.name} failed: ${msg}`);
        // ลอง provider ถัดไป
      }
    }

    throw new Error('All AI providers are unavailable. Please try again later.');
  }

  private async callWithTimeout(
    provider: AIProvider,
    prompt: string,
    system?: string,
    maxTokens?: number
  ): Promise<AIResponse> {
    return Promise.race([
      provider.complete(prompt, system, maxTokens),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error(`Timeout after ${this.opts.timeoutMs}ms`)), this.opts.timeoutMs)
      ),
    ]);
  }

  private getCacheKey(prompt: string, system?: string): string {
    return `${system || ''}::${prompt}`;
  }

  private getFromCache(prompt: string, system?: string): AIResponse | null {
    const key = this.getCacheKey(prompt, system);
    const entry = this.responseCache.get(key);
    if (entry && entry.expiresAt > Date.now()) return entry.response;
    this.responseCache.delete(key);
    return null;
  }

  private saveToCache(prompt: string, system?: string, response: AIResponse): void {
    const key = this.getCacheKey(prompt, system);
    this.responseCache.set(key, {
      response,
      expiresAt: Date.now() + 5 * 60 * 1000, // cache 5 นาที
    });
  }

  getProviderStatus(): Record<string, string> {
    return Object.fromEntries(
      this.providers.map(e => [e.provider.name, e.breaker.getState()])
    );
  }
}
