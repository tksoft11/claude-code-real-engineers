// src/utils/env-validator.ts
import { execSync } from 'child_process';

interface ValidationResult {
  passed: boolean;
  issues: string[];
  autoFixed: string[];
}

export async function validateEnvironment(): Promise<ValidationResult> {
  const issues: string[] = [];
  const autoFixed: string[] = [];

  // 1. ตรวจ Environment Variables
  const requiredEnvVars = ['DATABASE_URL', 'REDIS_URL', 'AWS_BUCKET'];
  for (const envVar of requiredEnvVars) {
    if (!process.env[envVar]) {
      issues.push(`Missing required env var: ${envVar}`);
    }
  }

  // 2. ตรวจ Database Connection
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch (error) {
    issues.push(`Database unreachable: ${error.message}`);
  }

  // 3. ตรวจ Disk Space
  const diskUsage = getDiskUsagePercent('/');
  if (diskUsage > 90) {
    issues.push(`Disk usage critical: ${diskUsage}%`);
  } else if (diskUsage > 80) {
    // Auto-fix: ลบ log files เก่า
    try {
      execSync('find /var/log -name "*.log" -mtime +30 -delete');
      autoFixed.push(`Cleaned old log files (disk was ${diskUsage}%)`);
    } catch {}
  }

  // 4. ตรวจ Dependencies
  try {
    execSync('npm ls --depth=0', { stdio: 'pipe' });
  } catch (error) {
    // Auto-fix: npm install
    try {
      execSync('npm ci', { stdio: 'pipe' });
      autoFixed.push('Reinstalled npm dependencies');
    } catch (installError) {
      issues.push(`Dependency issues: ${installError.message}`);
    }
  }

  // 5. ตรวจ Required Directories
  const requiredDirs = ['./logs', './temp', './backups'];
  for (const dir of requiredDirs) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      autoFixed.push(`Created missing directory: ${dir}`);
    }
  }

  return {
    passed: issues.length === 0,
    issues,
    autoFixed,
  };
}
