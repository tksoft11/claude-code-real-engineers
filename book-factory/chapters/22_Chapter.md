# บทที่ 22: Tool Use & External APIs — ให้ AI มี "มือ" ลงมือทำแทนคุณ

---

## 🪝 AI ที่ไม่ได้แค่พูด แต่ลงมือทำ

ลองนึกถึงสถานการณ์นี้:

คุณพิมพ์ใน Slack ว่า:
> "มีบั๊กใน payment module ลูกค้าไม่สามารถ checkout ได้ ช่วยสร้าง ticket ด่วน"

ปกติ: คุณต้องเปิด Jira → กรอก form → assign → set priority → copy link กลับมา Slack

**ด้วย Tool Use:** Claude อ่าน message คุณ → เรียก Jira API สร้าง ticket → เรียก Slack API โพสต์ link กลับมา — **โดยที่คุณไม่ต้องทำอะไรเพิ่ม**

นี่คือ **Tool Use** — ความสามารถที่ทำให้ Claude จาก "ที่ปรึกษาฉลาด" กลายเป็น "ผู้ช่วยที่ลงมือทำได้"

---

## 🧠 Tool Use ทำงานอย่างไร

```
ปกติ:    คุณ → Claude → ข้อความ
Tool Use: คุณ → Claude → เรียก Tool (API) → ผลลัพธ์ → Claude → ข้อความ
                              ↑
                    Claude เลือกเองว่าต้องเรียก Tool ไหน
                    พร้อม arguments อะไร
```

**Flow ละเอียด:**

```
1. คุณส่ง message + tool definitions
2. Claude วิเคราะห์ว่าต้องใช้ tool ไหน
3. Claude ส่ง tool call request กลับมา
4. โค้ดของคุณ execute tool จริงๆ
5. ส่งผลลัพธ์ tool กลับไปให้ Claude
6. Claude ใช้ผลลัพธ์ตอบคำถาม
```

> **สำคัญ:** Claude ไม่ได้เรียก API โดยตรง — มันแค่ "บอก" ว่าต้องการเรียกอะไร โค้ดของคุณคือคนที่ execute จริงๆ ทำให้คุณควบคุม security ได้เต็มที่

---

## 🔧 สร้าง Tool Definition

```typescript
// src/tools/definitions.ts
import Anthropic from '@anthropic-ai/sdk';

// Tool คือ JSON object ที่บอก Claude ว่ามี capability อะไรบ้าง
export const jiraTools: Anthropic.Tool[] = [
  {
    name: 'create_jira_ticket',
    description: 'สร้าง ticket ใน Jira สำหรับ bug, feature request, หรืองานต่างๆ',
    input_schema: {
      type: 'object' as const,
      properties: {
        summary: {
          type: 'string',
          description: 'หัวข้อสั้นๆ ของ ticket (ไม่เกิน 100 ตัวอักษร)',
        },
        description: {
          type: 'string',
          description: 'รายละเอียดของ ticket พร้อม steps to reproduce ถ้าเป็น bug',
        },
        issueType: {
          type: 'string',
          enum: ['Bug', 'Story', 'Task', 'Epic'],
          description: 'ประเภทของ issue',
        },
        priority: {
          type: 'string',
          enum: ['Highest', 'High', 'Medium', 'Low', 'Lowest'],
          description: 'ความสำคัญ — ใช้ Highest สำหรับ production issues เท่านั้น',
        },
        labels: {
          type: 'array',
          items: { type: 'string' },
          description: 'labels สำหรับ categorize เช่น ["payment", "urgent"]',
        },
      },
      required: ['summary', 'issueType', 'priority'],
    },
  },
  {
    name: 'search_jira_tickets',
    description: 'ค้นหา tickets ใน Jira ด้วย JQL query',
    input_schema: {
      type: 'object' as const,
      properties: {
        jql: {
          type: 'string',
          description: 'JQL query เช่น "project = TECH AND status = Open AND priority = High"',
        },
        maxResults: {
          type: 'number',
          description: 'จำนวน results สูงสุด (default: 10)',
        },
      },
      required: ['jql'],
    },
  },
  {
    name: 'update_ticket_status',
    description: 'เปลี่ยน status ของ ticket ที่มีอยู่แล้ว',
    input_schema: {
      type: 'object' as const,
      properties: {
        ticketKey: {
          type: 'string',
          description: 'Jira ticket key เช่น TECH-123',
        },
        newStatus: {
          type: 'string',
          enum: ['To Do', 'In Progress', 'In Review', 'Done'],
        },
        comment: {
          type: 'string',
          description: 'comment ที่จะเพิ่มพร้อมกับการเปลี่ยน status',
        },
      },
      required: ['ticketKey', 'newStatus'],
    },
  },
];
```

