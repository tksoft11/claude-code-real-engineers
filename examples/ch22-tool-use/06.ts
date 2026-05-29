// สร้าง Safe Tool Wrapper
function createSafeTool(
  name: string,
  executor: (input: any) => Promise<unknown>,
  options: {
    requireApproval?: boolean;
    allowedInProduction?: boolean;
    rateLimit?: number; // calls per minute
  } = {}
) {
  let callCount = 0;
  let lastReset = Date.now();

  return async (input: any) => {
    // Rate limiting
    if (options.rateLimit) {
      const now = Date.now();
      if (now - lastReset > 60000) { callCount = 0; lastReset = now; }
      if (++callCount > options.rateLimit) {
        throw new Error(`Rate limit exceeded for tool: ${name}`);
      }
    }

    // Production guard
    if (!options.allowedInProduction && process.env.NODE_ENV === 'production') {
      throw new Error(`Tool ${name} is not allowed in production`);
    }

    // Human approval สำหรับ destructive actions
    if (options.requireApproval) {
      console.log(`\n⚠️  Tool ${name} requires approval:`);
      console.log('Input:', JSON.stringify(input, null, 2));
      const approved = await askHumanApproval(); // readline prompt
      if (!approved) throw new Error('Tool execution rejected by user');
    }

    return executor(input);
  };
}

// ใช้งาน
const safeExecutors = {
  create_jira_ticket: createSafeTool('create_jira_ticket', toolExecutors.create_jira_ticket, {
    allowedInProduction: true,
    rateLimit: 10, // max 10 tickets per minute
  }),
  delete_tickets: createSafeTool('delete_tickets', toolExecutors.delete_tickets, {
    requireApproval: true,  // ต้องมีคนกด approve ก่อน
    allowedInProduction: false,
  }),
};
