# 1. สร้าง directory
mkdir -p .claude/commands

# 2. คิดว่าคุณพิมพ์ prompt อะไรซ้ำบ่อยที่สุด? (เขียนลงกระดาษ)
# ตัวอย่าง: review โค้ด, เขียน test, หา bug, อธิบายโค้ด, สร้าง migration

# 3. สร้างแต่ละ Command
touch .claude/commands/review-pr.md
touch .claude/commands/write-tests.md
touch .claude/commands/commit-message.md

# 4. ทดสอบแต่ละ Command
claude
> /review-pr
# ดูว่าผลลัพธ์ตรงกับที่คาดหวังไหม

# 5. ปรับปรุง prompt จนได้ผลลัพธ์ที่พอใจ
