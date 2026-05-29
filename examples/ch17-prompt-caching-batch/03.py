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
