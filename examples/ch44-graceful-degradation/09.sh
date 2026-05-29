# รัน test
npx ts-node test/gateway.test.ts

# จำลอง Claude API timeout โดยลด timeout เป็น 1ms
# gateway = new AIGateway({ timeoutMs: 1 }) → ทุก provider timeout → ลอง next
