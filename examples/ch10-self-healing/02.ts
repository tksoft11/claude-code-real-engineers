// main.ts
async function main() {
  console.log('🔍 Validating environment...');
  const validation = await validateEnvironment();

  if (validation.autoFixed.length > 0) {
    logger.info('Auto-fixed issues:', validation.autoFixed);
    await notify.slack(`🔧 Script auto-fixed ${validation.autoFixed.length} issues before starting`);
  }

  if (!validation.passed) {
    logger.error('Environment validation failed:', validation.issues);
    await notify.pagerduty('Script cannot start — environment issues', validation.issues);
    process.exit(1);
  }

  // ทำงานได้อย่างปลอดภัยแล้ว
  await runMainTask();
}
