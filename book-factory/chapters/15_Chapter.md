# บทที่ 15: Streaming Responses — UX ระดับโลก ให้ AI ตอบทีละตัวอักษร

---

## 🪝 ทดสอบนี้ก่อนอ่านต่อ

เปิด Claude.ai ขึ้นมา ถามคำถามยาวๆ สักข้อ

สังเกตว่า Claude ไม่ได้ "รอคิด 10 วินาที แล้วโชว์คำตอบทั้งหมดพร้อมกัน"

มันตอบทีละคำ ทีละประโยค เหมือนมีคนพิมพ์ให้ดูแบบ live

**นั่นคือ Streaming** ครับ

เปรียบเทียบประสบการณ์:

```
❌ ไม่มี Streaming:
  [กด Enter] → ⏳ รอ... รอ... รอ... 8 วินาที → ✅ โชว์คำตอบทั้งหมดพร้อมกัน
  ผู้ใช้: "มันพัง? AI ยังคิดอยู่ไหม? หรือ timeout?"

✅ มี Streaming:
  [กด Enter] → ตัวแรกปรากฏใน 0.3 วินาที → ไหลออกมาเรื่อยๆ
  ผู้ใช้: "AI กำลังตอบอยู่" → ไม่กังวล ไม่สับสน
```

ความแตกต่างนี้คือเส้นแบ่งระหว่าง "ระบบที่น่าใช้" และ "ระบบที่น่าเบื่อ"

---

## 🧠 Streaming ทำงานอย่างไร

Claude ไม่ได้ "คิดคำตอบทั้งหมดก่อนแล้วส่ง" — มันสร้างคำตอบทีละ token:

```
ไม่มี Streaming:
Claude สร้าง token ทีละตัว → เก็บไว้จนครบ → ส่งทั้งหมดพร้อมกัน → คุณรอ

มี Streaming:
Claude สร้าง token → ส่งทันที → คุณเห็น
               สร้าง token → ส่งทันที → คุณเห็นเพิ่ม
                         ...ต่อเนื่อง
```

Protocol ที่ใช้: **Server-Sent Events (SSE)** — connection เดียวที่ server push ข้อมูลมาเรื่อยๆ

---

## 💻 Streaming ขั้นพื้นฐาน

### Python

```python
# streaming_basic.py
import anthropic
from dotenv import load_dotenv

load_dotenv()
client = anthropic.Anthropic()

# วิธีที่ 1: ใช้ context manager (แนะนำ)
with client.messages.stream(
    model="claude-sonnet-4-5",
    max_tokens=1024,
    messages=[{"role": "user", "content": "อธิบาย Docker ให้เข้าใจง่ายใน 5 ข้อ"}],
) as stream:
    for text in stream.text_stream:
        print(text, end="", flush=True)  # พิมพ์ทีละ token ไม่ขึ้นบรรทัด

print()  # ขึ้นบรรทัดใหม่เมื่อจบ

# วิธีที่ 2: ดู events ทั้งหมด (สำหรับ debug)
with client.messages.stream(
    model="claude-sonnet-4-5",
    max_tokens=512,
    messages=[{"role": "user", "content": "Hello!"}],
) as stream:
    for event in stream:
        if event.type == "content_block_delta":
            print(f"token: {event.delta.text}", end="")
        elif event.type == "message_stop":
            print(f"\n\nDone! Usage: {stream.get_final_message().usage}")
```

### TypeScript

```typescript
// streaming_basic.ts
import Anthropic from '@anthropic-ai/sdk';
import 'dotenv/config';

const client = new Anthropic();

async function streamBasic() {
  // วิธีที่ 1: stream helper (แนะนำ)
  const stream = await client.messages.stream({
    model: 'claude-sonnet-4-5',
    max_tokens: 1024,
    messages: [{ role: 'user', content: 'อธิบาย Docker ให้เข้าใจง่ายใน 5 ข้อ' }],
  });

  // รับ text ทีละ chunk
  for await (const chunk of stream) {
    if (
      chunk.type === 'content_block_delta' &&
      chunk.delta.type === 'text_delta'
    ) {
      process.stdout.write(chunk.delta.text);
    }
  }

  // รับ final message เมื่อเสร็จ
  const finalMessage = await stream.finalMessage();
  console.log('\n\nUsage:', finalMessage.usage);
}

streamBasic();
```

