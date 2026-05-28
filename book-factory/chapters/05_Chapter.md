# บทที่ 5: Skills & Custom Commands — สร้างเครื่องมือที่ใช้ซ้ำได้

---

## 🪝 คำสั่งที่พิมพ์ซ้ำทุกวัน

นับดูว่าในหนึ่งสัปดาห์ คุณพิมพ์คำสั่งแบบเดิมซ้ำกี่ครั้ง?

```
"อ่านโค้ดทั้งหมดใน src/ แล้ว review ว่ามี security issue ไหม
 ตรวจสอบ: SQL injection, XSS, hardcoded secrets, missing auth"

"เขียน unit test สำหรับไฟล์นี้ ครอบคลุม happy path และ edge cases
 ใช้ Vitest, mock dependencies ทั้งหมด, coverage 80%+"

"อ่าน git diff แล้วเขียน commit message ตามรูปแบบ Conventional Commits
 format: type(scope): description"
```

ถ้าคุณพิมพ์แบบนี้ทุกวัน — แสดงว่าคุณกำลังเสียเวลาโดยไม่จำเป็น

**Skills และ Custom Commands** คือวิธีเปลี่ยน prompt ยาวๆ ซ้ำๆ เหล่านี้ให้เป็นคำสั่งสั้นๆ ที่พิมพ์แค่ครั้งเดียว:

```
/security-review
/write-tests
/commit-message
```

---

## 🧠 ความต่างระหว่าง Skill และ Custom Command

Claude Code มี 2 วิธีในการสร้างคำสั่งที่ใช้ซ้ำได้:

### 📌 Custom Commands (Slash Commands)
คำสั่งที่ขึ้นต้นด้วย `/` เก็บไว้เป็นไฟล์ Markdown ใน `.claude/commands/`

```
/review-pr     → รัน Code Review ทั้งหมด
/security-scan → ตรวจ Security issues
/write-tests   → สร้าง Test suite
```

**ลักษณะ:** เรียกใช้ได้ทันที พร้อมรับ argument เพิ่มเติม

### 📌 Skills (ใน CLAUDE.md)
คำสั่งที่นิยามไว้ใน CLAUDE.md ภายใต้หัวข้อ `## Skills`

```markdown
## Skills

### /analyze
เมื่อฉันพิมพ์ /analyze [filename]
ให้คุณ: อ่านไฟล์นั้น → หา code smells → เสนอ refactor
```

**ลักษณะ:** มีอยู่ตลอด session เพราะอยู่ใน CLAUDE.md ที่โหลดอัตโนมัติ

---

## 📁 Custom Commands: สร้างและใช้งาน

### โครงสร้างไฟล์

```
your-project/
└── .claude/
    └── commands/
        ├── review-pr.md
        ├── security-scan.md
        ├── write-tests.md
        ├── commit-message.md
        └── explain-code.md
```

### วิธีสร้าง Custom Command

สร้างไฟล์ `.claude/commands/[ชื่อ].md` แล้วเขียน prompt ข้างใน:

**ตัวอย่าง: `/review-pr`**
```markdown
# /review-pr

ทำ Code Review ระดับ Senior Engineer สำหรับ git diff ปัจจุบัน

## ขั้นตอน
1. รัน `git diff HEAD` เพื่อดูการเปลี่ยนแปลงทั้งหมด
2. วิเคราะห์ทุก hunk ตาม checklist ด้านล่าง
3. สรุปผลในรูปแบบที่กำหนด

## Checklist การ Review
- [ ] Logic correctness — โค้ดทำในสิ่งที่ตั้งใจไหม?
- [ ] Edge cases — จัดการ null, empty, boundary values ไหม?
- [ ] Security — SQL injection, XSS, missing auth, exposed secrets?
- [ ] Performance — N+1 query, missing index, unnecessary loops?
- [ ] Error handling — ทุก error path มีการจัดการไหม?
- [ ] Test coverage — มี test ครอบคลุมการเปลี่ยนแปลงไหม?
- [ ] Standards — ตรงกับ CLAUDE.md rules ไหม?

## รูปแบบผลลัพธ์
### 🔴 Critical (ต้องแก้ก่อน merge)
[รายการปัญหา Critical]

### 🟡 Warning (ควรแก้ใน sprint นี้)
[รายการปัญหา Warning]

### 🟢 Suggestion (ทำได้ถ้ามีเวลา)
[รายการ Suggestions]

### ✅ Overall Verdict
[PASS / NEEDS CHANGES + สรุปสั้นๆ]
```

