// Lists API - F-040-03, F-040-04, F-040-18
import { Env, List } from '../db/schema';
import { jsonSuccess, jsonError } from '../lib/response';
import { ErrorCodes } from '../lib/errors';
import { parseProductContentFromRow, toClientProduct } from '../lib/product_content';

// GET /api/lists - F-040-03
export async function listLists(env: Env): Promise<Response> {
  const result = await env.DB.prepare(
    'SELECT * FROM lists WHERE status = ? ORDER BY published_at DESC, created_at DESC'
  ).bind('published').all<Record<string, unknown>>();

  const lists = (result.results || []).map(row => ({
    ...(row as unknown as List),
  }));

  return new Response(JSON.stringify(jsonSuccess(lists)), {
    headers: { 'Content-Type': 'application/json' },
  });
}

// GET /api/lists/:id - F-040-04
export async function getList(env: Env, id: string): Promise<Response> {
  const listResult = await env.DB.prepare('SELECT * FROM lists WHERE id = ? OR slug = ?').bind(id, id).first<Record<string, unknown>>();

  if (!listResult) {
    return new Response(JSON.stringify(jsonError(ErrorCodes.NOT_FOUND, 'List not found')), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const list = listResult as unknown as List;

  // Get products in this list via list_products association table
  const productsResult = await env.DB.prepare(`
    SELECT p.* FROM products p
    INNER JOIN list_products lp ON p.id = lp.product_id
    WHERE lp.list_id = ? AND p.status = ?
    ORDER BY lp.position ASC
    LIMIT 50
  `).bind(list.id, 'active').all<Record<string, unknown>>();

  const products = (productsResult.results || []).map((row) => {
    return toClientProduct(row, parseProductContentFromRow(row));
  });

  return new Response(JSON.stringify(jsonSuccess({
    ...list,
    products,
  })), {
    headers: { 'Content-Type': 'application/json' },
  });
}

// POST /api/admin/lists - F-040-18
export async function createList(env: Env, request: Request): Promise<Response> {
  const body = await request.json() as Partial<List>;
  if (!body.title || !body.slug) {
    return new Response(JSON.stringify(jsonError(ErrorCodes.INVALID_PARAMS, 'title and slug are required')), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const status = body.status || 'draft';
  const published_at = status === 'published' ? now : null;

  await env.DB.prepare(`
    INSERT INTO lists (id, slug, title, description, why_these, cover_image, category, status, content_type, disclosure, published_at, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    id, body.slug, body.title, body.description || null, body.why_these || null,
    body.cover_image || null, body.category || null, status,
    body.content_type || 'organic', body.disclosure || null, published_at, now, now
  ).run();

  return new Response(JSON.stringify(jsonSuccess({ id })), {
    status: 201,
    headers: { 'Content-Type': 'application/json' },
  });
}
