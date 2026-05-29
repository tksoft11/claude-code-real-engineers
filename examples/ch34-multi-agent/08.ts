// ป้องกัน Prompt Injection ระหว่าง agents
function sanitizeAgentOutput(output: string): string {
  return output
    .replace(/ignore previous instructions/gi, '[FILTERED]')
    .replace(/you are now a/gi, '[FILTERED]')
    .replace(/system prompt:/gi, '[FILTERED]')
    .replace(/<\/?system>/gi, '[FILTERED]');
}

// ใช้ใน Synthesizer ก่อนส่ง data จาก agents อื่น
const safeFinanceData = sanitizeAgentOutput(JSON.stringify(financeResult.data));
