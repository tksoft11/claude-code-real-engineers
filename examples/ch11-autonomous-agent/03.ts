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
