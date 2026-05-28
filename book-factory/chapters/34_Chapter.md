# บทที่ 34: Multi-Agent Orchestration — เมื่อ Claude ตัวเดียวไม่พอ

---

## 🪝 Report ที่ใช้เวลา 3 วัน กลายเป็น 8 นาที

ทุกสิ้นไตรมาส CFO ของบริษัทต้องการ "Executive AI Report" ที่รวมข้อมูลจากทุกแผนก:

- **Finance:** revenue, costs, burn rate, forecast
- **Engineering:** velocity, bugs shipped, deployment frequency, incident count  
- **Sales:** pipeline value, win rate, churn, NPS
- **HR:** headcount, attrition, hiring funnel

ก่อนหน้านี้ Business Analyst ใช้เวลา **3 วัน** รวบรวมข้อมูลจากระบบต่างๆ เขียนรายงาน format ให้ถูก แล้วส่ง management review

ทีมลอง Claude ตัวเดียวกับ prompt ยาวมาก — ผลลัพธ์ดีแค่บางส่วน และ context window เต็มก่อนที่จะวิเคราะห์ครบ

**Multi-Agent Pipeline แก้ได้:**

```
Orchestrator แบ่งงาน
    │
    ├── Finance Agent   ← query finance DB + analyze trends
    ├── Engineering Agent ← query Jira + GitHub metrics  
    ├── Sales Agent     ← query CRM + calculate KPIs
    └── HR Agent        ← query HR system + attrition analysis
    │
    └── Report Synthesizer ← รวมผลทั้งหมด เขียน Executive Summary
```

จาก **3 วัน** เหลือ **8 นาที** โดยทุก agent ทำงานพร้อมกัน

---

## 🧠 ทำไมต้องใช้หลาย Agents

```
1 Agent ทำทุกอย่าง — ปัญหา:
─────────────────────────────────────────────────────
• Context Window ล้น (ข้อมูล 4 ระบบ + analysis + report = มหาศาล)
• คุณภาพตก เมื่อ context ยาว (Lost in the Middle)
• ช้า เพราะทำทีละอย่าง
• ถ้า fail ทำงานใหม่ทั้งหมด

Multi-Agent Pipeline — ประโยชน์:
─────────────────────────────────────────────────────
• แต่ละ Agent มี context เล็กลง → คุณภาพสูงขึ้น
• ทำ parallel ได้ → เร็วขึ้น 3-5x
• Fail 1 agent → retry เฉพาะส่วนนั้น
• ง่ายต่อการ test และ debug แต่ละส่วน
• เลือก model ที่เหมาะกับแต่ละงาน (Haiku สำหรับงานง่าย, Opus สำหรับงานซับซ้อน)
```

---

## 📐 3 Patterns ของ Multi-Agent

### Pattern 1: Sequential Pipeline

```
ใช้เมื่อ: งานต้องทำตามลำดับ output ของขั้นหนึ่งเป็น input ของขั้นถัดไป

Input → [Agent A] → [Agent B] → [Agent C] → Output

ตัวอย่าง: โค้ด → [Code Reviewer] → [Test Writer] → [Doc Writer]
```

### Pattern 2: Parallel Fanout + Aggregator

```
ใช้เมื่อ: งาน independent หลายชิ้นที่ทำพร้อมกันได้

                ┌── [Finance Agent]     ──┐
Input ──────────┼── [Engineering Agent] ──┼──→ [Aggregator] → Output
                ├── [Sales Agent]       ──┤
                └── [HR Agent]          ──┘

ตัวอย่าง: 4 departments วิเคราะห์พร้อมกัน → รวม report
```

### Pattern 3: Hierarchical (Orchestrator + Dynamic Workers)

```
ใช้เมื่อ: งานซับซ้อนที่ต้องการการตัดสินใจว่าต้องใช้ worker ไหน

[Orchestrator] ← วิเคราะห์งาน + assign
    │
    ├── dispatch Worker A
    ├── dispatch Worker B (ถ้าจำเป็น)
    └── collect + synthesize results

ตัวอย่าง: Customer complaint → Orchestrator วิเคราะห์ → assign specialist
```

---

## 💻 Implementation: Agent Base Class

