// วิธีนี้ใช้ได้แต่ไม่น่าเชื่อถือ 100%
const response = await client.messages.create({
  model: 'claude-haiku-4-5',
  max_tokens: 512,
  system: `ตอบด้วย JSON เท่านั้น ไม่มีข้อความอื่น
  Format ที่ต้องการ:
  {
    "sentiment": "positive" | "negative" | "neutral",
    "score": number (0-10),
    "category": "product" | "delivery" | "service" | "other",
    "summary": string
  }`,
  messages: [{ role: 'user', content: feedback }],
});

// ปัญหา: Claude อาจเพิ่ม markdown code block หรือ prefix text
const raw = response.content[0].text;
// "