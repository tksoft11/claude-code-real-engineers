# 1. สมัคร Langfuse Cloud (ฟรี) หรือ self-host
# https://langfuse.com

# 2. ตั้ง environment variables
export LANGFUSE_PUBLIC_KEY=pk-lf-...
export LANGFUSE_SECRET_KEY=sk-lf-...
export ANTHROPIC_API_KEY=sk-ant-...

# 3. Run server
npm run dev

# 4. ส่ง test request
curl -X POST http://localhost:3000/api/summarize \
  -H "Content-Type: application/json" \
  -d '{"text": "การ AI ทำให้โลกเปลี่ยนไปอย่างรวดเร็ว...", "userId": "user-123"}'

# 5. เปิด Langfuse dashboard → ดู trace ของ call นี้
# จะเห็น: prompt, response, token count, latency, cost
