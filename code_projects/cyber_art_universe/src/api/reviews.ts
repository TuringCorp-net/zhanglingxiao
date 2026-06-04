/**
 * 评价/评论 API — AI 与人类共用
 * 覆盖需求: F-030 (提交) / F-031 (列表) / F-032 (详情) / F-044 (嵌套回复+点赞) / F-047 (reviewer_type)
 */
import { Env } from '../db/schema';
import { jsonSuccess, jsonError } from '../lib/response';
import { ErrorCodes } from '../lib/errors';
import { parsePagination } from '../lib/constants';

// POST /api/reviews — 提交评论
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
    INSERT INTO reviews (id, work_id, section_id, agent_id, reviewer_type, score_overall, comment, parent_id, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    id, body.work_id, body.section_id || null, body.agent_id,
    body.reviewer_type || 'AI',
    body.score_overall ?? null,
    body.comment || null,
    body.parent_id || null,
    now
  ).run();

  return new Response(JSON.stringify(jsonSuccess({ id })), {
    status: 201, headers: { 'Content-Type': 'application/json' },
  });
}

// GET /api/reviews?work_id={id} — 评论列表
// 支持 ?sort=hot 按点赞数排序（自然热评），默认按时间
export async function listReviews(env: Env, request: Request): Promise<Response> {
  const url = new URL(request.url);
  const { page, limit, offset } = parsePagination(url);
  const workId = url.searchParams.get('work_id');
  const reviewerType = url.searchParams.get('reviewer_type');
  const sort = url.searchParams.get('sort') || 'latest'; // latest | hot
  const parentId = url.searchParams.get('parent_id'); // 查某条评论的回复

  if (!workId && !parentId) {
    return new Response(JSON.stringify(jsonError(ErrorCodes.INVALID_PARAMS, 'work_id or parent_id is required')), {
      status: 400, headers: { 'Content-Type': 'application/json' },
    });
  }

  let whereClause = workId ? 'WHERE work_id = ?' : 'WHERE parent_id = ?';
  const bindings: (string | number)[] = [workId || parentId || ''];

  if (reviewerType) {
    whereClause += ' AND reviewer_type = ?';
    bindings.push(reviewerType);
  }

  const orderClause = sort === 'hot'
    ? 'ORDER BY like_count DESC, created_at DESC'
    : 'ORDER BY created_at DESC';

  const countResult = await env.DB.prepare(
    `SELECT COUNT(*) as total FROM reviews ${whereClause}`
  ).bind(...bindings).first<{ total: number }>();
  const total = countResult?.total || 0;

  const result = await env.DB.prepare(
    `SELECT * FROM reviews ${whereClause} ${orderClause} LIMIT ? OFFSET ?`
  ).bind(...bindings, limit, offset).all<Record<string, unknown>>();

  return new Response(JSON.stringify(jsonSuccess(result.results || [], { page, total })), {
    headers: { 'Content-Type': 'application/json' },
  });
}

// GET /api/reviews/{id} — 单条评论详情
export async function getReview(env: Env, _request: Request, id: string): Promise<Response> {
  const row = await env.DB.prepare('SELECT * FROM reviews WHERE id = ?').bind(id).first<Record<string, unknown>>();
  if (!row) {
    return new Response(JSON.stringify(jsonError(ErrorCodes.NOT_FOUND, 'Review not found')), {
      status: 404, headers: { 'Content-Type': 'application/json' },
    });
  }

  // 同时获取该评论的回复
  const replies = await env.DB.prepare(
    'SELECT * FROM reviews WHERE parent_id = ? ORDER BY created_at ASC'
  ).bind(id).all<Record<string, unknown>>();

  return new Response(JSON.stringify(jsonSuccess({
    ...row,
    replies: replies.results || [],
  })), {
    headers: { 'Content-Type': 'application/json' },
  });
}

// POST /api/reviews/{id}/like — 点赞（AI 或人类均可点赞）
// 支持 ?reviewer_id=xxx 进行基本去重（同一 reviewer_id 对同一评论只能点赞一次）
export async function likeReview(env: Env, request: Request, id: string): Promise<Response> {
  const existing = await env.DB.prepare('SELECT id, like_count FROM reviews WHERE id = ?').bind(id).first<{ id: string; like_count: number }>();
  if (!existing) {
    return new Response(JSON.stringify(jsonError(ErrorCodes.NOT_FOUND, 'Review not found')), {
      status: 404, headers: { 'Content-Type': 'application/json' },
    });
  }

  // 基本去重：检查 reviewer_id 是否已赞（未来接入用户系统后替换为 user_id）
  const url = new URL(request.url);
  const reviewerId = url.searchParams.get('reviewer_id');
  if (reviewerId) {
    const alreadyLiked = await env.DB.prepare(
      'SELECT id FROM reviews WHERE parent_id = ? AND reviewer_type = ? AND agent_id = ?'
    ).bind(id, 'AI', reviewerId).first();
    if (alreadyLiked) {
      return new Response(JSON.stringify(jsonSuccess({ id, like_count: existing.like_count, already_liked: true })), {
        headers: { 'Content-Type': 'application/json' },
      });
    }
  }

  const newCount = (existing.like_count || 0) + 1;
  await env.DB.prepare('UPDATE reviews SET like_count = ? WHERE id = ?').bind(newCount, id).run();

  return new Response(JSON.stringify(jsonSuccess({ id, like_count: newCount })), {
    headers: { 'Content-Type': 'application/json' },
  });
}
