// src/middleware/ai-safety.ts
// Middleware ที่ตรวจก่อนส่งข้อมูลให้ AI

interface SafetyCheckResult {
  safe: boolean;
  issues: string[];
  sanitized?: string;
}

const PII_PATTERNS = [
  { name: 'Thai ID Card',    regex: /\b[0-9]{13}\b/ },
  { name: 'Email',           regex: /\b[\w.]+@[\w.]+\.[a-z]{2,}\b/gi },
  { name: 'Thai Phone',      regex: /\b0[0-9]{9}\b/ },
  { name: 'Credit Card',     regex: /\b[0-9]{4}[\s-][0-9]{4}[\s-][0-9]{4}[\s-][0-9]{4}\b/ },
  { name: 'Thai Name',       regex: /(?:นาย|นาง|นางสาว|ด\.ช\.|ด\.ญ\.)\s+\S+\s+\S+/ },
];

const SENSITIVE_KEYWORDS = [
  'รหัสผ่าน', 'password', 'secret', 'api_key', 'private_key',
  'ผลตรวจเลือด', 'โรคมะเร็ง', 'HIV', 'ยาเสพติด',
];

export function checkAISafety(text: string): SafetyCheckResult {
  const issues: string[] = [];
  let sanitized = text;

  // ตรวจ PII patterns
  for (const pattern of PII_PATTERNS) {
    if (pattern.regex.test(text)) {
      issues.push(`Found potential ${pattern.name}`);
      sanitized = sanitized.replace(pattern.regex, `[${pattern.name.toUpperCase()}]`);
    }
  }

  // ตรวจ sensitive keywords
  for (const keyword of SENSITIVE_KEYWORDS) {
    if (text.toLowerCase().includes(keyword.toLowerCase())) {
      issues.push(`Contains sensitive keyword: ${keyword}`);
    }
  }

  return {
    safe: issues.length === 0,
    issues,
    sanitized: issues.length > 0 ? sanitized : undefined,
  };
}

// Express middleware
export function aiSafetyMiddleware(req, res, next) {
  const userInput = req.body.message || req.body.prompt || '';
  const check = checkAISafety(userInput);

  if (!check.safe) {
    // Option A: Block request
    // return res.status(400).json({ error: 'Input contains sensitive data', issues: check.issues });

    // Option B: Auto-sanitize and continue
    req.body.message = check.sanitized;
    req.aiSafetyWarnings = check.issues;

    // Log for audit
    logger.warn('AI Safety: Auto-sanitized input', {
      userId: req.user?.id,
      issues: check.issues,
      timestamp: new Date().toISOString(),
    });
  }

  next();
}
