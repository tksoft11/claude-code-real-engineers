// src/resources/policies.ts
import { Resource } from '@modelcontextprotocol/sdk/types.js';
import { createApiClient } from '../utils/api-client';
import fs from 'fs';
import path from 'path';

const docsApi = createApiClient(process.env.DOCS_API_URL!, process.env.DOCS_API_KEY!);

export const companyResources: Resource[] = [
  {
    uri: 'company://policies/leave',
    name: 'Leave Policy',
    description: 'นโยบายการลาพักร้อน ลาป่วย และลากิจ',
    mimeType: 'text/markdown',
  },
  {
    uri: 'company://policies/it-security',
    name: 'IT Security Policy',
    description: 'นโยบาย IT Security และการใช้งานอุปกรณ์',
    mimeType: 'text/markdown',
  },
  {
    uri: 'company://org/structure',
    name: 'Organization Structure',
    description: 'โครงสร้างองค์กรและ reporting lines ทั้งหมด',
    mimeType: 'application/json',
  },
];

export async function readResource(uri: string): Promise<string> {
  if (uri === 'company://policies/leave') {
    const res = await docsApi.get('/policies/leave');
    return res.data.content || res.data;
  }
  if (uri === 'company://policies/it-security') {
    const res = await docsApi.get('/policies/it-security');
    return res.data.content || res.data;
  }
  if (uri === 'company://org/structure') {
    const res = await docsApi.get('/org/structure');
    return JSON.stringify(res.data, null, 2);
  }
  throw new Error(`Resource not found: ${uri}`);
}
