# บทที่ 7: Debugging with AI — ล่า Bug ด้วย Detective ที่ไม่เคยเหนื่อย

---

## 🪝 Bug ที่ซ่อนตัวอยู่ 8 เดือน

มีนาคม 2025 — ระบบ E-Commerce ของบริษัทแห่งหนึ่งมี Bug ลึกลับ: ลูกค้าบางคนได้รับ order confirmation ซ้ำ 2 ครั้ง บางครั้งก็ 3 ครั้ง โดยที่เงินถูกหักแค่ครั้งเดียว

ทีม Dev 4 คนใช้เวลา **8 เดือน** พยายามหา Bug นี้ ทดสอบทุกสถานการณ์แล้วแต่ reproduce ไม่ได้

นาย ต้น Senior Dev คนใหม่เพิ่งเข้ามา เขาลอง approach ต่างออกไป:

```bash
claude
```

```
"เรามี Bug ที่ลูกค้าได้รับ order confirmation email ซ้ำ 2-3 ครั้ง
 แต่เงินถูกหักแค่ครั้งเดียว เกิดขึ้นไม่สม่ำเสมอ ทำซ้ำยาก
 
 ช่วยอ่านไฟล์เหล่านี้และหาสาเหตุที่เป็นไปได้:
 - src/services/order.service.ts
 - src/services/email.service.ts
 - src/workers/order-processor.ts
 - src/queues/email.queue.ts
 
 เน้นหา: race conditions, duplicate processing, missing idempotency"
```

Claude ใช้เวลา 4 นาที แล้วตอบ:

```
พบสาเหตุที่น่าจะใช่ใน email.queue.ts บรรทัดที่ 47:

ปัญหา: Queue consumer ใช้ at-least-once delivery
แต่ไม่มี idempotency check ก่อนส่ง email

เมื่อ queue consumer ล้มเหลวหลังส่ง email แต่ก่อน acknowledge
Bull MQ จะ retry job → ส่ง email อีกครั้ง

Fix: เพิ่ม Redis lock ด้วย job ID ก่อนส่งทุกครั้ง
ถ้า key มีอยู่แล้ว → skip (already sent)
TTL: 24 ชั่วโมง
```

ต้น verify ได้ใน 20 นาที Bug ที่ซ่อนมา 8 เดือน ถูกค้นพบภายใน **4 นาที**

---

## 🧠 ทำไม AI ถึงเก่งเรื่อง Debugging

มนุษย์ Debugging ด้วย:
- ประสบการณ์ส่วนตัว (จำ Bug แบบเดิมที่เคยเจอ)
- Intuition (รู้สึกว่าน่าจะอยู่ตรงนี้)
- ความอดทน (อ่านโค้ดได้แค่ 2-3 ชั่วโมงก่อนเหนื่อย)

AI Debugging ด้วย:
- Pattern recognition จากโค้ดหลายล้าน repository
- ไม่มี assumption — อ่านทุกบรรทัดจริงๆ ไม่ข้าม
- ไม่เหนื่อย อ่านได้ทุกชั่วโมง ทุกวัน
- เชื่อมโยง Cross-file dependencies ที่มนุษย์มักพลาด

**สิ่งสำคัญ:** Claude ไม่ได้ "ฉลาดกว่า" คุณ แต่มัน **อ่านเร็วกว่าและอดทนกว่า** คุณมาก

---

## 🔍 The Debug Framework: 4 ขั้นตอน

### ขั้นตอนที่ 1: Describe อย่างละเอียด

Bug report ที่ดีคือ Bug report ที่ตอบคำถาม 5 ข้อ:

```markdown
## Bug Template สำหรับ Claude

**พฤติกรรมที่คาดหวัง:** [อะไรที่ควรเกิดขึ้น]
**พฤติกรรมที่เกิดจริง:** [อะไรที่เกิดขึ้นจริง]
**วิธี Reproduce:** [ขั้นตอน step-by-step ถ้ามี]
**ความถี่:** [ทุกครั้ง / บางครั้ง (กี่%) / เงื่อนไขพิเศษ]
**สภาพแวดล้อม:** [Node version, OS, ข้อมูล test, environment]
```

