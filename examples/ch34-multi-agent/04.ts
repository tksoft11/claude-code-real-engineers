// src/agents/synthesizer.agent.ts
import { BaseAgent } from './base.agent';
import { FinanceAnalysis } from './finance.agent';
import { EngineeringMetrics } from './engineering.agent';

interface SynthesizerInput {
  quarter: string;
  finance: FinanceAnalysis;
  engineering: EngineeringMetrics;
  // เพิ่ม sales, hr ตามต้องการ
}

export class SynthesizerAgent extends BaseAgent<SynthesizerInput, string> {
  constructor() {
    super({
      name: 'SynthesizerAgent',
      model: 'claude-opus-4-5', // งานสำคัญ → ใช้ Opus
      systemPrompt: `คุณคือ Executive Report Writer ระดับ C-Suite
เขียน Executive Summary ที่กระชับ ชัดเจน actionable
ใช้ข้อมูลจากทุก department สร้าง narrative ที่สอดคล้องกัน
ตอบเป็นภาษาอังกฤษ (สำหรับ international report)`,
      maxTokens: 4096,
    });
  }

  protected async execute(input: SynthesizerInput): Promise<string> {
    const { text } = await this.ask(`
Create an Executive Report for Q${input.quarter}

## Financial Performance
${JSON.stringify(input.finance, null, 2)}

## Engineering Health  
${JSON.stringify(input.engineering, null, 2)}

Format:
# Executive Summary (2 paragraphs max)

## Key Highlights
- (bullet points, most important first)

## Areas of Concern
- (with recommended actions)

## Financial Snapshot
| Metric | Value | vs Last Quarter |
...

## Engineering Health
| DORA Metric | Score | Benchmark |
...

## Recommended Actions for Next Quarter
1. (Priority items with owner and timeline)

Keep it concise. Board-ready format.`);

    return text;
  }
}
