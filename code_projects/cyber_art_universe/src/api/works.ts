// 内容 API — 作品与章节 CRUD
import { Env, Work, Section } from '../db/schema';
import { jsonSuccess, jsonError, parseJSON } from '../lib/response';
import { ErrorCodes } from '../lib/errors';
import {
  buildWorkFrontmatter,
  getAcceptsMarkdown,
  readWorkContent,
  readWorkMarkdown,
  writeWorkContent,
  readSectionMarkdown,
  writeSectionContent,
  readOutline,
  writeOutline,
  resolveWorkR2Key,
  workR2Key,
  sectionR2Key,
} from '../lib/work_content';
import { parsePagination } from '../lib/constants';

// ============================================================
// GET /api/catalog — 作品目录
// ============================================================
export async function listWorks(env: Env, request: Request): Promise<Response> {
  const url = new URL(request.url);
  const { page, limit, offset } = parsePagination(url);
  const category = url.searchParams.get('category');
  const type = url.searchParams.get('type') || 'novel';
  const tag = url.searchParams.get('tag');
  const status = url.searchParams.get('status') || 'active';

  let whereClause = 'WHERE w.status = ?';
  const bindings: (string | number)[] = [status];

  if (category) {
    whereClause += ' AND w.category = ?';
    bindings.push(category);
  }

  if (type) {
    whereClause += ' AND w.type = ?';
    bindings.push(type);
  }

  if (tag) {
    whereClause += ' AND w.tags LIKE ?';
    bindings.push(`%"${tag}"%`);
  }

  const countResult = await env.DB.prepare(
    `SELECT COUNT(*) as total FROM works w ${whereClause}`
  ).bind(...bindings).first<{ total: number }>();
  const total = countResult?.total || 0;

  const result = await env.DB.prepare(
    `SELECT w.id, w.title, w.type, w.category, w.author, w.creation_attribution, w.audience, w.tags, w.status, w.summary, w.version, w.created_at, w.updated_at
     FROM works w ${whereClause} ORDER BY w.updated_at DESC LIMIT ? OFFSET ?`
  ).bind(...bindings, limit, offset).all<Record<string, unknown>>();

  const works = (result.results || []).map(row => ({
    ...row,
    tags: parseJSON<string[]>(String(row.tags || '[]'), []),
  }));

  return new Response(JSON.stringify(jsonSuccess(works, { page, total })), {
    headers: { 'Content-Type': 'application/json' },
  });
}

// ============================================================
// GET /api/content/{id} — 作品元数据
// ============================================================
export async function getWork(env: Env, request: Request, id: string): Promise<Response> {
  const result = await env.DB.prepare('SELECT * FROM works WHERE id = ?').bind(id).first<Record<string, unknown>>();
  if (!result) {
    return new Response(JSON.stringify(jsonError(ErrorCodes.WORK_NOT_FOUND, 'Work not found')), {
      status: 404, headers: { 'Content-Type': 'application/json' },
    });
  }

  const r2Key = resolveWorkR2Key(result);
  if (getAcceptsMarkdown(request)) {
    const markdown = await readWorkMarkdown(env, r2Key);
    if (markdown) {
      return new Response(markdown, {
        headers: { 'Content-Type': 'text/markdown; charset=utf-8' },
      });
    }
  }

  const contentFromR2 = await readWorkContent(env, id);
  const content = contentFromR2 || buildWorkFrontmatter({
    summary: typeof result.summary === 'string' ? result.summary : null,
    tags: parseJSON<string[]>(String(result.tags || '[]'), []),
  });
  if (!contentFromR2) {
    await writeWorkContent(env, id, content);
  }

  const work = {
    ...result,
    tags: parseJSON<string[]>(String(result.tags || '[]'), []),
    summary: content.summary,
  };

  return new Response(JSON.stringify(jsonSuccess(work)), {
    headers: { 'Content-Type': 'application/json' },
  });
}

