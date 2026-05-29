# ถ่าย screenshot หน้าเว็บที่คุณชอบ หรือ export จาก Figma
# แล้วรัน script นี้

node -e "
const { analyzeLocalImage } = require('./vision-client');

analyzeLocalImage('./screenshot.png', \`
วิเคราะห์ UI นี้และบอกฉัน:
1. Color palette (hex codes)
2. Typography system
3. Component patterns ที่เห็น
4. Design principles ที่ใช้ (Material, Apple HIG, ฯลฯ)
5. โค้ด React component สำหรับ element ที่น่าสนใจที่สุด 1 อัน
\`).then(console.log);
"
