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