// ============================================================
// GET /api/content/{id}/outline — 作品大纲
// ============================================================
export async function getWorkOutline(env: Env, _request: Request, id: string): Promise<Response> {
  const work = await env.DB.prepare('SELECT id, title FROM works WHERE id = ?').bind(id).first<{ id: string; title: string }>();
  if (!work) {
    return new Response(JSON.stringify(jsonError(ErrorCodes.WORK_NOT_FOUND, 'Work not found')), {
      status: 404, headers: { 'Content-Type': 'application/json' },
    });
  }

  // 先尝试从 R2 读取 outline.md
  const outlineMd = await readOutline(env, id);
  if (outlineMd) {
    return new Response(JSON.stringify(jsonSuccess({ id, title: work.title, outline: outlineMd })), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // 回退：从 D1 sections 表聚合
  const sections = await env.DB.prepare(
    'SELECT id, title, order_index, section_summary, word_count FROM sections WHERE work_id = ? ORDER BY order_index'
  ).bind(id).all<Record<string, unknown>>();

  return new Response(JSON.stringify(jsonSuccess({
    id: work.id,
    title: work.title,
    sections: (sections.results || []).map(s => ({
      ...s,
      entities_involved: parseJSON<string[]>(String(s.entities_involved || '[]'), []),
    })),
  })), {
    headers: { 'Content-Type': 'application/json' },
  });
}

// ============================================================
// GET /api/content/{id}/sections/{section_id} — 章节内容
// ============================================================
export async function getSection(env: Env, request: Request, workId: string, sectionId: string): Promise<Response> {
  const row = await env.DB.prepare(
    'SELECT * FROM sections WHERE id = ? AND work_id = ?'
  ).bind(sectionId, workId).first<Record<string, unknown>>();

  if (!row) {
    return new Response(JSON.stringify(jsonError(ErrorCodes.SECTION_NOT_FOUND, 'Section not found')), {
      status: 404, headers: { 'Content-Type': 'application/json' },
    });
  }

  const mode = new URL(request.url).searchParams.get('mode') || 'full';

  // mode=summary: 只返回章节摘要
  if (mode === 'summary') {
    return new Response(JSON.stringify(jsonSuccess({
      id: row.id,
      work_id: row.work_id,
      title: row.title,
      order_index: row.order_index,
      section_summary: row.section_summary,
      word_count: row.word_count,
    })), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // 读取 R2 内容
  const content = await readSectionMarkdown(env, workId, sectionId);
  if (content && getAcceptsMarkdown(request)) {
    return new Response(content.body, {
      headers: { 'Content-Type': 'text/markdown; charset=utf-8' },
    });
  }

  const section = {
    ...row,
    entities_involved: parseJSON<string[]>(String(row.entities_involved || '[]'), []),
    body: content?.body || null,
    frontmatter: content?.frontmatter || null,
  };

  return new Response(JSON.stringify(jsonSuccess(section)), {
    headers: { 'Content-Type': 'application/json' },
  });
}

// ============================================================
// POST /api/admin/works — 创建作品
// ============================================================
export async function createWork(env: Env, request: Request): Promise<Response> {
  const body = await request.json() as Partial<Work>;
  if (!body.title || !body.author) {
    return new Response(JSON.stringify(jsonError(ErrorCodes.MISSING_REQUIRED_FIELD, 'title and author are required')), {
      status: 400, headers: { 'Content-Type': 'application/json' },
    });
  }

  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const tags = Array.isArray(body.tags) ? JSON.stringify(body.tags) : (body.tags || '[]');
  const type = body.type || 'novel';
  const status = body.status || 'draft';
  const r2Key = workR2Key(id);

  // 写入 R2 frontmatter
  await writeWorkContent(env, id, buildWorkFrontmatter({
    summary: body.summary || null,
    tags: parseJSON<string[]>(tags, []),
  }));

  // 写入 D1
  await env.DB.prepare(`
    INSERT INTO works (id, title, type, category, author, creation_attribution, audience, tags, status, summary, r2_object_key, version, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
  `).bind(id, body.title, type, body.category || '', body.author,
    body.creation_attribution || 'original',
    Array.isArray(body.audience) ? JSON.stringify(body.audience) : '[]',
    tags, status, body.summary || null, r2Key, now, now).run();

  return new Response(JSON.stringify(jsonSuccess({ id, r2_object_key: r2Key })), {
    status: 201, headers: { 'Content-Type': 'application/json' },
  });
}

// ============================================================
// PUT /api/admin/works/{id} — 更新作品
// ============================================================
export async function updateWork(env: Env, request: Request, id: string): Promise<Response> {
  const existing = await env.DB.prepare('SELECT * FROM works WHERE id = ?').bind(id).first<Record<string, unknown>>();
  if (!existing) {
    return new Response(JSON.stringify(jsonError(ErrorCodes.WORK_NOT_FOUND, 'Work not found')), {
      status: 404, headers: { 'Content-Type': 'application/json' },
    });
  }

  const body = await request.json() as Partial<Work>;
  const now = new Date().toISOString();
  const r2Key = workR2Key(id);

  // 更新 R2 frontmatter（如果提供了 summary 或 tags）
  if (body.summary !== undefined || body.tags !== undefined) {
    const existingContent = await readWorkContent(env, id);
    await writeWorkContent(env, id, buildWorkFrontmatter({
      ...(existingContent || {}),
      ...(body.summary !== undefined ? { summary: body.summary } : {}),
      ...(body.tags !== undefined ? { tags: Array.isArray(body.tags) ? body.tags : [] } : {}),
    }));
  }

  // 构建动态 UPDATE
  const fields: string[] = ['updated_at = ?'];
  const bindings: (string | number | null)[] = [now];
  const fieldMap: Record<string, unknown> = {
    title: body.title, type: body.type, category: body.category, author: body.author,
    creation_attribution: body.creation_attribution,
    audience: Array.isArray(body.audience) ? JSON.stringify(body.audience) : body.audience,
    status: body.status, summary: body.summary,
    tags: Array.isArray(body.tags) ? JSON.stringify(body.tags) : body.tags,
  };

  for (const [key, value] of Object.entries(fieldMap)) {
    if (value !== undefined) {
      fields.push(`${key} = ?`);
      bindings.push(value as string | number | null);
    }
  }

  bindings.push(id);
  await env.DB.prepare(`UPDATE works SET ${fields.join(', ')} WHERE id = ?`).bind(...bindings).run();

  return new Response(JSON.stringify(jsonSuccess({ id })), {
    headers: { 'Content-Type': 'application/json' },
  });
}

// ============================================================
// DELETE /api/admin/works/{id} — 删除作品
// ============================================================
export async function deleteWork(env: Env, _request: Request, id: string): Promise<Response> {
  const existing = await env.DB.prepare('SELECT id, r2_object_key FROM works WHERE id = ?').bind(id).first<Record<string, unknown>>();
  if (!existing) {
    return new Response(JSON.stringify(jsonError(ErrorCodes.WORK_NOT_FOUND, 'Work not found')), {
      status: 404, headers: { 'Content-Type': 'application/json' },
    });
  }

  // D1 删除（CASCADE 会自动删除关联的 sections, entities, reviews）
  await env.DB.prepare('DELETE FROM works WHERE id = ?').bind(id).run();

  // R2 清理
  const r2Key = String(existing.r2_object_key || '');
  if (r2Key) {
    try { await env.WORKS_BUCKET.delete(r2Key); } catch { /* ignore */ }
  }

  return new Response(JSON.stringify(jsonSuccess({ id, deleted: true })), {
    headers: { 'Content-Type': 'application/json' },
  });
}

// ============================================================
// POST /api/admin/works/{id}/sections — 创建章节
// ============================================================
export async function createSection(env: Env, request: Request, workId: string): Promise<Response> {
  const work = await env.DB.prepare('SELECT id FROM works WHERE id = ?').bind(workId).first();
  if (!work) {
    return new Response(JSON.stringify(jsonError(ErrorCodes.WORK_NOT_FOUND, 'Work not found')), {
      status: 404, headers: { 'Content-Type': 'application/json' },
    });
  }

  const body = await request.json() as Partial<Section> & { body?: string };
  if (!body.title) {
    return new Response(JSON.stringify(jsonError(ErrorCodes.MISSING_REQUIRED_FIELD, 'title is required')), {
      status: 400, headers: { 'Content-Type': 'application/json' },
    });
  }

  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const orderIndex = body.order_index ?? 0;

  // 写入 R2 章节内容
  await writeSectionContent(env, workId, id, {
    section_id: id,
    title: body.title,
    section_summary: body.section_summary || '',
    order_index: orderIndex,
    entities_involved: Array.isArray(body.entities_involved) ? body.entities_involved : [],
  }, body.body || '');

  // 写入 D1
  const r2Key = sectionR2Key(workId, id);
  const entitiesInvolved = Array.isArray(body.entities_involved) ? JSON.stringify(body.entities_involved) : '[]';
  await env.DB.prepare(`
    INSERT INTO sections (id, work_id, title, order_index, section_summary, r2_object_key, word_count, entities_involved, version, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
  `).bind(
    id, workId, body.title, orderIndex, body.section_summary || null,
    r2Key, body.word_count || 0, entitiesInvolved, now, now
  ).run();

  return new Response(JSON.stringify(jsonSuccess({ id, r2_object_key: r2Key })), {
    status: 201, headers: { 'Content-Type': 'application/json' },
  });
}

// ============================================================
// PUT /api/admin/works/{id}/sections/{section_id} — 更新章节
// ============================================================
export async function updateSection(env: Env, request: Request, workId: string, sectionId: string): Promise<Response> {
  const existing = await env.DB.prepare(
    'SELECT id FROM sections WHERE id = ? AND work_id = ?'
  ).bind(sectionId, workId).first();

  if (!existing) {
    return new Response(JSON.stringify(jsonError(ErrorCodes.SECTION_NOT_FOUND, 'Section not found')), {
      status: 404, headers: { 'Content-Type': 'application/json' },
    });
  }

  const body = await request.json() as Partial<Section> & { body?: string };
  const now = new Date().toISOString();

  // 更新 R2 内容（如果提供了 body）
  if (body.body !== undefined || body.title !== undefined || body.section_summary !== undefined) {
    const existingContent = await readSectionMarkdown(env, workId, sectionId);
    const frontmatter = {
      ...(existingContent?.frontmatter || {}),
      ...(body.title !== undefined ? { title: body.title } : {}),
      ...(body.section_summary !== undefined ? { section_summary: body.section_summary } : {}),
    };
    await writeSectionContent(env, workId, sectionId, frontmatter, body.body ?? existingContent?.body ?? '');
  }

  // 更新 D1
  const fields: string[] = ['updated_at = ?'];
  const bindings: (string | number | null)[] = [now];
  const fieldMap: Record<string, unknown> = {
    title: body.title, section_summary: body.section_summary,
    order_index: body.order_index, word_count: body.word_count,
    entities_involved: Array.isArray(body.entities_involved) ? JSON.stringify(body.entities_involved) : body.entities_involved,
  };

  for (const [key, value] of Object.entries(fieldMap)) {
    if (value !== undefined) {
      fields.push(`${key} = ?`);
      bindings.push(value as string | number | null);
    }
  }

  bindings.push(sectionId);
  await env.DB.prepare(`UPDATE sections SET ${fields.join(', ')} WHERE id = ?`).bind(...bindings).run();

  return new Response(JSON.stringify(jsonSuccess({ id: sectionId })), {
    headers: { 'Content-Type': 'application/json' },
  });
}

// ============================================================
// DELETE /api/admin/works/{id}/sections/{section_id} — 删除章节
// ============================================================
export async function deleteSection(env: Env, _request: Request, workId: string, sectionId: string): Promise<Response> {
  const existing = await env.DB.prepare(
    'SELECT id FROM sections WHERE id = ? AND work_id = ?'
  ).bind(sectionId, workId).first();

  if (!existing) {
    return new Response(JSON.stringify(jsonError(ErrorCodes.SECTION_NOT_FOUND, 'Section not found')), {
      status: 404, headers: { 'Content-Type': 'application/json' },
    });
  }

  await env.DB.prepare('DELETE FROM sections WHERE id = ?').bind(sectionId).run();

  // 清理 R2
  const r2Key = sectionR2Key(workId, sectionId);
  try { await env.WORKS_BUCKET.delete(r2Key); } catch { /* ignore */ }

  return new Response(JSON.stringify(jsonSuccess({ id: sectionId, deleted: true })), {
    headers: { 'Content-Type': 'application/json' },
  });
}
