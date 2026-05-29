// .github/scripts/migration-safety/sql-analyzer.ts
import Anthropic from '@anthropic-ai/sdk';

export interface MigrationOperation {
  type: 'DROP_TABLE' | 'DROP_COLUMN' | 'RENAME_TABLE' | 'RENAME_COLUMN'
      | 'ALTER_COLUMN' | 'ADD_COLUMN' | 'CREATE_TABLE' | 'ADD_INDEX' | 'OTHER';
  table: string;
  column?: string;
  details: string;
  riskLevel: 'critical' | 'high' | 'medium' | 'low';
}

export async function analyzeMigrationSQL(
  sql: string
): Promise<MigrationOperation[]> {
  const client = new Anthropic();

  const response = await client.messages.create({
    model: 'claude-sonnet-4-5',
    max_tokens: 2000,
    system: `คุณคือ Database Expert วิเคราะห์ Migration SQL และระบุทุก operation ที่เกิดขึ้น

กำหนด riskLevel:
- critical: DROP TABLE, DROP COLUMN, RENAME TABLE/COLUMN (breaking changes)
- high: ALTER COLUMN type change, NOT NULL constraint เพิ่ม
- medium: ADD COLUMN with default, ADD INDEX (locks table ชั่วคราว)  
- low: ADD COLUMN nullable, CREATE TABLE ใหม่

ตอบ JSON array เท่านั้น:
[{
  "type": "DROP_COLUMN",
  "table": "users",
  "column": "legacy_token",
  "details": "ลบ column legacy_token ออกจาก users table",
  "riskLevel": "critical"
}]`,
    messages: [{
      role: 'user',
      content: `วิเคราะห์ migration นี้:\n\n${sql}`,
    }],
  });

  const text = response.content[0].type === 'text' ? response.content[0].text : '[]';
  try {
    const match = text.match(/\[[\s\S]*\]/);
    return match ? JSON.parse(match[0]) : [];
  } catch {
    return [];
  }
}
