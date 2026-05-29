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
