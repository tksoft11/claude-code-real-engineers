# บทที่ 30: Model Context Protocol (MCP) 101 — มาตรฐานใหม่ของ AI Integration

---

## 🪝 6 Bots ที่เขียนโค้ดซ้ำกัน 80%

ปลายปี 2025 — นายเอกวิศวกร AI ของบริษัท SaaS แห่งหนึ่ง ได้รับ request ให้สร้าง AI assistants สำหรับทีมต่างๆ ในองค์กร:

**สัปดาห์ที่ 1:** สร้าง Jira Bot ให้ทีม Engineering  
**สัปดาห์ที่ 2:** สร้าง Slack Bot ให้ทีม Customer Success  
**สัปดาห์ที่ 3:** สร้าง GitHub Bot ให้ทีม DevOps  
**สัปดาห์ที่ 4:** สร้าง Database Bot ให้ทีม Analytics  
**สัปดาห์ที่ 5:** สร้าง Calendar Bot ให้ทีม Operations  
**สัปดาห์ที่ 6:** สร้าง Docs Bot ให้ทีม Product  

หลังเสร็จ 6 Bot เอกนั่ง review code ทั้งหมด แล้วพบว่า:

```
Jira Bot:      authentication: 45 lines, error handling: 38 lines, tool parsing: 52 lines
Slack Bot:     authentication: 41 lines, error handling: 35 lines, tool parsing: 49 lines
GitHub Bot:    authentication: 48 lines, error handling: 40 lines, tool parsing: 55 lines
Database Bot:  authentication: 39 lines, error handling: 33 lines, tool parsing: 47 lines
Calendar Bot:  authentication: 43 lines, error handling: 36 lines, tool parsing: 51 lines
Docs Bot:      authentication: 44 lines, error handling: 37 lines, tool parsing: 50 lines

รวมโค้ดที่เขียนซ้ำ: ~650 lines
รวมโค้ดที่เขียนซ้ำ แต่ต่างกันเล็กน้อย: อีก ~400 lines
```

เอกใช้เวลา **6 สัปดาห์** ทำงานที่น่าจะทำเสร็จใน **2 สัปดาห์**

ถ้าเขารู้จัก **Model Context Protocol (MCP)** ตั้งแต่ต้น เขาจะสร้าง MCP Server 1 ตัว แล้ว Claude ใช้ได้ทั้ง 6 integration โดยไม่ต้องเขียน authentication หรือ tool parsing ซ้ำแม้แต่ครั้งเดียว

---

## 🧠 MCP คืออะไรกันแน่

**Model Context Protocol (MCP)** คือ open protocol ที่ Anthropic สร้างและ open source ในปี 2024 เพื่อแก้ปัญหา "integration chaos" ที่เอกเจอ

ก่อนจะอธิบายว่า MCP ทำอะไร ขอเปรียบเทียบก่อน:

```
ยุคก่อน USB:
คอมพิวเตอร์แต่ละยี่ห้อมี port ของตัวเอง
Printer port, Serial port, Parallel port...
อยากต่อเมาส์? ต้องรู้ว่า port ไหน driver อะไร

ยุค USB:
มาตรฐานเดียว → อุปกรณ์ทุกชิ้นทำงานได้ทันที
ผู้ผลิตอุปกรณ์ implement USB → ใช้กับทุกคอมได้เลย

MCP คือ "USB สำหรับ AI":
ก่อน MCP:  ทุก AI tool เขียน integration ของตัวเอง
หลัง MCP:  Implement MCP Protocol → AI ทุกตัวที่ support MCP ใช้ได้ทันที
```

---

## 🏛️ Architecture ของ MCP

MCP มี 3 ส่วนหลักที่ทำงานร่วมกัน:

```
┌─────────────────────────────────────────────────────────────────┐
│                        MCP ECOSYSTEM                           │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                    MCP HOST                             │   │
│  │  (Claude Desktop, Claude Code, หรือ Application ของคุณ) │   │
│  │                                                         │   │
│  │   ┌─────────────────────────────────────────────────┐  │   │
│  │   │                 MCP CLIENT                      │  │   │
│  │   │  (built-in ใน Host — จัดการ connection ทั้งหมด) │  │   │
│  │   └────────────────────────┬────────────────────────┘  │   │
│  └────────────────────────────┼────────────────────────────┘   │
│                               │ MCP Protocol (JSON-RPC 2.0)    │
│              ┌────────────────┼────────────────┐               │
│              │                │                │               │
│   ┌──────────▼────┐  ┌────────▼───────┐  ┌────▼────────────┐  │
│   │  Jira MCP     │  │  GitHub MCP    │  │  Custom MCP     │  │
│   │  Server       │  │  Server        │  │  Server         │  │
│   │               │  │                │  │  (ที่เราสร้าง)  │  │
│   └───────────────┘  └────────────────┘  └─────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

**Host** คือสิ่งที่ "ใช้" Claude — อาจเป็น Claude Desktop, Claude Code CLI, หรือ application ที่คุณสร้างเอง

**Client** คือ protocol client ที่ built-in อยู่ใน Host ทำหน้าที่คุย กับ MCP Servers

**Server** คือสิ่งที่เราสร้าง — expose capabilities ให้ Claude ใช้งาน

---

## 🎁 MCP Server Expose 3 สิ่ง

```
┌──────────────────────────────────────────────────────────────┐
│  1. TOOLS ← Claude เรียกใช้งานได้ (เหมือน Tool Use เดิม)    │
│     ตัวอย่าง: create_jira_ticket, search_database           │
│     Claude ตัดสินใจเองว่าจะเรียก tool ไหน เมื่อไหร่         │
│                                                              │
│  2. RESOURCES ← Claude อ่านข้อมูลได้แบบ passive             │
│     ตัวอย่าง: company://policies/hr, file:///path/to/doc    │
│     เหมือน file system หรือ RAG source ที่ Claude เข้าถึงได้│
│                                                              │
│  3. PROMPTS ← Template สำเร็จรูปที่ทีมใช้ร่วมกัน            │
│     ตัวอย่าง: /write-incident-report, /code-review          │
│     Share ทั้งทีมผ่าน MCP Server แทนที่จะ copy paste        │
└──────────────────────────────────────────────────────────────┘
```

---

## ⚡ MCP vs Tool Use — ต่างกันอย่างไร

```
Tool Use (แบบเดิม บทที่ 22):
─────────────────────────────────────────────────────────
1. คุณ define tools ใน code ของคุณทุกครั้ง
2. ทุก application ต้องเขียน tool definitions ใหม่
3. ไม่มี standardized transport หรือ discovery
4. Tight coupling กับ application

┌─────────────┐
│ Your App    │ ← กำหนด tools ใน code
│ + Claude    │ ← ใช้ tools ที่กำหนด
└─────────────┘

MCP:
─────────────────────────────────────────────────────────
1. Tools อยู่ใน MCP Server ที่แยกต่างหาก
2. Claude (ทุก Host) ค้นพบ tools อัตโนมัติผ่าน protocol
3. Standardized JSON-RPC transport
4. Loose coupling — เปลี่ยน Server โดยไม่ต้องแก้ App

┌─────────────┐    MCP Protocol    ┌──────────────┐
│ Claude Code │ ←────────────────→ │ Jira MCP     │
│ Claude App  │                    │ Server       │
│ Your App    │                    └──────────────┘
└─────────────┘
```

**เลือกอะไร?**
- งาน one-off, simple → Tool Use ยังดีอยู่
- Tools ที่ทีมใช้ร่วมกัน, หลาย applications → MCP
- Internal company tools ที่ต้องการ governance → MCP + RBAC

---

## 📦 MCP Ecosystem: ใช้ได้เลยโดยไม่ต้องสร้าง

Anthropic และ community ได้สร้าง MCP Servers พร้อมใช้:

```bash
# Official MCP Servers (Anthropic)
@modelcontextprotocol/server-filesystem    # อ่าน/เขียน local files
@modelcontextprotocol/server-github        # GitHub: repos, PRs, issues
@modelcontextprotocol/server-postgres      # Query PostgreSQL
@modelcontextprotocol/server-sqlite        # Query SQLite
@modelcontextprotocol/server-brave-search  # Web search ด้วย Brave
@modelcontextprotocol/server-slack         # Slack messages, channels

