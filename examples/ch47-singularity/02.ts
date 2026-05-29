// scripts/ai-health-check.ts
// รันก่อน deploy ทุกครั้งเพื่อตรวจสอบความพร้อม

import * as fs from 'fs';
import * as path from 'path';
import Anthropic from '@anthropic-ai/sdk';

interface HealthCheckResult {
  passed: boolean;
  checks: { name: string; status: 'ok' | 'fail' | 'warn'; message: string }[];
}

async function runHealthCheck(): Promise<HealthCheckResult> {
  const results: HealthCheckResult['checks'] = [];

  // 1. ตรวจสอบ API Key
  if (!process.env.ANTHROPIC_API_KEY) {
    results.push({ name: 'API Key', status: 'fail', message: 'ANTHROPIC_API_KEY not set' });
  } else if (process.env.ANTHROPIC_API_KEY.startsWith('sk-ant-')) {
    results.push({ name: 'API Key', status: 'ok', message: 'API Key format looks correct' });
  } else {
    results.push({ name: 'API Key', status: 'warn', message: 'API Key format is unusual' });
  }

  // 2. ตรวจสอบ .env ไม่ถูก commit
  const gitignorePath = path.join(process.cwd(), '.gitignore');
  if (fs.existsSync(gitignorePath)) {
    const gitignore = fs.readFileSync(gitignorePath, 'utf8');
    if (gitignore.includes('.env')) {
      results.push({ name: '.env in .gitignore', status: 'ok', message: '.env is properly ignored' });
    } else {
      results.push({ name: '.env in .gitignore', status: 'fail', message: '.env is NOT in .gitignore! Security risk!' });
    }
  }

  // 3. ตรวจสอบ CLAUDE.md
  if (fs.existsSync(path.join(process.cwd(), 'CLAUDE.md'))) {
    results.push({ name: 'CLAUDE.md', status: 'ok', message: 'Project rules file exists' });
  } else {
    results.push({ name: 'CLAUDE.md', status: 'warn', message: 'No CLAUDE.md found — consider adding AI rules' });
  }

  // 4. ทดสอบ Claude API connectivity
  try {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const response = await client.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 10,
      messages: [{ role: 'user', content: 'Say "OK" only' }]
    });
    if (response.content[0].type === 'text') {
      results.push({ name: 'API Connectivity', status: 'ok', message: `Connected to Claude (${response.model})` });
    }
  } catch (error) {
    results.push({
      name: 'API Connectivity',
      status: 'fail',
      message: `Cannot connect to Claude API: ${error instanceof Error ? error.message : 'Unknown error'}`
    });
  }

  // 5. ตรวจสอบ Hardcoded Secrets ในโค้ด
  const srcDir = path.join(process.cwd(), 'src');
  if (fs.existsSync(srcDir)) {
    const secretPatterns = [/sk-ant-api[0-9a-zA-Z]/g, /sk-[a-zA-Z0-9]{48}/g];
    let foundSecrets = false;

    const checkDir = (dir: string) => {
      for (const file of fs.readdirSync(dir)) {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);
        if (stat.isDirectory()) {
          checkDir(filePath);
        } else if (file.endsWith('.ts') || file.endsWith('.js')) {
          const content = fs.readFileSync(filePath, 'utf8');
          for (const pattern of secretPatterns) {
            if (pattern.test(content)) {
              foundSecrets = true;
              console.error(`🚨 Found potential secret in: ${filePath}`);
            }
          }
        }
      }
    };

    checkDir(srcDir);
    results.push({
      name: 'Hardcoded Secrets Scan',
      status: foundSecrets ? 'fail' : 'ok',
      message: foundSecrets ? 'Found potential secrets in code!' : 'No hardcoded secrets detected'
    });
  }

  const allPassed = results.every(r => r.status !== 'fail');
  return { passed: allPassed, checks: results };
}

// Main
async function main() {
  console.log('🏥 Running AI Health Check...\n');
  const result = await runHealthCheck();

  for (const check of result.checks) {
    const icon = check.status === 'ok' ? '✅' : check.status === 'warn' ? '⚠️' : '❌';
    console.log(`${icon} ${check.name}: ${check.message}`);
  }

  console.log('\n' + (result.passed ? '✅ All checks passed!' : '❌ Health check failed!'));
  process.exit(result.passed ? 0 : 1);
}

main().catch(console.error);
