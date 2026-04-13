// Products API - F-040-01, F-040-02, F-040-14, F-040-15, F-040-16
import { Env, Product } from '../db/schema';
import { jsonSuccess, jsonError, parseJSON } from '../lib/response';
import { ErrorCodes } from '../lib/errors';
import {
  buildProductContent,
  getAcceptsMarkdown,
  parseProductContentFromRow,
  readProductContent,
  readProductMarkdown,
  resolveProductR2Key,
  toClientProduct,
  writeProductContent,
} from '../lib/product_content';

function parseProduct(row: Record<string, unknown>) {
  return toClientProduct(row, parseProductContentFromRow(row));
}

function normalizeStringArray(input: unknown): string[] {
  if (Array.isArray(input)) {
    return input.map(item => String(item)).filter(Boolean);
  }
  if (typeof input === 'string') {
    const parsed = parseJSON<string[]>(input, []);
    if (Array.isArray(parsed)) {
      return parsed.map(item => String(item)).filter(Boolean);
    }
  }
  return [];
}

function buildContentFromBody(body: Partial<Product>): ReturnType<typeof buildProductContent> {
  return buildProductContent({
    summary: typeof body.summary === 'string' ? body.summary : null,
    images: normalizeStringArray(body.images),
    pros: normalizeStringArray(body.pros),
    cons: normalizeStringArray(body.cons),
    use_cases: normalizeStringArray(body.use_cases),
    target_audience: normalizeStringArray(body.target_audience),
    shipping_notes: typeof body.shipping_notes === 'string' ? body.shipping_notes : null,
  });
}

function resolveCoverImage(body: Partial<Product>, contentImages: string[]): string | null {
  if (typeof body.cover_image === 'string' && body.cover_image.trim()) {
    return body.cover_image.trim();
  }
  return contentImages[0] || null;
}

