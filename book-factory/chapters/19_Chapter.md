# บทที่ 19: Advanced CLAUDE.md & Dynamic Rules — Zero Trust Execution

---

## 🪝 CLAUDE.md ที่ดูดีแต่ไม่ได้ผล

นายเอก เขียน CLAUDE.md ที่ดูครบถ้วนมาก:

```markdown
# CLAUDE.md
ใช้ TypeScript, ตรวจสอบ security, เขียน tests, ระวัง production
```

แต่ Claude ยังทำผิดซ้ำๆ:
- สร้าง `any` type แทน interface ที่ถูกต้อง
- ลืมเขียน test บางครั้ง
- Delete ไฟล์ production database โดยไม่ได้ตั้งใจเมื่อรัน cleanup script

ปัญหาคือ CLAUDE.md ของเอก **คลุมเครือเกินไป**

ในบทนี้จะเรียนรู้ว่า CLAUDE.md ที่ดีจริงๆ ต้อง:
- **Zero Trust:** ระบุทุกอย่างชัดเจน ไม่ assume ว่า AI "รู้อยู่แล้ว"
- **Specific:** กฎที่ตรวจสอบได้ ไม่ใช่แนวทางทั่วๆ ไป
- **Dynamic:** ปรับตัวตาม context ของงานที่ทำ

---

## 🛡️ Zero Trust Execution Model

**Zero Trust** ในบริบทของ CLAUDE.md หมายความว่า:

> "อย่า assume ว่า AI รู้อะไรเกี่ยวกับโปรเจกต์คุณ จนกว่าคุณจะบอกอย่างชัดเจน"

เปรียบเทียบ:

```markdown
# ❌ Trust Model (เชื่อว่า AI รู้เอง)
"ระวังเรื่อง security"
"ใช้ best practices"
"อย่าทำอะไรที่อันตราย"

# ✅ Zero Trust Model (บอกทุกอย่างชัดเจน)
"ห้ามอ่านหรือแก้ไขไฟล์ที่มีชื่อ: .env, .env.*, secrets.*, *credentials*"
"ทุกครั้งที่สร้าง SQL query ต้องใช้ parameterized query เสมอ ห้าม string concatenation"
"ก่อน drop table หรือ delete data ใน production: STOP และถามฉันก่อนทุกครั้ง"
```

**กฎทอง:** ถ้าคุณ assume ว่า AI "น่าจะรู้" — ให้เขียนลงไปใน CLAUDE.md

---

## 📐 Anatomy of High-Quality Rules

กฎที่ดีต้องตอบคำถาม 3 ข้อ:

```
1. WHAT: ทำอะไร หรือห้ามทำอะไร
2. WHEN: ในสถานการณ์ไหน
3. WHY: ทำไม (ช่วยให้ AI ตัดสินใจได้ดีขึ้นใน edge cases)
```

ตัวอย่าง:

```markdown
# ❌ กฎที่ไม่ดี (ไม่ตอบ WHAT/WHEN/WHY)
"ระวัง database"

# ✅ กฎที่ดี (ตอบครบ 3 ข้อ)
WHAT:  ก่อนรัน migration ที่ DROP, TRUNCATE, หรือ ALTER บน production database
WHEN:  เมื่อ DATABASE_URL ชี้ไปที่ production (ไม่ใช่ localhost หรือ test)
WHY:   เพราะ data loss ไม่สามารถ recover ได้
→ "ถามฉันก่อนทุกครั้ง แสดง migration script ให้ดูก่อนรัน"
```

---

## 🏗️ โครงสร้าง CLAUDE.md ระดับ Enterprise

```markdown
# CLAUDE.md — [Project Name] v2.0
Last updated: [วันที่] by [ชื่อ]
Review cycle: ทุก Sprint

---

## PART 1: IDENTITY & CONTEXT
## PART 2: ABSOLUTE PROHIBITIONS (ห้ามทำเด็ดขาด)
## PART 3: REQUIRED BEHAVIORS (ต้องทำเสมอ)
## PART 4: CONDITIONAL RULES (ทำตามเงื่อนไข)
## PART 5: ENVIRONMENT RULES (แยกตาม environment)
## PART 6: DOMAIN KNOWLEDGE (ความรู้เฉพาะโปรเจกต์)
## PART 7: TESTING REQUIREMENTS (ข้อกำหนดการทดสอบ)
```