```typescript
// src/agents/base.agent.ts
import Anthropic from '@anthropic-ai/sdk';

export interface AgentConfig {
  name: string;
  model: 'claude-haiku-4-5' | 'claude-sonnet-4-5' | 'claude-opus-4-5';
  systemPrompt: string;
  maxTokens?: number;
  temperature?: number;
}

export interface AgentResult<T = string> {
  agentName: string;
  success: boolean;
  data?: T;
  error?: string;
  tokensUsed: number;
  durationMs: number;
}

export abstract class BaseAgent<TInput, TOutput> {
  protected client: Anthropic;
  protected config: AgentConfig;

  constructor(config: AgentConfig) {
    this.client = new Anthropic();
    this.config = config;
  }

  async run(input: TInput): Promise<AgentResult<TOutput>> {
    const startTime = Date.now();
    console.log(`[${this.config.name}] Starting...`);

    try {
      const data = await this.execute(input);
      const durationMs = Date.now() - startTime;

      console.log(`[${this.config.name}] Done in ${durationMs}ms`);

      return {
        agentName: this.config.name,
        success: true,
        data,
        tokensUsed: 0, // อัปเดตใน execute ถ้าต้องการ
        durationMs,
      };
    } catch (error: any) {
      const durationMs = Date.now() - startTime;
      console.error(`[${this.config.name}] Error: ${error.message}`);

      return {
        agentName: this.config.name,
        success: false,
        error: error.message,
        tokensUsed: 0,
        durationMs,
      };
    }
  }

  protected abstract execute(input: TInput): Promise<TOutput>;

  protected async ask(userMessage: string): Promise<{ text: string; tokens: number }> {
    const response = await this.client.messages.create({
      model: this.config.model,
      max_tokens: this.config.maxTokens || 2048,
      system: this.config.systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
    });

    const text = response.content[0].type === 'text' ? response.content[0].text : '';
    const tokens = response.usage.input_tokens + response.usage.output_tokens;

    return { text, tokens };
  }

  protected parseJSON<T>(text: string, fallback: T): T {
    try {
      const match = text.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
      return match ? JSON.parse(match[0]) : fallback;
    } catch {
      return fallback;
    }
  }
}
```

---

## 🎯 Killer Example: Executive Report Pipeline

### Agent 1: Finance Analyzer

```typescript
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
```

### Agent 2: Engineering Metrics Agent

```typescript
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
```

### Agent 3: Report Synthesizer

```typescript
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
```

---

## 🚀 Orchestrator: รวม Agents ทั้งหมด

```typescript
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
```

---

## 🔧 CLI Runner

```typescript
// generate-report.ts
import { generateExecutiveReport } from './src/orchestrator/report.orchestrator';
import fs from 'fs';
import 'dotenv/config';

async function main() {
  const quarter = process.argv[2] || '2025-Q4';

  const result = await generateExecutiveReport({
    quarter,
    repoIds: ['repo-main', 'repo-api', 'repo-frontend'],
    dbConnection: process.env.DATABASE_URL || '',
  });

  if (!result.success) {
    console.error(`\n❌ Report generation failed`);
    console.error(`Failed agents: ${result.failedAgents.join(', ')}`);
    process.exit(1);
  }

  // บันทึก report
  const filename = `report-${quarter}-${Date.now()}.md`;
  fs.writeFileSync(filename, result.report!);

  console.log(`\n📄 Report saved: ${filename}`);
  console.log(`\n--- Report Preview ---`);
  console.log(result.report!.slice(0, 500) + '...');

  // แสดง agent stats
  console.log(`\n--- Agent Performance ---`);
  for (const [name, r] of Object.entries(result.agentResults)) {
    const status = r.success ? '✅' : '❌';
    console.log(`${status} ${name}: ${r.durationMs}ms, ${r.tokensUsed} tokens`);
  }
}

main().catch(console.error);
```

```bash
# รัน
ts-node generate-report.ts 2025-Q4

# Output:
# 📊 Generating Q2025-Q4 Executive Report
# Running Finance + Engineering agents in parallel...
#
# [FinanceAgent] Starting...
# [EngineeringAgent] Starting...
# [FinanceAgent] Done in 2,341ms
# [EngineeringAgent] Done in 1,876ms
#
# Synthesizing results with Opus...
# [SynthesizerAgent] Done in 3,122ms
#
# ✅ Report complete in 7.3s
#    Total tokens used: 8,241
#
# 📄 Report saved: report-2025-Q4-1715789123.md
#
# --- Agent Performance ---
# ✅ finance: 2341ms, 3102 tokens
# ✅ engineering: 1876ms, 1247 tokens
# ✅ synthesizer: 3122ms, 3892 tokens
```

