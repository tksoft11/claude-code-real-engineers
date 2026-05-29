// src/routing/model-router.ts

type ModelTier = 'fast' | 'balanced' | 'powerful';

interface RoutingConfig {
  model: string;
  maxTokens: number;
  reasoning: string;
}

const MODELS: Record<ModelTier, string> = {
  fast:     'claude-haiku-4-5',
  balanced: 'claude-sonnet-4-5',
  powerful: 'claude-opus-4-5',
};

interface RoutingRequest {
  prompt: string;
  taskType?: string;
  requiresCode?: boolean;
  requiresReasoning?: boolean;
  maxComplexity?: 'low' | 'medium' | 'high';
}

export function routeModel(req: RoutingRequest): RoutingConfig {
  const promptLength = req.prompt.length;

  // ===== FAST (Haiku) =====
  // งานง่าย ไม่ต้องการ reasoning ซับซ้อน
  if (
    req.taskType === 'classify' ||
    req.taskType === 'format' ||
    req.taskType === 'translate' ||
    req.maxComplexity === 'low' ||
    (promptLength < 500 && !req.requiresCode && !req.requiresReasoning)
  ) {
    return {
      model: MODELS.fast,
      maxTokens: 512,
      reasoning: 'Simple task — Haiku sufficient',
    };
  }

  // ===== POWERFUL (Opus) =====
  // งานที่ต้องการ reasoning ระดับสูง
  if (
    req.taskType === 'architecture-review' ||
    req.taskType === 'security-audit' ||
    req.requiresReasoning ||
    req.maxComplexity === 'high' ||
    promptLength > 10000
  ) {
    return {
      model: MODELS.powerful,
      maxTokens: 4096,
      reasoning: 'Complex reasoning required — Opus needed',
    };
  }

  // ===== BALANCED (Sonnet) =====
  // งานทั่วไป
  return {
    model: MODELS.balanced,
    maxTokens: 2048,
    reasoning: 'General task — Sonnet balanced choice',
  };
}

// ใช้งาน
const config = routeModel({
  prompt: userMessage,
  taskType: 'classify',
});

const response = await client.messages.create({
  model: config.model,
  max_tokens: config.maxTokens,
  messages: [{ role: 'user', content: userMessage }],
});

console.log(`Used: ${config.model} (${config.reasoning})`);
