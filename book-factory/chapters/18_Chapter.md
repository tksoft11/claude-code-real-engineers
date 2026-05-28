# บทที่ 18: The Context Trinity — CLAUDE.md + TASKS.md + DESIGN.md

---

## 🪝 ทีมที่ Claude ไม่รู้จักใครเลย

บริษัท Fintech แห่งหนึ่ง มีนักพัฒนา 6 คน ทุกคนใช้ Claude Code — แต่ใช้ในแบบของตัวเอง:

- **นายก้อง** เปิด Terminal พิมพ์ "ช่วยเขียน API สำหรับ payment"
- **นางสาวพลอย** เปิด Terminal พิมพ์ "เขียน component สำหรับ checkout"
- **นายบิ๊ก** เปิด Terminal พิมพ์ "สร้าง database schema สำหรับ orders"

ทั้งสามคนทำงาน **parallel** และทั้งสามคนได้โค้ดที่ **ไม่เชื่อมกัน**:
- Payment API ใช้ `customerId` แต่ Checkout Component ส่ง `userId`
- Database schema ใช้ `order_total` แต่ API คาดหวัง `amount`
- Error format ของแต่ละส่วนต่างกันหมด

ปัญหาคือ Claude แต่ละ session ไม่รู้จักกัน ไม่รู้ว่าทีมอื่นทำอะไรอยู่

**Context Trinity** แก้ปัญหานี้ — ระบบไฟล์ 3 ไฟล์ที่ทุกคนในทีมและทุก Claude session อ้างอิงจาก "source of truth" เดียวกัน

---

## 🔺 The Context Trinity

```
                         ┌──────────────────────┐
                         │      CLAUDE.md       │
                         │   "เราคือใคร"         │
                         │  Architecture Rules  │
                         │  Tech Stack          │
                         │  Team Conventions    │
                         └──────────┬───────────┘
                                    │
               ┌────────────────────┼────────────────────┐
               │                    │                    │
    ┌──────────▼──────────┐         │        ┌──────────▼──────────┐
    │      TASKS.md       │         │        │      DESIGN.md      │
    │   "เรากำลังทำอะไร"  │         │        │   "หน้าตาเป็นยังไง" │
    │  Sprint board       │         │        │  Design system      │
    │  Current blockers   │         │        │  Components spec    │
    │  Done/In-Progress   │         │        │  Color/Typography   │
    └─────────────────────┘         │        └─────────────────────┘
                                    │
                          ทุก Claude session
                          อ่านทั้ง 3 ไฟล์ก่อนเริ่มงาน
```

---

## 📘 File 1: CLAUDE.md — "เราคือใคร"

บทที่ 3 อธิบาย CLAUDE.md สำหรับ individual developer แล้ว แต่สำหรับ **ทีม** ต้องเพิ่มสิ่งเหล่านี้:

```markdown
# CLAUDE.md — TechShop Fintech Platform

## 🏢 Project Identity
Project: TechShop Payment Platform
Team: 6 developers (ก้อง, พลอย, บิ๊ก, นิว, เอก, อาร์ต)
Stack: Node.js 20 + TypeScript 5.3 + Prisma + PostgreSQL 16 + React 18

## 🔑 Shared Data Contracts (ห้ามเปลี่ยนโดยไม่ประกาศทีม)
# ID Fields — ใช้ให้ถูกต้อง
User:    { userId: string }     ← ไม่ใช่ customerId, userID, uid
Order:   { orderId: string }    ← ไม่ใช่ orderNo, id
Payment: { paymentId: string }  ← ไม่ใช่ txId, transactionId

# Money Fields — ทุกที่ใช้แบบนี้
{ amount: number }    ← หน่วยเป็น สตางค์ (integer) เสมอ ไม่ใช่ บาท
{ currency: 'THB' }   ← 3-letter ISO 4217

# Date Fields
{ createdAt: string } ← ISO 8601 UTC เสมอ: "2025-05-15T00:00:00Z"

## 🚨 Error Format (Standard ทั้ง Platform)
{
  "error": {
    "code": "PAYMENT_FAILED",     ← SCREAMING_SNAKE_CASE
    "message": "ข้อความสำหรับ Developer",
    "userMessage": "ข้อความสำหรับ User (ภาษาไทย)",
    "timestamp": "ISO8601"
  }
}

## 📁 Folder Structure (ห้ามสร้างใหม่โดยไม่ประชุมทีม)
src/
├── api/          ← HTTP route handlers เท่านั้น
├── services/     ← Business logic ทั้งหมด
├── repositories/ ← Database queries เท่านั้น
├── models/       ← TypeScript types & Prisma models
└── utils/        ← Pure functions ไม่มี side effects

## 🧪 Testing Requirements
- Unit test ทุก service function (Vitest)
- Integration test ทุก API endpoint (Supertest)
- ห้าม mock database ใน integration tests — ใช้ test DB จริง
- Coverage minimum: 80%

## 🔐 Security Rules (ห้ามข้าม)
- ห้ามเก็บ raw card number ในทุกระบบ (PCI-DSS)
- ทุก API endpoint ต้องมี rate limiting
- Log ทุก financial transaction แบบ append-only
- ห้าม expose internal error ไปยัง user (log ไว้ ตอบ generic message)

## 📋 PR Rules
- ทุก PR ต้องมี tests ที่ผ่าน
- ทุก PR ต้องมี 1 reviewer approve
- ใช้ Conventional Commits: feat/fix/refactor/test/docs
```

