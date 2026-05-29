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
