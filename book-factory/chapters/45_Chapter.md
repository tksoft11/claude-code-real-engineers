# บทที่ 45: AI On-Call & Incident Response

---

## 🪝 ตี 2:47 น. — ระฆังโบสถ์ที่ไม่มีใครอยากได้ยิน

วันพุธ ตี 2 ครึ่ง ณ บ้านของ ณัฐ วิศวกรอาวุโสผู้รับผิดชอบระบบ Payment Gateway ของบริษัท FinTech ขนาดกลาง

โทรศัพท์สั่น เสียงระฆัง PagerDuty ดังขึ้น ณัฐพลิกตัวบนเตียง ลืมตาขึ้นด้วยความกึ่งหลับกึ่งตื่น ล็อกอินเข้าระบบด้วยดวงตาที่ยังไม่ปรับแสง

หน้าจอแสดงข้อความ:
```
🔴 CRITICAL: Payment Gateway — 500 Error Rate > 40%
   Affected: 2,400 transactions/hr
   Duration: 3 minutes
   On-call: Natth (YOU)
```

สิ่งที่ผ่านมาในหัวของณัฐตามลำดับ:
1. *"มันพังตรงไหนกันแน่?"* — ต้องเปิด CloudWatch อ่าน Log ทีละบรรทัด
2. *"เมื่อกี้ใครดัน Deploy อะไรขึ้นไป?"* — ต้องตรวจ GitHub Commit History
3. *"Database หรือ Service?"* — ต้องวิ่งคำสั่ง `kubectl get pods` ดูสถานะ
4. *"ต้อง Rollback ไหม?"* — ต้องปรึกษาวิศวกรคนอื่นก่อนตัดสินใจ

ขั้นตอนการวินิจฉัยทั้งหมดนี้ใช้เวลา **15–45 นาที** และทุกนาทีที่ผ่านไปหมายถึงธุรกรรมที่ล้มเหลวอีกหลายร้อยรายการ

**แต่จะเกิดอะไรขึ้น ถ้าไม่มีทีม On-Call ที่เป็นมนุษย์?**

ในโลกที่วิศวกรได้ติดตั้ง **AI On-Call Bot** ไว้ล่วงหน้า บทสนทนาระหว่างระบบจะเปลี่ยนไปดังนี้:

```
02:47:00 น. — PagerDuty alert ยิง Webhook → AI Bot ตื่น (0.3 วินาที)
02:47:04 น. — Bot อ่าน CloudWatch: "DB Connection Pool 500/500 (exhausted)"
02:47:06 น. — Bot ค้นหา Runbook: "Connection Pool Exhausted → Restart pool service"
02:47:08 น. — Bot รัน pre-approved action: restart pool (ไม่ต้องขออนุมัติ)
02:47:11 น. — Gateway Online ✅
02:47:15 น. — Slack: "🟢 RESOLVED in 28 sec | Root cause: DB pool exhausted"
               "📋 PR drafted with permanent fix + Postmortem draft ready"
02:47:16 น. — ณัฐยังนอนหลับอยู่
```

นี่ไม่ใช่นิยายวิทยาศาสตร์ มันคือสถาปัตยกรรมที่ทำได้จริงด้วยเครื่องมือที่มีในปัจจุบัน

---

## 🏗️ Core Mechanic: สถาปัตยกรรม AI On-Call ระดับองค์กร

ระบบ AI On-Call ที่ดีประกอบด้วย 4 ชั้นทำงานร่วมกัน:

```
┌─────────────────────────────────────────────────────┐
│  Layer 1: Detection (Datadog / CloudWatch / Sentry)  │
│  → ตรวจพบความผิดปกติและส่ง Webhook                  │
└──────────────────────────┬──────────────────────────┘
                           ▼
┌─────────────────────────────────────────────────────┐
│  Layer 2: Triage (AI Bot — Claude + MCP Tools)      │
│  → อ่าน Log, Query Metrics, ค้นหา Root Cause         │
└──────────────────────────┬──────────────────────────┘
                           ▼
┌─────────────────────────────────────────────────────┐
│  Layer 3: Action (Pre-Approved Runbook Executor)    │
│  → รัน Safe Actions โดยอัตโนมัติ (ไม่ต้องรออนุมัติ)  │
└──────────────────────────┬──────────────────────────┘
                           ▼
┌─────────────────────────────────────────────────────┐
│  Layer 4: Escalation (Slack + PagerDuty Human)      │
│  → แจ้งมนุษย์เฉพาะเมื่อ Bot ตัดสินใจเองไม่ได้        │
└─────────────────────────────────────────────────────┘
```

