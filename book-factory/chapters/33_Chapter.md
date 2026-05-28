# บทที่ 33: Security & RBAC สำหรับ AI Systems — ใครใช้ Tool ไหนได้บ้าง

---

## 🪝 Junior Dev ที่ไม่ได้ตั้งใจลบข้อมูล Production

เดือนแรกที่ Company MCP Server ของเอก deploy ขึ้น production มีทีมใช้งาน 40 คน

Developer รุ่นใหม่ชื่อ "บี" กำลัง debug ปัญหา orders ที่หายไป เปิด Claude Code แล้วพิมพ์ว่า:

> "ลบ test orders ที่ status='failed' ออกจาก database ให้หน่อย เพื่อจะได้ดู query ผลลัพธ์ได้ชัดขึ้น"

Claude เข้าใจว่าบีต้องการทำความสะอาด test data — execute SQL DELETE ทันที

สิ่งที่บีไม่รู้: database ที่ Claude connect คือ **production** ไม่ใช่ dev

**ผลลัพธ์:** orders 2,847 รายการที่ status='failed' (รอ manual review โดย Finance) หายไปทั้งหมด ต้อง restore จาก backup และใช้เวลา 4 ชั่วโมงในการ reconcile

ปัญหาไม่ใช่ Claude หรือ MCP — ปัญหาคือ **ไม่มีระบบควบคุมว่าใครทำอะไรได้**

บี (Junior Developer) ควรอ่าน database ได้แต่ **ไม่ควรลบได้** โดยไม่มีคนอนุมัติ

---

## 🏛️ RBAC Framework สำหรับ AI Tools

**RBAC = Role-Based Access Control** คือหลักการว่า:

```
ทุก request → ผ่าน Permission Check ก่อนเสมอ

User → มี Role → Role มี Permissions → Permission กำหนดว่า Tool ไหนทำได้
```

### Permission Matrix ของบริษัท

```
┌─────────────────┬───────────────────────────────────────────────────┐
│   Role          │   Permissions                                     │
├─────────────────┼───────────────────────────────────────────────────┤
│ junior_dev      │ read: code, database(dev/staging)                 │
│                 │ write: code, jira                                 │
│                 │ ❌ delete: anything                                │
│                 │ ❌ access: production database                     │
├─────────────────┼───────────────────────────────────────────────────┤
│ senior_dev      │ + write: database(dev/staging)                    │
│                 │ + read: database(production)                      │
│                 │ ❌ delete: production data                         │
├─────────────────┼───────────────────────────────────────────────────┤
│ tech_lead       │ + write: database(production) [requires approval] │
│                 │ + admin: github, jira                             │
│                 │ ❌ delete: production data                         │
├─────────────────┼───────────────────────────────────────────────────┤
│ devops          │ + deploy: all environments                        │
│                 │ + write/delete: database [requires approval]      │
│                 │ + admin: infrastructure                           │
├─────────────────┼───────────────────────────────────────────────────┤
│ ai_readonly     │ read: everything (for analytics bots)             │
│                 │ ❌ write/delete: anything                          │
└─────────────────┴───────────────────────────────────────────────────┘
```

---

## 🔑 Permission System

```typescript
// src/rbac/types.ts
export type Resource =
  | 'code'
  | 'database'
  | 'jira'
  | 'slack'
  | 'github'
  | 'hr_system'
  | 'infrastructure';

export type Action = 'read' | 'write' | 'delete' | 'deploy' | 'admin';
export type Environment = 'dev' | 'staging' | 'production';

export interface Permission {
  resource: Resource;
  actions: Action[];
  environments?: Environment[]; // ถ้าไม่ระบุ = ทุก env
  requiresApproval?: boolean;
  approvalGroup?: string; // ใครต้อง approve
}

export interface Role {
  name: string;
  displayName: string;
  permissions: Permission[];
}

// Tool → Permission mapping
export interface ToolPermission {
  resource: Resource;
  action: Action;
  environmentKey?: string; // field ใน args ที่บอก environment
}
```

