# บทที่ 28: [Hands-on] The Assertion Loop & Bug Hunter

---

## 🪝 วิธีแก้ Bug ที่ทำให้วิศวกรเสียเวลาที่สุด

วงจรที่เกิดซ้ำทุกวัน:

```
1. รัน tests → ❌ 3 tests fail
2. อ่าน error → เปิด file → แก้โค้ด
3. รัน tests → ❌ ยังอีก 2 tests fail (อันใหม่!)
4. แก้อีก... → รัน... → แก้อีก...
5. ใช้เวลา 45 นาทีสำหรับ bug ที่ดูง่าย
```

**Assertion Loop** ทำให้ AI วิ่งวงจรนี้แทนคุณ:

```
Claude แก้โค้ด → รัน tests → fail? → ส่ง error ให้ Claude → Claude แก้ → รัน tests → ...
ทำซ้ำจนกว่า tests ผ่านทั้งหมด — โดยที่คุณไม่ต้องนั่งรอ
```

---

## 🔄 The Assertion Loop Architecture

```
┌────────────────────────────────────────────────────────┐
│                  Assertion Loop                        │
│                                                        │
│  [Context: โค้ด + tests + error history]               │
│         ↓                                              │
│  Claude generates fix → Apply to files                 │
│         ↓                                              │
│  Run test suite → Parse results                        │
│         ↓                              ↓               │
│    All pass? ──── NO ──→ Extract failures              │
│         │                    ↓                         │
│        YES           Send to Claude (next iteration)   │
│         ↓                                              │
│    ✅ Done! Report changes made                        │
│                                                        │
│  Max iterations: 5 (ป้องกัน infinite loop)             │
└────────────────────────────────────────────────────────┘
```

---

## 🧪 Step 1: Test Runner Module

```typescript
// src/bug-hunter/test-runner.ts
import { execSync } from 'child_process';
import path from 'path';

export interface TestResult {
  passed: number;
  failed: number;
  total: number;
  failures: TestFailure[];
  duration: number;
  rawOutput: string;
}

export interface TestFailure {
  testName: string;
  filePath: string;
  errorMessage: string;
  stackTrace?: string;
}

export function runTests(projectDir: string, testCommand = 'npm test'): TestResult {
  const startTime = Date.now();
  let rawOutput = '';

  try {
    rawOutput = execSync(testCommand, {
      cwd: projectDir,
      encoding: 'utf-8',
      timeout: 60000,
      env: { ...process.env, CI: 'true' },
    });
  } catch (error: any) {
    // Test failures throw non-zero exit code
    rawOutput = error.stdout + '\n' + error.stderr;
  }

  const duration = Date.now() - startTime;
  return {
    ...parseTestOutput(rawOutput),
    duration,
    rawOutput,
  };
}

function parseTestOutput(output: string): Omit<TestResult, 'duration' | 'rawOutput'> {
  const failures: TestFailure[] = [];

  // Parse Vitest/Jest format
  const failureBlocks = output.match(/FAIL .+[\s\S]+?(?=PASS|FAIL|$)/g) || [];

  for (const block of failureBlocks) {
    const fileMatch = block.match(/FAIL (.+\.test\.[tj]s)/);
    const testMatches = block.matchAll(/● (.+)\n([\s\S]+?)(?=●|$)/g);

    for (const match of testMatches) {
      failures.push({
        testName: match[1].trim(),
        filePath: fileMatch?.[1] || 'unknown',
        errorMessage: match[2].trim().slice(0, 500),
      });
    }
  }

  // Parse summary line: "Tests: 3 failed, 7 passed, 10 total"
  const summaryMatch = output.match(/Tests:\s+(?:(\d+) failed,\s+)?(\d+) passed(?:,\s+(\d+) total)?/);
  const failed = parseInt(summaryMatch?.[1] || '0');
  const passed = parseInt(summaryMatch?.[2] || '0');
  const total = parseInt(summaryMatch?.[3] || String(passed + failed));

  return { passed, failed: failures.length || failed, total, failures };
}
```

---

## 🤖 Step 2: Bug Hunter Agent

