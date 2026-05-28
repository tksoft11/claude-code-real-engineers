# บทที่ 36: AI in CI/CD (GitHub Actions) — Automated Code Review + Security Scan

---

## 🪝 Review ที่รอได้ vs Review ที่รอไม่ได้

ทีม Engineering ของบริษัท SaaS มี culture ดีมาก — ทุก PR ต้อง review ก่อน merge

แต่มีปัญหาหนึ่ง: เมื่อ Developer submit PR ตอน 11 PM ก่อน demo วันรุ่งขึ้น

**วงจรที่เกิดซ้ำ:**
```
11:00 PM — Dev push PR "urgent fix before demo"
 8:30 AM — Tech Lead เริ่มอ่าน PR (9.5 ชั่วโมงต่อมา)
 9:15 AM — Tech Lead เจอ SQL injection ใน line 47
 9:20 AM — Dev แก้ไข push ใหม่
 9:45 AM — Review รอบ 2 complete
10:00 AM — Demo เริ่ม (15 นาทีก่อน demo เพิ่งผ่าน review!)
```

หลังจาก setup **AI Code Review ใน GitHub Actions:**
```
11:00 PM — Dev push PR "urgent fix before demo"
11:03 PM — AI Review complete: "Found 1 SQL injection in line 47"
11:10 PM — Dev แก้ไขเอง (AI บอกชัดว่า line ไหน เป็นอะไร)
11:13 PM — AI Review รอบ 2: ✅ All clear
 8:30 AM — Tech Lead review PR ที่สะอาดแล้ว ผ่านใน 10 นาที
```

AI ไม่ได้แทน human reviewer — AI เป็น **first pass** ที่จับปัญหาพื้นฐานได้ทันที ทำให้ human reviewer focus ที่ logic และ architecture แทน

---

## 🏗️ Architecture ของ AI Review Pipeline

```
Developer pushes PR
         │
         ▼
GitHub Actions triggered (on: pull_request)
         │
    ┌────┴────┐
    │         │
    ▼         ▼
[Tests]   [AI Review Pipeline]
              │
    ┌─────────┼─────────┐
    ▼         ▼         ▼
[Security] [Style]  [Logic]   ← 3 Agents รัน parallel
Agent      Agent    Agent
    └─────────┼─────────┘
              ▼
        [Aggregator]
              │
              ▼
    Post comment on PR
    Set review status (APPROVE / REQUEST_CHANGES)
    Output cost report
```

---

## 📁 Project Structure

```
.github/
├── workflows/
│   └── ai-review.yml          ← GitHub Actions workflow
└── scripts/
    └── ai-review/
        ├── index.ts            ← Entry point
        ├── agents/
        │   ├── security.agent.ts
        │   ├── style.agent.ts
        │   └── logic.agent.ts
        ├── github.client.ts    ← GitHub API wrapper
        └── formatter.ts        ← Review comment builder
```

---

## 📋 GitHub Actions Workflow

```yaml
# .github/workflows/ai-review.yml
name: AI Code Review

on:
  pull_request:
    types: [opened, synchronize, reopened]
    branches: [main, develop, 'release/**']

# ป้องกัน run ซ้อนกัน
concurrency:
  group: ai-review-${{ github.event.pull_request.number }}
  cancel-in-progress: true

jobs:
  ai-review:
    name: AI Code Review
    runs-on: ubuntu-latest
    timeout-minutes: 10

    permissions:
      pull-requests: write
      contents: read

    steps:
      - name: Checkout repository
        uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
          cache-dependency-path: '.github/scripts/ai-review/package.json'

      - name: Install AI review dependencies
        working-directory: .github/scripts/ai-review
        run: npm ci

      - name: Calculate PR diff size
        id: pr-size
        run: |
          LINES=$(git diff origin/${{ github.base_ref }}...HEAD | wc -l)
          echo "diff_lines=$LINES" >> $GITHUB_OUTPUT
          echo "PR diff size: $LINES lines"

      - name: Select AI model based on PR size
        id: model-select
        run: |
          LINES=${{ steps.pr-size.outputs.diff_lines }}
          if [ "$LINES" -gt 3000 ]; then
            echo "model=claude-haiku-4-5" >> $GITHUB_OUTPUT
            echo "reason=Large PR (${LINES} lines): using Haiku for cost control" >> $GITHUB_OUTPUT
          elif [ "$LINES" -gt 1000 ]; then
            echo "model=claude-sonnet-4-5" >> $GITHUB_OUTPUT
            echo "reason=Medium PR (${LINES} lines): using Sonnet" >> $GITHUB_OUTPUT
          else
            echo "model=claude-sonnet-4-5" >> $GITHUB_OUTPUT
            echo "reason=Small PR (${LINES} lines): using Sonnet" >> $GITHUB_OUTPUT
          fi
          echo "${{ steps.model-select.outputs.reason }}"

      - name: Generate AI diff
        run: |
          git diff origin/${{ github.base_ref }}...HEAD > /tmp/pr.diff
          echo "Diff generated: $(wc -c < /tmp/pr.diff) bytes"

      - name: Run AI Code Review
        working-directory: .github/scripts/ai-review
        env:
          ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          PR_NUMBER: ${{ github.event.pull_request.number }}
          PR_TITLE: ${{ github.event.pull_request.title }}
          PR_BODY: ${{ github.event.pull_request.body }}
          PR_AUTHOR: ${{ github.event.pull_request.user.login }}
          REPO: ${{ github.repository }}
          AI_MODEL: ${{ steps.model-select.outputs.model }}
          DIFF_PATH: /tmp/pr.diff
        run: npx ts-node index.ts

      - name: Upload review artifacts
        uses: actions/upload-artifact@v4
        if: always()
        with:
          name: ai-review-${{ github.event.pull_request.number }}
          path: /tmp/ai-review-result.json
          retention-days: 30
```

