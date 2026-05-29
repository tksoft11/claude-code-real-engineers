async function runWithTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  agentName: string
): Promise<T> {
  const timeout = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error(`${agentName} timed out after ${timeoutMs}ms`)), timeoutMs)
  );
  return Promise.race([promise, timeout]);
}

// ใช้งาน
const financeResult = await runWithTimeout(
  financeAgent.run({ quarter, dbConnection }),
  30_000, // 30 seconds max
  'FinanceAgent'
);