```typescript
// src/rbac/roles.ts
import { Role } from './types';

export const ROLES: Record<string, Role> = {
  junior_dev: {
    name: 'junior_dev',
    displayName: 'Junior Developer',
    permissions: [
      { resource: 'code',      actions: ['read', 'write'] },
      { resource: 'jira',      actions: ['read', 'write'] },
      { resource: 'github',    actions: ['read', 'write'] },
      { resource: 'database',  actions: ['read'], environments: ['dev', 'staging'] },
      { resource: 'hr_system', actions: ['read'] },
      { resource: 'slack',     actions: ['read', 'write'] },
    ],
  },

  senior_dev: {
    name: 'senior_dev',
    displayName: 'Senior Developer',
    permissions: [
      { resource: 'code',      actions: ['read', 'write', 'delete'] },
      { resource: 'jira',      actions: ['read', 'write', 'admin'] },
      { resource: 'github',    actions: ['read', 'write', 'admin'] },
      { resource: 'database',  actions: ['read', 'write'], environments: ['dev', 'staging'] },
      { resource: 'database',  actions: ['read'], environments: ['production'] },
      { resource: 'hr_system', actions: ['read'] },
      { resource: 'slack',     actions: ['read', 'write'] },
    ],
  },

  tech_lead: {
    name: 'tech_lead',
    displayName: 'Tech Lead',
    permissions: [
      { resource: 'code',      actions: ['read', 'write', 'delete', 'admin'] },
      { resource: 'jira',      actions: ['read', 'write', 'delete', 'admin'] },
      { resource: 'github',    actions: ['read', 'write', 'delete', 'admin'] },
      { resource: 'database',  actions: ['read', 'write'], environments: ['dev', 'staging'] },
      {
        resource: 'database',
        actions: ['read', 'write'],
        environments: ['production'],
        requiresApproval: true,
        approvalGroup: 'cto',
      },
      { resource: 'hr_system', actions: ['read', 'write'] },
      { resource: 'slack',     actions: ['read', 'write', 'admin'] },
    ],
  },

  devops: {
    name: 'devops',
    displayName: 'DevOps Engineer',
    permissions: [
      { resource: 'code',           actions: ['read', 'write'] },
      { resource: 'infrastructure', actions: ['read', 'write', 'deploy'] },
      { resource: 'database',       actions: ['read', 'write', 'delete'], requiresApproval: true, approvalGroup: 'tech_lead' },
      { resource: 'github',         actions: ['read', 'write', 'admin'] },
    ],
  },

  ai_readonly: {
    name: 'ai_readonly',
    displayName: 'AI Read-Only Bot',
    permissions: [
      { resource: 'code',      actions: ['read'] },
      { resource: 'database',  actions: ['read'], environments: ['production'] },
      { resource: 'jira',      actions: ['read'] },
      { resource: 'hr_system', actions: ['read'] },
    ],
  },
};
```

---

## 🛡️ Permission Checker

```typescript
// src/rbac/checker.ts
import { ROLES } from './roles';
import { Action, Environment, Resource } from './types';

export interface CheckResult {
  allowed: boolean;
  requiresApproval: boolean;
  approvalGroup?: string;
  reason?: string;
}

export function checkPermission(
  roleName: string,
  resource: Resource,
  action: Action,
  environment?: Environment
): CheckResult {
  const role = ROLES[roleName];

  if (!role) {
    return {
      allowed: false,
      requiresApproval: false,
      reason: `Unknown role: "${roleName}"`,
    };
  }

  // หา permission ที่ match
  const match = role.permissions.find(p => {
    if (p.resource !== resource) return false;
    if (!p.actions.includes(action)) return false;
    // ถ้า permission ไม่ระบุ environments = ทุก environment
    if (p.environments && environment && !p.environments.includes(environment)) return false;
    return true;
  });

  if (!match) {
    return {
      allowed: false,
      requiresApproval: false,
      reason: `Role "${role.displayName}" cannot ${action} ${resource}${environment ? ` in ${environment}` : ''}`,
    };
  }

  return {
    allowed: true,
    requiresApproval: match.requiresApproval || false,
    approvalGroup: match.approvalGroup,
  };
}
```

