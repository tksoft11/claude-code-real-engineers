// oncall-bot/src/incidentResponder.ts
import Anthropic from '@anthropic-ai/sdk';
import { INCIDENT_TOOLS } from './mcp-tools/incidentTools';
import { executeToolCall } from './mcp-tools/toolExecutor';

if (!process.env.ANTHROPIC_API_KEY) {
  throw new Error('ANTHROPIC_API_KEY is required. Set it in .env file on the server.');
}

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

interface IncidentPayload {
  alertName: string;
  service: string;
  severity: string;
  description: string;
  timestamp: string;
}

export async function respondToIncident(incident: IncidentPayload): Promise<void> {
  console.log(`🚨 Incident received: ${incident.alertName}`);

  const systemPrompt = `คุณคือ AI On-Call Engineer ที่เชี่ยวชาญระบบ Production
หน้าที่ของคุณ:
1. วิเคราะห์ incident จาก logs และ metrics อย่างเป็นระบบ
2. ตรวจสอบ Recent Deployments เสมอเพื่อหาความเชื่อมโยง
3. ค้นหา root cause ด้วยหลักฐานที่ชัดเจน ไม่คาดเดา
4. รัน pre-approved runbook actions หากมั่นใจ > 80%
5. รายงานสถานะผ่าน Slack ทุกขั้นตอน (เริ่มสืบสวน, วิเคราะห์เสร็จ, ดำเนินการแล้ว)
6. หากไม่มั่นใจ หรือปัญหาต้องการ Rollback ให้ escalate_to_human ทันที

กฎเหล็ก:
- ห้ามรัน action ที่ไม่อยู่ใน pre-approved list เด็ดขาด
- ห้าม Rollback โดยไม่แจ้งมนุษย์ก่อน
- ต้องมีหลักฐานจาก logs หรือ metrics ก่อนรัน action ทุกครั้ง`;

  const userMessage = `
⚠️ Incident Alert Received:
- Alert: ${incident.alertName}
- Service: ${incident.service}
- Severity: ${incident.severity}
- Description: ${incident.description}
- Time: ${incident.timestamp}

กรุณา:
1. แจ้ง Slack ว่ากำลังสืบสวน
2. ตรวจสอบ logs 10 นาทีล่าสุด
3. ดู metrics ที่เกี่ยวข้อง
4. เช็ค recent deployments ในชั่วโมงที่ผ่านมา
5. วิเคราะห์ root cause
6. ดำเนินการหรือ escalate
`;

  const messages: Anthropic.MessageParam[] = [
    { role: 'user', content: userMessage }
  ];

  // Agentic loop — Bot ทำงานจนกว่าจะแก้ปัญหาได้หรือ escalate
  let iterations = 0;
  const MAX_ITERATIONS = 20; // ป้องกัน infinite loop

  while (iterations < MAX_ITERATIONS) {
    iterations++;

    const response = await client.messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: 4096,
      system: systemPrompt,
      tools: INCIDENT_TOOLS,
      messages
    });

    if (response.stop_reason === 'end_turn') {
      const finalText = response.content
        .filter(c => c.type === 'text')
        .map(c => (c as Anthropic.TextBlock).text)
        .join('\n');
      console.log('✅ Incident handled. Final report:\n', finalText);
      break;
    }

    if (response.stop_reason === 'tool_use') {
      const toolResults: Anthropic.MessageParam = {
        role: 'user',
        content: []
      };

      for (const block of response.content) {
        if (block.type === 'tool_use') {
          console.log(`🔧 Bot calling tool: ${block.name}`, block.input);
          const result = await executeToolCall(block.name, block.input as Record<string, unknown>);
          (toolResults.content as Anthropic.ToolResultBlockParam[]).push({
            type: 'tool_result',
            tool_use_id: block.id,
            content: JSON.stringify(result)
          });
        }
      }

      messages.push({ role: 'assistant', content: response.content });
      messages.push(toolResults);
    }
  }

  if (iterations >= MAX_ITERATIONS) {
    console.error('❌ Bot reached max iterations without resolution. Escalating to human.');
  }
}
