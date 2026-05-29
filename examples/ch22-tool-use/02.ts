// src/tools/executors.ts
import axios from 'axios';

const jiraConfig = {
  baseURL: process.env.JIRA_BASE_URL,
  auth: {
    username: process.env.JIRA_EMAIL!,
    password: process.env.JIRA_API_TOKEN!,
  },
  headers: { 'Content-Type': 'application/json' },
};

// Map tool name → function ที่ execute จริงๆ
export const toolExecutors: Record<string, (input: any) => Promise<unknown>> = {
  create_jira_ticket: async (input) => {
    const response = await axios.post(
      `${jiraConfig.baseURL}/rest/api/3/issue`,
      {
        fields: {
          project: { key: process.env.JIRA_PROJECT_KEY },
          summary: input.summary,
          description: {
            type: 'doc',
            version: 1,
            content: [{
              type: 'paragraph',
              content: [{ type: 'text', text: input.description || '' }],
            }],
          },
          issuetype: { name: input.issueType },
          priority: { name: input.priority },
          labels: input.labels || [],
        },
      },
      { auth: jiraConfig.auth, headers: jiraConfig.headers }
    );

    return {
      ticketKey: response.data.key,
      ticketUrl: `${jiraConfig.baseURL}/browse/${response.data.key}`,
      status: 'created',
    };
  },

  search_jira_tickets: async (input) => {
    const response = await axios.get(
      `${jiraConfig.baseURL}/rest/api/3/search`,
      {
        params: { jql: input.jql, maxResults: input.maxResults || 10 },
        auth: jiraConfig.auth,
      }
    );

    return response.data.issues.map((issue: any) => ({
      key: issue.key,
      summary: issue.fields.summary,
      status: issue.fields.status.name,
      priority: issue.fields.priority?.name,
      url: `${jiraConfig.baseURL}/browse/${issue.key}`,
    }));
  },

  update_ticket_status: async (input) => {
    // ดึง transitions ที่ทำได้
    const transitionsRes = await axios.get(
      `${jiraConfig.baseURL}/rest/api/3/issue/${input.ticketKey}/transitions`,
      { auth: jiraConfig.auth }
    );

    const transition = transitionsRes.data.transitions.find(
      (t: any) => t.name === input.newStatus
    );

    if (!transition) {
      return { error: `Cannot transition to "${input.newStatus}"` };
    }

    // เปลี่ยน status
    await axios.post(
      `${jiraConfig.baseURL}/rest/api/3/issue/${input.ticketKey}/transitions`,
      { transition: { id: transition.id } },
      { auth: jiraConfig.auth }
    );

    // เพิ่ม comment ถ้ามี
    if (input.comment) {
      await axios.post(
        `${jiraConfig.baseURL}/rest/api/3/issue/${input.ticketKey}/comment`,
        {
          body: {
            type: 'doc', version: 1,
            content: [{ type: 'paragraph', content: [{ type: 'text', text: input.comment }] }],
          },
        },
        { auth: jiraConfig.auth }
      );
    }

    return { success: true, ticketKey: input.ticketKey, newStatus: input.newStatus };
  },
};
