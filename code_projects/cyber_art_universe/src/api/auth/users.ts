/**
 * GET /api/users/{id} — 获取指定用户的公开档案
 * Phase 0
 */
import { Env } from '../../db/schema';
import { jsonSuccess, jsonError } from '../../lib/response';
import { ErrorCodes } from '../../lib/errors';

export async function handleGetUser(env: Env, _request: Request, userId: string): Promise<Response> {
  const user = await env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(userId).first<Record<string, unknown>>();

  if (!user) {
    return new Response(JSON.stringify(jsonError(ErrorCodes.USER_NOT_FOUND, 'User not found')), {
      status: 404, headers: { 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify(jsonSuccess({
    id: user.id,
    cyber_name: user.cyber_name,
    class: user.class,
    karma: user.karma,
    created_at: user.created_at,
  })), {
    headers: { 'Content-Type': 'application/json' },
  });
}
