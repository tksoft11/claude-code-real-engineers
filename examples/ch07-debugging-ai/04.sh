mkdir -p .claude/commands
cat > .claude/commands/debug.md << 'EOF'
# /debug

รับ bug description จาก $ARGUMENTS แล้วทำ systematic debugging:

## ขั้นตอน
1. อ่านไฟล์ที่เกี่ยวข้องกับ bug description
2. ตั้งสมมติฐาน 3 อันดับแรก พร้อม:
   - ตำแหน่งในโค้ด
   - เหตุผลที่สงสัย
   - วิธี verify
3. เขียน diagnostic code:
   - Logging statements ที่จะช่วยยืนยัน
   - Test case ที่ reproduce ปัญหา
4. เมื่อยืนยัน root cause แล้ว:
   - เขียน fix
   - เขียน regression test
   - ตรวจหา similar patterns ในโค้ดอื่น

## รูปแบบผลลัพธ์
### 🔍 Root Cause Analysis
[3 สมมติฐาน เรียงตามความน่าจะเป็น]

### 🛠️ Recommended Fix
[โค้ดที่แก้ พร้อม explanation]

### 🧪 Regression Test
[test code]

### ⚠️ Similar Patterns Found
[ถ้ามี]
EOF
