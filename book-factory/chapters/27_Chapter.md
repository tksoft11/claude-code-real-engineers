# บทที่ 27: สร้าง CLI AI Assistant ของตัวเอง — จำลอง Claude Code

---

## 🪝 ใต้ฝากระโปรงของ Claude Code

ตลอด Volume 1 และ 2 คุณใช้ `claude` command ทุกวัน แต่เคยสงสัยไหมว่ามันทำงานอย่างไร?

เมื่อคุณพิมพ์ `claude` แล้ว Enter:
1. CLI อ่าน `CLAUDE.md` ใน directory ปัจจุบัน
2. วนรับ input จากผู้ใช้
3. ส่งไปยัง Anthropic API พร้อม system prompt
4. Stream response กลับมาทีละ token
5. Handle slash commands พิเศษ (`/clear`, `/compact`)
6. ให้ Claude อ่าน/เขียนไฟล์ได้ผ่าน Tool Use

บทนี้จะสร้าง **MiniClaude** — CLI AI ที่ทำงานเหมือนกันในหลักการ

จุดประสงค์ไม่ใช่แข่งกับ Claude Code แต่เพื่อ **เข้าใจ** ว่าระบบที่คุณพึ่งพาทุกวันทำงานยังไง และเพื่อสร้าง custom CLI สำหรับ use case เฉพาะของบริษัท

---

## 🏗️ Architecture ของ MiniClaude

```
┌─────────────────────────────────────────────────────┐
│                    MiniClaude CLI                   │
├─────────────────────────────────────────────────────┤
│  main.ts          ← Entry point + main loop         │
│  config.ts        ← โหลด CLAUDE.md + settings       │
│  conversation.ts  ← จัดการ message history          │
│  tools.ts         ← File read/write tools           │
│  commands.ts      ← /clear /help /save              │
│  display.ts       ← Streaming output + colors       │
└─────────────────────────────────────────────────────┘
```

---

## 📦 Setup

```bash
mkdir mini-claude && cd mini-claude
npm init -y
npm install @anthropic-ai/sdk dotenv chalk readline
npm install -D typescript ts-node @types/node

# tsconfig.json
npx tsc --init --target ES2022 --module commonjs
```

---

## ⚙️ config.ts — โหลด CLAUDE.md

```typescript
// src/config.ts
import fs from 'fs';
import path from 'path';

export interface CLIConfig {
  systemPrompt: string;
  model: string;
  maxTokens: number;
  workingDir: string;
}

export function loadConfig(workingDir: string): CLIConfig {
  let systemPrompt = 'You are a helpful AI assistant. Answer concisely.';

  // โหลด CLAUDE.md ถ้ามี
  const claudeMdPath = path.join(workingDir, 'CLAUDE.md');
  if (fs.existsSync(claudeMdPath)) {
    const content = fs.readFileSync(claudeMdPath, 'utf-8');
    systemPrompt = content;
    console.log(`✅ Loaded CLAUDE.md (${content.length} chars)`);
  }

  return {
    systemPrompt,
    model: process.env.CLAUDE_MODEL || 'claude-sonnet-4-5',
    maxTokens: parseInt(process.env.MAX_TOKENS || '8192'),
    workingDir,
  };
}
```

---

## 💬 conversation.ts — Message History

```typescript
// src/conversation.ts
import Anthropic from '@anthropic-ai/sdk';

type Message = Anthropic.MessageParam;

export class Conversation {
  private history: Message[] = [];
  private maxMessages: number;

  constructor(maxMessages = 50) {
    this.maxMessages = maxMessages;
  }

  add(role: 'user' | 'assistant', content: string): void {
    this.history.push({ role, content });

    // Trim เก่าสุดออกถ้าเกิน limit (เก็บ pairs)
    while (this.history.length > this.maxMessages) {
      this.history.splice(0, 2);
    }
  }

  getHistory(): Message[] {
    return [...this.history];
  }

  clear(): void {
    this.history = [];
    console.log('🗑️  Conversation cleared');
  }

  compact(summary: string): void {
    // เก็บแค่ summary แทน history ทั้งหมด
    this.history = [{
      role: 'user',
      content: `[Previous conversation summary: ${summary}]`,
    }, {
      role: 'assistant',
      content: 'Understood. I will continue from this context.',
    }];
    console.log('🗜️  Conversation compacted');
  }

  get tokenEstimate(): number {
    // rough estimate: 4 chars per token
    const totalChars = this.history.reduce((sum, m) =>
      sum + (typeof m.content === 'string' ? m.content.length : 0), 0);
    return Math.round(totalChars / 4);
  }
}
```

