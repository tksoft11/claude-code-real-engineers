// src/agents/finance.agent.ts
import { BaseAgent } from './base.agent';

interface FinanceInput {
  quarter: string;
  dbConnection: string; // ใช้ tool/MCP ดึงข้อมูล
}

interface FinanceAnalysis {
  revenue: { current: number; prevQuarter: number; growth: number };
  costs: { total: number; breakdown: Record<string, number> };
  burnRate: number;
  runway: number; // months
  highlights: string[];
  concerns: string[];
}

export class FinanceAgent extends BaseAgent<FinanceInput, FinanceAnalysis> {
  constructor() {
    super({
      name: 'FinanceAgent',
      model: 'claude-sonnet-4-5',
      systemPrompt: `คุณคือ Financial Analyst ที่เชี่ยวชาญการวิเคราะห์ข้อมูลการเงิน
วิเคราะห์ข้อมูลอย่างแม่นยำ ระบุ trends และ anomalies
ตอบ JSON เท่านั้น`,
      maxTokens: 2048,
    });
  }

  protected async execute(input: FinanceInput): Promise<FinanceAnalysis> {
    // ในระบบจริง: query database ผ่าน MCP หรือ Tool Use
    // ตัวอย่างนี้ใช้ mock data
    const rawData = await this.fetchFinanceData(input.quarter);

    const { text } = await this.ask(`
วิเคราะห์ข้อมูลการเงิน Q${input.quarter}:
${JSON.stringify(rawData, null, 2)}

ตอบ JSON:
{
  "revenue": { "current": number, "prevQuarter": number, "growth": number },
  "costs": { "total": number, "breakdown": {"category": amount} },
  "burnRate": number,
  "runway": number,
  "highlights": ["สิ่งที่ดี..."],
  "concerns": ["สิ่งที่น่าเป็นห่วง..."]
}`);

    return this.parseJSON<FinanceAnalysis>(text, {
      revenue: { current: 0, prevQuarter: 0, growth: 0 },
      costs: { total: 0, breakdown: {} },
      burnRate: 0,
      runway: 0,
      highlights: [],
      concerns: [],
    });
  }

  private async fetchFinanceData(quarter: string) {
    // Mock — ในระบบจริงเรียก database หรือ finance API
    return {
      quarter,
      revenue: { Q3: 1_250_000, Q4: 1_480_000 },
      costs: {
        payroll: 620_000,
        infrastructure: 85_000,
        marketing: 210_000,
        operations: 95_000,
      },
      cashBalance: 3_200_000,
    };
  }
}
