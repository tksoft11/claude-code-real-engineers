// เพิ่มใน metrics.ts
export const fallbackCounter = new Counter({
  name: 'ai_fallback_total',
  help: 'Number of times fallback providers were used',
  labelNames: ['from_provider', 'to_provider'] as const,
});

export const circuitBreakerState = new Gauge({
  name: 'ai_circuit_breaker_state',
  help: '0=CLOSED, 1=OPEN, 2=HALF_OPEN',
  labelNames: ['provider'] as const,
});
