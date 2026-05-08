// Authentication Module - JWT auth, login, register, token validation
import { Env, EMSUser, UserSession, AuditLog } from '../db/schema';
import { jsonSuccess, jsonError } from '../lib/response';
import { ErrorCodes } from '../lib/errors';

// ST-S02修复：JWT密钥必须从环境变量获取，不使用回退密钥
function getJwtSecret(env: Env): string {
  if (!env.JWT_SECRET) {
    throw new Error('JWT_SECRET environment variable is required');
  }
  return env.JWT_SECRET;
}

async function generateSecret(env: Env): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(getJwtSecret(env)),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  );
}

// ST-S01修复：正确实现PBKDF2密码哈希（salt存储在哈希值中）
const ITERATIONS = 100000;

function generateRandomSalt(): string {
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  return btoa(String.fromCharCode(...array));
}

async function hashPassword(password: string, salt: string): Promise<string> {
  const encoder = new TextEncoder();

  // 使用PBKDF2派生密钥
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    'PBKDF2',
    false,
    ['deriveBits']
  );

  const bits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: encoder.encode(salt),
      iterations: ITERATIONS,
      hash: 'SHA-256',
    },
    keyMaterial,
    256
  );

  const hash = btoa(String.fromCharCode(...new Uint8Array(bits)));
  // 存储格式: salt$hash
  return `${salt}$${hash}`;
}

// 验证密码哈希：从存储的哈希中提取salt，重新计算并比较
async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  // 分离salt和hash（格式: salt$hash）
  const parts = storedHash.split('$');
  if (parts.length !== 2) {
    // 兼容旧格式：如果不是新格式，直接返回false
    return false;
  }
  const [salt, originalHash] = parts;
  const newHash = await hashPassword(password, salt);
  return newHash === storedHash;
}

