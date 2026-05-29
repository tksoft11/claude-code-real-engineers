async function streamWithCostTracking(prompt: string) {
  let inputTokens = 0;
  let outputTokens = 0;

  const stream = await client.messages.stream({
    model: 'claude-sonnet-4-5',
    max_tokens: 2048,
    messages: [{ role: 'user', content: prompt }],
  });

  for await (const event of stream) {
    if (event.type === 'message_start') {
      inputTokens = event.message.usage.input_tokens;
    }
    if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
      process.stdout.write(event.delta.text);
      outputTokens++;
    }
  }

  // แสดงค่าใช้จ่ายเมื่อเสร็จ
  const costUSD = (inputTokens * 0.000003) + (outputTokens * 0.000015);
  console.log(`\n\n[Tokens: ${inputTokens}in + ${outputTokens}out | Cost: $${costUSD.toFixed(5)}]`);
}
