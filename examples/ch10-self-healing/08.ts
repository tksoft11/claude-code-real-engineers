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
