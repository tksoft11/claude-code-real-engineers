# บทที่ 4: The Ralph Loop — AFK Coding ข้ามคืน

---

## 🪝 วันที่เปลี่ยนชีวิตของ Ralph

Ralph เป็น Backend Developer ที่บริษัท Fintech ในสิงคโปร์ เขาได้รับ Task ใหญ่: สร้าง Payment Gateway Integration กับ 3 Provider (Stripe, Omise, PromptPay) ภายใน Sprint 2 สัปดาห์

วันพฤหัสบดีเวลา 17:30 น. เขาเปิดไฟล์ `TASKS.md` ใหม่ เขียน Task ทั้งหมดลงไปอย่างละเอียด จากนั้นพิมพ์ใน Claude:

```
"อ่าน CLAUDE.md และ TASKS.md ก่อน จากนั้นทำ Task ทีละอัน
 ตาม Priority ที่กำหนด test ต้องผ่านก่อนไปต่อ
 อัปเดต TASKS.md เมื่อเสร็จแต่ละ Task
 ถ้าติดอะไรที่ต้องการ input จากฉัน ให้หยุดและ note ไว้"
```

Ralph ออกจากออฟฟิศ ไปกินข้าวเย็น เล่นกับลูก อาบน้ำ และนอนหลับ

เช้าวันศุกร์ 07:15 น. เขาเปิด TASKS.md บนโทรศัพท์ขณะกินกาแฟ:

```markdown
## Sprint Progress (Updated: 06:47 AM)
- [x] Stripe integration — 23 tests passing ✅
- [x] Omise integration — 18 tests passing ✅
- [x] Webhook signature verification ✅
- [/] PromptPay QR generation ⚠️ BLOCKED
      QR library 'promptpay-qr' ไม่ support Node 20
      พบ alternative: 'node-promptpay-qr' (maintained 2024)
      รอการอนุมัติ: ควรใช้ library ตัวใหม่หรือ fork ตัวเดิม?
- [ ] Error retry mechanism (รอ PromptPay ก่อน)
- [ ] Admin dashboard for transaction monitoring
```

งาน 4 ใน 6 Tasks เสร็จภายในคืนเดียว Claude หยุดที่ Blocker ที่ต้องการ Human ตัดสินใจ — และรอ

Ralph ตอบใน Claude: "ใช้ node-promptpay-qr ได้เลย" Claude ทำงานต่ออีก 45 นาที — Sprint เสร็จก่อนกำหนด 3 วัน

**นี่คือ The Ralph Loop ครับ**

---

## 🔄 The Ralph Loop คืออะไร

The Ralph Loop คือกระบวนการ **Human-AI Collaboration** ที่ออกแบบมาเพื่อให้ AI ทำงานได้เป็นระยะเวลายาว โดยมี Human เป็นผู้ตัดสินใจเฉพาะตอนที่จำเป็น

```
┌──────────────────────────────────────────────────────┐
│                  THE RALPH LOOP                      │
│                                                      │
│  👤 คุณ (Plan)                                       │
│  ├── เขียน TASKS.md ให้ละเอียด                      │
│  └── กำหนด "Blocker Criteria" ให้ชัด               │
│         ↓                                            │
│  🤖 Claude (Execute)                                 │
│  ├── อ่าน CLAUDE.md + TASKS.md                      │
│  ├── ทำ Task ทีละอัน                                │
│  ├── รัน test หลังแต่ละ Task                        │
│  ├── อัปเดต TASKS.md                                │
│  └── หยุดเมื่อเจอ Blocker → รอ Human               │
│         ↓                                            │
│  👤 คุณ (Verify & Unblock)                          │
│  ├── Review งานที่เสร็จ                              │
│  ├── ตัดสินใจใน Blockers                            │
│  └── กด Loop ต่อ หรือ Deploy                        │
└──────────────────────────────────────────────────────┘
```

---

## 📋 TASKS.md: ศิลปะการเขียน Task ที่ AI ทำได้

TASKS.md คือ "ใบงาน" ที่คุณมอบให้ Claude ทุกอย่างที่ไม่ชัดเจนใน TASKS.md จะทำให้ AI เดาหรือหยุดงาน

### โครงสร้าง TASKS.md ที่ดี

