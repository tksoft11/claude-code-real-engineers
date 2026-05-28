# บทที่ 37: Database Migration Safety — วิเคราะห์ Migration SQL ก่อน Deploy ด้วย AI

---

## 💀 วันที่ Production พัง เพราะ Migration ธรรมดาบรรทัดเดียว

ทีม Backend ของบริษัท FinTech push migration เช้าวันจันทร์:

```sql
ALTER TABLE users DROP COLUMN legacy_token;
```

ดูไม่มีอะไรผิด — `legacy_token` มันไม่ได้ใช้แล้วนี่

**สิ่งที่เกิดขึ้นหลัง deploy:**
```
09:15 AM — Migration run สำเร็จ ✅
09:17 AM — Error spike: "column legacy_token does not exist"
09:18 AM — ตรวจสอบ: Mobile App เวอร์ชัน 3.2.1 ยังใช้ column นี้อยู่
09:19 AM — Users 40,000 คน login ไม่ได้
09:45 AM — Rollback เสร็จ (26 นาทีของความโกลาหล)
```

ปัญหาไม่ใช่ว่า Dev ประมาท — ปัญหาคือ **ไม่มีระบบอัตโนมัติที่ grep codebase และบอกว่า "column นี้ยังถูกใช้อยู่"**

บทนี้เราจะสร้างระบบนั้น

---

## 🏗️ Architecture: Migration Safety Pipeline

```
Developer writes migration SQL
            │
            ▼
    [Migration Safety Agent]
       ┌────┴────┐
       ▼         ▼
 [SQL Analyzer] [Codebase Scanner]
  วิเคราะห์ว่า   grep หา references
  migration ทำ   ของ tables/columns
  อะไรบ้าง       ที่จะถูก modify
       └────┬────┘
            ▼
    [Risk Assessor]
   ประเมิน risk level
   + สร้าง rollback plan
            │
            ▼
   Report + Rollback SQL
   (ก่อน deploy จริง)
```

---

## 📁 Project Structure

```
.github/
├── workflows/
│   └── migration-safety.yml
└── scripts/
    └── migration-safety/
        ├── index.ts              ← Entry point
        ├── sql-analyzer.ts       ← Parse + analyze migration SQL
        ├── codebase-scanner.ts   ← Grep references in source code
        ├── risk-assessor.ts      ← AI risk assessment + rollback gen
        └── package.json
```

---

## 📋 GitHub Actions Workflow

```yaml
# .github/workflows/migration-safety.yml
name: Database Migration Safety Check

on:
  pull_request:
    paths:
      - 'migrations/**'
      - 'db/migrate/**'
      - '**/*migration*.sql'

jobs:
  migration-safety:
    name: Analyze Migration Safety
    runs-on: ubuntu-latest
    timeout-minutes: 8

    permissions:
      pull-requests: write
      contents: read

    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
          cache-dependency-path: '.github/scripts/migration-safety/package.json'

      - name: Install dependencies
        working-directory: .github/scripts/migration-safety
        run: npm ci

      - name: Find changed migration files
        id: find-migrations
        run: |
          FILES=$(git diff --name-only origin/${{ github.base_ref }}...HEAD \
            | grep -E '\.(sql)$|migration' | tr '\n' ',')
          echo "files=$FILES" >> $GITHUB_OUTPUT
          echo "Found migrations: $FILES"

      - name: Run Migration Safety Analysis
        working-directory: .github/scripts/migration-safety
        env:
          ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          MIGRATION_FILES: ${{ steps.find-migrations.outputs.files }}
          REPO_ROOT: ${{ github.workspace }}
          PR_NUMBER: ${{ github.event.pull_request.number }}
          REPO: ${{ github.repository }}
        run: npx ts-node index.ts
```

---

## 🔍 SQL Analyzer — อ่าน Migration แล้วบอกว่า "ทำอะไร"