---

## ⚙️ Execute Tools (โค้ดฝั่งคุณ)

```typescript
// src/tools/executors.ts
import axios from 'axios';

const jiraConfig = {
  baseURL: process.env.JIRA_BASE_URL,
  auth: {
    username: process.env.JIRA_EMAIL!,
    password: process.env.JIRA_API_TOKEN!,
  },
  headers: { 'Content-Type': 'application/json' },
};

// Map tool name → function ที่ execute จริงๆ
export const toolExecutors: Record<string, (input: any) => Promise<unknown>> = {
  create_jira_ticket: async (input) => {
    const response = await axios.post(
      `${jiraConfig.baseURL}/rest/api/3/issue`,
      {
        fields: {
          project: { key: process.env.JIRA_PROJECT_KEY },
          summary: input.summary,
          description: {
            type: 'doc',
            version: 1,
            content: [{
              type: 'paragraph',
              content: [{ type: 'text', text: input.description || '' }],
            }],
          },
          issuetype: { name: input.issueType },
          priority: { name: input.priority },
          labels: input.labels || [],
        },
      },
      { auth: jiraConfig.auth, headers: jiraConfig.headers }
    );

    return {
      ticketKey: response.data.key,
      ticketUrl: `${jiraConfig.baseURL}/browse/${response.data.key}`,
      status: 'created',
    };
  },

  search_jira_tickets: async (input) => {
    const response = await axios.get(
      `${jiraConfig.baseURL}/rest/api/3/search`,
      {
        params: { jql: input.jql, maxResults: input.maxResults || 10 },
        auth: jiraConfig.auth,
      }
    );

    return response.data.issues.map((issue: any) => ({
      key: issue.key,
      summary: issue.fields.summary,
      status: issue.fields.status.name,
      priority: issue.fields.priority?.name,
      url: `${jiraConfig.baseURL}/browse/${issue.key}`,
    }));
  },

  update_ticket_status: async (input) => {
    // ดึง transitions ที่ทำได้
    const transitionsRes = await axios.get(
      `${jiraConfig.baseURL}/rest/api/3/issue/${input.ticketKey}/transitions`,
      { auth: jiraConfig.auth }
    );

    const transition = transitionsRes.data.transitions.find(
      (t: any) => t.name === input.newStatus
    );

    if (!transition) {
      return { error: `Cannot transition to "${input.newStatus}"` };
    }

    // เปลี่ยน status
    await axios.post(
      `${jiraConfig.baseURL}/rest/api/3/issue/${input.ticketKey}/transitions`,
      { transition: { id: transition.id } },
      { auth: jiraConfig.auth }
    );

    // เพิ่ม comment ถ้ามี
    if (input.comment) {
      await axios.post(
        `${jiraConfig.baseURL}/rest/api/3/issue/${input.ticketKey}/comment`,
        {
          body: {
            type: 'doc', version: 1,
            content: [{ type: 'paragraph', content: [{ type: 'text', text: input.comment }] }],
          },
        },
        { auth: jiraConfig.auth }
      );
    }

    return { success: true, ticketKey: input.ticketKey, newStatus: input.newStatus };
  },
};
```

---

## 🔁 Tool Use Loop (Core Engine)

```typescript
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
```

---

## 🎫 Killer Example: The Jira Whisperer

สร้าง Slack Bot ที่อ่านข้อความแล้วสร้าง Jira ticket อัตโนมัติ:

```typescript
// jira-whisperer.ts
import { runWithTools } from './agents/tool-agent';

const SYSTEM_PROMPT = `คุณคือ AI ผู้ช่วยสำหรับทีม Engineering ที่ดูแล Jira

