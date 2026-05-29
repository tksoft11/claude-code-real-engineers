// src/utils/anonymizer.ts
interface RawCustomerData {
  name: string;
  email: string;
  phone: string;
  purchaseHistory: string;
  feedback: string;
}

interface AnonymizedData {
  customerId: string; // hash แทน PII
  purchaseHistory: string;
  feedback: string;
}

export function anonymizeForAI(data: RawCustomerData): AnonymizedData {
  const { createHash } = require('crypto');

  return {
    // แทนที่ PII ด้วย hash (reversible ใน internal system แต่ AI ไม่รู้)
    customerId: createHash('sha256')
      .update(data.email + process.env.HASH_SALT)
      .digest('hex')
      .slice(0, 8),

    // ลบข้อมูลส่วนตัวออก เก็บแค่ business data
    purchaseHistory: data.purchaseHistory
      .replace(/\b[A-Z][a-z]+ [A-Z][a-z]+\b/g, '[NAME]')  // ชื่อ
      .replace(/\b[\w.]+@[\w.]+\b/g, '[EMAIL]')              // email
      .replace(/\b0[0-9]{9}\b/g, '[PHONE]'),                 // เบอร์โทร

    feedback: data.feedback,
  };
}

// ใช้งาน
const raw = await db.getCustomer(customerId);
const safe = anonymizeForAI(raw);          // ← Anonymize ก่อน
const analysis = await claude.analyze(safe); // ← ส่ง AI เฉพาะส่วนที่ safe
