// src/agents/engineering.agent.ts
import { BaseAgent } from './base.agent';

interface EngineeringInput { quarter: string; repoIds: string[] }

interface EngineeringMetrics {
  deploymentFrequency: number; // per week
  changeFailureRate: number;   // percentage
  meanTimeToRestore: number;   // hours
  leadTime: number;            // hours from commit to production
  bugsShipped: number;
  velocityTrend: 'improving' | 'stable' | 'declining';
  highlights: string[];
  risks: string[];
}

export class EngineeringAgent extends BaseAgent<EngineeringInput, EngineeringMetrics> {
  constructor() {
    super({
      name: 'EngineeringAgent',
      model: 'claude-haiku-4-5', // ข้อมูล structured → Haiku เพียงพอ
      systemPrompt: `คุณคือ Engineering Metrics Analyst
วิเคราะห์ DORA metrics และ engineering health
ตอบ JSON เท่านั้น`,
      maxTokens: 1024,
    });
  }

  protected async execute(input: EngineeringInput): Promise<EngineeringMetrics> {
    const data = await this.fetchEngineeringData(input);

    const { text } = await this.ask(`
วิเคราะห์ Engineering metrics Q${input.quarter}:
${JSON.stringify(data, null, 2)}

คำนวณ DORA metrics และวิเคราะห์ health
ตอบ JSON ตาม schema ที่กำหนด`);

    return this.parseJSON<EngineeringMetrics>(text, {
      deploymentFrequency: 0, changeFailureRate: 0,
      meanTimeToRestore: 0, leadTime: 0, bugsShipped: 0,
      velocityTrend: 'stable', highlights: [], risks: [],
    });
  }

  private async fetchEngineeringData(input: EngineeringInput) {
    return {
      deployments: 87, failures: 4, incidents: 2,
      avgRestoreTime: 1.4, avgLeadTime: 18,
      sprintVelocity: [45, 48, 52, 49, 55],
      bugsCreated: 23, bugsFixed: 28,
    };
  }
}
