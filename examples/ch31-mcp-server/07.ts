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
