# อภิธานศัพท์ (Glossary)
<!-- คำศัพท์เทคนิคที่ใช้ตลอดหนังสือ Claude Code for Real Engineers พร้อมคำอธิบายภาษาไทย -->

---

> คำศัพท์เรียงตามตัวอักษรภาษาอังกฤษ ตัวอักษรหนา (**คำศัพท์**) คือคำที่ใช้บ่อยที่สุดในหนังสือ

---

## A

**Agentic Loop** — วงจรที่ AI ทำงานซ้ำๆ อัตโนมัติโดยไม่ต้องให้คนกดทีละขั้น เช่น Plan → Execute → Verify → Loop เป็นหัวใจของ The Ralph Loop (ดูบทที่ 4)

**Agent Orchestration** — การประสานงานระหว่าง AI หลายตัวให้ทำงานเป็นทีม โดยมี Manager Agent กำหนดงาน และ Worker Agent ลงมือทำ (ดูบทที่ 34)

**Anthropic** — บริษัทที่พัฒนา Claude ก่อตั้งในปี 2021 โดยอดีตทีมจาก OpenAI เน้นความปลอดภัยและความน่าเชื่อถือของ AI

**API (Application Programming Interface)** — ช่องทางที่โปรแกรมสองตัวคุยกัน ในหนังสือนี้หมายถึง Anthropic API ที่ให้คุณเรียกใช้ Claude ผ่านโค้ด

**API Key** — รหัสลับสำหรับยืนยันตัวตนเมื่อเรียก API เปรียบเหมือนรหัสผ่านของโปรแกรม **ห้าม** ฝังในโค้ดโดยตรง ต้องเก็บใน `.env` เสมอ (ดูบทที่ 2)

**AsyncGenerator** — ฟังก์ชันใน JavaScript/TypeScript ที่ส่งค่าออกมาทีละตัวแบบ asynchronous ใช้กับ SSE Streaming (ดูบทที่ 15, 38)

---

## B

**Batch API** — การส่ง Request หลายรายการพร้อมกันในครั้งเดียว ช่วยลดต้นทุนได้สูงสุด 50% เหมาะสำหรับงานประมวลผลจำนวนมากที่ไม่ต้องการ Real-time Response (ดูบทที่ 17)

**Boilerplate** — โค้ดพื้นฐานที่ต้องมีในทุกโปรเจกต์ หนังสือเล่มนี้ให้ Boilerplate ที่ใช้งานได้จริงในทุกบท

---

## C

**CI/CD (Continuous Integration / Continuous Deployment)** — กระบวนการ Build, Test, และ Deploy โค้ดอัตโนมัติทุกครั้งที่มีการเปลี่ยนแปลง เครื่องมือหลักที่ใช้ในหนังสือ: GitHub Actions (ดูบทที่ 36)

**CLAUDE.md** — ไฟล์คัมภีร์ที่ Claude อ่านก่อนเริ่มงานทุกครั้ง บอก Tech Stack, Coding Standards, และข้อห้ามของโปรเจกต์ เปรียบเหมือน Onboarding Document สำหรับ AI (ดูบทที่ 3)

**Claude Code** — เครื่องมือ CLI ของ Anthropic ที่ให้ Claude ทำงานบนเครื่องคุณโดยตรง เข้าถึง File System, รัน Command, และทำ Git operations ได้

**Claude Haiku** — โมเดล Claude ที่เร็วที่สุดและราคาถูกที่สุด เหมาะสำหรับงานที่ต้องการ Response เร็ว เช่น Chatbot, Code Review อย่างรวดเร็ว

**Claude Sonnet** — โมเดล Claude ระดับกลาง สมดุลระหว่างความสามารถและราคา เหมาะสำหรับงาน Production ส่วนใหญ่

**Claude Opus** — โมเดล Claude ที่ฉลาดที่สุด เหมาะสำหรับงานที่ซับซ้อนมาก เช่น Architecture Review, Complex Reasoning

