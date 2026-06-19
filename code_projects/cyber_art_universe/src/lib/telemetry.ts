/**
 * 系统遥测 — AI 调用用量统计与健康度监控
 *
 * 覆盖需求 (Story Elf SRS):
 *   SE-080: AI 用量记录 — recordAIUsage() 写入 D1 ai_usage_log 表 + console.log
 *   SE-081: 用户级用量统计 — user_token 字段区分用户
 *
 * ⚠️ extractUserToken 已删除。获取用户标识请用 auth.ts 的 getUserId(env)。
 */

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
