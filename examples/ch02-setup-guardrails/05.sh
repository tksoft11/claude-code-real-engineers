# คำถามที่ Developer ถามบ่อย: ควร commit .claude/ ไหม?

# ✅ COMMIT ถ้า: settings.json มีแค่ project rules ที่ทุกคนควรใช้ร่วมกัน
# ❌ ไม่ COMMIT ถ้า: มี personal tokens หรือ credentials ข้างใน

# ตรวจสอบก่อน commit
cat .claude/settings.json  # ถ้าไม่มี secret → commit ได้เลย
