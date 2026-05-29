// src/main.ts
import Anthropic from '@anthropic-ai/sdk';
import * as readline from 'readline';
import chalk from 'chalk';
import 'dotenv/config';
import path from 'path';

import { loadConfig } from './config';
import { Conversation } from './conversation';
import { fileTools, executeTool } from './tools';
import { handleCommand } from './commands';

const client = new Anthropic();
const workingDir = process.cwd();
const config = loadConfig(workingDir);
const conversation = new Conversation();

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

console.log(chalk.cyan('\n🤖 MiniClaude — Your Personal AI CLI'));
console.log(chalk.gray(`Working in: ${workingDir}`));
console.log(chalk.gray('Type /help for commands\n'));

async function chat(userInput: string): Promise<void> {
  conversation.add('user', userInput);

  process.stdout.write(chalk.green('\nAssistant: '));

  let fullResponse = '';

  try {
    // ใช้ streaming + tools
    const stream = await client.messages.stream({
      model: config.model,
      max_tokens: config.maxTokens,
      system: config.systemPrompt,
      tools: fileTools,
      messages: conversation.getHistory(),
    });

    for await (const event of stream) {
      // Stream text ทีละตัวอักษร
      if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
        process.stdout.write(event.delta.text);
        fullResponse += event.delta.text;
      }
    }

    const finalMessage = await stream.finalMessage();

    // Handle tool calls ถ้ามี
    if (finalMessage.stop_reason === 'tool_use') {
      console.log(); // newline

      const toolResults: Anthropic.ToolResultBlockParam[] = [];

      for (const block of finalMessage.content) {
        if (block.type !== 'tool_use') continue;

        console.log(chalk.yellow(`\n🔧 Using tool: ${block.name}`));

        try {
          const result = await executeTool(block.name, block.input as any, workingDir);
          console.log(chalk.gray(result.slice(0, 200) + (result.length > 200 ? '...' : '')));
          toolResults.push({ type: 'tool_result', tool_use_id: block.id, content: result });
        } catch (err: any) {
          toolResults.push({ type: 'tool_result', tool_use_id: block.id, content: err.message, is_error: true });
        }
      }

      // Add assistant message + tool results then get final answer
      conversation.add('assistant', finalMessage.content
        .filter(b => b.type === 'text')
        .map(b => b.type === 'text' ? b.text : '').join(''));

      // Second turn with tool results
      process.stdout.write(chalk.green('\nAssistant: '));
      const stream2 = await client.messages.stream({
        model: config.model,
        max_tokens: config.maxTokens,
        system: config.systemPrompt,
        tools: fileTools,
        messages: [
          ...conversation.getHistory(),
          { role: 'assistant', content: finalMessage.content },
          { role: 'user', content: toolResults },
        ],
      });

      fullResponse = '';
      for await (const event of stream2) {
        if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
          process.stdout.write(event.delta.text);
          fullResponse += event.delta.text;
        }
      }
    }

    console.log('\n');
    conversation.add('assistant', fullResponse);

  } catch (error: any) {
    console.error(chalk.red(`\nError: ${error.message}`));
  }
}

// Main loop
function prompt(): void {
  rl.question(chalk.blue('You: '), async (input) => {
    input = input.trim();
    if (!input) return prompt();

    // Handle slash commands
    if (input.startsWith('/')) {
      const result = await handleCommand(input, conversation, client, config.systemPrompt);
      if (result.exit) {
        console.log(chalk.cyan('Goodbye! 👋'));
        rl.close();
        process.exit(0);
      }
      if (result.message) console.log(chalk.gray(result.message));
      if (result.handled) return prompt();
    }

    await chat(input);
    prompt();
  });
}

prompt();
