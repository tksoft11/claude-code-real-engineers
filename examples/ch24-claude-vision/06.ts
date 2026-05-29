// ตรวจว่า components ต่างๆ สอดคล้องกัน
async function checkDesignConsistency(imagePaths: string[]): Promise<string> {
  const imageContents = imagePaths.map(p => ({
    type: 'image' as const,
    source: {
      type: 'base64' as const,
      media_type: 'image/png' as const,
      data: fs.readFileSync(p).toString('base64'),
    },
  }));

  const response = await client.messages.create({
    model: 'claude-sonnet-4-5',
    max_tokens: 2048,
    messages: [{
      role: 'user',
      content: [
        ...imageContents,
        {
          type: 'text',
          text: `ตรวจสอบความสอดคล้องของ design ใน ${imagePaths.length} mockup นี้

วิเคราะห์:
1. สีที่ใช้ — ใช้ palette เดียวกันไหม?
2. Typography — font, size, weight สอดคล้องไหม?
3. Spacing — ใช้ระบบ grid/spacing เดียวกันไหม?
4. Component style — button, card, input มี style ที่ consistent ไหม?

รายงาน:
✅ สิ่งที่ consistent
❌ สิ่งที่ไม่ consistent พร้อม recommendation`,
        },
      ],
    }],
  });

  return response.content[0].type === 'text' ? response.content[0].text : '';
}
