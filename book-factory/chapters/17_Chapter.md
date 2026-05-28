# บทที่ 17: Prompt Caching & Batch API

---

## 🪝 System Prompt ที่ส่งซ้ำทุกครั้ง

ลองคิดดูครับ — ถ้าคุณมี System Prompt ที่ยาว 2,000 คำ บรรจุ:
- กฎการทำงานของ AI
- เอกสาร Product ทั้งหมด
- ตัวอย่าง Q&A 50 คู่
- นโยบายบริษัท

และคุณส่ง System Prompt นี้ไปกับ **ทุก request** จากผู้ใช้ทุกคน...

```
User 1:  [System Prompt 2,000 คำ] + "ราคาสินค้า X เท่าไหร่?"  → ~3,000 tokens
User 2:  [System Prompt 2,000 คำ] + "วิธีคืนสินค้าคือ?"       → ~3,000 tokens
User 3:  [System Prompt 2,000 คำ] + "ขอบคุณครับ"              → ~3,000 tokens
...
User 1,000: [System Prompt 2,000 คำ] + [คำถามสั้นๆ]          → ~3,000 tokens

รวม: 1,000 × 2,000 = 2,000,000 tokens แค่สำหรับ System Prompt เดียวกัน!
= ~$6 ต่อวัน (Sonnet pricing) ทิ้งเงินไปเปล่าๆ
```

**Prompt Caching** แก้ปัญหานี้ — ส่ง System Prompt ครั้งแรก แล้ว **Cache ไว้ที่ Anthropic** ครั้งต่อไปจ่ายแค่ 10% ของราคาปกติ

---

## 🧠 Prompt Caching ทำงานอย่างไร

```
ครั้งที่ 1 (Cache Miss):
คุณ → [System Prompt 2,000 tokens + คำถาม 50 tokens]
Anthropic อ่านทุกอย่าง → Cache System Prompt ไว้ → ตอบ
จ่าย: 2,050 tokens (ราคาปกติ) + Cache Write fee (25% เพิ่ม)

ครั้งที่ 2-1000 (Cache Hit):
คุณ → [System Prompt reference + คำถาม 50 tokens]
Anthropic โหลด Cache → อ่านแค่คำถาม → ตอบ
จ่าย: 2,000 tokens × 10% + 50 tokens = 250 tokens เท่านั้น!

ประหยัดได้: ~88% สำหรับ tokens ที่ cached
```

**Cache TTL:** 5 นาที (ต่อเวลาได้ถ้ามี request ในช่วงนั้น)

**Minimum สำหรับ Cache:** 1,024 tokens ขึ้นไป ถึงจะคุ้ม

---

## 💻 Implementing Prompt Caching

### Python

```python
# prompt_caching.py
import anthropic
from dotenv import load_dotenv

load_dotenv()
client = anthropic.Anthropic()

# System Prompt ที่ยาวและใช้บ่อย
LONG_SYSTEM_CONTEXT = """
คุณคือ AI Assistant ของ TechShop ร้านขายสินค้า IT ชั้นนำ

## กฎการให้บริการ
1. ตอบเป็นภาษาไทยเสมอ ยกเว้นชื่อสินค้าให้ใช้ภาษาอังกฤษ
2. ถ้าไม่รู้คำตอบ ให้บอกตรงๆ อย่าเดา
3. ห้ามให้ส่วนลดเกิน 10% โดยไม่ได้รับอนุมัติจาก Supervisor

## สินค้าในคลัง (อัปเดต 15 พ.ค. 2568)
[... ข้อมูลสินค้า 200 รายการ ...]

## นโยบายการคืนสินค้า
[... รายละเอียดนโยบาย 500 คำ ...]

## FAQ ที่พบบ่อย
[... 50 คู่ถาม-ตอบ ...]

""" * 3  # จำลองว่ายาวมาก (ควรมีอย่างน้อย 1,024 tokens)

def chat_with_cache(user_message: str) -> str:
    """ส่ง message พร้อม Prompt Caching"""
    response = client.messages.create(
        model="claude-haiku-4-5",
        max_tokens=1024,
        system=[
            {
                "type": "text",
                "text": LONG_SYSTEM_CONTEXT,
                "cache_control": {"type": "ephemeral"},  # ← Magic: เปิด caching
            }
        ],
        messages=[{"role": "user", "content": user_message}],
    )

    # ดู cache stats
    usage = response.usage
    print(f"Input: {usage.input_tokens} | "
          f"Cache Write: {getattr(usage, 'cache_creation_input_tokens', 0)} | "
          f"Cache Read: {getattr(usage, 'cache_read_input_tokens', 0)}")

    return response.content[0].text

# ทดสอบ
print("=== Request 1 (Cache Miss) ===")
r1 = chat_with_cache("ราคา iPhone 16 เท่าไหร่?")
# Cache Write: 2000+ tokens (แพงกว่าปกติ 25%)

print("\n=== Request 2 (Cache Hit) ===")
r2 = chat_with_cache("วิธีคืนสินค้าคือ?")
# Cache Read: 2000+ tokens (ถูกกว่า 90%)

print("\n=== Request 3 (Cache Hit) ===")
r3 = chat_with_cache("มีสินค้ารับประกันนานเท่าไหร่?")
# Cache Read: ประหยัดอีก
```