```typescript
// src/bug-hunter/bug-hunter.ts
import Anthropic from '@anthropic-ai/sdk';
import fs from 'fs';
import path from 'path';
import { runTests, TestResult, TestFailure } from './test-runner';

const client = new Anthropic();

export interface HuntResult {
  success: boolean;
  iterations: number;
  filesModified: string[];
  finalTestResult: TestResult;
  summary: string;
}

export async function huntBugs(
  projectDir: string,
  targetFiles: string[],
  testCommand = 'npm test',
  maxIterations = 5
): Promise<HuntResult> {
  const filesModified = new Set<string>();
  let iteration = 0;
  let lastResult: TestResult = runTests(projectDir, testCommand);

  console.log(`\n🔍 Bug Hunter started`);
  console.log(`Initial: ${lastResult.passed} passed, ${lastResult.failed} failed\n`);

  if (lastResult.failed === 0) {
    return {
      success: true, iterations: 0, filesModified: [],
      finalTestResult: lastResult, summary: 'No bugs found! All tests passing.',
    };
  }

  // อ่านโค้ดที่ต้องการ debug
  const codeContext = targetFiles
    .filter(f => fs.existsSync(path.join(projectDir, f)))
    .map(f => {
      const content = fs.readFileSync(path.join(projectDir, f), 'utf-8');
      return `\`\`\`typescript\n// ${f}\n${content}\n\`\`\``;
    })
    .join('\n\n');

  // Message history สำหรับ multi-turn
  const messages: Anthropic.MessageParam[] = [];

  while (iteration < maxIterations && lastResult.failed > 0) {
    iteration++;
    console.log(`\n🔄 Iteration ${iteration}/${maxIterations}`);
    console.log(`   Failed tests: ${lastResult.failed}`);

    const failureSummary = formatFailures(lastResult.failures);

    // สร้าง prompt ตาม iteration
    const userContent = iteration === 1
      ? buildInitialPrompt(codeContext, failureSummary)
      : buildRetryPrompt(failureSummary, iteration);

    messages.push({ role: 'user', content: userContent });

    // ให้ Claude วิเคราะห์และแก้ไข
    const response = await client.messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: 8192,
      system: `คุณคือ Expert Bug Fixer
วิเคราะห์ test failures และแก้ไขโค้ดให้ tests ผ่าน
ตอบด้วย format:

ANALYSIS: [วิเคราะห์สาเหตุ bug]

FIX:
\`\`\`typescript:path/to/file.ts
[โค้ดที่แก้ไขแล้ว — เต็ม file เท่านั้น ไม่ใช่แค่ snippet]
\`\`\`

หลักการ:
- แก้ root cause ไม่ใช่แค่ทำให้ test ผ่าน
- ห้ามลบ tests หรือ hardcode values
- อธิบายสิ่งที่แก้ไขใน ANALYSIS`,
      messages,
    });

    const assistantText = response.content[0].type === 'text' ? response.content[0].text : '';
    messages.push({ role: 'assistant', content: assistantText });

    // Extract และ apply code fixes
    const fixes = extractCodeFixes(assistantText);

    if (fixes.length === 0) {
      console.log('   ⚠️  No code changes extracted from response');
      break;
    }

    for (const fix of fixes) {
      const fullPath = path.join(projectDir, fix.filepath);
      if (fix.filepath.includes('..') || !fix.filepath.match(/\.(ts|js|tsx|jsx|py)$/)) {
        console.log(`   ⚠️  Skipping suspicious path: ${fix.filepath}`);
        continue;
      }
      fs.writeFileSync(fullPath, fix.code, 'utf-8');
      filesModified.add(fix.filepath);
      console.log(`   ✏️  Applied fix to: ${fix.filepath}`);
    }

    // รัน tests อีกครั้ง
    lastResult = runTests(projectDir, testCommand);
    console.log(`   Results: ✅ ${lastResult.passed} passed, ❌ ${lastResult.failed} failed`);
  }

  const success = lastResult.failed === 0;
  const summary = success
    ? `✅ All tests passing after ${iteration} iteration(s). Modified: ${[...filesModified].join(', ')}`
    : `❌ ${lastResult.failed} test(s) still failing after ${iteration} iteration(s)`;

  console.log(`\n${summary}`);

  return {
    success, iterations: iteration,
    filesModified: [...filesModified],
    finalTestResult: lastResult, summary,
  };
}

function buildInitialPrompt(codeContext: string, failures: string): string {
  return `ช่วยแก้ test failures ต่อไปนี้:

## Code
${codeContext}

## Test Failures
${failures}

วิเคราะห์ root cause และแก้ไขโค้ด`;
}

function buildRetryPrompt(failures: string, iteration: number): string {
  return `ยังมี test failures หลังจากการแก้ไขครั้งที่ ${iteration - 1}:

## Remaining Failures
${failures}

แก้ไขต่อ — ตรวจสอบว่าการแก้ไขก่อนหน้าสร้างปัญหาใหม่ไหม`;
}

function formatFailures(failures: TestFailure[]): string {
  return failures.slice(0, 10).map(f =>
    `**${f.testName}** (${f.filePath})\n${f.errorMessage}`
  ).join('\n\n---\n\n');
}

interface CodeFix {
  filepath: string;
  code: string;
}

