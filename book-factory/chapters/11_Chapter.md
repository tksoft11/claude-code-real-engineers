# บทที่ 11: The Autonomous Agent Loop — AI ที่ทำงาน 24 ชั่วโมง

---

## 🪝 เมื่อ Claude ทำงานแทนทีมทั้งทีม

พฤษภาคม 2025 — บริษัท SaaS ขนาดเล็กมีเป้าหมายต้องการ migrate ระบบจาก monolith เป็น microservices ภายใน 2 เดือน ทีม 3 คน ไม่มีเวลาพอ

นายปอง Tech Lead ลองวิธีใหม่ เขาสร้าง **Autonomous Agent Loop** ที่ประกอบด้วย:

- **Architect Agent** — วิเคราะห์โค้ดและสร้าง migration plan
- **Developer Agent** — implement ตาม plan ทีละ service
- **Reviewer Agent** — ตรวจโค้ดที่ Developer เขียน
- **Test Agent** — เขียนและรัน integration tests

ทั้ง 4 agents ทำงาน 24 ชั่วโมง 7 วัน ปองทำหน้าที่แค่ **Unblock Blockers** เช้าและเย็น

ผลลัพธ์: Migration เสร็จใน **3 สัปดาห์** แทนที่จะเป็น 2 เดือน

---

## 🧠 Autonomous Agent Loop คืออะไร

Agent Loop แตกต่างจาก Ralph Loop ปกติตรงที่:

| Ralph Loop | Autonomous Agent Loop |
|------------|----------------------|
| Claude รัน 1 session | หลาย Agents ทำงานคู่ขนาน |
| Human review ทุก batch | Human review เฉพาะ Blockers |
| State ใน TASKS.md | State ใน Queue + Database |
| Manual restart | Self-restarting loop |
| ทำงานตาม Tasks ที่ระบุ | ดึง Tasks จาก Queue อัตโนมัติ |

```
                    ┌─────────────────────────┐
                    │      TASK QUEUE         │
                    │  (Redis / PostgreSQL)   │
                    └──────────┬──────────────┘
                               │ pull next task
              ┌────────────────▼────────────────┐
              │         AGENT LOOP              │
              │                                 │
              │  1. Pull Task from Queue        │
              │  2. Load Context (CLAUDE.md)    │
              │  3. Execute with Claude Code    │
              │  4. Verify Result               │
              │  5. Push to next Queue/Done     │
              │  6. Handle Errors / Blockers    │
              │  7. Go to Step 1               │
              └─────────────────────────────────┘
                    ↑                   ↓
              Human Unblocks    Human Reviews
              Blockers          Completed Work
```

---

## 🏗️ สถาปัตยกรรม: Task Queue

### ออกแบบ Task Schema

```typescript
// src/types/task.ts
interface Task {
  id: string;                    // UUID
  type: TaskType;                // ประเภทงาน
  status: TaskStatus;            // สถานะปัจจุบัน
  priority: 1 | 2 | 3;          // 1 = สูงสุด
  payload: Record<string, unknown>; // ข้อมูลที่ Agent ต้องการ
  result?: Record<string, unknown>; // ผลลัพธ์เมื่อเสร็จ
  error?: string;                // Error message ถ้าล้มเหลว
  blockerReason?: string;        // เหตุผลที่ต้องรอ Human
  agentId?: string;              // Agent ที่กำลังทำงาน
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  retryCount: number;
  maxRetries: number;
}

enum TaskType {
  ANALYZE_MODULE = 'analyze_module',
  IMPLEMENT_SERVICE = 'implement_service',
  WRITE_TESTS = 'write_tests',
  REVIEW_CODE = 'review_code',
  GENERATE_DOCS = 'generate_docs',
  RUN_MIGRATION = 'run_migration',
}

enum TaskStatus {
  PENDING = 'pending',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  FAILED = 'failed',
  BLOCKED = 'blocked',        // รอ Human
  NEEDS_REVIEW = 'needs_review', // รอ Human Review
}
```

### Task Queue Implementation

