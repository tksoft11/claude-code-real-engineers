// src/services/router.service.ts
import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic();

type Complexity = 'simple' | 'moderate' | 'complex';

export async function classifyComplexity(question: string): Promise<Complexity> {
  const res = await client.messages.create({
    model: 'claude-haiku-4-5', // ใช้ Haiku classify (ถูกมาก)
    max_tokens: 20,
    system: 'Reply with ONE word only: SIMPLE, MODERATE, or COMPLEX',
    messages: [{ role: 'user', content: question }],
  });
  const word = res.content[0].type === 'text' ? res.content[0].text.trim().toUpperCase() : '';
  if (word === 'SIMPLE') return 'simple';
  if (word === 'COMPLEX') return 'complex';
  return 'moderate';
}

export function selectModel(complexity: Complexity): string {
  return {
    simple:   'claude-haiku-4-5',
    moderate: 'claude-sonnet-4-5',
    complex:  'claude-opus-4-5',
  }[complexity];
}
