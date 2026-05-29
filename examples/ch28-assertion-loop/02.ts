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
  const regex = /