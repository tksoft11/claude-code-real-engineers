# บทที่ 8: Legacy Code Whisperer — เจ้าแห่งโค้ดโบราณ

---

## 🪝 วันแรกกับ "มรดก" 400,000 บรรทัด

นายอาร์ต นักพัฒนาที่เพิ่งย้ายมาบริษัทใหม่ได้รับ onboarding จากหัวหน้าว่า:

> "ระบบ ERP ของเรารันมา 9 ปีแล้ว เขียนด้วย PHP 5.6 ไม่มี Test เลย ไม่มีใครรู้ว่า function ทั้งหมด 2,847 ตัวทำอะไรบ้าง developer คนเดิมที่เขียนลาออกไป 4 ปีแล้ว ทีมเราก็ไม่กล้าแตะมา 2 ปีเพราะกลัวพัง แต่ลูกค้าต้องการ feature ใหม่ภายใน 3 เดือน"

อาร์ตเปิด codebase ขึ้นมา — ไม่มี README ไม่มี comment ไม่มี tests function ชื่อ `doStuff()`, `process2()`, `handleThing_v3_FINAL_really_final()`

เขาใช้เวลา **3 วัน** ในการอ่านโค้ดโดยยังไม่รู้ว่าระบบทำงานยังไง

วันที่ 4 เขาเปิด Claude Code แล้วพิมพ์คำสั่งเดียว:

```
"อ่านโค้ดทั้งหมดใน /src และ /lib
 สร้างเอกสารที่อธิบาย:
 1. Architecture ภาพรวม: ระบบทำอะไร แบ่งเป็น module ยังไง
 2. Data flow หลัก: ข้อมูลไหลจากที่ไหนไปที่ไหน
 3. Functions ที่สำคัญที่สุด 20 อันดับแรก
 4. จุดที่อันตราย: โค้ดที่ควรระวังเป็นพิเศษ"
```

**45 นาทีต่อมา:** เขาได้เอกสาร 28 หน้าที่เข้าใจระบบดีกว่าทีมทั้งหมด

---

## 🏚️ ทำความเข้าใจ "Legacy Code" คืออะไร

Legacy Code ไม่ใช่แค่ "โค้ดเก่า" — มันคือโค้ดที่มี **ลักษณะ** เหล่านี้:

```
❌ ไม่มี Unit Tests            → ไม่รู้ว่าแก้แล้วอะไรพัง
❌ ไม่มี Documentation        → ไม่รู้ว่าทำอะไร ทำทำไม
❌ Tight coupling ทุกที่       → แก้จุดหนึ่ง พังอีก 5 จุด
❌ Global state               → ผลลัพธ์ขึ้นกับ state ซ่อน
❌ Mixed concerns             → โค้ด business, UI, DB ปนกัน
❌ Cryptic naming             → doProcess(), handleData2()
```

หนังสือ "Working Effectively with Legacy Code" (Michael Feathers) นิยามไว้ชัดว่า:
> **Legacy Code = Code Without Tests**

เพราะ Tests คือสิ่งที่บอกว่า "โค้ดนี้ควรทำอะไร" ถ้าไม่มี — ไม่มีใครรู้จริงๆ

---

## 🗺️ Phase 1: The Archaeology (ขุดค้นก่อนแตะ)

กฎเหล็กของ Legacy Code: **อย่าแตะอะไรจนกว่าจะเข้าใจ**

### Step 1: สร้าง Map

```
"อ่านโค้ดทั้งหมดใน [directory]
 สร้าง Markdown document ชื่อ docs/ARCHITECTURE.md ที่มี:

 ## System Overview
 [ระบบนี้ทำอะไร ในภาษาที่ non-technical คนเข้าใจได้]

 ## Module Map
 [แต่ละ folder/file ทำหน้าที่อะไร]

 ## Data Flow
 [ข้อมูลหลักไหลอย่างไรผ่านระบบ ตั้งแต่ input ถึง output]

 ## Key Functions
 [20 functions ที่สำคัญที่สุด พร้อมอธิบาย input/output]

 ## Danger Zones
 [โค้ดที่ซับซ้อน มี side effects ซ่อน หรือควรระวังเป็นพิเศษ]

 ## External Dependencies
 [ระบบ external อะไรที่โค้ดนี้ depend on: DB, APIs, services]"
```

### Step 2: ทำแผนที่ Dependencies

