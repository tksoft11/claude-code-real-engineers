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