```markdown
# TASKS.md — Sprint: [ชื่อ Sprint]
**เป้าหมาย:** [สิ่งที่ต้องส่งมอบเมื่อ Sprint นี้เสร็จ]
**เส้นตาย:** [วันที่หรือ Session นี้]

---

## 🔴 Priority 1: Critical (ทำก่อน)
- [ ] Task A — สร้าง user authentication endpoint
      **Input:** user email + password
      **Output:** JWT token (access 15m + refresh 7d)
      **Test:** ต้องผ่าน test ใน tests/auth.test.ts
      **Done When:** curl localhost:3000/api/auth/login ส่ง token กลับมา

## 🟡 Priority 2: Important (ทำถ้า P1 เสร็จ)
- [ ] Task B — เพิ่ม rate limiting ที่ login endpoint
      **Spec:** max 5 attempts per IP per 15 minutes
      **Library:** ใช้ @fastify/rate-limit (มีอยู่แล้วใน package.json)

## 🟢 Priority 3: Nice to have (ทำถ้ายังมีเวลา)
- [ ] Task C — เพิ่ม logging สำหรับ failed login attempts

---

## 🚫 Blocker Criteria (หยุดและรอ Human ถ้าเจอสิ่งนี้)
- ต้องการ API Key หรือ credentials ใหม่
- ต้องตัดสินใจเรื่อง Architecture ที่ไม่มีใน CLAUDE.md
- Test ล้มเหลวและหาสาเหตุไม่ได้ใน 3 attempts
- พบ Security issue ที่ต้องการ Human ตรวจสอบ

---

## ✅ Completed
(ว่างไว้ — Claude จะย้าย Task ที่เสร็จมาที่นี่)
```

---

## ✍️ เทคนิคเขียน Task ให้ AI ทำได้โดยไม่ติด

### หลักการ: Task ที่ดีต้องตอบ 4 คำถาม

**1. Input คืออะไร?**
```markdown
# ❌ คลุมเครือ
- สร้าง search API

# ✅ ชัดเจน  
- สร้าง GET /api/products/search
  Input: ?q=keyword&category=electronics&page=1&limit=20
  Source: ค้นใน PostgreSQL table 'products' column 'name' และ 'description'
```

**2. Output ควรเป็นอะไร?**
```markdown
# ❌ คลุมเครือ
- ส่ง result กลับมา

# ✅ ชัดเจน
  Output: { data: Product[], total: number, page: number, hasMore: boolean }
  HTTP Status: 200 (found), 400 (invalid params)
```

**3. Done When คืออะไร?**
```markdown
# ❌ คลุมเครือ
- ทดสอบว่าทำงานได้

# ✅ ชัดเจน
  Done When:
  - npm test ผ่าน tests/search.test.ts ทุก case
  - ?q=iphone ส่ง products กลับมาถูกต้อง
  - ?q= (ว่าง) ส่ง 400 error กลับมา
```

**4. Edge Cases ที่ต้องจัดการ?**
```markdown
  Edge Cases:
  - keyword มี special characters เช่น % หรือ ' → sanitize
  - keyword ภาษาไทย → ต้องทำงานได้
  - page ติดลบ → ส่ง 400
  - limit > 100 → clamp เป็น 100
```

---

## 🌙 Setup สำหรับ Ralph Loop ข้ามคืน

### ขั้นตอนก่อนออกจากออฟฟิศ

**Step 1: ตรวจสอบว่า CLAUDE.md อัปเดตแล้ว**
```bash
# เปิด Claude ถามก่อน
claude
> "อ่าน CLAUDE.md แล้วบอกว่าโปรเจกต์นี้ใช้ Database อะไรและมี Safety Rule อะไรบ้าง?"
# ถ้าตอบถูก — CLAUDE.md ทำงานอยู่
```

**Step 2: เขียน TASKS.md ให้ละเอียด**
```markdown
# TASKS.md — Overnight Run (15 พ.ค. 2568)
เป้าหมาย: สร้างระบบ notification สำหรับ order status changes

## Priority 1
- [ ] สร้าง Notification model ใน Prisma schema
      Fields: id (uuid), userId (FK), type (enum: ORDER_PAID|ORDER_SHIPPED|ORDER_DELIVERED), 
              message (text), isRead (bool default false), createdAt
      Migration: รัน prisma migrate dev --name add-notifications
      
- [ ] สร้าง NotificationService
      Methods: create(userId, type, message), markAsRead(id, userId), 
               getUnread(userId), getAll(userId, page, limit)
      Test file: tests/notification.service.test.ts (สร้างใหม่)

- [ ] สร้าง REST endpoints
      POST /api/notifications/:id/read
      GET  /api/notifications?page=1&limit=20
      GET  /api/notifications/unread-count
      Test file: tests/notification.api.test.ts (สร้างใหม่)

## Blocker Criteria
- ถ้า Migration fail → หยุด อย่าพยายามแก้ schema เดิม
- ถ้าไม่แน่ใจเรื่อง WebSocket vs Polling → หยุด ทำแค่ REST ก่อน
```

