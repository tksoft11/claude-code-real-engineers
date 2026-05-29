// backend/src/routes/chat.route.ts
import { Router } from 'express';
import { promptShield } from '../middleware/promptShield';
import { handleChatStream } from '../controllers/chat.controller';
import { requireAuth } from '../middleware/auth';

const router = Router();

// ลำดับทริกเกอร์: ตรวจสอบสิทธิ์ตนเอง -> สแกนการฉีด Prompt -> ดำเนินการต่อฝั่งโมเดล
router.post('/chat', requireAuth, promptShield, handleChatStream);

export default router;