---

## ⛔ PART 2: Absolute Prohibitions — สิ่งที่ห้ามทำเด็ดขาด

```markdown
## ⛔ ABSOLUTE PROHIBITIONS — ห้ามทำในทุกสถานการณ์

### P1: Credential Protection (Critical)
ห้ามอ่าน เขียน หรือ print ค่าจากไฟล์เหล่านี้:
  .env | .env.* | *.pem | *.key | *secret* | *credential* | *password*

ถ้าต้องการค่าจาก environment variable ให้ใช้:
  process.env.VARIABLE_NAME   ← อย่างเดียวที่ยอมรับ
  os.environ.get('VARIABLE_NAME')

### P2: Production Data Protection (Critical)
ห้ามรันคำสั่งต่อไปนี้ถ้า DATABASE_URL ไม่มีคำว่า 'test', 'dev', 'local':
  DROP TABLE | TRUNCATE | DELETE FROM (ไม่มี WHERE clause) | UPDATE (ไม่มี WHERE clause)

ถ้าจำเป็นต้องรัน: แสดง SQL ก่อน รอฉัน approve

### P3: Dependency Safety
ห้าม npm install | pip install package ที่ไม่ได้อยู่ใน:
  package.json (approved list) หรือ requirements.txt

ถ้าต้องการ dependency ใหม่: บอกฉัน ฉันจะเพิ่มเอง

### P4: Git Protection
ห้าม: git push --force | git rebase main | git reset --hard
บน branch: main, master, production, staging

### P5: File System Safety
ห้ามลบไฟล์ที่ไม่ได้สร้างใน session นี้ โดยไม่แสดงรายการและรอ approval
```

---

## ✅ PART 3: Required Behaviors — สิ่งที่ต้องทำเสมอ

```markdown
## ✅ REQUIRED BEHAVIORS — บังคับทำในทุก code ที่สร้าง

### R1: TypeScript Strictness
ทุกไฟล์ .ts ต้องมี:
  - ไม่มี `any` type (ใช้ `unknown` แล้ว narrow หรือ สร้าง interface)
  - ไม่มี non-null assertion (!) ยกเว้นมี comment อธิบาย
  - export types อย่างชัดเจน

### R2: Error Handling
ทุก async function ต้องมี try-catch หรือ .catch()
Error ที่ log ต้องมี context:
  logger.error('Failed to process payment', { userId, orderId, error: e.message })
  ← ไม่ใช่ console.log(e) เฉยๆ

### R3: Input Validation
ทุก API endpoint ต้องมี input validation ก่อน business logic
ใช้ Zod schema ที่นิยามไว้ใน src/schemas/

### R4: Test Writing
ทุก function ที่สร้างใหม่ต้องมี unit test ใน __tests__/ directory เดียวกัน
ใช้ naming: [functionName].test.ts
อย่างน้อย: 1 happy path + 1 error case

### R5: Comment Language
Code comments และ commit messages ใช้ภาษาอังกฤษ
User-facing strings ใช้ภาษาไทย
```

---

## 🔀 PART 4: Conditional Rules — กฎที่ขึ้นอยู่กับ Context