**Step 3: สั่ง Claude แล้วออกไป**
```bash
claude
```
```
"อ่าน CLAUDE.md และ TASKS.md ทั้งหมดก่อน สรุปให้ฉันก่อนเริ่มว่าเข้าใจ Task อะไรบ้าง จากนั้นเริ่ม P1 Task แรก ทำทีละ Task ให้เสร็จและ test ผ่านก่อนไปต่อ อัปเดต TASKS.md ทุกครั้งที่เสร็จ Task"
```

หลังจาก Claude สรุป Task ให้คุณฟังว่าเข้าใจถูกต้อง — ออกจากออฟฟิศได้เลยครับ

---

## ☀️ เช้าวันใหม่: วิธี Review งานที่ AI ทำข้ามคืน

### Checklist เมื่อกลับมา

```markdown
□ 1. เปิด TASKS.md ดูว่าทำถึงไหน มี Blocker ไหม
□ 2. รัน test suite ทั้งหมด: npm test
□ 3. git log --oneline -20 ดู commits ที่ AI ทำ
□ 4. git diff HEAD~[จำนวน commits] review โค้ดที่เปลี่ยน
□ 5. แก้ Blockers ที่ AI หยุดรอ
□ 6. รัน application ลองใช้จริง ไม่ใช่แค่ test
```

### วิธี Review Git Log อย่างมีประสิทธิภาพ

```bash
# ดู commits ที่ AI ทำ
git log --oneline --since="yesterday 6pm"

# ดูว่าไฟล์อะไรเปลี่ยนบ้าง
git diff --stat HEAD~10

# Review โค้ดที่เปลี่ยนใน src/
git diff HEAD~10 -- src/

# ถ้าเจอ commit ที่น่าสงสัย ดูรายละเอียด
git show <commit-hash>
```

### สั่ง Claude ช่วย Review งานตัวเอง

```
"ดู git log 20 commits ล่าสุด สรุปให้ฉันว่า:
 1. ทำ Task อะไรเสร็จบ้าง
 2. มีการตัดสินใจ Design อะไรที่ต้องการ approval ฉัน
 3. มี test ไหนที่ผ่านด้วยการ workaround แทน proper fix
 4. มีอะไรที่เป็น technical debt ที่ควรจดไว้ทำทีหลัง"
```

---

## ⚡ Ralph Loop Patterns ที่ใช้งานได้จริง

### Pattern 1: The Feature Sprint
```
เย็นวันศุกร์ → สั่ง Ralph Loop → เช้าวันจันทร์ Feature เสร็จ
```
ใช้กับ: Feature ใหม่ที่ไม่มี Dependency ซับซ้อน

### Pattern 2: The Refactor Night
```
เวลาเช้า (วิเคราะห์โค้ดที่จะ refactor) → เที่ยง (เขียน TASKS.md ละเอียด) 
→ บ่าย (สั่ง Loop ขณะทำงานอื่น) → เย็น (review ผล)
```
ใช้กับ: งาน Refactor ที่มีขอบเขตชัด

### Pattern 3: The Test Coverage Blitz
```
เขียน TASKS.md ระบุ files ที่ต้องเพิ่ม test 
→ Loop รันตอนกลางคืน → เช้ามา coverage ขึ้น
```
ตัวอย่าง TASKS.md สำหรับ pattern นี้:
```markdown
## เพิ่ม Test Coverage จาก 23% → 70%

### ไฟล์ที่ต้องเพิ่ม test (ตามลำดับ)
- [ ] src/services/user.service.ts → tests/user.service.test.ts
      Test scenarios: create, findById, update, delete, findByEmail
      Edge cases: duplicate email, invalid id, soft delete

- [ ] src/services/order.service.ts → tests/order.service.test.ts
      Test scenarios: create, updateStatus, cancel, getByUser
      Edge cases: insufficient stock, invalid status transition

[ต่อเนื่องสำหรับทุกไฟล์]
```

### Pattern 4: The Documentation Marathon
```markdown
## Task: สร้าง API Documentation

- [ ] อ่านทุก Route file ใน src/routes/
- [ ] สร้าง docs/API.md ในรูปแบบ OpenAPI-like
      สำหรับทุก endpoint: method, path, params, body, response, error codes
- [ ] สร้าง ARCHITECTURE.md อธิบาย high-level design
- [ ] อัปเดต README.md ให้มี getting started guide
```

---

## 💥 เมื่อ Ralph Loop พลาด — บทเรียนจากคืนที่เกือบ Roll Back ทั้งโปรเจกต์

*เรื่องนี้เกิดขึ้นจริงครับ*

