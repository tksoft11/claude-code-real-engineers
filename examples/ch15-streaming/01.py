# streaming_basic.py
import anthropic
from dotenv import load_dotenv

load_dotenv()
client = anthropic.Anthropic()

# วิธีที่ 1: ใช้ context manager (แนะนำ)
with client.messages.stream(
    model="claude-sonnet-4-5",
    max_tokens=1024,
    messages=[{"role": "user", "content": "อธิบาย Docker ให้เข้าใจง่ายใน 5 ข้อ"}],
) as stream:
    for text in stream.text_stream:
        print(text, end="", flush=True)  # พิมพ์ทีละ token ไม่ขึ้นบรรทัด

print()  # ขึ้นบรรทัดใหม่เมื่อจบ

# วิธีที่ 2: ดู events ทั้งหมด (สำหรับ debug)
with client.messages.stream(
    model="claude-sonnet-4-5",
    max_tokens=512,
    messages=[{"role": "user", "content": "Hello!"}],
) as stream:
    for event in stream:
        if event.type == "content_block_delta":
            print(f"token: {event.delta.text}", end="")
        elif event.type == "message_stop":
            print(f"\n\nDone! Usage: {stream.get_final_message().usage}")
