// ให้ user cancel ได้กลางคัน
let currentController: AbortController | null = null;

async function streamWithAbort(prompt: string) {
  // cancel stream เก่า ถ้ามี
  if (currentController) {
    currentController.abort();
  }
  currentController = new AbortController();

  try {
    const stream = await client.messages.stream(
      {
        model: 'claude-sonnet-4-5',
        max_tokens: 2048,
        messages: [{ role: 'user', content: prompt }],
      },
      { signal: currentController.signal } // ส่ง abort signal
    );

    for await (const chunk of stream) {
      if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
        process.stdout.write(chunk.delta.text);
      }
    }
  } catch (error: any) {
    if (error.name === 'AbortError') {
      console.log('\n[Stream cancelled by user]');
    } else {
      throw error;
    }
  }
}

// ใน frontend — ปุ่ม Stop
document.getElementById('stop-btn')?.addEventListener('click', () => {
  currentController?.abort();
});
