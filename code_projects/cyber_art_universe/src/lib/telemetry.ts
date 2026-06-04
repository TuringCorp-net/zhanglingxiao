// 系统遥测 —— AI 调用用量统计与健康度监控
// 记录每次大模型调用的 token 使用量、缓存命中率等。
// 数据写入 D1 ai_usage_log 表，同时 console.log 结构化日志供实时查看。

import { Env } from '../db/schema';

// ============================================================
// 类型
// ============================================================

export interface AIUsageRecord {
  work_id: string;
  user_token: string;     // 脱敏后的用户标识（token 前 8 位）
  page: 'read' | 'write';
  model: string;
  tokens_in: number;
  tokens_out: number;
  cache_hit: number;
  cache_miss: number;
}

// ============================================================
// 主入口
// ============================================================

/**
 * 记录一次 AI 调用。同时写 console.log 和 D1。
 */
export async function recordAIUsage(env: Env, record: AIUsageRecord): Promise<void> {
  // 1. 结构化日志（可在 Cloudflare Dashboard → Logs 实时查看）
  console.log(JSON.stringify({
    _type: 'ai_usage',
    ...record,
  }));

  // 2. 写入 D1
  const id = `${record.work_id.slice(0,8)}_${Date.now()}`;
  await env.DB.prepare(
    'INSERT INTO ai_usage_log (id, work_id, user_token, page, model, tokens_in, tokens_out, cache_hit, cache_miss, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
  ).bind(id, record.work_id, record.user_token, record.page, record.model,
    record.tokens_in, record.tokens_out, record.cache_hit, record.cache_miss, Date.now()
  ).run();
}

/**
 * 从 Authorization header 提取用户标识（完整 token）。
 * 目前为开发和测试阶段，token 硬编码在环境变量中。
 * 未来实现用户注册后，token 由服务端生成（一次性展示，用户保管），
 * 服务端只存 hash(token) 做验证，token 本身即为用户标识。
 */
export function extractUserToken(request: Request): string {
  const auth = request.headers.get('Authorization') || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : auth;
  return token || 'anonymous';
}
