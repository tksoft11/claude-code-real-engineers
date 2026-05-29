// streaming_basic.ts
import Anthropic from '@anthropic-ai/sdk';
import 'dotenv/config';

const client = new Anthropic();

async function streamBasic() {
  // วิธีที่ 1: stream helper (แนะนำ)
  const stream = await client.messages.stream({
    model: 'claude-sonnet-4-5',
    max_tokens: 1024,
    messages: [{ role: 'user', content: 'อธิบาย Docker ให้เข้าใจง่ายใน 5 ข้อ' }],
  });

  // รับ text ทีละ chunk
  for await (const chunk of stream) {
    if (
      chunk.type === 'content_block_delta' &&
      chunk.delta.type === 'text_delta'
    ) {
      process.stdout.write(chunk.delta.text);
    }
  }

  // รับ final message เมื่อเสร็จ
  const finalMessage = await stream.finalMessage();
  console.log('\n\nUsage:', finalMessage.usage);
}

streamBasic();
