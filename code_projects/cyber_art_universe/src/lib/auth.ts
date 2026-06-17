/**
 * 鉴权中间件 — Phase 0
 * 从 Bearer Token 解析用户身份，注入 env.currentUser
 */
import { Env, User } from '../db/schema';
import { jsonError } from './response';
import { ErrorCodes } from './errors';

/**
 * 从 Authorization header 提取 Bearer Token 并验证用户身份。
 * 验证通过后，将用户信息注入 env.currentUser。
 * 验证失败返回 401 Response。
 *
 * @returns null 表示验证通过，Response 表示验证失败（调用方应直接返回该 Response）
 */
export async function authenticate(request: Request, env: Env): Promise<Response | null> {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return new Response(JSON.stringify(jsonError(ErrorCodes.UNAUTHORIZED, 'Authentication required')), {
      status: 401, headers: { 'Content-Type': 'application/json' },
    });
  }

  const token = authHeader.slice(7);
  if (!token || token.length < 10) {
    return new Response(JSON.stringify(jsonError(ErrorCodes.UNAUTHORIZED, 'Invalid token format')), {
      status: 401, headers: { 'Content-Type': 'application/json' },
    });
  }

  // SHA-256 哈希 Token
  const tokenHash = await sha256(token);

  // 查询 sessions 表
  const session = await env.DB.prepare(
    'SELECT user_id FROM sessions WHERE token_hash = ? AND revoked = 0'
  ).bind(tokenHash).first<{ user_id: string }>();

  if (!session) {
    return new Response(JSON.stringify(jsonError(ErrorCodes.TOKEN_REVOKED, 'Invalid or revoked token')), {
      status: 401, headers: { 'Content-Type': 'application/json' },
    });
  }

  // 查询用户
  const user = await env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(session.user_id).first<User>();
  if (!user) {
    return new Response(JSON.stringify(jsonError(ErrorCodes.USER_NOT_FOUND, 'User not found')), {
      status: 401, headers: { 'Content-Type': 'application/json' },
    });
  }

  // 注入到 env，供下游 handler 使用
  env.currentUser = user;
  return null; // 验证通过
}

/**
 * 可选的鉴权：不强制要求 Token，但如果提供了有效 Token 就注入用户。
 * 用于公开端点（如 GET /api/reviews），有 Token 就个性化，没有也能访问。
 */
export async function optionalAuth(request: Request, env: Env): Promise<void> {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) return;

  const token = authHeader.slice(7);
  const tokenHash = await sha256(token);

  const session = await env.DB.prepare(
    'SELECT user_id FROM sessions WHERE token_hash = ? AND revoked = 0'
  ).bind(tokenHash).first<{ user_id: string }>();

  if (session) {
    const user = await env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(session.user_id).first<User>();
    if (user) env.currentUser = user;
  }
}

// Web Crypto SHA-256 辅助函数
async function sha256(input: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(input);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export { sha256 };
