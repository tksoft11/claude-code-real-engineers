# บทที่ 31: สร้าง MCP Server ของตัวเอง — Internal Tools ที่ Claude ใช้ได้ทันที

---

## 🪝 เมื่อ Off-the-Shelf ไม่ตอบโจทย์

หลังจากเอกติดตั้ง GitHub MCP, Postgres MCP, และ Filesystem MCP แล้ว CTO เดินมาถาม:

> "Claude ขอข้อมูลพนักงานจาก HR System ได้ไหม? หรือดู project status จาก PM tool ของเราได้ไหม?"

เอกตรวจดู MCP marketplace — ไม่มี

ระบบ HR และ PM ที่บริษัทใช้เป็น on-premise legacy systems ที่มีแค่ REST API ภายในองค์กร ไม่มีใคร build MCP Server ให้

**ทางออก:** สร้าง Custom MCP Server ที่ wrap internal APIs เหล่านั้น

ใน 1 ชั่วโมง เอกมี Company MCP Server ที่ Claude ใช้ query HR, PM, และ Company Docs ได้ทันที

---

## 🏗️ Structure ของ Custom MCP Server

```
company-mcp/
├── src/
│   ├── index.ts          ← Entry point + server setup
│   ├── tools/
│   │   ├── hr.tools.ts   ← HR System tools
│   │   ├── pm.tools.ts   ← Project Management tools
│   │   └── docs.tools.ts ← Internal Docs tools
│   ├── resources/
│   │   └── policies.ts   ← Company policies as resources
│   ├── prompts/
│   │   └── templates.ts  ← Reusable prompt templates
│   └── utils/
│       ├── api-client.ts ← Axios wrapper with auth
│       └── sanitizer.ts  ← Strip sensitive fields
├── package.json
├── tsconfig.json
└── .env
```

---

## 📦 Setup

```bash
mkdir company-mcp && cd company-mcp
npm init -y
npm install @modelcontextprotocol/sdk axios zod dotenv
npm install -D typescript ts-node @types/node

cat > tsconfig.json << 'EOF'
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "commonjs",
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true
  }
}
EOF
```

```env
# .env
HR_API_URL=https://hr.company.internal/api
HR_API_KEY=hr-service-account-key

PM_API_URL=https://pm.company.internal/api
PM_API_KEY=pm-service-account-key

DOCS_API_URL=https://docs.company.internal/api
DOCS_API_KEY=docs-service-account-key
```

---

## 🔧 API Client Utility

```typescript
// src/utils/api-client.ts
import axios, { AxiosInstance } from 'axios';

export function createApiClient(baseURL: string, apiKey: string): AxiosInstance {
  const client = axios.create({
    baseURL,
    timeout: 10000,
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
  });

  // Retry on network errors
  client.interceptors.response.use(
    res => res,
    async err => {
      if (err.code === 'ECONNABORTED' || err.response?.status >= 500) {
        // Simple retry once
        await new Promise(r => setTimeout(r, 1000));
        return client.request(err.config);
      }
      throw err;
    }
  );

  return client;
}

// PII Sanitizer — ลบข้อมูลที่ไม่ควรส่งให้ AI
export function sanitize<T extends Record<string, unknown>>(
  data: T,
  sensitiveFields: string[] = ['salary', 'bankAccount', 'taxId', 'password', 'ssn']
): Partial<T> {
  const result = { ...data };
  for (const field of sensitiveFields) {
    delete result[field];
  }
  return result;
}
```

---

## 🛠️ HR Tools

