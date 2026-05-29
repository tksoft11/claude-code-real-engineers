// โครงสร้างสมบูรณ์ของ API Call
const response = await client.messages.create({
  // 1. Model ที่จะใช้
  model: 'claude-sonnet-4-5',

  // 2. จำนวน tokens สูงสุดที่ต้องการใน response
  max_tokens: 2048,

  // 3. System Prompt — บุคลิกและกฎของ AI (ไม่บังคับ)
  system: `คุณคือ Customer Service AI สำหรับร้าน TechShop
  ตอบเป็นภาษาไทยเสมอ
  ถ้าไม่รู้คำตอบ ให้บอกตรงๆ อย่าเดา
  ห้ามให้ส่วนลดเกิน 10% โดยไม่ได้รับอนุมัติ`,

  // 4. รายการ messages (conversation history)
  messages: [
    { role: 'user', content: 'สินค้า iPhone 16 มีในสต็อกไหมครับ?' },
    { role: 'assistant', content: 'มีในสต็อกครับ มีทั้งสี Natural Titanium และ Black Titanium' },
    { role: 'user', content: 'ราคาเท่าไหร่?' },
    // Claude จะตอบ message ล่าสุดนี้
  ],
});