วิธีเรียกใช้:
```bash
claude
> /review-pr
```

Claude จะทำตาม prompt ทั้งหมดทันที โดยไม่ต้องพิมพ์ซ้ำ

---

## 🔧 Custom Commands Library: 10 Commands ที่ใช้งานได้เดี๋ยวนี้

### 1. `/security-scan`
```markdown
# /security-scan

ตรวจ Security vulnerabilities ในโค้ดที่เปลี่ยนแปลงล่าสุด

1. รัน `git diff HEAD` 
2. ตรวจหา:
   - Hardcoded API keys, passwords, tokens (regex: ['"][A-Za-z0-9]{20,}['"])
   - SQL injection: string concatenation ใน query
   - XSS: unescaped user input ใน HTML/template
   - Missing authentication middleware
   - Sensitive data ใน console.log หรือ error messages
   - Insecure direct object reference (IDOR)
3. สำหรับแต่ละ issue: ระบุบรรทัด, อธิบายความเสี่ยง, เสนอ fix

ถ้าพบ Critical issue → หยุดรอ Human ก่อนดำเนินการต่อ
```

### 2. `/write-tests [filename]`
```markdown
# /write-tests

เขียน unit tests สำหรับไฟล์ที่ระบุ: $ARGUMENTS

1. อ่านไฟล์ที่ระบุ
2. ระบุทุก function/method ที่ต้องการ test
3. สร้างไฟล์ test ใน tests/ directory (หรือ __tests__/)
4. สำหรับแต่ละ function เขียน:
   - Happy path: ทำงานถูกต้องกรณีปกติ
   - Edge cases: null, undefined, empty string, boundary values
   - Error cases: เมื่อ input ผิด หรือ dependency ล้มเหลว
5. Mock external dependencies ทั้งหมด (database, APIs)
6. รัน test และแก้จนผ่าน
7. แสดง coverage report

ใช้ testing framework ตาม CLAUDE.md
```

วิธีใช้:
```
> /write-tests src/services/user.service.ts
```

### 3. `/commit-message`
```markdown
# /commit-message

สร้าง git commit message ตามมาตรฐาน Conventional Commits

1. รัน `git diff --staged` เพื่อดูการเปลี่ยนแปลงที่ stage แล้ว
2. วิเคราะห์ว่าเปลี่ยนอะไร
3. สร้าง commit message ในรูปแบบ:
   type(scope): short description (max 72 chars)
   
   [body: อธิบาย WHY ไม่ใช่ WHAT ถ้าจำเป็น]
   
   [footer: BREAKING CHANGE หรือ Fixes #issue ถ้ามี]

Types: feat, fix, docs, style, refactor, test, chore, perf
Scope: ชื่อ module หรือ feature

ตัวอย่าง:
feat(auth): add JWT refresh token rotation
fix(payment): handle Stripe webhook signature mismatch
refactor(user): extract email validation to shared utility

แสดง 3 ตัวเลือกให้เลือก แล้วถามว่าจะ commit เลยหรือแก้ก่อน
```

### 4. `/explain-code [filename or selection]`
```markdown
# /explain-code

อธิบายโค้ดในไฟล์หรือ selection ที่ระบุ: $ARGUMENTS

อธิบายในรูปแบบ:
1. **สรุปสั้น (1-2 ประโยค):** ไฟล์นี้ทำอะไร
2. **Input/Output:** รับอะไร ส่งอะไรออกมา
3. **Flow หลัก:** อธิบาย step-by-step เป็นภาษาไทย
4. **จุดน่าสนใจ:** เทคนิคพิเศษหรือ Pattern ที่ใช้
5. **จุดเสี่ยง:** อะไรที่อาจเกิดปัญหา

ระดับการอธิบาย: สำหรับ Developer ที่ไม่เคยเห็นโค้ดนี้มาก่อน
ห้ามใช้ศัพท์เทคนิคโดยไม่อธิบาย
```

### 5. `/find-bug [description]`
```markdown
# /find-bug

ค้นหา Bug ตามคำอธิบาย: $ARGUMENTS

1. อ่านโค้ดที่เกี่ยวข้องกับ bug description
2. ตั้งสมมติฐาน 3 อันดับแรกว่า bug อาจอยู่ที่ไหน
3. สำหรับแต่ละสมมติฐาน:
   - ระบุไฟล์และบรรทัดที่น่าสงสัย
   - อธิบายว่าทำไมถึงสงสัย
   - เสนอวิธี reproduce ปัญหา
4. เสนอ fix สำหรับสมมติฐานที่น่าจะใช่ที่สุด
5. เขียน regression test เพื่อป้องกันไม่ให้เกิดซ้ำ
```