```
"อ่านทุกไฟล์และสร้าง Dependency Graph ใน docs/DEPENDENCIES.md

สำหรับแต่ละ module/class หลัก:
- มันเรียกใช้ module อะไรบ้าง?
- module อะไรเรียกใช้มัน?
- มี circular dependency ไหม?
- มี God class (class ที่ทำทุกอย่าง) ไหม?

ไฮไลท์ modules ที่ depend กันมากที่สุด เพราะนั่นคือจุดที่แตะยากที่สุด"
```

### Step 3: หา Business Rules ที่ซ่อนอยู่

```
"อ่านโค้ดในส่วน [ระบุส่วนที่ต้องแก้]
 หา business rules ที่ซ่อนอยู่ในโค้ด เช่น:
 - เงื่อนไขพิเศษที่ hardcode ไว้
 - ตัวเลข magic numbers ที่มีความหมาย (เช่น if status == 3)
 - Logic ที่ดูแปลกแต่อาจมีเหตุผลทางธุรกิจ

 สำหรับแต่ละ rule ที่พบ: อธิบายว่ามันทำอะไรและทำไมถึงอาจมีอยู่"
```

**ตัวอย่างผลลัพธ์ที่มีคุณค่ามาก:**
```
พบ Business Rules ที่ซ่อนในโค้ด:

1. บรรทัด 847, order.php:
   if ($order->total > 50000 && $customer->type == 'retail') {
       $discount = 0.05;
   }
   → กฎ: ลูกค้า retail ที่สั่งซื้อเกิน 50,000 บาท ได้ส่วนลด 5%
   (ไม่มีที่ไหนใน documentation พูดถึงกฎนี้)

2. บรรทัด 1,203, payment.php:
   if (date('H') >= 22 || date('H') < 6) {
       $method = 'manual_review';
   }
   → กฎ: Payment หลัง 22:00 น. ต้องผ่าน manual review
   (น่าจะมาจากความต้องการของทีม Finance ที่ลืมกันไปแล้ว)
```

---

## 🧪 Phase 2: Characterization Tests (สร้างตาข่ายนิรภัยก่อน)

**Golden Rule:** อย่าแก้โค้ดจนกว่าจะมี Test ครอบคลุม

แต่จะเขียน Test สำหรับโค้ดที่ไม่เข้าใจได้อย่างไร? ใช้ **Characterization Tests** — tests ที่จับ "พฤติกรรมปัจจุบัน" ไม่ใช่ "พฤติกรรมที่ควรเป็น"

```
"อ่าน function [ชื่อ function] ใน [ไฟล์]
 เขียน Characterization Tests ที่:
 1. ทดสอบทุก code path ที่เป็นไปได้
 2. ไม่ตัดสินว่า output ถูกหรือผิด — แค่บันทึกว่า output คืออะไร
 3. ครอบคลุม edge cases: null, empty, boundary values
 4. ใส่ comment ว่าแต่ละ test กำลังทดสอบ behavior อะไร

 Format: [testing framework ที่ใช้]
 เมื่อ tests เขียนแล้ว รันและบันทึก snapshot ของผลลัพธ์"
```

**ตัวอย่าง Characterization Test:**

```php
// Characterization Test — บันทึกพฤติกรรมปัจจุบัน
// หมายเหตุ: เราไม่รู้ว่า output ถูกหรือผิด แค่บันทึกไว้
class OrderCalculatorCharacterizationTest extends TestCase
{
    /** @test */
    public function it_returns_zero_for_empty_cart()
    {
        $calc = new OrderCalculator();
        // บันทึก: function นี้ return 0 เมื่อ cart ว่าง
        $this->assertEquals(0, $calc->calculate([]));
    }

    /** @test */
    public function it_applies_mysterious_15_percent_on_sundays()
    {
        // บันทึก: พบว่ามีการคูณด้วย 1.15 เฉพาะวันอาทิตย์
        // เหตุผลไม่ทราบ — อาจเป็น business rule ที่ไม่ได้ document
        $this->travelTo(Carbon::parse('2025-03-09')); // วันอาทิตย์
        $calc = new OrderCalculator();
        $this->assertEquals(115.0, $calc->calculate([['price' => 100]]));
    }
}
```

---

## 🔧 Phase 3: Safe Refactoring

หลังจากมี Characterization Tests แล้ว จึงเริ่ม Refactor ได้อย่างปลอดภัย

