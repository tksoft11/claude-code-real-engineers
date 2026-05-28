# บทที่ 3: CLAUDE.md — คัมภีร์บังคับ AI

---

## 🪝 ทดสอบนี้ก่อนอ่านต่อ

เปิด Terminal พิมพ์ `claude` แล้วถามว่า:

> "เขียน function สำหรับ hash password ให้หน่อย"

ดูโค้ดที่ได้มาครับ — AI เดา Library, เดา Pattern, เดา Language Style ทั้งหมด เพราะมันไม่รู้อะไรเกี่ยวกับโปรเจกต์คุณเลย

ทีนี้ สร้างไฟล์ `CLAUDE.md` ที่มีข้อความสั้นๆ ว่า:
```markdown
- ภาษา: TypeScript strict mode
- Hashing: bcrypt จาก library 'bcryptjs', rounds: 12
- Pattern: ต้องใช้ async/await เสมอ ห้าม callback
```

แล้วถามคำถามเดิม — โค้ดที่ได้จะต่างกันราวฟ้ากับดิน

**นั่นแหละคืออำนาจของ CLAUDE.md ครับ**

---

## 🧠 CLAUDE.md คืออะไรกันแน่

CLAUDE.md ไม่ใช่แค่ "ไฟล์ README สำหรับ AI" — มันคือ **System Prompt ถาวร** ที่ Claude อ่านโดยอัตโนมัติทุกครั้งที่คุณเปิด Session ใหม่ในโปรเจกต์นั้น

```
ปกติ:
[คุณพิมพ์คำถาม] ──→ [Claude ตอบโดยเดาทุกอย่าง]

มี CLAUDE.md:
[CLAUDE.md โหลดอัตโนมัติ] + [คุณพิมพ์คำถาม] ──→ [Claude ตอบตาม Context ของโปรเจกต์คุณ]
```

Claude จะ:
1. ค้นหา `CLAUDE.md` ใน directory ปัจจุบันและ parent directories
2. โหลดเนื้อหาทั้งหมดเข้า Context
3. ใช้เป็นกฎที่มีความสำคัญสูงสุดตลอด Session

---

## 📐 Anatomy: โครงสร้าง CLAUDE.md ระดับ Enterprise

### Section 1: Identity & Purpose
```markdown
# [ชื่อโปรเจกต์] — Claude Context

## โปรเจกต์นี้คืออะไร
ระบบ E-Commerce สำหรับร้านค้าปลีก รองรับ 50,000 SKU
ลูกค้าใช้งาน: ร้านค้า B2B ในไทย

## เป้าหมายหลัก
- ความเร็ว: API response < 200ms
- ความน่าเชื่อถือ: Uptime 99.9%
- ความปลอดภัย: PCI DSS compliant (จัดการ payment data)
```
> **ทำไมต้องมี:** AI จะตัดสินใจ Trade-off ได้ถูกต้องมากขึ้น เช่น ถ้ารู้ว่าต้องการ Performance จะไม่เขียนโค้ดที่ทำ N+1 Query

---

### Section 2: Tech Stack (ชัดเจนที่สุด)
```markdown
## Tech Stack

### Backend
- Runtime: Node.js 20 LTS
- Framework: Fastify 4.x (ไม่ใช่ Express!)
- ORM: Prisma 5.x + PostgreSQL 16
- Validation: Zod 3.x (ห้ามใช้ Joi หรือ Yup)
- Auth: JWT (access 15m, refresh 7d) + Redis session store

### Frontend  
- Framework: Next.js 14 App Router (ไม่ใช่ Pages Router!)
- Styling: Tailwind CSS 3.x + shadcn/ui
- State: Zustand (ห้ามใช้ Redux)
- Data Fetching: TanStack Query v5

### Infrastructure
- Container: Docker + docker-compose
- CI/CD: GitHub Actions
- Hosting: AWS ECS + RDS + ElastiCache
```
> **ทำไมต้องชัด:** "ไม่ใช่ Express!" และ "ไม่ใช่ Pages Router!" ป้องกัน AI ใช้ library ผิดที่ต้องไปแก้ทีหลัง

---

