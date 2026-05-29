// .github/scripts/ai-review/index.ts
import { Octokit } from '@octokit/rest';
import fs from 'fs';
import 'dotenv/config';
import { runSecurityAgent } from './agents/security.agent';
import { runStyleAgent } from './agents/style.agent';
import { runLogicAgent } from './agents/logic.agent';
import { buildReviewComment } from './formatter';

const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });
const [owner, repo] = (process.env.REPO || '/').split('/');
const prNumber = parseInt(process.env.PR_NUMBER || '0');
const model = process.env.AI_MODEL || 'claude-haiku-4-5';
const diff = fs.readFileSync(process.env.DIFF_PATH || '/tmp/pr.diff', 'utf-8');

async function main() {
  if (!diff.trim()) {
    console.log('Empty diff, skipping AI review');
    return;
  }

  const diffLines = diff.split('\n').length;
  console.log(`🔍 AI Review: PR #${prNumber} | ${diffLines} lines | ${model}`);

  const startTime = Date.now();

  // รัน 3 agents parallel
  console.log('Running Security + Style + Logic agents in parallel...');
  const [security, style, logic] = await Promise.all([
    runSecurityAgent(diff, model),
    runStyleAgent(diff, model),
    runLogicAgent(
      process.env.PR_TITLE || '',
      process.env.PR_BODY || '',
      diff,
      model
    ),
  ]);

  const durationMs = Date.now() - startTime;

  console.log(`✅ Analysis complete in ${(durationMs/1000).toFixed(1)}s`);
  console.log(`   Security: ${security.length} issues`);
  console.log(`   Style: ${style.length} suggestions`);
  console.log(`   Logic: ${logic.criticalIssues.length} critical, ${logic.suggestions.length} suggestions`);

  // Build review comment
  const review = buildReviewComment(security, style, logic, { model, durationMs, diffLines });

  // Post comment
  await octokit.issues.createComment({
    owner, repo, issue_number: prNumber, body: review.body,
  });

  // Set review status
  await octokit.pulls.createReview({
    owner, repo, pull_number: prNumber,
    event: review.shouldBlock ? 'REQUEST_CHANGES' : 'COMMENT',
    body: review.shouldBlock
      ? `🤖 AI Review: Found ${security.filter(i => ['critical','high'].includes(i.severity)).length} critical/high security issue(s). Please fix before merging.`
      : `🤖 AI Review complete. Risk level: ${review.riskLevel}`,
  });

  // บันทึก result
  fs.writeFileSync('/tmp/ai-review-result.json', JSON.stringify({
    prNumber, riskLevel: review.riskLevel, shouldBlock: review.shouldBlock,
    securityCount: security.length, styleCount: style.length,
    logicCritical: logic.criticalIssues.length, model, durationMs,
  }, null, 2));

  console.log(`\n📊 Result: ${review.riskLevel} | Block: ${review.shouldBlock}`);
  process.exit(review.shouldBlock ? 1 : 0);
}

main().catch(err => {
  console.error('AI Review failed:', err.message);
  process.exit(1);
});
