# บทที่ 38: Mobile AI Architecture

---

## 📱 ความผิดพลาดที่นักพัฒนา Mobile ทำมากที่สุด

ลองค้นหาใน GitHub: `ANTHROPIC_API_KEY site:github.com`

คุณจะพบ API keys ที่ฝังตรงๆ ในโค้ด React Native หลายร้อยโปรเจกต์

```javascript
// ❌ สิ่งที่ไม่ควรทำ (แต่คนทำเยอะมาก)
const response = await fetch('https://api.anthropic.com/v1/messages', {
  headers: {
    'x-api-key': 'sk-ant-api03-xxxx', // ← key นี้อยู่ใน APK/IPA ที่ใครก็ download ได้
  },
});
```

**ทำไมถึงอันตราย:**
- APK และ IPA สามารถ decompile ได้ในไม่กี่นาที
- GitHub public repo = key โดนดูดใน 30 วินาที
- ใคร extract key ได้ → ใช้ quota คุณฟรี หรือส่ง prompt อะไรก็ได้

**สถาปัตยกรรมที่ถูกต้องมีกฎเดียว:**

> **API Key ต้องอยู่บน Server เท่านั้น — Mobile App คุยกับ Server ของคุณ ไม่ใช่ Anthropic โดยตรง**

---

## 🏗️ Architecture: Mobile AI ที่ถูกต้อง

```
❌ Wrong Architecture:
[React Native App] ──► [Anthropic API]
        (มี API Key ใน app)

✅ Correct Architecture:
[React Native App] ──► [Your Backend API] ──► [Anthropic API]
     (ไม่มี key)          (มี key ใน env)        (authenticated)
```

**Backend ทำหน้าที่:**
1. รับ request จาก Mobile App
2. Authenticate user (JWT token)
3. Rate limit (ป้องกัน abuse)
4. Call Anthropic ด้วย API key ที่อยู่บน server
5. Stream response กลับไป Mobile

---

## 📁 Project Structure

```
project/
├── backend/                    ← Node.js/Express
│   ├── src/
│   │   ├── routes/ai.route.ts
│   │   ├── middleware/auth.ts
│   │   ├── middleware/rateLimit.ts
│   │   └── services/claude.service.ts
│   └── .env                    ← ANTHROPIC_API_KEY อยู่ที่นี่
│
└── mobile/                     ← React Native
    ├── src/
    │   ├── hooks/useAIChat.ts
    │   ├── services/api.service.ts
    │   └── screens/ChatScreen.tsx
    └── .env                    ← มีแค่ BACKEND_URL ไม่มี AI key
```

---

## 🔧 Backend: Streaming AI API

```typescript
// backend/src/services/claude.service.ts
import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic(); // อ่าน ANTHROPIC_API_KEY จาก process.env

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export async function streamChat(
  messages: ChatMessage[],
  system: string,
  onChunk: (text: string) => void,
  onDone: (inputTokens: number, outputTokens: number) => void
): Promise<void> {
  const stream = await client.messages.create({
    model: 'claude-haiku-4-5',   // Haiku เหมาะสำหรับ mobile chat (เร็ว+ถูก)
    max_tokens: 1024,
    system,
    messages,
    stream: true,
  });

  for await (const event of stream) {
    if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
      onChunk(event.delta.text);
    }
    if (event.type === 'message_delta' && event.usage) {
      onDone(0, event.usage.output_tokens);
    }
  }
}
```

```typescript
// backend/src/routes/ai.route.ts
import { Router, Request, Response } from 'express';
import { streamChat, ChatMessage } from '../services/claude.service';
import { authMiddleware } from '../middleware/auth';
import { rateLimitMiddleware } from '../middleware/rateLimit';

const router = Router();

// POST /api/ai/chat — Streaming endpoint
router.post('/chat',
  authMiddleware,
  rateLimitMiddleware,
  async (req: Request, res: Response) => {
    const { messages, system } = req.body as {
      messages: ChatMessage[];
      system?: string;
    };

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: 'messages is required' });
    }

    // ตั้ง headers สำหรับ Server-Sent Events (SSE)
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    try {
      await streamChat(
        messages,
        system || 'คุณคือ AI assistant ที่ช่วยเหลือผู้ใช้',
        (text) => {
          // ส่ง chunk กลับไป Mobile แบบ real-time
          res.write(`data: ${JSON.stringify({ type: 'chunk', text })}\n\n`);
        },
        (inputTokens, outputTokens) => {
          res.write(`data: ${JSON.stringify({ type: 'done', inputTokens, outputTokens })}\n\n`);
        }
      );
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      res.write(`data: ${JSON.stringify({ type: 'error', message: msg })}\n\n`);
    } finally {
      res.end();
    }
  }
);

export default router;
```

