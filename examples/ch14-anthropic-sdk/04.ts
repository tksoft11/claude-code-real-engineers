// hello_claude.ts
import Anthropic from '@anthropic-ai/sdk';
import 'dotenv/config';

const client = new Anthropic();

async function main() {
  const message = await client.messages.create({
    model: 'claude-sonnet-4-5',
    max_tokens: 1024,
    messages: [
      { role: 'user', content: 'สวัสดี Claude! แนะนำตัวเองสั้นๆ เป็นภาษาไทย' }
    ],
  });

  console.log(message.content[0].type === 'text' ? message.content[0].text : '');
}

main();
