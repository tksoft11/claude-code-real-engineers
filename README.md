# Claude Code for Real Engineers — Code Examples

> Code ตัวอย่างประกอบหนังสือ **"Claude Code for Real Engineers"**
> *(ซื้อหนังสือเพื่ออ่านเนื้อหาและคำอธิบาย)*

---

## 📁 โครงสร้าง

```
examples/
├── ch01-mindset-shift/       # บทที่ 1
├── ch02-setup-guardrails/    # บทที่ 2
├── ch03-claude-md/           # บทที่ 3 — CLAUDE.md templates
├── ch04-ralph-loop/          # บทที่ 4 — The Ralph Loop
├── ...
└── ch47-singularity/         # บทที่ 47
```

แต่ละโฟลเดอร์มี `README.md` อธิบายไฟล์ และ Code files พร้อมรัน

---

## ⚡ Quick Start

```bash
# 1. Clone repo
git clone https://github.com/tksoft11/claude-code-real-engineers.git
cd claude-code-real-engineers

# 2. ตั้ง API Key
cp .env.example .env
# แก้ไขใส่ ANTHROPIC_API_KEY ของคุณ

# 3. ลองรัน TypeScript (ต้องมี Node.js 20+)
cd examples/ch14-anthropic-sdk
npm install
npx ts-node 01.ts

# 4. ลองรัน Python (ต้องมี Python 3.11+)
cd examples/ch17-prompt-caching-batch
pip install anthropic python-dotenv
python 01.py
```

---

## 📚 Code Examples ตามบท

| บท | ชื่อ | ไฟล์ |
|----|------|------|
| 01 | Mindset Shift | [ch01](examples/ch01-mindset-shift/) |
| 02 | Setup & Guardrails | [ch02](examples/ch02-setup-guardrails/) |
| 03 | CLAUDE.md | [ch03](examples/ch03-claude-md/) |
| 04 | The Ralph Loop | [ch04](examples/ch04-ralph-loop/) |
| 05 | Skills & Custom Commands | [ch05](examples/ch05-skills-commands/) |
| 06 | Context Management | [ch06](examples/ch06-context-management/) |
| 07 | Debugging with AI | [ch07](examples/ch07-debugging-ai/) |
| 08 | Legacy Code | [ch08](examples/ch08-legacy-code/) |
| 09 | TDD กับ AI | [ch09](examples/ch09-tdd-ai/) |
| 10 | Self-Healing Scripts | [ch10](examples/ch10-self-healing/) |
| 11 | Autonomous Agent Loop | [ch11](examples/ch11-autonomous-agent/) |
| 13 | Selling AI to Your Team | [ch13](examples/ch13-selling-ai/) |
| 14 | Anthropic SDK | [ch14](examples/ch14-anthropic-sdk/) |
| 15 | Streaming Responses | [ch15](examples/ch15-streaming/) |
| 16 | Model Routing & Spend Limits | [ch16](examples/ch16-model-routing/) |
| 17 | Prompt Caching & Batch API | [ch17](examples/ch17-prompt-caching-batch/) |
| 18 | Context Trinity | [ch18](examples/ch18-context-trinity/) |
| 19 | Advanced CLAUDE.md | [ch19](examples/ch19-advanced-claude-md/) |
| 20 | Structured Outputs | [ch20](examples/ch20-structured-outputs/) |
| 21 | AI Ethics & IP | [ch21](examples/ch21-ai-ethics/) |
| 22 | Tool Use | [ch22](examples/ch22-tool-use/) |
| 23 | Computer Use | [ch23](examples/ch23-computer-use/) |
| 24 | Claude Vision API | [ch24](examples/ch24-claude-vision/) |
| 25 | Memory & Vector DB | [ch25](examples/ch25-memory-vector-db/) |
| 26 | RAG Pipeline | [ch26](examples/ch26-rag-pipeline/) |
| 27 | CLI AI Assistant | [ch27](examples/ch27-cli-assistant/) |
| 28 | Assertion Loop | [ch28](examples/ch28-assertion-loop/) |
| 29 | AI-Powered SaaS Backend | [ch29](examples/ch29-saas-backend/) |
| 30 | MCP 101 | [ch30](examples/ch30-mcp-101/) |
| 31 | Building MCP Server | [ch31](examples/ch31-mcp-server/) |
| 32 | Defensive AI | [ch32](examples/ch32-defensive-ai/) |
| 33 | Security & RBAC | [ch33](examples/ch33-security-rbac/) |
| 34 | Multi-Agent Orchestration | [ch34](examples/ch34-multi-agent/) |
| 35 | Team Context | [ch35](examples/ch35-team-context/) |
| 36 | AI in CI/CD | [ch36](examples/ch36-ci-cd/) |
| 37 | Database Migration Safety | [ch37](examples/ch37-db-migration/) |
| 38 | Mobile AI Architecture | [ch38](examples/ch38-mobile-ai/) |
| 39 | React Native & Claude | [ch39](examples/ch39-react-native/) |
| 40 | App Store Compliance | [ch40](examples/ch40-app-store/) |
| 41 | The Fastlane Automator | [ch41](examples/ch41-fastlane/) |
| 42 | Enterprise Auto-Fix Pipeline | [ch42](examples/ch42-auto-fix-pipeline/) |
| 43 | LLM Observability & Tracing | [ch43](examples/ch43-llm-observability/) |
| 44 | Graceful AI Degradation | [ch44](examples/ch44-graceful-degradation/) |
| 45 | AI On-Call & Incident Response | [ch45](examples/ch45-on-call-incident/) |
| 46 | Measuring & Reporting AI ROI | [ch46](examples/ch46-ai-roi/) |
| 47 | The Singularity of Engineering | [ch47](examples/ch47-singularity/) |

---

## 🔑 Requirements

- **Node.js** 20+ (TypeScript examples)
- **Python** 3.11+ (Python examples)
- **Anthropic API Key** — ดูที่ [console.anthropic.com](https://console.anthropic.com)

```bash
# ตรวจสอบ .env ก่อนรันเสมอ
cat .env.example
```

---

*Code Examples เผยแพร่ภายใต้ MIT License — นำไปใช้ในโปรเจกต์เชิงพาณิชย์ได้*
*เนื้อหาหนังสือ (คำอธิบาย, แนวคิด, กลยุทธ์) สงวนลิขสิทธิ์*
