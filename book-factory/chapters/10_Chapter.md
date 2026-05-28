# บทที่ 10: Self-Healing Scripts — ระบบที่แก้ตัวเองได้

---

## 🪝 สคริปต์ที่พังตี 3 เพราะ npm update

กุมภาพันธ์ 2025 — ทีม DevOps ตั้ง Cron Job รันสคริปต์สำรองข้อมูล Database ทุกคืนตี 2

คืนหนึ่ง npm ทำ automatic security update ของ library `node-postgres` จาก 8.11.0 → 8.11.3 ซึ่งเปลี่ยน connection string format เล็กน้อย

สคริปต์ backup ล้มเหลว เงียบๆ ตี 2:07 น.

ไม่มีใครรู้จนกว่าจะต้องใช้ backup จริงๆ 3 สัปดาห์ต่อมา — ตอนนั้นไม่มี backup ย้อนหลัง 21 วัน

**ราคา:** ข้อมูลที่หายไปไม่มีวันกลับมา

Self-Healing Script จะไม่ปล่อยให้เรื่องนี้เกิดขึ้น

---

## 🧠 Self-Healing Script คืออะไร

Script ทั่วไป:
```
รัน → ถ้า error → พัง → หยุด → รอคนมาแก้
```

Self-Healing Script:
```
รัน → ถ้า error → วิเคราะห์สาเหตุ → พยายามแก้เอง
     → ถ้าแก้ได้ → ทำงานต่อ
     → ถ้าแก้ไม่ได้ → แจ้งเตือนคน + บันทึก context ครบถ้วน
```

**องค์ประกอบ 5 อย่างของ Self-Healing Script:**

```
1. 🔍 Environment Validation    ตรวจก่อนรันว่าทุกอย่างพร้อม
2. 🔄 Retry with Backoff        ลองใหม่อัตโนมัติถ้า error ชั่วคราว
3. 🛠️ Auto-Fix Known Issues     แก้ปัญหาที่รู้จักอัตโนมัติ
4. 📊 Health Monitoring         ติดตาม metrics ระหว่างทำงาน
5. 🚨 Smart Alerting            แจ้งเตือนพร้อม context เมื่อแก้ไม่ได้
```

---

## 🔍 Pillar 1: Environment Validation

ตรวจสอบทุกอย่างก่อนเริ่มงาน:

```typescript
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
```

ใช้ตอนเริ่ม script:

```typescript
// main.ts
async function main() {
  console.log('🔍 Validating environment...');
  const validation = await validateEnvironment();

  if (validation.autoFixed.length > 0) {
    logger.info('Auto-fixed issues:', validation.autoFixed);
    await notify.slack(`🔧 Script auto-fixed ${validation.autoFixed.length} issues before starting`);
  }

  if (!validation.passed) {
    logger.error('Environment validation failed:', validation.issues);
    await notify.pagerduty('Script cannot start — environment issues', validation.issues);
    process.exit(1);
  }

  // ทำงานได้อย่างปลอดภัยแล้ว
  await runMainTask();
}
```

---

## 🔄 Pillar 2: Retry with Exponential Backoff

Network เป็น error ชั่วคราวเสมอ — อย่า fail ทันที:

```typescript
// src/utils/retry.ts
interface RetryOptions {
  maxAttempts: number;
  initialDelayMs: number;
  maxDelayMs: number;
  shouldRetry?: (error: Error, attempt: number) => boolean;
  onRetry?: (error: Error, attempt: number, delayMs: number) => void;
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions
): Promise<T> {
  const {
    maxAttempts,
    initialDelayMs,
    maxDelayMs,
    shouldRetry = () => true,
    onRetry,
  } = options;

  let lastError: Error;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;

      if (attempt === maxAttempts) break;
      if (!shouldRetry(lastError, attempt)) break;

      // Exponential backoff with jitter
      const baseDelay = Math.min(
        initialDelayMs * Math.pow(2, attempt - 1),
        maxDelayMs
      );
      const jitter = Math.random() * baseDelay * 0.1;
      const delay = baseDelay + jitter;

      onRetry?.(lastError, attempt, delay);
      await sleep(delay);
    }
  }

  throw lastError!;
}

// ใช้งาน
const data = await withRetry(
  () => fetchFromAPI(url),
  {
    maxAttempts: 5,
    initialDelayMs: 1000,  // 1 วินาที
    maxDelayMs: 30000,      // สูงสุด 30 วินาที
    shouldRetry: (error) => {
      // Retry เฉพาะ network errors ไม่ retry validation errors
      return error.name === 'NetworkError' ||
             error.message.includes('ECONNRESET') ||
             error.message.includes('timeout');
    },
    onRetry: (error, attempt, delay) => {
      logger.warn(`Attempt ${attempt} failed: ${error.message}. Retrying in ${delay}ms`);
    },
  }
);
```