เมื่อได้รับรายงาน bug หรือ request:
1. วิเคราะห์ว่าเป็น bug, feature request, หรืองานทั่วไป
2. สร้าง Jira ticket ด้วยข้อมูลที่ครบถ้วน
3. ตั้ง priority ตามความรุนแรง:
   - Production down / ลูกค้าไม่สามารถใช้งาน → Highest
   - Feature หลักใช้ไม่ได้ → High
   - งานทั่วไป → Medium
4. เพิ่ม labels ที่เหมาะสม
5. รายงานผลพร้อม ticket URL

ตอบเป็นภาษาไทยเสมอ`;

// Slack message handler
async function handleSlackMessage(message: string, channelId: string) {
  console.log(`📨 Received: "${message}"`);

  const result = await runWithTools(message, SYSTEM_PROMPT);

  // ส่งกลับ Slack
  await slackClient.chat.postMessage({
    channel: channelId,
    text: result,
  });
}

// ทดสอบ
await handleSlackMessage(
  'มีบั๊กใน payment module! ลูกค้า checkout ไม่ได้ตั้งแต่ 2 ชั่วโมงที่แล้ว กระทบลูกค้าทั้งหมด',
  '#engineering'
);

// Claude จะ:
// 1. วิเคราะห์: Production issue, กระทบทุกคน → Highest priority
// 2. เรียก create_jira_ticket({ summary: "Payment Checkout Broken...", priority: "Highest", ... })
// 3. ได้ TECH-456 กลับมา
// 4. ตอบกลับ: "สร้าง ticket TECH-456 เรียบร้อยแล้ว: [link]"
```

---

## 🔗 Multi-Tool Workflow: Jira + Slack + Notification

```typescript
// tools ที่เพิ่มเติม
const slackTools: Anthropic.Tool[] = [
  {
    name: 'post_slack_message',
    description: 'ส่งข้อความไปยัง Slack channel',
    input_schema: {
      type: 'object' as const,
      properties: {
        channel: { type: 'string', description: 'Channel ID หรือ #channel-name' },
        message: { type: 'string', description: 'ข้อความที่จะส่ง' },
        urgency: { type: 'string', enum: ['normal', 'urgent'], description: 'urgent จะ @here' },
      },
      required: ['channel', 'message'],
    },
  },
  {
    name: 'get_on_call_engineer',
    description: 'ดูว่า engineer คนไหน on-call ตอนนี้',
    input_schema: {
      type: 'object' as const,
      properties: {},
      required: [],
    },
  },
];

// Prompt สำหรับ incident ฉุกเฉิน
const INCIDENT_PROMPT = `เมื่อเกิด incident:
1. สร้าง Jira ticket ด้วย priority Highest
2. ดูว่าใคร on-call ตอนนี้
3. ส่งแจ้ง @mention engineer นั้นใน #incidents channel
4. Post สรุปใน #engineering channel

ทำทั้งหมดนี้ใน 1 response`;

await runWithTools(
  'production database ล่ม ทุกระบบพัง',
  INCIDENT_PROMPT
);
// Claude จะเรียก 4 tools ต่อกันใน 1 session!
```

---

## 🛡️ Safety สำหรับ Tool Use

```typescript
// สร้าง Safe Tool Wrapper
function createSafeTool(
  name: string,
  executor: (input: any) => Promise<unknown>,
  options: {
    requireApproval?: boolean;
    allowedInProduction?: boolean;
    rateLimit?: number; // calls per minute
  } = {}
) {
  let callCount = 0;
  let lastReset = Date.now();

  return async (input: any) => {
    // Rate limiting
    if (options.rateLimit) {
      const now = Date.now();
      if (now - lastReset > 60000) { callCount = 0; lastReset = now; }
      if (++callCount > options.rateLimit) {
        throw new Error(`Rate limit exceeded for tool: ${name}`);
      }
    }

    // Production guard
    if (!options.allowedInProduction && process.env.NODE_ENV === 'production') {
      throw new Error(`Tool ${name} is not allowed in production`);
    }

    // Human approval สำหรับ destructive actions
    if (options.requireApproval) {
      console.log(`\n⚠️  Tool ${name} requires approval:`);
      console.log('Input:', JSON.stringify(input, null, 2));
      const approved = await askHumanApproval(); // readline prompt
      if (!approved) throw new Error('Tool execution rejected by user');
    }

    return executor(input);
  };
}

// ใช้งาน
const safeExecutors = {
  create_jira_ticket: createSafeTool('create_jira_ticket', toolExecutors.create_jira_ticket, {
    allowedInProduction: true,
    rateLimit: 10, // max 10 tickets per minute
  }),
  delete_tickets: createSafeTool('delete_tickets', toolExecutors.delete_tickets, {
    requireApproval: true,  // ต้องมีคนกด approve ก่อน
    allowedInProduction: false,
  }),
};
```

