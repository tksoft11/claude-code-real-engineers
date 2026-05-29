// 1. Cache embeddings สำหรับ query เดิม
const queryCache = new Map<string, number[]>();

async function cachedEmbed(text: string): Promise<number[]> {
  if (queryCache.has(text)) return queryCache.get(text)!;
  const embedding = await embedText(text);
  queryCache.set(text, embedding);
  return embedding;
}

// 2. Batch indexing (ประหยัด API calls)
async function batchIndex(files: string[]) {
  for (const file of files) {
    await indexDocument(/* ... */);
    await new Promise(r => setTimeout(r, 200)); // rate limit
  }
}

// 3. Index ด้วย Claude ช่วย generate metadata
async function smartIndex(content: string): Promise<{ title: string; category: string; summary: string }> {
  const response = await claude.messages.create({
    model: 'claude-haiku-4-5',
    max_tokens: 200,
    system: 'ตอบ JSON เท่านั้น',
    messages: [{
      role: 'user',
      content: `วิเคราะห์เอกสาร: "${content.slice(0, 500)}..."
ตอบ: {"title": "...", "category": "hr|it|legal|finance|ops", "summary": "สรุป 1 ประโยค"}`
    }],
  });
  return JSON.parse(response.content[0].type === 'text' ? response.content[0].text : '{}');
}
