// src/config/models.ts
export const MODELS = {
  // ถูกที่สุด — ใช้กับงาน simple, repetitive
  FAST: 'claude-haiku-4-5',

  // สมดุลที่ดี — ใช้กับงานทั่วไป
  BALANCED: 'claude-sonnet-4-5',

  // ทรงพลังที่สุด — ใช้กับงานซับซ้อน
  POWERFUL: 'claude-opus-4-5',
} as const;

// เลือก model ตามประเภทงาน
function selectModel(taskType: 'classify' | 'analyze' | 'generate' | 'reason'): string {
  switch (taskType) {
    case 'classify':  return MODELS.FAST;      // จัดหมวดหมู่ — ง่าย
    case 'analyze':   return MODELS.BALANCED;  // วิเคราะห์ — กลาง
    case 'generate':  return MODELS.BALANCED;  // สร้าง content — กลาง
    case 'reason':    return MODELS.POWERFUL;  // ใช้เหตุผลซับซ้อน — สูง
  }
}