เปรียบเทียบ:

```bash
# ❌ Bug report ที่แย่ (Claude จะเดา)
"Payment ไม่ทำงาน ช่วยหา Bug ด้วย"

# ✅ Bug report ที่ดี (Claude จะหาได้แม่น)
"Payment ล้มเหลวเฉพาะเมื่อ:
 - ผู้ใช้มี items > 10 รายการใน cart
 - Payment method เป็น credit card (ไม่ใช่ promptpay)
 - Error: 'Transaction timeout after 30s' ใน logs/error.log
 - เกิดขึ้น ~30% ของเวลา ไม่ได้เกิดทุกครั้ง
 - เริ่มเกิดหลัง deploy เมื่อวันที่ 10 พ.ค."
```

### ขั้นตอนที่ 2: Hypothesize (ให้ Claude ตั้งสมมติฐาน)

```
"อ่านไฟล์เหล่านี้: [รายการไฟล์]

ตั้งสมมติฐาน 3-5 อันดับแรกว่า Bug อาจอยู่ที่ไหน
สำหรับแต่ละสมมติฐาน:
1. ระบุตำแหน่งในโค้ด (ไฟล์ + บรรทัด)
2. อธิบายว่าทำไมถึงสงสัย
3. บอกว่าจะ verify ได้อย่างไร
เรียงลำดับจากที่น่าจะใช่ที่สุดไปน้อยที่สุด"
```

### ขั้นตอนที่ 3: Verify (ทดสอบแต่ละสมมติฐาน)

```
"สมมติฐานที่ 1 น่าสนใจ ช่วยเขียน:
1. Test case ที่จะ reproduce ปัญหานี้ได้
2. Logging statement ที่จะช่วย confirm สมมติฐาน
3. คำสั่ง debug ที่จะรันเพื่อดูข้อมูลเพิ่มเติม"
```

### ขั้นตอนที่ 4: Fix & Prevent

```
"ยืนยันแล้วว่า Bug อยู่ที่ [ที่นี่]
ช่วย:
1. เขียน fix ที่ถูกต้อง พร้อม explain ว่าทำไม
2. เขียน unit test ที่ reproduce Bug นี้ได้ (regression test)
3. ตรวจว่ามี similar pattern ที่อื่นในโค้ดไหม
4. เสนอ preventive measures สำหรับ future"
```

---

## 🛠️ เทคนิค Debugging เฉพาะทาง

### เทคนิค 1: The Error Message Deep Dive

เมื่อได้รับ Error Message ที่งงๆ:

```bash
claude

> "ช่วยอธิบาย error นี้และหาสาเหตุ:

Error: Cannot read properties of undefined (reading 'id')
    at OrderService.createOrder (src/services/order.service.ts:47:28)
    at async OrderController.create (src/controllers/order.ts:23:18)
    at async fastify.route (/node_modules/fastify/lib/route.js:285)

ดู src/services/order.service.ts บรรทัดที่ 40-55
และ src/controllers/order.ts บรรทัดที่ 18-30"
```

Claude จะ:
- อธิบายว่า error เกิดที่ไหนและทำไม
- ระบุว่า `undefined` มาจากไหน
- เสนอ fix พร้อม defensive code

---

### เทคนิค 2: The Log Analysis

เมื่อมี log files ที่มีข้อมูลเยอะมาก:

```bash
> "อ่าน logs/error.log 100 บรรทัดล่าสุด
  หา patterns ของ errors:
  - errors ไหนที่เกิดซ้ำบ่อยที่สุด?
  - มี correlation ระหว่าง errors ไหม?
  - ช่วงเวลาไหนที่ errors เพิ่มขึ้นผิดปกติ?
  สรุปเป็น root causes ที่น่าจะแก้ได้"
```

---

### เทคนิค 3: The Git Blame Approach

เมื่อ Bug เพิ่งเกิดขึ้นหลัง deploy ล่าสุด:

```bash
> "รัน git log --since='3 days ago' --oneline
  แล้วดูว่า commit ไหนที่น่าจะเกี่ยวกับ bug นี้:
  [อธิบาย Bug]
  
  สำหรับ commit ที่น่าสงสัย รัน git show [hash]
  และตรวจว่าการเปลี่ยนแปลงนั้นอาจทำให้เกิด bug ได้อย่างไร"
```

---

### เทคนิค 4: The Rubber Duck on Steroids

เมื่อคุณ "รู้สึก" ว่าปัญหาอยู่ที่ไหนสักแห่ง แต่อธิบายไม่ได้:

```
"ฉันสงสัยว่า Bug อยู่ที่ authentication middleware
ฉันจะอธิบาย flow ให้ฟัง แล้วช่วยหาว่าฉันเข้าใจผิดตรงไหน:

1. Request เข้ามาที่ POST /api/orders
2. authMiddleware ตรวจ JWT token
3. ถ้า valid → set req.user = decoded token
4. OrderController รับ req.user.id ไปสร้าง order

ปัญหาที่เจอ: บางครั้ง req.user เป็น undefined ทั้งที่ token ถูกต้อง

อ่าน src/middlewares/auth.ts และบอกว่าฉันเข้าใจถูกหรือเปล่า
และ flow ที่ฉันอธิบายมีส่วนไหนที่อาจผิดพลาด?"
```

---

### เทคนิค 5: The Pattern Scan

เมื่อแก้ Bug แล้วและอยากป้องกันแบบเดียวกัน:

```
"เราเพิ่งพบ Bug ประเภทนี้: [อธิบาย bug pattern]
ช่วยอ่านทุกไฟล์ใน src/ และหาว่ามี code pattern เดียวกัน
ที่อาจเป็น Bug เหมือนกันอีกไหม
List ออกมาพร้อมบอกว่าแต่ละที่มีความเสี่ยงสูงหรือต่ำ"
```

---

## 🧪 Regression Tests: ป้องกันไม่ให้ Bug กลับมา

หลังแก้ Bug ทุกครั้ง ให้ Claude เขียน Regression Test ทันที:

```
"Bug นี้ถูกแก้แล้ว ช่วยเขียน regression test ที่:
1. Reproduce พฤติกรรมของ Bug เก่า (test ควร fail ถ้า revert fix)
2. Verify พฤติกรรมที่ถูกต้องหลัง fix
3. ครอบคลุม edge cases ที่เกี่ยวข้อง
4. ใส่ comment ว่า test นี้ป้องกัน Bug อะไร

ตั้งชื่อ test ว่า 'should not [bug behavior]'
เช่น: 'should not send duplicate confirmation emails'"
```

ตัวอย่างผลลัพธ์:

```typescript
// regression test สำหรับ duplicate email bug
describe('Order Email Notifications', () => {
  it('should not send duplicate confirmation emails when queue retries', async () => {
    // สร้าง order
    const order = await orderService.create(testOrderData);
    
    // จำลอง queue retry (ส่ง job สองครั้ง)
    const jobId = `order-confirm-${order.id}`;
    await emailQueue.process(jobId);
    await emailQueue.process(jobId); // retry
    
    // ตรวจว่า email ถูกส่งแค่ครั้งเดียว
    expect(mockEmailSender.send).toHaveBeenCalledTimes(1);
  });
});
```

---

## 🚨 Debugging Production Issues (ฉุกเฉิน)

เมื่อระบบมีปัญหาใน Production และต้องแก้เร็วมาก ใช้ template นี้:

```
🚨 PRODUCTION INCIDENT - ต้องการความช่วยเหลือเร่งด่วน

เวลาที่เริ่มเกิด: [เวลา]
อาการ: [อาการที่เห็น]
ผู้ได้รับผลกระทบ: [กี่ users / revenue impact]
Error จาก logs:
[paste error message ล่าสุด]

Deploy ล่าสุด: [เมื่อไหร่ มีอะไรเปลี่ยน]

ต้องการ:
1. สาเหตุที่เป็นไปได้ (3 อันดับแรก)
2. วิธีตรวจ verify แต่ละสาเหตุ (เร็วที่สุด)
3. Emergency fix ที่ปลอดภัย (rollback หรือ hotfix)
"
```

