# บทที่ 6: Context Management — ทำไม Claude ถึง "หลง" และวิธีแก้

---

## 🪝 เมื่อ AI เริ่ม "เพี้ยน"

นายพล Dev ที่ทำงานบริษัท SaaS เล่าให้ฟังว่า:

> "ตอนแรก Claude ทำงานได้เยี่ยมมาก Refactor โค้ดได้ถูกต้องทุกอย่าง แต่พอทำไปได้ชั่วโมงครึ่ง มันเริ่มแปลก — เขียน TypeScript แต่ลืมว่าเราใช้ strict mode, สร้าง function ซ้ำที่มีอยู่แล้ว, แล้วก็เริ่มตอบ 'I cannot help with that' โดยไม่มีเหตุผล"

สิ่งที่เกิดขึ้นกับนายพลคือ **Context Window เต็ม**

นี่ไม่ใช่ Bug ของ Claude และไม่ใช่ความผิดของนายพล — มันคือข้อจำกัดพื้นฐานของ Large Language Models ที่ Real Engineer ต้องเข้าใจและจัดการให้ได้

---

## 🧠 Context Window คืออะไร: อธิบายแบบเข้าใจง่าย

ลองนึกภาพว่า Claude มี **กระดานทดเลข** ขนาดจำกัด

ทุกอย่างที่คุณพิมพ์, ทุกอย่างที่ Claude ตอบ, ทุกไฟล์ที่อ่าน, ทุก tool output — ถูกเขียนลงบนกระดานนี้ทั้งหมด

```
┌─────────────────────────────────────────────────┐
│            Context Window (200,000 tokens)      │
│                                                 │
│  CLAUDE.md content        [████░░░░░░] 10%      │
│  Conversation history     [████████░░] 45%      │
│  File contents read       [█████░░░░░] 25%      │
│  Tool outputs (git, test) [███░░░░░░░] 15%      │
│  Available space          [█░░░░░░░░░] 5% ←⚠️  │
└─────────────────────────────────────────────────┘
```

เมื่อกระดานเต็ม สิ่งที่เขียนไว้ตอนต้น (เช่น Rules ใน CLAUDE.md) จะถูก "เลือน" ออกไปเพื่อให้มีที่สำหรับข้อมูลใหม่

**ผลที่ตามมา:** Claude ลืมกฎที่คุณตั้งไว้ตั้งแต่ต้น

### ขนาด Context Window ของ Claude แต่ละรุ่น

| Model | Context Window | ใช้ได้นานแค่ไหน (โดยประมาณ) |
|-------|---------------|---------------------------|
| claude-haiku-4-5 | 200,000 tokens | ~150 หน้า A4 |
| claude-sonnet-4-5 | 200,000 tokens | ~150 หน้า A4 |
| claude-opus-4-5 | 200,000 tokens | ~150 หน้า A4 |

> **1 token ≈ 0.75 คำภาษาอังกฤษ หรือ ~0.5 คำภาษาไทย**
> โค้ด 1 ไฟล์ขนาด 200 บรรทัด ≈ ประมาณ 1,500-3,000 tokens

---

## ⚠️ สัญญาณว่า Context Window กำลังจะเต็ม

จำสัญญาณเหล่านี้ไว้ให้ขึ้นใจ:

### สัญญาณระดับเหลือง 🟡 (ยังแก้ได้)
- Claude เริ่มลืม rule บางข้อจาก CLAUDE.md
- คำตอบเริ่มกว้างขึ้น ไม่ specific กับโปรเจกต์คุณ
- Claude ถามคำถามที่ตอบไปแล้วใน session

### สัญญาณระดับส้ม 🟠 (ต้องจัดการเดี๋ยวนี้)
- Claude สร้าง function ซ้ำที่มีอยู่แล้ว
- โค้ดที่ได้ไม่ตรงกับ Tech Stack ของโปรเจกต์
- Response ช้าลงผิดปกติ

### สัญญาณระดับแดง 🔴 (Context เต็มแล้ว)
- Claude ปฏิเสธทำงานโดยไม่มีเหตุผลชัดเจน
- Context ถูก truncate อัตโนมัติ → Claude สรุปและเริ่มใหม่
- Error: "context length exceeded"

---

## 🛠️ เครื่องมือจัดการ Context

### เครื่องมือที่ 1: `/compact`

คำสั่งที่ทรงพลังที่สุดสำหรับจัดการ Context

```bash
claude
> /compact
```

**สิ่งที่เกิดขึ้น:** Claude จะ:
1. สรุป conversation ทั้งหมดเป็นรูปแบบกระชับ
2. เก็บเฉพาะ key decisions, context สำคัญ, สถานะปัจจุบัน
3. ทิ้ง verbose back-and-forth ที่ไม่จำเป็น
4. ทำงานต่อด้วย context ที่เล็กกว่า แต่มีข้อมูลสำคัญครบ

**เมื่อใช้:** เมื่อเห็นสัญญาณระดับเหลืองหรือส้ม ก่อนที่จะถึงระดับแดง

