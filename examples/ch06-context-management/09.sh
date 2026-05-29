# 1. หาโปรเจกต์ที่มีไฟล์มากกว่า 20 ไฟล์ใน src/
ls src/ | wc -l

# 2. สร้าง TASKS.md สำหรับ Code Review ทั้งโปรเจกต์
cat > TASKS.md << 'EOF'
# Full Codebase Review

## 🤖 Claude Instructions
- อ่านทีละไฟล์ หาปัญหา เขียน note ใน review-notes.md
- ทุก 10 ไฟล์ → /compact
- อัปเดต Breadcrumb ทุก 5 ไฟล์

## 🔖 Breadcrumb
(Claude จะอัปเดตที่นี่)

## Batch 1: Services
- [ ] src/services/user.service.ts
- [ ] src/services/auth.service.ts
[... ต่อตามไฟล์จริงในโปรเจกต์คุณ]
→ /compact เมื่อเสร็จ Batch 1

## Batch 2: Controllers
[... ต่อ]
EOF

# 3. เปิด Claude และสั่ง
claude
