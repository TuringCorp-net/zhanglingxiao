// Subscribe API - F-040-06, F-040-07, F-040-08
import { Env, User } from '../db/schema';
import { jsonSuccess, jsonError, parseJSON } from '../lib/response';
import { ErrorCodes } from '../lib/errors';

function getUserIdentifier(request: Request): { email?: string; anonymous_id?: string } {
  const email = request.headers.get('X-User-Email');
  const anonymous_id = request.headers.get('X-Anonymous-Id');
  return { email: email || undefined, anonymous_id: anonymous_id || undefined };
}

// POST /api/subscribe - F-040-06
export async function subscribe(env: Env, request: Request): Promise<Response> {
  const { email, anonymous_id } = getUserIdentifier(request);
  const body = await request.json() as {
    email?: string;
    subscribed_categories?: string[];
    price_preference?: string;
    locale?: string;
    frequency_preference?: string;
  };

  const targetEmail = email || body.email;
  if (!targetEmail) {
    return new Response(JSON.stringify(jsonError(ErrorCodes.INVALID_PARAMS, 'Email is required')), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Check if already subscribed
  const existing = await env.DB.prepare('SELECT id FROM users WHERE email = ?').bind(targetEmail.toLowerCase()).first<{ id: string }>();
  if (existing) {
    return new Response(JSON.stringify(jsonError(ErrorCodes.ALREADY_SUBSCRIBED, 'Already subscribed')), {
      status: 409,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const subscribed_at = now;

  await env.DB.prepare(`
    INSERT INTO users (id, email, anonymous_id, subscribed_categories, price_preference, locale, frequency_preference, subscribed_at, status, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    id, targetEmail.toLowerCase(), anonymous_id || null,
    JSON.stringify(body.subscribed_categories || []),
    body.price_preference || null, body.locale || 'en',
    body.frequency_preference || 'daily', subscribed_at,
    'active', now, now
  ).run();

  return new Response(JSON.stringify(jsonSuccess({ id, subscribed_at })), {
    status: 201,
    headers: { 'Content-Type': 'application/json' },
  });
}

// DELETE /api/subscribe - F-040-07
export async function unsubscribe(env: Env, request: Request): Promise<Response> {
  const { email, anonymous_id } = getUserIdentifier(request);

  if (!email && !anonymous_id) {
    return new Response(JSON.stringify(jsonError(ErrorCodes.INVALID_PARAMS, 'Email or anonymous_id is required')), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  let query = 'UPDATE users SET status = ?, unsubscribed_at = ?, updated_at = ? WHERE ';
  const bindings: string[] = ['unsubscribed', new Date().toISOString(), new Date().toISOString()];

  if (email) {
    query += 'email = ?';
    bindings.push(email.toLowerCase());
  } else {
    query += 'anonymous_id = ?';
    bindings.push(anonymous_id!);
  }

  const result = await env.DB.prepare(query).bind(...bindings).run();

  if (result.meta.changes === 0) {
    return new Response(JSON.stringify(jsonError(ErrorCodes.NOT_SUBSCRIBED, 'Not subscribed')), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify(jsonSuccess({ message: 'Unsubscribed successfully' })), {
    headers: { 'Content-Type': 'application/json' },
  });
}

// PATCH /api/subscribe/preferences - F-040-08
export async function updatePreferences(env: Env, request: Request): Promise<Response> {
  const { email, anonymous_id } = getUserIdentifier(request);

  if (!email && !anonymous_id) {
    return new Response(JSON.stringify(jsonError(ErrorCodes.INVALID_PARAMS, 'Email or anonymous_id is required')), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const body = await request.json() as {
    subscribed_categories?: string[];
    price_preference?: string;
    liked_tags?: string[];
    disliked_tags?: string[];
    locale?: string;
    frequency_preference?: string;
  };

  const fields: string[] = ['updated_at = ?'];
  const bindings: (string | null)[] = [new Date().toISOString()];

  if (body.subscribed_categories !== undefined) {
    fields.push('subscribed_categories = ?');
    bindings.push(JSON.stringify(body.subscribed_categories));
  }
  if (body.price_preference !== undefined) {
    fields.push('price_preference = ?');
    bindings.push(body.price_preference);
  }
  if (body.liked_tags !== undefined) {
    fields.push('liked_tags = ?');
    bindings.push(JSON.stringify(body.liked_tags));
  }
  if (body.disliked_tags !== undefined) {
    fields.push('disliked_tags = ?');
    bindings.push(JSON.stringify(body.disliked_tags));
  }
  if (body.locale !== undefined) {
    fields.push('locale = ?');
    bindings.push(body.locale);
  }
  if (body.frequency_preference !== undefined) {
    fields.push('frequency_preference = ?');
    bindings.push(body.frequency_preference);
  }

  let query = `UPDATE users SET ${fields.join(', ')} WHERE `;
  if (email) {
    query += 'email = ?';
    bindings.push(email.toLowerCase());
  } else {
    query += 'anonymous_id = ?';
    bindings.push(anonymous_id!);
  }

  const result = await env.DB.prepare(query).bind(...bindings).run();

  if (result.meta.changes === 0) {
    return new Response(JSON.stringify(jsonError(ErrorCodes.NOT_SUBSCRIBED, 'User not found')), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify(jsonSuccess({ message: 'Preferences updated' })), {
    headers: { 'Content-Type': 'application/json' },
  });
}
