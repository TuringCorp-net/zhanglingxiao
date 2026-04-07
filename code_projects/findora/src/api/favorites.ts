// Favorites API - F-040-09, F-040-10, F-040-11
import { Env, User } from '../db/schema';
import { jsonSuccess, jsonError, parseJSON } from '../lib/response';
import { ErrorCodes } from '../lib/errors';

function getUserIdentifier(request: Request): { email?: string; anonymous_id?: string } {
  const email = request.headers.get('X-User-Email');
  const anonymous_id = request.headers.get('X-Anonymous-Id');
  return { email: email || undefined, anonymous_id: anonymous_id || undefined };
}

// POST /api/favorites - F-040-09
export async function addFavorite(env: Env, request: Request): Promise<Response> {
  const { email, anonymous_id } = getUserIdentifier(request);
  if (!email && !anonymous_id) {
    return new Response(JSON.stringify(jsonError(ErrorCodes.INVALID_PARAMS, 'Email or anonymous_id is required')), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const body = await request.json() as { product_id: string };
  if (!body.product_id) {
    return new Response(JSON.stringify(jsonError(ErrorCodes.INVALID_PARAMS, 'product_id is required')), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Check product exists
  const product = await env.DB.prepare('SELECT id FROM products WHERE id = ?').bind(body.product_id).first();
  if (!product) {
    return new Response(JSON.stringify(jsonError(ErrorCodes.NOT_FOUND, 'Product not found')), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  let user: Record<string, unknown> | null = null;
  let userQuery = 'SELECT * FROM users WHERE ';
  let userRow: Record<string, unknown> | null = null;
  if (email) {
    userQuery += 'email = ?';
    userRow = await env.DB.prepare(userQuery).bind(email.toLowerCase()).first();
  } else {
    userQuery += 'anonymous_id = ?';
    userRow = await env.DB.prepare(userQuery).bind(anonymous_id!).first();
  }

  const savedItems: string[] = userRow ? parseJSON(userRow.saved_items as string, []) : [];

  if (!savedItems.includes(body.product_id)) {
    savedItems.push(body.product_id);
  }

  const now = new Date().toISOString();
  if (userRow) {
    await env.DB.prepare('UPDATE users SET saved_items = ?, updated_at = ? WHERE id = ?')
      .bind(JSON.stringify(savedItems), now, userRow.id as string).run();
  } else {
    // Create user with this saved item
    const id = crypto.randomUUID();
    await env.DB.prepare(`
      INSERT INTO users (id, email, anonymous_id, saved_items, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).bind(id, email?.toLowerCase() || null, anonymous_id || null, JSON.stringify(savedItems), 'active', now, now).run();
  }

  return new Response(JSON.stringify(jsonSuccess({ product_id: body.product_id, saved: true })), {
    status: 201,
    headers: { 'Content-Type': 'application/json' },
  });
}

// DELETE /api/favorites/:product_id - F-040-10
export async function removeFavorite(env: Env, request: Request, productId: string): Promise<Response> {
  const { email, anonymous_id } = getUserIdentifier(request);
  if (!email && !anonymous_id) {
    return new Response(JSON.stringify(jsonError(ErrorCodes.INVALID_PARAMS, 'Email or anonymous_id is required')), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  let userQuery = 'SELECT * FROM users WHERE ';
  if (email) {
    userQuery += 'email = ?';
  } else {
    userQuery += 'anonymous_id = ?';
  }

  const user = await env.DB.prepare(userQuery).bind(email ? email.toLowerCase() : anonymous_id!).first<Record<string, unknown>>();
  if (!user) {
    return new Response(JSON.stringify(jsonError(ErrorCodes.NOT_FOUND, 'User not found')), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const savedItems: string[] = parseJSON(user.saved_items as string, []);
  const index = savedItems.indexOf(productId);
  if (index === -1) {
    return new Response(JSON.stringify(jsonError(ErrorCodes.NOT_FOUND, 'Product not in favorites')), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  savedItems.splice(index, 1);
  const now = new Date().toISOString();
  await env.DB.prepare('UPDATE users SET saved_items = ?, updated_at = ? WHERE id = ?')
    .bind(JSON.stringify(savedItems), now, user.id as string).run();

  return new Response(JSON.stringify(jsonSuccess({ product_id: productId, removed: true })), {
    headers: { 'Content-Type': 'application/json' },
  });
}

// GET /api/favorites - F-040-11
export async function listFavorites(env: Env, request: Request): Promise<Response> {
  const { email, anonymous_id } = getUserIdentifier(request);
  if (!email && !anonymous_id) {
    return new Response(JSON.stringify(jsonError(ErrorCodes.INVALID_PARAMS, 'Email or anonymous_id is required')), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  let userQuery = 'SELECT saved_items FROM users WHERE ';
  if (email) {
    userQuery += 'email = ?';
  } else {
    userQuery += 'anonymous_id = ?';
  }

  const user = await env.DB.prepare(userQuery).bind(email ? email.toLowerCase() : anonymous_id!).first<{ saved_items: string }>();
  if (!user) {
    return new Response(JSON.stringify(jsonSuccess([])), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const savedItems: string[] = parseJSON(user.saved_items, []);
  if (savedItems.length === 0) {
    return new Response(JSON.stringify(jsonSuccess([])), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const placeholders = savedItems.map(() => '?').join(',');
  const products = await env.DB.prepare(
    `SELECT * FROM products WHERE id IN (${placeholders}) AND status = ?`
  ).bind(...savedItems, 'active').all<Record<string, unknown>>();

  return new Response(JSON.stringify(jsonSuccess(products.results || [])), {
    headers: { 'Content-Type': 'application/json' },
  });
}
