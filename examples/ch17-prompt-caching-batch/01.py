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
