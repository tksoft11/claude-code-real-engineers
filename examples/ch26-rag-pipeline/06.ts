// src/server.ts
import express from 'express';
import multer from 'multer';
import pdfParse from 'pdf-parse';
import fs from 'fs';
import { indexDocument } from './services/embedding.service';
import { queryCompanyBrain } from './services/rag.service';

const app = express();
const upload = multer({ dest: 'uploads/' });

app.use(express.json());

// Upload & index document
app.post('/api/documents', upload.single('file'), async (req, res) => {
  const file = req.file!;
  const { title, category } = req.body;

  try {
    let content = '';

    if (file.mimetype === 'application/pdf') {
      const pdfData = await pdfParse(fs.readFileSync(file.path));
      content = pdfData.text;
    } else {
      content = fs.readFileSync(file.path, 'utf-8');
    }

    fs.unlinkSync(file.path); // cleanup

    const docId = await indexDocument(file.originalname, title || file.originalname, content, category);
    res.json({ success: true, documentId: docId, message: 'Document indexed successfully' });

  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Query
app.post('/api/query', async (req, res) => {
  const { question, category } = req.body;
  if (!question) return res.status(400).json({ error: 'question required' });

  const result = await queryCompanyBrain(question, category);
  res.json(result);
});

// Streaming query
app.post('/api/query/stream', async (req, res) => {
  const { question, category } = req.body;

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.flushHeaders();

  const { searchSimilar } = await import('./services/embedding.service');
  const Anthropic = (await import('@anthropic-ai/sdk')).default;
  const claude = new Anthropic();

  const chunks = await searchSimilar(question, 4, category);
  const context = chunks.map((c, i) => `[${i+1}: ${c.title}]\n${c.text}`).join('\n\n');

  const stream = await claude.messages.stream({
    model: 'claude-haiku-4-5',
    max_tokens: 1024,
    system: 'คุณคือ Company Brain AI ตอบจาก Context เท่านั้น ตอบภาษาไทย',
    messages: [{ role: 'user', content: `Context:\n${context}\n\nคำถาม: ${question}` }],
  });

  for await (const event of stream) {
    if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
      res.write(`data: ${JSON.stringify({ text: event.delta.text })}\n\n`);
    }
  }

  const sources = [...new Set(chunks.map(c => c.title))];
  res.write(`data: ${JSON.stringify({ done: true, sources })}\n\n`);
  res.end();
});

app.listen(3000, () => console.log('Company Brain running on :3000'));