---

## 💻 Hands-On: Debug Bot ส่วนตัว

**สร้าง Custom Command `/debug` ที่ใช้งานได้เดี๋ยวนี้:**

```bash
mkdir -p .claude/commands
cat > .claude/commands/debug.md << 'EOF'
# /debug

รับ bug description จาก $ARGUMENTS แล้วทำ systematic debugging:

## ขั้นตอน
1. อ่านไฟล์ที่เกี่ยวข้องกับ bug description
2. ตั้งสมมติฐาน 3 อันดับแรก พร้อม:
   - ตำแหน่งในโค้ด
   - เหตุผลที่สงสัย
   - วิธี verify
3. เขียน diagnostic code:
   - Logging statements ที่จะช่วยยืนยัน
   - Test case ที่ reproduce ปัญหา
4. เมื่อยืนยัน root cause แล้ว:
   - เขียน fix
   - เขียน regression test
   - ตรวจหา similar patterns ในโค้ดอื่น

## รูปแบบผลลัพธ์
### 🔍 Root Cause Analysis
[3 สมมติฐาน เรียงตามความน่าจะเป็น]

### 🛠️ Recommended Fix
[โค้ดที่แก้ พร้อม explanation]

### 🧪 Regression Test
[test code]

### ⚠️ Similar Patterns Found
[ถ้ามี]
EOF
```

ทดสอบ:
```bash
claude
> /debug "user ไม่สามารถ login ได้หลัง reset password ทั้งที่ใส่รหัสผ่านใหม่ถูก"
```

---

## 📊 Debugging Cheat Sheet

| สถานการณ์ | Command / Approach |
|-----------|-------------------|
| Error message งงๆ | ส่ง stack trace + อ่านไฟล์ที่ระบุใน trace |
| Bug ไม่สม่ำเสมอ | เน้น race condition, timing, concurrency |
| Bug เพิ่งเกิดหลัง deploy | `git log` + `git diff` หา commit ต้นเหตุ |
| Bug ใน production | ใช้ PRODUCTION INCIDENT template |
| ไม่รู้จะเริ่มจากไหน | อ่าน error logs + ตั้งสมมติฐาน |
| แก้แล้วอยากป้องกัน | Pattern scan + Regression test |
| มี logs เยอะมาก | Log analysis หา patterns และ correlations |

---

## 🎯 สรุปบทที่ 7

| หัวข้อ | สิ่งที่ต้องจำ |
|--------|--------------|
| Bug Report ที่ดี | ตอบ 5 คำถาม: คาดหวัง/จริง/reproduce/ความถี่/environment |
| Debug Framework | Describe → Hypothesize → Verify → Fix & Prevent |
| เทคนิคสำคัญ | Error deep dive, Log analysis, Git blame, Rubber duck, Pattern scan |
| Regression Test | ทำทุกครั้งหลังแก้ Bug — ชื่อ "should not [bug behavior]" |
| Production Incident | ใช้ template ที่มีโครงสร้าง ไม่ panic พิมพ์ทุกอย่าง |

---

## 📋 Action Items ก่อนไปบทที่ 8

- [ ] สร้าง `/debug` command ใน `.claude/commands/`
- [ ] ทดสอบกับ Bug จริงที่กำลังเจออยู่ในงาน
- [ ] เขียน Regression Test สำหรับ Bug ล่าสุดที่แก้ไป
- [ ] เพิ่ม Bug Template ใน CLAUDE.md เพื่อให้ทีมใช้รูปแบบเดียวกัน

---

*ใน **บทที่ 8** เราจะเจาะลึกการใช้ Claude กับ Legacy Code — โค้ดที่ไม่มีเอกสาร ไม่มี Test และไม่มีใครกล้าแตะมาหลายปี ซึ่งเป็นความท้าทายที่ Real Engineer เจอบ่อยที่สุดในงานจริงครับ*