```typescript
// .github/scripts/migration-safety/sql-analyzer.ts
import Anthropic from '@anthropic-ai/sdk';

export interface MigrationOperation {
  type: 'DROP_TABLE' | 'DROP_COLUMN' | 'RENAME_TABLE' | 'RENAME_COLUMN'
      | 'ALTER_COLUMN' | 'ADD_COLUMN' | 'CREATE_TABLE' | 'ADD_INDEX' | 'OTHER';
  table: string;
  column?: string;
  details: string;
  riskLevel: 'critical' | 'high' | 'medium' | 'low';
}

export async function analyzeMigrationSQL(
  sql: string
): Promise<MigrationOperation[]> {
  const client = new Anthropic();

  const response = await client.messages.create({
    model: 'claude-sonnet-4-5',
    max_tokens: 2000,
    system: `คุณคือ Database Expert วิเคราะห์ Migration SQL และระบุทุก operation ที่เกิดขึ้น

กำหนด riskLevel:
- critical: DROP TABLE, DROP COLUMN, RENAME TABLE/COLUMN (breaking changes)
- high: ALTER COLUMN type change, NOT NULL constraint เพิ่ม
- medium: ADD COLUMN with default, ADD INDEX (locks table ชั่วคราว)  
- low: ADD COLUMN nullable, CREATE TABLE ใหม่

ตอบ JSON array เท่านั้น:
[{
  "type": "DROP_COLUMN",
  "table": "users",
  "column": "legacy_token",
  "details": "ลบ column legacy_token ออกจาก users table",
  "riskLevel": "critical"
}]`,
    messages: [{
      role: 'user',
      content: `วิเคราะห์ migration นี้:\n\n${sql}`,
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

## 🔎 Codebase Scanner — Grep หา References ที่จะ Break

นี่คือ **หัวใจสำคัญ** ของระบบ — grep ดิบๆ เร็วกว่า AI ราคาถูกกว่า ใช้ AI แค่ตอนสรุปผล

```typescript
// .github/scripts/migration-safety/codebase-scanner.ts
import { execSync } from 'child_process';
import { MigrationOperation } from './sql-analyzer';

export interface CodeReference {
  file: string;
  line: number;
  content: string;
  matchType: 'column' | 'table';
}

export function scanCodebaseForReferences(
  operations: MigrationOperation[],
  repoRoot: string
): Map<string, CodeReference[]> {
  const results = new Map<string, CodeReference[]>();

  // เฉพาะ critical/high risk operations เท่านั้น
  const riskyOps = operations.filter(op =>
    ['critical', 'high'].includes(op.riskLevel)
  );

  for (const op of riskyOps) {
    const key = `${op.table}.${op.column || '*'}`;
    const refs: CodeReference[] = [];

    // Grep patterns ที่ครอบคลุม ORM + raw SQL + string references
    const patterns: { pattern: string; matchType: 'column' | 'table' }[] = [];

    if (op.column) {
      patterns.push(
        { pattern: op.column, matchType: 'column' },
        // Rails/ActiveRecord style
        { pattern: `:${op.column}`, matchType: 'column' },
        // Python/SQLAlchemy style
        { pattern: `"${op.column}"`, matchType: 'column' },
      );
    }

    patterns.push({ pattern: op.table, matchType: 'table' });

    for (const { pattern, matchType } of patterns) {
      try {
        const grepResult = execSync(
          `grep -rn --include="*.ts" --include="*.js" --include="*.py" \
           --include="*.rb" --include="*.go" --include="*.php" \
           --exclude-dir=node_modules --exclude-dir=.git \
           --exclude-dir=dist --exclude-dir=vendor \
           "${pattern}" ${repoRoot} 2>/dev/null || true`,
          { encoding: 'utf-8', maxBuffer: 5 * 1024 * 1024 }
        );

        if (grepResult.trim()) {
          const lines = grepResult.trim().split('\n');
          for (const line of lines.slice(0, 50)) { // cap ที่ 50 matches
            const match = line.match(/^(.+):(\d+):(.+)$/);
            if (match) {
              refs.push({
                file: match[1].replace(repoRoot, ''),
                line: parseInt(match[2]),
                content: match[3].trim(),
                matchType,
              });
            }
          }
        }
      } catch {
        // grep ไม่เจอ = ดี, ข้ามได้
      }
    }

    if (refs.length > 0) {
      results.set(key, refs);
    }
  }

  return results;
}
```

---

## 🤖 Risk Assessor — AI ประเมิน Risk และสร้าง Rollback Plan

```typescript
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
```

---

## 🚀 Main Entry Point

```typescript
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
  lines.push('```sql');
  lines.push(report.rollbackSQL);
  lines.push('```');
  lines.push('');

  // Pre-deploy checklist
  if (report.checklist?.length > 0) {
    lines.push('### ✅ Pre-Deploy Checklist');
    report.checklist.forEach((item: string) => lines.push(item));
    lines.push('');
  }

  lines.push('---');
  lines.push('_🤖 Migration Safety Agent • Powered by Claude Sonnet_');

  return lines.join('\n');
}

