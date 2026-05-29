// .github/scripts/migration-safety/codebase-scanner.ts
import { execSync } from 'child_process';
import { MigrationOperation } from './sql-analyzer';

export interface CodeReference {
  file: string;
  line: number;
  content: string;
  matchType: 'column' | 'table';
}

export function scanCodebaseForReferences(
  operations: MigrationOperation[],
  repoRoot: string
): Map<string, CodeReference[]> {
  const results = new Map<string, CodeReference[]>();

  // เฉพาะ critical/high risk operations เท่านั้น
  const riskyOps = operations.filter(op =>
    ['critical', 'high'].includes(op.riskLevel)
  );

  for (const op of riskyOps) {
    const key = `${op.table}.${op.column || '*'}`;
    const refs: CodeReference[] = [];

    // Grep patterns ที่ครอบคลุม ORM + raw SQL + string references
    const patterns: { pattern: string; matchType: 'column' | 'table' }[] = [];

    if (op.column) {
      patterns.push(
        { pattern: op.column, matchType: 'column' },
        // Rails/ActiveRecord style
        { pattern: `:${op.column}`, matchType: 'column' },
        // Python/SQLAlchemy style
        { pattern: `"${op.column}"`, matchType: 'column' },
      );
    }

    patterns.push({ pattern: op.table, matchType: 'table' });

    for (const { pattern, matchType } of patterns) {
      try {
        const grepResult = execSync(
          `grep -rn --include="*.ts" --include="*.js" --include="*.py" \
           --include="*.rb" --include="*.go" --include="*.php" \
           --exclude-dir=node_modules --exclude-dir=.git \
           --exclude-dir=dist --exclude-dir=vendor \
           "${pattern}" ${repoRoot} 2>/dev/null || true`,
          { encoding: 'utf-8', maxBuffer: 5 * 1024 * 1024 }
        );

        if (grepResult.trim()) {
          const lines = grepResult.trim().split('\n');
          for (const line of lines.slice(0, 50)) { // cap ที่ 50 matches
            const match = line.match(/^(.+):(\d+):(.+)$/);
            if (match) {
              refs.push({
                file: match[1].replace(repoRoot, ''),
                line: parseInt(match[2]),
                content: match[3].trim(),
                matchType,
              });
            }
          }
        }
      } catch {
        // grep ไม่เจอ = ดี, ข้ามได้
      }
    }

    if (refs.length > 0) {
      results.set(key, refs);
    }
  }

  return results;
}
