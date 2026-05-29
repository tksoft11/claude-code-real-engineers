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