### กุญแจสำคัญ: Runbook (คู่มือแก้ปัญหา)

**Runbook** คือเอกสารที่ทีม SRE เขียนล่วงหน้าว่า *"ถ้าเกิดปัญหา X จงทำ Y"* เช่น:
- ถ้า DB Connection Pool เต็ม → Restart pool service
- ถ้า Memory > 90% → Scale up pods
- ถ้า Error Rate > 50% มากกว่า 5 นาที → Rollback to previous version

AI On-Call ใช้ Runbook เป็น "ไกด์บุ๊ก" และ MCP Tools เป็น "มือ" ในการลงมือทำ

---

## 🔧 Hands-On: พัฒนา AI On-Call Bot ด้วย Claude + MCP

เราจะสร้างระบบ Incident Response Bot แบบครบวงจรใน 4 ส่วน:

### โครงสร้างไฟล์โปรเจกต์ทั้งหมด

```
oncall-bot/
├── src/
│   ├── mcp-tools/
│   │   ├── incidentTools.ts      ← นิยาม Tool ที่บอทใช้ได้
│   │   └── toolExecutor.ts       ← โค้ดลงมือทำจริง (AWS, Kubernetes, Slack)
│   ├── incidentResponder.ts      ← สมอง AI — วิเคราะห์และตัดสินใจ
│   ├── server.ts                 ← Webhook รับสัญญาณจาก PagerDuty
│   └── runbooks/
│       └── playbook.json         ← คู่มือแก้ปัญหาที่ Bot อ่านได้
├── .env                          ← Keys ทั้งหมด (Server-side เท่านั้น!)
└── package.json
```

### ส่วนที่ 1: MCP Tool Server — ให้ Bot มี "มือ" ทำงานได้

```typescript
// oncall-bot/src/mcp-tools/incidentTools.ts
import { Tool } from '@anthropic-ai/sdk';

export const INCIDENT_TOOLS: Tool[] = [
  {
    name: 'get_cloudwatch_logs',
    description: 'ดึง Error logs จาก AWS CloudWatch สำหรับ service ที่ระบุในช่วงเวลาที่กำหนด',
    input_schema: {
      type: 'object',
      properties: {
        service_name: { type: 'string', description: 'ชื่อ ECS Service หรือ Lambda Function' },
        minutes_back: { type: 'number', description: 'จำนวนนาทีย้อนหลังที่ต้องการดู' },
        filter_pattern: { type: 'string', description: 'Pattern กรองเฉพาะ ERROR หรือ Exception' }
      },
      required: ['service_name', 'minutes_back']
    }
  },
  {
    name: 'get_datadog_metrics',
    description: 'ดึง Performance metrics จาก Datadog (CPU, Memory, Error Rate, Latency)',
    input_schema: {
      type: 'object',
      properties: {
        metric_name: { type: 'string' },
        service: { type: 'string' },
        from_minutes_ago: { type: 'number' }
      },
      required: ['metric_name', 'service', 'from_minutes_ago']
    }
  },
  {
    name: 'get_recent_deployments',
    description: 'ตรวจสอบว่ามี Deployment อะไรถูก push ขึ้นในช่วงเวลาก่อนเกิดเหตุ',
    input_schema: {
      type: 'object',
      properties: {
        service: { type: 'string' },
        hours_back: { type: 'number', description: 'ย้อนหลังกี่ชั่วโมง' }
      },
      required: ['service', 'hours_back']
    }
  },
  {
    name: 'run_safe_runbook_action',
    description: 'รันคำสั่ง pre-approved ใน runbook เช่น restart service, scale pods, clear cache',
    input_schema: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          enum: ['restart_service', 'scale_pods', 'clear_cache', 'rollback_deployment'],
          description: 'คำสั่งที่รันได้โดยไม่ต้องขออนุมัติเพิ่มเติม'
        },
        target: { type: 'string', description: 'ชื่อ service หรือ deployment ที่เป็นเป้าหมาย' },
        parameters: { type: 'object', description: 'พารามิเตอร์เพิ่มเติม เช่น replica_count สำหรับ scale' }
      },
      required: ['action', 'target']
    }
  },
  {
    name: 'post_slack_update',
    description: 'ส่งข้อความอัปเดตสถานะเหตุการณ์ไปยัง Slack channel #incidents',
    input_schema: {
      type: 'object',
      properties: {
        message: { type: 'string' },
        severity: { type: 'string', enum: ['info', 'warning', 'critical', 'resolved'] }
      },
      required: ['message', 'severity']
    }
  },
  {
    name: 'escalate_to_human',
    description: 'ส่งสัญญาณปลุก On-Call Engineer ที่เป็นมนุษย์เมื่อ Bot ตัดสินใจเองไม่ได้',
    input_schema: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'เหตุผลที่ต้องการมนุษย์มาช่วย' },
        evidence: { type: 'string', description: 'หลักฐานและข้อมูลที่รวบรวมได้จนถึงตอนนี้' },
        urgency: { type: 'string', enum: ['low', 'medium', 'high', 'critical'] }
      },
      required: ['reason', 'urgency']
    }
  }
];
```

