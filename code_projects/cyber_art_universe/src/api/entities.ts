// 实体 API — 人物/地点/组织/事件 CRUD
import { Env, Entity } from '../db/schema';
import { jsonSuccess, jsonError, parseJSON } from '../lib/response';
import { ErrorCodes } from '../lib/errors';
import { parsePagination, parseLimit } from '../lib/constants';

// ============================================================
// GET /api/content/{id}/entities — 实体列表
// ============================================================
export async function listEntities(env: Env, request: Request, workId: string): Promise<Response> {
  const { page, limit, offset } = parsePagination(new URL(request.url));
  const type = new URL(request.url).searchParams.get('type');

  const work = await env.DB.prepare('SELECT id FROM works WHERE id = ?').bind(workId).first();
  if (!work) {
    return new Response(JSON.stringify(jsonError(ErrorCodes.WORK_NOT_FOUND, 'Work not found')), {
      status: 404, headers: { 'Content-Type': 'application/json' },
    });
  }

  let whereClause = 'WHERE work_id = ?';
  const bindings: (string | number)[] = [workId];
  if (type) {
    whereClause += ' AND type = ?';
    bindings.push(type);
  }

  const countResult = await env.DB.prepare(
    `SELECT COUNT(*) as total FROM entities ${whereClause}`
  ).bind(...bindings).first<{ total: number }>();
  const total = countResult?.total || 0;

  const result = await env.DB.prepare(
    `SELECT * FROM entities ${whereClause} ORDER BY created_at ASC LIMIT ? OFFSET ?`
  ).bind(...bindings, limit, offset).all<Record<string, unknown>>();

  const entities = (result.results || []).map(row => ({
    ...row,
    related_entities: parseJSON<string[]>(String(row.related_entities || '[]'), []),
  }));

  return new Response(JSON.stringify(jsonSuccess(entities, { page, total })), {
    headers: { 'Content-Type': 'application/json' },
  });
}

// ============================================================
// GET /api/content/{id}/entities/{entity_id} — 实体详情
// ============================================================
export async function getEntity(env: Env, _request: Request, workId: string, entityId: string): Promise<Response> {
  const row = await env.DB.prepare(
    'SELECT * FROM entities WHERE id = ? AND work_id = ?'
  ).bind(entityId, workId).first<Record<string, unknown>>();

  if (!row) {
    return new Response(JSON.stringify(jsonError(ErrorCodes.ENTITY_NOT_FOUND, 'Entity not found')), {
      status: 404, headers: { 'Content-Type': 'application/json' },
    });
  }

  // 解析关联实体并获取名称
  const relatedIds: string[] = parseJSON<string[]>(String(row.related_entities || '[]'), []);
  let relatedEntities: { id: string; name: string; type: string }[] = [];
  if (relatedIds.length > 0) {
    const placeholders = relatedIds.map(() => '?').join(',');
    const related = await env.DB.prepare(
      `SELECT id, name, type FROM entities WHERE id IN (${placeholders})`
    ).bind(...relatedIds).all<{ id: string; name: string; type: string }>();
    relatedEntities = related.results || [];
  }

  return new Response(JSON.stringify(jsonSuccess({
    ...row,
    related_entities: relatedIds,
    related_entity_details: relatedEntities,
  })), {
    headers: { 'Content-Type': 'application/json' },
  });
}

// ============================================================
// GET /api/content/{id}/timeline — 时间线
// ============================================================
export async function getTimeline(env: Env, _request: Request, workId: string): Promise<Response> {
  const work = await env.DB.prepare('SELECT id, title FROM works WHERE id = ?').bind(workId).first();
  if (!work) {
    return new Response(JSON.stringify(jsonError(ErrorCodes.WORK_NOT_FOUND, 'Work not found')), {
      status: 404, headers: { 'Content-Type': 'application/json' },
    });
  }

  // 按 section 顺序排列，附上涉及的实体
  const sections = await env.DB.prepare(
    'SELECT id, title, order_index, section_summary, entities_involved FROM sections WHERE work_id = ? ORDER BY order_index'
  ).bind(workId).all<Record<string, unknown>>();

  return new Response(JSON.stringify(jsonSuccess({
    work_id: workId,
    title: work.title,
    timeline: (sections.results || []).map(s => ({
      section_id: s.id,
      title: s.title,
      order_index: s.order_index,
      section_summary: s.section_summary,
      entities_involved: parseJSON<string[]>(String(s.entities_involved || '[]'), []),
    })),
  })), {
    headers: { 'Content-Type': 'application/json' },
  });
}

