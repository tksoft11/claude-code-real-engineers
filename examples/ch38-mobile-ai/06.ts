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
