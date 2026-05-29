// backend/src/middleware/toxicityFilter.ts
import { Request, Response, NextFunction } from 'express';

// รายการคำและหัวข้อต้องห้ามขั้นรุนแรง (Toxicity Checklist)
const TOXIC_PATTERNS = [
  /ไอ้ควาย/i, /เย็ด/i, /ควย/i, // คำหยาบคายทั่วไป
  /สอนวิธีสร้างระเบิด/i, /สูตรปรุงสารพิษ/i, // หัวข้ออันตราย
  /hate speech/i, /racial slur/i
];

/**
 * ฟังก์ชันสำหรับวิเคราะห์และคัดกรองข้อความก่อนส่งให้ Client
 */
export function sanitizeAIOutput(text: string): { isSafe: boolean; cleanedText: string } {
  // 1. ตรวจจับผ่าน Regex เพื่อการตอบสนองที่รวดเร็ว
  for (const pattern of TOXIC_PATTERNS) {
    if (pattern.test(text)) {
      return {
        isSafe: false,
        cleanedText: 'ขออภัยครับ คำตอบนี้ไม่ผ่านมาตรฐานความปลอดภัยของระบบ และถูกปิดกั้นเพื่อรักษาความสุภาพ'
      };
    }
  }

  // 2. ป้องกันคำสะกดเลี่ยงบาลี (สามารถพัฒนาต่อยอดผ่านคำสั่งโมเดลขนาดเล็กคอยตรวจขนานได้)
  return { isSafe: true, cleanedText: text };
}

/**
 * ใช้ดักจับข้อมูลในการตอบกลับแบบปกติ (Non-Streaming Controller)
 */
export function checkResponseSafety(req: Request, res: Response, next: NextFunction) {
  const originalJson = res.json;

  // override res.json เพื่อตรวจสอบความปลอดภัยของข้อความที่ AI สร้าง
  res.json = function (body: any) {
    if (body && typeof body.reply === 'string') {
      const evaluation = sanitizeAIOutput(body.reply);
      if (!evaluation.isSafe) {
        res.status(400); // ปรับรหัสตอบกลับเมื่อไม่ปลอดภัย
        body.reply = evaluation.cleanedText;
        body.isBlocked = true;
      }
    }
    return originalJson.call(this, body);
  };

  next();
}