// ============================================================
// GET /api/content/{id}/compare?section=a&section=b — 对比
// ============================================================
export async function compareSections(env: Env, _request: Request, workId: string): Promise<Response> {
  const url = new URL(_request.url);
  const sectionA = url.searchParams.get('section');
  const sectionB = url.searchParams.get('b');

  if (!sectionA || !sectionB) {
    return new Response(JSON.stringify(jsonError(ErrorCodes.INVALID_PARAMS, 'section and b parameters are required')), {
      status: 400, headers: { 'Content-Type': 'application/json' },
    });
  }

  const rows = await env.DB.prepare(
    'SELECT id, title, section_summary, word_count, entities_involved FROM sections WHERE work_id = ? AND id IN (?, ?)'
  ).bind(workId, sectionA, sectionB).all<Record<string, unknown>>();

  if ((rows.results || []).length !== 2) {
    return new Response(JSON.stringify(jsonError(ErrorCodes.SECTION_NOT_FOUND, 'One or both sections not found')), {
      status: 404, headers: { 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify(jsonSuccess({
    work_id: workId,
    sections: (rows.results || []).map(s => ({
      ...s,
      entities_involved: parseJSON<string[]>(String(s.entities_involved || '[]'), []),
    })),
  })), {
    headers: { 'Content-Type': 'application/json' },
  });
}

// ============================================================
// POST /api/admin/works/{id}/entities — 创建实体
// ============================================================
export async function createEntity(env: Env, request: Request, workId: string): Promise<Response> {
  const work = await env.DB.prepare('SELECT id FROM works WHERE id = ?').bind(workId).first();
  if (!work) {
    return new Response(JSON.stringify(jsonError(ErrorCodes.WORK_NOT_FOUND, 'Work not found')), {
      status: 404, headers: { 'Content-Type': 'application/json' },
    });
  }

  const body = await request.json() as Partial<Entity>;
  if (!body.name || !body.type) {
    return new Response(JSON.stringify(jsonError(ErrorCodes.MISSING_REQUIRED_FIELD, 'name and type are required')), {
      status: 400, headers: { 'Content-Type': 'application/json' },
    });
  }

  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const relatedEntities = Array.isArray(body.related_entities) ? JSON.stringify(body.related_entities) : '[]';

  await env.DB.prepare(`
    INSERT INTO entities (id, work_id, name, type, description, first_appearance, related_entities, version, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
  `).bind(id, workId, body.name, body.type, body.description || null, body.first_appearance || null, relatedEntities, now, now).run();

  return new Response(JSON.stringify(jsonSuccess({ id })), {
    status: 201, headers: { 'Content-Type': 'application/json' },
  });
}

// ============================================================
// PUT /api/admin/works/{id}/entities/{entity_id} — 更新实体
// ============================================================
export async function updateEntity(env: Env, request: Request, workId: string, entityId: string): Promise<Response> {
  const existing = await env.DB.prepare(
    'SELECT id FROM entities WHERE id = ? AND work_id = ?'
  ).bind(entityId, workId).first();

  if (!existing) {
    return new Response(JSON.stringify(jsonError(ErrorCodes.ENTITY_NOT_FOUND, 'Entity not found')), {
      status: 404, headers: { 'Content-Type': 'application/json' },
    });
  }

  const body = await request.json() as Partial<Entity>;
  const now = new Date().toISOString();

  const fields: string[] = ['updated_at = ?'];
  const bindings: (string | number | null)[] = [now];
  const fieldMap: Record<string, unknown> = {
    name: body.name, type: body.type, description: body.description,
    first_appearance: body.first_appearance,
    related_entities: Array.isArray(body.related_entities) ? JSON.stringify(body.related_entities) : body.related_entities,
  };

  for (const [key, value] of Object.entries(fieldMap)) {
    if (value !== undefined) {
      fields.push(`${key} = ?`);
      bindings.push(value as string | number | null);
    }
  }

  bindings.push(entityId);
  await env.DB.prepare(`UPDATE entities SET ${fields.join(', ')} WHERE id = ?`).bind(...bindings).run();

  return new Response(JSON.stringify(jsonSuccess({ id: entityId })), {
    headers: { 'Content-Type': 'application/json' },
  });
}

// ============================================================
// DELETE /api/admin/works/{id}/entities/{entity_id} — 删除实体
// ============================================================
export async function deleteEntity(env: Env, _request: Request, workId: string, entityId: string): Promise<Response> {
  const existing = await env.DB.prepare(
    'SELECT id FROM entities WHERE id = ? AND work_id = ?'
  ).bind(entityId, workId).first();

  if (!existing) {
    return new Response(JSON.stringify(jsonError(ErrorCodes.ENTITY_NOT_FOUND, 'Entity not found')), {
      status: 404, headers: { 'Content-Type': 'application/json' },
    });
  }

  await env.DB.prepare('DELETE FROM entities WHERE id = ?').bind(entityId).run();

  return new Response(JSON.stringify(jsonSuccess({ id: entityId, deleted: true })), {
    headers: { 'Content-Type': 'application/json' },
  });
}
