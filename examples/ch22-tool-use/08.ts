// assistant.ts — Interactive Jira Assistant
import * as readline from 'readline';
import { runWithTools } from './agents/tool-agent';

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

const SYSTEM = `คุณคือ Jira Assistant ส่วนตัวของฉัน
ช่วยสร้าง ค้นหา และอัปเดต Jira tickets ตาม request ของฉัน
ตอบสั้น กระชับ พร้อม ticket URL เสมอ`;

async function chat() {
  console.log('🤖 Jira Assistant พร้อมแล้ว (พิมพ์ "exit" เพื่อออก)\n');

  const ask = () => {
    rl.question('คุณ: ', async (input) => {
      if (input.toLowerCase() === 'exit') {
        rl.close();
        return;
      }
      if (!input.trim()) return ask();

      const reply = await runWithTools(input, SYSTEM);
      console.log(`\n🤖 Assistant: ${reply}\n`);
      ask();
    });
  };

  ask();
}

chat();
