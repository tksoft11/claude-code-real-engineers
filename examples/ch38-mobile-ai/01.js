// ❌ สิ่งที่ไม่ควรทำ (แต่คนทำเยอะมาก)
const response = await fetch('https://api.anthropic.com/v1/messages', {
  headers: {
    'x-api-key': 'sk-ant-api03-xxxx', // ← key นี้อยู่ใน APK/IPA ที่ใครก็ download ได้
  },
});