---

## 🔧 tools.ts — File Access Tools

```typescript
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
```

---

## 🎯 commands.ts — Slash Commands

```typescript
// src/commands.ts
import { Conversation } from './conversation';
import Anthropic from '@anthropic-ai/sdk';

interface CommandResult {
  handled: boolean;
  exit?: boolean;
  message?: string;
}

export async function handleCommand(
  input: string,
  conversation: Conversation,
  client: Anthropic,
  systemPrompt: string
): Promise<CommandResult> {
  const [cmd, ...args] = input.trim().split(' ');

  switch (cmd) {
    case '/clear':
      conversation.clear();
      return { handled: true };

    case '/compact': {
      if (conversation.getHistory().length === 0) {
        return { handled: true, message: 'Nothing to compact' };
      }
      // ให้ Claude สรุปการสนทนา
      const summaryRes = await client.messages.create({
        model: 'claude-haiku-4-5',
        max_tokens: 500,
        messages: [
          ...conversation.getHistory(),
          { role: 'user', content: 'Summarize our conversation in 3-5 sentences. Focus on key decisions and context needed to continue.' },
        ],
      });
      const summary = summaryRes.content[0].type === 'text' ? summaryRes.content[0].text : '';
      conversation.compact(summary);
      return { handled: true };
    }

    case '/tokens':
      return { handled: true, message: `~${conversation.tokenEstimate.toLocaleString()} tokens in history` };

    case '/help':
      return {
        handled: true,
        message: [
          '/clear    — ล้าง conversation history',
          '/compact  — สรุปและบีบอัด history',
          '/tokens   — ดู token estimate',
          '/save     — บันทึก conversation',
          '/exit     — ออกจากโปรแกรม',
        ].join('\n'),
      };

    case '/save': {
      const filename = args[0] || `conversation_${Date.now()}.json`;
      const { writeFileSync } = await import('fs');
      writeFileSync(filename, JSON.stringify(conversation.getHistory(), null, 2));
      return { handled: true, message: `Saved to ${filename}` };
    }

    case '/exit':
    case '/quit':
      return { handled: true, exit: true };

    default:
      return { handled: false };
  }
}
```

---

## 🚀 main.ts — The Main Loop

