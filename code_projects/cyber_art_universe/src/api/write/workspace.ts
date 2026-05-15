// 工作区管理 — SF-001~005 + 状态转换 + Sections CRUD
import { Env, Work } from '../../db/schema';
import { jsonSuccess, jsonError, parseJSON } from '../../lib/response';
import { ErrorCodes } from '../../lib/errors';
import { parsePagination } from '../../lib/constants';
import { buildWorkFrontmatter, writeWorkContent, readWorkContent, workR2Key, sectionR2Key, writeSectionContent, readSectionMarkdown, workContentPath } from '../../lib/work_content';

// GET /api/write/works
// 注意：当前无用户认证，返回所有作品。未来接入用户系统后需加 WHERE author = ? 过滤。
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

  // M0 原始构想：创建时即初始化空文件
  await env.WORKS_BUCKET.put(workContentPath(id, 'zh', 'original_concept.md'), '', {
    httpMetadata: { contentType: 'text/markdown; charset=utf-8' },
  });

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

  // 同步 R2 frontmatter（summary 或 tags 变更时）
  if (body.summary !== undefined || body.tags !== undefined) {
    const existingContent = await readWorkContent(env, id);
    await writeWorkContent(env, id, buildWorkFrontmatter({
      ...(existingContent || {}),
      ...(body.summary !== undefined ? { summary: body.summary } : {}),
      ...(body.tags !== undefined ? { tags: Array.isArray(body.tags) ? body.tags : [] } : {}),
    }));
  }

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

// ================================================================
// Sections CRUD — 手动章节管理（非 AI 生成）
// ================================================================

// POST /api/write/works/{id}/sections
export async function createSection(env: Env, request: Request, workId: string): Promise<Response> {
  const work = await env.DB.prepare('SELECT id, status FROM works WHERE id = ?').bind(workId).first<{ id: string; status: string }>();
  if (!work) {
    return new Response(JSON.stringify(jsonError(ErrorCodes.WORK_NOT_FOUND, 'Work not found')), {
      status: 404, headers: { 'Content-Type': 'application/json' },
    });
  }

  const body = await request.json() as { title: string; section_summary?: string; body?: string; order_index?: number; entities_involved?: string[] };
  if (!body.title) {
    return new Response(JSON.stringify(jsonError(ErrorCodes.MISSING_REQUIRED_FIELD, 'title is required')), {
      status: 400, headers: { 'Content-Type': 'application/json' },
    });
  }

  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const orderIndex = body.order_index ?? 0;
  const entitiesInvolved = Array.isArray(body.entities_involved) ? JSON.stringify(body.entities_involved) : '[]';

  // 从请求提取语言参数，确保 r2_object_key 含正确语言前缀
  const url = new URL(request.url);
  const langParam = url.searchParams.get('lang');
  const lang = (langParam && ['zh', 'en'].includes(langParam) ? langParam : 'zh') as 'zh' | 'en';

  await writeSectionContent(env, workId, id, {
    section_id: id,
    title: body.title,
    section_summary: body.section_summary || '',
    order_index: orderIndex,
    entities_involved: Array.isArray(body.entities_involved) ? body.entities_involved : [],
  }, body.body || '', lang);

  const r2Key = sectionR2Key(workId, id, lang);
  await env.DB.prepare(`
    INSERT INTO sections (id, work_id, title, order_index, section_summary, r2_object_key, word_count, entities_involved, version, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
  `).bind(id, workId, body.title, orderIndex, body.section_summary || null, r2Key, body.body ? body.body.length : 0, entitiesInvolved, now, now).run();

  return new Response(JSON.stringify(jsonSuccess({ id, r2_object_key: r2Key })), {
    status: 201, headers: { 'Content-Type': 'application/json' },
  });
}

// PUT /api/write/works/{id}/sections/{sid}
export async function updateSection(env: Env, request: Request, workId: string, sectionId: string): Promise<Response> {
  const existing = await env.DB.prepare('SELECT id FROM sections WHERE id = ? AND work_id = ?').bind(sectionId, workId).first();
  if (!existing) {
    return new Response(JSON.stringify(jsonError(ErrorCodes.SECTION_NOT_FOUND, 'Section not found')), {
      status: 404, headers: { 'Content-Type': 'application/json' },
    });
  }

  const body = await request.json() as { title?: string; section_summary?: string; body?: string; order_index?: number; entities_involved?: string[] };
  const now = new Date().toISOString();

  if (body.body !== undefined || body.title !== undefined || body.section_summary !== undefined) {
    const existingContent = await readSectionMarkdown(env, workId, sectionId);
    const frontmatter = {
      ...(existingContent?.frontmatter || {}),
      ...(body.title !== undefined ? { title: body.title } : {}),
      ...(body.section_summary !== undefined ? { section_summary: body.section_summary } : {}),
    };
    await writeSectionContent(env, workId, sectionId, frontmatter, body.body ?? existingContent?.body ?? '');
  }

  const fields: string[] = ['updated_at = ?'];
  const bindings: (string | number | null)[] = [now];
  const fieldMap: Record<string, unknown> = {
    title: body.title, section_summary: body.section_summary,
    order_index: body.order_index,
    word_count: body.body !== undefined ? body.body.length : undefined,
    entities_involved: Array.isArray(body.entities_involved) ? JSON.stringify(body.entities_involved) : body.entities_involved,
  };

  for (const [key, value] of Object.entries(fieldMap)) {
    if (value !== undefined) { fields.push(`${key} = ?`); bindings.push(value as string | number | null); }
  }

  bindings.push(sectionId);
  await env.DB.prepare(`UPDATE sections SET ${fields.join(', ')} WHERE id = ?`).bind(...bindings).run();

  return new Response(JSON.stringify(jsonSuccess({ id: sectionId })), {
    headers: { 'Content-Type': 'application/json' },
  });
}

// DELETE /api/write/works/{id}/sections/{sid}
export async function deleteSection(env: Env, _request: Request, workId: string, sectionId: string): Promise<Response> {
  const existing = await env.DB.prepare('SELECT id FROM sections WHERE id = ? AND work_id = ?').bind(sectionId, workId).first();
  if (!existing) {
    return new Response(JSON.stringify(jsonError(ErrorCodes.SECTION_NOT_FOUND, 'Section not found')), {
      status: 404, headers: { 'Content-Type': 'application/json' },
    });
  }

  await env.DB.prepare('DELETE FROM sections WHERE id = ?').bind(sectionId).run();

  const r2Key = sectionR2Key(workId, sectionId);
  try { await env.WORKS_BUCKET.delete(r2Key); } catch (err) { console.error('R2 delete failed for section:', sectionId, err); }

  return new Response(JSON.stringify(jsonSuccess({ id: sectionId, deleted: true })), {
    headers: { 'Content-Type': 'application/json' },
  });
}