```typescript
// src/queue/task-queue.ts
import { PrismaClient } from '@prisma/client';

export class TaskQueue {
  constructor(private prisma: PrismaClient) {}

  async push(task: Omit<Task, 'id' | 'createdAt' | 'retryCount'>): Promise<Task> {
    return this.prisma.task.create({
      data: {
        ...task,
        status: TaskStatus.PENDING,
        retryCount: 0,
        createdAt: new Date(),
      },
    });
  }

  async pullNext(agentType: string): Promise<Task | null> {
    // ใช้ transaction เพื่อป้องกัน 2 agents ดึง task เดียวกัน
    return this.prisma.$transaction(async (tx) => {
      const task = await tx.task.findFirst({
        where: {
          status: TaskStatus.PENDING,
          type: { in: getTaskTypesForAgent(agentType) },
        },
        orderBy: [
          { priority: 'asc' },
          { createdAt: 'asc' },
        ],
      });

      if (!task) return null;

      // Lock task ทันที
      return tx.task.update({
        where: { id: task.id },
        data: {
          status: TaskStatus.IN_PROGRESS,
          agentId: agentType,
          startedAt: new Date(),
        },
      });
    });
  }

  async markCompleted(taskId: string, result: Record<string, unknown>): Promise<void> {
    await this.prisma.task.update({
      where: { id: taskId },
      data: {
        status: TaskStatus.COMPLETED,
        result,
        completedAt: new Date(),
      },
    });
  }

  async markBlocked(taskId: string, reason: string): Promise<void> {
    await this.prisma.task.update({
      where: { id: taskId },
      data: {
        status: TaskStatus.BLOCKED,
        blockerReason: reason,
      },
    });
    // แจ้ง Human ทันที
    await this.notifyBlocker(taskId, reason);
  }

  async retry(taskId: string, error: string): Promise<void> {
    const task = await this.prisma.task.findUnique({ where: { id: taskId } });
    if (!task) return;

    if (task.retryCount >= task.maxRetries) {
      await this.markBlocked(taskId, `Max retries (${task.maxRetries}) exceeded: ${error}`);
      return;
    }

    await this.prisma.task.update({
      where: { id: taskId },
      data: {
        status: TaskStatus.PENDING,
        retryCount: task.retryCount + 1,
        agentId: null,
        error,
      },
    });
  }

  private async notifyBlocker(taskId: string, reason: string): Promise<void> {
    const task = await this.prisma.task.findUnique({ where: { id: taskId } });
    await sendSlack({
      channel: '#agent-blockers',
      text: `🚧 *Task Blocked — Human Required*\n` +
            `Task: ${task?.type} (${taskId})\n` +
            `Reason: ${reason}\n` +
            `Action: Review at /admin/tasks/${taskId}`,
    });
  }
}
```

---

## 🤖 สร้าง Agent Loop หลัก

```typescript
// src/agents/base-agent.ts
import Anthropic from '@anthropic-ai/sdk';
import { TaskQueue } from '../queue/task-queue';

export abstract class BaseAgent {
  protected claude: Anthropic;
  protected queue: TaskQueue;
  protected agentId: string;
  private running = false;

  constructor(agentId: string, queue: TaskQueue) {
    this.agentId = agentId;
    this.queue = queue;
    this.claude = new Anthropic();
  }

  // แต่ละ Agent implement วิธีทำงานของตัวเอง
  abstract processTask(task: Task): Promise<{
    success: boolean;
    result?: Record<string, unknown>;
    blockerReason?: string;
  }>;

  // Core Loop ที่ทุก Agent ใช้
  async start(): Promise<void> {
    this.running = true;
    console.log(`🤖 Agent ${this.agentId} started`);

    while (this.running) {
      try {
        await this.processCycle();
      } catch (error) {
        console.error(`Agent ${this.agentId} cycle error:`, error);
        await sleep(5000); // รอก่อน retry cycle
      }
    }
  }

  private async processCycle(): Promise<void> {
    // 1. ดึง Task ถัดไป
    const task = await this.queue.pullNext(this.agentId);

    if (!task) {
      // ไม่มี task — รอสักครู่แล้วลองใหม่
      await sleep(10000); // 10 วินาที
      return;
    }

    console.log(`📋 ${this.agentId} processing task: ${task.type} (${task.id})`);

    // 2. ประมวลผล
    try {
      const outcome = await this.processTask(task);

      if (outcome.success) {
        await this.queue.markCompleted(task.id, outcome.result || {});
        console.log(`✅ Task ${task.id} completed`);

        // 3. สร้าง downstream tasks ถ้าจำเป็น
        await this.createDownstreamTasks(task, outcome.result || {});

      } else if (outcome.blockerReason) {
        await this.queue.markBlocked(task.id, outcome.blockerReason);
        console.log(`🚧 Task ${task.id} blocked: ${outcome.blockerReason}`);

      } else {
        await this.queue.retry(task.id, 'Unknown failure');
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`❌ Task ${task.id} failed: ${errorMessage}`);
      await this.queue.retry(task.id, errorMessage);
    }
  }

  // Override เพื่อสร้าง tasks ถัดไปจากผลลัพธ์
  protected async createDownstreamTasks(
    completedTask: Task,
    result: Record<string, unknown>
  ): Promise<void> {}

  stop(): void {
    this.running = false;
    console.log(`🛑 Agent ${this.agentId} stopping...`);
  }
}
```

