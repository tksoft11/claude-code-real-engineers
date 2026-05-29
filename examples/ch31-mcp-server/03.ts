// src/utils/api-client.ts
import axios, { AxiosInstance } from 'axios';

export function createApiClient(baseURL: string, apiKey: string): AxiosInstance {
  const client = axios.create({
    baseURL,
    timeout: 10000,
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
  });

  // Retry on network errors
  client.interceptors.response.use(
    res => res,
    async err => {
      if (err.code === 'ECONNABORTED' || err.response?.status >= 500) {
        // Simple retry once
        await new Promise(r => setTimeout(r, 1000));
        return client.request(err.config);
      }
      throw err;
    }
  );

  return client;
}

// PII Sanitizer — ลบข้อมูลที่ไม่ควรส่งให้ AI
export function sanitize<T extends Record<string, unknown>>(
  data: T,
  sensitiveFields: string[] = ['salary', 'bankAccount', 'taxId', 'password', 'ssn']
): Partial<T> {
  const result = { ...data };
  for (const field of sensitiveFields) {
    delete result[field];
  }
  return result;
}