**Context Window** — ขนาดสูงสุดของข้อความที่ AI สามารถ "จำ" ได้ในการสนทนาหนึ่งครั้ง Claude มี Context Window สูงถึง 200,000 tokens (ดูบทที่ 6)

**Custom Commands** — คำสั่งลัดที่ผู้ใช้กำหนดเองใน Claude Code เพื่อทำงานซ้ำๆ ได้เร็วขึ้น (ดูบทที่ 5)

---

## D

**Datadog** — เครื่องมือ Monitoring และ Observability ระดับ Enterprise ใช้ติดตาม Metrics, Logs, และ Traces ของระบบ (ดูบทที่ 45)

**Definition of Done (DoD)** — เกณฑ์ที่กำหนดไว้ล่วงหน้าว่างานชิ้นหนึ่งถือว่า "เสร็จ" เมื่อไหร่ สำคัญมากสำหรับการสั่งงาน AI

---

## E

**.env** — ไฟล์ที่เก็บ Environment Variables รวมถึง API Keys ห้าม Commit ขึ้น Git โดยเด็ดขาด ต้องใส่ใน `.gitignore` เสมอ

**Environment Variables** — ค่าที่ตั้งไว้ใน Environment ของ OS หรือ Server ใช้เก็บข้อมูลลับเช่น API Keys โดยไม่ต้องฝังในโค้ด

---

## F

**Fallback** — กลยุทธ์สำรองเมื่อระบบหลักล้มเหลว เช่น ถ้า Claude Sonnet ล่ม ให้ Switch ไปใช้ Haiku แทนอัตโนมัติ (ดูบทที่ 44)

**Function Calling** — ความสามารถของ AI ในการเรียกใช้ Function ที่เราเตรียมไว้ ปัจจุบันในเอกสาร Anthropic เรียกว่า "Tool Use" (ดูบทที่ 22)

---

## G

**GitHub Actions** — บริการ CI/CD ของ GitHub รัน Workflow อัตโนมัติเมื่อมีการเปลี่ยนแปลงใน Repository ใช้มากในบทที่ 36, 42, 46

**Guardrails** — ระบบ/กฎที่ควบคุมพฤติกรรมของ AI ให้อยู่ในขอบเขตที่ปลอดภัย เช่น ห้ามลบ Database, ห้ามส่งอีเมลโดยไม่ได้รับอนุญาต (ดูบทที่ 2)

---

## H

**Hallucination** — ปรากฏการณ์ที่ AI "สร้าง" ข้อมูลที่ไม่มีจริงขึ้นมา เป็นเหตุผลหนึ่งที่ต้องมี Human-in-the-Loop และ Verification Step

**Human-in-the-Loop** — รูปแบบการทำงานที่มนุษย์ยังคงมีบทบาทในการตัดสินใจสำคัญ AI ทำงานช่วยแต่คนเป็นผู้อนุมัติขั้นสุดท้าย (ดูบทที่ 1, 4)

---

## J

**JWT (JSON Web Token)** — มาตรฐานการสร้าง Token สำหรับ Authentication ใช้ยืนยันตัวตนของ User ก่อนให้เข้าถึง AI API (ดูบทที่ 38)

**JSON Schema** — รูปแบบการกำหนดโครงสร้างของ JSON Data ใช้กับ Structured Outputs เพื่อบังคับให้ Claude ตอบในรูปแบบที่กำหนด (ดูบทที่ 20)

---

## L

**LangGraph** — Framework สำหรับสร้าง Multi-Agent Workflows ช่วยออกแบบการทำงานของ AI หลายตัวในรูปแบบ Graph (ดูบทที่ 34)

**Langfuse** — เครื่องมือ Open-Source สำหรับ LLM Observability บันทึก Prompt, Response, Token Count, Latency ทุก AI Call (ดูบทที่ 43)

**LangSmith** — เครื่องมือ Observability เชิงพาณิชย์จาก LangChain ทำงานคล้าย Langfuse แต่เน้น LangChain Ecosystem

