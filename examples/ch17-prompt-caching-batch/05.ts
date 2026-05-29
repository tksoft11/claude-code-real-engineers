// batch_with_polling.ts
import Anthropic from '@anthropic-ai/sdk';
import 'dotenv/config';
import fs from 'fs/promises';

const client = new Anthropic();

async function runBatchJob(items: Array<{ id: string; text: string }>) {
  console.log(`Submitting batch of ${items.length} items...`);

  // ส่ง Batch
  const batch = await client.beta.messages.batches.create({
    requests: items.map(item => ({
      custom_id: item.id,
      params: {
        model: 'claude-haiku-4-5' as const,
        max_tokens: 100,
        messages: [{ role: 'user' as const, content: item.text }],
      },
    })),
  });

  console.log(`Batch ID: ${batch.id}`);
  console.log('Waiting for completion (checking every 30s)...');

  // Poll จนกว่าจะเสร็จ
  while (true) {
    await sleep(30000); // รอ 30 วินาที

    const status = await client.beta.messages.batches.retrieve(batch.id);
    const { processing, succeeded, errored } = status.request_counts;

    console.log(`Status: ${status.processing_status} | ` +
                `Processing: ${processing} | Succeeded: ${succeeded} | Errored: ${errored}`);

    if (status.processing_status === 'ended') {
      // เก็บผลลัพธ์
      const results: Record<string, string> = {};
      for await (const result of await client.beta.messages.batches.results(batch.id)) {
        if (result.result.type === 'succeeded') {
          const text = result.result.message.content[0];
          results[result.custom_id] = text.type === 'text' ? text.text : '';
        }
      }

      await fs.writeFile('results.json', JSON.stringify(results, null, 2));
      console.log(`\n✅ Done! ${Object.keys(results).length} results saved.`);
      return results;
    }
  }
}

// ใช้งาน
const items = [
  { id: 'fb-001', text: 'บริการดีมาก' },
  { id: 'fb-002', text: 'รอนานเกินไป' },
  { id: 'fb-003', text: 'ราคาสมเหตุสมผล' },
];

const results = await runBatchJob(items);
console.log('Sample results:', Object.entries(results).slice(0, 3));