---

## 👷 ตัวอย่าง: Developer Agent

```typescript
// src/agents/developer-agent.ts
export class DeveloperAgent extends BaseAgent {
  constructor(queue: TaskQueue) {
    super('developer-agent', queue);
  }

  async processTask(task: Task): Promise<{ success: boolean; result?: any; blockerReason?: string }> {
    if (task.type !== TaskType.IMPLEMENT_SERVICE) {
      return { success: false, blockerReason: `Wrong task type: ${task.type}` };
    }

    const { serviceName, spec, targetDirectory } = task.payload;

    // ใช้ Claude เพื่อ implement
    const stream = await this.claude.messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: 8192,
      stream: true,
      messages: [{
        role: 'user',
        content: `อ่าน spec นี้และ implement service ตามที่กำหนด:

Service Name: ${serviceName}
Target Directory: ${targetDirectory}

Spec:
${JSON.stringify(spec, null, 2)}

กฎ:
1. สร้างไฟล์ทั้งหมดที่จำเป็น
2. เขียน unit tests ครอบคลุม happy path และ edge cases
3. รัน tests และแก้จนผ่านทั้งหมด
4. ถ้าต้องการ external service หรือ API key → report เป็น blocker
5. บันทึกสรุปว่าสร้างอะไรไปบ้าง

ถ้าเจอ blocker ตอบในรูปแบบ:
BLOCKED: [เหตุผล]

ถ้าเสร็จสมบูรณ์ตอบในรูปแบบ:
COMPLETED: [สรุป files ที่สร้าง]`
      }],
    });

    let fullResponse = '';
    for await (const chunk of stream) {
      if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
        fullResponse += chunk.delta.text;
      }
    }

    // Parse response
    if (fullResponse.startsWith('BLOCKED:')) {
      return {
        success: false,
        blockerReason: fullResponse.replace('BLOCKED:', '').trim(),
      };
    }

    if (fullResponse.startsWith('COMPLETED:')) {
      const summary = fullResponse.replace('COMPLETED:', '').trim();
      return {
        success: true,
        result: { summary, serviceName },
      };
    }

    // Unexpected response — retry
    return { success: false };
  }

  protected async createDownstreamTasks(completedTask: Task, result: any): Promise<void> {
    // หลัง implement เสร็จ → สร้าง review task อัตโนมัติ
    await this.queue.push({
      type: TaskType.REVIEW_CODE,
      priority: 1,
      status: TaskStatus.PENDING,
      maxRetries: 2,
      payload: {
        serviceName: result.serviceName,
        implementedBy: this.agentId,
        parentTaskId: completedTask.id,
      },
    });
  }
}
```

---

## 👁️ Human Oversight Dashboard

Real Engineer ต้องมีระบบ monitor ที่ดู agents ได้ง่าย:

```typescript
// src/dashboard/agent-status.ts
export async function getAgentDashboard(): Promise<AgentDashboard> {
  const [pending, inProgress, completed, blocked, failed] = await Promise.all([
    prisma.task.count({ where: { status: TaskStatus.PENDING } }),
    prisma.task.count({ where: { status: TaskStatus.IN_PROGRESS } }),
    prisma.task.count({ where: { status: TaskStatus.COMPLETED } }),
    prisma.task.count({ where: { status: TaskStatus.BLOCKED } }),
    prisma.task.count({ where: { status: TaskStatus.FAILED } }),
  ]);

  const blockedTasks = await prisma.task.findMany({
    where: { status: TaskStatus.BLOCKED },
    orderBy: { createdAt: 'asc' },
  });

  return { pending, inProgress, completed, blocked, failed, blockedTasks };
}
```

ผลลัพธ์ที่แสดงใน Terminal:

