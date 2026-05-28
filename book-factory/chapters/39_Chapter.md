# บทที่ 39: [Hands-on] React Native & Claude — สร้างแอปข้ามแพลตฟอร์มเชื่อม AI Backend

---

## 📱 React Native: Hook สำหรับ AI Chat

เมื่อฝั่ง Backend พร้อมส่งข้อมูลแบบ Streaming ผ่าน Server-Sent Events (SSE) แล้ว งานต่อมาคือการรับข้อมูลนี้บน Mobile App ด้วย React Native

การรับ SSE บนอุปกรณ์พกพามีความท้าทายเล็กน้อย เนื่องจากฟังก์ชัน `fetch` พื้นฐานของ Javascript บน React Native บางเวอร์ชันอาจไม่รองรับ ReadableStream เต็มรูปแบบ หรือแสดงพฤติกรรมการทยอยเก็บข้อมูลไว้จนเต็มบัฟเฟอร์ก่อนส่งต่อ (Buffer buffering behavior) ดังนั้นเราจำเป็นต้องเขียนตัวรับข้อมูลที่เหมาะสม

นี่คือการพัฒนา Custom Hook ชื่อ `useAIChat` สำหรับจัดการการเชื่อมต่อ State และลูปรับ SSE:

```typescript
// mobile/src/hooks/useAIChat.ts
import { useState, useCallback, useRef } from 'react';
import { getAuthToken } from '../services/auth.service';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  isStreaming?: boolean;
}

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL || 'http://localhost:3000';

export function useAIChat(systemPrompt?: string) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const sendMessage = useCallback(async (userText: string) => {
    if (!userText.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: userText,
    };

    const assistantMessage: Message = {
      id: (Date.now() + 1).toString(),
      role: 'assistant',
      content: '',
      isStreaming: true,
    };

    const updatedMessages = [...messages, userMessage];
    setMessages([...updatedMessages, assistantMessage]);
    setIsLoading(true);
    setError(null);

    // Abort controller สำหรับ cancel request
    abortRef.current = new AbortController();

    try {
      const token = await getAuthToken();

      const response = await fetch(`${BACKEND_URL}/api/ai/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          messages: updatedMessages.map(m => ({ role: m.role, content: m.content })),
          system: systemPrompt,
        }),
        signal: abortRef.current.signal,
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      // อ่าน SSE stream
      const reader = response.body!.getReader();
      const decoder = new TextDecoder();
      let accumulatedText = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try {
            const data = JSON.parse(line.slice(6));

            if (data.type === 'chunk') {
              accumulatedText += data.text;
              // อัปเดต UI แบบ real-time
              setMessages(prev => prev.map(m =>
                m.id === assistantMessage.id
                  ? { ...m, content: accumulatedText }
                  : m
              ));
            }

            if (data.type === 'done') {
              setMessages(prev => prev.map(m =>
                m.id === assistantMessage.id
                  ? { ...m, isStreaming: false }
                  : m
              ));
            }

            if (data.type === 'error') {
              throw new Error(data.message);
            }
          } catch {
            // skip malformed lines
          }
        }
      }
    } catch (err) {
      if ((err as Error).name === 'AbortError') return; // user ยกเลิกเอง
      const msg = err instanceof Error ? err.message : 'Connection failed';
      setError(msg);
      // ลบ assistant message ที่ว่างออก
      setMessages(prev => prev.filter(m => m.id !== assistantMessage.id));
    } finally {
      setIsLoading(false);
    }
  }, [messages, isLoading, systemPrompt]);

  const cancelStream = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const clearChat = useCallback(() => {
    setMessages([]);
    setError(null);
  }, []);

  return { messages, isLoading, error, sendMessage, cancelStream, clearChat };
}
```

---

## 🖥️ Chat Screen Component

เมื่อมี Hook สำหรับจัดการ State และดึงข้อมูลแล้ว ขั้นถัดไปคือการสร้างหน้าจอแสดงผลด้วย Component ของ React Native

นี่คือโค้ดสำหรับ `ChatScreen.tsx` ที่รองรับการป้อนข้อมูล, แสดงรายการสนทนาแบบเลื่อนลงอัตโนมัติ (auto-scroll) และสามารถกดยกเลิกการทำงานของ AI ขณะที่กำลังตอบกลับได้ (Cancel/Stop stream)

```tsx
// mobile/src/screens/ChatScreen.tsx
import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  FlatList, ActivityIndicator, StyleSheet, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useAIChat } from '../hooks/useAIChat';

