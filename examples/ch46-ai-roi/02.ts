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
