// .github/scripts/migration-safety/risk-assessor.ts
import Anthropic from '@anthropic-ai/sdk';
import { MigrationOperation } from './sql-analyzer';
import { CodeReference } from './codebase-scanner';

export interface SafetyReport {
  overallRisk: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'SAFE';
  shouldBlock: boolean;
  summary: string;
  breakingChanges: string[];
  deploymentRecommendations: string[];
  rollbackSQL: string;
  checklist: string[];
}

export async function assessRiskAndGenerateRollback(
  originalSQL: string,
  operations: MigrationOperation[],
  codeRefs: Map<string, CodeReference[]>
): Promise<SafetyReport> {
  const client = new Anthropic();

  // สร้าง context สำหรับ AI
  const refsContext = Array.from(codeRefs.entries())
    .map(([key, refs]) => {
      const samples = refs.slice(0, 5).map(r => `  ${r.file}:${r.line} → ${r.content}`);
      return `${key} (${refs.length} references):\n${samples.join('\n')}`;
    })
    .join('\n\n');

  const opsContext = operations.map(op =>
    `[${op.riskLevel.toUpperCase()}] ${op.type}: ${op.details}`
  ).join('\n');

  const response = await client.messages.create({
    model: 'claude-sonnet-4-5',
    max_tokens: 3000,
    system: `คุณคือ Database Safety Expert ประเมิน risk ของ database migration และสร้าง rollback plan

หน้าที่:
1. ประเมิน overall risk จาก operations + code references ที่พบ
2. ระบุ breaking changes ที่ชัดเจน
3. แนะนำ deployment strategy (Blue-Green, Feature Flag, etc.)
4. สร้าง rollback SQL ที่ถูกต้อง
5. สร้าง pre-deploy checklist

ตอบ JSON เท่านั้น:
{
  "overallRisk": "CRITICAL|HIGH|MEDIUM|LOW|SAFE",
  "shouldBlock": true/false,
  "summary": "สรุปสั้น",
  "breakingChanges": ["..."],
  "deploymentRecommendations": ["..."],
  "rollbackSQL": "-- Rollback SQL\nALTER TABLE...",
  "checklist": ["[ ] ตรวจสอบ..."]
}`,
    messages: [{
      role: 'user',
      content: `Migration SQL:
\`\`\`sql
${originalSQL}
\`\`\`

Operations detected:
${opsContext}

Code references found:
${refsContext || 'ไม่พบ references ใน codebase'}`,
    }],
  });

  const text = response.content[0].type === 'text' ? response.content[0].text : '{}';
  try {
    const match = text.match(/\{[\s\S]*\}/);
    return match ? JSON.parse(match[0]) : buildFallbackReport();
  } catch {
    return buildFallbackReport();
  }
}

function buildFallbackReport(): SafetyReport {
  return {
    overallRisk: 'HIGH',
    shouldBlock: true,
    summary: 'ไม่สามารถวิเคราะห์ได้ — กรุณา review manual',
    breakingChanges: ['Unable to analyze automatically'],
    deploymentRecommendations: ['Manual review required'],
    rollbackSQL: '-- Manual rollback required',
    checklist: ['[ ] Review migration manually before deploying'],
  };
}
