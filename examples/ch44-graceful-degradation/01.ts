// src/ai-gateway/circuit-breaker.ts

type State = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

interface CircuitBreakerOptions {
  failureThreshold: number;   // จำนวน failure ที่ยอมรับได้
  successThreshold: number;   // จำนวน success ที่ต้องการก่อนปิด circuit
  timeout: number;            // ms ที่รอก่อน try อีกครั้ง
  volumeThreshold: number;    // requests ขั้นต่ำก่อนนับ failure rate
}

export class CircuitBreaker {
  private state: State = 'CLOSED';
  private failures = 0;
  private successes = 0;
  private nextAttempt = 0;
  private callCount = 0;

  constructor(
    private readonly name: string,
    private readonly opts: CircuitBreakerOptions
  ) {}

  get isOpen(): boolean {
    if (this.state === 'OPEN') {
      // ถ้าถึงเวลา retry แล้ว → ลองเปิด HALF_OPEN
      if (Date.now() >= this.nextAttempt) {
        this.state = 'HALF_OPEN';
        console.log(`[CircuitBreaker] ${this.name}: OPEN → HALF_OPEN`);
        return false;
      }
      return true;
    }
    return false;
  }

  recordSuccess(): void {
    this.failures = 0;
    this.callCount++;

    if (this.state === 'HALF_OPEN') {
      this.successes++;
      if (this.successes >= this.opts.successThreshold) {
        this.state = 'CLOSED';
        this.successes = 0;
        console.log(`[CircuitBreaker] ${this.name}: HALF_OPEN → CLOSED ✅`);
      }
    }
  }

  recordFailure(): void {
    this.failures++;
    this.successes = 0;
    this.callCount++;

    if (this.state === 'HALF_OPEN') {
      // HALF_OPEN fail → กลับไป OPEN
      this.trip();
      return;
    }

    if (
      this.callCount >= this.opts.volumeThreshold &&
      this.failures >= this.opts.failureThreshold
    ) {
      this.trip();
    }
  }

  private trip(): void {
    this.state = 'OPEN';
    this.nextAttempt = Date.now() + this.opts.timeout;
    console.log(`[CircuitBreaker] ${this.name}: TRIPPED 🔴 (retry in ${this.opts.timeout}ms)`);
  }

  getState(): State { return this.state; }
}
