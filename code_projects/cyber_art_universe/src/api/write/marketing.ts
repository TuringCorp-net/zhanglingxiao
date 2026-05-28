// Story Forger — 营销与分发辅助 (SF-040~042)（多语言支持）
import { Env } from '../../db/schema';
import { jsonSuccess, jsonError } from '../../lib/response';
import { ErrorCodes } from '../../lib/errors';
import { generateWithAI } from '../../lib/ai';
import { renderTemplate as renderText } from '../../lib/l1/render';
import marketingExtractMd from '../../lib/l1/prompts/tools/marketing_extract.md';
import marketingTitlesMd from '../../lib/l1/prompts/tools/marketing_titles.md';
import marketingRepurposeMd from '../../lib/l1/prompts/tools/marketing_repurpose.md';
import { workContentPath, sectionR2Key, extractLang } from '../../lib/l1/work-content';

// POST /api/write/marketing/extract/{section_id} — SF-040 爆点提炼
export async function extractHooks(env: Env, request: Request, sectionId: string): Promise<Response> {
  const body = await request.json() as { work_id: string };
  if (!body.work_id || !sectionId) {
    return new Response(JSON.stringify(jsonError(ErrorCodes.MISSING_REQUIRED_FIELD, 'work_id is required')), {
      status: 400, headers: { 'Content-Type': 'application/json' },
    });
  }

  const section = await env.DB.prepare(
    'SELECT id, title, section_summary FROM sections WHERE id = ? AND work_id = ?'
  ).bind(sectionId, body.work_id).first<{ id: string; title: string; section_summary: string }>();
  if (!section) {
    return new Response(JSON.stringify(jsonError(ErrorCodes.SECTION_NOT_FOUND, 'Section not found')), {
      status: 404, headers: { 'Content-Type': 'application/json' },
    });
  }

  // 读取章节正文（语言感知）
  const lang = extractLang(request);
  const r2Obj = await env.WORKS_BUCKET.get(sectionR2Key(body.work_id, sectionId, lang));
  const chapterBody = r2Obj ? (await r2Obj.text()).substring(0, 4000) : '(无正文)';

  const prompt = renderText(marketingExtractMd, {
    chapter_content: `## 章节：${section.title}\n## 正文\n${chapterBody}`,
    section_summary: section.section_summary || '',
  });

  const result = await generateWithAI(env, prompt, { maxTokens: 1024 });
  if (!result) {
    return new Response(JSON.stringify(jsonError(ErrorCodes.AI_SERVICE_UNAVAILABLE, 'AI service unavailable')), {
      status: 503, headers: { 'Content-Type': 'application/json' },
    });
  }

  let parsed: Record<string, unknown>;
  try {
    const jsonMatch = result.match(/\{[\s\S]*\}/);
    parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : {};
  } catch {
    parsed = {};
  }

  const data = {
    section_id: sectionId,
    work_id: body.work_id,
    title: section.title,
    ...parsed,
    generated_at: new Date().toISOString(),
  };

  try {
    await env.WORKS_BUCKET.put(workContentPath(body.work_id, lang, `marketing/${sectionId}_extract.json`), JSON.stringify(data, null, 2), {
      httpMetadata: { contentType: 'application/json' },
    });
  } catch (err) {
    console.error('R2 write failed for marketing extract:', body.work_id, sectionId, err);
  }

  return new Response(JSON.stringify(jsonSuccess(data)), {
    status: 201, headers: { 'Content-Type': 'application/json' },
  });
}