---

## 📋 File 2: TASKS.md — "เรากำลังทำอะไร"

TASKS.md สำหรับทีมต้องชัดเจนกว่าของ individual — ต้องรู้ว่าใครทำอะไร:

```markdown
# TASKS.md — Sprint 23 (13–26 พ.ค. 2568)

## 🎯 Sprint Goal
ส่งมอบ Payment Flow MVP: ผู้ใช้ checkout ได้ด้วย Credit Card และ PromptPay

## 👥 Owner Map
| Task | Owner | Status |
|------|-------|--------|
| Payment API | ก้อง | 🔄 In Progress |
| Checkout UI | พลอย | 🔄 In Progress |
| Order DB Schema | บิ๊ก | ✅ Done |
| Email Notification | นิว | 📋 Ready |
| Payment Testing | เอก | ⏳ Waiting (depends on ก้อง) |
| DevOps/Deploy | อาร์ต | 📋 Ready |

## 🔖 Shared Context (Claude อ่านก่อนทำงานทุกครั้ง)
- Order schema: ดูใน prisma/schema.prisma (บิ๊กทำเสร็จแล้ว)
- API base URL: http://localhost:3001/api
- Test DB: postgresql://localhost:5432/techshop_test

## ✅ Done (Sprint 23)
- [x] Database schema: users, orders, payments, transactions
- [x] Auth middleware (JWT + refresh token)
- [x] Basic product catalog API

## 🔄 In Progress
- [/] POST /api/payments — ก้อง (70% — ยังขาด Webhook handler)
  - ⚠️ BLOCKER: ยังไม่ได้ Stripe webhook secret จาก DevOps
- [/] CheckoutPage component — พลอย (50% — form validation เสร็จแล้ว)
  - ⚠️ รอ Payment API จาก ก้อง เพื่อ integrate

## 📋 Ready (รอทำ)
- [ ] Email confirmation service — นิว
  - Dependency: Payment API เสร็จก่อน
- [ ] Staging deployment — อาร์ต
  - Dependency: ทุก API ผ่าน integration tests

## 🚧 Blockers (Human Required)
1. Stripe webhook secret — รอ DevOps กำหนดค่า (ก้อง)
2. Email SMTP credentials — รอ IT Infra (นิว)

## 📊 Definition of Done
- [ ] Unit tests ผ่าน (coverage > 80%)
- [ ] Integration tests ผ่าน (all endpoints)
- [ ] Code review approved
- [ ] Staging deploy สำเร็จ
- [ ] PM sign-off
```

---

## 🎨 File 3: DESIGN.md — "หน้าตาเป็นยังไง"

ไฟล์ใหม่ที่ช่วยให้ทุก Claude session สร้าง UI ที่สอดคล้องกัน:

```markdown
# DESIGN.md — TechShop Design System

## 🎨 Color Palette
Primary:    #1976D2  (Blue 700)
Secondary:  #388E3C  (Green 700)
Danger:     #D32F2F  (Red 700)
Warning:    #F57C00  (Orange 700)
Background: #F5F5F5
Surface:    #FFFFFF
Text:       #212121

## 📐 Typography
Font family: 'Prompt', 'Sarabun', sans-serif  ← ภาษาไทย-friendly
H1: 2.25rem / 700 weight
H2: 1.875rem / 600 weight
H3: 1.5rem / 600 weight
Body: 1rem / 400 weight / line-height 1.6
Small: 0.875rem

## 📦 Component Standards

### Button
```tsx
// ✅ ถูก — ใช้ variant system
<Button variant="primary" size="md" onClick={handlePay}>
  ชำระเงิน
