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
