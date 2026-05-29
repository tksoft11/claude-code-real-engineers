// mobile/src/services/api.service.ts
// Service สำหรับคุยกับ Backend API ของเรา (ไม่ใช่ Anthropic โดยตรง)

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL || 'http://localhost:3000';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface StreamChunk {
  type: 'chunk' | 'done' | 'error';
  text?: string;
  message?: string;
  inputTokens?: number;
  outputTokens?: number;
}

export async function getAuthToken(): Promise<string> {
  // ดึง JWT token จาก Secure Storage (expo-secure-store)
  // ในตัวอย่างนี้ใช้ placeholder
  return 'your-jwt-token';
}

// ฟังก์ชันหลักสำหรับส่งข้อความและรับ Stream
export async function* streamChatMessage(
  messages: ChatMessage[],
  system?: string
): AsyncGenerator<StreamChunk> {
  const token = await getAuthToken();

  const response = await fetch(`${BACKEND_URL}/api/ai/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({ messages, system }),
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${await response.text()}`);
  }

  // อ่าน SSE Stream ทีละ chunk
  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      if (line.startsWith('data: ')) {
        try {
          const chunk: StreamChunk = JSON.parse(line.slice(6));
          yield chunk;
          if (chunk.type === 'done' || chunk.type === 'error') return;
        } catch {
          // ข้าม malformed JSON
        }
      }
    }
  }
}
