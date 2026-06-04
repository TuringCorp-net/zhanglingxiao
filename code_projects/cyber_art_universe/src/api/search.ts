/**
 * 搜索 API — D1 LIKE 全文搜索（检索与推理分离原则）
 * 覆盖需求: F-060 (全局搜索) / F-061 (作品内检索)
 */
import { Env } from '../db/schema';
import { jsonSuccess, jsonError } from '../lib/response';
import { ErrorCodes } from '../lib/errors';
import { parsePagination, parseLimit } from '../lib/constants';

// GET /api/search?q=... — 全局搜索
export async function searchContent(env: Env, request: Request): Promise<Response> {
  const url = new URL(request.url);
  const q = url.searchParams.get('q');
  const { page, limit, offset } = parsePagination(url);

  if (!q || q.trim().length === 0) {
    return new Response(JSON.stringify(jsonError(ErrorCodes.INVALID_PARAMS, 'query parameter q is required')), {
      status: 400, headers: { 'Content-Type': 'application/json' },
    });
  }

  const pattern = `%${q.trim()}%`;

  // 搜索 works, sections, entities
  const workResults = await env.DB.prepare(`
    SELECT id, title, 'work' as match_type, summary as excerpt, updated_at
    FROM works WHERE title LIKE ? OR summary LIKE ? ORDER BY updated_at DESC LIMIT ?
  `).bind(pattern, pattern, limit).all<Record<string, unknown>>();

  const sectionResults = await env.DB.prepare(`
    SELECT s.id, s.title, 'section' as match_type, s.section_summary as excerpt, s.updated_at, s.work_id
    FROM sections s WHERE s.title LIKE ? OR s.section_summary LIKE ? ORDER BY s.updated_at DESC LIMIT ?
  `).bind(pattern, pattern, limit).all<Record<string, unknown>>();

  const entityResults = await env.DB.prepare(`
    SELECT e.id, e.name as title, 'entity' as match_type, e.description as excerpt, e.updated_at, e.work_id
    FROM entities e WHERE e.name LIKE ? OR e.description LIKE ? ORDER BY e.updated_at DESC LIMIT ?
  `).bind(pattern, pattern, limit).all<Record<string, unknown>>();

  const results = [
    ...(workResults.results || []),
    ...(sectionResults.results || []),
    ...(entityResults.results || []),
  ];

  return new Response(JSON.stringify(jsonSuccess(results, { page, total: results.length, query: q.trim() })), {
    headers: { 'Content-Type': 'application/json' },
  });
}

// GET /api/content/{id}/retrieve?query=... — 作品内检索
export async function retrieveInWork(env: Env, request: Request, workId: string): Promise<Response> {
  const url = new URL(request.url);
  const query = url.searchParams.get('query');
  const limit = parseLimit(url);

  if (!query || query.trim().length === 0) {
    return new Response(JSON.stringify(jsonError(ErrorCodes.INVALID_PARAMS, 'query parameter is required')), {
      status: 400, headers: { 'Content-Type': 'application/json' },
    });
  }

  const work = await env.DB.prepare('SELECT id FROM works WHERE id = ?').bind(workId).first();
  if (!work) {
    return new Response(JSON.stringify(jsonError(ErrorCodes.WORK_NOT_FOUND, 'Work not found')), {
      status: 404, headers: { 'Content-Type': 'application/json' },
    });
  }

  const pattern = `%${query.trim()}%`;

  // 搜索章节和实体
  const sections = await env.DB.prepare(`
    SELECT id, title, 'section' as match_type, section_summary as excerpt, order_index
    FROM sections WHERE work_id = ? AND (title LIKE ? OR section_summary LIKE ?) ORDER BY order_index LIMIT ?
  `).bind(workId, pattern, pattern, limit).all<Record<string, unknown>>();

  const entities = await env.DB.prepare(`
    SELECT id, name as title, 'entity' as match_type, description as excerpt
    FROM entities WHERE work_id = ? AND (name LIKE ? OR description LIKE ?) LIMIT ?
  `).bind(workId, pattern, pattern, limit).all<Record<string, unknown>>();

  return new Response(JSON.stringify(jsonSuccess({
    work_id: workId,
    query: query.trim(),
    relevant_sections: sections.results || [],
    relevant_entities: entities.results || [],
  })), {
    headers: { 'Content-Type': 'application/json' },
  });
}