async function createToken(env: Env, userId: string, expiresIn: number = 86400): Promise<string> {
  const secret = await generateSecret(env);
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

async function verifyToken(env: Env, token: string): Promise<{ userId: string; expiresAt: number } | null> {
  try {
    const [header, payload, signature] = token.split('.');
    if (!header || !payload || !signature) return null;

    const secret = await generateSecret(env);
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
  const decoded = await verifyToken(env, token);
  if (!decoded) return null;
  const now = new Date().toISOString();
  const session = await env.DB.prepare(
    'SELECT user_id FROM user_sessions WHERE token = ? AND expires_at > ?'
  ).bind(token, now).first<{ user_id: string }>();
  if (!session || session.user_id !== decoded.userId) return null;
  return { userId: decoded.userId };
}

// ST-C05修复：提取Bearer token认证逻辑，消除auth.ts中3处重复的认证头解析
async function verifyBearerAuth(env: Env, request: Request): Promise<string | null> {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  const token = authHeader.substring(7);
  const decoded = await verifySessionToken(env, token);
  return decoded?.userId ?? null;
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
  // ST-S05修复：仅使用Cloudflare提供的真实IP，避免X-Forwarded-For伪造
  const ip = request.headers.get('CF-Connecting-IP') || null;
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
  // ST-S01修复：生成随机salt并使用PBKDF2哈希密码
  const salt = generateRandomSalt();
  const passwordHash = await hashPassword(body.password, salt);

  await env.DB.prepare(`
    INSERT INTO ems_users (id, email, password_hash, name, phone, status, email_verified_at, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(id, body.email.toLowerCase(), passwordHash, body.name || null, body.phone || null, 'active', now, now, now).run();

  await createAuditLog(env, null, id, 'create', 'user', id, request);

  return new Response(JSON.stringify(jsonSuccess({
    user_id: id,
    email: body.email.toLowerCase(),
    created_at: now
  })), {
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

  // ST-S01修复：使用PBKDF2验证密码（从存储的哈希中提取salt）
  const isValidPassword = await verifyPassword(body.password, user.password_hash as string);
  if (!isValidPassword) {
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
  const token = await createToken(env, user.id as string);
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
    user_id: user.id,
    email: user.email,
    session_token: token,
    expires_at: expiresAt
  })), {
    headers: { 'Content-Type': 'application/json' },
  });
}

// POST /api/auth/logout - User logout
export async function logout(env: Env, request: Request): Promise<Response> {
  // ST-C05：使用提取的认证辅助函数替代重复的Bearer token解析
  const userId = await verifyBearerAuth(env, request);
  if (!userId) {
    return new Response(JSON.stringify(jsonError(ErrorCodes.UNAUTHORIZED, 'No token provided')), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Delete session
  await env.DB.prepare('DELETE FROM user_sessions WHERE user_id = ?').bind(userId).run();
  await createAuditLog(env, null, userId, 'logout', 'auth', null, request);

  return new Response(JSON.stringify(jsonSuccess({ message: 'Logged out successfully' })), {
    headers: { 'Content-Type': 'application/json' },
  });
}

// GET /api/auth/me - Get current user
export async function getCurrentUser(env: Env, request: Request): Promise<Response> {
  // ST-C05：使用提取的认证辅助函数替代重复的Bearer token解析
  const userId = await verifyBearerAuth(env, request);
  if (!userId) {
    return new Response(JSON.stringify(jsonError(ErrorCodes.UNAUTHORIZED, 'No token provided')), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const user = await env.DB.prepare('SELECT id, email, name, phone, avatar_url, status, email_verified_at, last_login_at, created_at FROM ems_users WHERE id = ?').bind(userId).first<Record<string, unknown>>();
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

// POST /api/auth/refresh - Session续期
export async function refreshSession(env: Env, request: Request): Promise<Response> {
  // 支持通过Authorization Bearer token或X-User-Email header认证
  const authHeader = request.headers.get('Authorization');
  const emailHeader = request.headers.get('X-User-Email');

  if (!authHeader && !emailHeader) {
    return new Response(JSON.stringify(jsonError(ErrorCodes.UNAUTHORIZED, 'No token or email provided')), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  let userId: string | null = null;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    const decoded = await verifySessionToken(env, token);
    if (!decoded) {
      return new Response(JSON.stringify(jsonError(ErrorCodes.UNAUTHORIZED, 'Invalid or expired token')), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    userId = decoded.userId;
  } else if (emailHeader) {
    // 通过X-User-Email查找用户
    const user = await env.DB.prepare('SELECT id FROM ems_users WHERE email = ?').bind(emailHeader.toLowerCase()).first<{ id: string }>();
    if (!user) {
      return new Response(JSON.stringify(jsonError(ErrorCodes.NOT_FOUND, 'User not found')), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    userId = user.id;
  }

  // 查询当前session
  const now = new Date();
  const nowISO = now.toISOString();
  const session = await env.DB.prepare(
    'SELECT * FROM user_sessions WHERE user_id = ? AND expires_at > ? ORDER BY created_at DESC LIMIT 1'
  ).bind(userId, nowISO).first<{ id: string; expires_at: string }>();

  if (!session) {
    return new Response(JSON.stringify(jsonError(ErrorCodes.UNAUTHORIZED, 'No valid session found')), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // 检查是否在过期前1小时内允许续期
  const expiresAt = new Date(session.expires_at);
  const oneHourFromNow = new Date(now.getTime() + 3600 * 1000);
  const isExpiringSoon = expiresAt < oneHourFromNow;

  if (!isExpiringSoon) {
    return new Response(JSON.stringify(jsonError(ErrorCodes.INVALID_PARAMS, 'Session does not need refresh yet')), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // 延长24小时
  const newExpiresAt = new Date(now.getTime() + 86400 * 1000).toISOString();
  await env.DB.prepare('UPDATE user_sessions SET expires_at = ? WHERE id = ?').bind(newExpiresAt, session.id).run();

  await createAuditLog(env, null, userId, 'refresh', 'session', session.id, request);

  return new Response(JSON.stringify(jsonSuccess({
    expires_at: newExpiresAt
  })), {
    headers: { 'Content-Type': 'application/json' },
  });
}

// POST /api/auth/change-password - Change password
export async function changePassword(env: Env, request: Request): Promise<Response> {
  // ST-C05：使用提取的认证辅助函数替代重复的Bearer token解析
  const userId = await verifyBearerAuth(env, request);
  if (!userId) {
    return new Response(JSON.stringify(jsonError(ErrorCodes.UNAUTHORIZED, 'No token provided')), {
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

  const user = await env.DB.prepare('SELECT password_hash FROM ems_users WHERE id = ?').bind(userId).first<Record<string, unknown>>();
  if (!user) {
    return new Response(JSON.stringify(jsonError(ErrorCodes.NOT_FOUND, 'User not found')), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // ST-S01修复：使用PBKDF2验证当前密码（从存储的哈希中提取salt）
  const isValidPassword = await verifyPassword(body.current_password, user.password_hash as string);
  if (!isValidPassword) {
    return new Response(JSON.stringify(jsonError(ErrorCodes.UNAUTHORIZED, 'Current password is incorrect')), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // ST-S01修复：使用PBKDF2哈希新密码（生成新的随机salt）
  const newSalt = generateRandomSalt();
  const newHash = await hashPassword(body.new_password, newSalt);
  const now = new Date().toISOString();
  await env.DB.prepare('UPDATE ems_users SET password_hash = ?, updated_at = ? WHERE id = ?').bind(newHash, now, userId).run();

  await createAuditLog(env, null, userId, 'update', 'user', userId, request, { field: 'password' });

  return new Response(JSON.stringify(jsonSuccess({ message: 'Password changed successfully' })), {
    headers: { 'Content-Type': 'application/json' },
  });
}

// Export verifyToken for use in other modules
export { verifySessionToken, createAuditLog };
