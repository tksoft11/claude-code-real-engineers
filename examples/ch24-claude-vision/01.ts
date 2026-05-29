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
