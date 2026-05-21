// Story Forger — 伏笔账本（SF-023）（多语言 + 规划导向 + 结构化模板）
//
// 设计原则（区别于"AI 扫描已有章节提取伏笔"的反向做法）：
//   伏笔是作者主动设计的暗线。AI 的角色是：
//     1. 帮助作者在写作前基于大纲/世界观规划伏笔网络
//     2. M6 一致性校验时正向检查伏笔是否按计划回收
//   不做：AI 全盘扫描已写好的章节来"发现"伏笔
import { Env } from '../../db/schema';
import { jsonSuccess, jsonError } from '../../lib/response';
import { ErrorCodes } from '../../lib/errors';
import { generateWithAI } from '../../lib/ai';
import { workContentPath, extractLang, readR2WithLangFallback, type Lang, LANG_LABELS } from '../../lib/work_content';
import { renderTemplate, type TemplateDef } from '../../lib/template';

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
    zh: '以下为自由编辑区，可按需添加模板框架之外的内容。',
    en: 'Free editing zone — add any content beyond the template framework here.',
  },
};

function getForeshadowingTemplate(lang: Lang, level?: number): string {
  return renderTemplate(FORESHADOWING_TEMPLATE, lang, level ?? 2);
}

// ============================================================
// POST /api/write/foreshadowing/generate?lang=zh|en
// 规划导向：AI 基于大纲和世界观帮助作者设计伏笔网络
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

  // 收集规划上下文（不是扫描已有章节，而是基于框架做规划）
  let worldContext = '';
  const wb = await env.WORKS_BUCKET.get(workContentPath(body.work_id, lang, 'world_bible.md'));
  if (wb) worldContext = (await wb.text()).substring(0, 2000);

  let outlineContext = '';
  const outline = await env.WORKS_BUCKET.get(workContentPath(body.work_id, lang, 'outline.md'));
  if (outline) outlineContext = (await outline.text()).substring(0, 2000);

  // 已有章节标题（作为规划参考，不扫描内容）
  const sections = await env.DB.prepare(
    'SELECT title, order_index FROM sections WHERE work_id = ? ORDER BY order_index'
  ).bind(body.work_id).all<{ title: string; order_index: number }>();
  const chapterTitles = (sections.results || []).map(s => `第${s.order_index + 1}章「${s.title}」`).join('、');

  const template = getForeshadowingTemplate(lang);

  const prompt = `你是一位资深故事架构师。请帮助作者为作品《${work.title}》设计伏笔网络。

## 伏笔规划原则
- 伏笔是主动设计的暗线，不是写完再找的线索
- 好的伏笔有多阶段发展：埋种→强化→部分揭示→（可选误导）→回收
- 伏笔类型包括：身份伏笔（角色真实身份）、道具伏笔（契诃夫之枪）、对白伏笔（某句话后来获得全新含义）、能力伏笔（隐藏力量）、事件伏笔（看似无关的事件后来串联）、意象伏笔（反复出现的符号）

## 作品信息
题材：${work.category || '未指定'}
${chapterTitles ? `章节结构：${chapterTitles}` : '(尚未规划章节)'}

${worldContext ? `【世界观设定】\n${worldContext}\n` : ''}
${outlineContext ? `【长篇框架】\n${outlineContext}\n` : ''}
${body.style_notes ? `作者备注：${body.style_notes}` : ''}

请按照以下伏笔账本模板结构填入规划内容。模板使用三标记分离格式：每个槽位由 the hint marker（提示文字）+ the slot opening marker（槽位开始）+ the slot closing marker（槽位结束）组成。将内容写在 the slot opening marker 和 the slot closing marker 之间，保留所有标记不变。标题、加粗标签等其他结构保持原样。至少规划 3 条伏笔。
用${langLabel}输出。

输出模板：
${template}`;

  const result = await generateWithAI(env, prompt, { maxTokens: 4096 });
  if (!result) {
    return new Response(JSON.stringify(jsonError(ErrorCodes.AI_SERVICE_UNAVAILABLE, 'AI service unavailable')), {
      status: 503, headers: { 'Content-Type': 'application/json' },
    });
  }

  // 写入 R2（存储 Markdown 格式的伏笔账本，而非 JSON）
  try {
    await env.WORKS_BUCKET.put(workContentPath(body.work_id, lang, 'foreshadowing.md'), result, {
      httpMetadata: { contentType: 'text/markdown; charset=utf-8' },
    });
  } catch (err) {
    console.error('R2 write failed for foreshadowing.md:', body.work_id, lang, err);
  }

  return new Response(JSON.stringify(jsonSuccess({
    work_id: body.work_id,
    lang,
    content: result,
  })), {
    headers: { 'Content-Type': 'application/json' },
  });
}

// ============================================================
// GET /api/write/foreshadowing/{work_id}?lang=zh|en
// 返回伏笔账本内容（Markdown），无内容时返回结构化模板
// ============================================================

export async function readForeshadowing(env: Env, request: Request, workId: string): Promise<Response> {
  const lang = extractLang(request);
  const { content, actualLang } = await readR2WithLangFallback(env, workId, lang, 'foreshadowing.md');
  if (!content) {
    const template = getForeshadowingTemplate(lang);
    return new Response(JSON.stringify(jsonSuccess({
      work_id: workId,
      lang,
      content: template,
      is_template: true,
      message: lang === 'en'
        ? 'Foreshadowing ledger not yet created. Below is the planning template.'
        : '伏笔账本尚未创建，以下为规划模板。',
    })), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify(jsonSuccess({
    work_id: workId,
    lang: actualLang,
    content,
    is_template: false,
  })), {
    headers: { 'Content-Type': 'application/json' },
  });
}

// ============================================================
// PUT /api/write/foreshadowing/{work_id}?lang=zh|en
// 手动编辑伏笔账本
// ============================================================

export async function updateForeshadowing(env: Env, request: Request, workId: string): Promise<Response> {
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

  await env.WORKS_BUCKET.put(workContentPath(workId, lang, 'foreshadowing.md'), body.content, {
    httpMetadata: { contentType: 'text/markdown; charset=utf-8' },
  });

  return new Response(JSON.stringify(jsonSuccess({ work_id: workId, lang, saved: true })), {
    headers: { 'Content-Type': 'application/json' },
  });
}
