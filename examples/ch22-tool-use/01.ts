// src/tools/definitions.ts
import Anthropic from '@anthropic-ai/sdk';

// Tool คือ JSON object ที่บอก Claude ว่ามี capability อะไรบ้าง
export const jiraTools: Anthropic.Tool[] = [
  {
    name: 'create_jira_ticket',
    description: 'สร้าง ticket ใน Jira สำหรับ bug, feature request, หรืองานต่างๆ',
    input_schema: {
      type: 'object' as const,
      properties: {
        summary: {
          type: 'string',
          description: 'หัวข้อสั้นๆ ของ ticket (ไม่เกิน 100 ตัวอักษร)',
        },
        description: {
          type: 'string',
          description: 'รายละเอียดของ ticket พร้อม steps to reproduce ถ้าเป็น bug',
        },
        issueType: {
          type: 'string',
          enum: ['Bug', 'Story', 'Task', 'Epic'],
          description: 'ประเภทของ issue',
        },
        priority: {
          type: 'string',
          enum: ['Highest', 'High', 'Medium', 'Low', 'Lowest'],
          description: 'ความสำคัญ — ใช้ Highest สำหรับ production issues เท่านั้น',
        },
        labels: {
          type: 'array',
          items: { type: 'string' },
          description: 'labels สำหรับ categorize เช่น ["payment", "urgent"]',
        },
      },
      required: ['summary', 'issueType', 'priority'],
    },
  },
  {
    name: 'search_jira_tickets',
    description: 'ค้นหา tickets ใน Jira ด้วย JQL query',
    input_schema: {
      type: 'object' as const,
      properties: {
        jql: {
          type: 'string',
          description: 'JQL query เช่น "project = TECH AND status = Open AND priority = High"',
        },
        maxResults: {
          type: 'number',
          description: 'จำนวน results สูงสุด (default: 10)',
        },
      },
      required: ['jql'],
    },
  },
  {
    name: 'update_ticket_status',
    description: 'เปลี่ยน status ของ ticket ที่มีอยู่แล้ว',
    input_schema: {
      type: 'object' as const,
      properties: {
        ticketKey: {
          type: 'string',
          description: 'Jira ticket key เช่น TECH-123',
        },
        newStatus: {
          type: 'string',
          enum: ['To Do', 'In Progress', 'In Review', 'Done'],
        },
        comment: {
          type: 'string',
          description: 'comment ที่จะเพิ่มพร้อมกับการเปลี่ยน status',
        },
      },
      required: ['ticketKey', 'newStatus'],
    },
  },
];
