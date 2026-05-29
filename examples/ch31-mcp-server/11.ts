// 1. ห้าม expose ทุก field ของ API response
// ❌ อันตราย:
return JSON.stringify(res.data); // รวม salary, bankAccount, etc.

// ✅ ถูกต้อง:
return JSON.stringify(sanitize(res.data, ['salary', 'bankAccount', 'taxId']));

// 2. Validate input ก่อนส่ง API
// ❌ อันตราย:
const res = await hrApi.get(`/employees/${employeeId}`); // path traversal!

// ✅ ถูกต้อง:
if (!/^[A-Z0-9-]+$/.test(employeeId)) throw new Error('Invalid employee ID format');
const res = await hrApi.get(`/employees/${encodeURIComponent(employeeId)}`);

// 3. Rate limiting ใน MCP Server
const rateLimits = new Map<string, number>();
function checkRateLimit(toolName: string, limit = 30): void {
  const key = `${toolName}:${Math.floor(Date.now() / 60000)}`; // per minute
  const count = (rateLimits.get(key) || 0) + 1;
  rateLimits.set(key, count);
  if (count > limit) throw new Error(`Rate limit exceeded for ${toolName}`);
}
