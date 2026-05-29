# ดู commits ที่ AI ทำ
git log --oneline --since="yesterday 6pm"

# ดูว่าไฟล์อะไรเปลี่ยนบ้าง
git diff --stat HEAD~10

# Review โค้ดที่เปลี่ยนใน src/
git diff HEAD~10 -- src/

# ถ้าเจอ commit ที่น่าสงสัย ดูรายละเอียด
git show <commit-hash>
