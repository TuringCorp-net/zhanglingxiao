// Tags API - F-040-17 + F-011-01
import { Env } from '../db/schema';
import { jsonSuccess, jsonError } from '../lib/response';
import { ErrorCodes } from '../lib/errors';

// POST /api/admin/tags - F-040-17
export async function createTag(env: Env, request: Request): Promise<Response> {
  const body = await request.json() as { name: string; slug: string; layer?: string; parent_id?: string };

  if (!body.name || !body.slug) {
    return new Response(JSON.stringify(jsonError(ErrorCodes.INVALID_PARAMS, 'name and slug are required')), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const existing = await env.DB.prepare('SELECT id FROM tags WHERE slug = ?').bind(body.slug).first();
  if (existing) {
    return new Response(JSON.stringify(jsonError(ErrorCodes.INVALID_PARAMS, 'Slug already exists')), {
      status: 409,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (body.parent_id) {
    const parent = await env.DB.prepare('SELECT id FROM tags WHERE id = ?').bind(body.parent_id).first();
    if (!parent) {
      return new Response(JSON.stringify(jsonError(ErrorCodes.NOT_FOUND, 'Parent tag not found')), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  }

  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  await env.DB.prepare(`
    INSERT INTO tags (id, name, slug, layer, parent_id, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).bind(id, body.name, body.slug, body.layer || 'function', body.parent_id || null, now).run();

  return new Response(JSON.stringify(jsonSuccess({ id })), {
    status: 201,
    headers: { 'Content-Type': 'application/json' },
  });
}

// GET /api/admin/tags - F-011-01 list
export async function listTags(env: Env, request: Request): Promise<Response> {
  const url = new URL(request.url);
  const layer = url.searchParams.get('layer');

  let query = 'SELECT * FROM tags';
  const bindings: string[] = [];
  if (layer) {
    query += ' WHERE layer = ?';
    bindings.push(layer);
  }
  query += ' ORDER BY layer, name';

  const rows = await env.DB.prepare(query).bind(...bindings).all<Record<string, unknown>>();
  return new Response(JSON.stringify(jsonSuccess(rows.results ?? [])), {
    headers: { 'Content-Type': 'application/json' },
  });
}

// PUT /api/admin/tags/:id - F-011-01 update
export async function updateTag(env: Env, request: Request, id: string): Promise<Response> {
  const existing = await env.DB.prepare('SELECT id FROM tags WHERE id = ?').bind(id).first();
  if (!existing) {
    return new Response(JSON.stringify(jsonError(ErrorCodes.NOT_FOUND, 'Tag not found')), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const body = await request.json() as { name?: string; layer?: string; parent_id?: string };
  const sets: string[] = [];
  const bindings: (string | null)[] = [];

  if (body.name !== undefined) { sets.push('name = ?'); bindings.push(body.name); }
  if (body.layer !== undefined) { sets.push('layer = ?'); bindings.push(body.layer); }
  if (body.parent_id !== undefined) { sets.push('parent_id = ?'); bindings.push(body.parent_id || null); }

  if (sets.length === 0) {
    return new Response(JSON.stringify(jsonError(ErrorCodes.INVALID_PARAMS, 'No fields to update')), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  await env.DB.prepare(`UPDATE tags SET ${sets.join(', ')} WHERE id = ?`).bind(...bindings, id).run();
  return new Response(JSON.stringify(jsonSuccess({ id })), {
    headers: { 'Content-Type': 'application/json' },
  });
}

// DELETE /api/admin/tags/:id - F-011-01 delete
export async function deleteTag(env: Env, request: Request, id: string): Promise<Response> {
  const existing = await env.DB.prepare('SELECT id, name FROM tags WHERE id = ?').bind(id).first<{ id: string; name: string }>();
  if (!existing) {
    return new Response(JSON.stringify(jsonError(ErrorCodes.NOT_FOUND, 'Tag not found')), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Check if products reference this tag
  const referencing = await env.DB.prepare(
    "SELECT COUNT(*) as count FROM products WHERE tags LIKE ?"
  ).bind(`%"${existing.name}"%`).first<{ count: number }>();

  await env.DB.prepare('DELETE FROM tags WHERE id = ?').bind(id).run();

  return new Response(JSON.stringify(jsonSuccess({
    id,
    deleted: true,
    products_referencing: referencing?.count ?? 0,
  })), {
    headers: { 'Content-Type': 'application/json' },
  });
}

// GET /api/admin/tags/stats - F-011-03
export async function getTagStats(env: Env): Promise<Response> {
  const rows = await env.DB.prepare(`
    SELECT t.name as tag_name, COUNT(p.id) as product_count, t.layer
    FROM tags t
    LEFT JOIN products p ON p.tags LIKE '%"' || t.slug || '"%' AND p.status = 'active'
    GROUP BY t.id, t.name, t.layer
    ORDER BY product_count DESC
  `).all<{ tag_name: string; product_count: number; layer: string }>();

  return new Response(JSON.stringify(jsonSuccess(rows.results ?? [])), {
    headers: { 'Content-Type': 'application/json' },
  });
}
