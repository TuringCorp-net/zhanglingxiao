// Story Forger — 实体 CRUD（SF-014: 角色卡/地点卡/道具卡管理）
// 从 CAU entities.ts 迁移，归属 Write 侧
import { Env } from '../../db/schema';
import { jsonSuccess, jsonError } from '../../lib/response';
import { ErrorCodes } from '../../lib/errors';

// POST /api/write/works/{id}/entities
export async function createEntity(env: Env, request: Request, workId: string): Promise<Response> {
  const work = await env.DB.prepare('SELECT id FROM works WHERE id = ?').bind(workId).first();
  if (!work) {
    return new Response(JSON.stringify(jsonError(ErrorCodes.WORK_NOT_FOUND, 'Work not found')), {
      status: 404, headers: { 'Content-Type': 'application/json' },
    });
  }

  const body = await request.json() as { name: string; type: string; description?: string; first_appearance?: string; related_entities?: string[] };
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

// PUT /api/write/works/{id}/entities/{eid}
export async function updateEntity(env: Env, request: Request, workId: string, entityId: string): Promise<Response> {
  const existing = await env.DB.prepare('SELECT id FROM entities WHERE id = ? AND work_id = ?').bind(entityId, workId).first();
  if (!existing) {
    return new Response(JSON.stringify(jsonError(ErrorCodes.ENTITY_NOT_FOUND, 'Entity not found')), {
      status: 404, headers: { 'Content-Type': 'application/json' },
    });
  }

  const body = await request.json() as { name?: string; type?: string; description?: string; first_appearance?: string; related_entities?: string[] };
  const now = new Date().toISOString();

  const fields: string[] = ['updated_at = ?'];
  const bindings: (string | number | null)[] = [now];
  const fieldMap: Record<string, unknown> = {
    name: body.name, type: body.type, description: body.description,
    first_appearance: body.first_appearance,
    related_entities: Array.isArray(body.related_entities) ? JSON.stringify(body.related_entities) : body.related_entities,
  };

  for (const [key, value] of Object.entries(fieldMap)) {
    if (value !== undefined) { fields.push(`${key} = ?`); bindings.push(value as string | number | null); }
  }

  bindings.push(entityId);
  await env.DB.prepare(`UPDATE entities SET ${fields.join(', ')} WHERE id = ?`).bind(...bindings).run();

  return new Response(JSON.stringify(jsonSuccess({ id: entityId })), {
    headers: { 'Content-Type': 'application/json' },
  });
}

// DELETE /api/write/works/{id}/entities/{eid}
export async function deleteEntity(env: Env, _request: Request, workId: string, entityId: string): Promise<Response> {
  const existing = await env.DB.prepare('SELECT id FROM entities WHERE id = ? AND work_id = ?').bind(entityId, workId).first();
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
