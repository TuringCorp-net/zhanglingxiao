// 大纲引擎 — SF-020~022
import { Env } from '../../db/schema';
import { jsonSuccess, jsonError } from '../../lib/response';
import { ErrorCodes } from '../../lib/errors';
import { generateWithAI } from '../../lib/ai';
import { writeOutline } from '../../lib/work_content';

const WORLD_BIBLE_KEY = (workId: string) => `works/${workId}/world_bible.md`;

// POST /api/write/outline/generate
export async function generateOutline(env: Env, request: Request): Promise<Response> {
  const body = await request.json() as { work_id: string; num_chapters?: number; style?: string };
  if (!body.work_id) {
    return new Response(JSON.stringify(jsonError(ErrorCodes.MISSING_REQUIRED_FIELD, 'work_id is required')), {
      status: 400, headers: { 'Content-Type': 'application/json' },
    });
  }

  const work = await env.DB.prepare('SELECT id, title, category, summary FROM works WHERE id = ?').bind(body.work_id).first<Record<string, unknown>>();
  if (!work) {
    return new Response(JSON.stringify(jsonError(ErrorCodes.WORK_NOT_FOUND, 'Work not found')), {
      status: 404, headers: { 'Content-Type': 'application/json' },
    });
  }

  // 检查覆盖：如果已有 section，需显式 overwrite
  const url = new URL(request.url);
  if (url.searchParams.get('overwrite') !== 'true') {
    const existing = await env.DB.prepare('SELECT COUNT(*) as c FROM sections WHERE work_id = ?').bind(body.work_id).first<{ c: number }>();
    if (existing && existing.c > 0) {
      return new Response(JSON.stringify(jsonError(ErrorCodes.RESOURCE_CONFLICT, 'Outline already exists. Use ?overwrite=true to regenerate.')), {
        status: 409, headers: { 'Content-Type': 'application/json' },
      });
    }
  }

  // 读取世界设定作为上下文
  let worldContext = '';
  const wb = await env.WORKS_BUCKET.get(WORLD_BIBLE_KEY(body.work_id));
  if (wb) worldContext = await wb.text();

  // 读取已有实体
  const entities = await env.DB.prepare('SELECT name, type FROM entities WHERE work_id = ?').bind(body.work_id).all<Record<string, unknown>>();
  const entityNames = (entities.results || []).map(e => e.name).join('、');

  const numChapters = body.num_chapters || 5;

  const prompt = `你是一位专业的小说大纲设计师。请为作品《${work.title}》（题材：${work.category || '未指定'}）生成一份 ${numChapters} 章的大纲。

${worldContext ? `世界观设定参考：\n${worldContext.substring(0, 2000)}\n` : ''}
${entityNames ? `已有角色：${entityNames}` : ''}

请按以下 JSON 格式输出（只输出 JSON，不要其他内容）：
{
  "sections": [
    {
      "title": "章节标题（中文，简洁有力）",
      "section_summary": "本章一句话摘要（30字以内）",
      "key_entities": ["涉及的角色名"],
      "hooks": "本章的悬念/钩子",
      "estimated_words": 3000
    }
  ]
}

要求：
- 每章有清晰的起承转合
- 章节之间有递进关系
- 前 3 章建立世界观和人物关系
- 中间章节推进冲突
- 最后章节制造高潮或悬念`;

  const result = await generateWithAI(env, prompt, { maxTokens: 2048 });
  if (!result) {
    return new Response(JSON.stringify(jsonError(ErrorCodes.AI_SERVICE_UNAVAILABLE, 'AI service unavailable')), {
      status: 503, headers: { 'Content-Type': 'application/json' },
    });
  }

  // 解析 AI 返回的 JSON
  let parsed: { sections?: Array<Record<string, unknown>> } = {};
  try {
    const jsonMatch = result.match(/\{[\s\S]*\}/);
    if (jsonMatch) parsed = JSON.parse(jsonMatch[0]);
  } catch {
    return new Response(JSON.stringify(jsonError(ErrorCodes.EXTERNAL_SERVICE_ERROR, 'AI returned invalid JSON')), {
      status: 500, headers: { 'Content-Type': 'application/json' },
    });
  }

  const sections = parsed.sections || [];
  if (sections.length === 0) {
    return new Response(JSON.stringify(jsonError(ErrorCodes.EXTERNAL_SERVICE_ERROR, 'AI returned empty outline')), {
      status: 500, headers: { 'Content-Type': 'application/json' },
    });
  }

  // 写入 D1 sections 表
  const now = new Date().toISOString();
  const createdSections: Record<string, unknown>[] = [];
  let outlineMd = `# 《${work.title}》大纲\n\n`;

  for (let i = 0; i < sections.length; i++) {
    const s = sections[i];
    const sectionId = crypto.randomUUID();
    const title = String(s.title || `第${i + 1}章`);
    const summary = String(s.section_summary || '');
    const r2Key = `works/${body.work_id}/chapters/${sectionId}.md`;

    await env.DB.prepare(`
      INSERT INTO sections (id, work_id, title, order_index, section_summary, r2_object_key, word_count, entities_involved, version, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, 0, '[]', 1, ?, ?)
    `).bind(sectionId, body.work_id, title, i, summary, r2Key, now, now).run();

    outlineMd += `## 第${i + 1}章：${title}\n${summary}\n\n`;

    createdSections.push({
      id: sectionId, title, order_index: i,
      section_summary: summary,
      key_entities: s.key_entities || [],
      hooks: s.hooks || null,
      estimated_words: s.estimated_words || null,
    });
  }

  // 写入 R2 outline.md
  await writeOutline(env, body.work_id, outlineMd);

  return new Response(JSON.stringify(jsonSuccess({ work_id: body.work_id, sections: createdSections })), {
    status: 201, headers: { 'Content-Type': 'application/json' },
  });
}