**Latency** — ระยะเวลาที่ใช้ในการตอบสนอง ในบริบท AI คือเวลาตั้งแต่ส่ง Request จนได้รับ Response ครบ

**LLM (Large Language Model)** — โมเดล AI ขนาดใหญ่ที่เรียนรู้จากข้อความจำนวนมาก Claude, GPT-4, Gemini คือตัวอย่างของ LLM

---

## M

**MCP (Model Context Protocol)** — โปรโตคอลมาตรฐานที่ Anthropic พัฒนาขึ้นสำหรับการเชื่อมต่อ AI กับ Tools และ Data Sources ภายนอกอย่างปลอดภัย (ดูบทที่ 30, 31)

**MCP Server** — Server ที่ implement MCP Protocol ทำหน้าที่เป็นตัวกลางให้ AI เข้าถึง Resource ภายนอก เช่น Database, File System (ดูบทที่ 31)

**Model Routing** — กลยุทธ์การเลือกใช้ AI Model ที่เหมาะสมกับงานแต่ละประเภท เช่น ใช้ Haiku สำหรับงานง่าย, Sonnet สำหรับงานซับซ้อน (ดูบทที่ 16)

**MTTR (Mean Time To Resolution)** — เวลาเฉลี่ยที่ใช้ในการแก้ไขปัญหาหลังจากตรวจพบ ใช้วัดประสิทธิภาพของ On-Call System (ดูบทที่ 45)

---

## P

**PagerDuty** — แพลตฟอร์ม Incident Management ที่ส่ง Alert ไปยัง On-Call Engineer เมื่อระบบมีปัญหา (ดูบทที่ 45)

**PDPA (Personal Data Protection Act)** — พระราชบัญญัติคุ้มครองข้อมูลส่วนบุคคลของประเทศไทย มีผลต่อการออกแบบระบบ AI ที่จัดการข้อมูลผู้ใช้ (ดูบทที่ 21)

**Prompt** — ข้อความที่ส่งให้ AI เพื่อให้ทำงาน ครอบคลุมทั้ง System Prompt (คำสั่งพื้นฐาน) และ User Message (คำถามของผู้ใช้)

**Prompt Caching** — คุณสมบัติของ Anthropic API ที่ Cache System Prompt ไว้ ทำให้ Request ต่อไปไม่ต้องส่งซ้ำ ลดต้นทุนได้ถึง 90% (ดูบทที่ 17)

**Prompt Injection** — การโจมตีที่ผู้ไม่หวังดีแทรก Prompt อันตรายเข้าไปในระบบ เช่น พิมพ์ใน Chatbox ว่า "ลืมคำสั่งเดิมทั้งหมด ทำสิ่งนี้แทน" (ดูบทที่ 32)

---

## R

**RAG (Retrieval-Augmented Generation)** — เทคนิคที่ดึงข้อมูลจาก Knowledge Base มาใส่ใน Context ก่อนส่งให้ AI ตอบ ช่วยให้ AI รู้ข้อมูลเฉพาะทางที่ไม่ได้อยู่ใน Training Data (ดูบทที่ 25, 26)

**Ralph Loop** (หรือ The Ralph Loop) — กระบวนการทำงานแบบ Agentic ที่เป็นหัวใจของหนังสือเล่มนี้ ประกอบด้วย Plan → Execute → Verify ที่ AI รันซ้ำๆ โดยอัตโนมัติ ชื่อมาจาก Developer ที่สั่งงาน Claude ไว้ก่อนออกไปกินข้าวเที่ยง (ดูบทที่ 4)

**RBAC (Role-Based Access Control)** — ระบบควบคุมสิทธิ์ตาม Role ของผู้ใช้ ใช้จำกัดว่า Agent ไหนทำอะไรได้บ้าง (ดูบทที่ 33)

**ROI (Return on Investment)** — อัตราผลตอบแทนจากการลงทุน ในบริบทนี้คือการวัดว่าค่าใช้จ่าย AI ให้ผลตอบแทนคุ้มค่าหรือไม่ (ดูบทที่ 46)

