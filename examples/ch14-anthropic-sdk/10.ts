// feedback-analyzer.ts
import Anthropic from '@anthropic-ai/sdk';
import 'dotenv/config';

const client = new Anthropic();

interface FeedbackAnalysis {
  sentiment: 'positive' | 'negative' | 'neutral';
  category: string;
  priority: 'high' | 'medium' | 'low';
  summary: string;
  suggestedAction: string;
}

async function analyzeFeedback(feedback: string): Promise<FeedbackAnalysis> {
  const response = await client.messages.create({
    model: 'claude-haiku-4-5', // ใช้ Haiku เพราะงานนี้ไม่ซับซ้อน
    max_tokens: 512,
    system: `วิเคราะห์ feedback ของลูกค้าและตอบในรูปแบบ JSON เท่านั้น
    ห้ามเพิ่มข้อความอื่น ตอบแค่ JSON object`,
    messages: [{
      role: 'user',
      content: `วิเคราะห์ feedback นี้:
"${feedback}"

ตอบในรูปแบบ JSON:
{
  "sentiment": "positive|negative|neutral",
  "category": "product|service|delivery|price|other",
  "priority": "high|medium|low",
  "summary": "สรุปสั้นๆ ภาษาไทย",
  "suggestedAction": "การกระทำที่แนะนำ"
}`
    }],
  });

  const text = response.content[0].type === 'text' ? response.content[0].text : '{}';
  return JSON.parse(text) as FeedbackAnalysis;
}

// ทดสอบ
const feedbacks = [
  'ส่งของเร็วมากครับ แต่กล่องยุบนิดหน่อย สินค้าโอเค',
  'รอนาน 2 อาทิตย์แล้วยังไม่ได้ของเลย โกรธมากๆ',
  'ราคาดีครับ คุณภาพคุ้มค่า จะสั่งอีกแน่นอน',
];

for (const feedback of feedbacks) {
  const analysis = await analyzeFeedback(feedback);
  console.log(`\nFeedback: "${feedback}"`);
  console.log(`Sentiment: ${analysis.sentiment} | Priority: ${analysis.priority}`);
  console.log(`Summary: ${analysis.summary}`);
  console.log(`Action: ${analysis.suggestedAction}`);
}
