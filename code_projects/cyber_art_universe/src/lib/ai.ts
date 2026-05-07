// AI Provider 共享模块 — 从 Findora 提取的 provider-agnostic 模式
import { Env } from '../db/schema';

interface AIConfig {
  provider: 'openai' | 'anthropic';
  apiKey: string;
}

export interface AIOptions {
  model?: string;
  maxTokens?: number;
  temperature?: number;
}

function getAIConfig(env: Env): AIConfig | null {
  const provider = env.AI_PROVIDER;
  const apiKey = env.AI_API_KEY;
  if (!provider || !apiKey) return null;
  if (provider !== 'openai' && provider !== 'anthropic') return null;
  return { provider, apiKey };
}

async function callOpenAI(apiKey: string, prompt: string, opts: AIOptions = {}): Promise<string | null> {
  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: opts.model || 'gpt-4o',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: opts.maxTokens || 1024,
        temperature: opts.temperature ?? 0.7,
      }),
    });
    if (!response.ok) { console.error('OpenAI API error:', response.status); return null; }
    const result = await response.json() as { choices?: { message?: { content?: string } }[] };
    return result?.choices?.[0]?.message?.content?.trim() || null;
  } catch (err) { console.error('OpenAI call failed:', err); return null; }
}

async function callAnthropic(apiKey: string, prompt: string, opts: AIOptions = {}): Promise<string | null> {
  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': apiKey, 'Content-Type': 'application/json', 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: opts.model || 'claude-sonnet-4-20250514',
        max_tokens: opts.maxTokens || 1024,
        messages: [{ role: 'user', content: prompt }],
      }),
    });
    if (!response.ok) { console.error('Anthropic API error:', response.status); return null; }
    const result = await response.json() as { content?: { text?: string }[] };
    return result?.content?.[0]?.text?.trim() || null;
  } catch (err) { console.error('Anthropic call failed:', err); return null; }
}

/**
 * 统一的 AI 调用入口。根据 env.AI_PROVIDER 自动选择 OpenAI / Anthropic。
 * @param env Worker Env
 * @param prompt 完整的提示词
 * @param opts 可选：model, maxTokens, temperature
 */
export async function generateWithAI(env: Env, prompt: string, opts: AIOptions = {}): Promise<string | null> {
  const config = getAIConfig(env);
  if (!config) return null;
  if (config.provider === 'openai') return callOpenAI(config.apiKey, prompt, opts);
  return callAnthropic(config.apiKey, prompt, opts);
}

/**
 * 检查 AI 服务是否可用
 */
export function isAIAvailable(env: Env): boolean {
  return getAIConfig(env) !== null;
}