# Community MCP Servers
mcp-server-jira        # Jira: tickets, sprints, boards
mcp-server-notion      # Notion: pages, databases
mcp-server-linear      # Linear: issues, projects
mcp-server-figma       # Figma: design files, components
mcp-server-stripe      # Stripe: payments, customers
mcp-server-gmail       # Gmail: emails, drafts
```

---

## ⚙️ ใช้ MCP Server ใน Claude Code

### วิธีที่ 1: Config File

```json
// ~/.claude/settings.json
// หรือ .claude/settings.local.json (เฉพาะ project นี้)
{
  "mcpServers": {
    "filesystem": {
      "command": "npx",
      "args": [
        "-y",
        "@modelcontextprotocol/server-filesystem",
        "/Users/username/projects",
        "/Users/username/documents"
      ]
    },
    "github": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-github"],
      "env": {
        "GITHUB_PERSONAL_ACCESS_TOKEN": "ghp_your_token_here"
      }
    },
    "postgres": {
      "command": "npx",
      "args": [
        "-y",
        "@modelcontextprotocol/server-postgres",
        "postgresql://username:password@localhost:5432/mydb"
      ]
    },
    "slack": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-slack"],
      "env": {
        "SLACK_BOT_TOKEN": "xoxb-your-token",
        "SLACK_TEAM_ID": "T0XXXXXXX"
      }
    }
  }
}
```

```bash
# หลัง config แล้ว restart Claude Code
claude

# ตรวจว่า MCP servers โหลดสำเร็จ
# (Claude Code จะแสดง MCP connection status ตอนเปิด)
```

### วิธีที่ 2: Project-specific Config

```bash
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
```

---

## 🔬 ทดสอบ MCP Server โดยตรง

ก่อน config กับ Claude ลองทดสอบ Server โดยตรงก่อน:

```bash
# ทดสอบ filesystem MCP Server
echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"1.0"}}}' | \
  npx -y @modelcontextprotocol/server-filesystem /tmp

# ดู tools ที่มี
echo '{"jsonrpc":"2.0","id":2,"method":"tools/list","params":{}}' | \
  npx -y @modelcontextprotocol/server-filesystem /tmp
```

Output ที่ควรเห็น:
```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "result": {
    "tools": [
      {
        "name": "read_file",
        "description": "Read the complete contents of a file...",
        "inputSchema": { ... }
      },
      {
        "name": "write_file",
        "description": "Create a new file or overwrite...",
        "inputSchema": { ... }
      },
      ...
    ]
  }
}
```

---

## 💻 ใช้ MCP จาก Claude Code: ตัวอย่างจริง

เมื่อ config MCP Servers แล้ว ลองใช้กับ Claude Code:

### Filesystem MCP

```
claude

คุณ: "รายการไฟล์ทั้งหมดใน ~/projects/my-app/src/"
→ Claude ใช้ list_directory tool จาก filesystem MCP

คุณ: "อ่านไฟล์ package.json ให้หน่อย"
→ Claude ใช้ read_file tool

คุณ: "สร้างไฟล์ .env.example จากตัวแปรใน .env (ลบ values ออก)"
→ Claude อ่าน .env → สร้าง .env.example อัตโนมัติ
```

### GitHub MCP

```
คุณ: "PR ล่าสุด 5 อันของ repo นี้เป็นยังไงบ้าง?"
→ Claude เรียก list_pull_requests

คุณ: "มี issues ที่ label 'bug' และ open อยู่กี่อัน?"
→ Claude เรียก list_issues กับ filter

คุณ: "Draft PR สำหรับ feature branch นี้ให้หน่อย"
→ Claude สร้าง PR ผ่าน GitHub API
```

### Postgres MCP

```
คุณ: "ดู schema ของ table 'orders' หน่อย"
→ Claude query information_schema

คุณ: "ยอดขายรวมเดือนนี้เท่าไหร่?"
→ Claude เขียน SQL query ที่เหมาะสม

คุณ: "Top 10 customers ตาม total_spend"
→ Claude query + format ผลลัพธ์ให้อ่านง่าย
```

---

## 🔄 MCP Transport: stdio vs HTTP

```
Transport 1: stdio (ค่า default)
─────────────────────────────────────────────
+ ง่ายที่สุด รัน process แยกต่างหาก
+ Secure (ไม่เปิด port)
+ เหมาะกับ local tools

