// Story Forger — 伏笔账本（SF-023）（多语言 + 规划导向 + JSON 槽位数据）
//
// 设计原则（区别于"AI 扫描已有章节提取伏笔"的反向做法）：
//   伏笔是作者主动设计的暗线。AI 的角色是：
//     1. 帮助作者在写作前基于大纲/世界观规划伏笔网络
//     2. M6 一致性校验时正向检查伏笔是否按计划回收
//   不做：AI 全盘扫描已写好的章节来"发现"伏笔
import { Env } from '../../db/schema';
import { jsonSuccess, jsonError } from '../../lib/response';
import { ErrorCodes } from '../../lib/errors';
import { callAI } from '../../lib/ai';
import { renderTemplate as renderText } from '../../lib/l1/render';
import foreshadowingGenMd from '../../lib/l1/prompts/tools/foreshadowing_gen.md';
import { workContentPath, extractLang, type Lang, LANG_LABELS } from '../../lib/work_content';
import { renderTemplate, renderTemplateAsJson, extractTemplateJson, buildTemplateJson, type TemplateDef, type R2SlotData } from '../../lib/template';

// ============================================================
// 伏笔账本 — 结构化模板定义（单一来源，双语）
// ============================================================

const FORESHADOWING_TEMPLATE: TemplateDef = {
  title: { zh: '伏笔账本', en: 'Foreshadowing Ledger' },
  intro: {
    zh: '伏笔是横跨多个章节的暗线。好的伏笔让读者在回收时恍然大悟。\n> 本文档帮助你在写作前主动规划伏笔网络，而非事后扫描。\n> 每条伏笔条目通过左侧面板独立管理（新增 / 删除），点击条目在右侧编辑。',
    en: 'Foreshadowing is the art of planting clues across chapters. Great foreshadowing makes readers gasp in hindsight.\n> This document helps you proactively plan your foreshadowing network before writing — not scan chapters after the fact.\n> Each hook entry is managed independently via the left panel (add / delete). Click an entry to edit in the right panel.',
  },
  sections: [
    {
      heading: { zh: '一、伏笔策略总览', en: 'I. Foreshadowing Strategy Overview' },
      slots: [
        { id: 'fh_strategy', level: 1, label: { zh: '', en: '' }, hint: { zh: '用一段话描述整部作品的伏笔策略：密集还是稀疏？以什么类型的伏笔为主？', en: 'Describe your overall foreshadowing strategy in a paragraph: dense or sparse? What types dominate?' } },
      ],
    },
  ],
  outro: {
    zh: 'M4 自由编辑区',
    en: 'M4 Free editing zone',
  },
};

/** R2 路径 */
function fhJsonPath(workId: string, lang: Lang) { return workContentPath(workId, lang, 'foreshadowing.json'); }
function fhMdPath(workId: string, lang: Lang) { return workContentPath(workId, lang, 'foreshadowing.md'); }

// ============================================================
// POST /api/write/foreshadowing/generate?lang=zh|en
// ============================================================

export async function generateForeshadowing(env: Env, request: Request): Promise<Response> {
  const body = await request.json() as { work_id: string; style_notes?: string };
  if (!body.work_id) {
    return new Response(JSON.stringify(jsonError(ErrorCodes.MISSING_REQUIRED_FIELD, 'work_id is required')), {
      status: 400, headers: { 'Content-Type': 'application/json' },
    });
  }

  const lang = extractLang(request);
  const langLabel = LANG_LABELS[lang];

  const work = await env.DB.prepare('SELECT id, title, category FROM works WHERE id = ?').bind(body.work_id).first<{ id: string; title: string; category: string }>();
  if (!work) {
    return new Response(JSON.stringify(jsonError(ErrorCodes.WORK_NOT_FOUND, 'Work not found')), {
      status: 404, headers: { 'Content-Type': 'application/json' },
    });
  }

  // 收集规划上下文
  let worldContext = '';
  const wb = await env.WORKS_BUCKET.get(workContentPath(body.work_id, lang, 'world_bible.md'));
  if (wb) worldContext = (await wb.text()).substring(0, 2000);

  let outlineContext = '';
  const outline = await env.WORKS_BUCKET.get(workContentPath(body.work_id, lang, 'outline.md'));
  if (outline) outlineContext = (await outline.text()).substring(0, 2000);

  const sections = await env.DB.prepare(
    'SELECT title, order_index FROM sections WHERE work_id = ? ORDER BY order_index'
  ).bind(body.work_id).all<{ title: string; order_index: number }>();
  const chapterTitles = (sections.results || []).map(s => `第${s.order_index + 1}章「${s.title}」`).join('、');

  const templateJson = renderTemplateAsJson(FORESHADOWING_TEMPLATE, lang, 2);

  const prompt = renderText(foreshadowingGenMd, {
    work_title: work.title,
    world_context_section: worldContext ? `## 世界观参考\n${worldContext}` : '',
    outline_context_section: outlineContext ? `## 大纲参考\n${outlineContext}` : '',
    section_titles_section: chapterTitles ? `## 章节标题\n${chapterTitles}` : '(尚未规划章节)',
    template_json: templateJson,
    lang_label: langLabel,
  });

  const aiResult = await callAI(env, [{ role: 'user', content: prompt }], {
    maxTokens: 4096,
    responseFormat: 'json',
  });

  if (!aiResult?.content) {
    return new Response(JSON.stringify(jsonError(ErrorCodes.AI_SERVICE_UNAVAILABLE, 'AI service unavailable')), {
      status: 503, headers: { 'Content-Type': 'application/json' },
    });
  }

  const parsed = extractTemplateJson(aiResult.content);
  if (!parsed) {
    return new Response(JSON.stringify(jsonError(ErrorCodes.EXTERNAL_SERVICE_ERROR, 'AI returned invalid JSON')), {
      status: 500, headers: { 'Content-Type': 'application/json' },
    });
  }

  const slotData: R2SlotData = { slots: parsed.slots };
  const renderedMd = renderTemplate(FORESHADOWING_TEMPLATE, lang, 2, { prefills: parsed.slots, cleanOutput: true });

  // 写 R2 双文件
  await env.WORKS_BUCKET.put(fhJsonPath(body.work_id, lang), JSON.stringify(slotData, null, 2), {
    httpMetadata: { contentType: 'application/json' },
  });
  await env.WORKS_BUCKET.put(fhMdPath(body.work_id, lang), renderedMd, {
    httpMetadata: { contentType: 'text/markdown; charset=utf-8' },
  });

  const template = buildTemplateJson(FORESHADOWING_TEMPLATE, lang, 2, slotData);

  return new Response(JSON.stringify(jsonSuccess({
    work_id: body.work_id,
    lang,
    template,
    rendered_md: renderedMd,
  })), {
    headers: { 'Content-Type': 'application/json' },
  });
}

