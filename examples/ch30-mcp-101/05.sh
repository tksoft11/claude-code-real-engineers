# ทดสอบ filesystem MCP Server
echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"1.0"}}}' | \
  npx -y @modelcontextprotocol/server-filesystem /tmp

# ดู tools ที่มี
echo '{"jsonrpc":"2.0","id":2,"method":"tools/list","params":{}}' | \
  npx -y @modelcontextprotocol/server-filesystem /tmp