</Button>

// ❌ ผิด — ห้าม inline style
<button style={{ backgroundColor: 'blue' }}>ชำระเงิน</button>
```

Variants: primary | secondary | danger | ghost | link
Sizes: sm | md | lg
States: default | loading | disabled | success

### Form Fields
```tsx
<FormField
  label="หมายเลขบัตร"
  error={errors.cardNumber}
  required
>
  <Input
    type="text"
    placeholder="0000 0000 0000 0000"
    maxLength={19}
  />
</FormField>
```

### Card (Container)
```tsx
<Card elevation="sm">  // sm | md | lg
  <Card.Header>ชำระเงิน</Card.Header>
  <Card.Body>...</Card.Body>
  <Card.Footer>...</Card.Footer>
</Card>
```

### Amount Display (สำคัญมาก!)
```tsx
// ✅ ถูก — ใช้ AmountDisplay component เสมอ (handle สตางค์ → บาท)
<AmountDisplay amount={15000} />  // แสดง "150.00 บาท"

// ❌ ผิด — ห้าม format เอง (error-prone)
<span>{amount / 100} บาท</span>
```

## 📱 Responsive Breakpoints
Mobile:  < 640px   (default)
Tablet:  ≥ 640px   (sm:)
Desktop: ≥ 1024px  (lg:)

## ♿ Accessibility Requirements
- ทุก button ต้องมี aria-label หรือ meaningful text
- ทุก input ต้องมี associated label
- Color contrast ratio: minimum 4.5:1
- Focus indicator ต้องเห็นได้ชัด

## 🚫 Design Anti-Patterns (ห้ามทำ)
- ห้าม hardcode colors นอกจาก Design Tokens
- ห้าม inline styles
- ห้ามสร้าง component ใหม่ถ้ามีใน library แล้ว
- ห้ามใช้ px ขนาดใหญ่ให้ใช้ rem แทน
```

---

## 🔄 Protocol: เริ่ม Session แบบ Team-Aware

เมื่อเริ่ม Claude session ในโปรเจกต์ทีม ให้ทำตามขั้นตอนนี้:

```bash
claude
```

```
"อ่านไฟล์เหล่านี้ก่อนเริ่มงาน:
1. CLAUDE.md — architecture rules และ data contracts
2. TASKS.md — sprint board ปัจจุบัน
3. DESIGN.md — design system

จากนั้นบอกฉันว่า:
- Task ที่ฉัน (เจ้าของ task) ต้องทำคืออะไร
- มี dependency หรือ blocker อะไรไหม
- มี data contract อะไรที่ต้องระวังเป็นพิเศษ

ฉันคือ [ชื่อ] กำลังทำ [task name]"
```

---

## 🔧 Git Workflow สำหรับ Context Files

Context files ต้องมีกระบวนการอัปเดตที่ชัดเจน:

```bash
# .gitignore — ห้าม ignore context files!
# ✅ Commit เหล่านี้
CLAUDE.md   ← source of truth ของทีม
TASKS.md    ← sprint board ที่ทุกคนอัปเดต
DESIGN.md   ← design system ที่ทุกคนอ่าน

# กฎการอัปเดต:
# - CLAUDE.md → ต้องประชุมทีมก่อน PR merge
# - TASKS.md  → อัปเดตได้ทุกคนทุกวัน (เปลี่ยน status)
# - DESIGN.md → ต้องผ่าน Design review ก่อน merge
```

```markdown
# Commit convention สำหรับ context files
git commit -m "context: อัปเดต TASKS.md — ก้อง Payment API 70%"
git commit -m "context: เพิ่ม Button component spec ใน DESIGN.md"
git commit -m "context: แก้ Error format standard ใน CLAUDE.md"
```

---

## 🤖 Claude Reads Trinity — ตัวอย่างจริง

**พลอย** เปิด session ใหม่เพื่อทำ CheckoutPage:

```
"อ่าน CLAUDE.md, TASKS.md, DESIGN.md ก่อน
ฉันคือพลอย กำลังทำ CheckoutPage component
บอกฉันว่า:
1. Data format ที่ต้องใช้ติดต่อกับ Payment API คืออะไร
2. Component อะไรที่ใช้ได้แล้ว ไม่ต้องสร้างใหม่
3. Task นี้มี dependency อะไรบ้าง"
```

