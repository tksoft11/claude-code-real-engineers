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
