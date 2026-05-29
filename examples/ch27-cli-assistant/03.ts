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
