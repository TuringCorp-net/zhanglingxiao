// Story Forger — 营销与分发辅助 (SF-040~042)
// 金句提取、标题/简介生成、多平台分发改写
import { Env } from '../../db/schema';
import { jsonSuccess, jsonError } from '../../lib/response';
import { ErrorCodes } from '../../lib/errors';
import { generateWithAI } from '../../lib/ai';

const MARKETING_KEY = (workId: string, sectionId: string, type: string) =>
  `works/${workId}/marketing/${sectionId}_${type}.json`;

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

  // 读取章节正文
  const r2Key = `works/${body.work_id}/chapters/${sectionId}.md`;
  const r2Obj = await env.WORKS_BUCKET.get(r2Key);
  const chapterBody = r2Obj ? (await r2Obj.text()).substring(0, 4000) : '(无正文)';

  const prompt = `你是一位资深内容营销编辑。请从以下章节中提取可作为营销素材的内容。

要求提取：
1. **金句**（golden_lines）：有感染力、易传播的单句（1-3 句）
2. **冲突点**（conflict_points）：情节高潮或转折（1-3 个）
3. **钩子**（hooks）：引发好奇心的悬念或问题（1-3 个）

## 章节：${section.title}
## 正文
${chapterBody}

请严格按以下 JSON 格式输出，不要包含任何其他文本：
{
  "golden_lines": ["金句1", "金句2"],
  "conflict_points": ["冲突点描述1"],
  "hooks": ["钩子描述1"],
  "suggested_hashtags": ["标签1", "标签2"]
}`;

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
    await env.WORKS_BUCKET.put(MARKETING_KEY(body.work_id, sectionId, 'extract'), JSON.stringify(data, null, 2), {
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

  const prompt = `你是一位资深图书营销编辑。请为以下作品生成 ${numVariants} 个标题和简介版本。

要求：
- 不同版本面向不同读者群（如：年轻女性、男性向、文艺读者、大众通俗等）
- 每个版本包含：标题、副标题、一句话钩子

## 作品信息
原标题：${work.title}
类别：${work.category || '未分类'}
原简介：${work.summary || '无'}
${body.style_notes ? `作者备注：${body.style_notes}` : ''}

请严格按以下 JSON 格式输出，不要包含任何其他文本：
{
  "titles": [
    {
      "version": "版本名称（如 青春向 / 硬核向 / 文艺向）",
      "title": "新标题",
      "subtitle": "副标题或标语",
      "hook": "一句话钩子（30字内）"
    }
  ]
}`;

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

  try {
    await env.WORKS_BUCKET.put(
      `works/${workId}/marketing/titles.json`, JSON.stringify(data, null, 2),
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

  const r2Key = `works/${body.work_id}/chapters/${sectionId}.md`;
  const r2Obj = await env.WORKS_BUCKET.get(r2Key);
  const chapterBody = r2Obj ? (await r2Obj.text()).substring(0, 3000) : '(无正文)';

  const formatPrompts: Record<string, string> = {
    short_video: '将以下章节内容改写为短视频口播稿（60秒以内），要求口语化、有节奏感、开头3秒抓人：',
    x: '将以下章节内容改写为 X/Twitter 线程（3-5条），每条简洁有力、有钩子、适合碎片阅读：',
    linkedin: '将以下章节内容改写为 LinkedIn 帖子风格，专业化、有洞察、适合职业读者：',
  };

  const formatInstruction = formatPrompts[format] || formatPrompts.short_video;

  const prompt = `${formatInstruction}

## 章节：${section.title}
## 正文
${chapterBody}
${body.style_notes ? `风格要求：${body.style_notes}` : ''}

请输出改写后的文本（纯文本，不需要 JSON 包装）。`;

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
      MARKETING_KEY(body.work_id, sectionId, `repurpose_${format}`), JSON.stringify(data, null, 2),
      { httpMetadata: { contentType: 'application/json' } },
    );
  } catch (err) {
    console.error('R2 write failed for marketing repurpose:', body.work_id, sectionId, err);
  }

  return new Response(JSON.stringify(jsonSuccess(data)), {
    status: 201, headers: { 'Content-Type': 'application/json' },
  });
}
