// 工作区管理 — SF-001~005 + 状态转换
import { Env, Work } from '../../db/schema';
import { jsonSuccess, jsonError, parseJSON } from '../../lib/response';
import { ErrorCodes } from '../../lib/errors';
import { parsePagination } from '../../lib/constants';
import { buildWorkFrontmatter, writeWorkContent, workR2Key } from '../../lib/work_content';

// GET /api/write/works
export async function listMyWorks(env: Env, request: Request): Promise<Response> {
  const url = new URL(request.url);
  const { page, limit, offset } = parsePagination(url);
  const status = url.searchParams.get('status');

  let whereClause = '';
  const bindings: (string | number)[] = [];
  if (status) {
    whereClause = 'WHERE status = ?';
    bindings.push(status);
  }

  const countResult = await env.DB.prepare(
    `SELECT COUNT(*) as total FROM works ${whereClause}`
  ).bind(...bindings).first<{ total: number }>();
  const total = countResult?.total || 0;

  const rows = await env.DB.prepare(
    `SELECT * FROM works ${whereClause} ORDER BY updated_at DESC LIMIT ? OFFSET ?`
  ).bind(...bindings, limit, offset).all<Record<string, unknown>>();

  const works = (rows.results || []).map(row => ({
    ...row,
    tags: parseJSON<string[]>(String(row.tags || '[]'), []),
    audience: parseJSON<string[]>(String(row.audience || '[]'), []),
  }));

  return new Response(JSON.stringify(jsonSuccess(works, { page, total })), {
    headers: { 'Content-Type': 'application/json' },
  });
}

// POST /api/write/works
export async function createDraftWork(env: Env, request: Request): Promise<Response> {
  const body = await request.json() as Partial<Work>;
  if (!body.title || !body.author) {
    return new Response(JSON.stringify(jsonError(ErrorCodes.MISSING_REQUIRED_FIELD, 'title and author are required')), {
      status: 400, headers: { 'Content-Type': 'application/json' },
    });
  }

  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const tags = Array.isArray(body.tags) ? JSON.stringify(body.tags) : (body.tags || '[]');
  const audience = Array.isArray(body.audience) ? JSON.stringify(body.audience) : '[]';
  const r2Key = workR2Key(id);

  await writeWorkContent(env, id, buildWorkFrontmatter({
    summary: body.summary || null,
    tags: parseJSON<string[]>(tags, []),
  }));

  await env.DB.prepare(`
    INSERT INTO works (id, title, type, category, author, creation_attribution, audience, tags, status, summary, r2_object_key, version, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'draft', ?, ?, 1, ?, ?)
  `).bind(
    id, body.title, body.type || 'novel', body.category || '', body.author,
    body.creation_attribution || 'original', audience, tags,
    body.summary || null, r2Key, now, now
  ).run();

  return new Response(JSON.stringify(jsonSuccess({ id, r2_object_key: r2Key })), {
    status: 201, headers: { 'Content-Type': 'application/json' },
  });
}

// GET /api/write/works/{id}
export async function getMyWork(env: Env, _request: Request, id: string): Promise<Response> {
  const row = await env.DB.prepare('SELECT * FROM works WHERE id = ?').bind(id).first<Record<string, unknown>>();
  if (!row) {
    return new Response(JSON.stringify(jsonError(ErrorCodes.WORK_NOT_FOUND, 'Work not found')), {
      status: 404, headers: { 'Content-Type': 'application/json' },
    });
  }
  return new Response(JSON.stringify(jsonSuccess({
    ...row,
    tags: parseJSON<string[]>(String(row.tags || '[]'), []),
    audience: parseJSON<string[]>(String(row.audience || '[]'), []),
  })), {
    headers: { 'Content-Type': 'application/json' },
  });
}

// PUT /api/write/works/{id}
export async function updateMyWork(env: Env, request: Request, id: string): Promise<Response> {
  const existing = await env.DB.prepare('SELECT id FROM works WHERE id = ?').bind(id).first();
  if (!existing) {
    return new Response(JSON.stringify(jsonError(ErrorCodes.WORK_NOT_FOUND, 'Work not found')), {
      status: 404, headers: { 'Content-Type': 'application/json' },
    });
  }

  const body = await request.json() as Partial<Work>;
  const now = new Date().toISOString();

  const fields: string[] = ['updated_at = ?'];
  const bindings: (string | number | null)[] = [now];
  const fieldMap: Record<string, unknown> = {
    title: body.title, type: body.type, category: body.category, author: body.author,
    creation_attribution: body.creation_attribution,
    audience: Array.isArray(body.audience) ? JSON.stringify(body.audience) : body.audience,
    summary: body.summary,
    tags: Array.isArray(body.tags) ? JSON.stringify(body.tags) : body.tags,
  };

  for (const [key, value] of Object.entries(fieldMap)) {
    if (value !== undefined) { fields.push(`${key} = ?`); bindings.push(value as string | number | null); }
  }

  bindings.push(id);
  await env.DB.prepare(`UPDATE works SET ${fields.join(', ')} WHERE id = ?`).bind(...bindings).run();

  return new Response(JSON.stringify(jsonSuccess({ id })), {
    headers: { 'Content-Type': 'application/json' },
  });
}