```typescript
// src/tools/hr.tools.ts
import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { createApiClient, sanitize } from '../utils/api-client';

const hrApi = createApiClient(
  process.env.HR_API_URL!,
  process.env.HR_API_KEY!
);

export const hrToolDefinitions: Tool[] = [
  {
    name: 'get_employee_info',
    description: 'ดูข้อมูลพนักงานจาก HR System ข้อมูล salary และข้อมูล financial จะถูกซ่อน',
    inputSchema: {
      type: 'object',
      properties: {
        employeeId: {
          type: 'string',
          description: 'Employee ID เช่น EMP-001 หรือ email address',
        },
      },
      required: ['employeeId'],
    },
  },
  {
    name: 'search_employees',
    description: 'ค้นหาพนักงานตามชื่อ แผนก หรือ role',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'ชื่อ แผนก หรือ role ที่ต้องการค้นหา' },
        department: { type: 'string', description: 'กรอง department (optional)' },
        limit: { type: 'number', description: 'จำนวนผลลัพธ์สูงสุด (default: 10)' },
      },
      required: ['query'],
    },
  },
  {
    name: 'get_org_chart',
    description: 'ดูโครงสร้างองค์กรของ department หรือ team',
    inputSchema: {
      type: 'object',
      properties: {
        department: { type: 'string', description: 'ชื่อ department' },
        depth: { type: 'number', description: 'ความลึกของ hierarchy (1-3, default: 2)' },
      },
      required: ['department'],
    },
  },
  {
    name: 'check_leave_balance',
    description: 'ตรวจสอบวันลาคงเหลือของพนักงาน',
    inputSchema: {
      type: 'object',
      properties: {
        employeeId: { type: 'string' },
        year: { type: 'number', description: 'ปี พ.ศ. (default: ปีปัจจุบัน)' },
      },
      required: ['employeeId'],
    },
  },
];

export async function executeHRTool(
  name: string,
  args: Record<string, unknown>
): Promise<string> {
  switch (name) {
    case 'get_employee_info': {
      const { employeeId } = args as { employeeId: string };

      // ค้นหาด้วย email หรือ ID
      const endpoint = employeeId.includes('@')
        ? `/employees?email=${encodeURIComponent(employeeId)}`
        : `/employees/${employeeId}`;

      const res = await hrApi.get(endpoint);
      const data = Array.isArray(res.data) ? res.data[0] : res.data;

      if (!data) return `ไม่พบพนักงาน: ${employeeId}`;

      // Sanitize ก่อนส่งให้ Claude
      const safe = sanitize(data, ['salary', 'bankAccount', 'taxId', 'nationalId']);
      return JSON.stringify(safe, null, 2);
    }

    case 'search_employees': {
      const { query, department, limit = 10 } = args as {
        query: string; department?: string; limit?: number;
      };

      const params = new URLSearchParams({ q: query, limit: String(limit) });
      if (department) params.set('department', department);

      const res = await hrApi.get(`/employees/search?${params}`);
      const employees = res.data.results || res.data;

      // ส่งเฉพาะ basic info ไม่มี sensitive fields
      const safeList = employees.map((e: Record<string, unknown>) => sanitize(e, [
        'salary', 'bankAccount', 'taxId', 'nationalId', 'emergencyContact'
      ]));

      return `พบ ${safeList.length} คน:\n${JSON.stringify(safeList, null, 2)}`;
    }

    case 'get_org_chart': {
      const { department, depth = 2 } = args as { department: string; depth?: number };
      const safeDepth = Math.min(depth, 3); // จำกัดไม่เกิน 3 ระดับ

      const res = await hrApi.get(
        `/org-chart/${encodeURIComponent(department)}?depth=${safeDepth}`
      );
      return JSON.stringify(res.data, null, 2);
    }

    case 'check_leave_balance': {
      const { employeeId, year = new Date().getFullYear() } = args as {
        employeeId: string; year?: number;
      };
      const res = await hrApi.get(`/employees/${employeeId}/leave-balance?year=${year}`);
      return JSON.stringify(res.data, null, 2);
    }

    default:
      throw new Error(`Unknown HR tool: ${name}`);
  }
}
```

---

## 📋 PM Tools