**Runbook** — เอกสารขั้นตอนการแก้ไขปัญหาที่เกิดซ้ำๆ ใน Production ใช้เป็น Pre-approved Actions สำหรับ AI On-Call Bot (ดูบทที่ 45)

---

## S

**SSE (Server-Sent Events)** — โปรโตคอลที่ Server ส่งข้อมูลไปยัง Client แบบ Real-time ทางเดียว ใช้กับ Streaming Response ของ Claude (ดูบทที่ 15, 38)

**Streaming** — การส่ง Response ทีละส่วนแบบ Real-time แทนที่จะรอให้ครบแล้วส่งทีเดียว ทำให้ผู้ใช้เห็นตัวอักษรไหลออกมาทีละตัวเหมือน Claude.ai (ดูบทที่ 15)

**Structured Outputs** — ความสามารถของ Claude ในการตอบในรูปแบบ JSON ที่มีโครงสร้างตามที่กำหนด เช่น ตอบเป็น Object ที่มี Field ครบตามที่ต้องการ (ดูบทที่ 20)

**System Prompt** — คำสั่งพื้นฐานที่กำหนดบุคลิก ข้อจำกัด และพฤติกรรมของ AI ก่อนที่ User จะส่งคำถาม

---

## T

**TDD (Test-Driven Development)** — วิธีพัฒนาโปรแกรมที่เขียน Test ก่อน แล้วจึงเขียนโค้ดให้ Test ผ่าน ใช้ร่วมกับ AI ได้อย่างมีประสิทธิภาพมาก (ดูบทที่ 9)

**Telemetry** — การเก็บข้อมูลการทำงานของระบบอัตโนมัติ เช่น Latency, Error Rate, Token Usage ดูบทที่ 43 สำหรับการตั้ง Telemetry สำหรับระบบ AI

**Token** — หน่วยพื้นฐานที่ LLM ใช้ในการประมวลผลข้อความ โดยประมาณ 1 Token ≈ 0.75 คำภาษาอังกฤษ หรือ 1-2 พยางค์ภาษาไทย ราคา API คำนวณตาม Token

**Tool Use** — ความสามารถของ Claude ในการเรียกใช้ Functions/Tools ที่นักพัฒนาเตรียมไว้ เช่น ค้นหาข้อมูล, ส่งอีเมล, อ่าน Database (ดูบทที่ 22, 23)

---

## V

**Vector Database** — ฐานข้อมูลที่เก็บข้อมูลในรูปแบบ Embedding Vector เหมาะสำหรับการค้นหาความหมาย (Semantic Search) ใช้ใน RAG Pipeline (ดูบทที่ 25)

**Vibe Coding** — รูปแบบการใช้ AI ที่ถามแบบคลุมเครือ ก๊อปโค้ดที่ได้ไปรัน แล้วก๊อป Error กลับมาถามซ้ำๆ โดยไม่มีระบบหรือมาตรฐาน ตรงข้ามกับ AI Engineering (ดูบทที่ 1)

---

## W

**Webhook** — URL Endpoint ที่รับข้อมูลจาก Service ภายนอกแบบ Real-time เช่น PagerDuty ส่ง Alert มาที่ Webhook ของ AI On-Call Bot (ดูบทที่ 45)

**Worker Thread** — Thread แยกสำหรับรันงานหนัก ป้องกัน Main Thread ติดขัด ใช้ใน Self-Healing Scripts และ Background Jobs (ดูบทที่ 10)

---

## Z

**Zero-Shot** — การใช้ AI ทำงานโดยไม่ให้ตัวอย่าง ตรงข้ามกับ Few-Shot ที่ให้ตัวอย่าง 2-5 ชิ้นก่อน เพื่อ Guide พฤติกรรม AI

---

*ศัพท์เพิ่มเติมและอัปเดตล่าสุดอยู่ที่: https://github.com/tksoft11/claude-code-real-engineers/wiki/glossary*