ไผ่ Senior Developer ที่ผม Mentor ให้ เขาตื่นเต้นกับ Ralph Loop มาก ตัดสินใจสั่งให้ Claude ทำงานข้ามคืน โดยเขียน Task แบบนี้:

```markdown
## Task
- [ ] Refactor ระบบ Database ให้ดีขึ้น
- [ ] Optimize queries ที่ช้า  
- [ ] Clean up code
```

ไม่มี Blocker Criteria เขาออกไปกินข้าวเย็นพร้อมครอบครัว กลับมาตอน 4 ทุ่ม

Claude ทำงานเสร็จ ✅ มี 847 changes ใน 23 ไฟล์

เขาดีใจมาก รัน `npm test` — **ผ่าน 100%**

กด Deploy ขึ้น Staging

จากนั้น QA รายงานว่า:
- User ทุกคน Login ไม่ได้
- ข้อมูล Order ของ User ค้นไม่เจอ
- Cart ล้างข้อมูลตัวเอง

สิ่งที่เกิดขึ้น: Claude "Optimize" โดยเปลี่ยน Primary Key จาก `uuid()` เป็น Auto-Increment Integer เพราะเร็วกว่า — แต่นั่นทำลาย Foreign Key relationships ของ Orders, Sessions, และ Cart

Tests ผ่านเพราะ Test Database ถูก Recreate ใหม่ทุกรัน แต่ Production Data ที่มี UUID เดิมอยู่ในชั้น Relation ถูกทำลายหมด

**เวลาที่ใช้ Roll Back: 6 ชั่วโมง**

### บทเรียนที่ต้องจำ

```markdown
## ❌ Task ที่ทำให้ Ralph Loop พลาด
- [ ] Refactor ระบบ Database ให้ดีขึ้น
      ("ดีขึ้น" ไม่มีคำจำกัดความ — AI จะตีความเอง)

## ✅ Task ที่ปลอดภัย
- [ ] Optimize query ใน getOrdersByUser()
      ปัญหา: query ช้า 3 วินาที เมื่อ User มี Orders เกิน 1,000 รายการ
      วิธีการ: เพิ่ม Database Index บน column 'userId' และ 'createdAt' เท่านั้น
      ห้าม: เปลี่ยน Schema, เปลี่ยน Data Type, เปลี่ยน Primary Key format
      Done When: query เร็วขึ้น และ Test ทั้งหมดผ่าน

## Blocker Criteria (ต้องมีเสมอสำหรับงาน DB)
- ถ้าต้องเปลี่ยน Schema → หยุดรอ Human Review
- ถ้าต้องเปลี่ยน Data Type → หยุดรอ Human Review  
- ถ้า Migration ไม่มี Rollback → หยุด
```

> 💡 **กฎทอง:** Task ที่ดีต้องบอกทั้ง "ทำอะไร" และ "ห้ามทำอะไร" ชัดเจนเท่าๆ กัน

---

## ⚠️ Anti-Patterns ที่ทำให้ Ralph Loop ล้มเหลว

### ❌ Anti-Pattern 1: Task คลุมเครือ
```markdown
# แบบผิด
- [ ] ทำ Payment feature ให้เสร็จ

# Claude จะเดาทุกอย่าง → ผลลัพธ์ผิด
```

### ❌ Anti-Pattern 2: ไม่มี Blocker Criteria
```markdown
# ถ้าไม่กำหนดว่า Claude ควรหยุดเมื่อไหร่
# Claude อาจ "แก้ปัญหา" ด้วยการลบ Test ที่ fail
# หรือ hardcode ค่าแทนที่จะทำ proper fix
```

### ❌ Anti-Pattern 3: CLAUDE.md ไม่อัปเดต
```markdown
# ถ้า CLAUDE.md บอกว่าใช้ Mongoose แต่โปรเจกต์เพิ่งย้ายมาใช้ Prisma
# Claude จะเขียนโค้ด Mongoose ทั้งคืน
```

### ❌ Anti-Pattern 4: Task ที่มี Dependency ซ่อนอยู่
```markdown
# แบบผิด
- [ ] สร้าง checkout flow
# แต่ไม่บอกว่า checkout ต้องใช้ inventory service ที่ยังไม่ได้สร้าง

# Claude จะ mock หรือสร้าง inventory service ตามใจตัวเอง
# แล้วเช้ามาคุณต้องแก้ทั้งหมด
```

**วิธีแก้:** เขียน Dependency ให้ชัดในทุก Task
```markdown
- [ ] สร้าง checkout flow
      Depends on: inventory.service.ts (ต้องเสร็จก่อน)
      ถ้า inventory service ยังไม่เสร็จ → หยุดรอ
```

