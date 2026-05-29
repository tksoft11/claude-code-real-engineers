// src/services/ticket.service.ts
import Anthropic from '@anthropic-ai/sdk';
import axios from 'axios';

const client = new Anthropic();

const jiraTools: Anthropic.Tool[] = [{
  name: 'create_support_ticket',
  description: 'สร้าง Jira ticket สำหรับ bug หรือปัญหาที่ลูกค้าพบ',
  input_schema: {
    type: 'object' as const,
    properties: {
      summary:     { type: 'string', description: 'หัวข้อสั้นๆ' },
      description: { type: 'string', description: 'รายละเอียด + steps' },
      priority:    { type: 'string', enum: ['High', 'Medium', 'Low'] },
    },
    required: ['summary', 'description', 'priority'],
  },
}];

export async function handleWithTicketing(
  question: string,
  context: string,
  model: string
): Promise<string> {
  const messages: Anthropic.MessageParam[] = [{
    role: 'user',
    content: `Context:\n${context}\n\nคำถาม: ${question}`,
  }];

  let finalAnswer = '';

  for (let turn = 0; turn < 3; turn++) {
    const res = await client.messages.create({
      model, max_tokens: 2048,
      system: `คุณคือ TechDesk AI ถ้าพบ bug ให้สร้าง ticket ทันที`,
      tools: jiraTools,
      messages,
    });

    if (res.stop_reason === 'end_turn') {
      finalAnswer = res.content.find(b => b.type === 'text')?.type === 'text'
        ? (res.content.find(b => b.type === 'text') as any).text
        : '';
      break;
    }

    messages.push({ role: 'assistant', content: res.content });

    const toolResults: Anthropic.ToolResultBlockParam[] = [];
    for (const block of res.content) {
      if (block.type !== 'tool_use') continue;
      const input = block.input as any;
      let result: string;

      try {
        const jiraRes = await axios.post(
          `${process.env.JIRA_BASE_URL}/rest/api/3/issue`,
          {
            fields: {
              project: { key: process.env.JIRA_PROJECT_KEY },
              summary: input.summary,
              issuetype: { name: 'Bug' },
              priority: { name: input.priority },
              description: { type: 'doc', version: 1, content: [{ type: 'paragraph', content: [{ type: 'text', text: input.description }] }] },
            },
          },
          { auth: { username: process.env.JIRA_EMAIL!, password: process.env.JIRA_TOKEN! } }
        );
        result = `Ticket created: ${process.env.JIRA_BASE_URL}/browse/${jiraRes.data.key}`;
      } catch {
        result = 'Ticket creation failed - will retry later';
      }

      toolResults.push({ type: 'tool_result', tool_use_id: block.id, content: result });
    }

    messages.push({ role: 'user', content: toolResults });
  }

  return finalAnswer;
}