---

## 🛠️ Pillar 3: Auto-Fix Known Issues

สร้าง "Fix Registry" สำหรับปัญหาที่รู้จัก:

```typescript
// src/utils/auto-fixer.ts
type FixResult = { fixed: boolean; action: string };

const knownFixes: Record<string, (error: Error) => Promise<FixResult>> = {
  // Fix: Database connection pool exhausted
  'connection pool exhausted': async () => {
    await prisma.$disconnect();
    await sleep(2000);
    await prisma.$connect();
    return { fixed: true, action: 'Reconnected database pool' };
  },

  // Fix: Redis connection lost
  'ECONNREFUSED redis': async () => {
    await redisClient.disconnect();
    await sleep(1000);
    await redisClient.connect();
    return { fixed: true, action: 'Reconnected to Redis' };
  },

  // Fix: Temp directory full
  'ENOSPC': async () => {
    const cleaned = await cleanTempDirectory();
    return { fixed: cleaned > 0, action: `Freed ${cleaned}MB from temp directory` };
  },

  // Fix: JWT token expired (สำหรับ script ที่ใช้ API)
  'token expired': async () => {
    const newToken = await refreshAuthToken();
    process.env.AUTH_TOKEN = newToken;
    return { fixed: true, action: 'Refreshed expired auth token' };
  },

  // Fix: File lock โดย process อื่น
  'EBUSY': async () => {
    await sleep(5000); // รอ 5 วินาที
    return { fixed: true, action: 'Waited for file lock to release' };
  },
};

export async function tryAutoFix(error: Error): Promise<FixResult> {
  const errorMessage = error.message.toLowerCase();

  for (const [pattern, fixer] of Object.entries(knownFixes)) {
    if (errorMessage.includes(pattern.toLowerCase())) {
      try {
        const result = await fixer(error);
        logger.info(`Auto-fix applied: ${result.action}`);
        return result;
      } catch (fixError) {
        logger.warn(`Auto-fix failed for "${pattern}": ${fixError.message}`);
      }
    }
  }

  return { fixed: false, action: 'No known fix available' };
}
```

ใช้งานใน main loop:

```typescript
async function resilientTask() {
  let attempts = 0;
  const maxAutoFix = 3;

  while (attempts < maxAutoFix) {
    try {
      await performTask();
      return; // สำเร็จ
    } catch (error) {
      attempts++;
      logger.error(`Task failed (attempt ${attempts}): ${error.message}`);

      const fix = await tryAutoFix(error);
      if (fix.fixed) {
        logger.info(`Auto-fixed: ${fix.action}. Retrying...`);
        continue; // ลองใหม่หลัง fix
      }

      // แก้ไม่ได้ → escalate
      await escalateToHuman(error, fix.action);
      throw error;
    }
  }

  await escalateToHuman(new Error('Max auto-fix attempts reached'));
}
```

---

## 📊 Pillar 4: Health Monitoring ระหว่างทำงาน