```bash
> /compact
# Claude จะตอบประมาณว่า:
# "ฉันได้ compress context แล้ว สรุปสิ่งที่ทำไปแล้ว:
#  ✅ Completed: user.service.ts, auth.service.ts
#  🔄 In Progress: payment.service.ts (50%)
#  📋 Remaining: notification.service.ts, tests
#  Current context: 45,000 tokens (จาก 180,000)"
```

### เครื่องมือที่ 2: `/clear`

รีเซ็ต context ทั้งหมด เริ่มใหม่จากศูนย์

```bash
> /clear
```

**เมื่อใช้:**
- เปลี่ยนไปทำ Task ต่างประเภทที่ไม่เกี่ยวกัน
- เมื่อ session ยาวมากและงานปัจจุบันเสร็จแล้ว
- เมื่อ Claude เพี้ยนไปมากและ `/compact` ไม่ช่วย

> ⚠️ **ข้อควรระวัง:** `/clear` ลบทุกอย่าง ถ้า Claude กำลังทำงานค้างอยู่ ให้อัปเดต TASKS.md ก่อน แล้วค่อย `/clear`

### เครื่องมือที่ 3: Context Injection (บอก Claude ว่าตอนนี้อยู่ที่ไหน)

เมื่อเริ่ม session ใหม่หลัง `/clear` ให้ inject context ย่อๆ ก่อน:

```
"อ่าน CLAUDE.md, TASKS.md และ git log --oneline -10 ก่อน
 สรุปให้ฉันว่า: เราทำถึงไหนแล้ว และ Task ถัดไปคืออะไร"
```

Claude จะ "ทำความรู้จักโปรเจกต์" ใหม่ใน 30 วินาที แทนที่จะต้องเล่าทุกอย่างซ้ำ

---

## 📐 กลยุทธ์การจัดการ Context อย่างมืออาชีพ

### กลยุทธ์ที่ 1: The Breadcrumb Pattern

เขียน "หมายเหตุ" ไว้ใน TASKS.md เพื่อให้ Claude ที่ resume ใหม่รู้ว่าเกิดอะไรขึ้น:

```markdown
# TASKS.md

## 🔖 Breadcrumb (อัปเดตล่าสุด: 14:30 น.)
- ทำถึง: payment.service.ts สร้างเสร็จแล้ว แต่ยังไม่ได้ทดสอบ webhook
- ตัดสินใจ: ใช้ idempotency key แทน status check
- Context ที่สำคัญ: Stripe ใช้ event-based model ไม่ใช่ polling
- Task ถัดไป: เขียน test สำหรับ webhook handler

## Tasks
...
```

เมื่อ `/clear` แล้วเริ่มใหม่:
```
"อ่าน TASKS.md โดยเฉพาะ section Breadcrumb แล้วบอกว่าต้องทำอะไรต่อ"
```

### กลยุทธ์ที่ 2: Chunking (แบ่ง Task ให้พอดี Context)

แทนที่จะสั่งงานใหญ่ครั้งเดียว ให้แบ่งเป็น "Context Chunks":

```markdown
# แบบผิด (Context หมดก่อนจบ)
"Refactor ทุกไฟล์ใน src/ ทั้งหมด 45 ไฟล์"

# แบบถูก (Chunk ทีละส่วน)
"Refactor ไฟล์ใน src/services/ ก่อน (8 ไฟล์)
 เมื่อเสร็จให้ compact context แล้วรายงานว่าพร้อมสำหรับ batch ถัดไป"
```

**ตัวอย่างการวาง Chunk ใน TASKS.md:**
```markdown
## Refactor Campaign (แบ่ง Batch)

### Batch 1 (เสร็จแล้ว ✅)
- [x] src/services/user.service.ts
- [x] src/services/auth.service.ts

### Batch 2 (กำลังทำ 🔄)
- [ ] src/services/payment.service.ts
- [ ] src/services/order.service.ts
→ เมื่อเสร็จ Batch 2: /compact แล้วเริ่ม Batch 3

### Batch 3 (รอ)
- [ ] src/controllers/ (ทุกไฟล์)
```

### กลยุทธ์ที่ 3: Reference ไม่ใช่ Paste

แทนที่จะ paste โค้ดยาวๆ เข้า chat ให้บอกให้ Claude อ่านเองจากไฟล์:

```bash
# แบบที่กิน Context มาก (❌)
> "นี่คือโค้ดทั้งหมด [paste 500 บรรทัด] ช่วย review หน่อย"

# แบบที่ประหยัด Context (✅)
> "อ่าน src/services/payment.service.ts แล้ว review"
```

Claude จะอ่านไฟล์โดยตรง ไม่ต้องผ่าน conversation history

### กลยุทธ์ที่ 4: Context Budget สำหรับ Ralph Loop

ก่อนเริ่ม Ralph Loop ข้ามคืน ให้ประมาณ "Context Budget":

