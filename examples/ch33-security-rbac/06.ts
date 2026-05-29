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
