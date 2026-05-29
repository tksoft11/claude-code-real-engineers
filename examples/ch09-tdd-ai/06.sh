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