### กลยุทธ์ที่ 1: Strangler Fig Pattern

ไม่ Rewrite ทั้งหมดในคราวเดียว — สร้าง code ใหม่ที่ "ล้อมรอบ" code เก่า

```
"ฉันต้องการ Refactor [ชื่อ module] แต่ไม่ต้องการ break production
 ใช้ Strangler Fig Pattern:
 1. สร้าง NewOrderCalculator class ที่ implement interface เดิม
 2. ใช้ Feature Flag: ถ้า USE_NEW_CALCULATOR=true → ใช้ตัวใหม่
 3. Old calculator ยังทำงานอยู่เป็น fallback
 4. เขียน integration test ที่ verify ว่าทั้งสองให้ผลเหมือนกัน
 5. เมื่อ confident แล้วค่อย migrate 100%"
```

```typescript
// Feature Flag approach
class OrderCalculatorFactory {
  static create(): IOrderCalculator {
    if (process.env.USE_NEW_CALCULATOR === 'true') {
      return new NewOrderCalculator();  // โค้ดใหม่ที่สะอาด
    }
    return new LegacyOrderCalculator(); // โค้ดเก่าที่ทำงานได้
  }
}
```

### กลยุทธ์ที่ 2: Extract Function (ทีละ function เล็กๆ)

```
"ดู function [ชื่อ] ที่ยาว 200 บรรทัด
 ช่วย identify logical sections ที่สามารถ extract เป็น function ย่อยได้
 
 กฎ:
 - แต่ละ extraction ต้องรัน tests ให้ผ่านก่อน
 - ไม่เปลี่ยน behavior ของ function หลัก
 - ตั้งชื่อ function ใหม่ให้สื่อความหมาย
 - ทำทีละขั้น ไม่รีบ"
```

### กลยุทธ์ที่ 3: Add Types Gradually (สำหรับ JavaScript → TypeScript)

```
"ช่วย migrate ไฟล์นี้จาก JavaScript เป็น TypeScript แบบ incremental:
 1. เปลี่ยน .js เป็น .ts
 2. เพิ่ม type annotation เฉพาะ public API ก่อน
 3. ใช้ 'any' ชั่วคราวสำหรับส่วนที่ซับซ้อน (จด TODO ไว้)
 4. รัน tests ให้ผ่านก่อนไปต่อ
 5. อย่าเปลี่ยน logic ใดๆ ในขั้นนี้ — แค่เพิ่ม types"
```

---

## 🗄️ Legacy Database: จุดที่อันตรายที่สุด

Database ใน legacy systems มักมีปัญหาเหล่านี้:
- Table ชื่อ `tbl_data`, `temp_backup_2019`, `DO_NOT_DELETE`
- Column ชื่อ `flag1`, `misc_field`, `data`
- Relationship ที่ไม่มี Foreign Key constraint
- Data ที่ไม่สอดคล้องกัน (orphaned records)

```
"อ่าน database schema จาก [schema file หรือ describe tables]
 สร้าง docs/DATABASE.md ที่อธิบาย:

 ## Tables
 สำหรับแต่ละ table:
 - ทำหน้าที่อะไร
 - columns สำคัญหมายถึงอะไร (เดาจาก usage patterns ในโค้ด)
 - relationships กับ tables อื่น

 ## Suspicious Patterns
 - columns ที่ชื่อคลุมเครือ
 - tables ที่อาจ obsolete (ไม่มีโค้ดใช้)
 - missing indexes ที่น่าจะต้องการ

 ## Risk Assessment
 - tables ที่เสี่ยงที่สุดถ้าแก้ data schema
 - ลำดับที่ควร migrate ถ้าจะ refactor"
```

---

## 📊 การวาง Modernization Roadmap

หลังจากทำ Archaeology เสร็จแล้ว วาง Roadmap ร่วมกับ Claude:

```
"จากการวิเคราะห์ codebase ทั้งหมดแล้ว
 ช่วยสร้าง Modernization Roadmap ที่:

 1. แบ่งเป็น Phase 3-6 เดือน
 2. แต่ละ Phase มี deliverable ที่วัดได้
 3. เรียงลำดับจาก Low Risk ไป High Risk
 4. ระบุ dependencies ระหว่าง Phase
 5. ระบุ risks ของแต่ละ Phase

 ข้อจำกัด:
 - ระบบต้อง available ตลอดเวลา (no big bang rewrite)
 - ทีม 3 คน ทำงานควบคู่กับ feature development
 - Production deploy ทุก 2 สัปดาห์"
```

