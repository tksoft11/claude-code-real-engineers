// .github/scripts/ai-review/formatter.ts
import { SecurityIssue } from './agents/security.agent';
import { LogicReview } from './agents/logic.agent';

type RiskLevel = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'CLEAN';

export function buildReviewComment(
  security: SecurityIssue[],
  style: string[],
  logic: LogicReview,
  meta: { model: string; durationMs: number; diffLines: number }
): { body: string; riskLevel: RiskLevel; shouldBlock: boolean } {

  const criticalSecurity = security.filter(i => i.severity === 'critical' || i.severity === 'high');
  const riskLevel: RiskLevel =
    criticalSecurity.length > 0 ? 'CRITICAL' :
    logic.criticalIssues.length > 0 ? 'HIGH' :
    security.length > 0 ? 'MEDIUM' :
    (style.length > 0 || logic.suggestions.length > 0) ? 'LOW' : 'CLEAN';

  const riskEmoji: Record<RiskLevel, string> = {
    CRITICAL: '🔴', HIGH: '🟠', MEDIUM: '🟡', LOW: '🟢', CLEAN: '✅'
  };

  const shouldBlock = riskLevel === 'CRITICAL' || riskLevel === 'HIGH';

  const sections: string[] = [
    `## ${riskEmoji[riskLevel]} AI Code Review — ${riskLevel} Risk`,
    '',
  ];

  if (criticalSecurity.length > 0) {
    sections.push('### 🔐 Security Issues (Action Required)');
    for (const issue of criticalSecurity) {
      sections.push(`**[${issue.severity.toUpperCase()}] ${issue.type}**`);
      sections.push(`> ${issue.description}`);
      if (issue.line) sections.push(`> 📍 Near: \`${issue.line}\``);
      if (issue.fix)  sections.push(`> 💡 Fix: ${issue.fix}`);
      sections.push('');
    }
  }

  const lowSecurity = security.filter(i => i.severity === 'medium' || i.severity === 'low');
  if (lowSecurity.length > 0) {
    sections.push('### ⚠️ Security Suggestions');
    sections.push(...lowSecurity.map(i => `- **${i.type}:** ${i.description}`));
    sections.push('');
  }

  if (logic.criticalIssues.length > 0) {
    sections.push('### 🚨 Logic Issues');
    sections.push(...logic.criticalIssues.map(i => `- ${i}`));
    sections.push('');
  }

  if (style.length > 0) {
    sections.push(`### 📝 Style Suggestions (${style.length})`);
    sections.push(...style.slice(0, 5).map(s => `- ${s}`));
    if (style.length > 5) sections.push(`- _...and ${style.length - 5} more_`);
    sections.push('');
  }

  if (logic.suggestions.length > 0) {
    sections.push('### 💡 Improvement Suggestions');
    sections.push(...logic.suggestions.slice(0, 3).map(s => `- ${s}`));
    sections.push('');
  }

  if (logic.positives.length > 0) {
    sections.push('### 👍 Good Practices Observed');
    sections.push(...logic.positives.slice(0, 3).map(p => `- ${p}`));
    sections.push('');
  }

  if (logic.overallAssessment) {
    sections.push('### 📋 Overall Assessment');
    sections.push(logic.overallAssessment);
    sections.push('');
  }

  sections.push('---');
  sections.push(`_🤖 AI Review • Model: ${meta.model} • Time: ${(meta.durationMs/1000).toFixed(1)}s • Diff: ${meta.diffLines} lines_`);

  return { body: sections.join('\n'), riskLevel, shouldBlock };
}
