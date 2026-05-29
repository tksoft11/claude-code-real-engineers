// src/utils/alerting.ts
export async function escalateToHuman(
  error: Error,
  context: Record<string, unknown> = {}
) {
  const alert = {
    severity: 'HIGH',
    script: process.env.SCRIPT_NAME || 'unknown-script',
    error: {
      message: error.message,
      stack: error.stack?.split('\n').slice(0, 5).join('\n'), // 5 บรรทัดแรก
    },
    environment: {
      node: process.version,
      pid: process.pid,
      uptime: `${Math.round(process.uptime())}s`,
      memory: `${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`,
    },
    lastAutoFixAttempt: context.autoFixAction || 'none',
    timestamp: new Date().toISOString(),
    ...context,
  };

  // ส่ง Slack notification
  await sendSlack({
    channel: '#alerts-critical',
    text: `🚨 *Script Alert: ${alert.script}*\n` +
          `Error: ${alert.error.message}\n` +
          `Auto-fix attempted: ${alert.lastAutoFixAttempt}\n` +
          `Environment: Node ${alert.environment.node}, Memory: ${alert.environment.memory}\n` +
          `Time: ${alert.timestamp}`,
  });

  // บันทึก log เต็มรูปแบบ
  logger.error('Script escalated to human', alert);
}
