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
