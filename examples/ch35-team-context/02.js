// tools/git-ai-shield.js
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🛡️  Running AI-Native Pre-Commit Shield...');

// 1. ตรวจจับการหลุดรอดของความลับ (API Keys Detector)
const SECRET_PATTERNS = [
  /sk-ant-api[0-9a-zA-Z_-]{8,}/, // Anthropic API Key
  /sk-[a-zA-Z0-9]{48}/,           // OpenAI API Key
  /bearer\s+[a-zA-Z0-9._-]{20,}/i // General Bearer tokens
];

try {
  // ดึงรายการไฟล์ที่มีการเปลี่ยนแปลงและจะถูก Commit (Staged Files)
  const stagedFiles = execSync('git diff --cached --name-only', { encoding: 'utf8' })
    .split('\n')
    .filter(Boolean);

  if (stagedFiles.length === 0) {
    console.log('✅ No staged files found. Skipping.');
    process.exit(0);
  }

  // วนลูปตรวจสอบความปลอดภัยทีละไฟล์
  for (const file of stagedFiles) {
    if (!fs.existsSync(file)) continue;
    
    // ตรวจสอบเฉพาะไฟล์โค้ดและไฟล์ตั้งค่า
    const stat = fs.statSync(file);
    if (stat.isDirectory()) continue;
    
    const fileContent = fs.readFileSync(file, 'utf8');
    
    for (const pattern of SECRET_PATTERNS) {
      if (pattern.test(fileContent)) {
        console.error(`\n🚨 ERROR: ตรวจพบความลับหรือ API Key รั่วไหลในไฟล์: ${file}`);
        console.error(`Pattern matched: ${pattern}`);
        console.error('❌ บล็อกการ Commit เพื่อความปลอดภัย กรุณาย้ายความลับไปไว้ใน .env เสมอ!\n');
        process.exit(1);
      }
    }
  }

  // 2. ตรวจสอบการซิงโครไนซ์ของ Context Trinity
  const hasDesignChanged = stagedFiles.includes('DESIGN.md');
  if (hasDesignChanged) {
    // เช็กว่าเราเบลนด์ข้อมูลห่างจาก main ล่าสุดแล้วหรือยังเพื่อกัน Context Drift
    try {
      execSync('git fetch origin main', { stdio: 'ignore' });
      const diffCount = execSync('git rev-list --count HEAD..origin/main', { encoding: 'utf8' }).trim();
      
      if (parseInt(diffCount, 10) > 0) {
        console.error('\n⚠️ WARNING: DESIGN.md ของคุณอาจล้าสมัย!');
        console.error(`กิ่งหลัก main มีการอัปเดตใหม่จำนวน ${diffCount} commits ที่คุณยังไม่ได้ pull`);
        console.error('❌ กรุณาทำการ git pull origin main ก่อนอัปเดตไฟล์บริบทกลางเพื่อป้องกัน Conflict!\n');
        process.exit(1);
      }
    } catch (e) {
      // ทำงานแบบ Offline หรือเชื่อมต่อเซิร์ฟเวอร์หลักไม่ได้ ปล่อยผ่านเป็น warning
      console.log('⚠️ ไม่สามารถเชื่อมต่อรีโมตได้ ข้ามการเช็ก Context Drift ล่าสุด');
    }
  }

  // 3. จัดการแยกไฟล์ Task ย่อยของตัวเอง ป้องกันการชนกันที่ TASKS.md
  const hasSharedTaskChanged = stagedFiles.includes('TASKS.md');
  if (hasSharedTaskChanged) {
    console.warn('\n💡 คำแนะนำ: หลีกเลี่ยงการคอมมิตไฟล์ TASKS.md ผืนใหญ่โดยตรง');
    console.warn('แนะนำให้ใช้โฟลเดอร์ tasks/แยกตั๋วงานย่อย เช่น tasks/TICKET-123.md เพื่อไม่ให้ชนกับเพื่อนร่วมทีม\n');
  }

  console.log('✅ AI-Native Shield: ตรวจผ่านการตรวจสอบเรียบร้อยพร้อม Commit.');
  process.exit(0);

} catch (error) {
  console.error('❌ Shield execution error:', error.message);
  process.exit(1);
}