main().catch(err => {
  console.error('Migration Safety failed:', err.message);
  process.exit(1);
});
```

---

## 🧪 ตัวอย่าง Output — เมื่อเจอ Breaking Change

สมมติ developer submit migration นี้:

```sql
-- migrations/20240115_cleanup_users.sql
ALTER TABLE users DROP COLUMN legacy_token;
ALTER TABLE sessions RENAME TO user_sessions;
```

**Output ที่ได้ใน PR:**

```
🔴 Database Migration Safety — CRITICAL Risk

พบ 2 breaking changes: DROP COLUMN และ RENAME TABLE
มี code references ที่จะ break ทั้งหมด 23 จุด

📋 Operations Detected
| Risk     | Type         | Table    | Details                        |
|----------|--------------|----------|--------------------------------|
| 🔴 critical | DROP_COLUMN | users    | ลบ column legacy_token         |
| 🔴 critical | RENAME_TABLE | sessions | เปลี่ยนชื่อเป็น user_sessions |

⚠️ Code References Found (อาจ Break)
`users.legacy_token` — 8 reference(s):
- `src/auth/token.service.ts:47` — `user.legacy_token = generateToken()`
- `src/mobile/sync.controller.ts:112` — `SELECT legacy_token FROM users`
- `app/models/user.rb:23` — `validates :legacy_token, presence: true`
- ...และอีก 5 references

`sessions.*` — 15 reference(s):
- `src/middleware/auth.ts:31` — `FROM sessions WHERE token = ?`
- ...

🚨 Breaking Changes
- Mobile App ที่ยังไม่ได้ update จะ login ไม่ได้ทันที
- sessions table rename จะทำให้ queries ทั้งหมด fail
- ต้องทำ zero-downtime migration strategy

💡 Deployment Strategy
- ใช้ expand-contract pattern: เพิ่ม column ใหม่ก่อน ค่อย drop ของเก่า
- Deploy code ใหม่ให้รองรับทั้ง 2 ชื่อ table ก่อน rename
- ต้องมี feature flag ปิด legacy_token path ก่อน drop

⏪ Rollback Plan
-- Rollback: เพิ่ม column กลับ (ข้อมูลหายแล้ว!)
ALTER TABLE users ADD COLUMN legacy_token VARCHAR(255);
-- Rollback: rename กลับ
ALTER TABLE user_sessions RENAME TO sessions;
```

---

## 🛡️ Expand-Contract Pattern — วิธีที่ถูกต้อง

เมื่อ AI บอกว่ามี breaking changes ให้ใช้ pattern นี้แทน:

```sql
-- ❌ อย่าทำแบบนี้ (drop ทันที)
ALTER TABLE users DROP COLUMN legacy_token;

