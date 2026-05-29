# ❌ อันตราย: ให้ Claude ทำได้ทุกอย่าง
run_computer_agent("ลบไฟล์เก่าๆ ออก")

# ✅ ปลอดภัย: จำกัด scope ชัดเจน
SAFE_TASK = """
เปิดเฉพาะ browser Chrome ที่มี tab ชื่อ 'Legacy System'
ห้ามเปิดแอปอื่น ห้ามกดที่นอก browser
ถ้าเห็น confirmation dialog ที่ไม่ใช่เรื่อง data migration → STOP ทันที
ถ้าไม่แน่ใจ → STOP และรายงานสิ่งที่เห็น"""

# เพิ่ม Human Checkpoint ทุก N steps
def run_with_checkpoints(task: str, checkpoint_every: int = 20):
    """หยุดรอ human approve ทุก N steps"""
    steps = 0
    # ... implement ใน production จริง
