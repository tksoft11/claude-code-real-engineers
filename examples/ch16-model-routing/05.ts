// src/billing/cost-dashboard.ts
export async function getCostDashboard(): Promise<CostReport> {
  const today = new Date().toISOString().split('T')[0];
  const month = today.slice(0, 7);

  const [dailyCost, monthlyCost] = await Promise.all([
    redis.get(`spend:daily:${today}`),
    redis.get(`spend:monthly:${month}`),
  ]);

  const daily   = parseFloat(dailyCost || '0');
  const monthly = parseFloat(monthlyCost || '0');

  return {
    daily: {
      spent: daily,
      limit: LIMITS.daily,
      percentUsed: (daily / LIMITS.daily) * 100,
      remaining: Math.max(0, LIMITS.daily - daily),
      status: daily > LIMITS.daily * 0.9 ? 'critical' :
              daily > LIMITS.daily * 0.7 ? 'warning' : 'ok',
    },
    monthly: {
      spent: monthly,
      limit: LIMITS.monthly,
      percentUsed: (monthly / LIMITS.monthly) * 100,
      remaining: Math.max(0, LIMITS.monthly - monthly),
      status: monthly > LIMITS.monthly * 0.9 ? 'critical' :
              monthly > LIMITS.monthly * 0.7 ? 'warning' : 'ok',
    },
  };
}
