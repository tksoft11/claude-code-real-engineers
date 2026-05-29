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
