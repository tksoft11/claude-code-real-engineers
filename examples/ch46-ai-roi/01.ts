// tools/roi-reporter/anthropicUsage.ts
import axios from 'axios';

interface UsageSummary {
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCostUSD: number;
  byModel: Record<string, { input: number; output: number; costUSD: number }>;
}

// ราคาต่อ 1,000 tokens (อัปเดตตามราคาจริงเสมอ)
const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  'claude-haiku-4-5':  { input: 0.00025, output: 0.00125 },
  'claude-sonnet-4-5': { input: 0.003,   output: 0.015   },
  'claude-opus-4-5':   { input: 0.015,   output: 0.075   },
};

export async function fetchAnthropicUsage(
  startDate: string, // YYYY-MM-DD
  endDate: string
): Promise<UsageSummary> {
  // Anthropic Admin API — ต้องใช้ Admin Key ไม่ใช่ API Key ปกติ
  const ADMIN_KEY = process.env.ANTHROPIC_ADMIN_KEY;
  if (!ADMIN_KEY) {
    console.warn('ANTHROPIC_ADMIN_KEY not set. Using estimated cost instead.');
    // Fallback: ใช้ค่าประมาณจาก environment variable
    const estimatedCostUSD = parseFloat(process.env.ESTIMATED_MONTHLY_COST_USD || '150');
    return {
      totalInputTokens: 0,
      totalOutputTokens: 0,
      totalCostUSD: estimatedCostUSD,
      byModel: {}
    };
  }

  try {
    const response = await axios.get('https://api.anthropic.com/v1/usage', {
      headers: {
        'x-api-key': ADMIN_KEY,
        'anthropic-version': '2023-06-01'
      },
      params: { start_time: startDate, end_time: endDate }
    });

    const usage = response.data;
    const summary: UsageSummary = {
      totalInputTokens: 0,
      totalOutputTokens: 0,
      totalCostUSD: 0,
      byModel: {}
    };

    // สรุปการใช้งานแยกตาม Model
    for (const entry of usage.data || []) {
      const model = entry.model as string;
      const inputTokens = entry.input_tokens || 0;
      const outputTokens = entry.output_tokens || 0;
      const pricing = MODEL_PRICING[model] || { input: 0.003, output: 0.015 };
      const costUSD = (inputTokens / 1000) * pricing.input + (outputTokens / 1000) * pricing.output;

      summary.totalInputTokens += inputTokens;
      summary.totalOutputTokens += outputTokens;
      summary.totalCostUSD += costUSD;

      if (!summary.byModel[model]) {
        summary.byModel[model] = { input: 0, output: 0, costUSD: 0 };
      }
      summary.byModel[model].input += inputTokens;
      summary.byModel[model].output += outputTokens;
      summary.byModel[model].costUSD += costUSD;
    }

    return summary;
  } catch (error) {
    console.error('Failed to fetch Anthropic usage:', error);
    // Fallback เมื่อ API ใช้งานไม่ได้
    return {
      totalInputTokens: 0,
      totalOutputTokens: 0,
      totalCostUSD: parseFloat(process.env.ESTIMATED_MONTHLY_COST_USD || '150'),
      byModel: {}
    };
  }
}
