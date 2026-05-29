// oncall-bot/src/mcp-tools/incidentTools.ts
import { Tool } from '@anthropic-ai/sdk';

export const INCIDENT_TOOLS: Tool[] = [
  {
    name: 'get_cloudwatch_logs',
    description: 'ดึง Error logs จาก AWS CloudWatch สำหรับ service ที่ระบุในช่วงเวลาที่กำหนด',
    input_schema: {
      type: 'object',
      properties: {
        service_name: { type: 'string', description: 'ชื่อ ECS Service หรือ Lambda Function' },
        minutes_back: { type: 'number', description: 'จำนวนนาทีย้อนหลังที่ต้องการดู' },
        filter_pattern: { type: 'string', description: 'Pattern กรองเฉพาะ ERROR หรือ Exception' }
      },
      required: ['service_name', 'minutes_back']
    }
  },
  {
    name: 'get_datadog_metrics',
    description: 'ดึง Performance metrics จาก Datadog (CPU, Memory, Error Rate, Latency)',
    input_schema: {
      type: 'object',
      properties: {
        metric_name: { type: 'string' },
        service: { type: 'string' },
        from_minutes_ago: { type: 'number' }
      },
      required: ['metric_name', 'service', 'from_minutes_ago']
    }
  },
  {
    name: 'get_recent_deployments',
    description: 'ตรวจสอบว่ามี Deployment อะไรถูก push ขึ้นในช่วงเวลาก่อนเกิดเหตุ',
    input_schema: {
      type: 'object',
      properties: {
        service: { type: 'string' },
        hours_back: { type: 'number', description: 'ย้อนหลังกี่ชั่วโมง' }
      },
      required: ['service', 'hours_back']
    }
  },
  {
    name: 'run_safe_runbook_action',
    description: 'รันคำสั่ง pre-approved ใน runbook เช่น restart service, scale pods, clear cache',
    input_schema: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          enum: ['restart_service', 'scale_pods', 'clear_cache', 'rollback_deployment'],
          description: 'คำสั่งที่รันได้โดยไม่ต้องขออนุมัติเพิ่มเติม'
        },
        target: { type: 'string', description: 'ชื่อ service หรือ deployment ที่เป็นเป้าหมาย' },
        parameters: { type: 'object', description: 'พารามิเตอร์เพิ่มเติม เช่น replica_count สำหรับ scale' }
      },
      required: ['action', 'target']
    }
  },
  {
    name: 'post_slack_update',
    description: 'ส่งข้อความอัปเดตสถานะเหตุการณ์ไปยัง Slack channel #incidents',
    input_schema: {
      type: 'object',
      properties: {
        message: { type: 'string' },
        severity: { type: 'string', enum: ['info', 'warning', 'critical', 'resolved'] }
      },
      required: ['message', 'severity']
    }
  },
  {
    name: 'escalate_to_human',
    description: 'ส่งสัญญาณปลุก On-Call Engineer ที่เป็นมนุษย์เมื่อ Bot ตัดสินใจเองไม่ได้',
    input_schema: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'เหตุผลที่ต้องการมนุษย์มาช่วย' },
        evidence: { type: 'string', description: 'หลักฐานและข้อมูลที่รวบรวมได้จนถึงตอนนี้' },
        urgency: { type: 'string', enum: ['low', 'medium', 'high', 'critical'] }
      },
      required: ['reason', 'urgency']
    }
  }
];