```typescript
// backend/src/middleware/rateLimit.ts
import { Request, Response, NextFunction } from 'express';

// Simple in-memory rate limiter (production: ใช้ Redis)
const userRequests = new Map<string, { count: number; resetAt: number }>();

const LIMIT = 20;       // 20 requests
const WINDOW = 60_000;  // ต่อนาที

export function rateLimitMiddleware(req: Request, res: Response, next: NextFunction) {
  const userId = (req as any).userId as string;
  const now = Date.now();
  const entry = userRequests.get(userId);

  if (!entry || entry.resetAt < now) {
    userRequests.set(userId, { count: 1, resetAt: now + WINDOW });
    return next();
  }

  if (entry.count >= LIMIT) {
    return res.status(429).json({
      error: 'Rate limit exceeded',
      retryAfter: Math.ceil((entry.resetAt - now) / 1000),
    });
  }

  entry.count++;
  next();
}
```

## 📱 Mobile Client: React Native + SSE Streaming

ตอนนี้ Backend พร้อมแล้ว มาสร้าง React Native App ที่คุยกับมันกันครับ

### โครงสร้างไฟล์ Mobile App

```
mobile/
├── src/
│   ├── services/
│   │   └── api.service.ts       ← เชื่อมต่อกับ Backend API
│   ├── hooks/
│   │   └── useAIChat.ts         ← Custom Hook จัดการ Chat State + SSE
│   └── screens/
│       └── ChatScreen.tsx       ← UI หน้าจอแชท
├── .env                         ← มีแค่ BACKEND_URL (ไม่มี AI Key!)
└── app.json
```

### ขั้นตอนที่ 1: Environment Setup

```bash
# .env (mobile)
EXPO_PUBLIC_BACKEND_URL=https://your-backend.com
# ⚠️ ห้าม: ANTHROPIC_API_KEY — key ต้องอยู่บน Backend เท่านั้น!
```

```typescript
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
```

### ขั้นตอนที่ 2: Custom Hook จัดการ Chat State

```typescript
// mobile/src/hooks/useAIChat.ts
import { useState, useCallback } from 'react';
import { ChatMessage, streamChatMessage } from '../services/api.service';

interface UseChatReturn {
  messages: ChatMessage[];
  isLoading: boolean;
  error: string | null;
  sendMessage: (text: string) => Promise<void>;
  clearChat: () => void;
}

export function useAIChat(systemPrompt?: string): UseChatReturn {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || isLoading) return;

    setError(null);
    setIsLoading(true);

    // เพิ่มข้อความของ User
    const userMessage: ChatMessage = { role: 'user', content: text };
    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);

    // เตรียม placeholder สำหรับ AI Response
    const assistantPlaceholder: ChatMessage = { role: 'assistant', content: '' };
    setMessages([...updatedMessages, assistantPlaceholder]);

    try {
      let fullResponse = '';

      // รับ Stream ทีละ chunk
      for await (const chunk of streamChatMessage(updatedMessages, systemPrompt)) {
        if (chunk.type === 'chunk' && chunk.text) {
          fullResponse += chunk.text;
          // อัปเดต UI แบบ Real-time ทีละตัวอักษร
          setMessages(prev => {
            const updated = [...prev];
            updated[updated.length - 1] = {
              role: 'assistant',
              content: fullResponse
            };
            return updated;
          });
        } else if (chunk.type === 'error') {
          throw new Error(chunk.message || 'Stream error');
        }
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMsg);
      // ลบ placeholder ที่ผิดพลาด
      setMessages(prev => prev.slice(0, -1));
    } finally {
      setIsLoading(false);
    }
  }, [messages, isLoading, systemPrompt]);

  const clearChat = useCallback(() => {
    setMessages([]);
    setError(null);
  }, []);

  return { messages, isLoading, error, sendMessage, clearChat };
}
```

