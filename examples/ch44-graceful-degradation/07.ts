// src/index.ts
import { AIGateway } from './ai-gateway/gateway';
import { ClaudeProvider } from './ai-gateway/providers/claude.provider';
import { OpenAIProvider } from './ai-gateway/providers/openai.provider';
import { OllamaProvider } from './ai-gateway/providers/ollama.provider';

// สร้าง Gateway พร้อม fallback chain
export const aiGateway = new AIGateway({
  timeoutMs: 25_000,
  enableCache: true,
})
  .addProvider(new ClaudeProvider(), 1)   // Primary
  .addProvider(new OpenAIProvider(), 2)   // Fallback 1
  .addProvider(new OllamaProvider(), 3);  // Last resort (local)

// ใช้งานแทน client.messages.create() โดยตรง
async function handleUserMessage(userInput: string): Promise<string> {
  const response = await aiGateway.complete(
    userInput,
    'คุณคือ AI assistant ที่ช่วยตอบคำถามลูกค้าของเรา',
    1024
  );

  if (response.cached) {
    console.log('Cache hit!');
  }
  console.log(`Provider used: ${response.provider} (${response.latencyMs}ms)`);

  return response.text;
}

// Health check endpoint
import express from 'express';
const app = express();

app.get('/health/ai', (req, res) => {
  const status = aiGateway.getProviderStatus();
  const hasAvailable = Object.values(status).some(s => s !== 'OPEN');
  res.status(hasAvailable ? 200 : 503).json({ providers: status });
});