function resolveTitle(body: Partial<Product>): string {
  if (typeof body.title === 'string' && body.title.trim()) {
    return body.title.trim();
  }
  if (typeof body.rewritten_title === 'string' && body.rewritten_title.trim()) {
    return body.rewritten_title.trim();
  }
  if (typeof body.original_title === 'string' && body.original_title.trim()) {
    return body.original_title.trim();
  }
  return '';
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

  // Sorting: newest, popular (clicks count in 30 days), price_asc, price_desc
  const sortBy = url.searchParams.get('sort_by') || 'newest';

  let selectFields = 'p.*';
  let fromClause = 'FROM products p';
  let joinClause = '';
  let groupClause = '';

  if (sortBy === 'popular') {
    selectFields = 'p.*, COUNT(c.id) as click_count';
    joinClause = 'LEFT JOIN clicks c ON p.id = c.product_id AND c.clicked_at > datetime(\'now\', \'-30 days\')';
    groupClause = 'GROUP BY p.id';
  }

  let whereClause = 'WHERE p.status = ?';
  const bindings: (string | number)[] = ['active'];

  if (category) {
    whereClause += ' AND p.category = ?';
    bindings.push(category);
  }

  const subcategory = url.searchParams.get('subcategory');
  if (subcategory) {
    whereClause += ' AND p.subcategory = ?';
    bindings.push(subcategory);
  }

  if (priceMin) {
    whereClause += ' AND p.price_min >= ?';
    bindings.push(parseFloat(priceMin));
  }

  if (priceMax) {
    whereClause += ' AND p.price_max <= ?';
    bindings.push(parseFloat(priceMax));
  }

  // ST-S03修复：使用json_each安全匹配标签，避免LIKE注入风险
  if (tag) {
    whereClause += ' AND EXISTS (SELECT 1 FROM json_each(p.tags) AS jt WHERE jt.value = ?)';
    bindings.push(tag);
  }

  // Count query (without join/group for count)
  const countQuery = `SELECT COUNT(*) as total FROM products p ${whereClause}`;
  const countBindings = [...bindings];
  const countResult = await env.DB.prepare(countQuery).bind(...countBindings).first<{ total: number }>();
  const total = countResult?.total || 0;

  // Build ORDER clause
  let orderClause = 'ORDER BY p.created_at DESC';
  switch (sortBy) {
    case 'newest':
      orderClause = 'ORDER BY p.created_at DESC';
      break;
    case 'popular':
      orderClause = 'ORDER BY click_count DESC, p.created_at DESC';
      break;
    case 'price_asc':
      orderClause = 'ORDER BY p.price_min ASC NULLS LAST';
      break;
    case 'price_desc':
      orderClause = 'ORDER BY p.price_min DESC NULLS LAST';
      break;
  }

  // Build final query
  const query = `SELECT ${selectFields} ${fromClause} ${joinClause} ${whereClause} ${groupClause} ${orderClause} LIMIT ? OFFSET ?`;
  const finalBindings = [...bindings, limit, offset];

  const result = await env.DB.prepare(query).bind(...finalBindings).all<Record<string, unknown>>();
  const products = (result.results || []).map(parseProduct);

  return new Response(JSON.stringify(jsonSuccess(products, { page, total, sort_by: sortBy })), {
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

  const r2Key = resolveProductR2Key(result);
  const markdownAccepted = getAcceptsMarkdown(request);
  if (markdownAccepted) {
    const markdown = await readProductMarkdown(env, r2Key);
    if (markdown) {
      return new Response(markdown, {
        headers: { 'Content-Type': 'text/markdown; charset=utf-8' },
      });
    }
  }

  const contentFromR2 = await readProductContent(env, r2Key);
  const content = contentFromR2 || parseProductContentFromRow(result);
  if (!contentFromR2) {
    await writeProductContent(env, r2Key, content);
  }

  return new Response(JSON.stringify(jsonSuccess(toClientProduct(result, content))), {
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
  const content = buildContentFromBody(body);
  const coverImage = resolveCoverImage(body, content.images);
  const title = resolveTitle(body);
  const r2Key = (typeof body.r2_object_key === 'string' && body.r2_object_key.trim()) ? body.r2_object_key.trim() : `products/${id}.md`;

  await writeProductContent(env, r2Key, content);

  await env.DB.prepare(`
    INSERT INTO products (id, title, source_platform, source_url, original_title, rewritten_title, category, subcategory, tags, price_min, price_max, currency, cover_image, r2_object_key, images, summary, pros, cons, use_cases, target_audience, shipping_notes, merchant_name, affiliate_url, last_checked_at, status, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    id, title, body.source_platform, body.source_url, body.original_title, body.rewritten_title || null,
    body.category, body.subcategory || null, tags, body.price_min || null, body.price_max || null,
    body.currency || 'USD', coverImage, r2Key,
    JSON.stringify(content.images), content.summary, JSON.stringify(content.pros), JSON.stringify(content.cons),
    JSON.stringify(content.use_cases), JSON.stringify(content.target_audience), content.shipping_notes,
    body.merchant_name || null, body.affiliate_url || null,
    now, body.status || 'draft', now, now
  ).run();

  return new Response(JSON.stringify(jsonSuccess({ id, r2_object_key: r2Key })), {
    status: 201,
    headers: { 'Content-Type': 'application/json' },
  });
}

// PUT /api/admin/products/:id - F-040-15
export async function updateProduct(env: Env, request: Request, id: string): Promise<Response> {
  const existing = await env.DB.prepare('SELECT * FROM products WHERE id = ?').bind(id).first<Record<string, unknown>>();
  if (!existing) {
    return new Response(JSON.stringify(jsonError(ErrorCodes.NOT_FOUND, 'Product not found')), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const body = await request.json() as Partial<Product>;
  const now = new Date().toISOString();
  const existingContent = await readProductContent(env, resolveProductR2Key(existing));
  const mergedContent = buildProductContent({
    ...(existingContent || parseProductContentFromRow(existing)),
    ...(body.summary !== undefined ? { summary: body.summary } : {}),
    ...(body.images !== undefined ? { images: normalizeStringArray(body.images) } : {}),
    ...(body.pros !== undefined ? { pros: normalizeStringArray(body.pros) } : {}),
    ...(body.cons !== undefined ? { cons: normalizeStringArray(body.cons) } : {}),
    ...(body.use_cases !== undefined ? { use_cases: normalizeStringArray(body.use_cases) } : {}),
    ...(body.target_audience !== undefined ? { target_audience: normalizeStringArray(body.target_audience) } : {}),
    ...(body.shipping_notes !== undefined ? { shipping_notes: body.shipping_notes } : {}),
  });
  const r2Key = (typeof body.r2_object_key === 'string' && body.r2_object_key.trim())
    ? body.r2_object_key.trim()
    : resolveProductR2Key(existing);
  const coverImage = resolveCoverImage({
    ...existing,
    ...body,
  } as Partial<Product>, mergedContent.images);
  const title = resolveTitle({
    ...existing,
    ...body,
  } as Partial<Product>);

  await writeProductContent(env, r2Key, mergedContent);
  const tags = body.tags !== undefined ? (Array.isArray(body.tags) ? JSON.stringify(body.tags) : body.tags) : undefined;

  const fields: string[] = ['updated_at = ?'];
  const bindings: (string | number | null)[] = [now];

  const fieldMap: Record<string, unknown> = {
    title, source_platform: body.source_platform, source_url: body.source_url, original_title: body.original_title,
    rewritten_title: body.rewritten_title, category: body.category, subcategory: body.subcategory,
    price_min: body.price_min, price_max: body.price_max, currency: body.currency,
    cover_image: coverImage, r2_object_key: r2Key, summary: mergedContent.summary,
    shipping_notes: mergedContent.shipping_notes, merchant_name: body.merchant_name,
    affiliate_url: body.affiliate_url, last_checked_at: body.last_checked_at, status: body.status,
    images: JSON.stringify(mergedContent.images),
    pros: JSON.stringify(mergedContent.pros),
    cons: JSON.stringify(mergedContent.cons),
    use_cases: JSON.stringify(mergedContent.use_cases),
    target_audience: JSON.stringify(mergedContent.target_audience),
  };

  for (const [key, value] of Object.entries(fieldMap)) {
    if (value !== undefined) {
      fields.push(`${key} = ?`);
      bindings.push(value as string | number | null);
    }
  }

  if (tags !== undefined) { fields.push('tags = ?'); bindings.push(tags); }

  bindings.push(id);
  await env.DB.prepare(`UPDATE products SET ${fields.join(', ')} WHERE id = ?`).bind(...bindings).run();

  return new Response(JSON.stringify(jsonSuccess({ id, r2_object_key: r2Key })), {
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

  // P1-4: Add batch limit to prevent resource exhaustion (max 100 items per batch)
  const MAX_BATCH_SIZE = 100;
  if (body.products.length > MAX_BATCH_SIZE) {
    return new Response(JSON.stringify(jsonError(ErrorCodes.INVALID_PARAMS, `Maximum ${MAX_BATCH_SIZE} products per batch`)), {
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
      let id = typeof p.id === 'string' && p.id ? p.id : crypto.randomUUID();
      const tags = Array.isArray(p.tags) ? JSON.stringify(p.tags) : (p.tags || '[]');
      let existingId: string | null = null;
      if (mode === 'upsert') {
        if (typeof p.id === 'string' && p.id) {
          const existingById = await env.DB.prepare('SELECT id FROM products WHERE id = ?').bind(p.id).first<{ id: string }>();
          existingId = existingById?.id || null;
        }
        if (!existingId) {
          const existingBySource = await env.DB.prepare('SELECT id FROM products WHERE source_url = ?').bind(p.source_url as string).first<{ id: string }>();
          existingId = existingBySource?.id || null;
        }
      }

      if (existingId) {
        id = existingId;
      }

      const content = buildContentFromBody(p);
      const coverImage = resolveCoverImage(p, content.images);
      const title = resolveTitle(p);
      const r2Key = (typeof p.r2_object_key === 'string' && p.r2_object_key.trim())
        ? p.r2_object_key.trim()
        : `products/${id}.md`;
      await writeProductContent(env, r2Key, content);

      if (existingId) {
        await env.DB.prepare(`
          UPDATE products
          SET title = ?, source_platform = ?, source_url = ?, original_title = ?, rewritten_title = ?, category = ?, subcategory = ?,
              tags = ?, price_min = ?, price_max = ?, currency = ?, cover_image = ?, r2_object_key = ?, images = ?,
              summary = ?, pros = ?, cons = ?, use_cases = ?, target_audience = ?, shipping_notes = ?, merchant_name = ?,
              affiliate_url = ?, last_checked_at = ?, status = ?, updated_at = ?
          WHERE id = ?
        `).bind(
          title, p.source_platform, p.source_url, p.original_title, p.rewritten_title || null,
          p.category, p.subcategory || null, tags, p.price_min || null, p.price_max || null, p.currency || 'USD',
          coverImage, r2Key, JSON.stringify(content.images), content.summary, JSON.stringify(content.pros),
          JSON.stringify(content.cons), JSON.stringify(content.use_cases), JSON.stringify(content.target_audience),
          content.shipping_notes, p.merchant_name || null, p.affiliate_url || null, now, p.status || 'draft', now, id
        ).run();
      } else {
        await env.DB.prepare(`
          INSERT INTO products (id, title, source_platform, source_url, original_title, rewritten_title, category, subcategory, tags, price_min, price_max, currency, cover_image, r2_object_key, images, summary, pros, cons, use_cases, target_audience, shipping_notes, merchant_name, affiliate_url, last_checked_at, status, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(
          id, title, p.source_platform, p.source_url, p.original_title, p.rewritten_title || null,
          p.category, p.subcategory || null, tags, p.price_min || null, p.price_max || null,
          p.currency || 'USD', coverImage, r2Key, JSON.stringify(content.images), content.summary,
          JSON.stringify(content.pros), JSON.stringify(content.cons), JSON.stringify(content.use_cases),
          JSON.stringify(content.target_audience), content.shipping_notes, p.merchant_name || null, p.affiliate_url || null,
          now, p.status || 'draft', now, now
        ).run();
      }

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

// GET /api/trending - F-001-05 (Trending Now content section)
export async function getTrending(env: Env, request: Request): Promise<Response> {
  const url = new URL(request.url);
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '10'), 50);

  // Get trending products based on click count in last 7 days, weighted by recency
  const result = await env.DB.prepare(`
    SELECT p.*,
      COUNT(c.id) as click_count,
      MAX(c.clicked_at) as last_clicked
    FROM products p
    LEFT JOIN clicks c ON p.id = c.product_id
      AND c.clicked_at > datetime('now', '-7 days')
    WHERE p.status = ?
    GROUP BY p.id
    HAVING click_count > 0
    ORDER BY click_count DESC, last_clicked DESC
    LIMIT ?
  `).bind('active', limit).all<Record<string, unknown>>();

  const products = (result.results || []).map(parseProduct);

  // Also get trending lists (recently published with high click activity)
  const trendingLists = await env.DB.prepare(`
    SELECT l.*,
      COUNT(c.id) as click_count
    FROM lists l
    LEFT JOIN list_products lp ON l.id = lp.list_id
    LEFT JOIN clicks c ON lp.product_id = c.product_id
      AND c.clicked_at > datetime('now', '-7 days')
    WHERE l.status = 'published'
    GROUP BY l.id
    HAVING click_count > 0
    ORDER BY click_count DESC
    LIMIT 5
  `).bind().all<Record<string, unknown>>();

  return new Response(JSON.stringify(jsonSuccess({
    products,
    lists: trendingLists.results || [],
    period_days: 7,
  })), {
    headers: { 'Content-Type': 'application/json' },
  });
}
