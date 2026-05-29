// src/figma-to-code/generate-design-md.ts
async function generateDesignMd(
  mockupPaths: string[],
  projectName: string
): Promise<string> {

  // อ่านรูปทั้งหมด (Claude รับได้สูงสุด 20 รูปต่อ request)
  const imageContents = mockupPaths.slice(0, 5).map(path => ({
    type: 'image' as const,
    source: {
      type: 'base64' as const,
      media_type: 'image/png' as const,
      data: fs.readFileSync(path).toString('base64'),
    },
  }));

  const response = await client.messages.create({
    model: 'claude-sonnet-4-5',
    max_tokens: 8192,
    messages: [
      {
        role: 'user',
        content: [
          ...imageContents,
          {
            type: 'text',
            text: `สร้าง DESIGN.md สมบูรณ์สำหรับโปรเจกต์ ${projectName}

จาก mockups เหล่านี้ สร้างเอกสาร DESIGN.md ที่ครอบคลุม:

# ${projectName} Design System

## 🎨 Color Palette
[ระบุสีทั้งหมดพร้อม hex code และ use case]

## 📐 Typography
[ระบุ font family, sizes, weights, line heights]

## 📦 Component Library
[แสดง component แต่ละตัวพร้อม usage example และ props]

## 📱 Responsive Breakpoints
[ระบุ breakpoints ที่เห็น]

## 🎭 States & Variants
[default, hover, active, disabled, error สำหรับ components หลัก]

## 🚫 Anti-Patterns
[สิ่งที่ไม่ควรทำ ห้าม inline style, ห้าม custom colors นอก palette ฯลฯ]

Format เป็น Markdown ที่พร้อม commit ขึ้น Git ได้ทันที`,
          },
        ],
      },
    ],
  });

  return response.content[0].type === 'text' ? response.content[0].text : '';
}