```typescript
// src/main.ts
import Anthropic from '@anthropic-ai/sdk';
import * as readline from 'readline';
import chalk from 'chalk';
import 'dotenv/config';
import path from 'path';

import { loadConfig } from './config';
import { Conversation } from './conversation';
import { fileTools, executeTool } from './tools';
import { handleCommand } from './commands';

const client = new Anthropic();
const workingDir = process.cwd();
const config = loadConfig(workingDir);
const conversation = new Conversation();

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

console.log(chalk.cyan('\n🤖 MiniClaude — Your Personal AI CLI'));
console.log(chalk.gray(`Working in: ${workingDir}`));
console.log(chalk.gray('Type /help for commands\n'));

async function chat(userInput: string): Promise<void> {
  conversation.add('user', userInput);

  process.stdout.write(chalk.green('\nAssistant: '));

  let fullResponse = '';

  try {
    // ใช้ streaming + tools
    const stream = await client.messages.stream({
      model: config.model,
      max_tokens: config.maxTokens,
      system: config.systemPrompt,
      tools: fileTools,
      messages: conversation.getHistory(),
    });

    for await (const event of stream) {
      // Stream text ทีละตัวอักษร
      if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
        process.stdout.write(event.delta.text);
        fullResponse += event.delta.text;
      }
    }

    const finalMessage = await stream.finalMessage();

    // Handle tool calls ถ้ามี
    if (finalMessage.stop_reason === 'tool_use') {
      console.log(); // newline

      const toolResults: Anthropic.ToolResultBlockParam[] = [];

      for (const block of finalMessage.content) {
        if (block.type !== 'tool_use') continue;

        console.log(chalk.yellow(`\n🔧 Using tool: ${block.name}`));

        try {
          const result = await executeTool(block.name, block.input as any, workingDir);
          console.log(chalk.gray(result.slice(0, 200) + (result.length > 200 ? '...' : '')));
          toolResults.push({ type: 'tool_result', tool_use_id: block.id, content: result });
        } catch (err: any) {
          toolResults.push({ type: 'tool_result', tool_use_id: block.id, content: err.message, is_error: true });
        }
      }

      // Add assistant message + tool results then get final answer
      conversation.add('assistant', finalMessage.content
        .filter(b => b.type === 'text')
        .map(b => b.type === 'text' ? b.text : '').join(''));

      // Second turn with tool results
      process.stdout.write(chalk.green('\nAssistant: '));
      const stream2 = await client.messages.stream({
        model: config.model,
        max_tokens: config.maxTokens,
        system: config.systemPrompt,
        tools: fileTools,
        messages: [
          ...conversation.getHistory(),
          { role: 'assistant', content: finalMessage.content },
          { role: 'user', content: toolResults },
        ],
      });

      fullResponse = '';
      for await (const event of stream2) {
        if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
          process.stdout.write(event.delta.text);
          fullResponse += event.delta.text;
        }
      }
    }

    console.log('\n');
    conversation.add('assistant', fullResponse);

  } catch (error: any) {
    console.error(chalk.red(`\nError: ${error.message}`));
  }
}

// Main loop
function prompt(): void {
  rl.question(chalk.blue('You: '), async (input) => {
    input = input.trim();
    if (!input) return prompt();

    // Handle slash commands
    if (input.startsWith('/')) {
      const result = await handleCommand(input, conversation, client, config.systemPrompt);
      if (result.exit) {
        console.log(chalk.cyan('Goodbye! 👋'));
        rl.close();
        process.exit(0);
      }
      if (result.message) console.log(chalk.gray(result.message));
      if (result.handled) return prompt();
    }

    await chat(input);
    prompt();
  });
}

prompt();
```

---

## 🏃 รัน MiniClaude

```bash
# รันใน project directory ที่มี CLAUDE.md
cd ~/my-project
ts-node ~/mini-claude/src/main.ts

# Output:
# ✅ Loaded CLAUDE.md (1,234 chars)
# 🤖 MiniClaude — Your Personal AI CLI
# Working in: /Users/you/my-project

# You: อ่านไฟล์ package.json ให้หน่อย
# 🔧 Using tool: read_file
# Assistant: ไฟล์ package.json ระบุว่า...

# You: /compact
# 🗜️  Conversation compacted

# You: /tokens
# ~2,340 tokens in history
```

---

## 🎯 สรุปบทที่ 27

| ส่วนประกอบ | สิ่งที่สร้าง |
|-----------|-------------|
| config.ts | โหลด CLAUDE.md เป็น system prompt |
| conversation.ts | จัดการ history + /compact |
| tools.ts | read/write/list files พร้อม security |
| commands.ts | /clear /compact /tokens /save /exit |
| main.ts | Main loop + streaming + tool execution |

**บทเรียนสำคัญ:** Claude Code เป็น Loop ธรรมดา: รับ input → ส่ง API → stream output → handle tools → วนซ้ำ — คุณสร้างได้เองใน 200 บรรทัด

---

## 📋 Action Items ก่อนไปบทที่ 28

- [ ] Build MiniClaude แล้วรันใน project จริง
- [ ] เพิ่ม tool ใหม่: `run_command` สำหรับรัน shell commands
- [ ] เพิ่ม `/model` command เพื่อสลับ model กลางคัน
- [ ] เพิ่ม conversation history ที่ persist ลง disk
- [ ] ใช้ CLAUDE.md ของโปรเจกต์จริงทดสอบว่า MiniClaude เข้าใจบริบทไหม

---

*ใน **บทที่ 28** เราจะสร้าง Assertion Loop & Bug Hunter — ระบบที่รัน tests อัตโนมัติ แล้วส่ง failure กลับให้ Claude แก้ไขเป็นวงวนจนกว่าทุก test จะผ่านครับ*
