// L0: AI Gateway 客户端
// 通过 Cloudflare AI Gateway（BYOK）统一调用大模型。
// 这是最底层的基础设施——除非 Gateway 本身变更，否则不应修改此文件。

import { Env } from '../../db/schema';

// ============================================================
// 类型定义
// ============================================================

/** 标准消息格式 */
export interface Message {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

/** callAI 调用选项 */
export interface AICallOptions {
  model?: string;
  maxTokens?: number;
  temperature?: number;
  timeout?: number;        // 默认 30000ms
  retries?: number;        // 默认 2（共 3 次尝试）
  responseFormat?: 'text' | 'json';
}

/** callAI 返回结果 */
export interface AICallResult {
  content: string;
  model: string;
  usage?: { input: number; output: number; cacheHit?: number; cacheMiss?: number };
}

/** AI 错误 */
export class AIError extends Error {
  code: 'TIMEOUT' | 'RATE_LIMITED' | 'AUTH_FAILED' | 'MODEL_UNAVAILABLE' | 'INVALID_RESPONSE' | 'UNKNOWN';
  statusCode?: number;

  constructor(code: AIError['code'], message: string, statusCode?: number) {
    super(message);
    this.name = 'AIError';
    this.code = code;
    this.statusCode = statusCode;
  }
}

// ============================================================
// 配置（硬编码常量，不应随意修改）
// ============================================================

const ACCOUNT_ID = '21303cf88c8c1cc2c97d78eabda103a2';
const GATEWAY_NAME = 'turingcorp';

/** 模型 → AI Gateway provider 映射 */
const MODEL_PROVIDER: Record<string, string> = {
  'deepseek-v4-flash': 'deepseek',
  'deepseek-v4-pro': 'deepseek',
  'gpt-4o': 'openai',
  'gpt-4o-mini': 'openai',
};

const DEFAULT_MODEL = 'deepseek-v4-flash';
const DEFAULT_TIMEOUT = 30000;
const DEFAULT_RETRIES = 2;

// ============================================================
// Gateway URL 构建
// ============================================================

function buildGatewayURL(model: string): string {
  const provider = MODEL_PROVIDER[model];
  if (!provider) {
    throw new AIError('MODEL_UNAVAILABLE', `Unknown model: ${model}`);
  }
  return `https://gateway.ai.cloudflare.com/v1/${ACCOUNT_ID}/${GATEWAY_NAME}/${provider}/chat/completions`;
}

// ============================================================
// 核心函数：callAI
// ============================================================

/**
 * 通过 Cloudflare AI Gateway 调用大模型。
 *
 * @param env       Worker Env（需包含 CF_AIG_TOKEN Secret）
 * @param messages  标准消息数组，支持 system / user / assistant
 * @param options   可选：model, maxTokens, temperature, timeout, retries, responseFormat
 * @returns AICallResult { content, model, usage? }
 * @throws AIError  超时、限流、认证失败等
 */
export async function callAI(
  env: Env,
  messages: Message[],
  options: AICallOptions = {},
): Promise<AICallResult> {
  const token = env.CF_AIG_TOKEN;
  if (!token) {
    throw new AIError('AUTH_FAILED', 'CF_AIG_TOKEN not configured');
  }

  const model = options.model || DEFAULT_MODEL;
  const url = buildGatewayURL(model);
  const maxRetries = options.retries ?? DEFAULT_RETRIES;
  const timeoutMs = options.timeout ?? DEFAULT_TIMEOUT;

  // —— 构建请求体 ——
  let systemPrompt = '';
  const chatMessages: { role: string; content: string }[] = [];

  for (const msg of messages) {
    if (msg.role === 'system') {
      systemPrompt += (systemPrompt ? '\n\n' : '') + msg.content;
    } else {
      chatMessages.push({ role: msg.role, content: msg.content });
    }
  }

  const body: Record<string, unknown> = {
    model,
    messages: systemPrompt
      ? [{ role: 'system', content: systemPrompt }, ...chatMessages]
      : chatMessages,
  };
  if (options.maxTokens !== undefined) body.max_tokens = options.maxTokens;
  if (options.temperature !== undefined) body.temperature = options.temperature;

  // JSON 模式：追加指令
  if (options.responseFormat === 'json') {
    body.messages = [
      ...(body.messages as { role: string; content: string }[]),
      { role: 'system', content: 'You must respond with valid JSON only. No markdown fences, no explanatory text.' },
    ];
  }

  // —— 发起请求（带重试 + 超时） ——
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'cf-aig-authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      // 429 / 5xx → 重试
      if ((response.status === 429 || response.status >= 500) && attempt < maxRetries) {
        const delay = Math.pow(2, attempt) * 500;
        await new Promise(r => setTimeout(r, delay));
        continue;
      }

      // 4xx（非 429） → 不重试
      if (response.status === 401 || response.status === 403) {
        throw new AIError('AUTH_FAILED', `AI Gateway auth failed: ${response.status}`, response.status);
      }
      if (response.status === 429) {
        throw new AIError('RATE_LIMITED', 'Rate limited by AI Gateway', response.status);
      }
      if (!response.ok) {
        throw new AIError('MODEL_UNAVAILABLE', `Model returned ${response.status}`, response.status);
      }

      const result = await response.json() as {
        choices?: { message?: { content?: string } }[];
        model?: string;
        usage?: { prompt_tokens?: number; completion_tokens?: number; prompt_cache_hit_tokens?: number; prompt_cache_miss_tokens?: number };
      };

      const content = result?.choices?.[0]?.message?.content?.trim();
      if (!content) {
        throw new AIError('INVALID_RESPONSE', 'Empty response from model');
      }

      // JSON 模式：提取 JSON（去除可能的 markdown fence）
      let finalContent = content;
      if (options.responseFormat === 'json') {
        const fenceMatch = finalContent.match(/```(?:json)?\s*([\s\S]*?)```/);
        if (fenceMatch) finalContent = fenceMatch[1].trim();
        try { JSON.parse(finalContent); } catch { /* 返回原始内容 */ }
      }

      return {
        content: finalContent,
        model: result.model || model,
        usage: result.usage ? {
          input: result.usage.prompt_tokens || 0,
          output: result.usage.completion_tokens || 0,
          cacheHit: result.usage.prompt_cache_hit_tokens || 0,
          cacheMiss: result.usage.prompt_cache_miss_tokens || 0,
        } : undefined,
      };

    } catch (err) {
      clearTimeout(timeoutId);
      lastError = err as Error;

      if (err instanceof Error && err.name === 'AbortError') {
        if (attempt < maxRetries) {
          await new Promise(r => setTimeout(r, Math.pow(2, attempt) * 500));
          continue;
        }
        throw new AIError('TIMEOUT', `AI call timed out after ${timeoutMs}ms`);
      }

      if (err instanceof AIError) throw err;

      if (attempt < maxRetries) {
        await new Promise(r => setTimeout(r, Math.pow(2, attempt) * 500));
        continue;
      }
    }
  }

  throw new AIError('UNKNOWN', `AI call failed after ${maxRetries + 1} attempts: ${lastError?.message}`);
}

// ============================================================
// 兼容层：generateWithAI（旧接口）
// ============================================================

/** @deprecated 使用 callAI(env, messages, options) 替代 */
export interface AIOptions {
  model?: string;
  maxTokens?: number;
  temperature?: number;
}

/**
 * @deprecated 使用 callAI(env, messages, options) 替代。
 *             此兼容包装将单一 prompt 转为单条 user message。
 */
export async function generateWithAI(
  env: Env,
  prompt: string,
  opts: AIOptions = {},
): Promise<string | null> {
  try {
    const result = await callAI(env, [{ role: 'user', content: prompt }], {
      model: opts.model,
      maxTokens: opts.maxTokens,
      temperature: opts.temperature,
    });
    return result.content;
  } catch (err) {
    console.error('[generateWithAI] failed:', (err as Error).message);
    return null;
  }
}

/** 检查 AI 服务是否可用 */
export function isAIAvailable(env: Env): boolean {
  return !!env.CF_AIG_TOKEN;
}
