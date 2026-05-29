# migrate_data.py
from agent import run_computer_agent

MIGRATION_TASK = """
ทำการย้ายข้อมูลจากระบบ Legacy (เปิดอยู่ใน browser) ไปยัง Excel:

1. ดูหน้า list ที่เปิดอยู่
2. คลิก record แรกในตาราง
3. copy ข้อมูลต่อไปนี้จากหน้า detail:
   - ชื่อลูกค้า
   - หมายเลขสัญญา
   - วันที่เริ่มต้น
   - มูลค่า
4. Switch ไปที่ Excel ที่เปิดอยู่
5. วาง (paste) ข้อมูลในแถวถัดไป
6. กลับมา browser
7. คลิก "Back" แล้วทำ record ถัดไป
8. ทำซ้ำจนครบ 3,000 records

ถ้าเจอ error popup ให้ปิด แล้วทำต่อ
ถ้าหน้า load นานเกิน 10 วินาที ให้ refresh"""

# รัน agent
result = run_computer_agent(MIGRATION_TASK, max_steps=300)
print(f"Result: {result}")
