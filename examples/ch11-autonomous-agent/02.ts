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
