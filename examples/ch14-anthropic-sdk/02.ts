// Node.js — โหลดจาก .env
import 'dotenv/config';
// SDK จะอ่าน ANTHROPIC_API_KEY จาก environment อัตโนมัติ
const client = new Anthropic();  // ไม่ต้องใส่ apiKey!
