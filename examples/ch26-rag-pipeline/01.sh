mkdir company-brain && cd company-brain
npm init -y
npm install @anthropic-ai/sdk openai @prisma/client prisma \
            express multer pdf-parse dotenv cors
npm install -D typescript ts-node @types/node @types/express

npx prisma init