// DELETE /api/write/works/{id}
export async function deleteMyWork(env: Env, _request: Request, id: string): Promise<Response> {
  const row = await env.DB.prepare('SELECT id, status FROM works WHERE id = ?').bind(id).first<{ id: string; status: string }>();
  if (!row) {
    return new Response(JSON.stringify(jsonError(ErrorCodes.WORK_NOT_FOUND, 'Work not found')), {
      status: 404, headers: { 'Content-Type': 'application/json' },
    });
  }
  if (row.status === 'published') {
    return new Response(JSON.stringify(jsonError(ErrorCodes.WORK_STATUS_CONFLICT, 'Published works cannot be deleted. Close it first.')), {
      status: 409, headers: { 'Content-Type': 'application/json' },
    });
  }
  await env.DB.prepare('DELETE FROM works WHERE id = ?').bind(id).run();
  return new Response(JSON.stringify(jsonSuccess({ id, deleted: true })), {
    headers: { 'Content-Type': 'application/json' },
  });
}

// GET /api/write/works/{id}/preview
export async function previewWork(env: Env, request: Request, id: string): Promise<Response> {
  const row = await env.DB.prepare('SELECT * FROM works WHERE id = ?').bind(id).first<Record<string, unknown>>();
  if (!row) {
    return new Response(JSON.stringify(jsonError(ErrorCodes.WORK_NOT_FOUND, 'Work not found')), {
      status: 404, headers: { 'Content-Type': 'application/json' },
    });
  }
  // 返回完整作品数据，无视 status（预览模式）
  const sections = await env.DB.prepare(
    'SELECT id, title, order_index, section_summary, word_count FROM sections WHERE work_id = ? ORDER BY order_index'
  ).bind(id).all<Record<string, unknown>>();

  return new Response(JSON.stringify(jsonSuccess({
    ...row,
    tags: parseJSON<string[]>(String(row.tags || '[]'), []),
    audience: parseJSON<string[]>(String(row.audience || '[]'), []),
    sections: sections.results || [],
  })), {
    headers: { 'Content-Type': 'application/json' },
  });
}

// PATCH /api/write/works/{id}/publish
export async function publishWork(env: Env, _request: Request, id: string): Promise<Response> {
  const row = await env.DB.prepare('SELECT id, status FROM works WHERE id = ?').bind(id).first<{ id: string; status: string }>();
  if (!row) {
    return new Response(JSON.stringify(jsonError(ErrorCodes.WORK_NOT_FOUND, 'Work not found')), {
      status: 404, headers: { 'Content-Type': 'application/json' },
    });
  }
  if (row.status !== 'draft') {
    return new Response(JSON.stringify(jsonError(ErrorCodes.WORK_STATUS_CONFLICT, 'Only draft works can be published')), {
      status: 409, headers: { 'Content-Type': 'application/json' },
    });
  }

  const sCount = await env.DB.prepare('SELECT COUNT(*) as c FROM sections WHERE work_id = ?').bind(id).first<{ c: number }>();
  if (!sCount || sCount.c === 0) {
    return new Response(JSON.stringify(jsonError(ErrorCodes.WORK_NOT_PUBLISHABLE, 'Work must have at least one section to publish')), {
      status: 400, headers: { 'Content-Type': 'application/json' },
    });
  }

  const now = new Date().toISOString();
  await env.DB.prepare('UPDATE works SET status = ?, updated_at = ? WHERE id = ?').bind('published', now, id).run();

  return new Response(JSON.stringify(jsonSuccess({ id, status: 'published' })), {
    headers: { 'Content-Type': 'application/json' },
  });
}

// PATCH /api/write/works/{id}/close
export async function closeWork(env: Env, _request: Request, id: string): Promise<Response> {
  const row = await env.DB.prepare('SELECT id, status FROM works WHERE id = ?').bind(id).first<{ id: string; status: string }>();
  if (!row) {
    return new Response(JSON.stringify(jsonError(ErrorCodes.WORK_NOT_FOUND, 'Work not found')), {
      status: 404, headers: { 'Content-Type': 'application/json' },
    });
  }
  if (row.status !== 'published') {
    return new Response(JSON.stringify(jsonError(ErrorCodes.WORK_STATUS_CONFLICT, 'Only published works can be closed')), {
      status: 409, headers: { 'Content-Type': 'application/json' },
    });
  }
  const now = new Date().toISOString();
  await env.DB.prepare('UPDATE works SET status = ?, updated_at = ? WHERE id = ?').bind('closed', now, id).run();
  return new Response(JSON.stringify(jsonSuccess({ id, status: 'closed' })), {
    headers: { 'Content-Type': 'application/json' },
  });
}

// PATCH /api/write/works/{id}/reopen
export async function reopenWork(env: Env, _request: Request, id: string): Promise<Response> {
  const row = await env.DB.prepare('SELECT id, status FROM works WHERE id = ?').bind(id).first<{ id: string; status: string }>();
  if (!row) {
    return new Response(JSON.stringify(jsonError(ErrorCodes.WORK_NOT_FOUND, 'Work not found')), {
      status: 404, headers: { 'Content-Type': 'application/json' },
    });
  }
  if (row.status !== 'closed') {
    return new Response(JSON.stringify(jsonError(ErrorCodes.WORK_STATUS_CONFLICT, 'Only closed works can be reopened')), {
      status: 409, headers: { 'Content-Type': 'application/json' },
    });
  }
  const now = new Date().toISOString();
  await env.DB.prepare('UPDATE works SET status = ?, updated_at = ? WHERE id = ?').bind('published', now, id).run();
  return new Response(JSON.stringify(jsonSuccess({ id, status: 'published' })), {
    headers: { 'Content-Type': 'application/json' },
  });
}