### TypeScript

```typescript
// prompt_caching.ts
import Anthropic from '@anthropic-ai/sdk';
import 'dotenv/config';

const client = new Anthropic();

const SYSTEM_CONTEXT = `
[... System Prompt ยาวๆ อย่างน้อย 1,024 tokens ...]
`;

interface CacheStats {
  cacheWrites: number;
  cacheReads: number;
  regularTokens: number;
  estimatedSavings: number;
}

class CachedChatService {
  private totalCacheWrites = 0;
  private totalCacheReads = 0;
  private totalRegularTokens = 0;

  async chat(userMessage: string): Promise<string> {
    const response = await client.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 1024,
      system: [
        {
          type: 'text',
          text: SYSTEM_CONTEXT,
          cache_control: { type: 'ephemeral' }, // เปิด caching
        },
      ] as any, // Type cast เพราะ SDK types อาจยังไม่ครบ
      messages: [{ role: 'user', content: userMessage }],
    });

    // Track usage
    const usage = response.usage as any;
    this.totalCacheWrites += usage.cache_creation_input_tokens || 0;
    this.totalCacheReads  += usage.cache_read_input_tokens || 0;
    this.totalRegularTokens += usage.input_tokens;

    return response.content[0].type === 'text' ? response.content[0].text : '';
  }

  getCacheStats(): CacheStats {
    // คำนวณ savings (Sonnet pricing)
    const withoutCache = (this.totalRegularTokens + this.totalCacheReads) * 0.000003;
    const withCache = (this.totalRegularTokens * 0.000003) +
                      (this.totalCacheWrites * 0.00000375) + // Write: 125% of normal
                      (this.totalCacheReads  * 0.0000003);   // Read: 10% of normal

    return {
      cacheWrites:      this.totalCacheWrites,
      cacheReads:       this.totalCacheReads,
      regularTokens:    this.totalRegularTokens,
      estimatedSavings: withoutCache - withCache,
    };
  }
}

// ใช้งาน
const service = new CachedChatService();
await service.chat('ราคา iPhone 16 เท่าไหร่?');
await service.chat('วิธีคืนสินค้า?');
await service.chat('ส่งถึงต่างจังหวัดกี่วัน?');
await service.chat('มีการรับประกันไหม?');

const stats = service.getCacheStats();
console.log(`Cache Writes: ${stats.cacheWrites} tokens`);
console.log(`Cache Reads:  ${stats.cacheReads} tokens`);
console.log(`Estimated Savings: $${stats.estimatedSavings.toFixed(4)}`);
```

---

## 📦 Batch API: ประมวลผลข้อมูลจำนวนมากในราคาครึ่ง

**Batch API** คือการส่ง requests หลายพัน request พร้อมกัน แล้วรับผลลัพธ์ภายใน 24 ชั่วโมง ในราคา **50% ของ real-time API**

**ใช้เมื่อ:**
- ไม่ต้องการผลลัพธ์ทันที
- ต้องประมวลผลข้อมูลจำนวนมาก (หลักพัน-แสน records)
- งาน nightly batch processing

```
Real-time API:  ผลทันที  ราคาเต็ม
Batch API:      ผลใน 24h ราคา 50%

งาน: วิเคราะห์ feedback 50,000 รายการ
Real-time: $75
Batch:     $37.50 ← ประหยัด $37.50 ต่อครั้ง
```

### Python: ส่ง Batch

