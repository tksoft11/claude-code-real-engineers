// .github/scripts/ai-review/agents/security.agent.ts
import Anthropic from '@anthropic-ai/sdk';

export interface SecurityIssue {
  severity: 'critical' | 'high' | 'medium' | 'low';
  type: string;
  description: string;
  line?: string;
  fix?: string;
}

export async function runSecurityAgent(
  diff: string,
  model: string
): Promise<SecurityIssue[]> {
  const client = new Anthropic();

  const response = await client.messages.create({
    model,
    max_tokens: 1500,
    system: `คุณคือ Application Security Expert วิเคราะห์ code diff หา vulnerabilities:

OWASP Top 10:
- SQL/Command Injection (A03)
- Broken Authentication (A07)
- Sensitive Data Exposure (A02)
- XSS, CSRF (A03)
- Hardcoded secrets, API keys
- Insecure dependencies
- Path traversal

ตอบ JSON array เท่านั้น:
[{"severity":"critical|high|medium|low","type":"ชื่อ vulnerability","description":"อธิบาย","line":"line ที่น่าสนใจ","fix":"วิธีแก้ไข"}]
ถ้าไม่พบปัญหา: []`,
    messages: [{
      role: 'user',
      content: `วิเคราะห์ security ใน diff นี้:\n\n${diff.slice(0, 12000)}`,
    }],
  });

  const text = response.content[0].type === 'text' ? response.content[0].text : '[]';
  try {
    const match = text.match(/\[[\s\S]*\]/);
    return match ? JSON.parse(match[0]) : [];
  } catch {
    return [];
  }
}