Host → spawn process → stdin/stdout → MCP Server

ตัวอย่าง config:
{
  "command": "node",
  "args": ["./my-server/dist/index.js"]
}

Transport 2: HTTP + SSE (สำหรับ remote/shared)
─────────────────────────────────────────────
+ หลาย clients ต่อได้พร้อมกัน
+ Deploy บน server แยก
+ เหมาะกับ team shared tools

Host → HTTP request → MCP Server (port 3001)

ตัวอย่าง config:
{
  "url": "http://mcp.company.internal:3001"
}
```

---

## 📡 MCP Protocol: JSON-RPC ที่ควรรู้

MCP ใช้ JSON-RPC 2.0 — format มาตรฐานที่เข้าใจง่าย:

```json
// Request จาก Client → Server
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "read_file",
    "arguments": {
      "path": "/tmp/hello.txt"
    }
  }
}

// Response จาก Server → Client
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "content": [
      {
        "type": "text",
        "text": "Hello, World!"
      }
    ]
  }
}
```

**Methods หลักที่ต้องรู้:**

```
initialize          ← Handshake ตอนเริ่มต้น
tools/list          ← ดู tools ทั้งหมดที่มี
tools/call          ← เรียก tool
resources/list      ← ดู resources ที่มี
resources/read      ← อ่าน resource
prompts/list        ← ดู prompt templates
prompts/get         ← ดึง prompt template
```

---

## 🎯 Killer Example: The Universal Dev Assistant

เมื่อ config filesystem + github + postgres MCP ร่วมกัน Claude กลายเป็น dev assistant ที่ "รู้ทุกอย่าง":

```
claude
# (มี filesystem + github + postgres MCP configured)

คุณ:
"ฉันกำลัง debug bug ใน payment service
อ่านไฟล์ src/services/payment.service.ts
แล้ว query database ดูว่า orders ที่ status='failed' ในช่วง 24 ชั่วโมงที่ผ่านมามีกี่อัน
และดู issues บน GitHub ที่ label 'payment' ที่ยังไม่ resolve
สรุปให้ฉันเห็นภาพรวมว่า bug นี้น่าจะอยู่ตรงไหน"
```

Claude จะ:
1. `read_file` → อ่าน payment.service.ts ผ่าน filesystem MCP
2. `query_database` → `SELECT count(*) FROM orders WHERE status='failed' AND created_at > NOW()-INTERVAL '24h'` ผ่าน postgres MCP
3. `list_issues` → filter label='payment', state='open' ผ่าน github MCP
4. วิเคราะห์ทั้ง 3 sources → ตอบ consolidated analysis

**ทั้งหมดนี้โดยไม่ต้องเขียน code เพิ่มแม้แต่บรรทัดเดียว** เพราะ MCP Server ทำงานแทนทั้งหมด

---

## 🌐 MCP ใน Application ของคุณ (ไม่ใช่แค่ Claude Code)

MCP ไม่ได้จำกัดแค่ Claude Code — คุณใช้ใน Node.js application ได้เลย:

```typescript
// ใช้ MCP Client ใน Node.js app ของคุณ
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { spawn } from 'child_process';

async function createMCPClient(serverCommand: string, args: string[]) {
  const transport = new StdioClientTransport({
    command: serverCommand,
    args,
  });

  const client = new Client(
    { name: 'my-app', version: '1.0.0' },
    { capabilities: {} }
  );

  await client.connect(transport);

  // ดู tools ที่มี
  const { tools } = await client.listTools();
  console.log('Available tools:', tools.map(t => t.name));

  return client;
}

// ใช้งาน
const fileClient = await createMCPClient('npx', [
  '-y', '@modelcontextprotocol/server-filesystem', '/tmp'
]);

// เรียก tool โดยตรง
const result = await fileClient.callTool({
  name: 'read_file',
  arguments: { path: '/tmp/data.json' },
});

console.log(result.content[0].text);
```

---

## 🔐 Security Considerations สำหรับ MCP

```markdown
# MCP Security Checklist

