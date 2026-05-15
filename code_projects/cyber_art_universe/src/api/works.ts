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

// 验证 Bearer token（与 write 侧共享 USER_TOKEN secret，支持逗号分隔多 token）
function isReadAuthenticated(request: Request, env: Env): boolean {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !env.USER_TOKEN) return false;
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader;
  const validTokens = env.USER_TOKEN.split(',').map(t => t.trim()).filter(Boolean);
  return validTokens.includes(token);
}

// 检查作品是否允许公开访问。非 published 状态需要认证。
async function requirePublishedOrAuth(env: Env, request: Request, workId: string): Promise<boolean> {
  const row = await env.DB.prepare('SELECT status FROM works WHERE id = ?').bind(workId).first<{ status: string }>();
  if (!row) return false; // 不存在
  if (row.status === 'published') return true; // 公开
  return isReadAuthenticated(request, env); // draft/closed 需认证
}

// ============================================================
// GET /api/catalog — 作品目录
// ============================================================
export async function listWorks(env: Env, request: Request): Promise<Response> {
  const url = new URL(request.url);
  const { page, limit, offset } = parsePagination(url);
  const category = url.searchParams.get('category');
  const type = url.searchParams.get('type') || 'novel';
  const tag = url.searchParams.get('tag');
  const status = url.searchParams.get('status') || 'published';

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

  // 非 published 作品仅认证用户可访问
  if (result.status !== 'published' && !isReadAuthenticated(request, env)) {
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
export async function getWorkOutline(env: Env, request: Request, id: string): Promise<Response> {
  const work = await env.DB.prepare('SELECT id, title, status FROM works WHERE id = ?').bind(id).first<{ id: string; title: string; status: string }>();
  if (!work) {
    return new Response(JSON.stringify(jsonError(ErrorCodes.WORK_NOT_FOUND, 'Work not found')), {
      status: 404, headers: { 'Content-Type': 'application/json' },
    });
  }

  // 非 published 作品仅认证用户可访问
  if (work.status !== 'published' && !isReadAuthenticated(request, env)) {
    return new Response(JSON.stringify(jsonError(ErrorCodes.WORK_NOT_FOUND, 'Work not found')), {
      status: 404, headers: { 'Content-Type': 'application/json' },
    });
  }

  // 同时读取 R2 outline.md 和 D1 sections
  const outlineMd = await readOutline(env, id);
  const sections = await env.DB.prepare(
    'SELECT id, title, order_index, section_summary, word_count FROM sections WHERE work_id = ? ORDER BY order_index'
  ).bind(id).all<Record<string, unknown>>();

  return new Response(JSON.stringify(jsonSuccess({
    id: work.id,
    title: work.title,
    outline_md: outlineMd || null,
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
  // 检查作品访问权限
  const work = await env.DB.prepare('SELECT status FROM works WHERE id = ?').bind(workId).first<{ status: string }>();
  if (!work) {
    return new Response(JSON.stringify(jsonError(ErrorCodes.WORK_NOT_FOUND, 'Work not found')), {
      status: 404, headers: { 'Content-Type': 'application/json' },
    });
  }
  if (work.status !== 'published' && !isReadAuthenticated(request, env)) {
    return new Response(JSON.stringify(jsonError(ErrorCodes.WORK_NOT_FOUND, 'Work not found')), {
      status: 404, headers: { 'Content-Type': 'application/json' },
    });
  }

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
