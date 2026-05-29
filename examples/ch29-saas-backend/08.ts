// src/routes/analytics.ts
router.get('/today', async (req, res) => {
  // ดึง analytics จาก database
  const stats = await prisma.ticketLog.groupBy({
    by: ['category', 'urgency'],
    _count: true,
    where: {
      createdAt: { gte: new Date(new Date().setHours(0,0,0,0)) }
    },
  });

  const tokenUsage = await prisma.apiLog.aggregate({
    _sum: { inputTokens: true, outputTokens: true },
    where: { createdAt: { gte: new Date(new Date().setHours(0,0,0,0)) } },
  });

  res.json({
    date: new Date().toISOString().split('T')[0],
    ticketStats: stats,
    tokenUsage: tokenUsage._sum,
    estimatedCost: ((tokenUsage._sum.inputTokens || 0) * 0.000003)
                 + ((tokenUsage._sum.outputTokens || 0) * 0.000015),
  });
});
