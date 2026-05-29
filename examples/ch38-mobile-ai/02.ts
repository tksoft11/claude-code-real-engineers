// backend/src/services/claude.service.ts
import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic(); // อ่าน ANTHROPIC_API_KEY จาก process.env

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export async function streamChat(
  messages: ChatMessage[],
  system: string,
  onChunk: (text: string) => void,
  onDone: (inputTokens: number, outputTokens: number) => void
): Promise<void> {
  const stream = await client.messages.create({
    model: 'claude-haiku-4-5',   // Haiku เหมาะสำหรับ mobile chat (เร็ว+ถูก)
    max_tokens: 1024,
    system,
    messages,
    stream: true,
  });

  for await (const event of stream) {
    if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
      onChunk(event.delta.text);
    }
    if (event.type === 'message_delta' && event.usage) {
      onDone(0, event.usage.output_tokens);
    }
  }
}