### ขั้นตอนที่ 3: Chat Screen UI

```tsx
// mobile/src/screens/ChatScreen.tsx
import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, FlatList,
  StyleSheet, KeyboardAvoidingView, Platform, ActivityIndicator,
  SafeAreaView
} from 'react-native';
import { useAIChat } from '../hooks/useAIChat';

interface MessageBubbleProps {
  role: 'user' | 'assistant';
  content: string;
}

function MessageBubble({ role, content }: MessageBubbleProps) {
  const isUser = role === 'user';
  return (
    <View style={[styles.bubble, isUser ? styles.userBubble : styles.aiBubble]}>
      {!isUser && (
        <Text style={styles.roleLabel}>🤖 AI Assistant</Text>
      )}
      <Text style={[styles.messageText, isUser && styles.userText]}>
        {content}
      </Text>
    </View>
  );
}

export default function ChatScreen() {
  const [inputText, setInputText] = useState('');
  const flatListRef = useRef<FlatList>(null);

  const SYSTEM_PROMPT = `คุณคือ AI Assistant ที่ช่วยเหลือผู้ใช้ตอบคำถามเกี่ยวกับการพัฒนา Software
ตอบเป็นภาษาไทยเมื่อถูกถามเป็นภาษาไทย ตอบสั้น กระชับ และเป็นประโยชน์`;

  const { messages, isLoading, error, sendMessage, clearChat } = useAIChat(SYSTEM_PROMPT);

  // Auto-scroll เมื่อมีข้อความใหม่
  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [messages]);

  const handleSend = async () => {
    if (!inputText.trim()) return;
    const text = inputText;
    setInputText('');
    await sendMessage(text);
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Claude AI Chat</Text>
        <TouchableOpacity onPress={clearChat} style={styles.clearButton}>
          <Text style={styles.clearButtonText}>ล้าง</Text>
        </TouchableOpacity>
      </View>

      {/* Chat Messages */}
      <KeyboardAvoidingView
        style={styles.chatContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={90}
      >
        {messages.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateText}>🤖</Text>
            <Text style={styles.emptyStateSubtext}>ถามอะไรก็ได้เกี่ยวกับ Software Engineering</Text>
          </View>
        ) : (
          <FlatList
            ref={flatListRef}
            data={messages}
            keyExtractor={(_, index) => index.toString()}
            renderItem={({ item }) => (
              <MessageBubble role={item.role} content={item.content} />
            )}
            contentContainerStyle={styles.messageList}
          />
        )}

        {/* Error Message */}
        {error && (
          <View style={styles.errorBanner}>
            <Text style={styles.errorText}>⚠️ {error}</Text>
          </View>
        )}

        {/* Input Bar */}
        <View style={styles.inputBar}>
          <TextInput
            style={styles.textInput}
            value={inputText}
            onChangeText={setInputText}
            placeholder="พิมพ์ข้อความ..."
            placeholderTextColor="#888"
            multiline
            maxLength={2000}
            editable={!isLoading}
            onSubmitEditing={handleSend}
          />
          <TouchableOpacity
            style={[styles.sendButton, isLoading && styles.sendButtonDisabled]}
            onPress={handleSend}
            disabled={isLoading || !inputText.trim()}
          >
            {isLoading
              ? <ActivityIndicator color="#fff" size="small" />
              : <Text style={styles.sendButtonText}>ส่ง</Text>
            }
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: 16, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e0e0e0'
  },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: '#1a1a1a' },
  clearButton: { padding: 8 },
  clearButtonText: { color: '#007AFF', fontSize: 14 },
  chatContainer: { flex: 1 },
  messageList: { padding: 16, paddingBottom: 8 },
  bubble: {
    maxWidth: '80%', marginVertical: 4, padding: 12,
    borderRadius: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1, shadowRadius: 2, elevation: 2
  },
  userBubble: { backgroundColor: '#007AFF', alignSelf: 'flex-end', borderBottomRightRadius: 4 },
  aiBubble: { backgroundColor: '#fff', alignSelf: 'flex-start', borderBottomLeftRadius: 4 },
  roleLabel: { fontSize: 11, color: '#888', marginBottom: 4 },
  messageText: { fontSize: 15, color: '#1a1a1a', lineHeight: 22 },
  userText: { color: '#fff' },
  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
  emptyStateText: { fontSize: 48, marginBottom: 12 },
  emptyStateSubtext: { fontSize: 16, color: '#888', textAlign: 'center' },
  errorBanner: {
    margin: 8, padding: 12, backgroundColor: '#FFF3CD',
    borderRadius: 8, borderLeftWidth: 4, borderLeftColor: '#FFC107'
  },
  errorText: { color: '#856404', fontSize: 13 },
  inputBar: {
    flexDirection: 'row', padding: 8, backgroundColor: '#fff',
    borderTopWidth: 1, borderTopColor: '#e0e0e0', alignItems: 'flex-end'
  },
  textInput: {
    flex: 1, borderWidth: 1, borderColor: '#ddd', borderRadius: 20,
    paddingHorizontal: 16, paddingVertical: 10, fontSize: 15,
    maxHeight: 100, backgroundColor: '#f9f9f9', marginRight: 8
  },
  sendButton: {
    backgroundColor: '#007AFF', borderRadius: 20,
    paddingHorizontal: 18, paddingVertical: 10, minWidth: 60, alignItems: 'center'
  },
  sendButtonDisabled: { backgroundColor: '#99C5FF' },
  sendButtonText: { color: '#fff', fontSize: 15, fontWeight: '600' },
});
```

