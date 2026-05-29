# Code Examples — Claude Code for Real Engineers

โค้ดตัวอย่างจากหนังสือ **Claude Code for Real Engineers** แยกตามบท

## Setup

```bash
# 1. Clone
git clone https://github.com/tksoft11/claude-code-real-engineers.git
cd claude-code-real-engineers

# 2. ตั้ง API Key
cp .env.example .env
# แก้ไขใส่ ANTHROPIC_API_KEY ของคุณ
```

## บทและ Code Examples

| บท | ชื่อ | จำนวน Files |
|----|------|------------|
| [ch01-mindset-shift](ch01-mindset-shift/) | บทที่ 1: The Mindset Shift — ทิ้ง Vibe Coding แล้วเป็น AI Engineer | 3 files |
| [ch02-setup-guardrails](ch02-setup-guardrails/) | บทที่ 2: Setup & Guardrails — ติดตั้งอย่างปลอดภัย | 11 files |
| [ch03-claude-md](ch03-claude-md/) | บทที่ 3: CLAUDE.md — คัมภีร์บังคับ AI | 14 files |
| [ch04-ralph-loop](ch04-ralph-loop/) | บทที่ 4: The Ralph Loop — AFK Coding ข้ามคืน | 20 files |
| [ch05-skills-commands](ch05-skills-commands/) | บทที่ 5: Skills & Custom Commands — สร้างเครื่องมือที่ใช้ซ้ำได้ | 15 files |
| [ch06-context-management](ch06-context-management/) | บทที่ 6: Context Management — ทำไม Claude ถึง "หลง" และวิธีแก้ | 9 files |
| [ch07-debugging-ai](ch07-debugging-ai/) | บทที่ 7: Debugging with AI — ล่า Bug ด้วย Detective ที่ไม่เคยเหนื่อย | 4 files |
| [ch08-legacy-code](ch08-legacy-code/) | บทที่ 8: Legacy Code Whisperer — เจ้าแห่งโค้ดโบราณ | 7 files |
| [ch09-tdd-ai](ch09-tdd-ai/) | บทที่ 9: TDD กับ AI — Red-Green-Refactor ที่เร็วขึ้น 5 เท่า | 7 files |
| [ch10-self-healing](ch10-self-healing/) | บทที่ 10: Self-Healing Scripts — ระบบที่แก้ตัวเองได้ | 8 files |
| [ch11-autonomous-agent](ch11-autonomous-agent/) | บทที่ 11: The Autonomous Agent Loop — AI ที่ทำงาน 24 ชั่วโมง | 6 files |
| [ch13-selling-ai](ch13-selling-ai/) | บทที่ 13: Selling AI to Your Team & Management — โน้มน้าวหัวหน้าให้อนุมัติ | 3 files |
| [ch14-anthropic-sdk](ch14-anthropic-sdk/) | บทที่ 14: Bridging the Gap — จาก CLI สู่ Anthropic SDK | 10 files |
| [ch15-streaming](ch15-streaming/) | บทที่ 15: Streaming Responses — UX ระดับโลก ให้ AI ตอบทีละตัวอักษร | 9 files |
| [ch16-model-routing](ch16-model-routing/) | บทที่ 16: Model Routing & Spend Limits — ประหยัดค่า API อย่างชาญฉลาด | 7 files |
| [ch17-prompt-caching-batch](ch17-prompt-caching-batch/) | บทที่ 17: Prompt Caching & Batch API | 7 files |
| [ch18-context-trinity](ch18-context-trinity/) | บทที่ 18: The Context Trinity — CLAUDE.md + TASKS.md + DESIGN.md | 8 files |
| [ch19-advanced-claude-md](ch19-advanced-claude-md/) | บทที่ 19: Advanced CLAUDE.md & Dynamic Rules — Zero Trust Execution | 9 files |
| [ch20-structured-outputs](ch20-structured-outputs/) | บทที่ 20: Structured Outputs — บังคับ JSON Schema ทุกกระเบียดนิ้ว | 6 files |
| [ch21-ai-ethics](ch21-ai-ethics/) | บทที่ 21: AI Ethics & IP in Commercial Projects — เส้นแดงที่ห้ามข้าม | 5 files |
| [ch22-tool-use](ch22-tool-use/) | บทที่ 22: Tool Use & External APIs — ให้ AI มี "มือ" ลงมือทำแทนคุณ | 8 files |
| [ch23-computer-use](ch23-computer-use/) | บทที่ 23: Computer Use 101 — ให้ AI ขยับเมาส์ดูหน้าจอแทนคน | 6 files |
| [ch24-claude-vision](ch24-claude-vision/) | บทที่ 24: Claude Vision API สู่ DESIGN.md — AI อ่าน Figma แล้วเขียนโค้ด | 7 files |
| [ch25-memory-vector-db](ch25-memory-vector-db/) | บทที่ 25: Memory Management & Vector DB — Context Window vs RAG | 4 files |
| [ch26-rag-pipeline](ch26-rag-pipeline/) | บทที่ 26: [Hands-on] Building a RAG Pipeline — The Company Brain | 8 files |
| [ch27-cli-assistant](ch27-cli-assistant/) | บทที่ 27: สร้าง CLI AI Assistant ของตัวเอง — จำลอง Claude Code | 7 files |
| [ch28-assertion-loop](ch28-assertion-loop/) | บทที่ 28: [Hands-on] The Assertion Loop & Bug Hunter | 6 files |
| [ch29-saas-backend](ch29-saas-backend/) | บทที่ 29: [Capstone Vol 2] The AI-Powered SaaS Backend | 8 files |
| [ch30-mcp-101](ch30-mcp-101/) | บทที่ 30: Model Context Protocol (MCP) 101 — มาตรฐานใหม่ของ AI Integration | 10 files |
| [ch31-mcp-server](ch31-mcp-server/) | บทที่ 31: สร้าง MCP Server ของตัวเอง — Internal Tools ที่ Claude ใช้ได้ทันที | 11 files |
| [ch32-defensive-ai](ch32-defensive-ai/) | บทที่ 32: Defensive AI — Prompt Injection Defense | 5 files |
| [ch33-security-rbac](ch33-security-rbac/) | บทที่ 33: Security & RBAC สำหรับ AI Systems — ใครใช้ Tool ไหนได้บ้าง | 8 files |
| [ch34-multi-agent](ch34-multi-agent/) | บทที่ 34: Multi-Agent Orchestration — เมื่อ Claude ตัวเดียวไม่พอ | 10 files |
| [ch35-team-context](ch35-team-context/) | บทที่ 35: The Multi-Human & Multi-Agent Team — คน 5 คน แชร์ AI Context ไม่ให้โค้ดชนกัน | 2 files |
| [ch36-ci-cd](ch36-ci-cd/) | บทที่ 36: AI in CI/CD (GitHub Actions) — Automated Code Review + Security Scan | 8 files |
| [ch37-db-migration](ch37-db-migration/) | บทที่ 37: Database Migration Safety — วิเคราะห์ Migration SQL ก่อน Deploy ด้วย AI | 9 files |
| [ch38-mobile-ai](ch38-mobile-ai/) | บทที่ 38: Mobile AI Architecture | 7 files |
| [ch39-react-native](ch39-react-native/) | บทที่ 39: [Hands-on] React Native & Claude — สร้างแอปข้ามแพลตฟอร์มเชื่อม AI Backend | 5 files |
| [ch40-app-store](ch40-app-store/) | บทที่ 40: App Store Compliance for AI Apps — กฎ Apple/Google + ให้ AI ร่าง Privacy Policy | 4 files |
| [ch41-fastlane](ch41-fastlane/) | บทที่ 41: The Fastlane Automator | 12 files |
| [ch42-auto-fix-pipeline](ch42-auto-fix-pipeline/) | บทที่ 42: [Capstone Vol 3] The Enterprise Auto-Fix Pipeline — Error → AI สร้าง PR แก้บั๊ก → รอกด Merge | 3 files |
| [ch43-llm-observability](ch43-llm-observability/) | บทที่ 43: LLM Observability & Tracing | 10 files |
| [ch44-graceful-degradation](ch44-graceful-degradation/) | บทที่ 44: Graceful AI Degradation & Multi-Model Fallbacks — ระบบ AI ที่ไม่มีวันพัง | 11 files |
| [ch45-on-call-incident](ch45-on-call-incident/) | บทที่ 45: AI On-Call & Incident Response | 7 files |
| [ch46-ai-roi](ch46-ai-roi/) | บทที่ 46: Measuring & Reporting AI ROI — KPI, Dashboard, วิธีรายงานให้ผู้บริหารอนุมัติ Budget AI ต่อ | 5 files |
| [ch47-singularity](ch47-singularity/) | บทที่ 47: The Singularity of Engineering — บทสรุปเมื่อมนุษย์กับ AI หลอมรวม สู่ 10x Engineer ตัวจริง | 3 files |
