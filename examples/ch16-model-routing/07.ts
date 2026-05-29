import { createHash } from 'crypto';

const responseCache = new Map<string, { response: string; cachedAt: Date }>();
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 ชั่วโมง

async function cachedClaude(prompt: string, systemPrompt: string): Promise<string> {
  // สร้าง cache key จาก hash ของ prompt
  const cacheKey = createHash('sha256')
    .update(systemPrompt + prompt)
    .digest('hex');

  // ตรวจ cache ก่อน
  const cached = responseCache.get(cacheKey);
  if (cached && Date.now() - cached.cachedAt.getTime() < CACHE_TTL_MS) {
    console.log('[Cache HIT] Saved API call');
    return cached.response;
  }

  // ถ้า miss → เรียก API
  const response = await client.messages.create({
    model: 'claude-haiku-4-5',
    max_tokens: 1024,
    system: systemPrompt,
    messages: [{ role: 'user', content: prompt }],
  });

  const text = response.content[0].type === 'text' ? response.content[0].text : '';

  // บันทึก cache
  responseCache.set(cacheKey, { response: text, cachedAt: new Date() });
  return text;
}
