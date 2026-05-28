# บทที่ 9: TDD กับ AI — Red-Green-Refactor ที่เร็วขึ้น 5 เท่า

---

## 🪝 ปัญหาของ TDD แบบดั้งเดิม

TDD (Test-Driven Development) เป็นเทคนิคที่ทุกคนรู้ว่าดี แต่น้อยคนที่ทำจริงๆ เพราะ:

> "เขียน test ก่อนโค้ด? มันช้าและเจ็บปวดมาก"

วงจรแบบดั้งเดิม:
```
1. คิด test cases → ใช้เวลา 20 นาที (และมักลืม edge cases)
2. เขียน test → ใช้เวลา 30 นาที
3. เขียน implementation → ใช้เวลา 45 นาที
4. แก้จนผ่าน → ใช้เวลา 30 นาที (debug test ที่เขียนผิด)
รวม: ~2 ชั่วโมงต่อ feature เล็กๆ
```

วงจรแบบ AI-Assisted TDD:
```
1. คุณเขียน spec สั้นๆ (5 นาที)
2. Claude สร้าง test cases ครบถ้วน (3 นาที)
3. Claude เขียน implementation ให้ผ่าน tests (5 นาที)
4. คุณ review และ refine (5 นาที)
รวม: ~18 นาที
```

เร็วกว่า **6 เท่า** และ test coverage สูงกว่าที่คุณเขียนเองด้วย

---

## 🧠 ทำไม TDD ถึงสำคัญ "มากกว่าเดิม" ในยุค AI

ในยุคที่ AI เขียนโค้ดแทนคุณ TDD กลายเป็น **ตาข่ายนิรภัย** ที่ขาดไม่ได้

ถ้าไม่มี tests:
```
คุณสั่ง AI → AI เขียนโค้ด → โค้ดดูดี → Deploy → พัง
                                              ↑
                              ไม่มีใครรู้ว่าพังก่อน Deploy
```

มี tests:
```
คุณสั่ง AI → AI เขียนโค้ด → Tests รัน → ผ่าน → Deploy ได้
                                         ↓
                                    ไม่ผ่าน → AI แก้จนผ่าน
```

**กฎ:** ก่อนสั่ง AI เขียนโค้ดทุกครั้ง ต้องมี test spec ก่อน

---

## 🔴🟢🔵 วงจร AI-Assisted TDD

### Phase 1: Spec-First (คุณทำ)

แทนที่จะเขียน test เองทั้งหมด ให้เขียนแค่ "spec" สั้นๆ:

```markdown
# Spec: UserService.createUser()

## ต้องทำได้
- รับ { email, password, name } สร้าง user ใหม่
- Hash password ด้วย bcrypt rounds 12 ก่อนบันทึก
- คืน user object ที่ไม่มี password field

## ต้องปฏิเสธ
- email ซ้ำใน database → throw DuplicateEmailError
- email format ไม่ถูก → throw ValidationError
- password น้อยกว่า 8 ตัวอักษร → throw ValidationError
- name ว่าง → throw ValidationError

## ต้องไม่เกิด
- เก็บ plain text password ใดๆ ใน database
- บันทึกข้อมูล partial ถ้า error เกิดขึ้นกลางทาง
```

### Phase 2: Test Generation (Claude ทำ)

```
"อ่าน spec นี้: [paste spec]
 เขียน comprehensive test suite สำหรับ UserService.createUser()
 
 ครอบคลุม:
 1. Happy path ทุก scenario
 2. Error cases ทุก validation
 3. Edge cases ที่ spec ไม่ได้พูดถึงแต่ควรมี
 4. Security tests (password hashing, no plain text)
 5. Database tests (transaction rollback กรณี error)
 
 Mock: ใช้ mock สำหรับ database และ bcrypt
 Framework: Vitest
 ยังไม่ต้องสร้าง implementation — แค่ tests ที่จะ fail ก่อน"
```

**ผลลัพธ์ที่ Claude สร้าง:**

