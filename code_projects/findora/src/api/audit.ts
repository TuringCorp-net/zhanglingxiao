// Audit Module - Audit log endpoints
import { Env, AuditLog } from '../db/schema';
import { jsonSuccess, jsonError, parseJSON } from '../lib/response';
import { ErrorCodes } from '../lib/errors';
import { verifyToken } from './auth';

// Helper to extract user ID from request
async function getUserIdFromRequest(request: Request, env: Env): Promise<string | null> {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  const token = authHeader.substring(7);
  const decoded = await verifyToken(token);
  return decoded?.userId || null;
}

// Helper to check if user is member of enterprise with required role
async function checkEnterpriseAccess(env: Env, userId: string, enterpriseId: string, requiredRoles: string[]): Promise<boolean> {
  const member = await env.DB.prepare(
    'SELECT role FROM enterprise_members WHERE enterprise_id = ? AND user_id = ? AND status = ?'
  ).bind(enterpriseId, userId, 'active').first<{ role: string }>();
  return member ? requiredRoles.includes(member.role) : false;
}

// GET /api/enterprises/:id/audit-logs - Get audit logs for enterprise
export async function listAuditLogs(env: Env, request: Request, enterpriseId: string): Promise<Response> {
  const userId = await getUserIdFromRequest(request, env);
  if (!userId) {
    return new Response(JSON.stringify(jsonError(ErrorCodes.UNAUTHORIZED, 'Authentication required')), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const hasAccess = await checkEnterpriseAccess(env, userId, enterpriseId, ['owner', 'admin']);
  if (!hasAccess) {
    return new Response(JSON.stringify(jsonError(ErrorCodes.FORBIDDEN, 'Admin or owner permission required')), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const url = new URL(request.url);
  const page = parseInt(url.searchParams.get('page') || '1');
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '50'), 100);
  const offset = (page - 1) * limit;
  const action = url.searchParams.get('action');
  const resourceType = url.searchParams.get('resource_type');
  const userIdFilter = url.searchParams.get('user_id');

  let query = 'SELECT * FROM audit_logs WHERE enterprise_id = ?';
  const bindings: (string | number)[] = [enterpriseId];

  if (action) {
    query += ' AND action = ?';
    bindings.push(action);
  }

  if (resourceType) {
    query += ' AND resource_type = ?';
    bindings.push(resourceType);
  }

  if (userIdFilter) {
    query += ' AND user_id = ?';
    bindings.push(userIdFilter);
  }

  const countQuery = query.replace('SELECT *', 'SELECT COUNT(*) as total');
  const countResult = await env.DB.prepare(countQuery).bind(...bindings).first<{ total: number }>();

  query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
  bindings.push(limit, offset);

  const result = await env.DB.prepare(query).bind(...bindings).all<Record<string, unknown>>();
  const logs = (result.results || []).map(row => ({
    ...row,
    changes: row.changes ? parseJSON(row.changes as string, null) : null,
    metadata: row.metadata ? parseJSON(row.metadata as string, null) : null
  }));

  return new Response(JSON.stringify(jsonSuccess(logs, { page, total: countResult?.total || 0 })), {
    headers: { 'Content-Type': 'application/json' },
  });
}

// GET /api/audit-logs - Get all audit logs for user's enterprises
export async function listMyAuditLogs(env: Env, request: Request): Promise<Response> {
  const userId = await getUserIdFromRequest(request, env);
  if (!userId) {
    return new Response(JSON.stringify(jsonError(ErrorCodes.UNAUTHORIZED, 'Authentication required')), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const url = new URL(request.url);
  const page = parseInt(url.searchParams.get('page') || '1');
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '50'), 100);
  const offset = (page - 1) * limit;
  const action = url.searchParams.get('action');
  const resourceType = url.searchParams.get('resource_type');

  // Get user's enterprises
  const memberships = await env.DB.prepare(
    'SELECT enterprise_id FROM enterprise_members WHERE user_id = ? AND status = ?'
  ).bind(userId, 'active').all<{ enterprise_id: string }>();

  const enterpriseIds = memberships.results?.map(m => m.enterprise_id) || [];
  if (enterpriseIds.length === 0) {
    return new Response(JSON.stringify(jsonSuccess([], { page, total: 0 })), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  let query = `SELECT * FROM audit_logs WHERE enterprise_id IN (${enterpriseIds.map(() => '?').join(',')})`;
  const bindings: (string | number)[] = [...enterpriseIds];

  if (action) {
    query += ' AND action = ?';
    bindings.push(action);
  }

  if (resourceType) {
    query += ' AND resource_type = ?';
    bindings.push(resourceType);
  }

  const countQuery = query.replace('SELECT *', 'SELECT COUNT(*) as total');
  const countResult = await env.DB.prepare(countQuery).bind(...bindings).first<{ total: number }>();

  query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
  bindings.push(limit, offset);

  const result = await env.DB.prepare(query).bind(...bindings).all<Record<string, unknown>>();
  const logs = (result.results || []).map(row => ({
    ...row,
    changes: row.changes ? parseJSON(row.changes as string, null) : null,
    metadata: row.metadata ? parseJSON(row.metadata as string, null) : null
  }));

  return new Response(JSON.stringify(jsonSuccess(logs, { page, total: countResult?.total || 0 })), {
    headers: { 'Content-Type': 'application/json' },
  });
}

// GET /api/audit-logs/:id - Get specific audit log entry
export async function getAuditLog(env: Env, request: Request, id: string): Promise<Response> {
  const userId = await getUserIdFromRequest(request, env);
  if (!userId) {
    return new Response(JSON.stringify(jsonError(ErrorCodes.UNAUTHORIZED, 'Authentication required')), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const log = await env.DB.prepare('SELECT * FROM audit_logs WHERE id = ?').bind(id).first<Record<string, unknown>>();
  if (!log) {
    return new Response(JSON.stringify(jsonError(ErrorCodes.NOT_FOUND, 'Audit log not found')), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Check if user has access to this enterprise
  if (log.enterprise_id) {
    const hasAccess = await checkEnterpriseAccess(env, userId, log.enterprise_id as string, ['owner', 'admin', 'member', 'viewer']);
    if (!hasAccess) {
      return new Response(JSON.stringify(jsonError(ErrorCodes.FORBIDDEN, 'No access to this audit log')), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  } else if (log.user_id !== userId) {
    return new Response(JSON.stringify(jsonError(ErrorCodes.FORBIDDEN, 'No access to this audit log')), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify(jsonSuccess({
    ...log,
    changes: log.changes ? parseJSON(log.changes as string, null) : null,
    metadata: log.metadata ? parseJSON(log.metadata as string, null) : null
  })), {
    headers: { 'Content-Type': 'application/json' },
  });
}

// GET /api/audit-logs/stats - Get audit statistics
export async function getAuditStats(env: Env, request: Request, enterpriseId: string): Promise<Response> {
  const userId = await getUserIdFromRequest(request, env);
  if (!userId) {
    return new Response(JSON.stringify(jsonError(ErrorCodes.UNAUTHORIZED, 'Authentication required')), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const hasAccess = await checkEnterpriseAccess(env, userId, enterpriseId, ['owner', 'admin']);
  if (!hasAccess) {
    return new Response(JSON.stringify(jsonError(ErrorCodes.FORBIDDEN, 'Admin or owner permission required')), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Get action counts
  const actionStats = await env.DB.prepare(`
    SELECT action, COUNT(*) as count
    FROM audit_logs
    WHERE enterprise_id = ?
    AND created_at >= date('now', '-30 days')
    GROUP BY action
  `).bind(enterpriseId).all<{ action: string; count: number }>();

  // Get resource type counts
  const resourceStats = await env.DB.prepare(`
    SELECT resource_type, COUNT(*) as count
    FROM audit_logs
    WHERE enterprise_id = ?
    AND created_at >= date('now', '-30 days')
    GROUP BY resource_type
  `).bind(enterpriseId).all<{ resource_type: string; count: number }>();

  // Get daily counts for last 30 days
  const dailyStats = await env.DB.prepare(`
    SELECT date(created_at) as date, COUNT(*) as count
    FROM audit_logs
    WHERE enterprise_id = ?
    AND created_at >= date('now', '-30 days')
    GROUP BY date(created_at)
    ORDER BY date ASC
  `).bind(enterpriseId).all<{ date: string; count: number }>();

  // Get top users by activity
  const topUsers = await env.DB.prepare(`
    SELECT user_id, COUNT(*) as count
    FROM audit_logs
    WHERE enterprise_id = ? AND user_id IS NOT NULL
    AND created_at >= date('now', '-30 days')
    GROUP BY user_id
    ORDER BY count DESC
    LIMIT 10
  `).bind(enterpriseId).all<{ user_id: string; count: number }>();

  return new Response(JSON.stringify(jsonSuccess({
    action_stats: actionStats.results || [],
    resource_stats: resourceStats.results || [],
    daily_stats: dailyStats.results || [],
    top_users: topUsers.results || []
  })), {
    headers: { 'Content-Type': 'application/json' },
  });
}

// GET /api/enterprises/:id/audit-logs/export - Export audit logs
export async function exportAuditLogs(env: Env, request: Request, enterpriseId: string): Promise<Response> {
  const userId = await getUserIdFromRequest(request, env);
  if (!userId) {
    return new Response(JSON.stringify(jsonError(ErrorCodes.UNAUTHORIZED, 'Authentication required')), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const hasAccess = await checkEnterpriseAccess(env, userId, enterpriseId, ['owner', 'admin']);
  if (!hasAccess) {
    return new Response(JSON.stringify(jsonError(ErrorCodes.FORBIDDEN, 'Admin or owner permission required')), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const url = new URL(request.url);
  const startDate = url.searchParams.get('start_date');
  const endDate = url.searchParams.get('end_date');
  const format = url.searchParams.get('format') || 'json';

  let query = 'SELECT * FROM audit_logs WHERE enterprise_id = ?';
  const bindings: string[] = [enterpriseId];

  if (startDate) {
    query += ' AND created_at >= ?';
    bindings.push(startDate);
  }

  if (endDate) {
    query += ' AND created_at <= ?';
    bindings.push(endDate);
  }

  query += ' ORDER BY created_at DESC LIMIT 10000';

  const result = await env.DB.prepare(query).bind(...bindings).all<Record<string, unknown>>();
  const logs = (result.results || []).map(row => ({
    ...row,
    changes: row.changes ? parseJSON(row.changes as string, null) : null,
    metadata: row.metadata ? parseJSON(row.metadata as string, null) : null
  }));

  if (format === 'csv') {
    const headers = ['id', 'enterprise_id', 'user_id', 'action', 'resource_type', 'resource_id', 'ip_address', 'created_at'];
    const csvRows = [headers.join(',')];
    for (const log of logs) {
      const logRecord = log as Record<string, unknown>;
      csvRows.push(headers.map(h => {
        const val = logRecord[h];
        if (val === null || val === undefined) return '';
        if (typeof val === 'string' && (val.includes(',') || val.includes('"'))) {
          return `"${val.replace(/"/g, '""')}"`;
        }
        return String(val);
      }).join(','));
    }
    return new Response(csvRows.join('\n'), {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="audit-logs-${enterpriseId}.csv"`
      },
    });
  }

  return new Response(JSON.stringify(jsonSuccess(logs, { total: logs.length })), {
    headers: { 'Content-Type': 'application/json' },
  });
}
