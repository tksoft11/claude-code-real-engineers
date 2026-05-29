# 1. สร้างโปรเจกต์ใหม่
mkdir my-ai-guarded-project && cd my-ai-guarded-project
npm init -y

# 2. สร้าง directory structure
mkdir -p src tests .claude

# 3. สร้าง CLAUDE.md
cat > CLAUDE.md << 'EOF'
# My AI Guarded Project

## Tech Stack
- Node.js 20, JavaScript (ES Modules)

## Rules
- ใช้ console.error สำหรับ error เท่านั้น
- ทุก function ต้องมี JSDoc
- ห้าม hardcode ค่าที่ควรอยู่ใน config

## Safety
- ห้ามลบไฟล์ใดๆ โดยไม่บอกก่อน
- ห้ามแก้ไข package.json โดยตรง
EOF

# 4. สร้าง Claude settings
cat > .claude/settings.json << 'EOF'
{
  "permissions": {
    "allow": [
      "Read(**)",
      "Write(src/**)",
      "Write(tests/**)",
      "Bash(node *)",
      "Bash(npm test)"
    ],
    "deny": [
      "Write(package.json)",
      "Bash(rm *)",
      "Bash(git push)"
    ]
  }
}
EOF

# 5. สร้าง TASKS.md แรก
cat > TASKS.md << 'EOF'
# Sprint 1: Hello World

## Tasks
- [ ] สร้างไฟล์ src/index.js ที่แสดงข้อความ "Hello, AI Engineer!"
- [ ] สร้าง test ทดสอบ function นั้น
- [ ] ตรวจสอบว่า test ผ่าน

## Definition of Done
- node src/index.js รันได้
- test ผ่าน 100%
EOF

# 6. เปิด Claude และสั่งงาน
claude