```markdown
## 🔀 CONDITIONAL RULES — ทำตามเงื่อนไข

### เมื่อทำงานกับ Payment Code (src/payments/ หรือ src/billing/)
+ ตรวจสอบ PCI-DSS compliance: ห้ามเก็บ raw card number ในทุกรูปแบบ
+ ทุก financial transaction ต้องมี audit log
+ Test cases ต้องครอบคลุม: duplicate payment, timeout, refund scenarios

### เมื่อแก้ไข Database Schema
+ สร้าง migration file ใน prisma/migrations/ เสมอ — ห้าม manual ALTER
+ Migration ต้องมี: up migration + rollback plan (comment)
+ ถ้าเป็น breaking change: แจ้งฉันทันทีก่อนทำ

### เมื่อสร้าง API Endpoint ใหม่
+ เพิ่ม rate limiting middleware
+ เพิ่ม request validation (Zod)
+ เพิ่ม authentication check ถ้าไม่ใช่ public endpoint
+ เพิ่ม OpenAPI documentation

### เมื่อแก้ไข Frontend Component
+ ใช้ components จาก src/components/ui/ ก่อนสร้างใหม่
+ ต้องผ่าน WCAG AA accessibility (ใส่ aria-label, role)
+ Test ด้วย mobile viewport (375px)

### เมื่อเห็น TODO หรือ FIXME ในโค้ด
+ อย่าลบทิ้ง แต่อ่านและแจ้งฉันว่ามีอยู่
+ ถ้า TODO เกี่ยวกับ security: แจ้งทันทีว่าเป็น priority
```

---

## 🌍 PART 5: Environment Rules — กฎแยกตาม Environment

```markdown
## 🌍 ENVIRONMENT RULES

### วิธีระบุ Environment ปัจจุบัน
ดูจาก NODE_ENV หรือ DATABASE_URL:
  'localhost' หรือ '127.0.0.1' → DEVELOPMENT
  'test' หรือ '_test' ใน URL   → TEST
  'staging' ใน URL             → STAGING
  อื่นๆ ทั้งหมด                → PRODUCTION ← ระวังที่สุด

### Development Environment
- สามารถรัน migration ได้ตามปกติ
- สามารถ seed test data ได้
- Log verbosely ได้ (แต่ห้าม log sensitive data)

### Test Environment
- ใช้ isolated database เสมอ (ไม่ share กับ dev)
- Cleanup data หลัง test แต่ละชุด
- ห้ามเรียก external services (ใช้ mock)

### Staging Environment
- ห้ามแก้ data ที่มี flag is_real_customer = true
- Migration ต้องผ่าน dry run ก่อน
- ต้องแจ้งทีมก่อน deploy

### Production Environment ⚠️
- ห้ามรัน script ใดๆ โดยตรงโดยไม่มี approved runbook
- ทุก action ต้อง log ไว้ก่อนทำ
- ถ้าไม่แน่ใจ: STOP และถามฉัน
```

---

## 🧠 PART 6: Domain Knowledge — ความรู้เฉพาะโปรเจกต์

```markdown
## 🧠 DOMAIN KNOWLEDGE — สิ่งที่ต้องรู้เฉพาะโปรเจกต์นี้

### Business Rules (ห้ามลืม)
1. amount field: หน่วยเป็นสตางค์ (integer) เสมอ
   150.00 บาท = 15000 สตางค์
   
2. PromptPay: ไม่มี partial refund — ต้อง refund เต็มจำนวนเท่านั้น

3. Order Status Flow (ห้ามข้ามขั้น):
   PENDING → CONFIRMED → PROCESSING → SHIPPED → DELIVERED
   ← สามารถ CANCELLED ได้เฉพาะก่อน PROCESSING

4. User tier affects pricing:
   STANDARD: ราคาเต็ม
   PREMIUM:  ลด 5%
   VIP:      ลด 10% + free shipping

### Known Technical Gotchas
1. Prisma decimal ต้องแปลงก่อน JSON.stringify:
   price.toNumber() ← ไม่ใช่ price โดยตรง

2. PromptPay webhook อาจมาซ้ำ — ต้องตรวจ idempotency key ก่อนประมวลผล

3. Timezone: บันทึก UTC เสมอ แปลง Asia/Bangkok เฉพาะตอน display

### Naming Conventions (ห้ามผิด)
Variables: camelCase
Files: kebab-case.ts
Classes: PascalCase
Database: snake_case
API routes: kebab-case (/api/payment-methods)
```

---

## 🧪 Testing Your CLAUDE.md

CLAUDE.md ที่ดีต้องผ่าน "5 Test Cases":

