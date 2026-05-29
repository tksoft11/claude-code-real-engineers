// src/orchestrator/report.orchestrator.ts
import { FinanceAgent } from '../agents/finance.agent';
import { EngineeringAgent } from '../agents/engineering.agent';
import { SynthesizerAgent } from '../agents/synthesizer.agent';
import { AgentResult } from '../agents/base.agent';

interface ReportConfig {
  quarter: string;
  repoIds: string[];
  dbConnection: string;
}

interface PipelineResult {
  success: boolean;
  report?: string;
  agentResults: Record<string, AgentResult>;
  totalTokens: number;
  totalDurationMs: number;
  failedAgents: string[];
}

export async function generateExecutiveReport(config: ReportConfig): Promise<PipelineResult> {
  const startTime = Date.now();
  const agentResults: Record<string, AgentResult> = {};

  console.log(`\n📊 Generating Q${config.quarter} Executive Report`);
  console.log(`Running Finance + Engineering agents in parallel...\n`);

  // ── Phase 1: Parallel data collection ──────────────────
  const financeAgent     = new FinanceAgent();
  const engineeringAgent = new EngineeringAgent();

  const [financeResult, engineeringResult] = await Promise.all([
    financeAgent.run({ quarter: config.quarter, dbConnection: config.dbConnection }),
    engineeringAgent.run({ quarter: config.quarter, repoIds: config.repoIds }),
  ]);

  agentResults['finance']     = financeResult;
  agentResults['engineering'] = engineeringResult;

  // ตรวจสอบ failures
  const failedAgents = Object.entries(agentResults)
    .filter(([, result]) => !result.success)
    .map(([name]) => name);

  // ── Phase 2: Synthesize (ถ้าข้อมูลพอ) ─────────────────
  const hasEnoughData = agentResults['finance'].success ||
                        agentResults['engineering'].success;

  if (!hasEnoughData) {
    return {
      success: false,
      agentResults,
      totalTokens: Object.values(agentResults).reduce((s, r) => s + r.tokensUsed, 0),
      totalDurationMs: Date.now() - startTime,
      failedAgents,
    };
  }

  console.log(`\nSynthesizing results with Opus...\n`);

  const synthesizerAgent = new SynthesizerAgent();
  const synthResult = await synthesizerAgent.run({
    quarter: config.quarter,
    finance: financeResult.data || {
      revenue: { current: 0, prevQuarter: 0, growth: 0 },
      costs: { total: 0, breakdown: {} },
      burnRate: 0, runway: 0, highlights: [], concerns: []
    },
    engineering: engineeringResult.data || {
      deploymentFrequency: 0, changeFailureRate: 0,
      meanTimeToRestore: 0, leadTime: 0, bugsShipped: 0,
      velocityTrend: 'stable' as const, highlights: [], risks: []
    },
  });

  agentResults['synthesizer'] = synthResult;
  const totalTokens = Object.values(agentResults).reduce((s, r) => s + r.tokensUsed, 0);
  const totalDurationMs = Date.now() - startTime;

  console.log(`\n✅ Report complete in ${(totalDurationMs / 1000).toFixed(1)}s`);
  console.log(`   Total tokens used: ${totalTokens.toLocaleString()}`);

  return {
    success: synthResult.success,
    report: synthResult.data,
    agentResults,
    totalTokens,
    totalDurationMs,
    failedAgents: synthResult.success ? failedAgents : [...failedAgents, 'synthesizer'],
  };
}