---

## 🌐 Streaming ใน Web App (Node.js Backend)

การ implement streaming บน web ต้องใช้ **Server-Sent Events (SSE)**:

### Backend: Express.js + SSE

```typescript
// src/routes/chat.ts
import express from 'express';
import Anthropic from '@anthropic-ai/sdk';

const router = express.Router();
const client = new Anthropic();

router.post('/stream', async (req, res) => {
  const { messages, systemPrompt } = req.body;

  // ตั้งค่า SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.flushHeaders(); // ส่ง headers ทันที

  try {
    const stream = await client.messages.stream({
      model: 'claude-sonnet-4-5',
      max_tokens: 2048,
      system: systemPrompt || 'ตอบเป็นภาษาไทยเสมอ',
      messages,
    });

    // Forward แต่ละ token ไปยัง client
    for await (const chunk of stream) {
      if (
        chunk.type === 'content_block_delta' &&
        chunk.delta.type === 'text_delta'
      ) {
        // SSE format: "data: {json}\n\n"
        res.write(`data: ${JSON.stringify({ text: chunk.delta.text })}\n\n`);
      }
    }

    // บอก client ว่าเสร็จแล้ว
    const finalMsg = await stream.finalMessage();
    res.write(`data: ${JSON.stringify({
      done: true,
      usage: finalMsg.usage,
    })}\n\n`);

  } catch (error) {
    res.write(`data: ${JSON.stringify({ error: 'Streaming failed' })}\n\n`);
  } finally {
    res.end();
  }
});

export default router;
```

### Frontend: Vanilla JavaScript

```html
<!-- chat.html -->
<!DOCTYPE html>
<html lang="th">
<head>
  <meta charset="UTF-8">
  <title>AI Chat with Streaming</title>
  <style>
    body { font-family: sans-serif; max-width: 800px; margin: 40px auto; padding: 20px; }
    #chat-box { border: 1px solid #ddd; height: 400px; overflow-y: auto; padding: 16px; border-radius: 8px; }
    .message { margin: 12px 0; padding: 10px 14px; border-radius: 8px; }
    .user { background: #e3f2fd; text-align: right; }
    .assistant { background: #f5f5f5; }
    .typing-cursor { display: inline-block; width: 2px; height: 1em; background: #333; animation: blink 1s infinite; }
    @keyframes blink { 0%, 100% { opacity: 1; } 50% { opacity: 0; } }
    #input-area { display: flex; gap: 8px; margin-top: 12px; }
    #user-input { flex: 1; padding: 10px; border: 1px solid #ddd; border-radius: 6px; }
    button { padding: 10px 20px; background: #1976d2; color: white; border: none; border-radius: 6px; cursor: pointer; }
    button:disabled { background: #90caf9; cursor: not-allowed; }
  </style>
</head>
<body>
  <h2>🤖 AI Assistant</h2>
  <div id="chat-box"></div>
  <div id="input-area">
    <input id="user-input" type="text" placeholder="พิมพ์ข้อความ..." />
    <button id="send-btn" onclick="sendMessage()">ส่ง</button>
  </div>

  <script>
    const chatBox = document.getElementById('chat-box');
    const userInput = document.getElementById('user-input');
    const sendBtn = document.getElementById('send-btn');
    const conversationHistory = [];

    async function sendMessage() {
      const text = userInput.value.trim();
      if (!text) return;

      // แสดง user message
      addMessage('user', text);
      conversationHistory.push({ role: 'user', content: text });
      userInput.value = '';
      sendBtn.disabled = true;

      // สร้าง assistant message box พร้อม typing cursor
      const assistantDiv = addMessage('assistant', '');
      const cursor = document.createElement('span');
      cursor.className = 'typing-cursor';
      assistantDiv.appendChild(cursor);

      let fullResponse = '';

      try {
        // เรียก streaming endpoint
        const response = await fetch('/api/chat/stream', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ messages: conversationHistory }),
        });

        const reader = response.body.getReader();
        const decoder = new TextDecoder();

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          // Parse SSE data
          const lines = decoder.decode(value).split('\n');
          for (const line of lines) {
            if (!line.startsWith('data: ')) continue;

            const data = JSON.parse(line.slice(6));

            if (data.text) {
              fullResponse += data.text;
              // อัปเดต text โดยเก็บ cursor ไว้
              assistantDiv.textContent = fullResponse;
              assistantDiv.appendChild(cursor);
              chatBox.scrollTop = chatBox.scrollHeight;
            }

            if (data.done) {
              cursor.remove(); // เอา cursor ออกเมื่อเสร็จ
            }
          }
        }

        // บันทึก response เข้า history
        conversationHistory.push({ role: 'assistant', content: fullResponse });

      } catch (error) {
        assistantDiv.textContent = 'เกิดข้อผิดพลาด กรุณาลองใหม่';
        cursor.remove();
      } finally {
        sendBtn.disabled = false;
        userInput.focus();
      }
    }

    function addMessage(role, text) {
      const div = document.createElement('div');
      div.className = `message ${role}`;
      div.textContent = text;
      chatBox.appendChild(div);
      chatBox.scrollTop = chatBox.scrollHeight;
      return div;
    }

    // กด Enter เพื่อส่ง
    userInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter' && !sendBtn.disabled) sendMessage();
    });
  </script>
</body>
</html>
```