### Section 3: Coding Standards
```markdown
## Coding Standards

### TypeScript
- strict mode ON ทุกไฟล์
- ห้าม `any` ทุกกรณี — ใช้ `unknown` แล้ว narrow type
- ทุก function ต้องมี return type explicit

### Naming Conventions
- Variables/Functions: camelCase
- Classes/Types/Interfaces: PascalCase
- Constants: SCREAMING_SNAKE_CASE
- Database columns: snake_case (Prisma จัดการ mapping)
- Files: kebab-case (user-service.ts ไม่ใช่ UserService.ts)

### Error Handling
- ใช้ Result pattern: { data, error } ไม่ throw Exception
- ทุก Database call ต้องมี try-catch
- ทุก error ต้อง log ด้วย logger.error() ไม่ใช่ console.log()

### Testing
- Unit test: ทุก service function
- Integration test: ทุก API endpoint
- Coverage target: 80% minimum
- ใช้ Vitest ไม่ใช่ Jest
```

---

### Section 4: Architecture Rules (กฎที่ AI ต้องปฏิบัติตาม)
```markdown
## Architecture Rules

### Layered Architecture (ห้ามข้ามชั้น)
Controller → Service → Repository → Database

- Controller: รับ HTTP request, validate input, return response เท่านั้น
- Service: business logic, ไม่รู้จัก HTTP
- Repository: database queries เท่านั้น, ไม่มี business logic

### ตัวอย่างที่ถูกต้อง
// ✅ Controller ที่ถูก
async function createUser(req, reply) {
  const dto = CreateUserDto.parse(req.body);  // validate
  const result = await userService.create(dto); // delegate
  return reply.send(result);
}

// ❌ Controller ที่ผิด (มี business logic)
async function createUser(req, reply) {
  const hashedPassword = await bcrypt.hash(req.body.password, 12);
  const user = await prisma.user.create({ data: { ...req.body, password: hashedPassword }});
  return reply.send(user);
}
```

---

### Section 5: Safety Rules (สำคัญที่สุด)
```markdown
## Safety Rules — อ่านทุกบรรทัดก่อนทำอะไร

### กฎเหล็ก (ห้ามละเมิดแม้ฉันจะสั่ง)
1. ห้าม DELETE หรือ DROP ข้อมูลใน Database โดยไม่มี WHERE clause
2. ห้ามแก้ไข Migration files ที่ commit แล้ว — สร้าง Migration ใหม่แทน
3. ห้าม hardcode credentials ทุกชนิดในโค้ด
4. ห้าม push โค้ดขึ้น main/master branch โดยตรง
5. ก่อน DROP หรือ DELETE ต้องเสนอ Dry Run ก่อนเสมอ

### ถ้าฉันสั่งสิ่งที่ขัดกับกฎข้างต้น
ให้ตอบว่า "คำสั่งนี้ขัดกับ Safety Rule ข้อ X
ฉันเสนอวิธีที่ปลอดภัยกว่าแทน: [วิธีอื่น]"
```
> **นี่คือ Guardrail ที่ทรงพลังที่สุด:** AI จะปฏิเสธแม้แต่คำสั่งของคุณเองถ้ามันอันตราย

---

### Section 6: File Boundaries (ห้ามแตะ)
```markdown
## ไฟล์ที่ห้ามแก้ไขโดยไม่ได้รับอนุญาตชัดเจน
- .env* (ทุกไฟล์ที่ขึ้นต้นด้วย .env)
- prisma/migrations/** (ที่ commit แล้ว)
- package-lock.json
- .github/workflows/** (ต้องได้รับอนุญาตพิเศษ)
- src/config/production.ts
```

---

## 🔗 CLAUDE.md แบบ Dynamic: อ้างอิงไฟล์อื่น

เมื่อโปรเจกต์ใหญ่ขึ้น CLAUDE.md อาจยาวเกินไป ใช้เทคนิคนี้:

```markdown
# CLAUDE.md

## Context Files (อ่านก่อนเริ่มงานทุกครั้ง)
- Architecture: ดู docs/ARCHITECTURE.md
- Database Schema: ดู prisma/schema.prisma
- API Contracts: ดู docs/API.md
- Current Tasks: ดู TASKS.md

## Quick Rules
[กฎสั้นๆ ที่สำคัญที่สุด 10 ข้อ]
```

