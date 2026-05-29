# ติดตั้ง dependencies
npm install

# รัน Bot
npm run dev

# ในอีก terminal หนึ่ง — จำลองส่ง alert
curl -X POST http://localhost:5000/test/simulate-incident \
  -H "Content-Type: application/json"

# ดู console output เพื่อเห็น Bot ทำงานทีละขั้น