---

## 📋 Audit Logger

```typescript
// src/rbac/audit.ts
import fs from 'fs';
import path from 'path';

export type AuditAction = 'ALLOWED' | 'DENIED' | 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED';

export interface AuditEntry {
  timestamp: string;
  userId: string;
  username: string;
  role: string;
  toolName: string;
  action: AuditAction;
  resource?: string;
  environment?: string;
  reason?: string;
  metadata?: Record<string, unknown>;
}

class AuditLogger {
  private logPath: string;

  constructor() {
    this.logPath = process.env.AUDIT_LOG_PATH || './logs/ai-audit.jsonl';
    fs.mkdirSync(path.dirname(this.logPath), { recursive: true });
  }

  log(entry: Omit<AuditEntry, 'timestamp'>): void {
    const fullEntry: AuditEntry = {
      timestamp: new Date().toISOString(),
      ...entry,
    };

    // Append JSONL format (1 JSON object per line)
    fs.appendFileSync(this.logPath, JSON.stringify(fullEntry) + '\n');

    // Console log สำหรับ monitoring
    const symbol = {
      ALLOWED: '✅',
      DENIED: '❌',
      PENDING_APPROVAL: '⏳',
      APPROVED: '✔️',
      REJECTED: '🚫',
    }[entry.action];

    console.error(
      `[AUDIT] ${symbol} ${entry.action} | ${entry.username} (${entry.role}) | ${entry.toolName}`
    );
  }

  async query(filters: {
    userId?: string;
    action?: AuditAction;
    fromDate?: Date;
    toDate?: Date;
  }): Promise<AuditEntry[]> {
    const lines = fs.readFileSync(this.logPath, 'utf-8').split('\n').filter(Boolean);
    let entries: AuditEntry[] = lines.map(l => JSON.parse(l));

    if (filters.userId)  entries = entries.filter(e => e.userId === filters.userId);
    if (filters.action)  entries = entries.filter(e => e.action === filters.action);
    if (filters.fromDate) entries = entries.filter(e => new Date(e.timestamp) >= filters.fromDate!);
    if (filters.toDate)   entries = entries.filter(e => new Date(e.timestamp) <= filters.toDate!);

    return entries.reverse(); // newest first
  }
}

export const auditLogger = new AuditLogger();
```

---

## 🔗 Tool Permission Map

```typescript
// src/rbac/tool-map.ts
import { ToolPermission, Resource, Action } from './types';

// Map tool name → required permission
export const TOOL_PERMISSION_MAP: Record<string, ToolPermission> = {
  // HR Tools
  get_employee_info:  { resource: 'hr_system', action: 'read' },
  search_employees:   { resource: 'hr_system', action: 'read' },
  get_org_chart:      { resource: 'hr_system', action: 'read' },
  check_leave_balance:{ resource: 'hr_system', action: 'read' },
  update_employee:    { resource: 'hr_system', action: 'write' },

  // Database Tools
  query_database:       { resource: 'database', action: 'read',   environmentKey: 'environment' },
  execute_sql:          { resource: 'database', action: 'write',  environmentKey: 'environment' },
  delete_database_rows: { resource: 'database', action: 'delete', environmentKey: 'environment' },

  // Code Tools
  read_file:   { resource: 'code', action: 'read' },
  write_file:  { resource: 'code', action: 'write' },
  delete_file: { resource: 'code', action: 'delete' },

  // GitHub Tools
  list_prs:     { resource: 'github', action: 'read' },
  create_pr:    { resource: 'github', action: 'write' },
  merge_pr:     { resource: 'github', action: 'admin' },

  // Infrastructure Tools
  deploy_service:   { resource: 'infrastructure', action: 'deploy' },
  restart_service:  { resource: 'infrastructure', action: 'write' },
};
```

---

## 🚀 Integration กับ MCP Server

