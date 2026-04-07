// Products API - F-040-01, F-040-02, F-040-14, F-040-15, F-040-16
import { Env, Product } from '../db/schema';
import { jsonSuccess, jsonError, parseJSON } from '../lib/response';
import { ErrorCodes } from '../lib/errors';

function parseProduct(row: Record<string, unknown>) {
  const p = row as unknown as Product;
  return {
    ...p,
    tags: parseJSON<string[]>(p.tags || '[]', []),
    images: parseJSON<string[]>(p.images || '[]', []),
    pros: parseJSON<string[]>(p.pros || '[]', []),
    cons: parseJSON<string[]>(p.cons || '[]', []),
    use_cases: parseJSON<string[]>(p.use_cases || '[]', []),
    target_audience: parseJSON<string[]>(p.target_audience || '[]', []),
  } as Product & { tags: string[]; images: string[]; pros: string[]; cons: string[]; use_cases: string[]; target_audience: string[] };
}

// GET /api/products - F-040-01
export async function listProducts(env: Env, request: Request): Promise<Response> {
  const url = new URL(request.url);
  const category = url.searchParams.get('category');
  const tag = url.searchParams.get('tag');
  const priceMin = url.searchParams.get('price_min');
  const priceMax = url.searchParams.get('price_max');
  const page = parseInt(url.searchParams.get('page') || '1');
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '20'), 100);
  const offset = (page - 1) * limit;

  let query = 'SELECT * FROM products WHERE status = ?';
  const bindings: (string | number)[] = ['active'];

  if (category) {
    query += ' AND category = ?';
    bindings.push(category);
  }

  const subcategory = url.searchParams.get('subcategory');
  if (subcategory) {
    query += ' AND subcategory = ?';
    bindings.push(subcategory);
  }

  if (priceMin) {
    query += ' AND price_min >= ?';
    bindings.push(parseFloat(priceMin));
  }

  if (priceMax) {
    query += ' AND price_max <= ?';
    bindings.push(parseFloat(priceMax));
  }

  if (tag) {
    query += ' AND tags LIKE ?';
    bindings.push(`%"${tag}"%`);
  }

  // Count query
  const countQuery = query.replace('SELECT *', 'SELECT COUNT(*) as total');
  const countResult = await env.DB.prepare(countQuery).bind(...bindings).first<{ total: number }>();
  const total = countResult?.total || 0;

  query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
  bindings.push(limit, offset);

  const result = await env.DB.prepare(query).bind(...bindings).all<Record<string, unknown>>();
  const products = (result.results || []).map(parseProduct);

  return new Response(JSON.stringify(jsonSuccess(products, { page, total })), {
    headers: { 'Content-Type': 'application/json' },
  });
}

