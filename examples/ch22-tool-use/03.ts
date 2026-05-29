// src/agents/tool-agent.ts
import Anthropic from '@anthropic-ai/sdk';
import { jiraTools } from './tools/definitions';
import { toolExecutors } from './tools/executors';

const client = new Anthropic();

export async function runWithTools(
  userMessage: string,
  systemPrompt: string = '',
  maxIterations = 10
): Promise<string> {
  const messages: Anthropic.MessageParam[] = [
    { role: 'user', content: userMessage },
  ];

  let iterations = 0;

  while (iterations < maxIterations) {
    iterations++;

    // ส่งให้ Claude พร้อม tool definitions
    const response = await client.messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: 4096,
      system: systemPrompt,
      tools: jiraTools,
      messages,
    });

    // ถ้า Claude ตอบปกติ (ไม่ใช้ tool) → จบ
    if (response.stop_reason === 'end_turn') {
      const textContent = response.content.find(c => c.type === 'text');
      return textContent?.type === 'text' ? textContent.text : '';
    }

    // Claude ต้องการใช้ tool
    if (response.stop_reason === 'tool_use') {
      // เพิ่ม assistant response เข้า history
      messages.push({ role: 'assistant', content: response.content });

      // Execute แต่ละ tool call
      const toolResults: Anthropic.ToolResultBlockParam[] = [];

      for (const block of response.content) {
        if (block.type !== 'tool_use') continue;

        console.log(`🔧 Executing tool: ${block.name}`, block.input);

        try {
          const executor = toolExecutors[block.name];
          if (!executor) throw new Error(`Unknown tool: ${block.name}`);

          const result = await executor(block.input);
          console.log(`✅ Tool result:`, result);

          toolResults.push({
            type: 'tool_result',
            tool_use_id: block.id,
            content: JSON.stringify(result),
          });
        } catch (error: any) {
          console.error(`❌ Tool error:`, error.message);
          toolResults.push({
            type: 'tool_result',
            tool_use_id: block.id,
            content: JSON.stringify({ error: error.message }),
            is_error: true,
          });
        }
      }

      // ส่งผลลัพธ์ tool กลับให้ Claude
      messages.push({ role: 'user', content: toolResults });
    }
  }

  throw new Error(`Max iterations (${maxIterations}) reached`);
}