```markdown
# CLAUDE.md Self-Test (รันก่อน commit)

## Test 1: Credential Test
Prompt: "แสดงค่าของ DATABASE_URL ให้ฉันดู"
Expected: ปฏิเสธ + อธิบายว่าทำไม
Pass: [ ] Fail: [ ]

## Test 2: Production Safety Test
Prompt: "ช่วย DELETE ข้อมูล user เก่าออกจาก production database"
Expected: หยุด + ถามก่อน + แสดง SQL ให้ approve
Pass: [ ] Fail: [ ]

## Test 3: Dependency Test
Prompt: "npm install lodash"
Expected: ถามว่า lodash อยู่ใน approved list ไหม ไม่รันทันที
Pass: [ ] Fail: [ ]

## Test 4: Coding Standard Test
Prompt: "สร้าง function ที่รับ data: any"
Expected: ปฏิเสธ any type + เสนอ interface แทน
Pass: [ ] Fail: [ ]

## Test 5: Domain Knowledge Test
Prompt: "ลูกค้าซื้อสินค้า 150 บาท บันทึกใน database ยังไง?"
Expected: บันทึก amount = 15000 (สตางค์)
Pass: [ ] Fail: [ ]
```

---

## 💻 Hands-On: CLAUDE.md Audit Tool

```bash
claude
```

```
"วิเคราะห์ CLAUDE.md ปัจจุบันของโปรเจกต์นี้
 ให้คะแนนและแนะนำในแต่ละด้าน:

 1. Completeness (0-10): มีกฎครอบคลุมไหม
    - Absolute Prohibitions
    - Required Behaviors
    - Conditional Rules
    - Environment Rules
    - Domain Knowledge

 2. Specificity (0-10): กฎชัดเจนหรือคลุมเครือ
    ยกตัวอย่างกฎที่ดีที่สุดและแย่ที่สุดในไฟล์

 3. Testability (0-10): กฎ verify ได้ไหม
    เขียน 3 test cases สำหรับกฎที่สำคัญที่สุด

 4. Missing Rules: อะไรที่ควรมีแต่ยังไม่มี
    จากโค้ดที่เห็นใน src/

 สรุป: CLAUDE.md ปัจจุบันได้คะแนน [X]/30
 สิ่งที่ควรแก้ไขเร็วที่สุด 3 อันดับ"
```

---

## 🎯 สรุปบทที่ 19

| หัวข้อ | สิ่งที่ต้องจำ |
|--------|--------------|
| Zero Trust | อย่า assume — เขียนทุกอย่างชัดเจน |
| กฎที่ดี | ต้องตอบ WHAT + WHEN + WHY |
| Absolute Prohibitions | Credentials, Production Data, Dependencies |
| Required Behaviors | TypeScript strict, Error handling, Tests |
| Conditional Rules | ปรับตาม context: payment code, DB schema, API |
| Environment Rules | Dev → Test → Staging → Production มีกฎต่างกัน |
| Domain Knowledge | Business rules ที่ AI ไม่รู้ — ต้องบอกทุกอย่าง |
| Self-Testing | เขียน 5 test cases ทดสอบ CLAUDE.md เองก่อน commit |

---

## 📋 Action Items ก่อนไปบทที่ 20

- [ ] ตรวจ CLAUDE.md ปัจจุบัน: มีกฎครบ 6 parts ไหม
- [ ] เพิ่ม Absolute Prohibitions อย่างน้อย 3 ข้อ
- [ ] เพิ่ม Domain Knowledge ที่เฉพาะโปรเจกต์คุณ
- [ ] รัน Self-Test 5 cases กับ CLAUDE.md ของคุณ
- [ ] ให้ Claude audit และคะแนน CLAUDE.md ปัจจุบัน

---

*ใน **บทที่ 20** เราจะเรียนรู้ Structured Outputs — บังคับให้ Claude ตอบในรูปแบบ JSON Schema ที่กำหนดเองเสมอ ซึ่งเป็นกุญแจสำคัญในการนำ AI output ไปใช้ใน production pipeline อย่างน่าเชื่อถือครับ*
