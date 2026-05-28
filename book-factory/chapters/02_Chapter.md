# บทที่ 2: Setup & Guardrails — ติดตั้งอย่างปลอดภัย

---

## 🪝 เหตุการณ์ที่เกิดขึ้นจริงในบริษัท Startup แห่งหนึ่ง

เมษายน 2025 — นายอนุ DevOps Engineer วัย 27 ปี ตื่นเต้นกับ Claude Code และอยากลองทันที เขาอ่านบทความบน Reddit เห็นว่ามี Flag พิเศษที่ข้ามขั้นตอนการขออนุญาตทั้งหมด:

```bash
claude --dangerously-skip-permissions
```

"เจ๋งเลย! ไม่ต้องกด Y ทุกครั้งแล้ว" เขาคิด แล้วสั่งให้ Claude "ทำความสะอาด Production Database โดยลบข้อมูล User ที่ไม่ได้ Login มานานกว่า 1 ปี"

Claude รันคำสั่งทันที โดยไม่ถามยืนยัน

ปัญหาคือ: นิยามของ "ไม่ได้ Login" ใน Query มีบั๊ก ผลที่ได้คือลบ User ออกไป **73,000 คน** รวมถึงลูกค้า Premium ที่จ่ายเงินรายปีไว้แล้ว

Downtime 6 ชั่วโมง ค่าเสียหาย 2.3 ล้านบาท

บทที่ 2 นี้จะทำให้แน่ใจว่าสิ่งนี้จะไม่เกิดกับคุณครับ

---

## 🛡️ ทำความเข้าใจ Guardrails ก่อนติดตั้ง

Claude Code มีระบบความปลอดภัยที่ออกแบบมาอย่างดี แต่ Developer หลายคนรีบข้ามหรือปิดมันทิ้งเพราะรู้สึก "ช้า"

ความจริงคือ Guardrails เหล่านี้คือ **เพื่อนที่ดีที่สุดของคุณ** ครับ

```
Claude Code Permission Levels:
┌─────────────────────────────────────────────────────┐
│ 🟢 READ-ONLY          อ่านไฟล์ วิเคราะห์โค้ด       │
│                        ปลอดภัย 100% ไม่เปลี่ยนอะไร │
├─────────────────────────────────────────────────────┤
│ 🟡 WRITE (ถาม)         แก้ไขไฟล์ สร้างไฟล์ใหม่     │
│                        Claude จะถามก่อนทุกครั้ง    │
├─────────────────────────────────────────────────────┤
│ 🟠 EXECUTE (ถาม)       รันคำสั่ง Terminal          │
│                        Claude จะถามก่อนทุกครั้ง    │
├─────────────────────────────────────────────────────┤
│ 🔴 SKIP-PERMISSIONS    ทำทุกอย่างโดยไม่ถาม         │
│                        ⚠️ อันตราย — ใช้ได้เฉพาะ    │
│                        ใน Sandbox ที่ควบคุมแล้ว    │
└─────────────────────────────────────────────────────┘
```

**กฎทอง:** สำหรับโปรเจกต์จริงทุกชิ้น ให้ใช้ mode ปกติ (ถาม) ไม่ใช้ `--dangerously-skip-permissions` เด็ดขาด จนกว่าคุณจะมีระบบ Test และ Rollback ที่พร้อมแล้ว

---

## 💻 การติดตั้ง Claude Code

### ขั้นตอนที่ 1: ตรวจสอบ Prerequisites

```bash
# ตรวจสอบ Node.js version (ต้องการ 18+)
node --version
# ควรเห็น: v18.x.x หรือสูงกว่า

# ถ้ายังไม่มี Node.js ติดตั้งจาก:
# https://nodejs.org/en/download
```

### ขั้นตอนที่ 2: ติดตั้ง Claude Code

```bash
npm install -g @anthropic-ai/claude-code
```

ตรวจสอบว่าติดตั้งสำเร็จ:
```bash
claude --version
# ควรเห็น: claude-code/x.x.x
```

### ขั้นตอนที่ 3: Login อย่างปลอดภัย (ไม่ใช้ API Key!)

```bash
claude
```

เบราว์เซอร์จะเปิดขึ้นมาอัตโนมัติ → Login ด้วย Anthropic Account → คลิก "Authorize"

เสร็จแล้ว Terminal จะแสดง:
```
✓ Logged in as you@example.com
✓ Connected to Claude claude-sonnet-4-5
Type your message...
```

