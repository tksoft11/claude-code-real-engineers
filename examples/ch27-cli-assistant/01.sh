mkdir mini-claude && cd mini-claude
npm init -y
npm install @anthropic-ai/sdk dotenv chalk readline
npm install -D typescript ts-node @types/node

# tsconfig.json
npx tsc --init --target ES2022 --module commonjs
