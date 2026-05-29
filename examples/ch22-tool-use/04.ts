// jira-whisperer.ts
import { runWithTools } from './agents/tool-agent';

const SYSTEM_PROMPT = `คุณคือ AI ผู้ช่วยสำหรับทีม Engineering ที่ดูแล Jira

เมื่อได้รับรายงาน bug หรือ request:
1. วิเคราะห์ว่าเป็น bug, feature request, หรืองานทั่วไป
2. สร้าง Jira ticket ด้วยข้อมูลที่ครบถ้วน
3. ตั้ง priority ตามความรุนแรง:
   - Production down / ลูกค้าไม่สามารถใช้งาน → Highest
   - Feature หลักใช้ไม่ได้ → High
   - งานทั่วไป → Medium
4. เพิ่ม labels ที่เหมาะสม
5. รายงานผลพร้อม ticket URL

ตอบเป็นภาษาไทยเสมอ`;

// Slack message handler
async function handleSlackMessage(message: string, channelId: string) {
  console.log(`📨 Received: "${message}"`);

  const result = await runWithTools(message, SYSTEM_PROMPT);

  // ส่งกลับ Slack
  await slackClient.chat.postMessage({
    channel: channelId,
    text: result,
  });
}

// ทดสอบ
await handleSlackMessage(
  'มีบั๊กใน payment module! ลูกค้า checkout ไม่ได้ตั้งแต่ 2 ชั่วโมงที่แล้ว กระทบลูกค้าทั้งหมด',
  '#engineering'
);

// Claude จะ:
// 1. วิเคราะห์: Production issue, กระทบทุกคน → Highest priority
// 2. เรียก create_jira_ticket({ summary: "Payment Checkout Broken...", priority: "Highest", ... })
// 3. ได้ TECH-456 กลับมา
// 4. ตอบกลับ: "สร้าง ticket TECH-456 เรียบร้อยแล้ว: [link]"