// ============================================================
// GET /api/write/foreshadowing/{work_id}?lang=zh|en
// ============================================================

export async function readForeshadowing(env: Env, request: Request, workId: string): Promise<Response> {
  const lang = extractLang(request);

  let slotData: R2SlotData | null = null;
  const jsonObj = await env.WORKS_BUCKET.get(fhJsonPath(workId, lang));
  if (jsonObj) {
    try { slotData = JSON.parse(await jsonObj.text()) as R2SlotData; } catch { /* ignore */ }
  }

  let renderedMd = '';
  const mdObj = await env.WORKS_BUCKET.get(fhMdPath(workId, lang));
  if (mdObj) renderedMd = await mdObj.text();

  if (!slotData && !renderedMd) {
    const emptyMd = renderTemplate(FORESHADOWING_TEMPLATE, lang, 2);
    const template = buildTemplateJson(FORESHADOWING_TEMPLATE, lang, 2, null);
    return new Response(JSON.stringify(jsonSuccess({
      work_id: workId,
      lang,
      template,
      rendered_md: emptyMd,
      is_template: true,
      message: lang === 'en'
        ? 'Foreshadowing ledger not yet created. Below is the planning template.'
        : '伏笔账本尚未创建，以下为规划模板。',
    })), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const template = buildTemplateJson(FORESHADOWING_TEMPLATE, lang, 2, slotData);

  return new Response(JSON.stringify(jsonSuccess({
    work_id: workId,
    lang,
    template,
    rendered_md: renderedMd,
    is_template: false,
  })), {
    headers: { 'Content-Type': 'application/json' },
  });
}

// ============================================================
// PUT /api/write/foreshadowing/{work_id}?lang=zh|en
// ============================================================

export async function updateForeshadowing(env: Env, request: Request, workId: string): Promise<Response> {
  const lang = extractLang(request);
  const body = await request.json() as { slots?: Record<string, string>; free_content?: string };
  if (typeof body.slots !== 'object' || !body.slots) {
    return new Response(JSON.stringify(jsonError(ErrorCodes.MISSING_REQUIRED_FIELD, 'slots object is required')), {
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

  const slotData: R2SlotData = { slots: body.slots };
  if (body.free_content) slotData.free_content = body.free_content;

  let renderedMd = renderTemplate(FORESHADOWING_TEMPLATE, lang, 2, { prefills: body.slots, cleanOutput: true });
  if (body.free_content) {
    renderedMd = renderedMd.replace(/\n---\n[\s\S]*$/, '\n---\n\n' + body.free_content.trim() + '\n');
  }

  await env.WORKS_BUCKET.put(fhJsonPath(workId, lang), JSON.stringify(slotData, null, 2), {
    httpMetadata: { contentType: 'application/json' },
  });
  await env.WORKS_BUCKET.put(fhMdPath(workId, lang), renderedMd, {
    httpMetadata: { contentType: 'text/markdown; charset=utf-8' },
  });

  const template = buildTemplateJson(FORESHADOWING_TEMPLATE, lang, 2, slotData);

  return new Response(JSON.stringify(jsonSuccess({
    work_id: workId, lang, saved: true,
    template,
    rendered_md: renderedMd,
  })), {
    headers: { 'Content-Type': 'application/json' },
  });
}