export function ChatScreen() {
  const [inputText, setInputText] = useState('');
  const flatListRef = useRef<FlatList>(null);
  const { messages, isLoading, error, sendMessage, cancelStream, clearChat } = useAIChat(
    'คุณคือ AI assistant ที่ตอบคำถามเป็นภาษาไทย กระชับ และเป็นมิตร'
  );

  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [messages]);

  const handleSend = () => {
    if (!inputText.trim()) return;
    sendMessage(inputText.trim());
    setInputText('');
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={item => item.id}
        renderItem={({ item }) => (
          <View style={[
            styles.bubble,
            item.role === 'user' ? styles.userBubble : styles.aiBubble,
          ]}>
            <Text style={styles.bubbleText}>
              {item.content}
              {item.isStreaming && <Text style={styles.cursor}>▍</Text>}
            </Text>
          </View>
        )}
        contentContainerStyle={styles.messageList}
      />

      {error && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>⚠️ {error}</Text>
        </View>
      )}

      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          value={inputText}
          onChangeText={setInputText}
          placeholder="พิมพ์ข้อความ..."
          multiline
          onSubmitEditing={handleSend}
          editable={!isLoading}
        />
        {isLoading ? (
          <TouchableOpacity style={styles.cancelBtn} onPress={cancelStream}>
            <Text style={styles.cancelText}>⏹</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[styles.sendBtn, !inputText.trim() && styles.sendBtnDisabled]}
            onPress={handleSend}
            disabled={!inputText.trim()}
          >
            <Text style={styles.sendText}>➤</Text>
          </TouchableOpacity>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  messageList: { padding: 16, gap: 8 },
  bubble: { maxWidth: '80%', padding: 12, borderRadius: 16, marginVertical: 4 },
  userBubble: { backgroundColor: '#007AFF', alignSelf: 'flex-end' },
  aiBubble: { backgroundColor: '#fff', alignSelf: 'flex-start', elevation: 1 },
  bubbleText: { fontSize: 16, color: '#000' },
  cursor: { color: '#007AFF' },
  errorBanner: { backgroundColor: '#FFE5E5', padding: 8, margin: 8, borderRadius: 8 },
  errorText: { color: '#D00', textAlign: 'center' },
  inputRow: { flexDirection: 'row', padding: 8, gap: 8, backgroundColor: '#fff' },
  input: { flex: 1, borderWidth: 1, borderColor: '#ddd', borderRadius: 20, paddingHorizontal: 16, paddingVertical: 8, maxHeight: 120 },
  sendBtn: { width: 44, height: 44, backgroundColor: '#007AFF', borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  sendBtnDisabled: { backgroundColor: '#ccc' },
  sendText: { color: '#fff', fontSize: 18 },
  cancelBtn: { width: 44, height: 44, backgroundColor: '#FF3B30', borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  cancelText: { color: '#fff', fontSize: 18 },
});
```

---

## 🔐 Environment Variables — แยกให้ถูกต้อง

เพื่อความปลอดภัยสูงสุดและตรงตามมาตรฐานการตรวจรับของแอปพลิเคชันสโตร์ เราต้องแยกโครงสร้างตัวแปรสภาพแวดล้อมดังนี้:

```bash
# backend/.env — เก็บบน server ห้าม commit ขึ้นระบบ Git ของทีม
ANTHROPIC_API_KEY=sk-ant-api03-xxxx
JWT_SECRET=your-jwt-secret-key-that-is-very-long-and-secure
DATABASE_URL=postgresql://...
PORT=3000

# mobile/.env — ไม่มีร่องรอยของ AI key เลย มีเพียงที่อยู่ของ Backend Server
EXPO_PUBLIC_BACKEND_URL=https://api.yourapp.com
```

และต้องระบุไฟล์ตัวแปรสภาพแวดล้อมเหล่านี้ใน `.gitignore` ของโครงการฝั่ง Client เสมอ:

```bash
# mobile/.gitignore — ต้องระบุไฟล์ป้องกันการหลุด
.env
.env.local
.env.development
.env.production
```

---

## 🛡️ Security Checklist ก่อน Submit App Store

ก่อนที่จะคอมมิตโค้ดและดำเนินการแพลตฟอร์มขึ้นแอปสโตร์ ให้ทำการตรวจสอบรายการความปลอดภัยเหล่านี้:

- [x] ไม่มี `sk-ant-` หรือ `sk-` ที่เป็นรหัสผ่านโมเดลใดๆ ปรากฏใน mobile codebase
- [x] ไฟล์ `.env` ของโครงการโมบายถูกเพิ่มเข้า `.gitignore` ครบถ้วน
- [x] API เส้น `/chat` หรือการเชื่อมต่อใดๆ ของ Backend จำเป็นต้องมี Token (เช่น JWT/OAuth)
- [x] มีการจำกัดปริมาณทราฟฟิก (Rate Limit) บนเซิร์ฟเวอร์มิดเดิลแวร์เพื่อป้องกันการโจมตี DDOS หรือการสแปมดึงโควตา
- [x] มีการตรวจสอบขนาดและความเหมาะสมของอินพุตในเซิร์ฟเวอร์
- [x] ไม่มีการล็อก (Log) ข้อความหรือข้อมูลส่วนตัวของผู้ใช้แบบดิบในระบบหลังบ้าน (ปฏิบัติตามกฎหมายคุ้มครองข้อมูลส่วนบุคคล PDPA)
- [x] ทุก Endpoint เชื่อมต่อด้วยโปรโตคอล HTTPS เสมอบน Production

เราสามารถทำสคริปต์สแกนตรวจสอบความปลอดภัยในโปรเจกต์ได้โดยใช้คำสั่ง `grep`:

```bash
# สแกนตรวจสอบหาคำสำคัญของ API Key ในโฟลเดอร์โมบายแอป
grep -r "sk-ant-" ./mobile/src
grep -r "sk-" ./mobile/src

# หากผลลัพธ์ไม่ขึ้นข้อมูลใดๆ แสดงว่าแอปของคุณผ่านเช็กลิสต์ความปลอดภัยเบื้องต้นแล้ว ✅
```

---

## 🎯 สรุปบทที่ 39

| Component | หน้าที่ |
|-----------|--------|
| `useAIChat.ts` | Custom Hook สำหรับควบคุม Stream State, จัดการ error และรองรับการยกเลิก request |
| `ChatScreen.tsx` | UI ของห้องสนทนา แสดงผลลัพธ์จาก AI Delta ทีละตัวอักษรแบบ real-time |
| Environment | จัดสรรแยกระหว่างความลับฝั่ง Backend และการชี้เป้าฝั่ง Mobile |
| Security Scanner | การสแกนเช็ก API Key รั่วไหลเพื่อความปลอดภัยก่อนขึ้นโปรดักชัน |

---

## 📋 Action Items ก่อนไปบทที่ 40

- [ ] นำ Hook และ UI component ไปปรับใช้ทดสอบบน Emulator หรือ Simulator
- [ ] ติดตั้งไลบรารีสำหรับเก็บความลับในเครื่องอย่างปลอดภัย เช่น `react-native-encrypted-storage` เพื่อใช้เก็บ JWT
- [ ] ทดสอบข้อยกเว้นการรันบนอุปกรณ์ Android และ iOS ที่อาจจัดการ buffering ต่างกัน
- [ ] วางแผนกลไกการ Re-authenticate ของ JWT เมื่อ Token หมดอายุระหว่างการสตรีม

---

*ใน **บทที่ 40** เราจะขยับเข้าไปศึกษา App Store Compliance for AI Apps — กฎเกณฑ์ข้อบังคับล่าสุดของ Apple และ Google สำหรับแอปที่ขับเคลื่อนด้วย Generative AI รวมถึงวิธีเตรียมตัวและขออนุมัติอย่างราบรื่นครับ*
