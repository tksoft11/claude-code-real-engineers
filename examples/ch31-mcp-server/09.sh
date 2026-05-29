# Build
npx tsc

# ทดสอบก่อน config Claude
echo '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}' | node dist/index.js

# ดูผล:
# {"jsonrpc":"2.0","id":1,"result":{"tools":[
#   {"name":"get_employee_info",...},
#   {"name":"search_employees",...},
#   ...
# ]}}
