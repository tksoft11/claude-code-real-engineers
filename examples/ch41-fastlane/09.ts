// backend/src/routes/releases.route.ts
import { Router } from 'express';
import Anthropic from '@anthropic-ai/sdk';

const router = Router();
const client = new Anthropic();

router.post('/analyze-release', async (req, res) => {
  const { changelog, diff_stat } = req.body;

  const response = await client.messages.create({
    model: 'claude-haiku-4-5',
    max_tokens: 800,
    system: `คุณคือ Release Manager วิเคราะห์ความเสี่ยงของ mobile app release

ตอบ JSON:
{
  "riskLevel": "LOW|MEDIUM|HIGH|CRITICAL",
  "summary": "สรุป 1 ประโยค",
  "warnings": ["warning1", "warning2"]
}

CRITICAL = มี breaking change หรือ data loss risk
HIGH = เปลี่ยน core feature หรือ API
MEDIUM = UI/UX changes, new features
LOW = bug fixes, minor updates`,
    messages: [{
      role: 'user',
      content: `Changelog: ${changelog}\nFiles changed: ${diff_stat}`,
    }],
  });

  const text = response.content[0].type === 'text' ? response.content[0].text : '{}';
  try {
    const match = text.match(/\{[\s\S]*\}/);
    res.json(match ? JSON.parse(match[0]) : { riskLevel: 'MEDIUM', summary: 'Unable to analyze', warnings: [] });
  } catch {
    res.json({ riskLevel: 'MEDIUM', summary: 'Analysis failed', warnings: [] });
  }
});

export default router;