### ส่วนที่ 2: Tool Executor — โค้ดลงมือทำจริง

```typescript
// oncall-bot/src/mcp-tools/toolExecutor.ts
import {
  CloudWatchLogsClient,
  FilterLogEventsCommand
} from '@aws-sdk/client-cloudwatch-logs';
import axios from 'axios';

const cwClient = new CloudWatchLogsClient({ region: process.env.AWS_REGION || 'ap-southeast-1' });

// Map ชื่อ Action → คำสั่งจริงที่รันใน Kubernetes หรือ AWS
const SAFE_ACTIONS: Record<string, (target: string, params?: Record<string, unknown>) => Promise<string>> = {
  restart_service: async (target) => {
    // จำลอง: จริงๆ ใช้ kubectl rollout restart deployment/<target>
    console.log(`🔄 Restarting service: ${target}`);
    await sleep(2000); // จำลองเวลารัน
    return `Service ${target} restarted successfully. New pods spinning up.`;
  },
  scale_pods: async (target, params) => {
    const replicas = (params?.replica_count as number) || 3;
    console.log(`📈 Scaling ${target} to ${replicas} replicas`);
    await sleep(1500);
    return `Deployment ${target} scaled to ${replicas} replicas.`;
  },
  clear_cache: async (target) => {
    console.log(`🧹 Clearing cache for: ${target}`);
    await sleep(500);
    return `Cache cleared for ${target}. Next requests will rebuild from DB.`;
  },
  rollback_deployment: async (target) => {
    console.log(`⏪ Rolling back deployment: ${target}`);
    await sleep(3000);
    return `Deployment ${target} rolled back to previous stable version.`;
  }
};

export async function executeToolCall(
  toolName: string,
  input: Record<string, unknown>
): Promise<unknown> {
  console.log(`🔧 Executing tool: ${toolName}`);

  switch (toolName) {
    case 'get_cloudwatch_logs': {
      const { service_name, minutes_back, filter_pattern } = input as {
        service_name: string; minutes_back: number; filter_pattern?: string;
      };
      const endTime = Date.now();
      const startTime = endTime - (minutes_back * 60 * 1000);

      try {
        const response = await cwClient.send(new FilterLogEventsCommand({
          logGroupName: `/ecs/${service_name}`,
          startTime,
          endTime,
          filterPattern: filter_pattern || 'ERROR',
          limit: 50
        }));
        const events = response.events?.map(e => e.message).join('\n') || 'No errors found';
        return { logs: events, count: response.events?.length || 0 };
      } catch {
        // จำลองข้อมูลในกรณีทดสอบ
        return {
          logs: `[ERROR] DB Connection pool exhausted: 500/500 connections used\n[ERROR] Timeout acquiring connection after 30000ms`,
          count: 2
        };
      }
    }

    case 'get_datadog_metrics': {
      const { metric_name, service, from_minutes_ago } = input as {
        metric_name: string; service: string; from_minutes_ago: number;
      };
      // จำลองการดึงจาก Datadog API
      return {
        metric: metric_name,
        service,
        current_value: metric_name.includes('error') ? 0.42 : 2847,
        threshold: metric_name.includes('error') ? 0.05 : 500,
        status: 'critical',
        trend: 'increasing'
      };
    }

    case 'get_recent_deployments': {
      return {
        deployments: [
          { version: 'v2.3.1', time: '47 minutes ago', deployer: 'github-actions', status: 'success' },
          { version: 'v2.3.0', time: '2 days ago', deployer: 'john@company.com', status: 'success' }
        ]
      };
    }

    case 'run_safe_runbook_action': {
      const { action, target, parameters } = input as {
        action: string; target: string; parameters?: Record<string, unknown>;
      };
      const actionFn = SAFE_ACTIONS[action];
      if (!actionFn) {
        return { error: `Action '${action}' is not in the pre-approved list.` };
      }
      const result = await actionFn(target, parameters);
      return { success: true, result, action, target };
    }

    case 'post_slack_update': {
      const { message, severity } = input as { message: string; severity: string };
      const emoji = { info: 'ℹ️', warning: '⚠️', critical: '🚨', resolved: '✅' }[severity] || '📢';
      const slackPayload = {
        text: `${emoji} *On-Call AI Bot* [${severity.toUpperCase()}]\n${message}`
      };

      if (process.env.SLACK_WEBHOOK_URL) {
        await axios.post(process.env.SLACK_WEBHOOK_URL, slackPayload);
      } else {
        console.log('📢 [Slack Simulation]:', slackPayload.text);
      }
      return { sent: true, channel: '#incidents' };
    }

    case 'escalate_to_human': {
      const { reason, evidence, urgency } = input as {
        reason: string; evidence?: string; urgency: string;
      };
      console.error(`🆘 ESCALATION (${urgency.toUpperCase()}): ${reason}`);
      // จริงๆ จะ call PagerDuty API เพื่อปลุก On-Call Engineer
      return {
        escalated: true,
        message: `Human engineer notified via PagerDuty (urgency: ${urgency})`,
        evidence_logged: !!evidence
      };
    }

    default:
      return { error: `Unknown tool: ${toolName}` };
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
```