---

## 🔐 Security Checklist สำหรับ Mobile AI App

ก่อน Submit ขึ้น App Store ตรวจสอบ 5 ข้อนี้:

```
✅ 1. ไม่มี API Key ในโค้ด Mobile (grep -r "sk-ant" ./mobile/src)
✅ 2. BACKEND_URL ใช้ HTTPS เสมอ (ยกเว้น localhost สำหรับ dev)
✅ 3. JWT Token เก็บใน Secure Storage ไม่ใช่ AsyncStorage
✅ 4. Rate Limit ตั้งไว้บน Backend แล้ว (ป้องกัน abuse)
✅ 5. ไม่ Log ข้อความของ User บน Mobile (Privacy)
```

---

## 🎯 สรุปบทที่ 38

| Layer | หน้าที่ |
|-------|--------|
| `claude.service.ts` (backend) | จัดการ Anthropic SDK + Streaming บน Server-side |
| `ai.route.ts` (backend) | Endpoint แบบ SSE พร้อม Auth + Rate Limit |
| `rateLimit.ts` (backend) | Middleware ป้องกัน API Abuse คุม Cost |
| `api.service.ts` (mobile) | เชื่อมต่อ Backend ผ่าน HTTPS + SSE |
| `useAIChat.ts` (mobile) | Hook จัดการ State + Stream Real-time |
| `ChatScreen.tsx` (mobile) | UI แชทที่อักษรไหลทีละตัวแบบ Claude.ai |
| Security Guideline | Zero API Key บน Client — ทุก Request ผ่าน Backend |

**กฎทองที่ต้องจำตลอดชีวิต:**
> **Mobile App คือ Frontend เท่านั้น — Secret ทุกอย่างอยู่บน Backend**

---

## 📋 Action Items ก่อนไปบทที่ 39

- [ ] สร้างและตั้งค่า Backend Service ด้วย Node.js/Express พร้อม Auth Middleware
- [ ] ติดตั้ง `@anthropic-ai/sdk` บนฝั่ง Server (**ไม่ใช่ Mobile**)
- [ ] สร้าง React Native project ด้วย Expo: `npx create-expo-app my-ai-chat`
- [ ] ทดสอบ SSE Streaming บน iOS Simulator และ Android Emulator
- [ ] ตรวจสอบ Security Checklist 5 ข้อก่อน Submit App Store

---

*ใน **บทที่ 39** เราจะต่อยอดสถาปัตยกรรมนี้ไปลงมือสร้างแอปพลิเคชัน React Native ที่สมบูรณ์มากขึ้น พร้อม Navigation, Authentication Flow และ Chat History ที่เก็บไว้ข้ามเซสชันครับ*
