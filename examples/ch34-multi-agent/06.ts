// generate-report.ts
import { generateExecutiveReport } from './src/orchestrator/report.orchestrator';
import fs from 'fs';
import 'dotenv/config';

async function main() {
  const quarter = process.argv[2] || '2025-Q4';

  const result = await generateExecutiveReport({
    quarter,
    repoIds: ['repo-main', 'repo-api', 'repo-frontend'],
    dbConnection: process.env.DATABASE_URL || '',
  });

  if (!result.success) {
    console.error(`\n❌ Report generation failed`);
    console.error(`Failed agents: ${result.failedAgents.join(', ')}`);
    process.exit(1);
  }

  // บันทึก report
  const filename = `report-${quarter}-${Date.now()}.md`;
  fs.writeFileSync(filename, result.report!);

  console.log(`\n📄 Report saved: ${filename}`);
  console.log(`\n--- Report Preview ---`);
  console.log(result.report!.slice(0, 500) + '...');

  // แสดง agent stats
  console.log(`\n--- Agent Performance ---`);
  for (const [name, r] of Object.entries(result.agentResults)) {
    const status = r.success ? '✅' : '❌';
    console.log(`${status} ${name}: ${r.durationMs}ms, ${r.tokensUsed} tokens`);
  }
}

main().catch(console.error);