---

## 🎛️ Streaming UX Patterns ขั้นสูง

### Pattern 1: Abort / Cancel Stream

```typescript
// ให้ user cancel ได้กลางคัน
let currentController: AbortController | null = null;

async function streamWithAbort(prompt: string) {
  // cancel stream เก่า ถ้ามี
  if (currentController) {
    currentController.abort();
  }
  currentController = new AbortController();

  try {
    const stream = await client.messages.stream(
      {
        model: 'claude-sonnet-4-5',
        max_tokens: 2048,
        messages: [{ role: 'user', content: prompt }],
      },
      { signal: currentController.signal } // ส่ง abort signal
    );

    for await (const chunk of stream) {
      if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
        process.stdout.write(chunk.delta.text);
      }
    }
  } catch (error: any) {
    if (error.name === 'AbortError') {
      console.log('\n[Stream cancelled by user]');
    } else {
      throw error;
    }
  }
}

// ใน frontend — ปุ่ม Stop
document.getElementById('stop-btn')?.addEventListener('click', () => {
  currentController?.abort();
});
```

### Pattern 2: Streaming + Token Counter (Cost Awareness)

```typescript
async function streamWithCostTracking(prompt: string) {
  let inputTokens = 0;
  let outputTokens = 0;

  const stream = await client.messages.stream({
    model: 'claude-sonnet-4-5',
    max_tokens: 2048,
    messages: [{ role: 'user', content: prompt }],
  });

  for await (const event of stream) {
    if (event.type === 'message_start') {
      inputTokens = event.message.usage.input_tokens;
    }
    if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
      process.stdout.write(event.delta.text);
      outputTokens++;
    }
  }

  // แสดงค่าใช้จ่ายเมื่อเสร็จ
  const costUSD = (inputTokens * 0.000003) + (outputTokens * 0.000015);
  console.log(`\n\n[Tokens: ${inputTokens}in + ${outputTokens}out | Cost: $${costUSD.toFixed(5)}]`);
}
```

### Pattern 3: Streaming Fallback (ถ้า network ช้า)

