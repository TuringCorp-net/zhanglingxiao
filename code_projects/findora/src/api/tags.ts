// Tags API - F-040-17 + F-011-01
import { Env } from '../db/schema';
import { jsonSuccess, jsonError } from '../lib/response';
import { ErrorCodes } from '../lib/errors';

// POST /api/admin/tags - F-040-17
export async function createTag(env: Env, request: Request): Promise<Response> {
  const body = await request.json() as {
    name: string;
    slug: string;
    layer?: string;
    parent_id?: string;
    dimension_level?: number;
    featured_products?: string[];
  };

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
  const dimensionLevel = body.dimension_level === 1 ? 1 : 2;
  const featuredProducts = Array.isArray(body.featured_products) ? JSON.stringify(body.featured_products) : '[]';

  await env.DB.prepare(`
    INSERT INTO tags (id, name, slug, layer, dimension_level, parent_id, featured_products, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(id, body.name, body.slug, body.layer || 'function', dimensionLevel, body.parent_id || null, featuredProducts, now).run();

  return new Response(JSON.stringify(jsonSuccess({ id })), {
    status: 201,
    headers: { 'Content-Type': 'application/json' },
  });
}

// GET /api/admin/tags - F-011-01 list
export async function listTags(env: Env, request: Request): Promise<Response> {
  const url = new URL(request.url);
  const layer = url.searchParams.get('layer');
  const dimensionLevel = url.searchParams.get('dimension_level');

  let query = 'SELECT * FROM tags';
  const bindings: (string | number)[] = [];
  const conditions: string[] = [];
  if (layer) {
    conditions.push('layer = ?');
    bindings.push(layer);
  }
  if (dimensionLevel) {
    const parsed = Number.parseInt(dimensionLevel, 10);
    if (![1, 2].includes(parsed)) {
      return new Response(JSON.stringify(jsonError(ErrorCodes.INVALID_PARAMS, 'dimension_level must be 1 or 2')), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    conditions.push('dimension_level = ?');
    bindings.push(parsed);
  }
  if (conditions.length > 0) {
    query += ` WHERE ${conditions.join(' AND ')}`;
  }
  query += ' ORDER BY dimension_level ASC, layer, name';

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

  const body = await request.json() as {
    name?: string;
    layer?: string;
    dimension_level?: number;
    parent_id?: string;
  };
  const sets: string[] = [];
  const bindings: (string | number | null)[] = [];

  if (body.name !== undefined) { sets.push('name = ?'); bindings.push(body.name); }
  if (body.layer !== undefined) { sets.push('layer = ?'); bindings.push(body.layer); }
  if (body.dimension_level !== undefined) {
    if (body.dimension_level !== 1 && body.dimension_level !== 2) {
      return new Response(JSON.stringify(jsonError(ErrorCodes.INVALID_PARAMS, 'dimension_level must be 1 or 2')), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    sets.push('dimension_level = ?');
    bindings.push(body.dimension_level);
  }
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

  // ST-S06修复：使用json_each安全匹配标签
  const referencing = await env.DB.prepare(
    "SELECT COUNT(*) as count FROM products WHERE EXISTS (SELECT 1 FROM json_each(products.tags) AS jt WHERE jt.value = ?)"
  ).bind(existing.name).first<{ count: number }>();

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
  // ST-S06修复：使用json_each安全匹配标签，避免LIKE注入
  const rows = await env.DB.prepare(`
    SELECT t.name as tag_name, t.slug, COUNT(p.id) as product_count, t.layer
    FROM tags t
    LEFT JOIN products p ON EXISTS (SELECT 1 FROM json_each(p.tags) AS jt WHERE jt.value = t.slug) AND p.status = 'active'
    GROUP BY t.id, t.name, t.slug, t.layer
    ORDER BY product_count DESC
  `).all<{ tag_name: string; slug: string; product_count: number; layer: string }>();

  return new Response(JSON.stringify(jsonSuccess(rows.results ?? [])), {
    headers: { 'Content-Type': 'application/json' },
  });
}

// PATCH /api/admin/tags/:id/featured - F-040-17d
export async function updateTagFeaturedProducts(env: Env, request: Request, id: string): Promise<Response> {
  const existing = await env.DB.prepare('SELECT id FROM tags WHERE id = ?').bind(id).first();
  if (!existing) {
    return new Response(JSON.stringify(jsonError(ErrorCodes.NOT_FOUND, 'Tag not found')), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const body = await request.json() as { featured_products: string[] };
  if (!Array.isArray(body.featured_products)) {
    return new Response(JSON.stringify(jsonError(ErrorCodes.INVALID_PARAMS, 'featured_products must be an array')), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  await env.DB.prepare('UPDATE tags SET featured_products = ? WHERE id = ?')
    .bind(JSON.stringify(body.featured_products), id)
    .run();

  return new Response(JSON.stringify(jsonSuccess({
    id,
    featured_products: body.featured_products,
  })), {
    headers: { 'Content-Type': 'application/json' },
  });
}