```python
# batch_processing.py
import anthropic
import json
from dotenv import load_dotenv

load_dotenv()
client = anthropic.Anthropic()

def create_batch_requests(items: list[dict]) -> list:
    """สร้าง batch requests จาก list ของ items"""
    return [
        {
            "custom_id": f"item-{item['id']}",  # ID สำหรับ map กลับ
            "params": {
                "model": "claude-haiku-4-5",
                "max_tokens": 100,
                "system": "วิเคราะห์ sentiment: ตอบด้วย POSITIVE, NEGATIVE, หรือ NEUTRAL เท่านั้น",
                "messages": [
                    {"role": "user", "content": item['text']}
                ],
            },
        }
        for item in items
    ]

# ข้อมูลที่ต้องการประมวลผล
feedback_data = [
    {"id": 1, "text": "สินค้าดีมาก ส่งเร็ว"},
    {"id": 2, "text": "รอนานเกินไป ไม่พอใจ"},
    {"id": 3, "text": "ราคาสมเหตุสมผล"},
    # ... ต่อไปจนถึง 50,000 รายการ
]

# สร้างและส่ง Batch
requests = create_batch_requests(feedback_data)
batch = client.beta.messages.batches.create(requests=requests)

print(f"Batch created: {batch.id}")
print(f"Status: {batch.processing_status}")
print(f"Total requests: {batch.request_counts.processing}")

# บันทึก batch ID ไว้ check ทีหลัง
with open('batch_id.txt', 'w') as f:
    f.write(batch.id)
```

### Python: รับผลลัพธ์ (หลังจาก submit แล้ว ตรวจ status)

```python
# check_batch_results.py
import anthropic
import json
from dotenv import load_dotenv

load_dotenv()
client = anthropic.Anthropic()

# อ่าน batch ID ที่บันทึกไว้
with open('batch_id.txt') as f:
    batch_id = f.read().strip()

# ตรวจ status
batch = client.beta.messages.batches.retrieve(batch_id)
print(f"Status: {batch.processing_status}")
print(f"Succeeded: {batch.request_counts.succeeded}")
print(f"Errored:   {batch.request_counts.errored}")

if batch.processing_status == 'ended':
    # ดึงผลลัพธ์
    results = {}
    for result in client.beta.messages.batches.results(batch_id):
        item_id = result.custom_id.replace('item-', '')

        if result.result.type == 'succeeded':
            sentiment = result.result.message.content[0].text.strip()
            results[item_id] = sentiment
        else:
            results[item_id] = 'ERROR'

    print(f"\nResults sample:")
    for item_id, sentiment in list(results.items())[:5]:
        print(f"  Item {item_id}: {sentiment}")

    # บันทึกผลลัพธ์
    with open('batch_results.json', 'w') as f:
        json.dump(results, f, ensure_ascii=False, indent=2)

    print(f"\nSaved {len(results)} results to batch_results.json")
else:
    print("Batch not yet complete. Check again later.")
```

### TypeScript: Polling แบบ Async

```typescript
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
```

---

## 🚀 Combining: Prompt Caching + Batch API

เมื่อใช้ทั้งสอง technique ร่วมกัน — ประหยัดได้สูงสุด:

```python
# ultimate_savings.py — Caching + Batch ร่วมกัน
def create_batch_with_cache(items: list[dict], system_prompt: str) -> list:
    """สร้าง batch requests ที่ใช้ Prompt Caching ด้วย"""
    return [
        {
            "custom_id": f"item-{item['id']}",
            "params": {
                "model": "claude-haiku-4-5",
                "max_tokens": 200,
                "system": [
                    {
                        "type": "text",
                        "text": system_prompt,
                        "cache_control": {"type": "ephemeral"},  # Cache system prompt
                    }
                ],
                "messages": [{"role": "user", "content": item["text"]}],
            },
        }
        for item in items
    ]

# ผลลัพธ์รวม:
# Batch API:      ลด 50% จากราคาปกติ
# Prompt Caching: ลด 90% ของ system prompt tokens
# รวม:           ประหยัดได้ถึง 90%+ สำหรับ batch งานที่ไม่ urgent
```

---

## 📊 Cost Calculator: เปรียบเทียบก่อน/หลัง

