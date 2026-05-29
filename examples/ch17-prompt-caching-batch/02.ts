// prompt_caching.ts
import Anthropic from '@anthropic-ai/sdk';
import 'dotenv/config';

const client = new Anthropic();

const SYSTEM_CONTEXT = `
[... System Prompt ยาวๆ อย่างน้อย 1,024 tokens ...]
`;

interface CacheStats {
  cacheWrites: number;
  cacheReads: number;
  regularTokens: number;
  estimatedSavings: number;
}

class CachedChatService {
  private totalCacheWrites = 0;
  private totalCacheReads = 0;
  private totalRegularTokens = 0;

  async chat(userMessage: string): Promise<string> {
    const response = await client.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 1024,
      system: [
        {
          type: 'text',
          text: SYSTEM_CONTEXT,
          cache_control: { type: 'ephemeral' }, // เปิด caching
        },
      ] as any, // Type cast เพราะ SDK types อาจยังไม่ครบ
      messages: [{ role: 'user', content: userMessage }],
    });

    // Track usage
    const usage = response.usage as any;
    this.totalCacheWrites += usage.cache_creation_input_tokens || 0;
    this.totalCacheReads  += usage.cache_read_input_tokens || 0;
    this.totalRegularTokens += usage.input_tokens;

    return response.content[0].type === 'text' ? response.content[0].text : '';
  }

  getCacheStats(): CacheStats {
    // คำนวณ savings (Sonnet pricing)
    const withoutCache = (this.totalRegularTokens + this.totalCacheReads) * 0.000003;
    const withCache = (this.totalRegularTokens * 0.000003) +
                      (this.totalCacheWrites * 0.00000375) + // Write: 125% of normal
                      (this.totalCacheReads  * 0.0000003);   // Read: 10% of normal

    return {
      cacheWrites:      this.totalCacheWrites,
      cacheReads:       this.totalCacheReads,
      regularTokens:    this.totalRegularTokens,
      estimatedSavings: withoutCache - withCache,
    };
  }
}

// ใช้งาน
const service = new CachedChatService();
await service.chat('ราคา iPhone 16 เท่าไหร่?');
await service.chat('วิธีคืนสินค้า?');
await service.chat('ส่งถึงต่างจังหวัดกี่วัน?');
await service.chat('มีการรับประกันไหม?');

const stats = service.getCacheStats();
console.log(`Cache Writes: ${stats.cacheWrites} tokens`);
console.log(`Cache Reads:  ${stats.cacheReads} tokens`);
console.log(`Estimated Savings: $${stats.estimatedSavings.toFixed(4)}`);
