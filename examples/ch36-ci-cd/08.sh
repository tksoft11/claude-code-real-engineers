# สร้าง diff จาก branch ปัจจุบัน
git diff main...HEAD > test.diff

# ทดสอบโดยตรง
cd .github/scripts/ai-review
npm install
ANTHROPIC_API_KEY=sk-ant-... \
GITHUB_TOKEN=ghp_... \
PR_NUMBER=999 \
PR_TITLE="Fix payment bug" \
REPO=myorg/myrepo \
DIFF_PATH=./test.diff \
AI_MODEL=claude-haiku-4-5 \
npx ts-node index.ts

# ดูผล (ไม่ post จริง ถ้าไม่มี valid PR number)
cat /tmp/ai-review-result.json
