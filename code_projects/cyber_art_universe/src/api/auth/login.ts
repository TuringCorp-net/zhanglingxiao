/**
 * POST /api/auth/login — 登录获取 Token
 * Phase 0
 */
import { Env } from '../../db/schema';
import { jsonSuccess, jsonError } from '../../lib/response';
import { ErrorCodes } from '../../lib/errors';
import { sha256 } from '../../lib/auth';

export async function handleLogin(env: Env, request: Request): Promise<Response> {
  const body = await request.json() as Record<string, unknown>;
  const cyberName = String(body.cyber_name || '').trim();
  const key = String(body.key || '');

  if (!cyberName || !key) {
    return new Response(JSON.stringify(jsonError(ErrorCodes.INVALID_CREDENTIALS, 'Cyber Name and key are required')), {
      status: 401, headers: { 'Content-Type': 'application/json' },
    });
  }

  // 查询用户
  const user = await env.DB.prepare(
    'SELECT * FROM users WHERE cyber_name = ?'
  ).bind(cyberName).first<Record<string, unknown>>();

  if (!user) {
    return new Response(JSON.stringify(jsonError(ErrorCodes.INVALID_CREDENTIALS, 'Invalid Cyber Name or key')), {
      status: 401, headers: { 'Content-Type': 'application/json' },
    });
  }

  // 验证密钥
  const expectedHash = await sha256(key + String(user.entropy_seed));
  if (expectedHash !== String(user.auth_key_hash)) {
    return new Response(JSON.stringify(jsonError(ErrorCodes.INVALID_CREDENTIALS, 'Invalid Cyber Name or key')), {
      status: 401, headers: { 'Content-Type': 'application/json' },
    });
  }

  // 生成新 Token
  const token = 'cau_' + crypto.randomUUID().replace(/-/g, '') + Array.from(crypto.getRandomValues(new Uint8Array(8))).map(b => b.toString(16).padStart(2, '0')).join('');
  const tokenHash = await sha256(token);
  const now = new Date().toISOString();

  await env.DB.prepare(
    'INSERT INTO sessions (id, user_id, token_hash, created_at) VALUES (?, ?, ?, ?)'
  ).bind(crypto.randomUUID(), user.id, tokenHash, now).run();

  // 更新活跃时间
  await env.DB.prepare('UPDATE users SET updated_at = ? WHERE id = ?').bind(now, user.id).run();

  return new Response(JSON.stringify(jsonSuccess({
    user: {
      id: user.id,
      cyber_name: user.cyber_name,
      class: user.class,
      karma: user.karma,
      energy: user.energy,
      energy_cap: user.energy_cap,
      email: user.email,
      email_verified: user.email_verified === 1,
      created_at: user.created_at,
      updated_at: now,
    },
    token: token,
    token_type: 'Bearer',
  })), {
    headers: { 'Content-Type': 'application/json' },
  });
}
