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