```typescript
async function streamWithFallback(prompt: string, timeoutMs = 500) {
  let gotFirstChunk = false;
  const timer = setTimeout(() => {
    if (!gotFirstChunk) {
      console.log('[กำลังประมวลผล...]'); // แสดง loading indicator
    }
  }, timeoutMs);

  const stream = await client.messages.stream({
    model: 'claude-sonnet-4-5',
    max_tokens: 2048,
    messages: [{ role: 'user', content: prompt }],
  });

  for await (const chunk of stream) {
    if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
      if (!gotFirstChunk) {
        gotFirstChunk = true;
        clearTimeout(timer);
      }
      process.stdout.write(chunk.delta.text);
    }
  }
}
```

---

## 💻 Hands-On: สร้าง Streaming Chat API สมบูรณ์

```bash
mkdir streaming-chat && cd streaming-chat
npm init -y
npm install express @anthropic-ai/sdk dotenv cors
npm install -D typescript ts-node @types/express @types/node

# สร้างไฟล์หลัก
```

```typescript
// src/server.ts — Complete Streaming Chat Server
import express from 'express';
import cors from 'cors';
import Anthropic from '@anthropic-ai/sdk';
import 'dotenv/config';
import path from 'path';

const app = express();
const client = new Anthropic();

app.use(cors());
app.use(express.json());
app.use(express.static('public')); // serve HTML

// Streaming chat endpoint
app.post('/api/chat', async (req, res) => {
  const { messages, system = 'ตอบเป็นภาษาไทย กระชับ ชัดเจน' } = req.body;

  if (!messages?.length) {
    return res.status(400).json({ error: 'messages required' });
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const sendEvent = (data: object) => {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  try {
    const stream = await client.messages.stream({ model: 'claude-sonnet-4-5', max_tokens: 2048, system, messages });

    for await (const event of stream) {
      if (event.type === 'message_start') {
        sendEvent({ type: 'start', inputTokens: event.message.usage.input_tokens });
      }
      if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
        sendEvent({ type: 'text', text: event.delta.text });
      }
      if (event.type === 'message_delta') {
        sendEvent({ type: 'done', outputTokens: event.usage.output_tokens, stopReason: event.delta.stop_reason });
      }
    }
  } catch (error: any) {
    sendEvent({ type: 'error', message: error.message });
  }

  res.end();
});

app.listen(3000, () => console.log('Server: http://localhost:3000'));
```

รัน:
```bash
ts-node src/server.ts
# เปิด http://localhost:3000 แล้วลอง Chat
```

---

## 🎯 สรุปบทที่ 15

| หัวข้อ | สิ่งที่ต้องจำ |
|--------|--------------|
| ทำไมต้อง Streaming | UX ที่ดีกว่า — ผู้ใช้เห็น AI "กำลังคิด" ไม่รอเงียบ |
| Protocol | Server-Sent Events (SSE) — `text/event-stream` |
| Backend | stream() + for-await loop + res.write SSE format |
| Frontend | EventSource หรือ fetch + ReadableStream |
| Abort/Cancel | AbortController.signal ส่งไปกับ stream() |
| Cost Tracking | message_start event มี input_tokens |

---

## 📋 Action Items ก่อนไปบทที่ 16

- [ ] รัน Streaming Basic ใน Terminal เห็นคำตอบไหลออกมาทีละตัว
- [ ] สร้าง Express server พร้อม SSE endpoint
- [ ] เปิด HTML chat page แล้วทดสอบ streaming บน browser
- [ ] เพิ่มปุ่ม Stop ที่ abort stream ได้กลางคัน
- [ ] วัด latency: เวลาที่ใช้จนเห็นตัวอักษรแรก (TTFT)

---

*ใน **บทที่ 16** เราจะเรียนรู้ Model Routing & Spend Limits — วิธีเลือก Model อัตโนมัติตามความซับซ้อนของงาน และตั้งวงเงินรายวัน/รายเดือนที่ทำให้หัวหน้าทางการเงินเซ็นอนุมัติได้อย่างสบายใจครับ*
