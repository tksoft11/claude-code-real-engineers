// tools ที่เพิ่มเติม
const slackTools: Anthropic.Tool[] = [
  {
    name: 'post_slack_message',
    description: 'ส่งข้อความไปยัง Slack channel',
    input_schema: {
      type: 'object' as const,
      properties: {
        channel: { type: 'string', description: 'Channel ID หรือ #channel-name' },
        message: { type: 'string', description: 'ข้อความที่จะส่ง' },
        urgency: { type: 'string', enum: ['normal', 'urgent'], description: 'urgent จะ @here' },
      },
      required: ['channel', 'message'],
    },
  },
  {
    name: 'get_on_call_engineer',
    description: 'ดูว่า engineer คนไหน on-call ตอนนี้',
    input_schema: {
      type: 'object' as const,
      properties: {},
      required: [],
    },
  },
];

// Prompt สำหรับ incident ฉุกเฉิน
const INCIDENT_PROMPT = `เมื่อเกิด incident:
1. สร้าง Jira ticket ด้วย priority Highest
2. ดูว่าใคร on-call ตอนนี้
3. ส่งแจ้ง @mention engineer นั้นใน #incidents channel
4. Post สรุปใน #engineering channel

ทำทั้งหมดนี้ใน 1 response`;

await runWithTools(
  'production database ล่ม ทุกระบบพัง',
  INCIDENT_PROMPT
);
// Claude จะเรียก 4 tools ต่อกันใน 1 session!