---

## 🤖 Security Agent

```typescript
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
```

---

## 🤖 Style & Logic Agents

```typescript
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
```

---

## 📝 Review Comment Formatter

```typescript
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
```

---

## 🚀 Main Entry Point

```typescript
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
```

---

## 💰 Cost Control Strategy

```typescript
// ประมาณ cost ก่อน run
function estimateCost(diffLines: number, model: string): number {
  const tokensPerLine = 15;
  const inputTokens = diffLines * tokensPerLine * 3; // x3 สำหรับ 3 agents

  const pricing: Record<string, { input: number; output: number }> = {
    'claude-haiku-4-5':  { input: 0.00025, output: 0.00125 },
    'claude-sonnet-4-5': { input: 0.003,   output: 0.015   },
    'claude-opus-4-5':   { input: 0.015,   output: 0.075   },
  };

  const p = pricing[model] || pricing['claude-haiku-4-5'];
  return (inputTokens / 1000) * p.input + (2000 / 1000) * p.output;
}

// สรุป cost ต่อเดือน:
// 50 PRs/วัน × 500 lines average × claude-sonnet-4-5
// ≈ $0.23/PR × 50 × 30 = ~$345/เดือน
// เทียบกับ Tech Lead 2 ชั่วโมง/วัน = ราคาถูกกว่ามาก
```

---

## ⚙️ Package Setup สำหรับ Actions

```json
// .github/scripts/ai-review/package.json
{
  "name": "ai-review",
  "version": "1.0.0",
  "scripts": {
    "review": "ts-node index.ts",
    "review:local": "DIFF_PATH=./test.diff PR_NUMBER=1 REPO=owner/repo ts-node index.ts"
  },
  "dependencies": {
    "@anthropic-ai/sdk": "^0.39.0",
    "@octokit/rest": "^21.0.0",
    "dotenv": "^16.0.0"
  },
  "devDependencies": {
    "typescript": "^5.0.0",
    "ts-node": "^10.0.0",
    "@types/node": "^20.0.0"
  }
}
```

---

## 🧪 ทดสอบ Local ก่อน Commit

```bash
# สร้าง diff จาก branch ปัจจุบัน
git diff main...HEAD > test.diff

# ทดสอบโดยตรง
cd .github/scripts/ai-review
npm install
ANTHROPIC_API_KEY=sk-ant-... \
GITHUB_TOKEN=ghp_... \
PR_NUMBER=999 \
PR_TITLE="Fix payment bug" \
REPO=myorg/myrepo \
DIFF_PATH=./test.diff \
AI_MODEL=claude-haiku-4-5 \
npx ts-node index.ts

# ดูผล (ไม่ post จริง ถ้าไม่มี valid PR number)
cat /tmp/ai-review-result.json
```

---

## 🎯 สรุปบทที่ 36

| Component | หน้าที่ |
|-----------|--------|
| `ai-review.yml` | Trigger on PR, select model by size, run review |
| Security Agent (Sonnet) | OWASP Top 10 scan, severity classification |
| Style Agent (Haiku เสมอ) | Naming, complexity, docs — ไม่ต้องการ model แพง |
| Logic Agent (dynamic) | Edge cases, race conditions, implementation review |
| formatter.ts | Build structured comment + determine block/approve |
| Cost Control | Haiku สำหรับ large PR, estimate ก่อนรัน |

**กุญแจสำคัญ:** AI Review **ไม่แทน** human review — มันคือ first pass ที่จับปัญหาพื้นฐานใน 3 นาที ทำให้ human reviewer ใช้เวลากับสิ่งที่สำคัญกว่า

---

## 📋 Action Items ก่อนไปบทที่ 37

- [ ] สร้าง fine-grained GitHub token เฉพาะ `pull-requests: write` + `contents: read`
- [ ] เพิ่ม `ANTHROPIC_API_KEY` ใน GitHub Repository Secrets
- [ ] Copy workflow + scripts เข้า repo แล้วทดสอบกับ PR จริง
- [ ] วัด cost จริงในสัปดาห์แรก เทียบกับ budget
- [ ] ปรับ threshold: ควร block เฉพาะ critical/high security หรือรวม logic ด้วย?

---

*ใน **บทที่ 37** เราจะเรียนรู้เกี่ยวกับ Safe Database Migration with AI — ระบบที่วิเคราะห์ migration SQL ก่อน deploy, grep codebase หา references ที่อาจ break, และ generate rollback plan อัตโนมัติครับ*
