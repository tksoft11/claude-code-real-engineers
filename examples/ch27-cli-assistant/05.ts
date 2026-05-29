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
