// test/gateway.test.ts
import { AIGateway } from '../src/ai-gateway/gateway';
import { AIProvider, AIResponse } from '../src/ai-gateway/providers/types';

// Mock provider ที่ fail ตลอด
class FailingProvider implements AIProvider {
  name = 'failing';
  async complete(): Promise<AIResponse> {
    throw new Error('Service unavailable');
  }
}

// Mock provider ที่ทำงานปกติ
class WorkingProvider implements AIProvider {
  name = 'working';
  async complete(prompt: string): Promise<AIResponse> {
    return {
      text: `Response from working provider: ${prompt.slice(0, 50)}`,
      provider: 'working', model: 'mock-v1',
      inputTokens: 10, outputTokens: 20, latencyMs: 100,
    };
  }
}

async function testFallback() {
  const gateway = new AIGateway()
    .addProvider(new FailingProvider(), 1)  // Primary จะ fail
    .addProvider(new WorkingProvider(), 2); // Fallback จะรับ

  const response = await gateway.complete('test prompt');
  console.assert(response.provider === 'working', 'Should use fallback provider');
  console.log('✅ Fallback test passed:', response.provider);
}

testFallback().catch(console.error);