```
ประมาณการ Token Usage:
- CLAUDE.md (300 บรรทัด) = ~3,000 tokens
- TASKS.md (50 tasks) = ~2,000 tokens  
- แต่ละไฟล์ที่อ่าน (200 บรรทัด) = ~2,500 tokens
- แต่ละ conversation turn = ~500 tokens
- Tool output (npm test) = ~1,000 tokens

Budget = 200,000 tokens
เหลือสำหรับ working space = 200,000 - 3,000 - 2,000 = 195,000 tokens
สามารถอ่านไฟล์และทำงานได้ประมาณ: 50-60 ไฟล์ต่อ session
```

ถ้า Task มีมากกว่า 50-60 ไฟล์ → วาง `/compact` checkpoint ไว้ใน TASKS.md:

```markdown
## Task List (45 files total)

### Phase 1 (Files 1-20)
[20 tasks]
→ Checkpoint: /compact เมื่อเสร็จ Phase 1

### Phase 2 (Files 21-40)  
[20 tasks]
→ Checkpoint: /compact เมื่อเสร็จ Phase 2

### Phase 3 (Files 41-45)
[5 tasks]
```

---

## 🔄 Context Management สำหรับ Ralph Loop

### Setup ที่ดีที่สุดสำหรับ Overnight Run

```markdown
# TASKS.md — Overnight Config

## 🤖 Claude Instructions (อ่านก่อนเริ่ม)
- ทุกครั้งที่เสร็จ Batch → รัน /compact
- ถ้า context เกิน 150,000 tokens → /compact ทันที
- อัปเดต Breadcrumb section ทุก 5 Tasks
- ถ้า error เกิดขึ้น 3 ครั้งในที่เดียว → หยุด เขียน note ใน Blockers

## 📊 Context Checkpoints
ทำ /compact หลังจาก:
- [ ] เสร็จ services/ (Batch 1)
- [ ] เสร็จ controllers/ (Batch 2)
- [ ] เสร็จ tests/ (Batch 3)
```

---

## 📏 การวัด Context Usage แบบเรียลไทม์

```bash
# ดู token count ปัจจุบัน
> "บอกฉันว่าตอนนี้เราใช้ context ไปแล้วเท่าไหร่ ใน % ของ limit"

# Claude ตอบ:
# "ขณะนี้ใช้ประมาณ 87,000 tokens (~43% ของ 200k limit)
#  คาดว่าจะถึง 80% หลังจากอ่านอีก ~25 ไฟล์
#  แนะนำ: ทำ /compact หลังจาก batch นี้"
```

---

## 💻 Hands-On: จัดการ Context Session ยาว

**โจทย์:** ฝึก Context Management กับ codebase ขนาดกลาง

```bash
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
```

```
"อ่าน TASKS.md ก่อน สรุปแผนการทำงาน
 จากนั้นเริ่ม Batch 1 ทีละไฟล์
 เขียน issues ที่พบลงใน review-notes.md
 อัปเดต Breadcrumb ทุก 5 ไฟล์
 /compact เมื่อเสร็จแต่ละ Batch"
```

**สิ่งที่สังเกต:** Context จะถูกจัดการอัตโนมัติตาม Instructions ที่วางไว้

---

## 🎯 สรุปบทที่ 6

| หัวข้อ | สิ่งที่ต้องจำ |
|--------|--------------|
| Context Window | กระดานทดเลขที่เต็มแล้วลืมสิ่งที่เขียนไว้ต้น |
| สัญญาณเตือน | ลืม rule / สร้างซ้ำ / ปฏิเสธงาน |
| `/compact` | Compress history ไม่ลบ — ใช้ก่อน window เต็ม |
| `/clear` | รีเซ็ตทั้งหมด — ใช้เมื่อเปลี่ยน task ใหม่ |
| Breadcrumb | เขียนใน TASKS.md เพื่อให้ resume session ได้เร็ว |
| Chunking | แบ่ง task ใหญ่เป็น batch ที่ fit ใน context |

---

## 📋 Action Items ก่อนไปบทที่ 7

- [ ] ลอง `/compact` ใน session ที่ทำงานนานพอ สังเกตว่า summary มีอะไรบ้าง
- [ ] เพิ่ม Breadcrumb section ใน TASKS.md ของโปรเจกต์ปัจจุบัน
- [ ] เพิ่ม `/compact` checkpoints ใน TASKS.md สำหรับงานที่มีมากกว่า 20 tasks
- [ ] ฝึก Context Injection: `/clear` แล้วเริ่ม session ใหม่โดยใช้แค่ CLAUDE.md + TASKS.md

---

*ใน **บทที่ 7** เราจะเรียนรู้ Debugging with AI — เทคนิคการล่า Bug ที่ซ่อนตัวมานานโดยใช้ Claude เป็น "นักสืบ" ที่อ่านโค้ดได้เร็วกว่าคุณ 10 เท่า และวิธีให้ Claude เขียน Regression Test ที่ป้องกันไม่ให้ Bug กลับมาอีกครับ*
