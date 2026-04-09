// Authentication Module - JWT auth, login, register, token validation
import { Env, EMSUser, UserSession, AuditLog } from '../db/schema';
import { jsonSuccess, jsonError } from '../lib/response';
import { ErrorCodes } from '../lib/errors';

// Simple JWT implementation using Web Crypto
async function generateSecret(): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode('findora-enterprise-secret-key-2024'),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  );
}

async function createToken(userId: string, expiresIn: number = 86400): Promise<string> {
  const secret = await generateSecret();
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = btoa(JSON.stringify({
    sub: userId,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + expiresIn
  }));
  const signature = await crypto.subtle.sign('HMAC', secret, new TextEncoder().encode(`${header}.${payload}`));
  const sig = btoa(String.fromCharCode(...new Uint8Array(signature)));
  return `${header}.${payload}.${sig}`;
}

async function verifyToken(token: string): Promise<{ userId: string; expiresAt: number } | null> {
  try {
    const [header, payload, signature] = token.split('.');
    if (!header || !payload || !signature) return null;

    const secret = await generateSecret();
    const verified = await crypto.subtle.verify(
      'HMAC',
      secret,
      Uint8Array.from(atob(signature), c => c.charCodeAt(0)),
      new TextEncoder().encode(`${header}.${payload}`)
    );

    if (!verified) return null;

    const decoded = JSON.parse(atob(payload));
    if (decoded.exp < Math.floor(Date.now() / 1000)) return null;

    return { userId: decoded.sub, expiresAt: decoded.exp };
  } catch {
    return null;
  }
}

async function verifySessionToken(env: Env, token: string): Promise<{ userId: string } | null> {
  const decoded = await verifyToken(token);
  if (!decoded) return null;
  const now = new Date().toISOString();
  const session = await env.DB.prepare(
    'SELECT user_id FROM user_sessions WHERE token = ? AND expires_at > ?'
  ).bind(token, now).first<{ user_id: string }>();
  if (!session || session.user_id !== decoded.userId) return null;
  return { userId: decoded.userId };
}