---

## 🛡️ Agent Safety Patterns

### 1. Sanitize Agent Output ก่อน Pass ต่อ

```typescript
// ป้องกัน Prompt Injection ระหว่าง agents
function sanitizeAgentOutput(output: string): string {
  return output
    .replace(/ignore previous instructions/gi, '[FILTERED]')
    .replace(/you are now a/gi, '[FILTERED]')
    .replace(/system prompt:/gi, '[FILTERED]')
    .replace(/<\/?system>/gi, '[FILTERED]');
}

// ใช้ใน Synthesizer ก่อนส่ง data จาก agents อื่น
const safeFinanceData = sanitizeAgentOutput(JSON.stringify(financeResult.data));
```

### 2. Circuit Breaker: หยุดถ้า Agents Fail เกิน Threshold

```typescript
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
```

### 3. Timeout per Agent

```typescript
async function runWithTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  agentName: string
): Promise<T> {
  const timeout = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error(`${agentName} timed out after ${timeoutMs}ms`)), timeoutMs)
  );
  return Promise.race([promise, timeout]);
}

// ใช้งาน
const financeResult = await runWithTimeout(
  financeAgent.run({ quarter, dbConnection }),
  30_000, // 30 seconds max
  'FinanceAgent'
);
```

---

## 📊 Model Selection ต่อ Agent

```
Agent Role            → Model ที่เหมาะสม
───────────────────────────────────────────────────────
Data Extraction       → claude-haiku-4-5   (structured → ถูก + เร็ว)
Classification        → claude-haiku-4-5   (pattern matching → ง่าย)
Analysis + Reasoning  → claude-sonnet-4-5  (balance cost/quality)
Complex Synthesis     → claude-opus-4-5    (งานสำคัญ → ต้องการ quality)
Creative Writing      → claude-opus-4-5    (nuance + voice)

Orchestrator/Planner  → claude-sonnet-4-5  (วางแผนงาน → ต้องการ reasoning)

ประหยัด cost: ใช้ Haiku ให้มากที่สุด → Sonnet เมื่อต้องการ → Opus เฉพาะ critical path
```

---

## 🎯 สรุปบทที่ 34

| Pattern | เมื่อใช้ | ตัวอย่าง |
|---------|---------|---------|
| Sequential | งานต้องทำตามลำดับ | Code → Review → Test → Deploy |
| Parallel Fanout | งาน independent | 4 departments analyze พร้อมกัน |
| Hierarchical | งานซับซ้อน dynamic | Orchestrator assign specialist |

**กุญแจสำคัญ 3 ข้อ:**
1. **แต่ละ Agent มี context เล็ก** → คุณภาพสูงกว่า 1 agent ทำทุกอย่าง
2. **เลือก Model ให้ตรงงาน** → Haiku สำหรับ structured data, Opus สำหรับ synthesis
3. **Safety first** → Sanitize output ระหว่าง agents + Circuit Breaker + Timeout

---

## 📋 Action Items ก่อนไปบทที่ 35

- [ ] เลือก use case ใน workflow ของคุณที่ใช้ Parallel Fanout ได้
- [ ] Implement `BaseAgent` class และสร้าง Agent แรก
- [ ] วัด: 1 agent ทำทั้งหมด vs Multi-Agent — เปรียบเทียบ quality + speed
- [ ] เพิ่ม `runWithTimeout()` ทุก agent call
- [ ] สร้าง Pipeline monitoring: log duration + tokens ของแต่ละ agent

---

*ใน **บทที่ 35** เราจะเรียนรู้เกี่ยวกับ The Multi-Human & Multi-Agent Team — วิธีแบ่งปัน Context ของการพัฒนาระหว่างทีมงานที่เป็นมนุษย์ 5 คนกับผู้ช่วย AI หลายตัว เพื่อไม่ให้โค้ดชนกันและประสานงานกันได้สูงสุดครับ*
