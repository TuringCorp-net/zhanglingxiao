// 评价/信号 API
import { Env } from '../db/schema';
import { jsonSuccess, jsonError } from '../lib/response';
import { ErrorCodes } from '../lib/errors';
import { parsePagination } from '../lib/constants';

// POST /api/reviews — 提交评价
export async function submitReview(env: Env, request: Request): Promise<Response> {
  const body = await request.json() as Record<string, unknown>;
  if (!body.work_id || !body.agent_id) {
    return new Response(JSON.stringify(jsonError(ErrorCodes.MISSING_REQUIRED_FIELD, 'work_id and agent_id are required')), {
      status: 400, headers: { 'Content-Type': 'application/json' },
    });
  }

  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  await env.DB.prepare(`
    INSERT INTO reviews (id, work_id, section_id, agent_id, reviewer_type, score_overall, score_pacing, score_character, score_worldview, score_style, comment, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    id, body.work_id, body.section_id || null, body.agent_id,
    body.reviewer_type || 'AI',
    body.score_overall ?? null, body.score_pacing ?? null,
    body.score_character ?? null, body.score_worldview ?? null,
    body.score_style ?? null, body.comment || null, now
  ).run();

  return new Response(JSON.stringify(jsonSuccess({ id })), {
    status: 201, headers: { 'Content-Type': 'application/json' },
  });
}

// GET /api/reviews?work_id={id} — 查询评价
export async function listReviews(env: Env, request: Request): Promise<Response> {
  const url = new URL(request.url);
  const { page, limit, offset } = parsePagination(url);
  const workId = url.searchParams.get('work_id');
  const reviewerType = url.searchParams.get('reviewer_type');

  if (!workId) {
    return new Response(JSON.stringify(jsonError(ErrorCodes.INVALID_PARAMS, 'work_id is required')), {
      status: 400, headers: { 'Content-Type': 'application/json' },
    });
  }

  let whereClause = 'WHERE work_id = ?';
  const bindings: (string | number)[] = [workId];

  if (reviewerType) {
    whereClause += ' AND reviewer_type = ?';
    bindings.push(reviewerType);
  }

  const countResult = await env.DB.prepare(
    `SELECT COUNT(*) as total FROM reviews ${whereClause}`
  ).bind(...bindings).first<{ total: number }>();
  const total = countResult?.total || 0;

  const result = await env.DB.prepare(
    `SELECT * FROM reviews ${whereClause} ORDER BY created_at DESC LIMIT ? OFFSET ?`
  ).bind(...bindings, limit, offset).all<Record<string, unknown>>();

  return new Response(JSON.stringify(jsonSuccess(result.results || [], { page, total })), {
    headers: { 'Content-Type': 'application/json' },
  });
}

// GET /api/reviews/{id} — 单条评价详情
export async function getReview(env: Env, _request: Request, id: string): Promise<Response> {
  const row = await env.DB.prepare('SELECT * FROM reviews WHERE id = ?').bind(id).first<Record<string, unknown>>();
  if (!row) {
    return new Response(JSON.stringify(jsonError(ErrorCodes.NOT_FOUND, 'Review not found')), {
      status: 404, headers: { 'Content-Type': 'application/json' },
    });
  }
  return new Response(JSON.stringify(jsonSuccess(row)), {
    headers: { 'Content-Type': 'application/json' },
  });
}