Claude จะอ่านไฟล์เหล่านั้นโดยอัตโนมัติเมื่อต้องการข้อมูล

---

## 🏗️ CLAUDE.md Templates สำหรับงานแต่ละประเภท

### Template: Web API Project
```markdown
# [API Name]

## Stack: Node.js + TypeScript + Fastify + Prisma + PostgreSQL

## API Design Rules
- RESTful: GET/POST/PUT/DELETE ตาม resource
- Versioning: /api/v1/resource
- Response format: { data: T, error: null } หรือ { data: null, error: ErrorObject }
- Pagination: ?page=1&limit=20 เสมอสำหรับ list endpoints

## Database Rules  
- ห้ามเขียน raw SQL — ใช้ Prisma queries เท่านั้น
- ทุก query ต้องมี index hint ถ้า filter column ไม่มี index
- N+1 Query ห้ามเด็ดขาด — ใช้ include หรือ select

## Security Checklist (ทำทุกครั้งที่สร้าง endpoint ใหม่)
- [ ] Input validation ด้วย Zod
- [ ] Authentication middleware
- [ ] Rate limiting
- [ ] SQL injection prevention (Prisma จัดการ)
- [ ] XSS prevention (sanitize output)
```

### Template: Data Processing Script
```markdown
# Data Pipeline Scripts

## Safety First
- ทุก script ต้องมี --dry-run flag
- แสดงจำนวน records ที่จะถูก affect ก่อนทำจริง
- มี progress bar สำหรับ large datasets
- Log ทุก operation ลง file ด้วย timestamp

## Performance
- Batch size: 1,000 records ต่อ transaction
- ไม่โหลด dataset ทั้งหมดเข้า memory — ใช้ streaming
- จำกัด concurrent connections: max 5
```

---

## ⚠️ Anti-Patterns: CLAUDE.md ที่เขียนผิด

### ❌ Anti-Pattern 1: กว้างเกินไป ไม่มีประโยชน์
```markdown
# CLAUDE.md (แบบผิด)
- เขียนโค้ดให้ดี
- ระวัง Security
- ทำงานอย่างมีประสิทธิภาพ
```
AI ยังคงเดาทุกอย่างอยู่เหมือนเดิม

### ❌ Anti-Pattern 2: ขัดแย้งกันเอง
```markdown
# CLAUDE.md (แบบผิด)
- ใช้ Express.js
- ใช้ Fastify สำหรับ performance
```
AI จะสับสนและเลือกเอาเอง

### ❌ Anti-Pattern 3: ยาวเกินไปจน AI จำไม่หมด
CLAUDE.md ที่ดีควรมีความยาวไม่เกิน **300-500 บรรทัด** ถ้ายาวกว่านั้นให้แยกเป็นไฟล์ย่อยและ reference แทน

### ✅ Pattern ที่ถูก: Specific + Actionable
```markdown
# CLAUDE.md (แบบถูก)
- Hashing: ใช้ bcryptjs rounds 12 เสมอ (ห้ามใช้ crypto.createHash)
- Dates: ใช้ date-fns ห้ามใช้ moment.js (deprecated)
- UUID: ใช้ crypto.randomUUID() ไม่ใช้ uuid package
```
ทุกกฎสามารถ follow ได้ทันทีโดยไม่ต้องตีความ

---

## 💻 Hands-On: เขียน CLAUDE.md สำหรับโปรเจกต์จริง

**แบบฝึกหัด:** เปิดโปรเจกต์ที่คุณทำงานอยู่จริงๆ แล้วสร้าง CLAUDE.md โดยตอบคำถาม 10 ข้อนี้:

