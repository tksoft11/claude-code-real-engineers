// conversation-manager.ts
interface Message {
  role: 'user' | 'assistant';
  content: string;
}

class ConversationManager {
  private history: Message[] = [];
  private systemPrompt: string;
  private client: Anthropic;

  constructor(systemPrompt: string) {
    this.systemPrompt = systemPrompt;
    this.client = new Anthropic();
  }

  async chat(userMessage: string): Promise<string> {
    // เพิ่ม user message เข้า history
    this.history.push({ role: 'user', content: userMessage });

    // ส่ง history ทั้งหมดไปกับทุก request
    const response = await this.client.messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: 2048,
      system: this.systemPrompt,
      messages: this.history,
    });

    const assistantMessage = response.content[0].type === 'text'
      ? response.content[0].text
      : '';

    // เพิ่ม assistant response เข้า history
    this.history.push({ role: 'assistant', content: assistantMessage });

    return assistantMessage;
  }

  clearHistory(): void {
    this.history = [];
  }

  getHistory(): Message[] {
    return [...this.history];
  }
}

// ใช้งาน
const chat = new ConversationManager(
  'คุณคือ AI ที่ช่วยวิเคราะห์ code ตอบเป็นภาษาไทย'
);

const reply1 = await chat.chat('ช่วยอธิบาย async/await ให้หน่อย');
const reply2 = await chat.chat('แล้วมันต่างจาก Promise ยังไง?'); // จำบริบทก่อนหน้า
const reply3 = await chat.chat('ให้ตัวอย่างโค้ดสักอัน');        // ยังจำทั้งหมด
