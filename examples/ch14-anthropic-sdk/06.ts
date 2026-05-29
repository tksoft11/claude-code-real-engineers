console.log(response.id);              // msg_xxxxx
console.log(response.model);           // claude-sonnet-4-5
console.log(response.stop_reason);     // 'end_turn' | 'max_tokens' | 'stop_sequence'

// Content ที่ Claude ตอบ
const text = response.content[0].text; // string

// Token Usage (สำคัญสำหรับ Cost Control)
console.log(response.usage.input_tokens);  // tokens ที่ส่งไป
console.log(response.usage.output_tokens); // tokens ที่ได้กลับมา

// คำนวณค่าใช้จ่าย (Sonnet pricing)
const inputCost  = response.usage.input_tokens  * 0.000003;  // $3/1M tokens
const outputCost = response.usage.output_tokens * 0.000015;  // $15/1M tokens
const totalUSD   = inputCost + outputCost;
console.log(`Cost: $${totalUSD.toFixed(6)}`);
