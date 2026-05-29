// src/figma-to-code/generate-components.ts
async function generateReactComponent(
  imagePath: string,
  componentName: string,
  tokens: object
): Promise<string> {
  const prompt = `ดู UI component ในรูปและสร้าง React component

Component name: ${componentName}

Design tokens ที่ทีมใช้อยู่:
${JSON.stringify(tokens, null, 2)}

Requirements:
- ใช้ TypeScript
- ใช้ Tailwind CSS classes (ห้าม inline styles)
- ใช้ Design tokens ที่ให้ไว้ (อาจต้องสร้าง custom Tailwind config สำหรับ brand colors)
- แยก interface ของ Props ออกมา
- เพิ่ม className prop สำหรับ custom styling
- เพิ่ม aria attributes สำหรับ accessibility
- Export default component

สร้างเฉพาะ TypeScript/TSX code เท่านั้น ไม่มีคำอธิบายเพิ่มเติม`;

  return analyzeLocalImage(imagePath, prompt);
}

// ตัวอย่างการใช้งาน
const tokens = await extractDesignTokens('./mockups/design-system.png');

const buttonComponent = await generateReactComponent(
  './mockups/button-variants.png',
  'Button',
  tokens
);

const cardComponent = await generateReactComponent(
  './mockups/card-component.png',
  'Card',
  tokens
);

// บันทึกไฟล์
fs.writeFileSync('./src/components/ui/Button.tsx', buttonComponent);
fs.writeFileSync('./src/components/ui/Card.tsx', cardComponent);
