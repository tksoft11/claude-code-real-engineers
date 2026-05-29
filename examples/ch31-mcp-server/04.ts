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
