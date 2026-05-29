// src/config.ts
import fs from 'fs';
import path from 'path';

export interface CLIConfig {
  systemPrompt: string;
  model: string;
  maxTokens: number;
  workingDir: string;
}

export function loadConfig(workingDir: string): CLIConfig {
  let systemPrompt = 'You are a helpful AI assistant. Answer concisely.';

  // โหลด CLAUDE.md ถ้ามี
  const claudeMdPath = path.join(workingDir, 'CLAUDE.md');
  if (fs.existsSync(claudeMdPath)) {
    const content = fs.readFileSync(claudeMdPath, 'utf-8');
    systemPrompt = content;
    console.log(`✅ Loaded CLAUDE.md (${content.length} chars)`);
  }

  return {
    systemPrompt,
    model: process.env.CLAUDE_MODEL || 'claude-sonnet-4-5',
    maxTokens: parseInt(process.env.MAX_TOKENS || '8192'),
    workingDir,
  };
}
