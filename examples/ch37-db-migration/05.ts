// .github/scripts/migration-safety/index.ts
import { Octokit } from '@octokit/rest';
import fs from 'fs';
import path from 'path';
import { analyzeMigrationSQL } from './sql-analyzer';
import { scanCodebaseForReferences } from './codebase-scanner';
import { assessRiskAndGenerateRollback } from './risk-assessor';

const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });
const [owner, repo] = (process.env.REPO || '/').split('/');
const prNumber = parseInt(process.env.PR_NUMBER || '0');
const repoRoot = process.env.REPO_ROOT || '.';
const migrationFiles = (process.env.MIGRATION_FILES || '').split(',').filter(Boolean);

async function main() {
  if (migrationFiles.length === 0) {
    console.log('No migration files found, skipping.');
    return;
  }

  console.log(`🔍 Analyzing ${migrationFiles.length} migration file(s)...`);

  let allOperations = [];
  let allSQL = '';

  // อ่านและวิเคราะห์ทุก migration file
  for (const file of migrationFiles) {
    const fullPath = path.join(repoRoot, file.trim());
    if (!fs.existsSync(fullPath)) continue;

    const sql = fs.readFileSync(fullPath, 'utf-8');
    allSQL += `\n-- File: ${file}\n${sql}\n`;

    console.log(`  Parsing: ${file}`);
    const ops = await analyzeMigrationSQL(sql);
    allOperations.push(...ops);
  }

  console.log(`  Found ${allOperations.length} operations`);

  // Grep codebase หา references
  console.log('🔎 Scanning codebase for references...');
  const codeRefs = scanCodebaseForReferences(allOperations, repoRoot);
  console.log(`  Found references in ${codeRefs.size} operation(s)`);

  // AI Risk assessment + rollback generation
  console.log('🤖 AI risk assessment...');
  const report = await assessRiskAndGenerateRollback(allSQL, allOperations, codeRefs);

  // Build PR comment
  const comment = buildComment(report, allOperations, codeRefs);

  // Post comment
  await octokit.issues.createComment({
    owner, repo, issue_number: prNumber, body: comment,
  });

  // Block PR ถ้า CRITICAL
  if (report.shouldBlock) {
    await octokit.pulls.createReview({
      owner, repo, pull_number: prNumber,
      event: 'REQUEST_CHANGES',
      body: `🛑 Migration Safety: ${report.overallRisk} risk detected. Please review before merging.`,
    });
  }

  // บันทึก rollback SQL เป็น artifact
  fs.writeFileSync('/tmp/rollback.sql', report.rollbackSQL);
  console.log(`\n📊 Risk: ${report.overallRisk} | Block: ${report.shouldBlock}`);
  process.exit(report.shouldBlock ? 1 : 0);
}

function buildComment(
  report: any,
  operations: any[],
  codeRefs: Map<string, any[]>
): string {
  const riskEmoji: Record<string, string> = {
    CRITICAL: '🔴', HIGH: '🟠', MEDIUM: '🟡', LOW: '🟢', SAFE: '✅'
  };

  const lines: string[] = [
    `## ${riskEmoji[report.overallRisk]} Database Migration Safety — ${report.overallRisk} Risk`,
    '',
    report.summary,
    '',
  ];

  // Operations summary
  lines.push('### 📋 Operations Detected');
  lines.push('| Risk | Type | Table | Details |');
  lines.push('|------|------|-------|---------|');
  for (const op of operations) {
    const e = op.riskLevel === 'critical' ? '🔴' :
              op.riskLevel === 'high' ? '🟠' :
              op.riskLevel === 'medium' ? '🟡' : '🟢';
    lines.push(`| ${e} ${op.riskLevel} | ${op.type} | \`${op.table}\` | ${op.details} |`);
  }
  lines.push('');

  // Code references ที่พบ
  if (codeRefs.size > 0) {
    lines.push('### ⚠️ Code References Found (อาจ Break)');
    for (const [key, refs] of codeRefs.entries()) {
      lines.push(`\n**\`${key}\`** — ${refs.length} reference(s):`);
      refs.slice(0, 3).forEach(r => {
        lines.push(`- \`${r.file}:${r.line}\` — \`${r.content.slice(0, 80)}\``);
      });
      if (refs.length > 3) lines.push(`- _...และอีก ${refs.length - 3} references_`);
    }
    lines.push('');
  }

  // Breaking changes
  if (report.breakingChanges?.length > 0) {
    lines.push('### 🚨 Breaking Changes');
    report.breakingChanges.forEach((c: string) => lines.push(`- ${c}`));
    lines.push('');
  }

  // Deployment recommendations
  if (report.deploymentRecommendations?.length > 0) {
    lines.push('### 💡 Deployment Strategy');
    report.deploymentRecommendations.forEach((r: string) => lines.push(`- ${r}`));
    lines.push('');
  }

  // Rollback SQL
  lines.push('### ⏪ Rollback Plan');
  lines.push('