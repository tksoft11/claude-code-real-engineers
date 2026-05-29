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