// GET /api/write/outline/{work_id}
export async function readOutline(env: Env, _request: Request, workId: string): Promise<Response> {
  const sections = await env.DB.prepare(
    'SELECT id, title, order_index, section_summary, word_count, entities_involved, version FROM sections WHERE work_id = ? ORDER BY order_index'
  ).bind(workId).all<Record<string, unknown>>();

  return new Response(JSON.stringify(jsonSuccess({
    work_id: workId,
    sections: (sections.results || []).map(s => ({
      ...s,
      entities_involved: typeof s.entities_involved === 'string' ? JSON.parse(s.entities_involved) : [],
    })),
  })), {
    headers: { 'Content-Type': 'application/json' },
  });
}

// PUT /api/write/outline/{work_id}
export async function updateOutline(env: Env, request: Request, workId: string): Promise<Response> {
  const body = await request.json() as { sections?: Array<{ id?: string; title: string; order_index: number; section_summary?: string }> };
  if (!body.sections || !Array.isArray(body.sections)) {
    return new Response(JSON.stringify(jsonError(ErrorCodes.INVALID_PARAMS, 'sections array is required')), {
      status: 400, headers: { 'Content-Type': 'application/json' },
    });
  }

  const now = new Date().toISOString();

  for (const s of body.sections) {
    if (s.id) {
      await env.DB.prepare(
        'UPDATE sections SET title = ?, order_index = ?, section_summary = ?, updated_at = ? WHERE id = ? AND work_id = ?'
      ).bind(s.title, s.order_index, s.section_summary || null, now, s.id, workId).run();
    } else {
      const sectionId = crypto.randomUUID();
      const r2Key = `works/${workId}/chapters/${sectionId}.md`;
      await env.DB.prepare(`
        INSERT INTO sections (id, work_id, title, order_index, section_summary, r2_object_key, word_count, entities_involved, version, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, 0, '[]', 1, ?, ?)
      `).bind(sectionId, workId, s.title, s.order_index, s.section_summary || null, r2Key, now, now).run();
    }
  }

  return new Response(JSON.stringify(jsonSuccess({ work_id: workId, updated: body.sections.length })), {
    headers: { 'Content-Type': 'application/json' },
  });
}
