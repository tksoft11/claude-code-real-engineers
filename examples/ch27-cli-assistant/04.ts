// src/tools.ts
import Anthropic from '@anthropic-ai/sdk';
import fs from 'fs';
import path from 'path';

export const fileTools: Anthropic.Tool[] = [
  {
    name: 'read_file',
    description: 'อ่านไฟล์จาก working directory',
    input_schema: {
      type: 'object' as const,
      properties: {
        filepath: { type: 'string', description: 'path ของไฟล์ที่ต้องการอ่าน' },
      },
      required: ['filepath'],
    },
  },
  {
    name: 'write_file',
    description: 'เขียนหรือสร้างไฟล์ใน working directory',
    input_schema: {
      type: 'object' as const,
      properties: {
        filepath: { type: 'string', description: 'path ของไฟล์' },
        content: { type: 'string', description: 'เนื้อหาที่จะเขียน' },
      },
      required: ['filepath', 'content'],
    },
  },
  {
    name: 'list_files',
    description: 'แสดงรายการไฟล์ในโฟลเดอร์',
    input_schema: {
      type: 'object' as const,
      properties: {
        directory: { type: 'string', description: 'โฟลเดอร์ที่ต้องการดู (default: .)' },
      },
      required: [],
    },
  },
];

export async function executeTool(
  name: string,
  input: Record<string, string>,
  workingDir: string
): Promise<string> {
  // Security: ห้ามออกนอก working directory
  const safePath = (p: string) => {
    const resolved = path.resolve(workingDir, p);
    if (!resolved.startsWith(workingDir)) {
      throw new Error(`Access denied: ${p} is outside working directory`);
    }
    return resolved;
  };

  switch (name) {
    case 'read_file': {
      const fullPath = safePath(input.filepath);
      if (!fs.existsSync(fullPath)) return `File not found: ${input.filepath}`;
      const content = fs.readFileSync(fullPath, 'utf-8');
      return content.slice(0, 50000); // limit 50K chars
    }

    case 'write_file': {
      const fullPath = safePath(input.filepath);
      fs.mkdirSync(path.dirname(fullPath), { recursive: true });
      fs.writeFileSync(fullPath, input.content, 'utf-8');
      return `✅ Written ${input.content.length} chars to ${input.filepath}`;
    }

    case 'list_files': {
      const dir = safePath(input.directory || '.');
      const items = fs.readdirSync(dir, { withFileTypes: true });
      return items
        .map(i => `${i.isDirectory() ? '📁' : '📄'} ${i.name}`)
        .join('\n');
    }

    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}
