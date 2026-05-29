// ประมาณ cost ก่อน run
function estimateCost(diffLines: number, model: string): number {
  const tokensPerLine = 15;
  const inputTokens = diffLines * tokensPerLine * 3; // x3 สำหรับ 3 agents

  const pricing: Record<string, { input: number; output: number }> = {
    'claude-haiku-4-5':  { input: 0.00025, output: 0.00125 },
    'claude-sonnet-4-5': { input: 0.003,   output: 0.015   },
    'claude-opus-4-5':   { input: 0.015,   output: 0.075   },
  };

  const p = pricing[model] || pricing['claude-haiku-4-5'];
  return (inputTokens / 1000) * p.input + (2000 / 1000) * p.output;
}

// สรุป cost ต่อเดือน:
// 50 PRs/วัน × 500 lines average × claude-sonnet-4-5
// ≈ $0.23/PR × 50 × 30 = ~$345/เดือน
// เทียบกับ Tech Lead 2 ชั่วโมง/วัน = ราคาถูกกว่ามาก
