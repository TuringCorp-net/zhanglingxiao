// 订阅 API
import { Env } from '../db/schema';
import { jsonSuccess, jsonError } from '../lib/response';
import { ErrorCodes } from '../lib/errors';
import { parsePagination } from '../lib/constants';

// GET /api/subscriptions — 查询订阅
export async function listSubscriptions(env: Env, request: Request): Promise<Response> {
  const { page, limit, offset } = parsePagination(new URL(request.url));
  const userId = new URL(request.url).searchParams.get('user_id');

  if (!userId) {
    return new Response(JSON.stringify(jsonError(ErrorCodes.INVALID_PARAMS, 'user_id is required')), {
      status: 400, headers: { 'Content-Type': 'application/json' },
    });
  }

  const countResult = await env.DB.prepare(
    'SELECT COUNT(*) as total FROM subscriptions WHERE user_id = ?'
  ).bind(userId).first<{ total: number }>();
  const total = countResult?.total || 0;

  const result = await env.DB.prepare(
    'SELECT * FROM subscriptions WHERE user_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?'
  ).bind(userId, limit, offset).all<Record<string, unknown>>();

  return new Response(JSON.stringify(jsonSuccess(result.results || [], { page, total })), {
    headers: { 'Content-Type': 'application/json' },
  });
}

// POST /api/subscriptions — 创建订阅
export async function createSubscription(env: Env, request: Request): Promise<Response> {
  const body = await request.json() as Record<string, unknown>;
  if (!body.user_id || !body.subscribe_type || !body.target_id) {
    return new Response(JSON.stringify(jsonError(ErrorCodes.MISSING_REQUIRED_FIELD, 'user_id, subscribe_type, and target_id are required')), {
      status: 400, headers: { 'Content-Type': 'application/json' },
    });
  }

  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const queryCondition = body.query_condition ? JSON.stringify(body.query_condition) : '{}';

  await env.DB.prepare(`
    INSERT INTO subscriptions (id, user_id, subscribe_type, target_id, query_condition, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).bind(id, body.user_id, body.subscribe_type, body.target_id, queryCondition, now).run();

  return new Response(JSON.stringify(jsonSuccess({ id })), {
    status: 201, headers: { 'Content-Type': 'application/json' },
  });
}

// DELETE /api/subscriptions/{id} — 取消订阅
export async function deleteSubscription(env: Env, _request: Request, id: string): Promise<Response> {
  const existing = await env.DB.prepare('SELECT id FROM subscriptions WHERE id = ?').bind(id).first();
  if (!existing) {
    return new Response(JSON.stringify(jsonError(ErrorCodes.SUBSCRIPTION_NOT_FOUND, 'Subscription not found')), {
      status: 404, headers: { 'Content-Type': 'application/json' },
    });
  }
  await env.DB.prepare('DELETE FROM subscriptions WHERE id = ?').bind(id).run();
  return new Response(JSON.stringify(jsonSuccess({ id, deleted: true })), {
    headers: { 'Content-Type': 'application/json' },
  });
}
