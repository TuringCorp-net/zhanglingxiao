// Record Module - Record CRUD operations
import { Env, Record as RecordEntity } from '../db/schema';
import { jsonSuccess, jsonError, parseJSON } from '../lib/response';
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

// Helper to check if user is member of enterprise with required role
async function checkEnterpriseAccess(env: Env, userId: string, enterpriseId: string, requiredRoles: string[]): Promise<boolean> {
  const member = await env.DB.prepare(
    'SELECT role FROM enterprise_members WHERE enterprise_id = ? AND user_id = ? AND status = ?'
  ).bind(enterpriseId, userId, 'active').first<{ role: string }>();
  return member ? requiredRoles.includes(member.role) : false;
}

// Helper to check record access
async function getRecordWithAccessCheck(env: Env, recordId: string, userId: string, requiredRoles: string[]): Promise<RecordEntity | null> {
  const record = await env.DB.prepare('SELECT * FROM records WHERE id = ?').bind(recordId).first<RecordEntity>();
  if (!record) return null;

  const hasAccess = await checkEnterpriseAccess(env, userId, record.enterprise_id as string, requiredRoles);
  return hasAccess ? record : null;
}

// POST /api/enterprises/:id/records - Create record
export async function createRecord(env: Env, request: Request, enterpriseId: string): Promise<Response> {
  const userId = await getUserIdFromRequest(request, env);
  if (!userId) {
    return new Response(JSON.stringify(jsonError(ErrorCodes.UNAUTHORIZED, 'Authentication required')), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const hasAccess = await checkEnterpriseAccess(env, userId, enterpriseId, ['owner', 'admin', 'member']);
  if (!hasAccess) {
    return new Response(JSON.stringify(jsonError(ErrorCodes.FORBIDDEN, 'No permission to add records')), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const body = await request.json() as Partial<RecordEntity>;
  if (!body.title || !body.record_type) {
    return new Response(JSON.stringify(jsonError(ErrorCodes.INVALID_PARAMS, 'Title and record_type are required')), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const validTypes = ['document', 'certificate', 'license', 'contract', 'report', 'other'];
  if (!validTypes.includes(body.record_type)) {
    return new Response(JSON.stringify(jsonError(ErrorCodes.INVALID_PARAMS, 'Invalid record_type')), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const metadata = body.metadata ? (typeof body.metadata === 'string' ? body.metadata : JSON.stringify(body.metadata)) : '{}';

  await env.DB.prepare(`
    INSERT INTO records (id, enterprise_id, title, description, record_type, record_number, issue_date, expiry_date, issuing_authority, file_url, file_hash, metadata, status, created_by, reviewed_by, reviewed_at, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    id,
    enterpriseId,
    body.title,
    body.description || null,
    body.record_type,
    body.record_number || null,
    body.issue_date || null,
    body.expiry_date || null,
    body.issuing_authority || null,
    body.file_url || null,
    body.file_hash || null,
    metadata,
    body.status || 'draft',
    userId,
    null,
    null,
    now,
    now
  ).run();

  await createAuditLog(env, enterpriseId, userId, 'create', 'record', id, request);

  return new Response(JSON.stringify(jsonSuccess({ id })), {
    status: 201,
    headers: { 'Content-Type': 'application/json' },
  });
}

// GET /api/enterprises/:id/records - List records for enterprise
export async function listRecords(env: Env, request: Request, enterpriseId: string): Promise<Response> {
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

  const url = new URL(request.url);
  const page = parseInt(url.searchParams.get('page') || '1');
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '20'), 100);
  const offset = (page - 1) * limit;
  const recordType = url.searchParams.get('record_type');
  const status = url.searchParams.get('status');

  let query = 'SELECT * FROM records WHERE enterprise_id = ?';
  const bindings: (string | number)[] = [enterpriseId];

  if (recordType) {
    query += ' AND record_type = ?';
    bindings.push(recordType);
  }

  if (status) {
    query += ' AND status = ?';
    bindings.push(status);
  }

  const countQuery = query.replace('SELECT *', 'SELECT COUNT(*) as total');
  const countResult = await env.DB.prepare(countQuery).bind(...bindings).first<{ total: number }>();

  query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
  bindings.push(limit, offset);

  const result = await env.DB.prepare(query).bind(...bindings).all<Record<string, unknown>>();
  const records = (result.results || []).map(row => ({
    ...row,
    metadata: parseJSON(row.metadata as string || '{}', {})
  }));

  return new Response(JSON.stringify(jsonSuccess(records, { page, total: countResult?.total || 0 })), {
    headers: { 'Content-Type': 'application/json' },
  });
}

// GET /api/enterprises/:id/records/:recordId - Get record details
export async function getRecord(env: Env, request: Request, enterpriseId: string, recordId: string): Promise<Response> {
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

  const record = await env.DB.prepare('SELECT * FROM records WHERE id = ? AND enterprise_id = ?').bind(recordId, enterpriseId).first<Record<string, unknown>>();
  if (!record) {
    return new Response(JSON.stringify(jsonError(ErrorCodes.NOT_FOUND, 'Record not found')), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  await createAuditLog(env, enterpriseId, userId, 'access', 'record', recordId, request);

  return new Response(JSON.stringify(jsonSuccess({
    ...record,
    metadata: parseJSON(record.metadata as string || '{}', {})
  })), {
    headers: { 'Content-Type': 'application/json' },
  });
}

// PUT /api/enterprises/:id/records/:recordId - Update record
export async function updateRecord(env: Env, request: Request, enterpriseId: string, recordId: string): Promise<Response> {
  const userId = await getUserIdFromRequest(request, env);
  if (!userId) {
    return new Response(JSON.stringify(jsonError(ErrorCodes.UNAUTHORIZED, 'Authentication required')), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const hasAccess = await checkEnterpriseAccess(env, userId, enterpriseId, ['owner', 'admin', 'member']);
  if (!hasAccess) {
    return new Response(JSON.stringify(jsonError(ErrorCodes.FORBIDDEN, 'No permission to update records')), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const existing = await env.DB.prepare('SELECT * FROM records WHERE id = ? AND enterprise_id = ?').bind(recordId, enterpriseId).first<Record<string, unknown>>();
  if (!existing) {
    return new Response(JSON.stringify(jsonError(ErrorCodes.NOT_FOUND, 'Record not found')), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const body = await request.json() as Partial<RecordEntity>;
  const now = new Date().toISOString();

  const fields: string[] = ['updated_at = ?'];
  const bindings: (string | null)[] = [now];

  const fieldMap: Record<string, unknown> = {
    title: body.title,
    description: body.description,
    record_type: body.record_type,
    record_number: body.record_number,
    issue_date: body.issue_date,
    expiry_date: body.expiry_date,
    issuing_authority: body.issuing_authority,
    file_url: body.file_url,
    file_hash: body.file_hash,
    status: body.status
  };

  for (const [key, value] of Object.entries(fieldMap)) {
    if (value !== undefined) {
      fields.push(`${key} = ?`);
      bindings.push(value as string | null);
    }
  }

  if (body.metadata !== undefined) {
    fields.push('metadata = ?');
    bindings.push(typeof body.metadata === 'string' ? body.metadata : JSON.stringify(body.metadata));
  }

  bindings.push(recordId);
  await env.DB.prepare(`UPDATE records SET ${fields.join(', ')} WHERE id = ?`).bind(...bindings).run();

  await createAuditLog(env, enterpriseId, userId, 'update', 'record', recordId, request, { changes: fieldMap });

  return new Response(JSON.stringify(jsonSuccess({ id: recordId })), {
    headers: { 'Content-Type': 'application/json' },
  });
}

// DELETE /api/enterprises/:id/records/:recordId - Delete record
export async function deleteRecord(env: Env, request: Request, enterpriseId: string, recordId: string): Promise<Response> {
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

  const existing = await env.DB.prepare('SELECT id FROM records WHERE id = ? AND enterprise_id = ?').bind(recordId, enterpriseId).first();
  if (!existing) {
    return new Response(JSON.stringify(jsonError(ErrorCodes.NOT_FOUND, 'Record not found')), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const now = new Date().toISOString();
  // Soft delete - set status to archived
  await env.DB.prepare('UPDATE records SET status = ?, updated_at = ? WHERE id = ?').bind('archived', now, recordId).run();

  await createAuditLog(env, enterpriseId, userId, 'delete', 'record', recordId, request);

  return new Response(JSON.stringify(jsonSuccess({ id: recordId, message: 'Record archived' })), {
    headers: { 'Content-Type': 'application/json' },
  });
}

// PATCH /api/enterprises/:id/records/:recordId/status - Update record status
export async function updateRecordStatus(env: Env, request: Request, enterpriseId: string, recordId: string): Promise<Response> {
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

  const body = await request.json() as { status: string };
  if (!body.status) {
    return new Response(JSON.stringify(jsonError(ErrorCodes.INVALID_PARAMS, 'Status is required')), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const validStatuses = ['draft', 'active', 'expired', 'revoked', 'archived'];
  if (!validStatuses.includes(body.status)) {
    return new Response(JSON.stringify(jsonError(ErrorCodes.INVALID_PARAMS, 'Invalid status')), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const existing = await env.DB.prepare('SELECT status FROM records WHERE id = ? AND enterprise_id = ?').bind(recordId, enterpriseId).first<{ status: string }>();
  if (!existing) {
    return new Response(JSON.stringify(jsonError(ErrorCodes.NOT_FOUND, 'Record not found')), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const now = new Date().toISOString();
  await env.DB.prepare('UPDATE records SET status = ?, updated_at = ? WHERE id = ?').bind(body.status, now, recordId).run();

  await createAuditLog(env, enterpriseId, userId, 'update', 'record', recordId, request, { old_status: existing.status, new_status: body.status });

  return new Response(JSON.stringify(jsonSuccess({ id: recordId, status: body.status })), {
    headers: { 'Content-Type': 'application/json' },
  });
}

// POST /api/enterprises/:id/records/:recordId/review - Review record
export async function reviewRecord(env: Env, request: Request, enterpriseId: string, recordId: string): Promise<Response> {
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

  const body = await request.json() as { action: 'approve' | 'reject'; notes?: string };
  if (!body.action || !['approve', 'reject'].includes(body.action)) {
    return new Response(JSON.stringify(jsonError(ErrorCodes.INVALID_PARAMS, 'Action must be approve or reject')), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const existing = await env.DB.prepare('SELECT * FROM records WHERE id = ? AND enterprise_id = ?').bind(recordId, enterpriseId).first<Record<string, unknown>>();
  if (!existing) {
    return new Response(JSON.stringify(jsonError(ErrorCodes.NOT_FOUND, 'Record not found')), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const now = new Date().toISOString();
  const newStatus = body.action === 'approve' ? 'active' : 'revoked';

  await env.DB.prepare(`
    UPDATE records SET status = ?, reviewed_by = ?, reviewed_at = ?, updated_at = ?
    WHERE id = ?
  `).bind(newStatus, userId, now, now, recordId).run();

  await createAuditLog(env, enterpriseId, userId, body.action, 'record', recordId, request, {
    old_status: existing.status,
    new_status: newStatus,
    notes: body.notes
  });

  return new Response(JSON.stringify(jsonSuccess({ id: recordId, status: newStatus, reviewed_at: now })), {
    headers: { 'Content-Type': 'application/json' },
  });
}

// GET /api/records/expiring - Get records expiring soon
export async function getExpiringRecords(env: Env, request: Request): Promise<Response> {
  const userId = await getUserIdFromRequest(request, env);
  if (!userId) {
    return new Response(JSON.stringify(jsonError(ErrorCodes.UNAUTHORIZED, 'Authentication required')), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const url = new URL(request.url);
  const days = parseInt(url.searchParams.get('days') || '30');
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '20'), 100);

  // Get user's enterprises
  const memberships = await env.DB.prepare(
    'SELECT enterprise_id FROM enterprise_members WHERE user_id = ? AND status = ?'
  ).bind(userId, 'active').all<{ enterprise_id: string }>();

  const enterpriseIds = memberships.results?.map(m => m.enterprise_id) || [];
  if (enterpriseIds.length === 0) {
    return new Response(JSON.stringify(jsonSuccess([], { total: 0 })), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const placeholders = enterpriseIds.map(() => '?').join(',');
  const futureDate = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  const result = await env.DB.prepare(`
    SELECT r.*, e.name as enterprise_name
    FROM records r
    INNER JOIN enterprises e ON r.enterprise_id = e.id
    WHERE r.enterprise_id IN (${placeholders})
    AND r.expiry_date IS NOT NULL
    AND r.expiry_date <= ?
    AND r.status = 'active'
    ORDER BY r.expiry_date ASC
    LIMIT ?
  `).bind(...enterpriseIds, futureDate, limit).all<Record<string, unknown>>();

  const records = (result.results || []).map(row => ({
    ...row,
    metadata: parseJSON(row.metadata as string || '{}', {})
  }));

  return new Response(JSON.stringify(jsonSuccess(records)), {
    headers: { 'Content-Type': 'application/json' },
  });
}
