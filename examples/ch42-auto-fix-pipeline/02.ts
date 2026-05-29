// ops-server/src/webhookListener.ts
import express, { Request, Response } from 'express';
import axios from 'axios';

const app = express();
app.use(express.json());

const GITHUB_TOKEN = process.env.GITHUB_PAT_TOKEN; // Personal Access Token ที่มีสิทธิ์คุม Repo
const REPO_OWNER = 'your-org';
const REPO_NAME = 'core-app';

app.post('/webhooks/error-alerts', async (req: Request, res: Response) => {
  const { error_message, stack_trace, file_path, line_number } = req.body;

  if (!error_message || !stack_trace) {
    return res.status(400).json({ error: 'Missing required payload fields' });
  }

  console.log(`⚠️ Alert Received: ${error_message} in ${file_path}:${line_number}`);

  try {
    // ส่งสัญญาณไปเปิด GitHub Actions Workflow ผ่าน API
    const response = await axios.post(
      `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/actions/workflows/auto-fix.yml/dispatches`,
      {
        ref: 'main', // รันบนกิ่งหลัก
        inputs: {
          errorMessage: error_message,
          stackTrace: stack_trace,
          filePath: file_path || 'unknown',
          lineNumber: String(line_number || 0)
        }
      },
      {
        headers: {
          Authorization: `token ${GITHUB_TOKEN}`,
          Accept: 'application/vnd.github.v3+json'
        }
      }
    );

    return res.status(200).json({
      status: 'success',
      message: 'Auto-fix workflow triggered successfully',
      githubStatus: response.status
    });
  } catch (error: any) {
    console.error('Failed to trigger workflow:', error.response?.data || error.message);
    return res.status(500).json({ error: 'Internal server error triggering workflow' });
  }
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`🚀 Webhook listener active on port ${PORT}`));