---

## 💻 Hands-On: Ralph Loop ครั้งแรกของคุณ

**โจทย์:** สร้างระบบ Todo API ด้วย Ralph Loop เดี่ยวๆ คืนนี้

**ขั้นตอน:**

```bash
# 1. สร้างโปรเจกต์ใหม่
mkdir todo-api && cd todo-api
npm init -y
npm install fastify @fastify/cors prisma @prisma/client
npm install -D typescript ts-node vitest

# 2. สร้าง CLAUDE.md
```

```markdown
# Todo API

## Stack
- Node.js 20, TypeScript strict, Fastify, Prisma + SQLite (สำหรับ local dev)

## Architecture
- src/routes/     ← HTTP handlers เท่านั้น
- src/services/   ← Business logic
- src/db/         ← Prisma client singleton

## Rules
- ทุก endpoint ต้องมี input validation
- ทุก service function ต้องมี unit test
- ห้าม any type

## Safety
- ห้ามลบ data โดยไม่มี soft delete flag
```

```bash
# 3. สร้าง TASKS.md
```

```markdown
# Todo API — Sprint 1

**เป้าหมาย:** CRUD API สำหรับ Todo items พร้อม test coverage 80%+

## P1: Core Setup
- [ ] Initialize Prisma schema (SQLite)
      Models: Todo { id String @id @default(uuid()), title String, 
              description String?, isCompleted Boolean @default(false),
              createdAt DateTime @default(now()), updatedAt DateTime @updatedAt }
      Run: npx prisma migrate dev --name init

- [ ] สร้าง todo.service.ts
      Methods: create(title, description?), findAll(), findById(id),
               update(id, data), delete(id, softDelete=true)
      Test: tests/todo.service.test.ts

- [ ] สร้าง routes (src/routes/todo.ts)
      GET    /api/todos          ← list all (ไม่แสดง deleted)
      POST   /api/todos          ← create
      GET    /api/todos/:id      ← get one
      PUT    /api/todos/:id      ← update
      DELETE /api/todos/:id      ← soft delete
      Test: tests/todo.api.test.ts

## Blocker Criteria
- Prisma migration fail → หยุด
- Test fail มากกว่า 3 ครั้ง → หยุด comment สาเหตุ
```

```bash
# 4. เปิด Claude และสั่ง Ralph Loop
claude
```

พิมพ์:
```
"อ่าน CLAUDE.md และ TASKS.md ก่อน สรุปให้ฉันก่อนเริ่ม
 จากนั้นทำ P1 Tasks ทั้งหมดตามลำดับ
 ทำ test ให้ผ่านก่อนไปต่อทุกครั้ง
 อัปเดต TASKS.md เมื่อเสร็จ"
```

รอให้ Claude สรุป Task กลับมา — ตรวจว่าเข้าใจถูกต้อง — แล้วปล่อยมันทำงาน

ไปทำอย่างอื่นระหว่างรอ กลับมาตรวจเมื่อเสร็จ

---

## 🎯 สรุปบทที่ 4

| หัวข้อ | สิ่งที่ต้องจำ |
|--------|--------------|
| Ralph Loop | Plan → Execute → Verify → Unblock → Repeat |
| TASKS.md | ต้องตอบ: Input, Output, Done When, Edge Cases |
| Blocker Criteria | กำหนดเสมอ — ไม่งั้น AI จะ "แก้ปัญหา" แบบผิดๆ |
| Review เช้า | git log → npm test → review โค้ด → แก้ Blockers |
| Anti-Pattern | Task คลุมเครือ / ไม่มี Blocker Criteria / Dependency ซ่อน |

---

## 📋 Action Items ก่อนไปบทที่ 5

- [ ] ทำ Hands-on Todo API ครบถ้วน — ลอง Ralph Loop จริงครั้งแรก
- [ ] เขียน TASKS.md สำหรับ Feature ถัดไปในงานจริงของคุณ
- [ ] กำหนด Blocker Criteria สำหรับโปรเจกต์ที่ทำอยู่
- [ ] ลอง run Ralph Loop 1-2 ชั่วโมงระหว่างทำงานอื่น (ไม่ต้องข้ามคืนก่อน)

---

*ใน **บทที่ 5** เราจะเรียนรู้ Skills และ Custom Commands — เครื่องมือที่ทำให้คุณสั่งงาน Claude ด้วยคำสั่งสั้นๆ ที่สร้างเองได้ แทนที่จะพิมพ์ prompt ยาวๆ ซ้ำๆ ทุกครั้งครับ*