```
🤖 AGENT LOOP DASHBOARD — 09:15:32
════════════════════════════════════
📋 Pending:    12 tasks
⚙️  Running:    4 tasks (4 agents active)
✅ Completed:  47 tasks
🚧 Blocked:    2 tasks  ← ต้องการ Human
❌ Failed:     1 task

🚧 BLOCKERS REQUIRING HUMAN ACTION:
1. implement_service (auth-service)
   Reason: Need SMTP credentials for email verification
   Action: Add SMTP_HOST, SMTP_USER, SMTP_PASS to .env

2. run_migration (user-table-v2)
   Reason: Backup confirmation required before migration
   Action: Run /admin/confirm-migration/task-id-here

Press [U] to unblock task | [R] to retry failed | [Q] to quit
```

---

## 🔗 Multi-Agent Pipeline

```typescript
// src/orchestrator.ts — เริ่ม agents ทั้งหมด
import { AnalystAgent } from './agents/analyst-agent';
import { DeveloperAgent } from './agents/developer-agent';
import { ReviewerAgent } from './agents/reviewer-agent';
import { TestAgent } from './agents/test-agent';

async function startAgentPipeline() {
  const queue = new TaskQueue(prisma);

  // สร้าง agents
  const agents = [
    new AnalystAgent(queue),
    new DeveloperAgent(queue),
    new DeveloperAgent(queue), // 2 developers ทำงานคู่ขนาน
    new ReviewerAgent(queue),
    new TestAgent(queue),
  ];

  // เติม initial tasks
  await queue.push({
    type: TaskType.ANALYZE_MODULE,
    priority: 1,
    status: TaskStatus.PENDING,
    maxRetries: 3,
    payload: {
      targetDirectory: './src',
      goal: 'Extract and list all modules that should become independent microservices',
    },
  });

  console.log(`🚀 Starting ${agents.length} agents...`);

  // รัน agents คู่ขนาน
  await Promise.all(agents.map(agent => agent.start()));
}

startAgentPipeline().catch(console.error);
```

---

## 💻 Hands-On: สร้าง Agent Loop สำหรับ Code Documentation

**โจทย์:** สร้าง Agent ที่วนอ่านทุกไฟล์ใน `src/` แล้วสร้าง JSDoc อัตโนมัติ

```bash
claude
```

```
"ช่วยสร้าง Autonomous Agent Loop สำหรับสร้าง JSDoc documentation:

Architecture:
1. Scanner Agent: อ่านทุก .ts ไฟล์ใน src/ แล้วสร้าง task สำหรับแต่ละไฟล์
2. Documenter Agent: รับ task แต่ละไฟล์ เพิ่ม JSDoc ให้ทุก function ที่ขาด
3. Validator Agent: ตรวจว่า JSDoc ที่เพิ่มถูกต้องและครบถ้วน

Task Queue: ใช้ SQLite ผ่าน Prisma (lightweight สำหรับ local)
Error handling: retry 3 ครั้ง ถ้า fail → mark blocked + log
Progress: แสดง progress bar และ ETA

สร้าง:
- prisma/schema.prisma สำหรับ Task model
- src/agents/scanner-agent.ts
- src/agents/documenter-agent.ts
- src/agents/validator-agent.ts
- src/orchestrator.ts
- README สำหรับ setup และ run"
```

---

## 🎯 สรุปบทที่ 11

| หัวข้อ | สิ่งที่ต้องจำ |
|--------|--------------|
| Agent Loop vs Ralph Loop | หลาย agents คู่ขนาน vs 1 session sequential |
| Task Queue | Database-backed queue ป้องกัน duplicate processing |
| BaseAgent | Core loop ที่ pull → process → report → loop |
| Downstream Tasks | Agent เสร็จแล้วสร้าง task ถัดไปอัตโนมัติ |
| Human Oversight | Monitor dashboard + Slack alerts สำหรับ Blockers |
| Blocker Pattern | Agent หยุดรอ Human แทนที่จะเดาหรือล้มเหลว |

---

## 📋 Action Items ก่อนไปบทที่ 12

- [ ] ออกแบบ Task Schema สำหรับงาน automation ที่คุณมีอยู่
- [ ] สร้าง Task Queue แบบ minimal (SQLite ก็พอสำหรับเริ่มต้น)
- [ ] implement BaseAgent และ Agent Loop เดี่ยว 1 ตัวก่อน
- [ ] ลองรัน Documentation Agent กับ codebase จริงของคุณ

---

*ใน **บทที่ 12** ซึ่งเป็นบทปิด Volume 1 เราจะสรุป **The 10x Engineer Manifesto** — หลักการทั้งหมดที่คุณได้เรียนรู้ตลอด 12 บท และวิธีนำทุกอย่างมาใช้ร่วมกันเพื่อกลายเป็น "Real AI Engineer" ที่แท้จริงครับ*
