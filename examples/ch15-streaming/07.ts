async function streamWithFallback(prompt: string, timeoutMs = 500) {
  let gotFirstChunk = false;
  const timer = setTimeout(() => {
    if (!gotFirstChunk) {
      console.log('[กำลังประมวลผล...]'); // แสดง loading indicator
    }
  }, timeoutMs);

  const stream = await client.messages.stream({
    model: 'claude-sonnet-4-5',
    max_tokens: 2048,
    messages: [{ role: 'user', content: prompt }],
  });

  for await (const chunk of stream) {
    if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
      if (!gotFirstChunk) {
        gotFirstChunk = true;
        clearTimeout(timer);
      }
      process.stdout.write(chunk.delta.text);
    }
  }
}
