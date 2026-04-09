// Enterprise Module - Enterprise CRUD operations
import { Env, Enterprise, EnterpriseMember } from '../db/schema';
import { jsonSuccess, jsonError } from '../lib/response';
import { ErrorCodes } from '../lib/errors';
import { verifySessionToken, createAuditLog } from './auth';

// Helper to extract user ID from request
async function getUserIdFromRequest(request: Request, env: Env): Promise<string | null> {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  const token = authHeader.substring(7);
  const decoded = await verifySessionToken(env, token);
  return decoded?.userId || null;
}

// Helper to check if user is member of enterprise with required role
async function checkEnterpriseAccess(env: Env, userId: string, enterpriseId: string, requiredRoles: string[]): Promise<boolean> {
  const member = await env.DB.prepare(
    'SELECT role FROM enterprise_members WHERE enterprise_id = ? AND user_id = ? AND status = ?'
  ).bind(enterpriseId, userId, 'active').first<{ role: string }>();
  return member ? requiredRoles.includes(member.role) : false;
}

// POST /api/enterprises - Create enterprise
export async function createEnterprise(env: Env, request: Request): Promise<Response> {
  const userId = await getUserIdFromRequest(request, env);
  if (!userId) {
    return new Response(JSON.stringify(jsonError(ErrorCodes.UNAUTHORIZED, 'Authentication required')), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const body = await request.json() as Partial<Enterprise>;
  if (!body.name || !body.slug) {
    return new Response(JSON.stringify(jsonError(ErrorCodes.INVALID_PARAMS, 'Name and slug are required')), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (!/^[a-z0-9-]+$/.test(body.slug)) {
    return new Response(JSON.stringify(jsonError(ErrorCodes.INVALID_PARAMS, 'Slug must be lowercase alphanumeric with hyphens')), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Check slug uniqueness
  const existing = await env.DB.prepare('SELECT id FROM enterprises WHERE slug = ?').bind(body.slug).first();
  if (existing) {
    return new Response(JSON.stringify(jsonError(ErrorCodes.SLUG_ALREADY_EXISTS, 'Slug already in use')), {
      status: 409,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  await env.DB.prepare(`
    INSERT INTO enterprises (id, name, slug, description, logo_url, website, industry, size, status, verified_at, created_by, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    id,
    body.name,
    body.slug,
    body.description || null,
    body.logo_url || null,
    body.website || null,
    body.industry || null,
    body.size || 'small',
    'pending_verification',
    null,
    userId,
    now,
    now
  ).run();

  // Add creator as owner
  const memberId = crypto.randomUUID();
  await env.DB.prepare(`
    INSERT INTO enterprise_members (id, enterprise_id, user_id, role, status, joined_at, invited_by, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(memberId, id, userId, 'owner', 'active', now, null, now, now).run();

  await createAuditLog(env, id, userId, 'create', 'enterprise', id, request);

  return new Response(JSON.stringify(jsonSuccess({ id, slug: body.slug })), {
    status: 201,
    headers: { 'Content-Type': 'application/json' },
  });
}

// GET /api/enterprises - List enterprises (filtered by user membership)
export async function listEnterprises(env: Env, request: Request): Promise<Response> {
  const userId = await getUserIdFromRequest(request, env);
  if (!userId) {
    return new Response(JSON.stringify(jsonError(ErrorCodes.UNAUTHORIZED, 'Authentication required')), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const url = new URL(request.url);
  const page = parseInt(url.searchParams.get('page') || '1');
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '20'), 100);
  const offset = (page - 1) * limit;

  // Get enterprises where user is a member
  const countResult = await env.DB.prepare(`
    SELECT COUNT(*) as total FROM enterprises e
    INNER JOIN enterprise_members em ON e.id = em.enterprise_id
    WHERE em.user_id = ? AND em.status = 'active'
  `).bind(userId).first<{ total: number }>();

  const result = await env.DB.prepare(`
    SELECT e.*, em.role as my_role FROM enterprises e
    INNER JOIN enterprise_members em ON e.id = em.enterprise_id
    WHERE em.user_id = ? AND em.status = 'active'
    ORDER BY e.created_at DESC
    LIMIT ? OFFSET ?
  `).bind(userId, limit, offset).all<Record<string, unknown>>();

  return new Response(JSON.stringify(jsonSuccess(result.results || [], { page, total: countResult?.total || 0 })), {
    headers: { 'Content-Type': 'application/json' },
  });
}

// GET /api/enterprises/:id - Get enterprise details
export async function getEnterprise(env: Env, request: Request, id: string): Promise<Response> {
  const userId = await getUserIdFromRequest(request, env);
  if (!userId) {
    return new Response(JSON.stringify(jsonError(ErrorCodes.UNAUTHORIZED, 'Authentication required')), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const hasAccess = await checkEnterpriseAccess(env, userId, id, ['owner', 'admin', 'member', 'viewer']);
  if (!hasAccess) {
    return new Response(JSON.stringify(jsonError(ErrorCodes.FORBIDDEN, 'No access to this enterprise')), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const enterprise = await env.DB.prepare('SELECT * FROM enterprises WHERE id = ?').bind(id).first<Record<string, unknown>>();
  if (!enterprise) {
    return new Response(JSON.stringify(jsonError(ErrorCodes.NOT_FOUND, 'Enterprise not found')), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Get member count
  const memberCount = await env.DB.prepare(
    'SELECT COUNT(*) as count FROM enterprise_members WHERE enterprise_id = ? AND status = ?'
  ).bind(id, 'active').first<{ count: number }>();

  return new Response(JSON.stringify(jsonSuccess({ ...enterprise, member_count: memberCount?.count || 0 })), {
    headers: { 'Content-Type': 'application/json' },
  });
}

// PUT /api/enterprises/:id - Update enterprise
export async function updateEnterprise(env: Env, request: Request, id: string): Promise<Response> {
  const userId = await getUserIdFromRequest(request, env);
  if (!userId) {
    return new Response(JSON.stringify(jsonError(ErrorCodes.UNAUTHORIZED, 'Authentication required')), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const hasAccess = await checkEnterpriseAccess(env, userId, id, ['owner', 'admin']);
  if (!hasAccess) {
    return new Response(JSON.stringify(jsonError(ErrorCodes.FORBIDDEN, 'Admin or owner role required')), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const body = await request.json() as Partial<Enterprise>;
  const now = new Date().toISOString();

  const fields: string[] = ['updated_at = ?'];
  const bindings: (string | null)[] = [now];

  const fieldMap: Record<string, unknown> = {
    name: body.name,
    description: body.description,
    logo_url: body.logo_url,
    website: body.website,
    industry: body.industry,
    size: body.size,
    status: body.status
  };

  for (const [key, value] of Object.entries(fieldMap)) {
    if (value !== undefined) {
      fields.push(`${key} = ?`);
      bindings.push(value as string | null);
    }
  }

  bindings.push(id);
  await env.DB.prepare(`UPDATE enterprises SET ${fields.join(', ')} WHERE id = ?`).bind(...bindings).run();

  await createAuditLog(env, id, userId, 'update', 'enterprise', id, request);

  return new Response(JSON.stringify(jsonSuccess({ id })), {
    headers: { 'Content-Type': 'application/json' },
  });
}

// DELETE /api/enterprises/:id - Delete enterprise
export async function deleteEnterprise(env: Env, request: Request, id: string): Promise<Response> {
  const userId = await getUserIdFromRequest(request, env);
  if (!userId) {
    return new Response(JSON.stringify(jsonError(ErrorCodes.UNAUTHORIZED, 'Authentication required')), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const hasAccess = await checkEnterpriseAccess(env, userId, id, ['owner']);
  if (!hasAccess) {
    return new Response(JSON.stringify(jsonError(ErrorCodes.FORBIDDEN, 'Owner role required')), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const now = new Date().toISOString();
  // Soft delete - set status to suspended
  await env.DB.prepare('UPDATE enterprises SET status = ?, updated_at = ? WHERE id = ?').bind('suspended', now, id).run();

  await createAuditLog(env, id, userId, 'delete', 'enterprise', id, request);

  return new Response(JSON.stringify(jsonSuccess({ id, message: 'Enterprise deleted' })), {
    headers: { 'Content-Type': 'application/json' },
  });
}

// GET /api/enterprises/:id/members - List enterprise members
export async function listEnterpriseMembers(env: Env, request: Request, enterpriseId: string): Promise<Response> {
  const userId = await getUserIdFromRequest(request, env);
  if (!userId) {
    return new Response(JSON.stringify(jsonError(ErrorCodes.UNAUTHORIZED, 'Authentication required')), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const hasAccess = await checkEnterpriseAccess(env, userId, enterpriseId, ['owner', 'admin', 'member', 'viewer']);
  if (!hasAccess) {
    return new Response(JSON.stringify(jsonError(ErrorCodes.FORBIDDEN, 'No access to this enterprise')), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const result = await env.DB.prepare(`
    SELECT em.*, u.email, u.name, u.avatar_url
    FROM enterprise_members em
    LEFT JOIN ems_users u ON em.user_id = u.id
    WHERE em.enterprise_id = ? AND em.status != 'removed'
    ORDER BY em.role ASC, em.joined_at ASC
  `).bind(enterpriseId).all<Record<string, unknown>>();

  return new Response(JSON.stringify(jsonSuccess(result.results || [])), {
    headers: { 'Content-Type': 'application/json' },
  });
}

// POST /api/enterprises/:id/members - Add member to enterprise
export async function addEnterpriseMember(env: Env, request: Request, enterpriseId: string): Promise<Response> {
  const userId = await getUserIdFromRequest(request, env);
  if (!userId) {
    return new Response(JSON.stringify(jsonError(ErrorCodes.UNAUTHORIZED, 'Authentication required')), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const hasAccess = await checkEnterpriseAccess(env, userId, enterpriseId, ['owner', 'admin']);
  if (!hasAccess) {
    return new Response(JSON.stringify(jsonError(ErrorCodes.FORBIDDEN, 'Admin or owner role required')), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const body = await request.json() as { email: string; role: string };
  if (!body.email || !body.role) {
    return new Response(JSON.stringify(jsonError(ErrorCodes.INVALID_PARAMS, 'Email and role are required')), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const validRoles = ['admin', 'member', 'viewer'];
  if (!validRoles.includes(body.role)) {
    return new Response(JSON.stringify(jsonError(ErrorCodes.INVALID_PARAMS, 'Invalid role')), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Find user by email
  const targetUser = await env.DB.prepare('SELECT id FROM ems_users WHERE email = ?').bind(body.email.toLowerCase()).first<{ id: string }>();
  if (!targetUser) {
    return new Response(JSON.stringify(jsonError(ErrorCodes.NOT_FOUND, 'User not found with this email')), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Check if already a member
  const existingMember = await env.DB.prepare(
    'SELECT id FROM enterprise_members WHERE enterprise_id = ? AND user_id = ?'
  ).bind(enterpriseId, targetUser.id).first();
  if (existingMember) {
    return new Response(JSON.stringify(jsonError(ErrorCodes.DUPLICATE_ENTRY, 'User is already a member')), {
      status: 409,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  await env.DB.prepare(`
    INSERT INTO enterprise_members (id, enterprise_id, user_id, role, status, joined_at, invited_by, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(id, enterpriseId, targetUser.id, body.role, 'active', now, userId, now, now).run();

  await createAuditLog(env, enterpriseId, userId, 'create', 'member', id, request, { invited_user: body.email, role: body.role });

  return new Response(JSON.stringify(jsonSuccess({ id, email: body.email, role: body.role })), {
    status: 201,
    headers: { 'Content-Type': 'application/json' },
  });
}

// PATCH /api/enterprises/:id/members/:memberId - Update member role
export async function updateEnterpriseMember(env: Env, request: Request, enterpriseId: string, memberId: string): Promise<Response> {
  const userId = await getUserIdFromRequest(request, env);
  if (!userId) {
    return new Response(JSON.stringify(jsonError(ErrorCodes.UNAUTHORIZED, 'Authentication required')), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const hasAccess = await checkEnterpriseAccess(env, userId, enterpriseId, ['owner', 'admin']);
  if (!hasAccess) {
    return new Response(JSON.stringify(jsonError(ErrorCodes.FORBIDDEN, 'Admin or owner role required')), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const body = await request.json() as { role: string };
  if (!body.role) {
    return new Response(JSON.stringify(jsonError(ErrorCodes.INVALID_PARAMS, 'Role is required')), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const validRoles = ['admin', 'member', 'viewer'];
  if (!validRoles.includes(body.role)) {
    return new Response(JSON.stringify(jsonError(ErrorCodes.INVALID_PARAMS, 'Invalid role')), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Get current role to check permissions
  const member = await env.DB.prepare(
    'SELECT user_id, role FROM enterprise_members WHERE id = ? AND enterprise_id = ?'
  ).bind(memberId, enterpriseId).first<{ user_id: string; role: string }>();
  if (!member) {
    return new Response(JSON.stringify(jsonError(ErrorCodes.NOT_FOUND, 'Member not found')), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Cannot change owner role
  if (member.role === 'owner') {
    return new Response(JSON.stringify(jsonError(ErrorCodes.FORBIDDEN, 'Cannot change owner role')), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const now = new Date().toISOString();
  await env.DB.prepare('UPDATE enterprise_members SET role = ?, updated_at = ? WHERE id = ?').bind(body.role, now, memberId).run();

  await createAuditLog(env, enterpriseId, userId, 'update', 'member', memberId, request, { old_role: member.role, new_role: body.role });

  return new Response(JSON.stringify(jsonSuccess({ id: memberId, role: body.role })), {
    headers: { 'Content-Type': 'application/json' },
  });
}

// DELETE /api/enterprises/:id/members/:memberId - Remove member
export async function removeEnterpriseMember(env: Env, request: Request, enterpriseId: string, memberId: string): Promise<Response> {
  const userId = await getUserIdFromRequest(request, env);
  if (!userId) {
    return new Response(JSON.stringify(jsonError(ErrorCodes.UNAUTHORIZED, 'Authentication required')), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const hasAccess = await checkEnterpriseAccess(env, userId, enterpriseId, ['owner', 'admin']);
  if (!hasAccess) {
    return new Response(JSON.stringify(jsonError(ErrorCodes.FORBIDDEN, 'Admin or owner role required')), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const member = await env.DB.prepare(
    'SELECT user_id, role FROM enterprise_members WHERE id = ? AND enterprise_id = ?'
  ).bind(memberId, enterpriseId).first<{ user_id: string; role: string }>();
  if (!member) {
    return new Response(JSON.stringify(jsonError(ErrorCodes.NOT_FOUND, 'Member not found')), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (member.role === 'owner') {
    return new Response(JSON.stringify(jsonError(ErrorCodes.FORBIDDEN, 'Cannot remove owner')), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Cannot remove yourself
  if (member.user_id === userId) {
    return new Response(JSON.stringify(jsonError(ErrorCodes.FORBIDDEN, 'Cannot remove yourself')), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const now = new Date().toISOString();
  await env.DB.prepare('UPDATE enterprise_members SET status = ?, updated_at = ? WHERE id = ?').bind('removed', now, memberId).run();

  await createAuditLog(env, enterpriseId, userId, 'delete', 'member', memberId, request);

  return new Response(JSON.stringify(jsonSuccess({ id: memberId, message: 'Member removed' })), {
    headers: { 'Content-Type': 'application/json' },
  });
}

// GET /api/enterprises/:id/members/:memberId - Get member details
export async function getEnterpriseMember(env: Env, request: Request, enterpriseId: string, memberId: string): Promise<Response> {
  const userId = await getUserIdFromRequest(request, env);
  if (!userId) {
    return new Response(JSON.stringify(jsonError(ErrorCodes.UNAUTHORIZED, 'Authentication required')), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const hasAccess = await checkEnterpriseAccess(env, userId, enterpriseId, ['owner', 'admin', 'member', 'viewer']);
  if (!hasAccess) {
    return new Response(JSON.stringify(jsonError(ErrorCodes.FORBIDDEN, 'No access to this enterprise')), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const member = await env.DB.prepare(`
    SELECT em.*, u.email, u.name, u.avatar_url
    FROM enterprise_members em
    LEFT JOIN ems_users u ON em.user_id = u.id
    WHERE em.id = ? AND em.enterprise_id = ?
  `).bind(memberId, enterpriseId).first<Record<string, unknown>>();

  if (!member) {
    return new Response(JSON.stringify(jsonError(ErrorCodes.NOT_FOUND, 'Member not found')), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify(jsonSuccess(member)), {
    headers: { 'Content-Type': 'application/json' },
  });
}