```typescript
// src/rbac/guard.ts — Middleware สำหรับ MCP Server
import { checkPermission } from './checker';
import { auditLogger } from './audit';
import { TOOL_PERMISSION_MAP } from './tool-map';
import { Environment } from './types';

export interface UserContext {
  userId: string;
  username: string;
  role: string;
}

export async function guardToolCall(
  toolName: string,
  args: Record<string, unknown>,
  user: UserContext
): Promise<{ proceed: boolean; requiresApproval: boolean; message: string }> {

  const toolPerm = TOOL_PERMISSION_MAP[toolName];

  // Tool ที่ไม่ได้ map → Deny by default (Zero Trust)
  if (!toolPerm) {
    auditLogger.log({
      userId: user.userId, username: user.username, role: user.role,
      toolName, action: 'DENIED',
      reason: 'Tool not in permission map (deny unknown)',
    });
    return {
      proceed: false,
      requiresApproval: false,
      message: `❌ Tool "${toolName}" is not registered in the permission system.`,
    };
  }

  // ดึง environment จาก args ถ้ามี
  const environment = toolPerm.environmentKey
    ? (args[toolPerm.environmentKey] as Environment | undefined)
    : undefined;

  const result = checkPermission(user.role, toolPerm.resource, toolPerm.action, environment);

  if (!result.allowed) {
    auditLogger.log({
      userId: user.userId, username: user.username, role: user.role,
      toolName, action: 'DENIED',
      resource: toolPerm.resource,
      environment,
      reason: result.reason,
    });
    return {
      proceed: false,
      requiresApproval: false,
      message: `❌ Access Denied\n**Role:** ${user.role}\n**Reason:** ${result.reason}`,
    };
  }

  if (result.requiresApproval) {
    // ส่ง notification ให้ Approver
    await requestApproval(user, toolName, args, result.approvalGroup!);
    auditLogger.log({
      userId: user.userId, username: user.username, role: user.role,
      toolName, action: 'PENDING_APPROVAL',
      resource: toolPerm.resource, environment,
      metadata: { approvalGroup: result.approvalGroup },
    });
    return {
      proceed: false,
      requiresApproval: true,
      message: `⏳ **Approval Required**\nThis action needs approval from **${result.approvalGroup}**.\nA notification has been sent. Request ID: ${Date.now()}`,
    };
  }

  auditLogger.log({
    userId: user.userId, username: user.username, role: user.role,
    toolName, action: 'ALLOWED',
    resource: toolPerm.resource, environment,
  });

  return { proceed: true, requiresApproval: false, message: 'Allowed' };
}

async function requestApproval(
  user: UserContext,
  toolName: string,
  args: Record<string, unknown>,
  approvalGroup: string
): Promise<void> {
  // ส่ง Slack message ให้ approver group
  // Implementation ขึ้นกับ Slack setup ของบริษัท
  console.error(`[APPROVAL REQUEST] ${user.username} wants to run ${toolName}`);
  console.error(`  Args: ${JSON.stringify(args).slice(0, 100)}`);
  console.error(`  Needs approval from: ${approvalGroup}`);
}
```

---

## ✏️ เพิ่ม Guard เข้า MCP Server

แก้ไข `src/index.ts` จากบทที่ 31:

```typescript
// src/index.ts — เพิ่ม RBAC guard
import { guardToolCall, UserContext } from './rbac/guard';

// อ่าน user context จาก environment (set ตอน run MCP Server)
function getUserContext(): UserContext {
  return {
    userId:   process.env.USER_ID   || 'anonymous',
    username: process.env.USERNAME  || 'unknown',
    role:     process.env.USER_ROLE || 'junior_dev',
  };
}

// แก้ CallToolRequestSchema handler
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  const typedArgs = (args || {}) as Record<string, unknown>;
  const user = getUserContext();

  // ✅ ตรวจสอบ permission ก่อนทุกครั้ง
  const guard = await guardToolCall(name, typedArgs, user);

  if (!guard.proceed) {
    return {
      content: [{ type: 'text', text: guard.message }],
      isError: !guard.requiresApproval,
    };
  }

  // ดำเนินการตามปกติ...
  try {
    const hrToolNames = hrToolDefinitions.map(t => t.name);
    const pmToolNames = pmToolDefinitions.map(t => t.name);
    let result: string;

    if (hrToolNames.includes(name))     result = await executeHRTool(name, typedArgs);
    else if (pmToolNames.includes(name)) result = await executePMTool(name, typedArgs);
    else throw new Error(`Tool not found: ${name}`);

    return { content: [{ type: 'text', text: result }] };
  } catch (error: any) {
    return {
      content: [{ type: 'text', text: `Error: ${error.message}` }],
      isError: true,
    };
  }
});
```

