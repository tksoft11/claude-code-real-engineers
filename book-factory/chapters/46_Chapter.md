# บทที่ 46: Measuring & Reporting AI ROI — KPI, Dashboard, วิธีรายงานให้ผู้บริหารอนุมัติ Budget AI ต่อ

---

## 🪝 "คุ้มไหม?" — คำถามที่นักพัฒนาตอบไม่ได้เสมอ

ลองนึกภาพการประชุมรายไตรมาสในห้องประชุมชั้น 20 CFO นั่งอยู่ปลายโต๊ะ มีกองสไลด์ตัวเลขอยู่บนจอ คุณในฐานะ Lead Developer ที่เสนอให้บริษัทลงทุน Claude API ไปเดือนละ 50,000 บาทตลอด 6 เดือน ถูกเชิญมาอธิบาย

CFO มองตรงมาแล้วพูดว่า: **"เราจ่ายค่า AI ไป 300,000 บาทแล้ว ได้อะไรกลับมาบ้าง?"**

ถ้าคุณตอบว่า *"ทีมเขียนโค้ดเร็วขึ้น"* หรือ *"Developer พอใจมากขึ้น"* — คุณจะไม่ได้งบปีหน้า

แต่ถ้าคุณเปิดสไลด์ที่มีข้อมูลดังนี้:

```
📊 AI ROI Report — Q1 2568

งาน Developer ที่ AI ทำแทน:
• Code Review (847 PRs)     → 212 ชั่วโมง × ₿500/ชม = ฿106,000
• Bug Triage (203 issues)   → 67  ชั่วโมง × ₿500/ชม = ฿33,500
• Documentation (12 modules)→ 45  ชั่วโมง × ₿500/ชม = ฿22,500
• Invoice Processing        → 32  ชั่วโมง × ₿500/ชม = ฿16,000

รวมมูลค่าที่ประหยัดได้:  ฿178,000
ค่าใช้จ่าย Claude API:   ฿50,000
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
กำไรสุทธิ:               ฿128,000
ROI:                      256%
```

ห้องประชุมเงียบ แล้ว CFO พูดว่า: *"ขยาย Budget เป็น 5 เท่าได้เลย"*

ความแตกต่างระหว่างสองสถานการณ์นี้ไม่ใช่ผลลัพธ์ของงาน แต่คือ **ความสามารถในการวัดและนำเสนอผลลัพธ์เป็นตัวเลข** ทักษะนี้คือสิ่งที่แยก Real Engineer จากโปรแกรมเมอร์ทั่วไป

---

## 🏗️ Core Mechanic: กรอบการวัดผล AI ROI (The 4-Metric Framework)

การวัด ROI ของ AI ต้องคิดใน 4 มิติพร้อมกัน:

```
┌────────────────────────────────────────────────────────┐
│  มิติ 1: Time Savings (เวลาที่ประหยัดได้)              │
│  → ชั่วโมงงานที่ AI ทำแทนมนุษย์ × ค่าแรงต่อชั่วโมง    │
├────────────────────────────────────────────────────────┤
│  มิติ 2: Quality Improvement (คุณภาพที่ดีขึ้น)         │
│  → Bug Rate ลดลง, Test Coverage เพิ่มขึ้น             │
├────────────────────────────────────────────────────────┤
│  มิติ 3: Revenue Impact (ผลต่อรายได้)                  │
│  → Feature ที่ส่งได้เร็วขึ้น → ลูกค้าได้ใช้เร็วขึ้น   │
├────────────────────────────────────────────────────────┤
│  มิติ 4: Risk Reduction (ความเสี่ยงที่ลดลง)            │
│  → Security Vulnerability ที่ AI จับได้ก่อน Production │
└────────────────────────────────────────────────────────┘
```

### KPI หลักที่ต้องติดตาม

| KPI | วิธีวัด | แหล่งข้อมูล | ความถี่ |
|-----|---------|------------|---------|
| **Hours Saved** | จำนวน Tasks × เวลาเฉลี่ยต่อ Task | Git logs, Jira tickets | รายสัปดาห์ |
| **Bug Prevention Rate** | (Bug ก่อน AI - Bug หลัง AI) / Bug ก่อน AI × 100 | GitHub Issues | รายเดือน |
| **Deployment Frequency** | จำนวน Deploy ต่อสัปดาห์ | CI/CD logs | รายสัปดาห์ |
| **PR Review Cycle Time** | เวลาเฉลี่ยจาก PR open ถึง merge | GitHub API | รายสัปดาห์ |
| **API Cost per Outcome** | ค่า Token / จำนวน Task ที่สำเร็จ | Anthropic Usage API | รายวัน |
| **MTTR (AI Incidents)** | เวลาเฉลี่ยในการแก้ปัญหา Production | PagerDuty API | รายเดือน |

