// src/rbac/audit.ts
import fs from 'fs';
import path from 'path';

export type AuditAction = 'ALLOWED' | 'DENIED' | 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED';

export interface AuditEntry {
  timestamp: string;
  userId: string;
  username: string;
  role: string;
  toolName: string;
  action: AuditAction;
  resource?: string;
  environment?: string;
  reason?: string;
  metadata?: Record<string, unknown>;
}

class AuditLogger {
  private logPath: string;

  constructor() {
    this.logPath = process.env.AUDIT_LOG_PATH || './logs/ai-audit.jsonl';
    fs.mkdirSync(path.dirname(this.logPath), { recursive: true });
  }

  log(entry: Omit<AuditEntry, 'timestamp'>): void {
    const fullEntry: AuditEntry = {
      timestamp: new Date().toISOString(),
      ...entry,
    };

    // Append JSONL format (1 JSON object per line)
    fs.appendFileSync(this.logPath, JSON.stringify(fullEntry) + '\n');

    // Console log สำหรับ monitoring
    const symbol = {
      ALLOWED: '✅',
      DENIED: '❌',
      PENDING_APPROVAL: '⏳',
      APPROVED: '✔️',
      REJECTED: '🚫',
    }[entry.action];

    console.error(
      `[AUDIT] ${symbol} ${entry.action} | ${entry.username} (${entry.role}) | ${entry.toolName}`
    );
  }

  async query(filters: {
    userId?: string;
    action?: AuditAction;
    fromDate?: Date;
    toDate?: Date;
  }): Promise<AuditEntry[]> {
    const lines = fs.readFileSync(this.logPath, 'utf-8').split('\n').filter(Boolean);
    let entries: AuditEntry[] = lines.map(l => JSON.parse(l));

    if (filters.userId)  entries = entries.filter(e => e.userId === filters.userId);
    if (filters.action)  entries = entries.filter(e => e.action === filters.action);
    if (filters.fromDate) entries = entries.filter(e => new Date(e.timestamp) >= filters.fromDate!);
    if (filters.toDate)   entries = entries.filter(e => new Date(e.timestamp) <= filters.toDate!);

    return entries.reverse(); // newest first
  }
}

export const auditLogger = new AuditLogger();
