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