---

## 🔧 Hands-On: สร้าง Auto-ROI Report Generator ด้วย Claude

แทนที่จะนั่งคำนวณตัวเลขด้วยมือทุกเดือน เราจะสร้างระบบอัตโนมัติที่:
1. ดึงข้อมูลต้นทุน API จริงจาก Anthropic Usage API
2. ดึงข้อมูลผลผลิตจาก GitHub API  
3. ให้ Claude วิเคราะห์และสร้างรายงานเชิงบริหาร
4. ส่งรายงานอัตโนมัติผ่าน Slack ทุกต้นเดือน

### ส่วนที่ 1: ดึงต้นทุนจาก Anthropic Usage API จริง

```typescript
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
```

### ส่วนที่ 2: ดึงผลผลิตจาก GitHub API

```typescript
// tools/roi-reporter/githubMetrics.ts
import { Octokit } from '@octokit/rest';

const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });

export interface ProductivityMetrics {
  prsReviewed: number;
  prsWithAIReview: number;   // PRs ที่มี AI Review Comment
  bugsFixed: number;
  avgPRCycleHours: number;   // เวลาเฉลี่ยจาก PR open → merge (ชั่วโมง)
  deploymentsCount: number;
  hoursEstimatedSaved: number;
}

export async function fetchGitHubMetrics(
  owner: string,
  repo: string,
  daysBack: number
): Promise<ProductivityMetrics> {
  const since = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000).toISOString();

  // ดึง Merged PRs ทั้งหมด
  const { data: pulls } = await octokit.pulls.list({
    owner, repo, state: 'closed', per_page: 100,
    sort: 'updated', direction: 'desc'
  });

  const recentPRs = pulls.filter(pr =>
    pr.merged_at && new Date(pr.merged_at) > new Date(since)
  );

  // คำนวณ Average PR Cycle Time
  const cycleTimes = recentPRs.map(pr => {
    const openTime = new Date(pr.created_at).getTime();
    const mergeTime = new Date(pr.merged_at!).getTime();
    return (mergeTime - openTime) / (1000 * 60 * 60); // แปลงเป็นชั่วโมง
  });
  const avgCycleHours = cycleTimes.length > 0
    ? cycleTimes.reduce((a, b) => a + b, 0) / cycleTimes.length
    : 0;

  // ตรวจสอบว่า PR ไหนมี AI Review (จาก Bot user หรือ comment pattern)
  let prsWithAIReview = 0;
  for (const pr of recentPRs.slice(0, 20)) { // ตรวจ 20 PR ล่าสุด
    try {
      const { data: comments } = await octokit.issues.listComments({
        owner, repo, issue_number: pr.number
      });
      const hasAIComment = comments.some(c =>
        c.user?.login?.includes('bot') ||
        c.body?.includes('AI Review') ||
        c.body?.includes('Claude') ||
        c.body?.includes('🤖')
      );
      if (hasAIComment) prsWithAIReview++;
    } catch {
      // ข้าม PR ที่ดึงข้อมูลไม่ได้
    }
  }

  // ดึงข้อมูล Bug Issues
  const { data: bugIssues } = await octokit.issues.listForRepo({
    owner, repo, state: 'closed', since, labels: 'bug', per_page: 100
  });

  // คำนวณชั่วโมงที่ประหยัดได้
  // สมมติฐาน: PR Review ปกติ 30 นาที, Bug Triage 1.5 ชั่วโมง, AI ช่วยประหยัดได้ 70%
  const hoursEstimatedSaved =
    (recentPRs.length * 0.5 * 0.7) + // PR review
    (bugIssues.length * 1.5 * 0.7);  // Bug triage

  return {
    prsReviewed: recentPRs.length,
    prsWithAIReview,
    bugsFixed: bugIssues.length,
    avgPRCycleHours: Math.round(avgCycleHours * 10) / 10,
    deploymentsCount: recentPRs.filter(pr => pr.base.ref === 'main').length,
    hoursEstimatedSaved: Math.round(hoursEstimatedSaved * 10) / 10
  };
}
```

### ส่วนที่ 3: สร้าง Report ด้วย Claude

```typescript
// tools/roi-reporter/generateROIReport.ts
import Anthropic from '@anthropic-ai/sdk';
import { fetchAnthropicUsage } from './anthropicUsage';
import { fetchGitHubMetrics, ProductivityMetrics } from './githubMetrics';
import * as fs from 'fs';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

async function generateExecutiveReport(
  productivity: ProductivityMetrics,
  apiCostUSD: number,
  devRatePerHour: number
): Promise<string> {
  const totalValueSaved = productivity.hoursEstimatedSaved * devRatePerHour;
  const netProfit = totalValueSaved - (apiCostUSD * 36); // แปลง USD → THB ด้วยอัตรา 36
  const roi = ((totalValueSaved - (apiCostUSD * 36)) / (apiCostUSD * 36)) * 100;

  const prompt = `คุณคือ CFO ที่เก่งกาจในการสื่อสารตัวเลข ROI ให้ผู้บริหารเข้าใจง่าย