```typescript
// src/tools/pm.tools.ts
import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { createApiClient } from '../utils/api-client';

const pmApi = createApiClient(process.env.PM_API_URL!, process.env.PM_API_KEY!);

export const pmToolDefinitions: Tool[] = [
  {
    name: 'get_project_status',
    description: 'ดู status, timeline, และ progress ของ project',
    inputSchema: {
      type: 'object',
      properties: {
        projectId: { type: 'string', description: 'Project ID หรือ project code' },
      },
      required: ['projectId'],
    },
  },
  {
    name: 'list_my_tasks',
    description: 'ดู tasks ที่ assign ให้พนักงานคนหนึ่ง',
    inputSchema: {
      type: 'object',
      properties: {
        employeeId: { type: 'string' },
        status: {
          type: 'string',
          enum: ['all', 'open', 'in_progress', 'completed', 'overdue'],
          description: 'กรอง status (default: open)',
        },
      },
      required: ['employeeId'],
    },
  },
  {
    name: 'get_sprint_summary',
    description: 'ดูภาพรวม sprint ปัจจุบัน: velocity, burndown, blockers',
    inputSchema: {
      type: 'object',
      properties: {
        teamId: { type: 'string', description: 'Team ID' },
      },
      required: ['teamId'],
    },
  },
];

export async function executePMTool(
  name: string,
  args: Record<string, unknown>
): Promise<string> {
  switch (name) {
    case 'get_project_status': {
      const { projectId } = args as { projectId: string };
      const res = await pmApi.get(`/projects/${projectId}`);
      return JSON.stringify(res.data, null, 2);
    }
    case 'list_my_tasks': {
      const { employeeId, status = 'open' } = args as { employeeId: string; status?: string };
      const res = await pmApi.get(`/tasks?assignee=${employeeId}&status=${status}`);
      return JSON.stringify(res.data, null, 2);
    }
    case 'get_sprint_summary': {
      const { teamId } = args as { teamId: string };
      const res = await pmApi.get(`/teams/${teamId}/sprint/current`);
      return JSON.stringify(res.data, null, 2);
    }
    default:
      throw new Error(`Unknown PM tool: ${name}`);
  }
}
```

---

## 📄 Resources: Company Policies

```typescript
// src/resources/policies.ts
import { Resource } from '@modelcontextprotocol/sdk/types.js';
import { createApiClient } from '../utils/api-client';
import fs from 'fs';
import path from 'path';

const docsApi = createApiClient(process.env.DOCS_API_URL!, process.env.DOCS_API_KEY!);

export const companyResources: Resource[] = [
  {
    uri: 'company://policies/leave',
    name: 'Leave Policy',
    description: 'นโยบายการลาพักร้อน ลาป่วย และลากิจ',
    mimeType: 'text/markdown',
  },
  {
    uri: 'company://policies/it-security',
    name: 'IT Security Policy',
    description: 'นโยบาย IT Security และการใช้งานอุปกรณ์',
    mimeType: 'text/markdown',
  },
  {
    uri: 'company://org/structure',
    name: 'Organization Structure',
    description: 'โครงสร้างองค์กรและ reporting lines ทั้งหมด',
    mimeType: 'application/json',
  },
];

export async function readResource(uri: string): Promise<string> {
  if (uri === 'company://policies/leave') {
    const res = await docsApi.get('/policies/leave');
    return res.data.content || res.data;
  }
  if (uri === 'company://policies/it-security') {
    const res = await docsApi.get('/policies/it-security');
    return res.data.content || res.data;
  }
  if (uri === 'company://org/structure') {
    const res = await docsApi.get('/org/structure');
    return JSON.stringify(res.data, null, 2);
  }
  throw new Error(`Resource not found: ${uri}`);
}
```

---

## 📝 Prompt Templates

```typescript
// src/prompts/templates.ts
import { Prompt } from '@modelcontextprotocol/sdk/types.js';

export const companyPrompts: Prompt[] = [
  {
    name: 'write-incident-report',
    description: 'เขียน Incident Report ตาม format มาตรฐาน ISO บริษัท',
    arguments: [
      { name: 'incident', description: 'คำอธิบาย incident', required: true },
      { name: 'impact', description: 'ผลกระทบที่เกิดขึ้น', required: true },
      { name: 'duration', description: 'ระยะเวลาที่เกิด incident', required: false },
    ],
  },
  {
    name: 'weekly-status-report',
    description: 'สร้าง Weekly Status Report สำหรับส่ง management',
    arguments: [
      { name: 'teamId', description: 'Team ID', required: true },
      { name: 'week', description: 'สัปดาห์ที่ (YYYY-WW)', required: false },
    ],
  },
  {
    name: 'onboarding-checklist',
    description: 'สร้าง onboarding checklist สำหรับพนักงานใหม่',
    arguments: [
      { name: 'role', description: 'ตำแหน่งงาน', required: true },
      { name: 'department', description: 'แผนก', required: true },
    ],
  },
];

export function getPromptMessages(name: string, args: Record<string, string> = []) {
  if (name === 'write-incident-report') {
    return [{
      role: 'user' as const,
      content: {
        type: 'text' as const,
        text: `เขียน Incident Report ตาม format มาตรฐาน:

**Incident:** ${args['incident']}
**ผลกระทบ:** ${args['impact']}
**ระยะเวลา:** ${args['duration'] || 'ไม่ระบุ'}

Format ที่ต้องการ:
## Executive Summary
(2-3 ประโยค สำหรับ management อ่าน)

## Timeline of Events
(bullet points เรียงตามเวลา)

## Root Cause Analysis  
(5 Whys หรือ Fishbone)

## Immediate Actions Taken
(สิ่งที่ทำแก้ไขทันที)

## Preventive Measures
(อย่างน้อย 3 ข้อ เพื่อป้องกันซ้ำ)

## Lessons Learned`,
      },
    }];
  }

  if (name === 'weekly-status-report') {
    return [{
      role: 'user' as const,
      content: {
        type: 'text' as const,
        text: `สร้าง Weekly Status Report สำหรับ Team ${args['teamId']} สัปดาห์ ${args['week'] || 'ปัจจุบัน'}

ก่อนเขียน ให้ดึงข้อมูลจาก PM system:
1. ใช้ get_sprint_summary เพื่อดู velocity และ progress
2. ใช้ list_my_tasks เพื่อดู completed tasks

จากนั้นเขียน report ในรูปแบบ:
## Week Summary
## Completed This Week
## In Progress
## Blockers & Risks
## Next Week Plan`,
      },
    }];
  }

  throw new Error(`Prompt not found: ${name}`);
}
```

---

## 🚀 Main Server: รวม Tools + Resources + Prompts

```typescript
// src/index.ts
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
  ListPromptsRequestSchema,
  GetPromptRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import 'dotenv/config';

import { hrToolDefinitions, executeHRTool } from './tools/hr.tools';
import { pmToolDefinitions, executePMTool } from './tools/pm.tools';
import { companyResources, readResource } from './resources/policies';
import { companyPrompts, getPromptMessages } from './prompts/templates';

// ── Server Instance ──────────────────────────────────
const server = new Server(
  {
    name: 'company-internal-tools',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
      resources: {},
      prompts: {},
    },
  }
);

// ── Tools ────────────────────────────────────────────
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [...hrToolDefinitions, ...pmToolDefinitions],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  const typedArgs = (args || {}) as Record<string, unknown>;

  console.error(`[Tool Call] ${name}`, JSON.stringify(typedArgs).slice(0, 100));

  try {
    // Route ไปยัง executor ที่เหมาะสม
    const hrToolNames = hrToolDefinitions.map(t => t.name);
    const pmToolNames = pmToolDefinitions.map(t => t.name);

    let result: string;

    if (hrToolNames.includes(name)) {
      result = await executeHRTool(name, typedArgs);
    } else if (pmToolNames.includes(name)) {
      result = await executePMTool(name, typedArgs);
    } else {
      throw new Error(`Tool not found: ${name}`);
    }

    return { content: [{ type: 'text', text: result }] };

  } catch (error: any) {
    console.error(`[Tool Error] ${name}:`, error.message);
    return {
      content: [{ type: 'text', text: `Error: ${error.message}` }],
      isError: true,
    };
  }
});

// ── Resources ────────────────────────────────────────
server.setRequestHandler(ListResourcesRequestSchema, async () => ({
  resources: companyResources,
}));

