mkdir company-mcp && cd company-mcp
npm init -y
npm install @modelcontextprotocol/sdk axios zod dotenv
npm install -D typescript ts-node @types/node

cat > tsconfig.json << 'EOF'
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "commonjs",
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true
  }
}
EOF