```typescript
// tests/user.service.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UserService } from '../src/services/user.service';
import { DuplicateEmailError, ValidationError } from '../src/errors';

// Mock dependencies
vi.mock('../src/db/prisma', () => ({
  prisma: {
    user: {
      create: vi.fn(),
      findUnique: vi.fn(),
    },
  },
}));

vi.mock('bcryptjs', () => ({
  hash: vi.fn().mockResolvedValue('hashed_password'),
  compare: vi.fn(),
}));

describe('UserService.createUser()', () => {
  let service: UserService;

  beforeEach(() => {
    service = new UserService();
    vi.clearAllMocks();
  });

  // ============ Happy Path ============
  describe('Happy Path', () => {
    it('should create user with valid data', async () => {
      prisma.user.findUnique.mockResolvedValue(null); // email ไม่ซ้ำ
      prisma.user.create.mockResolvedValue({
        id: 'uuid-123',
        email: 'test@example.com',
        name: 'Test User',
        password: 'hashed_password',
        createdAt: new Date(),
      });

      const result = await service.createUser({
        email: 'test@example.com',
        password: 'password123',
        name: 'Test User',
      });

      expect(result.email).toBe('test@example.com');
      expect(result.name).toBe('Test User');
    });

    it('should hash password before saving', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.create.mockResolvedValue({ id: '1', email: 'a@b.com', name: 'A', password: 'hashed' });

      await service.createUser({ email: 'a@b.com', password: 'mypassword', name: 'A' });

      expect(bcrypt.hash).toHaveBeenCalledWith('mypassword', 12);
      expect(prisma.user.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ password: 'hashed_password' }),
      });
    });

    it('should NOT return password field in response', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.create.mockResolvedValue({ id: '1', email: 'a@b.com', name: 'A', password: 'hashed' });

      const result = await service.createUser({ email: 'a@b.com', password: 'pass123!', name: 'A' });

      expect(result).not.toHaveProperty('password');
    });
  });

  // ============ Validation Errors ============
  describe('Validation', () => {
    it('should throw ValidationError for invalid email format', async () => {
      await expect(
        service.createUser({ email: 'not-an-email', password: 'pass123!', name: 'A' })
      ).rejects.toThrow(ValidationError);
    });

    it('should throw ValidationError for password less than 8 chars', async () => {
      await expect(
        service.createUser({ email: 'a@b.com', password: 'short', name: 'A' })
      ).rejects.toThrow(ValidationError);
    });

    it('should throw ValidationError for empty name', async () => {
      await expect(
        service.createUser({ email: 'a@b.com', password: 'pass123!', name: '' })
      ).rejects.toThrow(ValidationError);
    });

    it('should throw ValidationError for whitespace-only name', async () => {
      await expect(
        service.createUser({ email: 'a@b.com', password: 'pass123!', name: '   ' })
      ).rejects.toThrow(ValidationError);
    });
  });

  // ============ Duplicate Email ============
  describe('Duplicate Email', () => {
    it('should throw DuplicateEmailError when email already exists', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'existing' }); // email มีอยู่แล้ว

      await expect(
        service.createUser({ email: 'existing@example.com', password: 'pass123!', name: 'A' })
      ).rejects.toThrow(DuplicateEmailError);
    });

    it('should be case-insensitive email check', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'existing' });

      await expect(
        service.createUser({ email: 'EXISTING@EXAMPLE.COM', password: 'pass123!', name: 'A' })
      ).rejects.toThrow(DuplicateEmailError);
    });
  });

  // ============ Edge Cases (ที่ Claude คิดเองโดยที่ spec ไม่ได้บอก) ============
  describe('Edge Cases', () => {
    it('should trim email before saving', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.create.mockResolvedValue({ id: '1', email: 'a@b.com', name: 'A', password: 'h' });

      await service.createUser({ email: '  a@b.com  ', password: 'pass123!', name: 'A' });

      expect(prisma.user.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ email: 'a@b.com' }), // trimmed
      });
    });

    it('should not save data if password hashing fails', async () => {
      bcrypt.hash.mockRejectedValue(new Error('hashing failed'));

      await expect(
        service.createUser({ email: 'a@b.com', password: 'pass123!', name: 'A' })
      ).rejects.toThrow();

      expect(prisma.user.create).not.toHaveBeenCalled(); // ไม่บันทึก
    });

    it('should handle very long names gracefully', async () => {
      const longName = 'A'.repeat(300);

      await expect(
        service.createUser({ email: 'a@b.com', password: 'pass123!', name: longName })
      ).rejects.toThrow(ValidationError); // ควร fail ไม่ใช่ crash
    });
  });
});
```

### Phase 3: Implementation (Claude ทำ)

หลังจากมี Tests ที่ fail แล้ว:

```
"ตอนนี้ tests ทั้งหมด fail เพราะยังไม่มี implementation
 เขียน UserService.createUser() ที่ทำให้ทุก test ผ่าน
 
 กฎ:
 - เขียนให้ minimal ที่สุด — แค่ทำให้ tests ผ่าน
 - ไม่ต้องเพิ่ม feature ที่ไม่มีใน tests
 - รัน tests หลังเขียนเสร็จ แก้จนผ่านทั้งหมด"
```

### Phase 4: Refactor (คุณและ Claude ร่วมกัน)

