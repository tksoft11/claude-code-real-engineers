# Setup
mkdir jira-assistant && cd jira-assistant
npm init -y
npm install @anthropic-ai/sdk axios dotenv readline

# .env
ANTHROPIC_API_KEY=sk-ant-...
JIRA_BASE_URL=https://yourcompany.atlassian.net
JIRA_EMAIL=your@email.com
JIRA_API_TOKEN=your-jira-token
JIRA_PROJECT_KEY=TECH