**ตัวอย่างผลลัพธ์:**
```markdown
## Modernization Roadmap — Legacy ERP

### Phase 1: Safety Net (เดือน 1-2) ← เริ่มที่นี่
**Deliverable:** Test coverage 40% สำหรับ core modules
- เพิ่ม Characterization Tests
- ตั้ง CI pipeline (อย่างน้อยรัน tests)
- สร้าง documentation พื้นฐาน
**Risk:** ต่ำ — ไม่แก้โค้ด แค่เพิ่ม tests

### Phase 2: Isolate Core (เดือน 2-4)
**Deliverable:** Order และ Payment modules แยกออกจากกัน
- Strangler Fig สำหรับ OrderCalculator
- เพิ่ม Feature Flags
- Database schema documentation
**Risk:** กลาง — test coverage พร้อมแล้ว

### Phase 3: Modernize (เดือน 4-6)
**Deliverable:** 3 modules หลัก migrate เป็น modern stack
- Extract 3 services หลักออกจาก monolith
- Database migration พร้อม rollback
**Risk:** สูง — ทำหลัง Phase 2 เสร็จเท่านั้น
```

---

## 💻 Hands-On: Legacy Code Triage ใน 1 ชั่วโมง

**โจทย์:** ทำ Archaeology ของ codebase ที่คุณกำลังทำงานอยู่

```bash
# 1. ดู structure ก่อน
find src -name "*.ts" -o -name "*.js" -o -name "*.php" | head -50

# 2. นับ functions ทั้งหมด (PHP)
grep -r "function " src/ | wc -l

# 3. หาไฟล์ที่ใหญ่ที่สุด (อาจเป็น God files)
find src -name "*.php" | xargs wc -l | sort -rn | head -10

# 4. หา TODO/FIXME/HACK comments
grep -rn "TODO\|FIXME\|HACK\|XXX" src/ | head -30

# 5. เปิด Claude แล้วเริ่ม Archaeology
claude
```

พิมพ์:
```
"ดูผลจากคำสั่งเหล่านี้แล้วเริ่ม Archaeology:
 [paste output จากคำสั่งด้านบน]

 จากนั้นอ่านไฟล์ที่ใหญ่ที่สุด 5 อันดับแรก
 สร้าง docs/LEGACY_AUDIT.md ที่บอกว่า:
 1. ระบบนี้ทำอะไรจริงๆ
 2. จุดอันตราย 5 อันดับแรก
 3. จะเริ่ม Modernize จากที่ไหนก่อนถึงจะปลอดภัยที่สุด"
```

---

## 🎯 สรุปบทที่ 8

| หัวข้อ | สิ่งที่ต้องจำ |
|--------|--------------|
| Legacy Code นิยาม | Code Without Tests — ไม่ใช่แค่โค้ดเก่า |
| Phase 1: Archaeology | เข้าใจก่อนแตะ — Map, Dependencies, Business Rules |
| Phase 2: Safety Net | Characterization Tests บันทึกพฤติกรรมปัจจุบัน |
| Phase 3: Refactoring | Strangler Fig, Extract Function, Gradual Types |
| Legacy DB | Reverse engineer schema ก่อน แล้ว risk assessment |
| Roadmap | Low Risk → High Risk, ไม่มี Big Bang Rewrite |

---

## 📋 Action Items ก่อนไปบทที่ 9

- [ ] ทำ Archaeology กับ legacy code ที่คุณมีอยู่ในงาน
- [ ] สร้าง docs/ARCHITECTURE.md โดยให้ Claude generate จากโค้ดจริง
- [ ] หา "God files" (ไฟล์ใหญ่ที่สุด) แล้วให้ Claude วิเคราะห์
- [ ] เขียน Characterization Tests สำหรับ function ที่กลัวจะแตะมากที่สุด 1 ตัว

---

*ใน **บทที่ 9** เราจะเรียนรู้ TDD กับ AI — ไม่ใช่แค่ "เขียน test ก่อนโค้ด" แบบทั่วไป แต่คือเทคนิค AI-Assisted TDD ที่ทำให้วงจร Red-Green-Refactor เร็วขึ้น 5 เท่า และวิธีที่ Claude ช่วยออกแบบ Test Cases ที่คุณไม่เคยนึกถึงครับ*
