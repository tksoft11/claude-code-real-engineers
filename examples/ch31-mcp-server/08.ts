// src/index.ts
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
  ListPromptsRequestSchema,
  GetPromptRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import 'dotenv/config';

import { hrToolDefinitions, executeHRTool } from './tools/hr.tools';
import { pmToolDefinitions, executePMTool } from './tools/pm.tools';
import { companyResources, readResource } from './resources/policies';
import { companyPrompts, getPromptMessages } from './prompts/templates';

// ── Server Instance ──────────────────────────────────
const server = new Server(
  {
    name: 'company-internal-tools',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
      resources: {},
      prompts: {},
    },
  }
);

// ── Tools ────────────────────────────────────────────
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [...hrToolDefinitions, ...pmToolDefinitions],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  const typedArgs = (args || {}) as Record<string, unknown>;

  console.error(`[Tool Call] ${name}`, JSON.stringify(typedArgs).slice(0, 100));

  try {
    // Route ไปยัง executor ที่เหมาะสม
    const hrToolNames = hrToolDefinitions.map(t => t.name);
    const pmToolNames = pmToolDefinitions.map(t => t.name);

    let result: string;

    if (hrToolNames.includes(name)) {
      result = await executeHRTool(name, typedArgs);
    } else if (pmToolNames.includes(name)) {
      result = await executePMTool(name, typedArgs);
    } else {
      throw new Error(`Tool not found: ${name}`);
    }

    return { content: [{ type: 'text', text: result }] };

  } catch (error: any) {
    console.error(`[Tool Error] ${name}:`, error.message);
    return {
      content: [{ type: 'text', text: `Error: ${error.message}` }],
      isError: true,
    };
  }
});

// ── Resources ────────────────────────────────────────
server.setRequestHandler(ListResourcesRequestSchema, async () => ({
  resources: companyResources,
}));

server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  const { uri } = request.params;
  console.error(`[Resource Read] ${uri}`);

  try {
    const content = await readResource(uri);
    const resource = companyResources.find(r => r.uri === uri);

    return {
      contents: [{
        uri,
        mimeType: resource?.mimeType || 'text/plain',
        text: content,
      }],
    };
  } catch (error: any) {
    throw new Error(`Cannot read resource ${uri}: ${error.message}`);
  }
});

// ── Prompts ──────────────────────────────────────────
server.setRequestHandler(ListPromptsRequestSchema, async () => ({
  prompts: companyPrompts,
}));

server.setRequestHandler(GetPromptRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  console.error(`[Prompt Get] ${name}`);

  const messages = getPromptMessages(name, args as Record<string, string>);
  return { messages };
});

// ── Start ────────────────────────────────────────────
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('✅ Company Internal Tools MCP Server started');
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