จงสร้างรายงาน AI ROI Summary ประจำเดือน โดยใช้ข้อมูลต่อไปนี้:

📊 ข้อมูลผลผลิต (Productivity Data):
- PR ที่ทบทวนทั้งหมด: ${productivity.prsReviewed} PRs
- PR ที่มี AI ช่วย Review: ${productivity.prsWithAIReview} PRs
- Bug ที่ AI ช่วยวินิจฉัย: ${productivity.bugsFixed} issues
- เวลา Cycle ของ PR เฉลี่ย: ${productivity.avgPRCycleHours} ชั่วโมง
- Deploy ขึ้น Main: ${productivity.deploymentsCount} ครั้ง
- ชั่วโมงที่ประหยัดได้: ${productivity.hoursEstimatedSaved} ชั่วโมง

💰 ข้อมูลการเงิน:
- ค่า API ที่จ่าย: $${apiCostUSD.toFixed(2)} USD (≈ ฿${(apiCostUSD * 36).toLocaleString()})
- ค่าแรง Developer: ฿${devRatePerHour}/ชั่วโมง
- มูลค่างานที่ AI ทำแทน: ฿${totalValueSaved.toLocaleString()}
- กำไรสุทธิ: ฿${netProfit.toLocaleString()}
- ROI: ${roi.toFixed(0)}%

จงเขียนรายงาน 1 หน้าที่:
1. มีหัวข้อ "📊 AI ROI Monthly Report — [เดือนปัจจุบัน]"
2. มีส่วน Executive Summary (2-3 ประโยค) ที่บอกว่าคุ้มมากแค่ไหน
3. มีตารางสรุปตัวเลขสำคัญ
4. มีส่วน "Top 3 ผลกระทบที่วัดได้" พร้อมตัวเลขชัดเจน
5. มีข้อเสนอแนะเชิงกลยุทธ์ 1-2 ข้อ
6. ใช้ภาษาที่ CFO อ่านแล้วเข้าใจทันที ไม่ใช้ศัพท์เทคนิค
7. ใช้ Markdown formatting`;

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-5',
    max_tokens: 2000,
    messages: [{ role: 'user', content: prompt }]
  });

  return (response.content[0] as Anthropic.TextBlock).text;
}

async function main() {
  const owner = process.env.GITHUB_OWNER || 'your-org';
  const repo = process.env.GITHUB_REPO || 'core-app';
  const devRatePerHour = parseInt(process.env.DEV_RATE_THB || '500');

  // คำนวณช่วงวันของเดือนที่ผ่านมา
  const now = new Date();
  const startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    .toISOString().slice(0, 10);
  const endDate = new Date(now.getFullYear(), now.getMonth(), 0)
    .toISOString().slice(0, 10);

  console.log(`📊 Generating AI ROI Report for ${startDate} to ${endDate}...`);

  // ดึงข้อมูลทั้งสองแหล่งพร้อมกัน
  const [usageSummary, productivity] = await Promise.all([
    fetchAnthropicUsage(startDate, endDate),
    fetchGitHubMetrics(owner, repo, 30)
  ]);

  console.log(`💰 API Cost: $${usageSummary.totalCostUSD.toFixed(2)}`);
  console.log(`⏱️ Hours Saved: ${productivity.hoursEstimatedSaved}`);
  console.log(`📝 PRs Reviewed: ${productivity.prsReviewed}`);

  // สร้างรายงานด้วย Claude
  const report = await generateExecutiveReport(productivity, usageSummary.totalCostUSD, devRatePerHour);

  // บันทึกเป็นไฟล์
  const filename = `roi-report-${now.toISOString().slice(0, 7)}.md`;
  fs.writeFileSync(filename, report);
  console.log(`\n✅ Report saved: ${filename}\n`);
  console.log('--- Report Preview ---\n');
  console.log(report);
}

main().catch(console.error);
```

### ส่วนที่ 4: GitHub Actions Cron รันรายงานอัตโนมัติ

