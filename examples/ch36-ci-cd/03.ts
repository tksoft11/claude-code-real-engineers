// .github/scripts/ai-review/agents/style.agent.ts
import Anthropic from '@anthropic-ai/sdk';

export async function runStyleAgent(diff: string, model: string): Promise<string[]> {
  const client = new Anthropic();
  const response = await client.messages.create({
    model: 'claude-haiku-4-5', // Style check ใช้ Haiku เสมอ (ถูก+เร็ว)
    max_tokens: 800,
    system: `ตรวจ code style เท่านั้น:
- Naming conventions (camelCase, PascalCase ตามภาษา)
- Function/method ที่ยาวเกิน 50 บรรทัด
- Magic numbers ที่ควรเป็น constants
- Missing JSDoc/docstrings สำหรับ public functions
- Dead code, commented-out code
ตอบ JSON array: ["issue1", "issue2"] หรือ []`,
    messages: [{ role: 'user', content: diff.slice(0, 8000) }],
  });

  const text = response.content[0].type === 'text' ? response.content[0].text : '[]';
  try {
    const match = text.match(/\[[\s\S]*\]/);
    return match ? JSON.parse(match[0]) : [];
  } catch { return []; }
}

// .github/scripts/ai-review/agents/logic.agent.ts
export interface LogicReview {
  criticalIssues: string[];
  suggestions: string[];
  positives: string[];
  overallAssessment: string;
}

export async function runLogicAgent(
  title: string,
  description: string,
  diff: string,
  model: string
): Promise<LogicReview> {
  const client = new Anthropic();
  const response = await client.messages.create({
    model, // Logic ใช้ model ที่ถูกเลือกตาม PR size
    max_tokens: 2000,
    system: `คุณคือ Senior Software Engineer วิเคราะห์ logic ของ code change:
- Edge cases ที่อาจ miss
- Race conditions หรือ concurrency issues
- Performance implications
- Breaking changes ที่ไม่ได้ระบุใน PR description
- ทิศทาง implementation ถูกต้องตาม PR intent ไหม
ตอบ JSON: {"criticalIssues":[...],"suggestions":[...],"positives":[...],"overallAssessment":"..."}`,
    messages: [{
      role: 'user',
      content: `PR: ${title}\n${description}\n\nDiff:\n${diff.slice(0, 10000)}`,
    }],
  });

  const text = response.content[0].type === 'text' ? response.content[0].text : '{}';
  try {
    const match = text.match(/\{[\s\S]*\}/);
    return match ? JSON.parse(match[0]) : {
      criticalIssues: [], suggestions: [], positives: [], overallAssessment: 'Unable to analyze'
    };
  } catch {
    return { criticalIssues: [], suggestions: [], positives: [], overallAssessment: '' };
  }
}