```
"Tests ผ่านทั้งหมดแล้ว ตอนนี้ให้ refactor implementation:
 - ดูว่ามี code smell อะไรไหม?
 - มี duplication ที่ควร extract?
 - ชื่อตัวแปร/function ชัดเจนพอไหม?
 
 หลัง refactor รัน tests อีกครั้งเพื่อยืนยันว่ายัง pass"
```

---

## 🎯 Edge Case Generator: สิ่งที่ Claude เก่งกว่ามนุษย์

ความสามารถพิเศษของ Claude คือการหา Edge Cases ที่คุณไม่เคยนึกถึง:

```
"ฉันกำลังเขียน function processPayment(amount, currency, userId)
 ก่อนเขียน tests ช่วยบอกว่ามี edge cases อะไรบ้างที่ฉันอาจพลาด?
 คิดให้ครอบคลุมทุก dimension:
 - ตัวเลข (amount)
 - String (currency)
 - ความปลอดภัย
 - Concurrency
 - External service failures
 - State inconsistency"
```

**ตัวอย่างที่ Claude คิดออก:**

```markdown
Edge Cases ที่คุณอาจพลาด:

**Amount:**
- amount = 0 (ควรยอมรับหรือปฏิเสธ?)
- amount = 0.001 (เล็กกว่า minimum payment)
- amount = Number.MAX_SAFE_INTEGER (overflow risk)
- amount = -100 (negative — คือ refund หรือ error?)
- amount = "100" (string แทน number)
- amount = NaN, Infinity

**Currency:**
- currency ที่ไม่รองรับ (BTC, XXX)
- currency = null, undefined, ""
- currency ตัวพิมพ์เล็ก "thb" แทน "THB"
- currency ที่ถูกต้องแต่ไม่รองรับใน region นี้

**Concurrency:**
- user กด Pay 2 ครั้งในเวลา <100ms (double charge!)
- payment เริ่มต้น แต่ network ขาดกลางคัน
- payment provider timeout หลัง debit แต่ก่อน confirm

**Security:**
- userId ของคนอื่น (IDOR — สามารถ charge คนอื่นได้ไหม?)
- amount ที่ใหญ่กว่า user's balance/limit

**External Failures:**
- Payment provider return 500
- Payment provider timeout (30s)
- Payment provider return success แต่ idempotency key ซ้ำ
```

---

## 🧬 Property-Based Testing ด้วย AI

แทนที่จะเขียน test cases เฉพาะๆ ให้เขียน "properties" ที่ควรเป็นจริงเสมอ:

```
"สำหรับ function calculateDiscount(price, discountPercent) ช่วยเขียน
 property-based tests ที่ verify properties เหล่านี้:
 
 1. ผลลัพธ์ต้องไม่มากกว่า price เดิม
 2. discount 0% ต้องให้ผลเท่า price เดิม
 3. discount 100% ต้องให้ผล 0
 4. ยิ่ง discountPercent มาก ผลต้องน้อยลง (monotonic)
 5. ผลต้องไม่ติดลบ
 
 ใช้ fast-check library สำหรับ property testing"
```

```typescript
import fc from 'fast-check';
import { calculateDiscount } from '../src/utils/pricing';

describe('calculateDiscount - Properties', () => {
  it('result should never exceed original price', () => {
    fc.assert(
      fc.property(
        fc.float({ min: 0, max: 1_000_000 }),
        fc.float({ min: 0, max: 100 }),
        (price, discountPct) => {
          const result = calculateDiscount(price, discountPct);
          return result <= price;
        }
      )
    );
  });

  it('zero discount returns original price', () => {
    fc.assert(
      fc.property(
        fc.float({ min: 0, max: 1_000_000 }),
        (price) => {
          return calculateDiscount(price, 0) === price;
        }
      )
    );
  });

  it('result should never be negative', () => {
    fc.assert(
      fc.property(
        fc.float({ min: 0 }),
        fc.float({ min: 0, max: 100 }),
        (price, discountPct) => {
          return calculateDiscount(price, discountPct) >= 0;
        }
      )
    );
  });
});
```

---

## 📋 BDD: เขียน Tests ด้วยภาษาธุรกิจ

สำหรับทีมที่มี non-technical stakeholders ใช้ BDD (Behavior-Driven Development):

```
"แปลง acceptance criteria เหล่านี้เป็น Gherkin scenarios แล้วเขียน step definitions:

Acceptance Criteria จาก Product Owner:
- ลูกค้าที่สั่งซื้อสินค้าสูงกว่า 1,000 บาท ได้รับค่าจัดส่งฟรี
- ลูกค้าที่เป็น Gold member ได้รับค่าจัดส่งฟรีเสมอ
- สินค้าประเภท fragile มีค่าจัดส่งเพิ่ม 50 บาท
- จัดส่งต่างจังหวัดคิดเพิ่ม 30 บาท"
```

