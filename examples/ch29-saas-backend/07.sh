# Start server
ts-node src/server.ts

# Test 1: Simple question (จะใช้ Haiku)
curl -N -X POST http://localhost:3000/api/support/chat \
  -H "Content-Type: application/json" \
  -d '{"question": "สวัสดี คุณทำอะไรได้บ้าง?"}'

# Test 2: Technical bug (จะสร้าง Jira ticket)
curl -X POST http://localhost:3000/api/support/chat/sync \
  -H "Content-Type: application/json" \
  -d '{"question": "login ไม่ได้เลย กด submit แล้วหน้าขาว"}'

# Response:
# {
#   "answer": "ขอโทษที่พบปัญหานี้ครับ ได้สร้าง ticket TECH-789 ให้แล้ว...",
#   "analysis": { "category": "bug", "urgency": "high", "requiresHuman": true },
#   "model": "claude-sonnet-4-5"
# }
