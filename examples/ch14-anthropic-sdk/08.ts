import Anthropic, { APIError, RateLimitError, APIConnectionError } from '@anthropic-ai/sdk';

async function safeCall(prompt: string): Promise<string> {
  try {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }],
    });
    return response.content[0].type === 'text' ? response.content[0].text : '';

  } catch (error) {
    if (error instanceof RateLimitError) {
      // 429: ส่ง request เร็วเกินไป
      console.log('Rate limited. Waiting 60 seconds...');
      await sleep(60000);
      return safeCall(prompt); // retry

    } else if (error instanceof APIConnectionError) {
      // Network error — retry ได้
      console.log('Connection error. Retrying...');
      await sleep(5000);
      return safeCall(prompt);

    } else if (error instanceof APIError) {
      // API error อื่นๆ
      console.error(`API Error ${error.status}: ${error.message}`);

      if (error.status === 400) {
        throw new Error(`Invalid request: ${error.message}`);
      } else if (error.status === 401) {
        throw new Error('Invalid API key — check ANTHROPIC_API_KEY');
      } else if (error.status === 529) {
        // Claude overloaded
        console.log('Claude overloaded. Waiting 30 seconds...');
        await sleep(30000);
        return safeCall(prompt);
      }
      throw error;
    }
    throw error;
  }
}