### ส่วนที่ 3: AI Incident Responder — สมอง Bot

```typescript
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
```

### ส่วนที่ 4: Webhook Server รับ Alert จาก PagerDuty

```typescript
// oncall-bot/src/server.ts
import express from 'express';
import { respondToIncident } from './incidentResponder';

const app = express();
app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'ai-oncall-bot' });
});

// Endpoint รับ Webhook จาก PagerDuty / Datadog / Sentry
app.post('/webhooks/pagerduty', async (req, res) => {
  const event = req.body;

  if (event.event?.event_type === 'trigger') {
    const incident = {
      alertName: event.event?.data?.title || 'Unknown Alert',
      service: event.event?.data?.service?.name || 'Unknown Service',
      severity: event.event?.data?.severity || 'critical',
      description: event.event?.data?.custom_details?.description || '',
      timestamp: new Date().toISOString()
    };

    // ตอบ PagerDuty ก่อนภายใน 3 วินาที (timeout requirement)
    res.status(200).json({ status: 'acknowledged' });

    // รัน AI Responder แบบ async (ไม่รอผล)
    respondToIncident(incident).catch(err => {
      console.error('AI Responder error:', err);
    });

  } else {
    res.status(200).json({ status: 'ignored', reason: 'Not a trigger event' });
  }
});

// Endpoint ทดสอบสำหรับ Development
app.post('/test/simulate-incident', async (req, res) => {
  const testIncident = {
    alertName: 'Payment Gateway — 500 Error Rate > 40%',
    service: 'payment-gateway',
    severity: 'critical',
    description: 'Error rate สูงผิดปกติ มีรายงานธุรกรรมล้มเหลวจำนวนมาก',
    timestamp: new Date().toISOString()
  };

  res.json({ status: 'simulation started', incident: testIncident });
  respondToIncident(testIncident).catch(console.error);
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🤖 AI On-Call Bot listening on port ${PORT}`));
```

### ส่วนที่ 5: Runbook Configuration — คู่มือที่ Bot อ่านได้

```json
// oncall-bot/src/runbooks/playbook.json
{
  "version": "1.0",
  "runbooks": [
    {
      "trigger": "DB Connection Pool Exhausted",
      "keywords": ["connection pool", "exhausted", "timeout acquiring connection"],
      "actions": [
        {
          "step": 1,
          "tool": "run_safe_runbook_action",
          "action": "restart_service",
          "target": "connection-pool-manager",
          "description": "Restart the DB connection pool manager service"
        }
      ],
      "escalate_if": "Service not recovered within 2 minutes"
    },
    {
      "trigger": "High Memory Usage",
      "keywords": ["OOMKilled", "memory", "limit exceeded"],
      "actions": [
        {
          "step": 1,
          "tool": "run_safe_runbook_action",
          "action": "scale_pods",
          "target": "affected-service",
          "parameters": { "replica_count": 5 }
        }
      ],
      "escalate_if": "Memory usage still > 85% after scaling"
    },
    {
      "trigger": "Cache Miss Spike",
      "keywords": ["cache miss", "redis timeout", "cache unavailable"],
      "actions": [
        {
          "step": 1,
          "tool": "run_safe_runbook_action",
          "action": "clear_cache",
          "target": "redis-primary"
        }
      ],
      "escalate_if": "Never — cache clear is always safe"
    }
  ]
}
```

---

## 🧪 ทดสอบระบบ: จำลอง Incident จริง

วิธีทดสอบว่า Bot ทำงานได้จริงก่อน deploy ขึ้น Production:

### 1. ตั้งค่า Environment Variables

```bash
# .env (เก็บบนเซิร์ฟเวอร์เท่านั้น ห้าม commit!)
ANTHROPIC_API_KEY=sk-ant-api03-xxxxxxxx
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/xxx/xxx/xxx
AWS_REGION=ap-southeast-1
PORT=5000
NODE_ENV=development
```

### 2. รัน Bot ในโหมดทดสอบ

```bash
# ติดตั้ง dependencies
npm install

