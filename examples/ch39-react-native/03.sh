# backend/.env — เก็บบน server ห้าม commit ขึ้นระบบ Git ของทีม
ANTHROPIC_API_KEY=sk-ant-api03-xxxx
JWT_SECRET=your-jwt-secret-key-that-is-very-long-and-secure
DATABASE_URL=postgresql://...
PORT=3000

# mobile/.env — ไม่มีร่องรอยของ AI key เลย มีเพียงที่อยู่ของ Backend Server
EXPO_PUBLIC_BACKEND_URL=https://api.yourapp.com