```yaml
# .github/workflows/monthly-roi-report.yml
name: Monthly AI ROI Report

on:
  schedule:
    - cron: '0 9 1 * *'  # ทุกวันที่ 1 ของเดือน เวลา 09:00 น.
  workflow_dispatch:
    inputs:
      month_override:
        description: 'Override month (YYYY-MM), leave blank for last month'
        required: false

jobs:
  generate-report:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      issues: write      # สำหรับดึงข้อมูล Issues

    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - run: npm ci

      - name: Generate ROI Report
        env:
          ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
          ANTHROPIC_ADMIN_KEY: ${{ secrets.ANTHROPIC_ADMIN_KEY }}
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          GITHUB_OWNER: ${{ github.repository_owner }}
          GITHUB_REPO: ${{ github.event.repository.name }}
          DEV_RATE_THB: '500'
          ESTIMATED_MONTHLY_COST_USD: '150'
        run: npx ts-node tools/roi-reporter/generateROIReport.ts

      - name: Send to Slack
        if: always()
        env:
          SLACK_WEBHOOK: ${{ secrets.SLACK_WEBHOOK_URL }}
        run: |
          MONTH=$(date -d "last month" +"%B %Y" 2>/dev/null || date -v-1m +"%B %Y")
          REPORT_FILE=$(ls roi-report-*.md 2>/dev/null | head -1)

          if [ -n "$REPORT_FILE" ]; then
            # ดึง Executive Summary แค่ส่วนแรก (5 บรรทัดแรก)
            SUMMARY=$(head -n 10 "$REPORT_FILE")
            PAYLOAD=$(jq -n \
              --arg text "📊 *AI ROI Report — $MONTH*\n\n$SUMMARY\n\n_ดูรายงานเต็มใน GitHub Actions Artifacts_" \
              '{"text": $text}')
            curl -s -X POST "$SLACK_WEBHOOK" -H 'Content-type: application/json' -d "$PAYLOAD"
          fi

      - name: Upload Report as Artifact
        uses: actions/upload-artifact@v4
        with:
          name: roi-report
          path: roi-report-*.md
          retention-days: 90
```

---

## 📊 Dashboard แนะนำ: วิธีดู ROI แบบ Real-time

นอกจากรายงานอัตโนมัติรายเดือน คุณควรมี Dashboard ที่ดูได้แบบ Real-time ผ่าน 3 ช่องทาง:

### 1. Anthropic Console Dashboard
เข้าได้ที่ https://console.anthropic.com/ → Usage Tab
แสดง: Token usage แยกตาม API Key, Cost per Day, Model Distribution

### 2. GitHub Insights
เข้าได้ใน Repository → Insights → Traffic/Code Frequency
ดู: PR merge rate, Commit frequency, Contributor activity

### 3. Custom Grafana Dashboard (แนะนำ)
ต่อกับ Prometheus ที่ติดตั้งใน บทที่ 43 แล้วเพิ่ม Business KPI Panel:

```promql
# ROI per day (เฉพาะถ้าต่อ Custom Metric)
sum(increase(ai_hours_saved_total[24h])) * 500
/
sum(increase(ai_estimated_cost_usd_total[24h])) * 36
```

---

## 🎯 สรุปบทที่ 46

| เครื่องมือ | บทบาท |
|----------|--------|
| **Anthropic Admin API** | ดึงต้นทุน Token จริงตามรุ่นโมเดล |
| **GitHub API** | วัดผลผลิต: PR, Bug, Deployment |
| **Claude Sonnet** | แปลงตัวเลขดิบ → ภาษาที่ CFO เข้าใจ |
| **GitHub Actions Cron** | รันรายงานอัตโนมัติทุกต้นเดือน |
| **Slack Webhook** | ส่ง Summary ให้ทีมโดยไม่ต้องถามหา |
| **Artifact Upload** | เก็บรายงาน PDF ไว้ 90 วันสำหรับตรวจสอบย้อนหลัง |

**บทเรียนที่สำคัญที่สุด:** ROI ที่ดีไม่ได้เกิดจากโชค แต่เกิดจากการวางระบบวัดผลตั้งแต่วันแรกที่นำ AI เข้ามาใช้งาน และนำเสนอด้วยภาษาที่ผู้บริหารเข้าใจ

---

## 📋 Action Items ก่อนไปบทที่ 47

- [ ] ขอ `ANTHROPIC_ADMIN_KEY` จากทีม Admin เพื่อดึงข้อมูล Usage จริง
- [ ] กำหนดค่าแรง Developer ต่อชั่วโมงที่สมเหตุสมผล (ปรึกษา HR)
- [ ] รันสคริปต์ครั้งแรกด้วย `npx ts-node tools/roi-reporter/generateROIReport.ts`
- [ ] เพิ่ม Workflow YAML เข้า Repository แล้วรัน Manual trigger ครั้งแรก
- [ ] นำเสนอรายงานต่อหัวหน้าทีม — ดูว่าตัวเลขไหนที่เขาสนใจมากที่สุด

---



