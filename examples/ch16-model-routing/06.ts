// กำหนด max_tokens ให้พอดี — ไม่เผื่อมากเกิน
const tokenBudgets: Record<string, number> = {
  classify:      100,   // แค่ 1-2 คำ
  summarize:     300,   // ย่อหน้าเดียว
  translate:     500,   // ขึ้นอยู่กับ input
  explain:      1000,   // อธิบายพอสมควร
  code_review:  2000,   // review ละเอียด
  full_analysis: 4096,  // วิเคราะห์เต็มที่
};
