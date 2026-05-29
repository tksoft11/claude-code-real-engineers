// src/types/task.ts
interface Task {
  id: string;                    // UUID
  type: TaskType;                // ประเภทงาน
  status: TaskStatus;            // สถานะปัจจุบัน
  priority: 1 | 2 | 3;          // 1 = สูงสุด
  payload: Record<string, unknown>; // ข้อมูลที่ Agent ต้องการ
  result?: Record<string, unknown>; // ผลลัพธ์เมื่อเสร็จ
  error?: string;                // Error message ถ้าล้มเหลว
  blockerReason?: string;        // เหตุผลที่ต้องรอ Human
  agentId?: string;              // Agent ที่กำลังทำงาน
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  retryCount: number;
  maxRetries: number;
}

enum TaskType {
  ANALYZE_MODULE = 'analyze_module',
  IMPLEMENT_SERVICE = 'implement_service',
  WRITE_TESTS = 'write_tests',
  REVIEW_CODE = 'review_code',
  GENERATE_DOCS = 'generate_docs',
  RUN_MIGRATION = 'run_migration',
}

enum TaskStatus {
  PENDING = 'pending',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  FAILED = 'failed',
  BLOCKED = 'blocked',        // รอ Human
  NEEDS_REVIEW = 'needs_review', // รอ Human Review
}
