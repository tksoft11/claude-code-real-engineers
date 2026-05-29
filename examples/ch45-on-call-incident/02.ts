// oncall-bot/src/mcp-tools/toolExecutor.ts
import {
  CloudWatchLogsClient,
  FilterLogEventsCommand
} from '@aws-sdk/client-cloudwatch-logs';
import axios from 'axios';

const cwClient = new CloudWatchLogsClient({ region: process.env.AWS_REGION || 'ap-southeast-1' });

// Map ชื่อ Action → คำสั่งจริงที่รันใน Kubernetes หรือ AWS
const SAFE_ACTIONS: Record<string, (target: string, params?: Record<string, unknown>) => Promise<string>> = {
  restart_service: async (target) => {
    // จำลอง: จริงๆ ใช้ kubectl rollout restart deployment/<target>
    console.log(`🔄 Restarting service: ${target}`);
    await sleep(2000); // จำลองเวลารัน
    return `Service ${target} restarted successfully. New pods spinning up.`;
  },
  scale_pods: async (target, params) => {
    const replicas = (params?.replica_count as number) || 3;
    console.log(`📈 Scaling ${target} to ${replicas} replicas`);
    await sleep(1500);
    return `Deployment ${target} scaled to ${replicas} replicas.`;
  },
  clear_cache: async (target) => {
    console.log(`🧹 Clearing cache for: ${target}`);
    await sleep(500);
    return `Cache cleared for ${target}. Next requests will rebuild from DB.`;
  },
  rollback_deployment: async (target) => {
    console.log(`⏪ Rolling back deployment: ${target}`);
    await sleep(3000);
    return `Deployment ${target} rolled back to previous stable version.`;
  }
};

export async function executeToolCall(
  toolName: string,
  input: Record<string, unknown>
): Promise<unknown> {
  console.log(`🔧 Executing tool: ${toolName}`);

  switch (toolName) {
    case 'get_cloudwatch_logs': {
      const { service_name, minutes_back, filter_pattern } = input as {
        service_name: string; minutes_back: number; filter_pattern?: string;
      };
      const endTime = Date.now();
      const startTime = endTime - (minutes_back * 60 * 1000);

      try {
        const response = await cwClient.send(new FilterLogEventsCommand({
          logGroupName: `/ecs/${service_name}`,
          startTime,
          endTime,
          filterPattern: filter_pattern || 'ERROR',
          limit: 50
        }));
        const events = response.events?.map(e => e.message).join('\n') || 'No errors found';
        return { logs: events, count: response.events?.length || 0 };
      } catch {
        // จำลองข้อมูลในกรณีทดสอบ
        return {
          logs: `[ERROR] DB Connection pool exhausted: 500/500 connections used\n[ERROR] Timeout acquiring connection after 30000ms`,
          count: 2
        };
      }
    }

    case 'get_datadog_metrics': {
      const { metric_name, service, from_minutes_ago } = input as {
        metric_name: string; service: string; from_minutes_ago: number;
      };
      // จำลองการดึงจาก Datadog API
      return {
        metric: metric_name,
        service,
        current_value: metric_name.includes('error') ? 0.42 : 2847,
        threshold: metric_name.includes('error') ? 0.05 : 500,
        status: 'critical',
        trend: 'increasing'
      };
    }

    case 'get_recent_deployments': {
      return {
        deployments: [
          { version: 'v2.3.1', time: '47 minutes ago', deployer: 'github-actions', status: 'success' },
          { version: 'v2.3.0', time: '2 days ago', deployer: 'john@company.com', status: 'success' }
        ]
      };
    }

    case 'run_safe_runbook_action': {
      const { action, target, parameters } = input as {
        action: string; target: string; parameters?: Record<string, unknown>;
      };
      const actionFn = SAFE_ACTIONS[action];
      if (!actionFn) {
        return { error: `Action '${action}' is not in the pre-approved list.` };
      }
      const result = await actionFn(target, parameters);
      return { success: true, result, action, target };
    }

    case 'post_slack_update': {
      const { message, severity } = input as { message: string; severity: string };
      const emoji = { info: 'ℹ️', warning: '⚠️', critical: '🚨', resolved: '✅' }[severity] || '📢';
      const slackPayload = {
        text: `${emoji} *On-Call AI Bot* [${severity.toUpperCase()}]\n${message}`
      };

      if (process.env.SLACK_WEBHOOK_URL) {
        await axios.post(process.env.SLACK_WEBHOOK_URL, slackPayload);
      } else {
        console.log('📢 [Slack Simulation]:', slackPayload.text);
      }
      return { sent: true, channel: '#incidents' };
    }

    case 'escalate_to_human': {
      const { reason, evidence, urgency } = input as {
        reason: string; evidence?: string; urgency: string;
      };
      console.error(`🆘 ESCALATION (${urgency.toUpperCase()}): ${reason}`);
      // จริงๆ จะ call PagerDuty API เพื่อปลุก On-Call Engineer
      return {
        escalated: true,
        message: `Human engineer notified via PagerDuty (urgency: ${urgency})`,
        evidence_logged: !!evidence
      };
    }

    default:
      return { error: `Unknown tool: ${toolName}` };
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
