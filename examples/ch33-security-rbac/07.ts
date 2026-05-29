// src/index.ts — เพิ่ม RBAC guard
import { guardToolCall, UserContext } from './rbac/guard';

// อ่าน user context จาก environment (set ตอน run MCP Server)
function getUserContext(): UserContext {
  return {
    userId:   process.env.USER_ID   || 'anonymous',
    username: process.env.USERNAME  || 'unknown',
    role:     process.env.USER_ROLE || 'junior_dev',
  };
}

// แก้ CallToolRequestSchema handler
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  const typedArgs = (args || {}) as Record<string, unknown>;
  const user = getUserContext();

  // ✅ ตรวจสอบ permission ก่อนทุกครั้ง
  const guard = await guardToolCall(name, typedArgs, user);

  if (!guard.proceed) {
    return {
      content: [{ type: 'text', text: guard.message }],
      isError: !guard.requiresApproval,
    };
  }

  // ดำเนินการตามปกติ...
  try {
    const hrToolNames = hrToolDefinitions.map(t => t.name);
    const pmToolNames = pmToolDefinitions.map(t => t.name);
    let result: string;

    if (hrToolNames.includes(name))     result = await executeHRTool(name, typedArgs);
    else if (pmToolNames.includes(name)) result = await executePMTool(name, typedArgs);
    else throw new Error(`Tool not found: ${name}`);

    return { content: [{ type: 'text', text: result }] };
  } catch (error: any) {
    return {
      content: [{ type: 'text', text: `Error: ${error.message}` }],
      isError: true,
    };
  }
});