-- ✅ ทำแบบนี้ (3-phase migration)

-- Phase 1: Expand (deploy พร้อม code ที่ไม่ใช้ column แล้ว)
-- ยังไม่ทำอะไร — แค่ deploy code ใหม่ที่ไม่ write ค่าลง legacy_token

-- Phase 2: Verify (รอ 1-2 สัปดาห์ ดู metrics)
SELECT COUNT(*) FROM users WHERE legacy_token IS NOT NULL;
-- ถ้า = 0 แล้ว ค่อยไป Phase 3

-- Phase 3: Contract (drop เมื่อมั่นใจ 100%)
ALTER TABLE users DROP COLUMN legacy_token;
```

---

## ⚙️ Package Setup

```json
{
  "name": "migration-safety",
  "version": "1.0.0",
  "scripts": {
    "check": "ts-node index.ts",
    "check:local": "MIGRATION_FILES=migrations/test.sql REPO_ROOT=../../.. ts-node index.ts"
  },
  "dependencies": {
    "@anthropic-ai/sdk": "^0.39.0",
    "@octokit/rest": "^21.0.0"
  },
  "devDependencies": {
    "typescript": "^5.0.0",
    "ts-node": "^10.0.0",
    "@types/node": "^20.0.0"
  }
}
```

---

## 🧪 ทดสอบ Local

```bash
# สร้าง test migration
cat > /tmp/test.sql << 'EOF'
ALTER TABLE users DROP COLUMN phone_number;
ALTER TABLE orders ADD COLUMN discount_code VARCHAR(50);
EOF

# ทดสอบ
cd .github/scripts/migration-safety
ANTHROPIC_API_KEY=sk-ant-... \
GITHUB_TOKEN=ghp_... \
MIGRATION_FILES=/tmp/test.sql \
REPO_ROOT=/path/to/your/project \
PR_NUMBER=999 \
REPO=myorg/myrepo \
npx ts-node index.ts

# ดู rollback SQL ที่ generate
cat /tmp/rollback.sql
```

---

## 🎯 สรุปบทที่ 37

| Component | หน้าที่ |
|-----------|---------|
| `migration-safety.yml` | Trigger เมื่อมีไฟล์ migration เปลี่ยน |
| `sql-analyzer.ts` | AI แยกแยะทุก operation + กำหนด risk level |
| `codebase-scanner.ts` | Grep ดิบ หา references ที่จะ break (เร็ว+ถูก) |
| `risk-assessor.ts` | AI ประเมิน overall risk + สร้าง rollback SQL |
| `index.ts` | Orchestrate ทุกอย่าง + post PR comment |

**สูตรที่ทำให้ได้ผล:** ใช้ grep สำหรับ **ค้นหา** (เร็ว/ถูก) ใช้ AI สำหรับ **ตีความและสรุป** (แม่นยำ) — ไม่ต้องให้ AI ทำทุกอย่างเอง

---

## 📋 Action Items ก่อนไปบทที่ 38

- [ ] Deploy `migration-safety.yml` ใน repo หลัก
- [ ] ทดสอบกับ migration จริงที่ผ่านมาแล้ว — ดูว่า AI จับ breaking changes เดิมได้ไหม
- [ ] เพิ่ม language patterns ใน `codebase-scanner.ts` ตามภาษาที่ team ใช้
- [ ] ตั้ง policy: CRITICAL risk = ต้อง approve จาก DBA ก่อน merge
- [ ] สร้าง runbook: เมื่อ migration พัง production ทำขั้นตอนอะไร

*ใน **บทที่ 38** เราจะเข้าสู่การพัฒนาโมบายแอปพลิเคชันด้วย Mobile AI Architecture — สถาปัตยกรรมแอปพลิเคชันมือถือที่ถูกต้องเพื่อซ่อนคีย์โมเดลไว้บนเซิร์ฟเวอร์มิดเดิลแวร์อย่างปลอดภัยครับ*
