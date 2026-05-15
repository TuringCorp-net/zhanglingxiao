// M0 原始构想 — 作者自由记录的灵感与原始想法
// Story Elf（内部辅助AI）禁止修改此文件。
// 人类作者和外部 AI/Agent 可正常读写。
import { Env } from '../../db/schema';
import { jsonSuccess, jsonError } from '../../lib/response';
import { ErrorCodes } from '../../lib/errors';
import { workContentPath, extractLang, readR2WithLangFallback } from '../../lib/work_content';

const M0_FILENAME = 'original_concept.md';

// ============================================================
// GET /api/write/original-concept/{work_id}?lang=
// 返回原始构想内容。若不存在则返回空字符串。
// ============================================================

export async function readOriginalConcept(env: Env, request: Request, workId: string): Promise<Response> {
  const lang = extractLang(request);
  const { content, actualLang } = await readR2WithLangFallback(env, workId, lang, M0_FILENAME);

  return new Response(JSON.stringify(jsonSuccess({
    work_id: workId,
    lang: actualLang,
    content: content || '',
    is_empty: !content || !content.trim(),
  })), {
    headers: { 'Content-Type': 'application/json' },
  });
}

// ============================================================
// PUT /api/write/original-concept/{work_id}?lang=
// 保存原始构想内容。人类作者和外部 AI/Agent 可调用。
// Story Elf（内部辅助AI）禁止使用此端点修改 M0。
// ============================================================

export async function updateOriginalConcept(env: Env, request: Request, workId: string): Promise<Response> {
  const lang = extractLang(request);
  const body = await request.json() as { content: string };

  if (typeof body.content !== 'string') {
    return new Response(JSON.stringify(jsonError(ErrorCodes.MISSING_REQUIRED_FIELD, 'content is required')), {
      status: 400, headers: { 'Content-Type': 'application/json' },
    });
  }

  // 验证 work 存在
  const work = await env.DB.prepare('SELECT id FROM works WHERE id = ?').bind(workId).first();
  if (!work) {
    return new Response(JSON.stringify(jsonError(ErrorCodes.WORK_NOT_FOUND, 'Work not found')), {
      status: 404, headers: { 'Content-Type': 'application/json' },
    });
  }

  await env.WORKS_BUCKET.put(workContentPath(workId, lang, M0_FILENAME), body.content, {
    httpMetadata: { contentType: 'text/markdown; charset=utf-8' },
  });

  return new Response(JSON.stringify(jsonSuccess({
    work_id: workId,
    lang,
    saved: true,
  })), {
    headers: { 'Content-Type': 'application/json' },
  });
}