function hashPassword(password: string): string {
  // Simple hash for demo - in production use bcrypt or argon2
  let hash = 0;
  for (let i = 0; i < password.length; i++) {
    const char = password.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return `hash_${Math.abs(hash).toString(16)}_${password.length}`;
}

async function createAuditLog(
  env: Env,
  enterpriseId: string | null,
  userId: string | null,
  action: string,
  resourceType: string,
  resourceId: string | null,
  request: Request,
  changes: object | null = null
): Promise<void> {
  const id = crypto.randomUUID();
  const ip = request.headers.get('CF-Connecting-IP') || request.headers.get('X-Forwarded-For') || null;
  const userAgent = request.headers.get('User-Agent') || null;

  await env.DB.prepare(`
    INSERT INTO audit_logs (id, enterprise_id, user_id, action, resource_type, resource_id, ip_address, user_agent, changes, metadata, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    id,
    enterpriseId,
    userId,
    action,
    resourceType,
    resourceId,
    ip,
    userAgent,
    changes ? JSON.stringify(changes) : null,
    null,
    new Date().toISOString()
  ).run();
}

// POST /api/auth/register - Register new user
export async function register(env: Env, request: Request): Promise<Response> {
  const body = await request.json() as { email: string; password: string; name?: string; phone?: string };

  if (!body.email || !body.password) {
    return new Response(JSON.stringify(jsonError(ErrorCodes.INVALID_PARAMS, 'Email and password are required')), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email)) {
    return new Response(JSON.stringify(jsonError(ErrorCodes.INVALID_PARAMS, 'Invalid email format')), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (body.password.length < 6) {
    return new Response(JSON.stringify(jsonError(ErrorCodes.INVALID_PARAMS, 'Password must be at least 6 characters')), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Check if user exists
  const existing = await env.DB.prepare('SELECT id FROM ems_users WHERE email = ?').bind(body.email.toLowerCase()).first();
  if (existing) {
    return new Response(JSON.stringify(jsonError(ErrorCodes.EMAIL_ALREADY_EXISTS, 'Email already registered')), {
      status: 409,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const passwordHash = hashPassword(body.password);

  await env.DB.prepare(`
    INSERT INTO ems_users (id, email, password_hash, name, phone, status, email_verified_at, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(id, body.email.toLowerCase(), passwordHash, body.name || null, body.phone || null, 'active', now, now, now).run();

  await createAuditLog(env, null, id, 'create', 'user', id, request);

  const token = await createToken(id);

  return new Response(JSON.stringify(jsonSuccess({ user: { id, email: body.email, name: body.name }, token })), {
    status: 201,
    headers: { 'Content-Type': 'application/json' },
  });
}

// POST /api/auth/login - User login
export async function login(env: Env, request: Request): Promise<Response> {
  const body = await request.json() as { email: string; password: string };

  if (!body.email || !body.password) {
    return new Response(JSON.stringify(jsonError(ErrorCodes.INVALID_PARAMS, 'Email and password are required')), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const user = await env.DB.prepare('SELECT * FROM ems_users WHERE email = ?').bind(body.email.toLowerCase()).first<Record<string, unknown>>();
  if (!user) {
    return new Response(JSON.stringify(jsonError(ErrorCodes.UNAUTHORIZED, 'Invalid credentials')), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const passwordHash = hashPassword(body.password);
  if (user.password_hash !== passwordHash) {
    return new Response(JSON.stringify(jsonError(ErrorCodes.UNAUTHORIZED, 'Invalid credentials')), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (user.status !== 'active') {
    return new Response(JSON.stringify(jsonError(ErrorCodes.FORBIDDEN, 'Account is not active')), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Update last login
  const now = new Date().toISOString();
  await env.DB.prepare('UPDATE ems_users SET last_login_at = ? WHERE id = ?').bind(now, user.id).run();

  // Create session
  const sessionId = crypto.randomUUID();
  const token = await createToken(user.id as string);
  const expiresAt = new Date(Date.now() + 86400 * 1000).toISOString();

  await env.DB.prepare(`
    INSERT INTO user_sessions (id, user_id, token, ip_address, user_agent, expires_at, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).bind(
    sessionId,
    user.id,
    token,
    request.headers.get('CF-Connecting-IP') || null,
    request.headers.get('User-Agent') || null,
    expiresAt,
    now
  ).run();

  await createAuditLog(env, null, user.id as string, 'login', 'auth', sessionId, request);

  return new Response(JSON.stringify(jsonSuccess({
    user: { id: user.id, email: user.email, name: user.name },
    token,
    expires_at: expiresAt
  })), {
    headers: { 'Content-Type': 'application/json' },
  });
}

// POST /api/auth/logout - User logout
export async function logout(env: Env, request: Request): Promise<Response> {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return new Response(JSON.stringify(jsonError(ErrorCodes.UNAUTHORIZED, 'No token provided')), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const token = authHeader.substring(7);
  const decoded = await verifySessionToken(env, token);
  if (!decoded) {
    return new Response(JSON.stringify(jsonError(ErrorCodes.UNAUTHORIZED, 'Invalid token')), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Delete session
  await env.DB.prepare('DELETE FROM user_sessions WHERE token = ?').bind(token).run();
  await createAuditLog(env, null, decoded.userId, 'logout', 'auth', null, request);

  return new Response(JSON.stringify(jsonSuccess({ message: 'Logged out successfully' })), {
    headers: { 'Content-Type': 'application/json' },
  });
}

// GET /api/auth/me - Get current user
export async function getCurrentUser(env: Env, request: Request): Promise<Response> {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return new Response(JSON.stringify(jsonError(ErrorCodes.UNAUTHORIZED, 'No token provided')), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const token = authHeader.substring(7);
  const decoded = await verifySessionToken(env, token);
  if (!decoded) {
    return new Response(JSON.stringify(jsonError(ErrorCodes.UNAUTHORIZED, 'Invalid or expired token')), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const user = await env.DB.prepare('SELECT id, email, name, phone, avatar_url, status, email_verified_at, last_login_at, created_at FROM ems_users WHERE id = ?').bind(decoded.userId).first<Record<string, unknown>>();
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

// POST /api/auth/change-password - Change password
export async function changePassword(env: Env, request: Request): Promise<Response> {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return new Response(JSON.stringify(jsonError(ErrorCodes.UNAUTHORIZED, 'No token provided')), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const token = authHeader.substring(7);
  const decoded = await verifySessionToken(env, token);
  if (!decoded) {
    return new Response(JSON.stringify(jsonError(ErrorCodes.UNAUTHORIZED, 'Invalid or expired token')), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const body = await request.json() as { current_password: string; new_password: string };
  if (!body.current_password || !body.new_password) {
    return new Response(JSON.stringify(jsonError(ErrorCodes.INVALID_PARAMS, 'Current and new password are required')), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (body.new_password.length < 6) {
    return new Response(JSON.stringify(jsonError(ErrorCodes.INVALID_PARAMS, 'New password must be at least 6 characters')), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const user = await env.DB.prepare('SELECT password_hash FROM ems_users WHERE id = ?').bind(decoded.userId).first<Record<string, unknown>>();
  if (!user) {
    return new Response(JSON.stringify(jsonError(ErrorCodes.NOT_FOUND, 'User not found')), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const currentHash = hashPassword(body.current_password);
  if (user.password_hash !== currentHash) {
    return new Response(JSON.stringify(jsonError(ErrorCodes.UNAUTHORIZED, 'Current password is incorrect')), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const newHash = hashPassword(body.new_password);
  const now = new Date().toISOString();
  await env.DB.prepare('UPDATE ems_users SET password_hash = ?, updated_at = ? WHERE id = ?').bind(newHash, now, decoded.userId).run();

  await createAuditLog(env, null, decoded.userId, 'update', 'user', decoded.userId, request, { field: 'password' });

  return new Response(JSON.stringify(jsonSuccess({ message: 'Password changed successfully' })), {
    headers: { 'Content-Type': 'application/json' },
  });
}

// Export verifyToken for use in other modules
export { verifySessionToken, createAuditLog };
