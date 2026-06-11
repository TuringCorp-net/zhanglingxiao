/**
 * 用户级配置（R2: users/{userToken}/config.json，语言无关）
 *
 * 三层存储模型:
 *   系统级 — 全局配置
 *   用户级 — 本文件，按 userToken 隔离，跨设备持久化
 *   作品级 — works/{id}/config.json
 */

import { Env } from '../../db/schema';
import { jsonSuccess, jsonError } from '../../lib/response';
import { ErrorCodes } from '../../lib/errors';
import { extractUserToken } from '../../lib/telemetry';

interface UserConfig {
  current_work_id?: string | null;
}

// GET /api/write/me/config
export async function getUserConfig(env: Env, request: Request): Promise<Response> {
  const userToken = extractUserToken(request);
  const key = `users/${userToken}/config.json`;
  const obj = await env.WORKS_BUCKET.get(key);
  const config: UserConfig = obj ? JSON.parse(await obj.text()) : {};
  return new Response(JSON.stringify(jsonSuccess(config)), {
    headers: { 'Content-Type': 'application/json' },
  });
}

// PUT /api/write/me/config
export async function updateUserConfig(env: Env, request: Request): Promise<Response> {
  const userToken = extractUserToken(request);
  const body = await request.json() as UserConfig;
  const key = `users/${userToken}/config.json`;

  // 读取已有配置，合并写入（不覆盖未传入的字段）
  const existing = await env.WORKS_BUCKET.get(key);
  const current: UserConfig = existing ? JSON.parse(await existing.text()) : {};
  const merged: UserConfig = {};
  if (body.current_work_id !== undefined) merged.current_work_id = body.current_work_id || null;
  const config = { ...current, ...merged };

  await env.WORKS_BUCKET.put(key, JSON.stringify(config), {
    httpMetadata: { contentType: 'application/json' },
  });
  return new Response(JSON.stringify(jsonSuccess(config)), {
    headers: { 'Content-Type': 'application/json' },
  });
}