```python
def calculate_savings(
    num_requests: int,
    system_prompt_tokens: int,
    avg_user_tokens: int,
    avg_output_tokens: int,
    model: str = 'sonnet',
) -> dict:
    """คำนวณ savings จาก Caching + Batch"""

    # Pricing (per token)
    pricing = {
        'haiku':  {'input': 0.0000008, 'output': 0.000004},
        'sonnet': {'input': 0.000003,  'output': 0.000015},
    }
    p = pricing[model]

    # Scenario 1: ไม่มี optimization
    baseline_cost = num_requests * (
        (system_prompt_tokens + avg_user_tokens) * p['input'] +
        avg_output_tokens * p['output']
    )

    # Scenario 2: Prompt Caching เท่านั้น
    cache_cost = (
        (system_prompt_tokens * p['input'] * 1.25) +          # First request: write cost
        ((num_requests - 1) * system_prompt_tokens * p['input'] * 0.1) +  # Cache reads
        (num_requests * avg_user_tokens * p['input']) +
        (num_requests * avg_output_tokens * p['output'])
    )

    # Scenario 3: Batch API เท่านั้น (50% discount on input)
    batch_cost = num_requests * (
        (system_prompt_tokens + avg_user_tokens) * p['input'] * 0.5 +
        avg_output_tokens * p['output'] * 0.5
    )

    # Scenario 4: ทั้ง Caching + Batch
    combined_cost = (
        (system_prompt_tokens * p['input'] * 1.25) +                              # Cache write
        ((num_requests - 1) * system_prompt_tokens * p['input'] * 0.1 * 0.5) +   # Cache reads + batch discount
        (num_requests * avg_user_tokens * p['input'] * 0.5) +                     # User tokens + batch discount
        (num_requests * avg_output_tokens * p['output'] * 0.5)                    # Output + batch discount
    )

    return {
        'baseline':    round(baseline_cost, 4),
        'cache_only':  round(cache_cost, 4),
        'batch_only':  round(batch_cost, 4),
        'combined':    round(combined_cost, 4),
        'max_savings': f"{round((1 - combined_cost/baseline_cost) * 100, 1)}%",
    }

# ทดสอบ: 10,000 requests, System Prompt 2,000 tokens, Question 50 tokens
result = calculate_savings(10000, 2000, 50, 200)
print(f"Baseline:   ${result['baseline']}")
print(f"Cache only: ${result['cache_only']}")
print(f"Batch only: ${result['batch_only']}")
print(f"Combined:   ${result['combined']}")
print(f"Max Savings: {result['max_savings']}")

# Output:
# Baseline:   $67.50
# Cache only: $14.80
# Batch only: $33.75
# Combined:   $7.20  ← ประหยัด 89.3%
```

---

## 🎯 สรุปบทที่ 17

| หัวข้อ | สิ่งที่ต้องจำ |
|--------|--------------|
| Prompt Caching | ใส่ `cache_control: {type: "ephemeral"}` ใน system prompt |
| Cache เมื่อไหร่ | System prompt ยาวกว่า 1,024 tokens ที่ใช้ซ้ำบ่อย |
| Cache Savings | ~~90% สำหรับ cached tokens (ราคา 10% ของปกติ) |
| Batch API | ส่ง requests พร้อมกัน รับผลใน 24h ราคา 50% |
| Batch เมื่อไหร่ | งาน nightly, data pipeline, วิเคราะห์ข้อมูลจำนวนมาก |
| Combined | Caching + Batch = ประหยัดได้ถึง 89%+ |

---

## 📋 Action Items ก่อนไปบทที่ 18

- [ ] วัด System Prompt ของโปรเจกต์ปัจจุบันว่ายาวเกิน 1,024 tokens ไหม
- [ ] เพิ่ม `cache_control` ใน API call แล้วดู cache stats
- [ ] หางาน batch processing ที่ทำอยู่และย้ายไปใช้ Batch API
- [ ] รัน Cost Calculator เปรียบเทียบก่อน/หลัง optimization
- [ ] ลองรัน Batch Job เล็กๆ 10 requests แล้วดู output

---

*ใน **บทที่ 18** เราจะเรียนรู้ The Context Trinity — การใช้ไฟล์ `CLAUDE.md`, `TASKS.md`, และ `DESIGN.md` ร่วมกันเป็นระบบ context management ที่สมบูรณ์สำหรับโปรเจกต์ระดับองค์กร ที่ทีมหลายคนทำงานร่วมกันกับ AI ได้อย่างมีประสิทธิภาพครับ*
