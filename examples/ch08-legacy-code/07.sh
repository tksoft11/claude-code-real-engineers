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
