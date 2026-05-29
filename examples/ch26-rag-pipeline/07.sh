# 1. Start server
ts-node src/server.ts

# 2. Upload เอกสาร (PDF หรือ .txt)
curl -X POST http://localhost:3000/api/documents \
  -F "file=@hr-policy.pdf" \
  -F "title=HR Policy 2025" \
  -F "category=hr"

# 3. ถาม
curl -X POST http://localhost:3000/api/query \
  -H "Content-Type: application/json" \
  -d '{"question": "ลาพักร้อนได้กี่วัน?", "category": "hr"}'

# Response:
# {
#   "answer": "พนักงานมีสิทธิ์ลาพักร้อน 10 วันต่อปี...",
#   "sources": ["HR Policy 2025"],
#   "confidence": "high"
# }
