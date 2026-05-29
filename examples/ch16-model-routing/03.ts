// ลอง Haiku ก่อน ถ้า output ไม่ดีพอ ขยับไป Sonnet → Opus
async function cascadeRoute(
  prompt: string,
  qualityChecker: (response: string) => boolean
): Promise<{ response: string; modelUsed: string }> {
  const cascade: Array<{ model: string; maxTokens: number }> = [
    { model: 'claude-haiku-4-5',  maxTokens: 1024 },
    { model: 'claude-sonnet-4-5', maxTokens: 2048 },
    { model: 'claude-opus-4-5',   maxTokens: 4096 },
  ];

  for (const { model, maxTokens } of cascade) {
    const response = await client.messages.create({
      model,
      max_tokens: maxTokens,
      messages: [{ role: 'user', content: prompt }],
    });

    const text = response.content[0].type === 'text' ? response.content[0].text : '';

    if (qualityChecker(text)) {
      return { response: text, modelUsed: model };
    }

    console.log(`${model} quality insufficient, escalating...`);
  }

  throw new Error('All models failed quality check');
}

// ตัวอย่าง: เช็คว่า response มี JSON valid หรือเปล่า
const result = await cascadeRoute(
  'Extract data as JSON from: ' + rawText,
  (response) => {
    try {
      JSON.parse(response);
      return true;
    } catch {
      return false; // escalate ไป model ที่ดีกว่า
    }
  }
);

console.log(`Final answer from: ${result.modelUsed}`);