function extractCodeFixes(text: string): CodeFix[] {
  const fixes: CodeFix[] = [];
  const regex = /```(?:typescript|javascript|python|ts|js|py):([^\n]+)\n([\s\S]+?)```/g;
  let match;

  while ((match = regex.exec(text)) !== null) {
    fixes.push({
      filepath: match[1].trim(),
      code: match[2],
    });
  }

  return fixes;
}
```

---

## 🖥️ Step 3: CLI Interface

```typescript
// bug-hunter-cli.ts
import { huntBugs } from './src/bug-hunter/bug-hunter';
import path from 'path';

async function main() {
  const projectDir = process.argv[2] || process.cwd();
  const targetFiles = process.argv.slice(3);

  if (targetFiles.length === 0) {
    console.log('Usage: ts-node bug-hunter-cli.ts [project-dir] [file1] [file2] ...');
    console.log('Example: ts-node bug-hunter-cli.ts . src/utils.ts src/api.ts');
    process.exit(1);
  }

  console.log(`🎯 Project: ${projectDir}`);
  console.log(`📁 Target files: ${targetFiles.join(', ')}`);

  const result = await huntBugs(
    projectDir,
    targetFiles,
    'npm test -- --run',
    5
  );

  console.log('\n📊 Final Report:');
  console.log(`   Success: ${result.success ? '✅' : '❌'}`);
  console.log(`   Iterations: ${result.iterations}`);
  console.log(`   Files modified: ${result.filesModified.join(', ') || 'none'}`);
  console.log(`   Tests: ${result.finalTestResult.passed} passed, ${result.finalTestResult.failed} failed`);
  console.log(`\n${result.summary}`);

  process.exit(result.success ? 0 : 1);
}

main().catch(console.error);
```

---

## 🧪 ทดสอบกับ Bug จริง

```bash
# สร้าง test ที่ fail ตั้งใจ
cat > src/calculator.ts << 'EOF'
export function add(a: number, b: number): number {
  return a - b; // Bug: ควรเป็น +
}
export function multiply(a: number, b: number): number {
  return a + b; // Bug: ควรเป็น *
}
EOF

cat > src/calculator.test.ts << 'EOF'
import { add, multiply } from './calculator';
test('add 2+3 should be 5', () => expect(add(2, 3)).toBe(5));
test('multiply 4*5 should be 20', () => expect(multiply(4, 5)).toBe(20));
EOF

# รัน Bug Hunter
ts-node bug-hunter-cli.ts . src/calculator.ts

# Output:
# 🔍 Bug Hunter started
# Initial: 0 passed, 2 failed
#
# 🔄 Iteration 1/5
#    Failed tests: 2
#    ✏️  Applied fix to: src/calculator.ts
#    Results: ✅ 2 passed, ❌ 0 failed
#
# ✅ All tests passing after 1 iteration(s)
```

---

## 🔗 Integration: Claude Code + Bug Hunter

```bash
# ใน CLAUDE.md เพิ่ม custom command
cat >> .claude/commands/fix-tests.md << 'EOF'
---
description: Run Bug Hunter to fix failing tests automatically
---

รัน: ts-node ~/bug-hunter/bug-hunter-cli.ts . $ARGUMENTS
แล้วรายงานผลลัพธ์
EOF

# ใช้งานจาก Claude Code
claude
# /fix-tests src/payment.service.ts src/payment.service.test.ts
```

---

## 🎯 สรุปบทที่ 28

| ส่วนประกอบ | หน้าที่ |
|-----------|--------|
| test-runner.ts | รัน tests + parse output เป็น structured failures |
| bug-hunter.ts | Multi-turn conversation + apply fixes + re-run |
| Code extraction | Parse ```typescript:filepath blocks จาก Claude |
| Max iterations | ป้องกัน infinite loop (default: 5) |
| Security | path validation — ห้ามแก้ไข files นอก project |

**กุญแจสำคัญ:** ส่ง error message + stack trace + โค้ดทั้งหมด ไม่ใช่แค่ "test fail" — Claude ต้องเห็น context ครบเพื่อแก้ได้ถูก

---

## 📋 Action Items ก่อนไปบทที่ 29

- [ ] Build Bug Hunter และรันกับ project จริง
- [ ] ทดสอบกับ failing tests อย่างน้อย 5 รายการ
- [ ] วัด success rate: Claude แก้ได้กี่ % ใน iteration แรก
- [ ] เพิ่ม support สำหรับ pytest (Python projects)
- [ ] Integrate กับ CI/CD: รัน Bug Hunter อัตโนมัติเมื่อ tests fail

---

*ใน **บทที่ 29** เราจะปิด Volume 2 ด้วย Capstone Project: The AI-Powered SaaS Backend — รวม Streaming + Tool Use + RAG + Structured Output + Bug Hunter ในโปรเจกต์เดียวที่ production-ready ครับ*