---

## 💻 Hands-On: สร้าง Personal Jira Assistant

```bash
# Setup
mkdir jira-assistant && cd jira-assistant
npm init -y
npm install @anthropic-ai/sdk axios dotenv readline

# .env
ANTHROPIC_API_KEY=sk-ant-...
JIRA_BASE_URL=https://yourcompany.atlassian.net
JIRA_EMAIL=your@email.com
JIRA_API_TOKEN=your-jira-token
JIRA_PROJECT_KEY=TECH
```

```typescript
// assistant.ts — Interactive Jira Assistant
import * as readline from 'readline';
import { runWithTools } from './agents/tool-agent';

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

const SYSTEM = `คุณคือ Jira Assistant ส่วนตัวของฉัน
ช่วยสร้าง ค้นหา และอัปเดต Jira tickets ตาม request ของฉัน
ตอบสั้น กระชับ พร้อม ticket URL เสมอ`;

async function chat() {
  console.log('🤖 Jira Assistant พร้อมแล้ว (พิมพ์ "exit" เพื่อออก)\n');

  const ask = () => {
    rl.question('คุณ: ', async (input) => {
      if (input.toLowerCase() === 'exit') {
        rl.close();
        return;
      }
      if (!input.trim()) return ask();

      const reply = await runWithTools(input, SYSTEM);
      console.log(`\n🤖 Assistant: ${reply}\n`);
      ask();
    });
  };

  ask();
}

chat();
```

ทดสอบด้วยคำสั่ง:
```
คุณ: สร้าง bug ticket สำหรับ login ไม่ได้บน mobile
คุณ: หา tickets ที่ยังค้างอยู่ใน sprint นี้
คุณ: เปลี่ยน TECH-123 เป็น In Progress
```

---

## 🎯 สรุปบทที่ 22

| หัวข้อ | สิ่งที่ต้องจำ |
|--------|--------------|
| Tool Use คืออะไร | Claude บอกว่าต้องเรียก tool อะไร โค้ดคุณ execute จริง |
| Tool Definition | JSON schema ที่บอก name, description, input_schema |
| Tool Loop | Claude → tool_use → execute → result → Claude → answer |
| Safety | Rate limit + Production guard + Human approval |
| Killer Example | Jira Whisperer: พิมพ์แชท → AI สร้าง ticket อัตโนมัติ |
| Multi-tool | Claude สามารถเรียกหลาย tool ต่อกันใน 1 session |

---

## 📋 Action Items ก่อนไปบทที่ 23

- [ ] สร้าง Jira API Token จาก Atlassian Account Settings
- [ ] Implement Tool Definitions สำหรับ tools ที่ใช้บ่อย
- [ ] สร้าง `runWithTools()` loop ใน project
- [ ] ทดสอบ Jira Whisperer กับ bug จริงในงาน
- [ ] เพิ่ม Safe Tool Wrappers ก่อน deploy ใน production

---

*ใน **บทที่ 23** เราจะเรียนรู้ Computer Use 101 — ให้ AI ขยับเมาส์ คลิก พิมพ์ และมองเห็นหน้าจอได้จริงๆ เปลี่ยน Claude จาก "AI ที่อ่านโค้ด" เป็น "AI ที่ใช้คอมพิวเตอร์ได้เหมือนมนุษย์" ครับ*
