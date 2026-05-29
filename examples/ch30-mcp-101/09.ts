// ใช้ MCP Client ใน Node.js app ของคุณ
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { spawn } from 'child_process';

async function createMCPClient(serverCommand: string, args: string[]) {
  const transport = new StdioClientTransport({
    command: serverCommand,
    args,
  });

  const client = new Client(
    { name: 'my-app', version: '1.0.0' },
    { capabilities: {} }
  );

  await client.connect(transport);

  // ดู tools ที่มี
  const { tools } = await client.listTools();
  console.log('Available tools:', tools.map(t => t.name));

  return client;
}

// ใช้งาน
const fileClient = await createMCPClient('npx', [
  '-y', '@modelcontextprotocol/server-filesystem', '/tmp'
]);

// เรียก tool โดยตรง
const result = await fileClient.callTool({
  name: 'read_file',
  arguments: { path: '/tmp/data.json' },
});

console.log(result.content[0].text);
