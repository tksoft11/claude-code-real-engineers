# บทที่ 24: Claude Vision API สู่ DESIGN.md — AI อ่าน Figma แล้วเขียนโค้ด

---

## 🪝 หมดยุคพิมพ์ค่าสี Hex ทีละตัว

นางสาวพลอย Frontend Developer ได้รับ Figma file ใหม่จาก Designer

ปกติ: เปิด Figma → ดูสี → copy hex → เปิด code editor → วาง → ดูขนาด font → กลับ Figma → copy → วาง...

**กระบวนการนี้ใช้เวลา 2-3 ชั่วโมง** สำหรับ design system เล็กๆ

จากนั้นพลอยลอง export Figma เป็น PNG แล้วโยนให้ Claude:

> "โยนรูป Mockup นี้ → ได้โค้ด React + Tailwind กลับมา 95%"

ใน 3 นาที Claude ส่งกลับ:
- Design tokens (colors, fonts, spacing)
- React components พร้อมใช้
- DESIGN.md ที่ทีมใช้อ้างอิงได้

นี่คือ **The Figma-to-Code Mage** — หนึ่งใน Killer Examples ของ Volume 2

---

## 🧠 Claude Vision API: ส่งรูปไปด้วยได้เลย

Claude ไม่ได้อ่านแค่ข้อความ — มันวิเคราะห์รูปภาพได้โดยตรง

```typescript
// วิธีส่งรูปภาพไปกับ message
import Anthropic from '@anthropic-ai/sdk';
import fs from 'fs';

const client = new Anthropic();

// วิธีที่ 1: Base64 (ไฟล์ local)
async function analyzeLocalImage(imagePath: string, prompt: string) {
  const imageData = fs.readFileSync(imagePath);
  const base64 = imageData.toString('base64');
  const mediaType = 'image/png'; // image/jpeg | image/png | image/gif | image/webp

  const response = await client.messages.create({
    model: 'claude-sonnet-4-5', // Vision ต้องใช้ Sonnet หรือ Opus
    max_tokens: 4096,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: mediaType,
              data: base64,
            },
          },
          {
            type: 'text',
            text: prompt,
          },
        ],
      },
    ],
  });

  return response.content[0].type === 'text' ? response.content[0].text : '';
}

// วิธีที่ 2: URL (รูปที่ host บน internet แล้ว)
async function analyzeImageURL(imageUrl: string, prompt: string) {
  const response = await client.messages.create({
    model: 'claude-sonnet-4-5',
    max_tokens: 4096,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image',
            source: {
              type: 'url',
              url: imageUrl,
            },
          },
          {
            type: 'text',
            text: prompt,
          },
        ],
      },
    ],
  });

  return response.content[0].type === 'text' ? response.content[0].text : '';
}
```

---

## 🎨 Step 1: Extract Design Tokens จาก Mockup

```typescript
// src/figma-to-code/extract-tokens.ts
import { analyzeLocalImage } from './vision-client';

const EXTRACT_TOKENS_PROMPT = `วิเคราะห์ UI mockup นี้และ extract design tokens ทั้งหมด

ตอบใน JSON format นี้เท่านั้น:
{
  "colors": {
    "primary": "#hexcode",
    "secondary": "#hexcode",
    "background": "#hexcode",
    "surface": "#hexcode",
    "text": "#hexcode",
    "textSecondary": "#hexcode",
    "border": "#hexcode",
    "error": "#hexcode",
    "success": "#hexcode",
    "warning": "#hexcode",
    "other": { "colorName": "#hexcode" }
  },
  "typography": {
    "fontFamily": "font name",
    "sizes": {
      "h1": "size in px or rem",
      "h2": "size",
      "h3": "size",
      "body": "size",
      "small": "size",
      "caption": "size"
    },
    "weights": {
      "regular": 400,
      "medium": 500,
      "semibold": 600,
      "bold": 700
    },
    "lineHeights": {
      "tight": "1.25",
      "normal": "1.5",
      "relaxed": "1.75"
    }
  },
  "spacing": {
    "unit": 8,
    "scale": [4, 8, 12, 16, 24, 32, 48, 64]
  },
  "borderRadius": {
    "sm": "4px",
    "md": "8px",
    "lg": "16px",
    "full": "9999px"
  },
  "shadows": {
    "sm": "CSS shadow value",
    "md": "CSS shadow value",
    "lg": "CSS shadow value"
  }
}

ประมาณค่าที่ไม่แน่ใจให้ใกล้เคียงที่สุด`;

export async function extractDesignTokens(imagePath: string) {
  const raw = await analyzeLocalImage(imagePath, EXTRACT_TOKENS_PROMPT);

  try {
    // Extract JSON จาก response
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('No JSON found in response');
    return JSON.parse(jsonMatch[0]);
  } catch {
    throw new Error(`Failed to parse design tokens: ${raw.slice(0, 200)}`);
  }
}
```

---

## ⚛️ Step 2: Generate React Components

```typescript
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
```

---

## 📄 Step 3: Generate DESIGN.md อัตโนมัติ

```typescript
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
```

---

## 🚀 The Complete Figma-to-Code Pipeline