---

## ⚙️ Config Claude Code ด้วย User Context

```json
// ~/.claude/settings.json
{
  "mcpServers": {
    "company-tools": {
      "command": "node",
      "args": ["/Users/username/company-mcp/dist/index.js"],
      "env": {
        "USER_ID": "EMP-042",
        "USERNAME": "bee.developer",
        "USER_ROLE": "junior_dev",
        "HR_API_URL": "...",
        "AUDIT_LOG_PATH": "/var/log/mcp/ai-audit.jsonl"
      }
    }
  }
}
```

**ใน Production:** ใช้ SSO/IdP (Okta, Azure AD) generate token ที่มี role claim แล้ว validate ใน MCP Server แทน hardcode

---

## 📊 ผลลัพธ์หลัง Deploy RBAC

กลับไปที่เรื่องของบี — ถ้ามี RBAC:

```
บี (junior_dev) พิมพ์:
"ลบ test orders ที่ status='failed' ออกจาก database"

Claude เรียก delete_database_rows { environment: "production" }

Guard ตรวจสอบ:
- Role: junior_dev
- Tool: delete_database_rows → resource: database, action: delete
- Permission: junior_dev ไม่มี delete permission

Response จาก Guard:
❌ Access Denied
Role: Junior Developer
Reason: Role "junior_dev" cannot delete database in production

Claude ตอบบี:
"ขอโทษครับ ฉันไม่มีสิทธิ์ลบข้อมูลจาก database
สำหรับ production data deletion ต้องให้ Tech Lead หรือ DevOps ดำเนินการ
ถ้าต้องการลบข้อมูลใน development environment ฉันช่วยได้ครับ"
```

ข้อมูล 2,847 orders รอด — เพราะมีระบบควบคุมอยู่เบื้องหลัง

---

## 🎯 สรุปบทที่ 33

| Component | หน้าที่ |
|-----------|--------|
| ROLES config | กำหนด permissions ของแต่ละ role อย่างชัดเจน |
| checkPermission() | ตรวจว่า role มีสิทธิ์ resource+action+environment ไหน |
| TOOL_PERMISSION_MAP | Map tool name → resource/action ที่ต้องการ |
| guardToolCall() | Middleware ที่คั่นก่อนทุก tool execution |
| auditLogger | บันทึกทุก action เป็น JSONL สำหรับ compliance |
| Zero Trust | Tool ที่ไม่ได้ map → Deny โดย default |

---

## 📋 Action Items ก่อนไปบทที่ 34

- [ ] กำหนด roles จริงของบริษัท (อย่างน้อย 3 roles)
- [ ] สร้าง `TOOL_PERMISSION_MAP` ครอบคลุมทุก tool ใน MCP Server
- [ ] เพิ่ม `guardToolCall()` เข้าใน MCP Server handler
- [ ] ทดสอบ: รัน claude ด้วย role `junior_dev` แล้วลอง delete operation
- [ ] ตรวจสอบ audit log หลังทดสอบ 10 tool calls
- [ ] วางแผน Approval Workflow: ใครต้อง approve อะไร ผ่าน channel ไหน

---

*ใน **บทที่ 34** เราจะขยาย MCP Server ให้ใช้ได้ทั้งทีม ด้วย Multi-Agent Orchestration — วิธีออกแบบให้ Claude agents หลายตัวทำงานร่วมกันแบบ Pipeline และ Parallel เพื่อเพิ่ม throughput และลด latency ครับ*
