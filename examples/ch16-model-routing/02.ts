// ใช้ Haiku ราคาถูกเพื่อ classify งาน แล้วส่งต่อ model ที่เหมาะสม
async function twoStageRoute(userPrompt: string): Promise<string> {
  // Stage 1: ใช้ Haiku classify complexity (ถูกมาก ~$0.00005)
  const classifyResponse = await client.messages.create({
    model: 'claude-haiku-4-5',
    max_tokens: 50,
    system: 'Classify the complexity of this task. Reply with ONLY one word: SIMPLE, MODERATE, or COMPLEX',
    messages: [{ role: 'user', content: userPrompt }],
  });

  const complexity = classifyResponse.content[0].type === 'text'
    ? classifyResponse.content[0].text.trim().toUpperCase()
    : 'MODERATE';

  // Stage 2: เลือก model ตาม complexity
  const modelMap: Record<string, string> = {
    SIMPLE:   'claude-haiku-4-5',
    MODERATE: 'claude-sonnet-4-5',
    COMPLEX:  'claude-opus-4-5',
  };

  const selectedModel = modelMap[complexity] || 'claude-sonnet-4-5';
  console.log(`Classified as ${complexity} → Using ${selectedModel}`);

  // Stage 2: ทำงานจริงด้วย model ที่เหมาะสม
  const mainResponse = await client.messages.create({
    model: selectedModel,
    max_tokens: 2048,
    messages: [{ role: 'user', content: userPrompt }],
  });

  return mainResponse.content[0].type === 'text'
    ? mainResponse.content[0].text
    : '';
}