**Claude สร้าง:**

```gherkin
Feature: Shipping Cost Calculation

  Scenario: Free shipping for orders over 1,000 baht
    Given a customer with standard membership
    And a cart with total 1,200 baht
    When calculating shipping cost
    Then shipping cost should be 0 baht

  Scenario: Gold members always get free shipping
    Given a customer with Gold membership
    And a cart with total 500 baht
    When calculating shipping cost
    Then shipping cost should be 0 baht

  Scenario: Fragile items incur additional fee
    Given a customer with standard membership
    And a cart with a fragile item worth 200 baht
    When calculating shipping cost
    Then shipping cost should include 50 baht fragile surcharge

  Scenario: Combined rules - Gold member with fragile item
    Given a customer with Gold membership
    And a cart with a fragile item
    When calculating shipping cost
    Then shipping cost should be 50 baht (only fragile surcharge, no base shipping)
```

---

## 💻 Hands-On: TDD Sprint กับ Feature จริง

**โจทย์:** เขียน feature ใหม่ด้วย AI-Assisted TDD ตั้งแต่ต้น

**Feature:** Password Reset Flow

```bash
# 1. เขียน spec ก่อน (คุณทำเอง — 5 นาที)
cat > specs/password-reset.spec.md << 'EOF'
# Spec: Password Reset

## requestReset(email)
- ส่ง reset link ไปยัง email ถ้า account มีอยู่
- ถ้า email ไม่มีใน system → ไม่บอก (security: prevent enumeration)
- Token มีอายุ 1 ชั่วโมง
- Token ใช้ได้ครั้งเดียว

## resetPassword(token, newPassword)
- ถ้า token valid → เปลี่ยนรหัสผ่าน + mark token used
- ถ้า token หมดอายุ → reject
- ถ้า token ใช้ไปแล้ว → reject
- password ใหม่ต้องผ่าน validation เหมือน createUser
EOF

# 2. ให้ Claude generate tests
claude
```

```
"อ่าน specs/password-reset.spec.md
 แล้วเขียน test suite สำหรับ PasswordResetService
 ครอบคลุม happy path, error cases, edge cases, และ security tests
 ใช้ Vitest, mock email service และ database
 ทำให้ tests ครบถ้วน ready to fail (no implementation yet)"
```

```bash
# 3. รัน tests ให้ fail ก่อน (Red)
npx vitest run tests/password-reset.test.ts
# ควรเห็น: FAIL — ยังไม่มี implementation

# 4. ให้ Claude เขียน implementation
# "เขียน PasswordResetService ให้ผ่านทุก test"

# 5. รัน tests อีกครั้ง (Green)
npx vitest run tests/password-reset.test.ts
# ควรเห็น: PASS

# 6. Refactor (Blue)
# "ดู implementation ที่เขียน มี code smell ไหม? ปรับปรุงโดยไม่เปลี่ยน behavior"
```

---

## 🎯 สรุปบทที่ 9

| หัวข้อ | สิ่งที่ต้องจำ |
|--------|--------------|
| AI-Assisted TDD | Spec → Tests (Claude) → Implementation (Claude) → Review (คุณ) |
| เร็วกว่าเดิม | ~18 นาที vs ~2 ชั่วโมงของ TDD แบบดั้งเดิม |
| Edge Case Generator | Claude หา edge cases ที่คุณไม่เคยนึกถึง |
| Property-Based Testing | ทดสอบ "properties" ด้วย random inputs ผ่าน fast-check |
| BDD | เปลี่ยน acceptance criteria เป็น Gherkin tests อัตโนมัติ |
| กฎสำคัญ | เขียน spec ก่อนทุกครั้ง — ห้าม AI เขียนโค้ดโดยไม่มี tests |

---

## 📋 Action Items ก่อนไปบทที่ 10

- [ ] เลือก feature ที่กำลังจะทำ เขียน spec สั้นๆ ก่อน (5 นาที)
- [ ] ให้ Claude generate tests จาก spec นั้น
- [ ] ดูว่า Claude หา edge cases อะไรที่คุณไม่นึกถึงบ้าง
- [ ] ทำ full Red-Green-Refactor cycle 1 ครั้งด้วย AI-Assisted TDD
- [ ] เพิ่ม property-based tests สำหรับ utility function อย่างน้อย 1 ตัว

---

*ใน **บทที่ 10** เราจะเรียนรู้ Self-Healing Scripts — การสร้างระบบ automation ที่แก้ตัวเองได้เมื่อ environment เปลี่ยน ไฟล์หาย หรือ dependency update แตก โดยไม่ต้องรอให้คุณมา debug ครับ*