server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  const { uri } = request.params;
  console.error(`[Resource Read] ${uri}`);

  try {
    const content = await readResource(uri);
    const resource = companyResources.find(r => r.uri === uri);

    return {
      contents: [{
        uri,
        mimeType: resource?.mimeType || 'text/plain',
        text: content,
      }],
    };
  } catch (error: any) {
    throw new Error(`Cannot read resource ${uri}: ${error.message}`);
  }
});

// ── Prompts ──────────────────────────────────────────
server.setRequestHandler(ListPromptsRequestSchema, async () => ({
  prompts: companyPrompts,
}));

server.setRequestHandler(GetPromptRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  console.error(`[Prompt Get] ${name}`);

  const messages = getPromptMessages(name, args as Record<string, string>);
  return { messages };
});

// ── Start ────────────────────────────────────────────
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('✅ Company Internal Tools MCP Server started');
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
```

---

## 🔧 Build และ Config

```bash
# Build
npx tsc

# ทดสอบก่อน config Claude
echo '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}' | node dist/index.js

# ดูผล:
# {"jsonrpc":"2.0","id":1,"result":{"tools":[
#   {"name":"get_employee_info",...},
#   {"name":"search_employees",...},
#   ...
# ]}}
```

```json
// ~/.claude/settings.json — เพิ่ม company MCP Server
{
  "mcpServers": {
    "company-tools": {
      "command": "node",
      "args": ["/Users/username/company-mcp/dist/index.js"],
      "env": {
        "HR_API_URL": "https://hr.company.internal/api",
        "HR_API_KEY": "your-hr-service-account-key",
        "PM_API_URL": "https://pm.company.internal/api",
        "PM_API_KEY": "your-pm-key",
        "DOCS_API_URL": "https://docs.company.internal/api",
        "DOCS_API_KEY": "your-docs-key"
      }
    }
  }
}
```

---

## 🎯 ทดสอบใน Claude Code

```bash
claude
```

```
คุณ: "ดูข้อมูลพนักงาน EMP-042"
→ Claude เรียก get_employee_info → ได้ข้อมูล (ไม่มี salary)

คุณ: "หาพนักงานทุกคนในแผนก Engineering"
→ Claude เรียก search_employees { department: "Engineering" }

คุณ: "ดู sprint ปัจจุบันของ Team Alpha มีอะไร block อยู่บ้าง?"
→ Claude เรียก get_sprint_summary { teamId: "team-alpha" }

คุณ: "/write-incident-report"
→ Claude ใช้ prompt template → เขียน Incident Report มาตรฐาน
```

---

## 🛡️ Security Patterns สำคัญ

```typescript
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
```

---

## 🎯 สรุปบทที่ 31

| Component | สิ่งที่สร้าง |
|-----------|------------|
| HR Tools | get_employee_info, search_employees, get_org_chart, check_leave_balance |
| PM Tools | get_project_status, list_my_tasks, get_sprint_summary |
| Resources | Company policies เป็น passive data |
| Prompts | Incident Report, Weekly Status, Onboarding Checklist templates |
| Security | sanitize() + input validation + rate limiting |

**กุญแจสำคัญ:** MCP Server ทำหน้าที่เป็น **Security Gateway** — Claude ไม่เคยเห็น raw API credentials หรือ sensitive fields โดยตรง

---

## 📋 Action Items ก่อนไปบทที่ 32

- [ ] สร้าง `company-mcp` project ด้วย setup ในบทนี้
- [ ] เชื่อม API จริงของบริษัท (เริ่มจาก read-only tools ก่อน)
- [ ] Implement `sanitize()` สำหรับทุก tool ที่คืน user data
- [ ] ทดสอบแต่ละ tool โดยตรงผ่าน JSON-RPC ก่อน config Claude
- [ ] เพิ่ม logging ทุก tool call เพื่อ audit trail

---

*ใน **บทที่ 32** เราจะเพิ่ม RBAC Layer เข้าไปใน MCP Server — กำหนดว่า Developer ใช้ tool ไหนได้บ้าง, Tech Lead ได้อะไรเพิ่ม, และ DevOps มี privileges อะไรพิเศษ พร้อม Audit Log ทุก action ครับ*
