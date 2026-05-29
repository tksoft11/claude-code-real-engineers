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