## Credential Management
✅ เก็บ API keys ใน environment variables ไม่ใช่ใน config
✅ ใช้ .claude/settings.local.json (ไม่ commit) สำหรับ credentials
✅ ใน team environment: ใช้ secrets manager (Vault, AWS SSM)

## Access Control
✅ filesystem MCP: ระบุเฉพาะ directories ที่ต้องการ
   ❌ ["/"]        ← อ่านได้ทั้งเครื่อง!
   ✅ ["/project/src", "/project/docs"]  ← จำกัดขอบเขต

✅ postgres MCP: ใช้ read-only user สำหรับ analytics
   CREATE USER mcp_readonly WITH PASSWORD 'secret';
   GRANT SELECT ON ALL TABLES IN SCHEMA public TO mcp_readonly;

✅ github MCP: ใช้ Fine-grained token เฉพาะ repo ที่ต้องการ
   ไม่ใช้ classic token ที่ access ทุก repo

## Network Security
✅ HTTP transport: ใช้ TLS + authentication
✅ stdio transport: จำกัด process ด้วย systemd/docker
```

---

## 📊 เปรียบเทียบ Setup Time

```
งาน: Connect Claude กับ Jira + GitHub + Slack + Postgres

แบบเดิม (Tool Use ทีละ app):
- เขียน Tool Definition:   ~2 ชั่วโมง × 4 integrations = 8 ชั่วโมง
- เขียน Tool Executor:     ~3 ชั่วโมง × 4 integrations = 12 ชั่วโมง
- Authentication handling: ~1 ชั่วโมง × 4 integrations = 4 ชั่วโมง
- Testing + debugging:     ~2 ชั่วโมง × 4 integrations = 8 ชั่วโมง
รวม: ~32 ชั่วโมง (4 วันทำการ)

แบบ MCP:
- ติดตั้ง 4 MCP packages: 10 นาที
- เพิ่ม config ใน settings.json: 15 นาที
- ทดสอบแต่ละ server: 30 นาที
รวม: ~1 ชั่วโมง

ประหยัด: 31 ชั่วโมง (97%)
```

---

## 🎯 สรุปบทที่ 30

| หัวข้อ | สาระสำคัญ |
|--------|----------|
| MCP คืออะไร | Open protocol มาตรฐาน — "USB สำหรับ AI integration" |
| 3 ส่วน | Host (ผู้ใช้) → Client (built-in) → Server (เราสร้าง) |
| 3 Capabilities | Tools (execute), Resources (read), Prompts (templates) |
| ต่างจาก Tool Use | Standardized, shared, discoverable, loose coupling |
| Official Servers | filesystem, github, postgres, slack — ใช้ได้เลย |
| Transport | stdio (local) หรือ HTTP (remote/team) |
| Security | จำกัด scope + read-only credentials + secrets management |
| Setup Time | 1 ชั่วโมง vs 32 ชั่วโมง = ประหยัด 97% |

---

## 📋 Action Items ก่อนไปบทที่ 31

- [ ] ติดตั้งและ config **filesystem MCP** ใน Claude Code ของคุณ
- [ ] ทดสอบ command: "list ไฟล์ใน ~/projects" แล้วดูว่า Claude ใช้ MCP tool
- [ ] ติดตั้ง **GitHub MCP** พร้อม fine-grained token
- [ ] ลอง query: "PR ล่าสุด 5 อันใน repo ปัจจุบัน"
- [ ] ถ้ามี PostgreSQL: ติดตั้ง **postgres MCP** แล้วลอง query schema
- [ ] สำรวจ MCP marketplace: [github.com/modelcontextprotocol/servers](https://github.com/modelcontextprotocol/servers)
- [ ] ระบุ internal tools 3 ชิ้นในบริษัทที่ต้องการ MCP integration (จะสร้างในบทที่ 31)

---

*ใน **บทที่ 31** เราจะสร้าง Custom MCP Server สำหรับ internal tools ของบริษัท — wrap HR API, PM System, และ Internal Docs ให้ Claude ใช้ได้ทันที พร้อม security filtering ที่ไม่ให้ข้อมูล sensitive รั่วไปถึง AI ครับ*
