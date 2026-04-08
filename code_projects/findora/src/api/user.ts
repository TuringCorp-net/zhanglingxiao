// User Module - User management endpoints
import { Env, EMSUser } from '../db/schema';
import { jsonSuccess, jsonError } from '../lib/response';
import { ErrorCodes } from '../lib/errors';
import { verifyToken, createAuditLog } from './auth';

// Helper to extract user ID from request
async function getUserIdFromRequest(request: Request, env: Env): Promise<string | null> {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  const token = authHeader.substring(7);
  const decoded = await verifyToken(token);
  return decoded?.userId || null;
}

// GET /api/users/profile - Get current user profile
export async function getProfile(env: Env, request: Request): Promise<Response> {
  const userId = await getUserIdFromRequest(request, env);
  if (!userId) {
    return new Response(JSON.stringify(jsonError(ErrorCodes.UNAUTHORIZED, 'Authentication required')), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const user = await env.DB.prepare(
    'SELECT id, email, name, phone, avatar_url, status, email_verified_at, last_login_at, created_at, updated_at FROM ems_users WHERE id = ?'
  ).bind(userId).first<Record<string, unknown>>();

  if (!user) {
    return new Response(JSON.stringify(jsonError(ErrorCodes.NOT_FOUND, 'User not found')), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Get enterprise memberships
  const memberships = await env.DB.prepare(`
    SELECT em.*, e.name, e.slug
    FROM enterprise_members em
    INNER JOIN enterprises e ON em.enterprise_id = e.id
    WHERE em.user_id = ? AND em.status = 'active'
  `).bind(userId).all<Record<string, unknown>>();

  return new Response(JSON.stringify(jsonSuccess({ ...user, enterprises: memberships.results || [] })), {
    headers: { 'Content-Type': 'application/json' },
  });
}

// PUT /api/users/profile - Update current user profile
export async function updateProfile(env: Env, request: Request): Promise<Response> {
  const userId = await getUserIdFromRequest(request, env);
  if (!userId) {
    return new Response(JSON.stringify(jsonError(ErrorCodes.UNAUTHORIZED, 'Authentication required')), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const body = await request.json() as Partial<EMSUser>;
  const now = new Date().toISOString();

  const fields: string[] = ['updated_at = ?'];
  const bindings: (string | null)[] = [now];

  const fieldMap: Record<string, unknown> = {
    name: body.name,
    phone: body.phone,
    avatar_url: body.avatar_url
  };

  for (const [key, value] of Object.entries(fieldMap)) {
    if (value !== undefined) {
      fields.push(`${key} = ?`);
      bindings.push(value as string | null);
    }
  }

  bindings.push(userId);
  await env.DB.prepare(`UPDATE ems_users SET ${fields.join(', ')} WHERE id = ?`).bind(...bindings).run();

  await createAuditLog(env, null, userId, 'update', 'user', userId, request, { fields: Object.keys(fieldMap) });

  return new Response(JSON.stringify(jsonSuccess({ id: userId, message: 'Profile updated' })), {
    headers: { 'Content-Type': 'application/json' },
  });
}

// PATCH /api/users/profile/avatar - Update avatar
export async function updateAvatar(env: Env, request: Request): Promise<Response> {
  const userId = await getUserIdFromRequest(request, env);
  if (!userId) {
    return new Response(JSON.stringify(jsonError(ErrorCodes.UNAUTHORIZED, 'Authentication required')), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const body = await request.json() as { avatar_url: string };
  if (!body.avatar_url) {
    return new Response(JSON.stringify(jsonError(ErrorCodes.INVALID_PARAMS, 'avatar_url is required')), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const now = new Date().toISOString();
  await env.DB.prepare('UPDATE ems_users SET avatar_url = ?, updated_at = ? WHERE id = ?').bind(body.avatar_url, now, userId).run();

  await createAuditLog(env, null, userId, 'update', 'user', userId, request, { field: 'avatar_url' });

  return new Response(JSON.stringify(jsonSuccess({ avatar_url: body.avatar_url })), {
    headers: { 'Content-Type': 'application/json' },
  });
}

// GET /api/users/search - Search users by email (for enterprise member invitation)
export async function searchUsers(env: Env, request: Request): Promise<Response> {
  const userId = await getUserIdFromRequest(request, env);
  if (!userId) {
    return new Response(JSON.stringify(jsonError(ErrorCodes.UNAUTHORIZED, 'Authentication required')), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const url = new URL(request.url);
  const query = url.searchParams.get('q');

  if (!query || query.length < 2) {
    return new Response(JSON.stringify(jsonError(ErrorCodes.INVALID_PARAMS, 'Query must be at least 2 characters')), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const results = await env.DB.prepare(`
    SELECT id, email, name, avatar_url
    FROM ems_users
    WHERE (email LIKE ? OR name LIKE ?) AND status = 'active'
    LIMIT 20
  `).bind(`%${query}%`, `%${query}%`).all<Record<string, unknown>>();

  return new Response(JSON.stringify(jsonSuccess(results.results || [])), {
    headers: { 'Content-Type': 'application/json' },
  });
}

// GET /api/users/:id - Get user by ID (public info only)
export async function getUserById(env: Env, request: Request, id: string): Promise<Response> {
  const userId = await getUserIdFromRequest(request, env);
  if (!userId) {
    return new Response(JSON.stringify(jsonError(ErrorCodes.UNAUTHORIZED, 'Authentication required')), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const user = await env.DB.prepare(
    'SELECT id, email, name, avatar_url, created_at FROM ems_users WHERE id = ? AND status = ?'
  ).bind(id, 'active').first<Record<string, unknown>>();

  if (!user) {
    return new Response(JSON.stringify(jsonError(ErrorCodes.NOT_FOUND, 'User not found')), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify(jsonSuccess(user)), {
    headers: { 'Content-Type': 'application/json' },
  });
}

// GET /api/users/sessions - List active sessions
export async function listSessions(env: Env, request: Request): Promise<Response> {
  const userId = await getUserIdFromRequest(request, env);
  if (!userId) {
    return new Response(JSON.stringify(jsonError(ErrorCodes.UNAUTHORIZED, 'Authentication required')), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const result = await env.DB.prepare(`
    SELECT id, ip_address, user_agent, expires_at, created_at
    FROM user_sessions
    WHERE user_id = ? AND expires_at > ?
    ORDER BY created_at DESC
  `).bind(userId, new Date().toISOString()).all<Record<string, unknown>>();

  return new Response(JSON.stringify(jsonSuccess(result.results || [])), {
    headers: { 'Content-Type': 'application/json' },
  });
}

// DELETE /api/users/sessions/:sessionId - Revoke specific session
export async function revokeSession(env: Env, request: Request, sessionId: string): Promise<Response> {
  const userId = await getUserIdFromRequest(request, env);
  if (!userId) {
    return new Response(JSON.stringify(jsonError(ErrorCodes.UNAUTHORIZED, 'Authentication required')), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const session = await env.DB.prepare('SELECT user_id FROM user_sessions WHERE id = ?').bind(sessionId).first<{ user_id: string }>();
  if (!session) {
    return new Response(JSON.stringify(jsonError(ErrorCodes.NOT_FOUND, 'Session not found')), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (session.user_id !== userId) {
    return new Response(JSON.stringify(jsonError(ErrorCodes.FORBIDDEN, 'Cannot revoke other user sessions')), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  await env.DB.prepare('DELETE FROM user_sessions WHERE id = ?').bind(sessionId).run();

  await createAuditLog(env, null, userId, 'logout', 'auth', sessionId, request);

  return new Response(JSON.stringify(jsonSuccess({ message: 'Session revoked' })), {
    headers: { 'Content-Type': 'application/json' },
  });
}

// DELETE /api/users/sessions - Revoke all sessions except current
export async function revokeAllSessions(env: Env, request: Request): Promise<Response> {
  const userId = await getUserIdFromRequest(request, env);
  if (!userId) {
    return new Response(JSON.stringify(jsonError(ErrorCodes.UNAUTHORIZED, 'Authentication required')), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const authHeader = request.headers.get('Authorization');
  const currentToken = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null;

  if (currentToken) {
    await env.DB.prepare('DELETE FROM user_sessions WHERE user_id = ? AND token != ?').bind(userId, currentToken).run();
  } else {
    await env.DB.prepare('DELETE FROM user_sessions WHERE user_id = ?').bind(userId).run();
  }

  await createAuditLog(env, null, userId, 'logout', 'auth', 'all', request);

  return new Response(JSON.stringify(jsonSuccess({ message: 'All other sessions revoked' })), {
    headers: { 'Content-Type': 'application/json' },
  });
}

// PATCH /api/users/status - Update user status (admin only, self-deactivation)
export async function updateUserStatus(env: Env, request: Request): Promise<Response> {
  const userId = await getUserIdFromRequest(request, env);
  if (!userId) {
    return new Response(JSON.stringify(jsonError(ErrorCodes.UNAUTHORIZED, 'Authentication required')), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const body = await request.json() as { status: string };
  if (!body.status) {
    return new Response(JSON.stringify(jsonError(ErrorCodes.INVALID_PARAMS, 'Status is required')), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const validStatuses = ['active', 'inactive', 'suspended'];
  if (!validStatuses.includes(body.status)) {
    return new Response(JSON.stringify(jsonError(ErrorCodes.INVALID_PARAMS, 'Invalid status')), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const now = new Date().toISOString();
  await env.DB.prepare('UPDATE ems_users SET status = ?, updated_at = ? WHERE id = ?').bind(body.status, now, userId).run();

  await createAuditLog(env, null, userId, 'update', 'user', userId, request, { field: 'status', new_status: body.status });

  return new Response(JSON.stringify(jsonSuccess({ status: body.status })), {
    headers: { 'Content-Type': 'application/json' },
  });
}