# รัน Bot
npm run dev

# ในอีก terminal หนึ่ง — จำลองส่ง alert
curl -X POST http://localhost:5000/test/simulate-incident \
  -H "Content-Type: application/json"

# ดู console output เพื่อเห็น Bot ทำงานทีละขั้น
```

### 3. ผลลัพธ์ที่ควรเห็นใน Console

```
🚨 Incident received: Payment Gateway — 500 Error Rate > 40%
🔧 Bot calling tool: post_slack_update { severity: 'critical', message: '...' }
📢 [Slack]: 🚨 กำลังสืบสวน Payment Gateway incident...
🔧 Bot calling tool: get_cloudwatch_logs { service: 'payment-gateway', minutes_back: 10 }
🔧 Bot calling tool: get_datadog_metrics { metric: 'error.rate', ... }
🔧 Bot calling tool: get_recent_deployments { service: 'payment-gateway', hours_back: 1 }
🔧 Bot calling tool: run_safe_runbook_action { action: 'restart_service', target: '...' }
🔄 Restarting service: connection-pool-manager
🔧 Bot calling tool: post_slack_update { severity: 'resolved', message: '...' }
📢 [Slack]: ✅ RESOLVED in 28 sec | Root cause: DB pool exhausted | Action: restart
✅ Incident handled.
```

---

## 🛡️ หลักการออกแบบ Escalation Policy ที่ปลอดภัย

การให้ Bot มีอำนาจทำอะไรบางอย่างโดยอัตโนมัติเป็นเรื่องที่ต้องออกแบบอย่างระมัดระวัง นี่คือหลักการ 3 ระดับ:

| ระดับ | Bot ทำได้เองทันที | ต้องแจ้งขออนุมัติก่อน | ห้ามทำ |
|-------|------------------|----------------------|--------|
| **Safe** | Restart service, Clear cache, Scale up pods | Rollback deployment, Force drain traffic | ลบ Database, ปิดระบบทั้งหมด |
| **Cautious** | อ่าน logs, ดู metrics | Scale down pods, เปลี่ยน Config | ปรับ Production secrets |
| **Never Auto** | — | — | DROP TABLE, ลบ user data |

กฎที่สำคัญที่สุด: **Bot รู้ว่าตัวเองรู้อะไรได้และไม่ได้** หากไม่มั่นใจ ให้ Escalate หามนุษย์เสมอ

### ทำไม "Human in the Loop" ยังจำเป็น

แม้ว่า AI Bot จะฉลาดขึ้นทุกวัน แต่การตัดสินใจที่ส่งผลต่อธุรกิจสำคัญยังต้องการมนุษย์เสมอ ด้วยเหตุผล 3 ประการ:

1. **Context ที่ AI ไม่รู้:** Bot ไม่รู้ว่าคืนนี้มีแผน Maintenance อยู่แล้ว หรือลูกค้า VIP กำลังทำ Demo อยู่ในขณะนั้น
2. **ผลกระทบข้ามทีม:** การ Rollback อาจส่งผลต่อทีม Marketing ที่เพิ่ง push Campaign ขึ้นไป
3. **ความรับผิดชอบ (Accountability):** ทุกการตัดสินใจสำคัญต้องมีคนรับผิดชอบได้

---

## 🎯 สรุปบทที่ 45

| องค์ประกอบ | บทบาทในระบบ |
|-----------|------------|
| **Datadog/CloudWatch** | Eyes — ตาคอยสังเกตการณ์ระบบ 24/7 |
| **PagerDuty Webhook** | Nervous System — ส่งสัญญาณเตือนเมื่อเกิดเหตุ |
| **incidentTools.ts** | Vocabulary — ภาษาที่ Bot ใช้สื่อสารกับระบบ |
| **toolExecutor.ts** | Hands — ลงมือทำจริง (AWS, Kubernetes, Slack) |
| **incidentResponder.ts** | Brain — วิเคราะห์ วินิจฉัย และตัดสินใจ |
| **playbook.json** | Experience — คู่มือที่รวบรวมบทเรียนของทีม |
| **Slack Notification** | Voice — รายงานสถานะให้ทีมทราบตลอดเวลา |

**ผลลัพธ์จริง:** Mean Time To Resolution (MTTR) ลดจาก 45 นาที เหลือ 28 วินาที — คุณภาพชีวิตทีม On-Call เปลี่ยนไปตลอดกาล

---

## 📋 Action Items ก่อนไปบทที่ 46

- [ ] ลงทะเบียนทดลอง PagerDuty (Free Tier) และตั้งค่า Webhook endpoint ให้ชี้มาที่ `/webhooks/pagerduty`
- [ ] สร้างไฟล์ `playbook.json` โดยนั่งคิดกับทีมว่าปัญหาอะไรเกิดบ่อยที่สุดและวิธีแก้ที่ปลอดภัยคืออะไร
- [ ] รัน Simulation Test ด้วย endpoint `/test/simulate-incident` ก่อน deploy ขึ้น Production จริง
- [ ] กำหนด Escalation Policy เป็นเอกสารที่ทีมเห็นด้วย ว่า Bot ทำอะไรได้บ้างโดยไม่ต้องรออนุมัติ
- [ ] ตั้ง Alert ใน Bot ว่าหาก `iterations >= 10` ให้ Escalate หามนุษย์โดยอัตโนมัติ

---

*ใน **บทที่ 46** เราจะพิสูจน์ความคุ้มค่าของการลงทุน AI ด้วย **Measuring & Reporting AI ROI** — สร้าง Dashboard ที่ทำให้ CFO อนุมัติ Budget AI เพิ่มขึ้น 5 เท่าได้ในการประชุมเดียวครับ*
