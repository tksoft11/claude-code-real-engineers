# The Book Factory: Skills & Standards

This file defines the strict procedures (Skills), Minimum Quality Standards (MQS), and Absolute Rules that the AI must follow to generate content.

## 📏 Minimum Quality Standard (MQS) for Every Chapter
1. **Length:** Minimum of 1,500 words (approx. 4-6 A4 pages).
2. **Mandatory Structure (4 Pillars):**
   - **The Hook & Analogy (20%)**
   - **The Core Mechanic (30%)**
   - **The Hands-On Execution (40%)**
   - **The Recap & Action Item (10%)**
3. **Density:** At least 1 code snippet, terminal command, or structural diagram per chapter.

---

## 🛑 Strict Content Rules (Quality Control)
Based on the team's review, these rules are **ABSOLUTE**. The Fact-Checker will immediately reject any draft that violates them:

1. **Rule of Pacing (Quick Wins):** Do not overwhelm the reader with dry theory. If a chapter contains heavy theory (like Guardrails or TypeScript), it MUST include a small, immediately actionable "Quick Win" or mini-example to keep the reader engaged.
2. **Rule of Relatability (Analogies First):** You MUST use everyday Thai analogies for technical terms. (e.g., "Progressive Disclosure" = "บอกทางแท็กซี่ทีละซอย", "Context Window" = "กระดานทดเลข").
3. **Rule of Clarity (No Naked Jargon):** If a term like "Vibe Coding", "LLM", or "Ralph Loop" is used for the first time, it MUST be defined in simple Thai within the exact same paragraph.
4. **Rule of Security (Production-Grade Safety):** NEVER, under any circumstances, show plain-text API keys, tokens, or passwords in code snippets. You MUST use and explain Environment Variables (`.env`) for any credentials. Teaching bad security practices is a critical failure.

---

## Skill: `/brainstorm-chapter`
**Goal:** Expand a single topic into a detailed chapter outline with an analogy.
**Actor:** 🏗️ The Architect

## Skill: `/draft-simple`
**Goal:** Write the chapter content based on the approved outline, using extremely simple language but deep technical coverage.
**Actor:** 🗣️ The Translator
**Constraints:** 
- MUST adhere to the MQS and the Strict Content Rules.
- 🚨 **ANTI-LAZINESS PROTOCOL:** You MUST NOT generate the entire chapter in one single prompt/pass. You must generate it **Section-by-Section**. For each section, you must dive deep into technical mechanisms, code examples, and edge cases before moving to the next section.
- Minimum 1,500 words per chapter enforced.

## Skill: `/jargon-check`
**Goal:** Ruthlessly audit a draft for confusing technical terms and poor pacing.
**Actor:** 🕵️‍♂️ The Jargon Buster
**Constraints:** Enforce Rule of Relatability and Rule of Clarity.

## Skill: `/verify-completeness`
**Goal:** Guarantee that the chapter contains absolutely every necessary technical detail, edge-case, and code snippet required to be "Production-Grade".
**Actor:** 🦉 The Fact-Checker
**Trigger:** User inputs `/verify-completeness [Source Material / PRD]`
**Steps:**
1. Check if the draft meets the MQS and the **Strict Content Rules**.
2. Specifically check Rule #4 (Security). If API keys are hardcoded, REJECT instantly (🚨).
3. Cross-reference every single point from the PRD.
4. Verify that any code snippets or Bash commands are 100% accurate and executable.
5. Only output "PASSED ✅" when the chapter is exhaustively complete.

## Skill: `/ralph-write`
**Goal:** Autonomous loop to write, review, and finalize a chapter.
**Actor:** All Agents