// POST /api/write/marketing/titles/{work_id} — SF-041 标题/简介生成
export async function generateTitles(env: Env, request: Request, workId: string): Promise<Response> {
  const body = await request.json() as { style_notes?: string; num_variants?: number };
  const numVariants = body.num_variants || 5;

  const work = await env.DB.prepare('SELECT id, title, summary, category FROM works WHERE id = ?').bind(workId).first<{ id: string; title: string; summary: string; category: string }>();
  if (!work) {
    return new Response(JSON.stringify(jsonError(ErrorCodes.WORK_NOT_FOUND, 'Work not found')), {
      status: 404, headers: { 'Content-Type': 'application/json' },
    });
  }

  const prompt = renderText(marketingTitlesMd, {
    num_variants: String(numVariants),
    work_title: work.title,
    category: work.category || '未分类',
    summary: work.summary || '无',
    style_notes: body.style_notes ? `作者备注：${body.style_notes}` : '',
  });

  const result = await generateWithAI(env, prompt, { maxTokens: 1536 });
  if (!result) {
    return new Response(JSON.stringify(jsonError(ErrorCodes.AI_SERVICE_UNAVAILABLE, 'AI service unavailable')), {
      status: 503, headers: { 'Content-Type': 'application/json' },
    });
  }

  let parsed: { titles?: Array<Record<string, string>> };
  try {
    const jsonMatch = result.match(/\{[\s\S]*\}/);
    parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : {};
  } catch {
    parsed = {};
  }

  const data = {
    work_id: workId,
    original_title: work.title,
    titles: parsed.titles || [],
    generated_at: new Date().toISOString(),
  };

  const lang = extractLang(request);
  try {
    await env.WORKS_BUCKET.put(
      workContentPath(workId, lang, 'marketing/titles.json'), JSON.stringify(data, null, 2),
      { httpMetadata: { contentType: 'application/json' } },
    );
  } catch (err) {
    console.error('R2 write failed for marketing titles:', workId, err);
  }

  return new Response(JSON.stringify(jsonSuccess(data)), {
    status: 201, headers: { 'Content-Type': 'application/json' },
  });
}

// POST /api/write/marketing/repurpose/{section_id} — SF-042 分发改写
export async function repurposeSection(env: Env, request: Request, sectionId: string): Promise<Response> {
  const url = new URL(request.url);
  const format = url.searchParams.get('format') || 'short_video';
  const body = await request.json() as { work_id: string; style_notes?: string };
  if (!body.work_id) {
    return new Response(JSON.stringify(jsonError(ErrorCodes.MISSING_REQUIRED_FIELD, 'work_id is required')), {
      status: 400, headers: { 'Content-Type': 'application/json' },
    });
  }

  const section = await env.DB.prepare(
    'SELECT id, title FROM sections WHERE id = ? AND work_id = ?'
  ).bind(sectionId, body.work_id).first<{ id: string; title: string }>();
  if (!section) {
    return new Response(JSON.stringify(jsonError(ErrorCodes.SECTION_NOT_FOUND, 'Section not found')), {
      status: 404, headers: { 'Content-Type': 'application/json' },
    });
  }

  const lang = extractLang(request);
  const r2Obj = await env.WORKS_BUCKET.get(sectionR2Key(body.work_id, sectionId, lang));
  const chapterBody = r2Obj ? (await r2Obj.text()).substring(0, 3000) : '(无正文)';

  const formatPrompts: Record<string, string> = {
    short_video: '将以下章节内容改写为短视频口播稿（60秒以内），要求口语化、有节奏感、开头3秒抓人：',
    x: '将以下章节内容改写为 X/Twitter 线程（3-5条），每条简洁有力、有钩子、适合碎片阅读：',
    linkedin: '将以下章节内容改写为 LinkedIn 帖子风格，专业化、有洞察、适合职业读者：',
  };

  const formatInstruction = formatPrompts[format] || formatPrompts.short_video;

  const prompt = renderText(marketingRepurposeMd, {
    format_instruction: formatInstruction,
    chapter_content: `## 章节：${section.title}\n## 正文\n${chapterBody}`,
    style_notes: body.style_notes ? `风格要求：${body.style_notes}` : '',
  });

  const result = await generateWithAI(env, prompt, { maxTokens: 1024 });
  if (!result) {
    return new Response(JSON.stringify(jsonError(ErrorCodes.AI_SERVICE_UNAVAILABLE, 'AI service unavailable')), {
      status: 503, headers: { 'Content-Type': 'application/json' },
    });
  }

  const data = {
    section_id: sectionId,
    work_id: body.work_id,
    title: section.title,
    format,
    content: result,
    generated_at: new Date().toISOString(),
  };

  try {
    await env.WORKS_BUCKET.put(
      workContentPath(body.work_id, lang, `marketing/${sectionId}_repurpose_${format}.json`), JSON.stringify(data, null, 2),
      { httpMetadata: { contentType: 'application/json' } },
    );
  } catch (err) {
    console.error('R2 write failed for marketing repurpose:', body.work_id, sectionId, err);
  }

  return new Response(JSON.stringify(jsonSuccess(data)), {
    status: 201, headers: { 'Content-Type': 'application/json' },
  });
}