// GET /api/products/:id - F-040-02
export async function getProduct(env: Env, request: Request, id: string): Promise<Response> {
  const result = await env.DB.prepare('SELECT * FROM products WHERE id = ?').bind(id).first<Record<string, unknown>>();

  if (!result) {
    return new Response(JSON.stringify(jsonError(ErrorCodes.NOT_FOUND, 'Product not found')), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify(jsonSuccess(parseProduct(result))), {
    headers: { 'Content-Type': 'application/json' },
  });
}

// POST /api/admin/products - F-040-14
export async function createProduct(env: Env, request: Request): Promise<Response> {
  const body = await request.json() as Partial<Product>;
  const required = ['source_platform', 'source_url', 'original_title', 'category'];
  for (const field of required) {
    if (!body[field as keyof Product]) {
      return new Response(JSON.stringify(jsonError(ErrorCodes.INVALID_PARAMS, `Missing required field: ${field}`)), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  }

  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const tags = Array.isArray(body.tags) ? JSON.stringify(body.tags) : (body.tags || '[]');
  const images = Array.isArray(body.images) ? JSON.stringify(body.images) : (body.images || '[]');
  const pros = Array.isArray(body.pros) ? JSON.stringify(body.pros) : (body.pros || '[]');
  const cons = Array.isArray(body.cons) ? JSON.stringify(body.cons) : (body.cons || '[]');
  const use_cases = Array.isArray(body.use_cases) ? JSON.stringify(body.use_cases) : (body.use_cases || '[]');
  const target_audience = Array.isArray(body.target_audience) ? JSON.stringify(body.target_audience) : (body.target_audience || '[]');

  await env.DB.prepare(`
    INSERT INTO products (id, source_platform, source_url, original_title, rewritten_title, category, subcategory, tags, price_min, price_max, currency, images, summary, pros, cons, use_cases, target_audience, shipping_notes, merchant_name, affiliate_url, last_checked_at, status, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    id, body.source_platform, body.source_url, body.original_title, body.rewritten_title || null,
    body.category, body.subcategory || null, tags, body.price_min || null, body.price_max || null,
    body.currency || 'USD', images, body.summary || null, pros, cons, use_cases, target_audience,
    body.shipping_notes || null, body.merchant_name || null, body.affiliate_url || null,
    now, body.status || 'draft', now, now
  ).run();

  return new Response(JSON.stringify(jsonSuccess({ id })), {
    status: 201,
    headers: { 'Content-Type': 'application/json' },
  });
}

// PUT /api/admin/products/:id - F-040-15
export async function updateProduct(env: Env, request: Request, id: string): Promise<Response> {
  const existing = await env.DB.prepare('SELECT id FROM products WHERE id = ?').bind(id).first();
  if (!existing) {
    return new Response(JSON.stringify(jsonError(ErrorCodes.NOT_FOUND, 'Product not found')), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const body = await request.json() as Partial<Product>;
  const now = new Date().toISOString();
  const tags = body.tags ? (Array.isArray(body.tags) ? JSON.stringify(body.tags) : body.tags) : undefined;
  const images = body.images ? (Array.isArray(body.images) ? JSON.stringify(body.images) : body.images) : undefined;
  const pros = body.pros ? (Array.isArray(body.pros) ? JSON.stringify(body.pros) : body.pros) : undefined;
  const cons = body.cons ? (Array.isArray(body.cons) ? JSON.stringify(body.cons) : body.cons) : undefined;
  const use_cases = body.use_cases ? (Array.isArray(body.use_cases) ? JSON.stringify(body.use_cases) : body.use_cases) : undefined;
  const target_audience = body.target_audience ? (Array.isArray(body.target_audience) ? JSON.stringify(body.target_audience) : body.target_audience) : undefined;

  const fields: string[] = ['updated_at = ?'];
  const bindings: (string | number | null)[] = [now];

  const fieldMap: Record<string, unknown> = {
    source_platform: body.source_platform, source_url: body.source_url, original_title: body.original_title,
    rewritten_title: body.rewritten_title, category: body.category, subcategory: body.subcategory,
    price_min: body.price_min, price_max: body.price_max, currency: body.currency,
    summary: body.summary, shipping_notes: body.shipping_notes, merchant_name: body.merchant_name,
    affiliate_url: body.affiliate_url, last_checked_at: body.last_checked_at, status: body.status,
  };

  for (const [key, value] of Object.entries(fieldMap)) {
    if (value !== undefined) {
      fields.push(`${key} = ?`);
      bindings.push(value as string | number | null);
    }
  }

  if (tags) { fields.push('tags = ?'); bindings.push(tags); }
  if (images) { fields.push('images = ?'); bindings.push(images); }
  if (pros) { fields.push('pros = ?'); bindings.push(pros); }
  if (cons) { fields.push('cons = ?'); bindings.push(cons); }
  if (use_cases) { fields.push('use_cases = ?'); bindings.push(use_cases); }
  if (target_audience) { fields.push('target_audience = ?'); bindings.push(target_audience); }

  bindings.push(id);
  await env.DB.prepare(`UPDATE products SET ${fields.join(', ')} WHERE id = ?`).bind(...bindings).run();

  return new Response(JSON.stringify(jsonSuccess({ id })), {
    headers: { 'Content-Type': 'application/json' },
  });
}

// PATCH /api/admin/products/:id/status - F-040-16
export async function toggleProductStatus(env: Env, request: Request, id: string): Promise<Response> {
  const body = await request.json() as { status: string };
  if (!body.status || !['active', 'inactive', 'archived'].includes(body.status)) {
    return new Response(JSON.stringify(jsonError(ErrorCodes.INVALID_PARAMS, 'Invalid status value')), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const existing = await env.DB.prepare('SELECT id FROM products WHERE id = ?').bind(id).first();
  if (!existing) {
    return new Response(JSON.stringify(jsonError(ErrorCodes.NOT_FOUND, 'Product not found')), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const now = new Date().toISOString();
  await env.DB.prepare('UPDATE products SET status = ?, updated_at = ? WHERE id = ?').bind(body.status, now, id).run();

  return new Response(JSON.stringify(jsonSuccess({ id, status: body.status })), {
    headers: { 'Content-Type': 'application/json' },
  });
}

// PATCH /api/admin/products/:id/tags - F-011-02
export async function updateProductTags(env: Env, request: Request, productId: string): Promise<Response> {
  const body = await request.json() as { tags: string[] };

  if (!Array.isArray(body.tags)) {
    return new Response(JSON.stringify(jsonError(ErrorCodes.INVALID_PARAMS, 'tags must be an array')), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const existing = await env.DB.prepare('SELECT id FROM products WHERE id = ?').bind(productId).first();
  if (!existing) {
    return new Response(JSON.stringify(jsonError(ErrorCodes.NOT_FOUND, 'Product not found')), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const now = new Date().toISOString();
  const tagsJson = JSON.stringify(body.tags);
  await env.DB.prepare('UPDATE products SET tags = ?, updated_at = ? WHERE id = ?').bind(tagsJson, now, productId).run();

  return new Response(JSON.stringify(jsonSuccess({ id: productId, tags: body.tags })), {
    headers: { 'Content-Type': 'application/json' },
  });
}

// POST /api/admin/products/batch - F-010-04
export async function batchUpdateProducts(env: Env, request: Request): Promise<Response> {
  const body = await request.json() as { ids: string[]; action: string; value: string };

  if (!Array.isArray(body.ids) || body.ids.length === 0) {
    return new Response(JSON.stringify(jsonError(ErrorCodes.INVALID_PARAMS, 'ids must be a non-empty array')), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (!['add_tags', 'remove_tags', 'update_category'].includes(body.action)) {
    return new Response(JSON.stringify(jsonError(ErrorCodes.INVALID_PARAMS, 'Invalid action')), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const placeholders = body.ids.map(() => '?').join(',');
  const now = new Date().toISOString();

  if (body.action === 'update_category') {
    await env.DB.prepare(`UPDATE products SET category = ?, updated_at = ? WHERE id IN (${placeholders})`).bind(body.value, now, ...body.ids).run();
  } else {
    const rows = await env.DB.prepare(`SELECT id, tags FROM products WHERE id IN (${placeholders})`).bind(...body.ids).all<Record<string, unknown>>();
    for (const row of rows.results ?? []) {
      const currentTags: string[] = parseJSON<string[]>(row.tags as string || '[]', []);
      const newTags = body.action === 'add_tags'
        ? [...new Set([...currentTags, body.value])]
        : currentTags.filter(t => t !== body.value);
      await env.DB.prepare('UPDATE products SET tags = ?, updated_at = ? WHERE id = ?').bind(JSON.stringify(newTags), now, row.id).run();
    }
  }

  return new Response(JSON.stringify(jsonSuccess({ updated: body.ids.length })), {
    headers: { 'Content-Type': 'application/json' },
  });
}

// POST /api/admin/products/import - F-010-01
// Batch import products from JSON array (manual or AI-generated)
export async function importProducts(env: Env, request: Request): Promise<Response> {
  const body = await request.json() as { products: Partial<Product>[]; mode?: 'upsert' | 'insert' };

  if (!Array.isArray(body.products) || body.products.length === 0) {
    return new Response(JSON.stringify(jsonError(ErrorCodes.INVALID_PARAMS, 'products must be a non-empty array')), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const mode = body.mode === 'upsert' ? 'upsert' : 'insert';
  const results: { index: number; id?: string; status: 'success' | 'error'; error?: string }[] = [];
  const now = new Date().toISOString();

  for (let i = 0; i < body.products.length; i++) {
    const p = body.products[i];
    const required = ['source_platform', 'source_url', 'original_title', 'category'];
    const missing = required.filter(f => !p[f as keyof Product]);

    if (missing.length > 0) {
      results.push({ index: i, status: 'error', error: `Missing required fields: ${missing.join(', ')}` });
      continue;
    }

    try {
      const id = crypto.randomUUID();
      const tags = Array.isArray(p.tags) ? JSON.stringify(p.tags) : (p.tags || '[]');
      const images = Array.isArray(p.images) ? JSON.stringify(p.images) : (p.images || '[]');
      const pros = Array.isArray(p.pros) ? JSON.stringify(p.pros) : (p.pros || '[]');
      const cons = Array.isArray(p.cons) ? JSON.stringify(p.cons) : (p.cons || '[]');
      const use_cases = Array.isArray(p.use_cases) ? JSON.stringify(p.use_cases) : (p.use_cases || '[]');
      const target_audience = Array.isArray(p.target_audience) ? JSON.stringify(p.target_audience) : (p.target_audience || '[]');

      await env.DB.prepare(`
        INSERT INTO products (id, source_platform, source_url, original_title, rewritten_title, category, subcategory, tags, price_min, price_max, currency, images, summary, pros, cons, use_cases, target_audience, shipping_notes, merchant_name, affiliate_url, last_checked_at, status, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        id, p.source_platform, p.source_url, p.original_title, p.rewritten_title || null,
        p.category, p.subcategory || null, tags, p.price_min || null, p.price_max || null,
        p.currency || 'USD', images, p.summary || null, pros, cons, use_cases, target_audience,
        p.shipping_notes || null, p.merchant_name || null, p.affiliate_url || null,
        now, p.status || 'draft', now, now
      ).run();

      results.push({ index: i, id, status: 'success' });
    } catch (err) {
      results.push({ index: i, status: 'error', error: String(err) });
    }
  }

  const successCount = results.filter(r => r.status === 'success').length;
  const errorCount = results.filter(r => r.status === 'error').length;

  return new Response(JSON.stringify(jsonSuccess({
    imported: successCount,
    failed: errorCount,
    mode,
    results
  })), {
    status: errorCount > 0 ? 207 : 201, // 207 Multi-Status if partial success
    headers: { 'Content-Type': 'application/json' },
  });
}