```markdown
# CLAUDE.md Questionnaire

## 1. โปรเจกต์นี้ทำอะไร? (1-2 ประโยค)
[ตอบ]

## 2. Tech Stack อะไร? (ระบุ version ด้วย)
[ตอบ]

## 3. Library ไหนที่ห้ามใช้? เพราะอะไร?
[ตอบ]

## 4. Naming Convention เป็นยังไง?
[ตอบ]

## 5. Architecture Pattern คืออะไร?
[ตอบ]

## 6. การจัดการ Error ทำยังไง?
[ตอบ]

## 7. ไฟล์ไหนที่ห้ามแตะ?
[ตอบ]

## 8. Database rules มีอะไรบ้าง?
[ตอบ]

## 9. Security requirements มีอะไร?
[ตอบ]

## 10. สิ่งที่ AI ไม่ควรทำเด็ดขาดคืออะไร?
[ตอบ]
```

หลังจากตอบครบแล้ว ให้ส่งคำตอบทั้ง 10 ข้อให้ Claude แล้วบอกว่า:
```
"จากคำตอบเหล่านี้ ช่วยสร้าง CLAUDE.md ที่สมบูรณ์ให้ฉันหน่อย ใส่ Safety Rules ด้วย"
```

Claude จะสร้าง CLAUDE.md ฉบับสมบูรณ์ให้คุณทันที

---

## 🧪 ทดสอบคุณภาพ CLAUDE.md ของคุณ

หลังสร้าง CLAUDE.md แล้ว ให้ทดสอบด้วย 5 คำสั่งนี้:

```bash
claude

# Test 1: ดูว่า AI รู้จัก Tech Stack ไหม
> "อยากเพิ่ม caching layer ควรใช้อะไรดี?"
# คาดหวัง: แนะนำ Redis (ตามที่ระบุ) ไม่ใช่ Memcached

# Test 2: ดูว่า Architecture Rules ทำงานไหม
> "เขียน endpoint สร้าง User ให้หน่อย"
# คาดหวัง: แยก Controller / Service / Repository ถูกต้อง

# Test 3: ดูว่า Safety Rules ทำงานไหม
> "ลบ User ที่ไม่ได้ Login มา 1 ปีออกทั้งหมด"
# คาดหวัง: เสนอ Dry Run ก่อน ไม่ทำทันที

# Test 4: ดูว่า Library Choice ถูกไหม
> "เขียน function validate email"
# คาดหวัง: ใช้ Zod ไม่ใช่ validator.js หรือ custom regex

# Test 5: ดูว่า Error Handling Pattern ถูกไหม
> "เขียน function ดึงข้อมูล User จาก DB"
# คาดหวัง: return { data, error } pattern ที่กำหนดไว้
```

ถ้าผ่านทุก Test — CLAUDE.md ของคุณใช้งานได้จริงแล้วครับ!

---

## 🎯 สรุปบทที่ 3

| หัวข้อ | สิ่งที่ต้องจำ |
|--------|--------------|
| CLAUDE.md คืออะไร | System Prompt ถาวรที่โหลดอัตโนมัติทุก Session |
| 6 Sections สำคัญ | Identity / Tech Stack / Standards / Architecture / Safety / File Boundaries |
| Safety Rules | AI จะปฏิเสธแม้แต่คำสั่งคุณเองถ้าขัดกับ Safety Rules |
| Anti-Pattern | กว้างเกินไป / ขัดแย้งกัน / ยาวเกิน 500 บรรทัด |
| ทดสอบ | 5 Test Cases ที่พิสูจน์ว่า CLAUDE.md ทำงานจริง |

---

## 📋 Action Items ก่อนไปบทที่ 4

- [ ] สร้าง CLAUDE.md สมบูรณ์สำหรับโปรเจกต์ปัจจุบัน (ใช้ Questionnaire 10 ข้อ)
- [ ] ทดสอบด้วย 5 Test Cases ด้านบน
- [ ] แก้ส่วนที่ AI ยังตอบผิด
- [ ] Commit CLAUDE.md เข้า Git เพื่อให้ทีมใช้ร่วมกัน

---

*ใน **บทที่ 4** เราจะสร้าง `TASKS.md` และเรียนรู้ The Ralph Loop อย่างละเอียด — ระบบที่ทำให้ Claude ทำงานข้ามคืนแทนคุณได้โดยไม่หลุด Track และรู้ว่าต้องหยุดรอคุณตอนไหนครับ*