```typescript
// src/utils/health-monitor.ts
class HealthMonitor {
  private metrics = {
    startTime: Date.now(),
    processedItems: 0,
    errors: 0,
    autoFixes: 0,
    lastCheckpoint: Date.now(),
  };

  private thresholds = {
    errorRatePercent: 5,    // หยุดถ้า error มากกว่า 5%
    itemsPerMinute: 100,    // แจ้งเตือนถ้าช้ากว่านี้
    maxRunTimeHours: 4,     // หยุดถ้ารันนานเกินไป
  };

  recordSuccess() {
    this.metrics.processedItems++;
    this.checkHealth();
  }

  recordError() {
    this.metrics.errors++;
    this.checkHealth();
  }

  recordAutoFix() {
    this.metrics.autoFixes++;
  }

  private checkHealth() {
    const { processedItems, errors } = this.metrics;
    const total = processedItems + errors;

    // ตรวจ error rate
    if (total > 100) {
      const errorRate = (errors / total) * 100;
      if (errorRate > this.thresholds.errorRatePercent) {
        throw new HealthCheckError(
          `Error rate too high: ${errorRate.toFixed(1)}% (threshold: ${this.thresholds.errorRatePercent}%)`
        );
      }
    }

    // ตรวจ runtime
    const hoursRunning = (Date.now() - this.metrics.startTime) / (1000 * 60 * 60);
    if (hoursRunning > this.thresholds.maxRunTimeHours) {
      throw new HealthCheckError(`Script running too long: ${hoursRunning.toFixed(1)} hours`);
    }

    // Checkpoint ทุก 1000 items
    if (processedItems % 1000 === 0 && processedItems > 0) {
      this.logCheckpoint();
    }
  }

  private logCheckpoint() {
    const elapsed = (Date.now() - this.metrics.startTime) / 1000;
    const rate = this.metrics.processedItems / (elapsed / 60);

    logger.info(`📊 Checkpoint: ${this.metrics.processedItems} processed, ` +
                `${this.metrics.errors} errors, ${this.metrics.autoFixes} auto-fixes, ` +
                `${rate.toFixed(0)} items/min`);
  }

  getSummary() {
    return { ...this.metrics, elapsedMs: Date.now() - this.metrics.startTime };
  }
}
```

---

## 🚨 Pillar 5: Smart Alerting

เมื่อแก้ไม่ได้ — แจ้งเตือนพร้อม context ครบถ้วน:

```typescript
// src/utils/alerting.ts
export async function escalateToHuman(
  error: Error,
  context: Record<string, unknown> = {}
) {
  const alert = {
    severity: 'HIGH',
    script: process.env.SCRIPT_NAME || 'unknown-script',
    error: {
      message: error.message,
      stack: error.stack?.split('\n').slice(0, 5).join('\n'), // 5 บรรทัดแรก
    },
    environment: {
      node: process.version,
      pid: process.pid,
      uptime: `${Math.round(process.uptime())}s`,
      memory: `${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`,
    },
    lastAutoFixAttempt: context.autoFixAction || 'none',
    timestamp: new Date().toISOString(),
    ...context,
  };

  // ส่ง Slack notification
  await sendSlack({
    channel: '#alerts-critical',
    text: `🚨 *Script Alert: ${alert.script}*\n` +
          `Error: ${alert.error.message}\n` +
          `Auto-fix attempted: ${alert.lastAutoFixAttempt}\n` +
          `Environment: Node ${alert.environment.node}, Memory: ${alert.environment.memory}\n` +
          `Time: ${alert.timestamp}`,
  });

  // บันทึก log เต็มรูปแบบ
  logger.error('Script escalated to human', alert);
}
```

---

## 🔧 ตัวอย่างสมบูรณ์: Self-Healing Backup Script

```typescript
// scripts/backup-database.ts — The Self-Healing Version
import { validateEnvironment, withRetry, tryAutoFix, HealthMonitor, escalateToHuman } from '../src/utils';

async function backupDatabase() {
  const monitor = new HealthMonitor();

  // Step 1: Validate before starting
  console.log('🔍 Validating environment...');
  const validation = await validateEnvironment();

  if (validation.autoFixed.length > 0) {
    logger.info('Pre-flight fixes:', validation.autoFixed);
    monitor.recordAutoFix();
  }

  if (!validation.passed) {
    await escalateToHuman(
      new Error('Environment validation failed'),
      { issues: validation.issues }
    );
    process.exit(1);
  }

  // Step 2: Create backup with retry
  console.log('💾 Starting database backup...');
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = `./backups/db-${timestamp}.sql.gz`;

  try {
    await withRetry(
      async () => {
        const dump = await pg_dump(process.env.DATABASE_URL!);
        const compressed = await gzip(dump);
        await uploadToS3(compressed, `backups/${path.basename(backupPath)}`);
        monitor.recordSuccess();
      },
      {
        maxAttempts: 3,
        initialDelayMs: 5000,
        maxDelayMs: 30000,
        shouldRetry: (err) => err.message.includes('timeout') || err.message.includes('ECONNRESET'),
        onRetry: (err, attempt, delay) => {
          logger.warn(`Backup attempt ${attempt} failed, retrying in ${delay}ms: ${err.message}`);
          monitor.recordError();
        },
      }
    );

    // Step 3: Verify backup integrity
    const isValid = await verifyBackup(backupPath);
    if (!isValid) {
      throw new Error('Backup verification failed — file may be corrupt');
    }

    // Step 4: Clean old backups (auto-maintain)
    const cleaned = await deleteBackupsOlderThan(30); // days
    if (cleaned > 0) {
      logger.info(`Auto-cleaned ${cleaned} old backup files`);
    }

    // Success!
    const summary = monitor.getSummary();
    await sendSlack({
      channel: '#ops-notifications',
      text: `✅ Database backup completed in ${(summary.elapsedMs / 1000).toFixed(0)}s\n` +
            `Auto-fixes applied: ${summary.autoFixes}`,
    });

  } catch (error) {
    // Auto-fix attempt
    const fix = await tryAutoFix(error as Error);
    if (fix.fixed) {
      logger.info(`Auto-fixed: ${fix.action}. Retrying backup...`);
      return backupDatabase(); // recursive retry หลัง fix
    }

    // Cannot fix — escalate
    await escalateToHuman(error as Error, {
      autoFixAction: fix.action,
      backupPath,
      monitorSummary: monitor.getSummary(),
    });
    process.exit(1);
  }
}

backupDatabase();
```

---

## 💻 Hands-On: สร้าง Self-Healing Script ด้วย Claude

**โจทย์:** สร้าง script sync ข้อมูลจาก API ภายนอกมาเก็บใน Database ทุกชั่วโมง

```bash
claude
```

```
"ช่วยสร้าง Self-Healing Script ที่ทำงานต่อไปนี้:
ดึงข้อมูล products จาก https://api.example.com/products ทุก 1 ชั่วโมง
แล้วบันทึกลง PostgreSQL table 'products'

Self-Healing requirements:
1. ตรวจ environment vars ก่อนเริ่ม: DATABASE_URL, API_KEY, SLACK_WEBHOOK
2. Retry API calls สูงสุด 5 ครั้ง (exponential backoff 1s → 30s)
3. Auto-fix: ถ้า database disconnected → reconnect แล้วลองใหม่
4. Auto-fix: ถ้า API rate limited (429) → รอตาม Retry-After header
5. หยุดถ้า error rate เกิน 10%
6. Slack alert เมื่อแก้ไม่ได้ พร้อม context ครบถ้วน
7. Log ทุก auto-fix action
8. บันทึก checkpoint ทุก 100 records

Tech: TypeScript, Prisma, axios"
```

---

## 🎯 สรุปบทที่ 10

| หัวข้อ | สิ่งที่ต้องจำ |
|--------|--------------|
| Script ทั่วไป | Error → พัง → รอคนแก้ |
| Self-Healing Script | Error → วิเคราะห์ → Auto-fix → ทำงานต่อ |
| 5 Pillars | Validation → Retry → Auto-fix → Monitor → Smart Alert |
| Exponential Backoff | รอนานขึ้นเรื่อยๆ + jitter เพื่อไม่ชนกัน |
| Fix Registry | รวม known fixes ไว้ที่เดียว ใช้ซ้ำได้ทุก script |
| Smart Alert | แจ้งเตือนพร้อม context — ไม่ใช่แค่ error message |

---

## 📋 Action Items ก่อนไปบทที่ 11

- [ ] เพิ่ม Environment Validation เข้า Cron Job ที่มีอยู่แล้ว
- [ ] สร้าง `src/utils/retry.ts` ที่ใช้ได้ทุก project
- [ ] เขียน Fix Registry สำหรับ errors ที่เจอบ่อยในงานจริง
- [ ] ทดสอบ: จงใจ kill Redis แล้วดูว่า script แก้เองได้ไหม

---

*ใน **บทที่ 11** เราจะสร้าง Autonomous Agent Loop ที่สมบูรณ์แบบ — ระบบที่รับ task จาก queue, ทำงาน, รายงานผล, และดึง task ถัดไปได้เองแบบ 24 ชั่วโมง ซึ่งเป็นก้าวสุดท้ายก่อนบท 12 ที่จะสรุป 10x Engineer Manifesto ครับ*
