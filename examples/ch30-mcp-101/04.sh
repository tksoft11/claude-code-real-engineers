# สร้าง config เฉพาะ project
mkdir -p .claude
cat > .claude/settings.local.json << 'EOF'
{
  "mcpServers": {
    "project-db": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-postgres",
               "postgresql://localhost:5432/project_dev"]
    }
  }
}
EOF

# commit เข้า git (ถ้าไม่มี secrets)
# หรือ .gitignore ถ้ามี credentials