```typescript
// figma-pipeline.ts — Pipeline สมบูรณ์
import path from 'path';
import fs from 'fs/promises';

interface PipelineOptions {
  mockupsDir: string;      // โฟลเดอร์รูป Figma exports
  outputDir: string;       // โฟลเดอร์สำหรับ output
  projectName: string;
  componentNames?: string[]; // ถ้าไม่ระบุ Claude จะเดาเอง
}

async function runFigmaPipeline(options: PipelineOptions) {
  const { mockupsDir, outputDir, projectName } = options;

  console.log('🎨 Starting Figma-to-Code Pipeline...\n');

  // 1. อ่านรูปทั้งหมด
  const files = await fs.readdir(mockupsDir);
  const pngFiles = files
    .filter(f => f.endsWith('.png') || f.endsWith('.jpg'))
    .map(f => path.join(mockupsDir, f));

  console.log(`📁 Found ${pngFiles.length} mockup files`);

  // 2. Extract Design Tokens จากรูปแรก (ควรเป็น Design System overview)
  console.log('\n🔍 Extracting design tokens...');
  const tokens = await extractDesignTokens(pngFiles[0]);

  // 3. Generate components จากแต่ละรูป
  console.log('\n⚛️  Generating React components...');
  const componentsDir = path.join(outputDir, 'components/ui');
  await fs.mkdir(componentsDir, { recursive: true });

  for (const imagePath of pngFiles.slice(1)) {
    const fileName = path.basename(imagePath, path.extname(imagePath));
    const componentName = toPascalCase(fileName);

    console.log(`  → ${componentName}...`);
    const code = await generateReactComponent(imagePath, componentName, tokens);
    await fs.writeFile(path.join(componentsDir, `${componentName}.tsx`), code);
  }

  // 4. Generate tailwind config จาก tokens
  console.log('\n🎨 Generating Tailwind config...');
  const tailwindConfig = generateTailwindConfig(tokens);
  await fs.writeFile(
    path.join(outputDir, 'tailwind.config.ts'),
    tailwindConfig
  );

  // 5. Generate DESIGN.md
  console.log('\n📄 Generating DESIGN.md...');
  const designMd = await generateDesignMd(pngFiles, projectName);
  await fs.writeFile(path.join(outputDir, 'DESIGN.md'), designMd);

  // 6. Generate CSS variables
  const cssVars = generateCSSVariables(tokens);
  await fs.writeFile(path.join(outputDir, 'src/styles/tokens.css'), cssVars);

  console.log('\n✅ Pipeline complete!');
  console.log(`   Components: ${componentsDir}`);
  console.log(`   DESIGN.md:  ${path.join(outputDir, 'DESIGN.md')}`);
  console.log(`   Tailwind:   ${path.join(outputDir, 'tailwind.config.ts')}`);
}

function generateTailwindConfig(tokens: any): string {
  return `import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        primary:   '${tokens.colors?.primary || '#1976D2'}',
        secondary: '${tokens.colors?.secondary || '#388E3C'}',
        surface:   '${tokens.colors?.surface || '#FFFFFF'}',
        danger:    '${tokens.colors?.error || '#D32F2F'}',
      },
      fontFamily: {
        sans: ['${tokens.typography?.fontFamily || 'Inter'}', 'sans-serif'],
      },
      borderRadius: ${JSON.stringify(tokens.borderRadius || {})},
    },
  },
  plugins: [],
};

export default config;`;
}

function generateCSSVariables(tokens: any): string {
  const colors = Object.entries(tokens.colors || {})
    .map(([key, value]) => `  --color-${key}: ${value};`)
    .join('\n');

  return `:root {\n${colors}\n}`;
}

function toPascalCase(str: string): string {
  return str.replace(/(^\w|-\w|_\w)/g, m => m.replace(/[-_]/, '').toUpperCase());
}

// รัน pipeline
await runFigmaPipeline({
  mockupsDir: './figma-exports',
  outputDir: './src',
  projectName: 'TechShop UI',
});
```

---

## 📷 Multi-Image Analysis: ตรวจ Consistency

```typescript
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
```

---

## 💻 Hands-On: วิเคราะห์ UI Screenshot จริง

```bash
# ถ่าย screenshot หน้าเว็บที่คุณชอบ หรือ export จาก Figma
# แล้วรัน script นี้

node -e "
const { analyzeLocalImage } = require('./vision-client');

analyzeLocalImage('./screenshot.png', \`
วิเคราะห์ UI นี้และบอกฉัน:
1. Color palette (hex codes)
2. Typography system
3. Component patterns ที่เห็น
4. Design principles ที่ใช้ (Material, Apple HIG, ฯลฯ)
5. โค้ด React component สำหรับ element ที่น่าสนใจที่สุด 1 อัน
\`).then(console.log);
"
```

---

## 🎯 สรุปบทที่ 24

| หัวข้อ | สิ่งที่ต้องจำ |
|--------|--------------|
| Vision API | ส่งรูปผ่าน base64 หรือ URL ใน content array |
| Model | ต้องใช้ Sonnet หรือ Opus (ไม่ใช่ Haiku) |
| Extract Tokens | ขอ JSON format ที่ structured → parse เป็น design tokens |
| Generate Components | ส่ง tokens เป็น context → ได้ React/TypeScript กลับมา |
| DESIGN.md | ส่งหลายรูปพร้อมกัน → generate เอกสารครบถ้วน |
| Pipeline | Extract → Components → Tailwind Config → CSS Vars → DESIGN.md |

---

## 📋 Action Items ก่อนไปบทที่ 25

- [ ] Export Figma mockup เป็น PNG อย่างน้อย 3 รูป
- [ ] รัน `extractDesignTokens()` กับ mockup จริง
- [ ] Generate React component 1 ตัวจาก screenshot
- [ ] สร้าง `tailwind.config.ts` จาก tokens
- [ ] Generate DESIGN.md และ commit เข้า Git

---

*ใน **บทที่ 25** เราจะเรียนรู้ Memory Management & Vector DB — ความแตกต่างระหว่าง Context Window กับ RAG และวิธีออกแบบระบบ AI ที่จำข้อมูลได้มากกว่า context window จะรองรับ โดยใช้ Vector Database เป็น long-term memory ครับ*