> 🔐 **ทำไมถึงต้อง Login ผ่านเบราว์เซอร์?**
> 
> วิธีที่ผิด (อย่าทำ):
> ```bash
> export ANTHROPIC_API_KEY="sk-ant-xxxxx"  # Key หลุดใน shell history!
> ```
> 
> วิธีที่ถูก: Browser OAuth จะเก็บ Token ในระบบ Keychain ของ OS ของคุณ  
> ไม่มี Key อยู่ในโค้ด ไม่มีใน `.env` ไม่มีใน shell history
> 
> ถ้าใครเข้าถึงเครื่องคุณ พวกเขาก็ยังไม่ได้ API Key ของคุณ

---

## ⚙️ การตั้งค่า Spend Limits (ป้องกันบิลล์ช็อก)

Real Engineer ต้องตั้ง Spend Limits ก่อนใช้งานทุกครั้ง โดยเฉพาะเมื่อจะรัน Automated Tasks ข้ามคืน

### ตั้งค่าผ่าน Anthropic Console

1. ไปที่ [console.anthropic.com](https://console.anthropic.com)
2. คลิก **Settings** → **Billing**
3. ตั้งค่า:
   - **Monthly Spend Limit:** วงเงินรายเดือน (แนะนำ: $50-100 สำหรับโปรเจกต์เดี่ยว)
   - **Low Balance Alert:** แจ้งเตือนเมื่อใกล้ถึงวงเงิน (ตั้งที่ 80%)

### ตั้งค่าใน CLAUDE.md (สำหรับทีม)

```markdown
# Cost Control Rules
- ใช้ claude-haiku-4-5 สำหรับงาน repetitive (ถูก 10x)
- ใช้ claude-sonnet-4-5 สำหรับงาน complex
- ห้ามส่ง context เกิน 50,000 tokens ต่อ request
- ทุก Batch Job ต้องรัน test บน 10 samples ก่อน Full Run
```

### ตัวอย่าง Cost Comparison (รู้ไว้ก่อนหมดตัว)

| Task | Model | ประมาณค่าใช้จ่าย |
|------|-------|----------------|
| อ่านไฟล์โค้ด 1,000 บรรทัด + แก้ | Haiku | ~$0.003 |
| อ่านไฟล์โค้ด 1,000 บรรทัด + แก้ | Sonnet | ~$0.03 |
| Refactor โปรเจกต์ทั้งหมด (50 files) | Sonnet | ~$1.50 |
| RAG Pipeline วิเคราะห์เอกสาร 1,000 ไฟล์ | Sonnet (ไม่มี Cache) | ~$15 |
| RAG Pipeline เดิม (มี Prompt Cache) | Sonnet (มี Cache) | ~$1.50 |

---

## 📁 การตั้งค่าโปรเจกต์: ไฟล์ที่ขาดไม่ได้

### โครงสร้าง Minimal ที่ต้องมีก่อนเริ่มงาน

```
your-project/
├── CLAUDE.md          ← คัมภีร์บังคับ (สร้างวันนี้)
├── TASKS.md           ← Board งาน (สร้างทุกครั้งก่อนเริ่ม Sprint)
├── .claude/
│   └── settings.json  ← การตั้งค่า Claude สำหรับโปรเจกต์นี้
└── .gitignore         ← ต้องมี .claude/ หรือไม่? (อธิบายด้านล่าง)
```

### สร้าง CLAUDE.md เวอร์ชันพื้นฐาน

```markdown
# [ชื่อโปรเจกต์] — Claude Context File

## Tech Stack
- Runtime: Node.js 20 / Python 3.12 / [ภาษาที่คุณใช้]
- Framework: Express.js / FastAPI / [Framework ของคุณ]
- Database: PostgreSQL 16 (via Prisma ORM)
- Testing: Jest / Pytest

## Coding Standards
- Language: TypeScript strict mode (ห้ามใช้ `any`)
- Style: ตาม ESLint config ในโปรเจกต์
- Comments: JSDoc สำหรับทุก public function
- ห้าม: console.log ใน production code ให้ใช้ logger แทน

## Architecture Rules
- Pattern: Repository Pattern สำหรับ Database access
- Error Handling: ทุก async function ต้องมี try-catch
- Validation: ใช้ Zod สำหรับ input validation ทุก endpoint

## Safety Rules (สำคัญมาก)
- ห้ามแก้ไขไฟล์ Migration เก่าที่ commit ไปแล้ว
- ห้าม DROP TABLE หรือ DELETE ข้อมูล Production โดยไม่มี Dry Run ก่อน
- ทุก Database change ต้องมี Rollback script กำกับ
- ก่อน Deploy ต้องรัน test suite ผ่านก่อน

## Project Structure
src/
├── controllers/   ← HTTP handlers เท่านั้น
├── services/      ← Business logic
├── repositories/  ← Database queries
└── utils/         ← Shared utilities

## ห้ามแตะไฟล์เหล่านี้
- .env (ทุกไฟล์ที่ขึ้นต้นด้วย .env)
- prisma/migrations/ (ที่ commit ไปแล้ว)
- package-lock.json (ให้ใช้ npm แทน)
```

### สร้าง `.claude/settings.json`

```json
{
  "permissions": {
    "allow": [
      "Read(**)",
      "Write(src/**)",
      "Write(tests/**)",
      "Write(TASKS.md)",
      "Bash(npm test)",
      "Bash(npm run lint)",
      "Bash(git status)",
      "Bash(git diff)"
    ],
    "deny": [
      "Bash(git push)",
      "Bash(npm run deploy)",
      "Bash(DROP*)",
      "Write(.env*)",
      "Write(prisma/migrations/**)"
    ]
  }
}
```

> 💡 **ทำความเข้าใจ Settings:** ไฟล์นี้กำหนดว่า Claude สามารถทำอะไรได้บ้างในโปรเจกต์นี้ โดยไม่ต้องถามทุกครั้ง แต่สิ่งที่อยู่ใน `deny` จะถูกปฏิเสธแม้คุณจะสั่งก็ตาม — นี่คือ Guardrail ที่แท้จริง

### .gitignore สำหรับ `.claude/`?

```bash
# คำถามที่ Developer ถามบ่อย: ควร commit .claude/ ไหม?

# ✅ COMMIT ถ้า: settings.json มีแค่ project rules ที่ทุกคนควรใช้ร่วมกัน
# ❌ ไม่ COMMIT ถ้า: มี personal tokens หรือ credentials ข้างใน

# ตรวจสอบก่อน commit
cat .claude/settings.json  # ถ้าไม่มี secret → commit ได้เลย
```

---

## 🔐 Permissions Deep Dive: อ่านก่อนรู้สึกเสียใจ

### Permission Syntax ที่ต้องรู้

```json
// รูปแบบ: "Action(Pattern)"
"Read(**)"              // อ่านทุกไฟล์ในทุก directory
"Read(src/**)"          // อ่านเฉพาะใน src/
"Write(src/**/*.ts)"    // เขียนได้เฉพาะ .ts ใน src/
"Bash(npm *)"           // รันได้เฉพาะคำสั่ง npm
"Bash(git diff)"        // รันได้เฉพาะคำสั่งนี้เป๊ะๆ
```

### 3 Profile ที่แนะนำตามประเภทงาน

**Profile 1: Code Review Only (ปลอดภัยที่สุด)**
```json
{
  "permissions": {
    "allow": ["Read(**)"],
    "deny": ["Write(**)", "Bash(**)"]
  }
}
```
ใช้เมื่อ: ต้องการให้ AI วิเคราะห์โค้ด แต่ไม่ต้องการให้แก้ไขอะไร

**Profile 2: Development (แนะนำสำหรับงานปกติ)**
```json
{
  "permissions": {
    "allow": [
      "Read(**)",
      "Write(src/**)",
      "Write(tests/**)",
      "Bash(npm test)",
      "Bash(npm run lint)",
      "Bash(git status)",
      "Bash(git add *)",
      "Bash(git commit *)"
    ],
    "deny": [
      "Bash(git push)",
      "Bash(npm run deploy)",
      "Write(.env*)"
    ]
  }
}
```
ใช้เมื่อ: งานพัฒนาปกติ สามารถแก้โค้ดและ commit ได้ แต่ deploy ต้องคนอนุมัติ

**Profile 3: The Ralph Loop (สำหรับ Overnight Runs)**
```json
{
  "permissions": {
    "allow": [
      "Read(**)",
      "Write(src/**)",
      "Write(tests/**)",
      "Bash(npm test)",
      "Bash(npm run lint)",
      "Bash(git *)"
    ],
    "deny": [
      "Bash(git push --force)",
      "Bash(npm run deploy:production)",
      "Write(.env*)",
      "Write(prisma/migrations/**)"
    ]
  }
}
```
ใช้เมื่อ: ตั้ง Ralph Loop ทำงานข้ามคืน — Claude push PR ได้ แต่ Deploy Production ไม่ได้

---

## 🧪 ทดสอบว่าระบบ Guardrails ทำงาน

ก่อน Trust Claude ด้วยงานจริง ให้ทดสอบ Guardrails ก่อน:

```bash
# เปิด Claude แล้วลองสั่งสิ่งที่ควรถูก block
claude

> "ลบไฟล์ .env ทิ้งให้ด้วย"
# ควรเห็น: Error หรือ Request Permission ที่คุณต้องอนุมัติ

> "push โค้ดขึ้น GitHub ให้หน่อย"
# ควรเห็น: Blocked by deny rule (ถ้าตั้งค่าถูก)

> "อ่านโค้ดใน src/ และสรุปให้ฉันว่าทำอะไร"
# ควรเห็น: ทำงานได้ปกติ ไม่ต้องถาม
```

---

## 💻 Hands-On: ตั้งค่าโปรเจกต์แรกของคุณ

**โปรเจกต์ทดสอบ:** สร้างโปรเจกต์ใหม่ตั้งแต่ต้นพร้อม Guardrails ครบถ้วน

**ขั้นตอน:**

```bash
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
```

เมื่อ Claude เปิดขึ้นมาให้พิมพ์:
```
"อ่าน CLAUDE.md และ TASKS.md ก่อน จากนั้นทำ Task ทั้งหมดในลำดับที่กำหนด test ต้องผ่านก่อนจบ"
```

**ผลที่คาดหวัง:** Claude จะสร้างไฟล์ตาม Rules ใน CLAUDE.md, รัน test, และรายงานผล โดยไม่ยุ่งกับไฟล์ที่ไม่ได้รับอนุญาต

---

## 🎯 Checklist ก่อนเริ่ม Claude Code ทุกโปรเจกต์

พิมพ์รายการนี้ไว้บนผนังออฟฟิศก็ได้ครับ:

```
□ CLAUDE.md มีอยู่และอัปเดตแล้ว
□ .claude/settings.json กำหนด deny rules ไว้แล้ว
□ Spend Limit ตั้งไว้ที่ Anthropic Console แล้ว
□ ไม่มี --dangerously-skip-permissions ในคำสั่ง (ถ้าไม่ใช่ Sandbox)
□ โปรเจกต์มี .gitignore ที่ cover .env ทุกไฟล์
□ มี git history สะอาด (commit ล่าสุดทำงานได้) เผื่อต้อง rollback
```

---

## 🎯 สรุปบทที่ 2

| หัวข้อ | สิ่งที่ต้องจำ |
|--------|--------------|
| Login | Browser OAuth เท่านั้น — ไม่ copy API Key |
| Spend Limits | ตั้งไว้ก่อนเสมอ — อย่าปล่อยให้ AI รันไม่มีขีดจำกัด |
| Permissions | ใช้ Profile ตามงาน — Review / Dev / Ralph Loop |
| CLAUDE.md | ต้องมีก่อนเริ่มงานทุกครั้ง |
| `--dangerously-skip-permissions` | อย่าใช้ใน Production เด็ดขาด |

---

## 📋 Action Items ก่อนไปบทที่ 3

- [ ] ติดตั้ง Claude Code และ Login ผ่านเบราว์เซอร์สำเร็จ
- [ ] ตั้ง Spend Limit ที่ Anthropic Console
- [ ] สร้าง `.claude/settings.json` ในโปรเจกต์ปัจจุบัน
- [ ] สร้าง `CLAUDE.md` พื้นฐานสำหรับโปรเจกต์ที่ทำอยู่
- [ ] ทดสอบว่า deny rules ทำงานโดยลองสั่งสิ่งที่ควรถูก block

---

*ใน **บทที่ 3** เราจะเจาะลึก `CLAUDE.md` อย่างจริงจัง — ทำอย่างไรให้ไฟล์ไม่กี่บรรทัดนี้กลายเป็น "สมองกลาง" ที่ AI ทุกตัวในทีมเชื่อฟังอย่างสม่ำเสมอ และทำให้โค้ดที่ได้ตรงตาม Architecture ของคุณในทุกกระเบียดนิ้วครับ*
