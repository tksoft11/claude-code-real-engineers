function checkCircuitBreaker(
  results: Record<string, AgentResult>,
  threshold = 0.5 // fail ได้ไม่เกิน 50%
): void {
  const total = Object.keys(results).length;
  const failed = Object.values(results).filter(r => !r.success).length;

  if (failed / total > threshold) {
    throw new Error(
      `Circuit breaker triggered: ${failed}/${total} agents failed. ` +
      `Aborting pipeline to prevent partial/incorrect report.`
    );
  }
}
