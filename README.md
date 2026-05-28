# Claude Code for Real Engineers — Book Repository

> **จาก Vibe Coder สู่ AI Engineer ระดับ Production**

[![License: CC BY-NC-ND 4.0](https://img.shields.io/badge/License-CC%20BY--NC--ND%204.0-lightgrey.svg)](https://creativecommons.org/licenses/by-nc-nd/4.0/)

---

## 📖 เกี่ยวกับหนังสือ

**Claude Code for Real Engineers** คือหนังสือภาษาไทยที่สอนการใช้ Claude Code อย่างเป็นระบบ ไม่ใช่แค่ "ถามแล้วก๊อปโค้ด" แต่เป็นการสร้างระบบ AI Engineering ที่ใช้งานจริงใน Production

หนังสือแบ่งเป็น 4 Volumes, 47 บท:

| Volume | ระดับ | บท | เนื้อหาหลัก |
|--------|------|-----|-----------|
| Volume 1 | Foundation & Mindset | 0–12 | Ralph Loop, CLAUDE.md, TDD กับ AI |
| Volume 2 | Anthropic Ecosystem | 13–29 | Streaming, Caching, RAG, Tool Use |
| Volume 3 | Enterprise AI & MCP | 30–42 | MCP Server, LangGraph, Mobile, CI/CD |
| Volume 4 | AI Ops & Reliability | 43–47 | Observability, Fallback, On-Call, ROI |

---

## 📁 โครงสร้าง Repository

```
claude-code-real-engineers/
├── book-factory/
│   └── chapters/          ← ไฟล์ Markdown ทุกบท (00–49)
│       ├── 00a_FrontMatter.md
│       ├── 00_Introduction.md
│       ├── 01_Chapter.md  ← บทที่ 1
│       ├── ...
│       ├── 47_Chapter.md  ← บทสุดท้าย
│       ├── 48_Glossary.md ← อภิธานศัพท์
│       └── 49_Index.md    ← ดัชนีค้นหา
├── OUTLINE.md             ← แผนผังเนื้อหาทั้งหมด 47 บท
├── STYLEGUIDE.md          ← มาตรฐานการเขียนหนังสือ
└── README.md              ← ไฟล์นี้
```

---

## 🚀 วิธีอ่าน

### สำหรับผู้อ่าน

ไฟล์ทั้งหมดเป็น Markdown อ่านได้โดยตรงบน GitHub หรือ Download มาอ่านใน VS Code / Obsidian

**แนะนำลำดับการอ่าน:**
- มือใหม่ Claude Code → เริ่มที่ `00_Introduction.md` → `01_Chapter.md` → ตามลำดับ
- ใช้ Anthropic API อยู่แล้ว → ข้ามไป `13_Chapter.md` (Volume 2)
- ต้องการ Enterprise Architecture → `30_Chapter.md` (Volume 3)
- ดูแล Production System → `43_Chapter.md` (Volume 4)

### สำหรับผู้ที่ต้องการรันโค้ด

โค้ดตัวอย่างในหนังสือใช้ TypeScript/Python ต้องมี:
- Node.js 20+
- Python 3.11+ (บางบท)
- `ANTHROPIC_API_KEY` ใน `.env`

```bash
# สร้าง .env จาก template
cp .env.example .env
# ใส่ ANTHROPIC_API_KEY ของคุณ
```

> ⚠️ **ห้ามฝัง API Key ในโค้ดโดยตรงเด็ดขาด** — ดูบทที่ 2 สำหรับวิธีจัดการ Secrets อย่างปลอดภัย

---

## 📜 License

**เนื้อหาหนังสือ** (ไฟล์ `.md` ใน `book-factory/chapters/`) เผยแพร่ภายใต้:
[Creative Commons Attribution-NonCommercial-NoDerivatives 4.0 International](https://creativecommons.org/licenses/by-nc-nd/4.0/)

- ✅ อ่านได้ แชร์ได้ โดยต้องระบุแหล่งที่มา
- ❌ ห้ามนำไปขาย หรือดัดแปลงเพื่อจำหน่าย

**โค้ดตัวอย่าง** ในหนังสือเผยแพร่ภายใต้ **MIT License** — นำไปใช้ในโปรเจกต์เชิงพาณิชย์ได้

---

## 🔗 ลิงก์สำคัญ

- [Anthropic API Docs](https://docs.anthropic.com)
- [Claude Code Documentation](https://docs.anthropic.com/claude-code)
- [Glossary (Wiki)](https://github.com/tksoft11/claude-code-real-engineers/wiki/glossary)

---

*สร้างด้วย ❤️ และ Claude Code — สำหรับ Engineer ที่อยากให้ AI ทำงานแทน ไม่ใช่แค่ช่วยพิมพ์*