### 6. `/refactor [filename]`
```markdown
# /refactor

Refactor ไฟล์ที่ระบุ: $ARGUMENTS ให้ดีขึ้นโดยไม่เปลี่ยน behavior

ลำดับการทำงาน:
1. อ่านไฟล์และ test ที่มีอยู่
2. ระบุ code smells: long functions, deep nesting, duplicate code, magic numbers
3. เสนอแผน refactor ก่อน (อย่าลงมือทันที)
4. รอ approval จากฉัน
5. Refactor ทีละขั้น รัน test หลังแต่ละขั้น
6. ถ้า test fail → revert และหยุดรอ

ห้าม: เปลี่ยน behavior, เพิ่ม feature, เปลี่ยน API signature โดยไม่บอก
```

### 7. `/db-query [คำถาม]`
```markdown
# /db-query

แปลงคำถามภาษาไทยเป็น SQL query: $ARGUMENTS

1. เข้าใจ business question จาก argument
2. อ่าน Prisma schema เพื่อเข้าใจ data model
3. เขียน SQL query ที่:
   - ถูกต้องและมีประสิทธิภาพ
   - มี EXPLAIN plan สำหรับ production use
   - ใช้ index ที่มีอยู่
4. แปลงเป็น Prisma query ด้วย (ถ้าใช้ Prisma)
5. เตือนถ้า query อาจ slow หรือต้องการ index ใหม่

ห้ามรัน query โดยตรง — แค่แสดงผลให้ฉันตรวจก่อน
```

### 8. `/update-docs`
```markdown
# /update-docs

อัปเดต documentation ให้ตรงกับโค้ดปัจจุบัน

1. รัน `git diff HEAD` เพื่อดูการเปลี่ยนแปลง
2. ตรวจว่า API เปลี่ยนไหม (endpoints, parameters, responses)
3. อัปเดตไฟล์ต่อไปนี้ถ้าจำเป็น:
   - README.md (getting started section)
   - docs/API.md (endpoint documentation)
   - JSDoc comments ในโค้ดที่เปลี่ยน
4. ไม่ต้องสร้างไฟล์ใหม่ — แค่อัปเดตที่มีอยู่
```

### 9. `/performance-check [filename]`
```markdown
# /performance-check

ตรวจ performance issues ในไฟล์: $ARGUMENTS

ตรวจหา:
- N+1 queries (loop ที่มี database call ข้างใน)
- Missing await (async ที่ไม่ได้รอ)
- Inefficient data structures (array.find ซ้ำๆ แทน Map)
- Large payload ที่ไม่จำเป็น (ดึงข้อมูลมากกว่าที่ใช้)
- Missing memoization/caching สำหรับ expensive computation
- Blocking operations ใน event loop

สำหรับแต่ละ issue: แสดงก่อน/หลัง และประมาณว่าเร็วขึ้นแค่ไหน
```

### 10. `/daily-standup`
```markdown
# /daily-standup

สรุปงานที่ทำเมื่อวานสำหรับ Daily Standup

1. รัน `git log --since="yesterday" --author="$(git config user.name)" --oneline`
2. อ่าน TASKS.md ดูสถานะปัจจุบัน
3. สรุปในรูปแบบ:

**เมื่อวาน:** [สิ่งที่ทำเสร็จ เป็น bullet points ภาษาไทยเข้าใจง่าย]
**วันนี้:** [Task ที่วางแผนจะทำ จาก TASKS.md]
**Blocker:** [อะไรที่ติดอยู่ ถ้ามี]

ใช้ภาษาที่ผู้จัดการที่ไม่ใช่ Dev เข้าใจได้
```

---

## 📝 Skills ใน CLAUDE.md: Commands ระดับโปรเจกต์

สำหรับ commands ที่ต้องการ project context ลึกๆ ให้เพิ่มใน CLAUDE.md แทน:

```markdown
## Skills

### /feature [feature-name]
เมื่อฉันพิมพ์ /feature [ชื่อ feature]
ให้คุณ:
1. สร้าง branch ชื่อ feature/[ชื่อ]
2. สร้างไฟล์ตาม Architecture pattern ในโปรเจกต์นี้:
   - src/routes/[feature].ts
   - src/services/[feature].service.ts  
   - src/repositories/[feature].repo.ts
   - tests/[feature].test.ts
3. เพิ่ม route ใน src/app.ts
4. สร้าง Prisma model ถ้าจำเป็น
5. สรุปให้ฉันว่าสร้างอะไรไปบ้าง

### /hotfix [description]
เมื่อฉันพิมพ์ /hotfix [description]
ให้คุณ:
1. อ่าน error logs ใน logs/error.log (ถ้ามี)
2. ค้นหาสาเหตุของปัญหาตาม description
3. เสนอ fix พร้อมอธิบาย root cause
4. เขียน regression test
5. ไม่ commit อัตโนมัติ — รอให้ฉัน review ก่อน

### /sprint-start [sprint-name]
เมื่อฉันพิมพ์ /sprint-start [ชื่อ sprint]
ให้คุณ:
1. อ่าน backlog จาก BACKLOG.md (ถ้ามี)
2. สร้าง TASKS.md ใหม่สำหรับ sprint นี้
3. จัด priority ตาม business value และ dependency
4. ตั้ง sprint goal ที่วัดได้
```

---

## 🔗 Chaining Commands: รวมหลาย Command

สามารถรวม Commands ต่อกันได้ในคำสั่งเดียว:

```
"รัน /security-scan ก่อน ถ้าผ่านแล้วค่อยรัน /review-pr
 ถ้าทั้งคู่ผ่าน ให้รัน /commit-message"
```

หรือสร้าง compound command:

```markdown
# .claude/commands/pre-merge.md

## /pre-merge
ทำ Pre-merge checklist ทั้งหมด:

1. /security-scan — ตรวจ security
2. รัน `npm test` — ต้องผ่าน 100%
3. รัน `npm run lint` — ต้องไม่มี error
4. /review-pr — ทำ code review
5. /commit-message — เตรียม commit message

ถ้าขั้นตอนใดล้มเหลว → หยุดและรายงาน
ถ้าผ่านทั้งหมด → แสดง "✅ Ready to merge"
```

เรียกใช้:
```
> /pre-merge
```

---

## 💻 Hands-On: สร้าง Command Library ส่วนตัว

**แบบฝึกหัด:** สร้าง 5 Custom Commands สำหรับงานที่คุณทำซ้ำๆ บ่อยที่สุด

**ขั้นตอน:**

```bash
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
```

**เทคนิคการปรับปรุง Command:**

```
ถ้าผลลัพธ์คลุมเครือ → เพิ่ม "รูปแบบผลลัพธ์" ใน prompt
ถ้า AI ทำมากเกินไป → เพิ่ม "หยุดรอ Human ก่อน [action]"  
ถ้า AI ทำน้อยเกินไป → เพิ่ม "อย่าข้ามขั้นตอนนี้" หรือ numbered steps
ถ้าผิด Context → เพิ่ม "อ่าน CLAUDE.md ก่อนเสมอ"
```

---

## 🎯 สรุปบทที่ 5

| หัวข้อ | สิ่งที่ต้องจำ |
|--------|--------------|
| Custom Commands | `.claude/commands/[name].md` → เรียกด้วย `/name` |
| Skills | นิยามใน CLAUDE.md `## Skills` section |
| ใช้ `$ARGUMENTS` | รับ argument เพิ่มเติม: `/write-tests src/user.ts` |
| Chaining | รวม commands ได้: `/security-scan` แล้ว `/review-pr` |
| หลักการ | ถ้าพิมพ์ prompt เดิมมากกว่า 3 ครั้ง → สร้าง command เดี๋ยวนี้ |

---

## 📋 Action Items ก่อนไปบทที่ 6

- [ ] สร้าง `.claude/commands/` directory ในโปรเจกต์ปัจจุบัน
- [ ] สร้างอย่างน้อย 3 Custom Commands จาก prompt ที่ใช้ซ้ำบ่อย
- [ ] ทดสอบและปรับปรุงจน output ตรงตามต้องการ
- [ ] เพิ่ม `/sprint-start` skill ใน CLAUDE.md
- [ ] Commit `.claude/commands/` เข้า Git เพื่อแชร์กับทีม

---

*ใน **บทที่ 6** เราจะเจาะลึก Context Management — ทำไม Claude ถึงเริ่ม "หลง" หลังจากทำงานนาน และวิธีจัดการ Context Window อย่างมีประสิทธิภาพเพื่อให้ Ralph Loop ทำงานได้นานที่สุดโดยไม่เสีย Quality ครับ*