Claude ตอบ:

```
จากการอ่านทั้ง 3 ไฟล์ สรุปสำหรับ CheckoutPage:

📊 Data Format (จาก CLAUDE.md):
- ส่ง { userId: string, orderId: string, amount: number } ← ไม่ใช่ customerId!
- amount หน่วยเป็นสตางค์ เช่น 15000 = 150 บาท
- Error response: { error: { code, message, userMessage } }

🧩 Components ที่มีแล้ว (จาก DESIGN.md):
- <Button variant="primary"> — ใช้สำหรับปุ่ม "ชำระเงิน"
- <FormField label error required> — สำหรับ card number, expiry, CVV
- <AmountDisplay amount={15000}> — ห้าม format เอง!
- <Card> — wrapper สำหรับ checkout form

⚠️ Dependencies (จาก TASKS.md):
- รอ Payment API จากก้อง (70% เสร็จ, มี blocker: Stripe webhook)
- ในระหว่างรอ: สร้าง mock API เพื่อ develop parallel ได้

🔧 สิ่งที่ฉันแนะนำให้ทำตอนนี้:
1. สร้าง CheckoutPage.tsx ด้วย static form ก่อน
2. เพิ่ม mock payment handler ชั่วคราว
3. เมื่อ ก้อง เสร็จ → ลบ mock แล้วเชื่อมจริง
```

---

## 💻 Hands-On: Setup Context Trinity สำหรับโปรเจกต์ทีม

```bash
# 1. สร้าง 3 files พร้อมกัน
touch CLAUDE.md TASKS.md DESIGN.md

# 2. ให้ Claude generate จาก codebase จริง
claude
```

```
"อ่านโค้ดทั้งหมดใน src/ และ package.json
 สร้าง Context Trinity สำหรับโปรเจกต์นี้:

 1. CLAUDE.md:
    - Project description จากโค้ดจริง
    - Tech stack ที่พบ
    - Data contracts ที่ใช้ซ้ำ (interfaces, types)
    - Folder structure explanation
    - Coding conventions ที่เห็นในโค้ด

 2. TASKS.md (template):
    - Sprint Goal (ว่างไว้ให้ทีมกรอก)
    - Owner Map template
    - Current status (ว่างไว้)

 3. DESIGN.md (ถ้ามี frontend):
    - Component list ที่พบใน components/
    - Color/Typography ที่ใช้ใน styles/
    - Pattern ที่เห็นบ่อย

 ทำให้สมบูรณ์ที่สุดเท่าที่จะทำได้จากโค้ดที่มีอยู่"
```

---

## 🎯 สรุปบทที่ 18

| ไฟล์ | หน้าที่ | อัปเดตโดย | ความถี่ |
|------|---------|-----------|--------|
| CLAUDE.md | Architecture Rules + Data Contracts | ทุกคน (ต้องประชุมก่อน) | รายสัปดาห์ |
| TASKS.md | Sprint Board + Who Does What | ทุกคน | ทุกวัน |
| DESIGN.md | Design System + Component Spec | Designer + Frontend Dev | รายสัปดาห์ |

**กฎทอง:** ทุก Claude session ต้องอ่าน Trinity ก่อนเริ่มงาน — ไม่มีข้อยกเว้น

---

## 📋 Action Items ก่อนไปบทที่ 19

- [ ] สร้าง CLAUDE.md สำหรับโปรเจกต์ทีม รวม Data Contracts
- [ ] สร้าง TASKS.md พร้อม Owner Map สำหรับ Sprint ปัจจุบัน
- [ ] สร้าง DESIGN.md รวม Component Library ที่มีอยู่
- [ ] Commit ทั้ง 3 ไฟล์เข้า Git
- [ ] สอนทีมทำ "Trinity Protocol" ก่อนเปิด Claude ทุกครั้ง

---

*ใน **บทที่ 19** เราจะเรียนรู้ Advanced CLAUDE.md & Dynamic Rules — เทคนิค Zero Trust Execution และการสร้าง rules ที่ปรับตัวได้ตาม context ของงาน เพื่อ AI ที่ทำงานได้ปลอดภัยและถูกต้องแม้ในสถานการณ์ที่ซับซ้อนที่สุดครับ*
