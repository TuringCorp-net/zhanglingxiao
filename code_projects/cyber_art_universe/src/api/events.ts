/**
 * 事件与榜单 API
 * 覆盖需求: F-040 (事件流) / F-041 (榜单列表) / F-042 (榜单详情) / F-043 (事件记录)
 */
import { Env } from '../db/schema';
import { jsonSuccess, jsonError } from '../lib/response';
import { ErrorCodes } from '../lib/errors';
import { parsePagination } from '../lib/constants';

// ============================================================
// 事件
// ============================================================

// GET /api/events/feed — 事件流
export async function getEventFeed(env: Env, request: Request): Promise<Response> {
  const { page, limit, offset } = parsePagination(new URL(request.url));

  const countResult = await env.DB.prepare('SELECT COUNT(*) as total FROM events').bind().first<{ total: number }>();
  const total = countResult?.total || 0;

  const result = await env.DB.prepare(
    'SELECT * FROM events ORDER BY timestamp DESC LIMIT ? OFFSET ?'
  ).bind(limit, offset).all<Record<string, unknown>>();

  return new Response(JSON.stringify(jsonSuccess(result.results || [], { page, total })), {
    headers: { 'Content-Type': 'application/json' },
  });
}

// POST /api/admin/events — 记录事件（内部/管理用）
export async function createEvent(env: Env, request: Request): Promise<Response> {
  const body = await request.json() as Record<string, unknown>;
  if (!body.event_type) {
    return new Response(JSON.stringify(jsonError(ErrorCodes.MISSING_REQUIRED_FIELD, 'event_type is required')), {
      status: 400, headers: { 'Content-Type': 'application/json' },
    });
  }

  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const affectedEntities = Array.isArray(body.affected_entities) ? JSON.stringify(body.affected_entities) : '[]';

  await env.DB.prepare(`
    INSERT INTO events (id, event_type, work_id, section_id, entity_id, delta_summary, affected_entities, timestamp, processed)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)
  `).bind(
    id, body.event_type, body.work_id || null, body.section_id || null,
    body.entity_id || null, body.delta_summary || null, affectedEntities, now
  ).run();

  return new Response(JSON.stringify(jsonSuccess({ id })), {
    status: 201, headers: { 'Content-Type': 'application/json' },
  });
}

// ============================================================
// 榜单
// ============================================================

const RANKING_TYPES = [
  'ai_hot', 'ai_trending', 'ai_controversial', 'ai_worldview',
  'ai_commercial', 'ai_style', 'human_liked', 'human_paid',
  'comprehensive_trending', 'new_discovery', 'high_controversy',
];

// GET /api/rankings — 榜单列表
export async function listRankings(_env: Env, _request: Request): Promise<Response> {
  return new Response(JSON.stringify(jsonSuccess({
    available_types: RANKING_TYPES,
    description: '榜单由调度系统定期聚合 reviews 数据生成，API 只读缓存结果。',
  })), {
    headers: { 'Content-Type': 'application/json' },
  });
}

// GET /api/rankings/{type} — 指定榜单
export async function getRanking(env: Env, _request: Request, type: string): Promise<Response> {
  if (!RANKING_TYPES.includes(type)) {
    return new Response(JSON.stringify(jsonError(ErrorCodes.RANKING_NOT_FOUND, `Unknown ranking type: ${type}`)), {
      status: 404, headers: { 'Content-Type': 'application/json' },
    });
  }

  // 榜单数据由调度系统写入 R2，API 负责读取缓存
  const key = `rankings/${type}.json`;
  const object = await env.WORKS_BUCKET.get(key);

  if (!object) {
    // 榜单尚未生成，返回空数据
    return new Response(JSON.stringify(jsonSuccess({
      type,
      generated_at: null,
      entries: [],
      message: '榜单数据尚未生成，等待调度系统聚合。',
    })), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const data = await object.text();
  return new Response(data, {
    headers: { 'Content-Type': 'application/json' },
  });
}
