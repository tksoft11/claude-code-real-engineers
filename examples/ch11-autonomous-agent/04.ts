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
