// 世界观引擎 — SF-010~016（多语言支持 + JSON 槽位数据）
import { Env } from '../../db/schema';
import { jsonSuccess, jsonError } from '../../lib/response';
import { ErrorCodes } from '../../lib/errors';
import { callAI } from '../../lib/ai';
import { renderTemplate as renderText } from '../../lib/l1/render';
import worldbuildingGenMd from '../../lib/l1/prompts/tools/worldbuilding_gen.md';
import { workContentPath, SUPPORTED_LANGS, DEFAULT_BILINGUAL, extractLang, type Lang, LANG_LABELS } from '../../lib/work_content';
import { renderTemplate, renderTemplateAsJson, extractTemplateJson, type TemplateDef, type R2SlotData } from '../../lib/template';

// ============================================================
// 世界观设定圣经 — 结构化模板定义（单一来源，双语）
// ============================================================

export const BIBLE_TEMPLATE: TemplateDef = {
  title: { zh: '世界观设定圣经', en: 'Setting Bible' },
  intro: {
    zh: '本文件是作品的最高约束文档。所有人物、情节、章节内容必须服从此圣经的规则。\n> 各章节标题为设定框架，内容由作者与 AI 共同填充。可版本化、可回滚。',
    en: 'This document is the supreme constraint for the work. All characters, plots, and chapter content must obey the rules herein.\n> Section headings form the structural framework; content is filled collaboratively by the author and AI. Version-controlled and rollback-capable.',
  },
  sections: [
    {
      heading: { zh: '一、世界规则与边界', en: 'I. World Rules & Boundaries' },
      slots: [
        { id: 'power_system',    level: 1, label: { zh: '力量/技术体系', en: 'Power / Technology System' }, hint: { zh: '描述这个世界的力量来源、等级划分、使用规则与代价', en: 'Describe the source of power, hierarchy, usage rules, and costs in this world' } },
        { id: 'social_structure', level: 2, label: { zh: '社会组织与结构', en: 'Social Organization & Structure' }, hint: { zh: '国家、势力、阶层、家族等社会组织形态', en: 'Nations, factions, classes, clans, and other social structures' } },
        { id: 'taboos_costs',     level: 2, label: { zh: '禁忌与代价', en: 'Taboos & Costs' }, hint: { zh: '世界中不可触碰的禁忌、使用力量的代价', en: 'Untouchable taboos in this world, costs of using power' } },
      ],
    },
    {
      heading: { zh: '二、核心主题与价值观', en: 'II. Core Themes & Values' },
      slots: [
        { id: 'central_thesis',   level: 1, label: { zh: '核心命题', en: 'Central Thesis' }, hint: { zh: '作品要传达的核心思想或问题', en: 'The core idea or question the work seeks to convey' } },
        { id: 'emotional_tone',   level: 2, label: { zh: '情感基调', en: 'Emotional Tone' }, hint: { zh: '整体的情感色彩：黑暗/希望/悲壮/轻松 等', en: 'Overall emotional register: dark / hopeful / tragic / lighthearted, etc.' } },
        { id: 'narrative_stance', level: 2, label: { zh: '叙事立场', en: 'Narrative Stance' }, hint: { zh: '从谁的视角看世界？隐含的价值判断', en: 'Whose perspective shapes the world? Implicit value judgments' } },
      ],
    },
    {
      heading: { zh: '三、角色体系', en: 'III. Character System' },
      slots: [
        { id: 'protagonist',             level: 1, label: { zh: '主角', en: 'Protagonist' }, hint: { zh: '姓名、身份、核心动机、能力边界、成长弧线', en: 'Name, identity, core motivation, ability boundaries, growth arc' } },
        { id: 'supporting_characters',  level: 2, label: { zh: '核心配角', en: 'Key Supporting Characters' }, hint: { zh: '与主角的关系、各自动机、在主线中的作用', en: 'Relationship to protagonist, individual motivations, role in the main plot' } },
        { id: 'relationship_web',       level: 2, label: { zh: '角色关系网', en: 'Character Relationship Web' }, hint: { zh: '角色之间的关键关系（可后续由 M3 人物卡模块细化）', en: 'Key relationships between characters (to be refined by M3 Character Cards)' } },
      ],
    },
    {
      heading: { zh: '四、场景与资源', en: 'IV. Settings & Resources' },
      slots: [
        { id: 'major_locations', level: 2, label: { zh: '主要地点', en: 'Major Locations' }, hint: { zh: '关键场景的地理位置、特征、叙事功能', en: 'Geography, features, and narrative function of key settings' } },
        { id: 'key_items',       level: 2, label: { zh: '关键道具/技能', en: 'Key Items / Artifacts' }, hint: { zh: '可被反复使用的叙事资源（MacGuffin、圣物、核心能力等）', en: 'Reusable narrative resources (MacGuffins, relics, core abilities, etc.)' } },
      ],
    },
    {
      heading: { zh: '五、承诺清单', en: 'V. Promise Checklist' },
      slots: [
        { id: 'promise_checklist', level: 2, label: { zh: '', en: '' }, hint: {
          zh: '列出你对读者的承诺——可以是一条，也可以是多条。每条一句话概括。例如：\n1) 主角终将复仇\n2) 隐藏身份会被揭穿\n3) 两个敌对势力终有一战\n承诺是你与读者之间的契约——一旦写下，后续必须兑现。',
          en: 'List your promises to the reader — one or many. One sentence per promise. For example:\n1) The protagonist will ultimately take revenge\n2) The hidden identity will be exposed\n3) Two enemy factions will clash\nPromises are a contract with your readers — once written, they must be fulfilled.',
        } },
      ],
    },
    {
      heading: { zh: '六、禁区与风格', en: 'VI. Boundaries & Style' },
      slots: [
        { id: 'content_red_lines', level: 1, label: { zh: '内容禁区', en: 'Content Red Lines' }, hint: { zh: '绝对不能触碰的内容主题', en: 'Themes and content that must never be touched' } },
        { id: 'language_style',    level: 2, label: { zh: '语言风格', en: 'Language Style' }, hint: { zh: '叙事语言的风格定位：简洁/华丽/口语化/文学性 等', en: 'Prose style: concise / ornate / colloquial / literary, etc.' } },
        { id: 'pacing_preference', level: 2, label: { zh: '节奏偏好', en: 'Pacing Preference' }, hint: { zh: '快节奏/慢热/张弛有度 等', en: 'Fast-paced / slow-burn / balanced rhythm, etc.' } },
      ],
    },
  ],
  outro: {
    zh: 'M1 自由编辑区',
    en: 'M1 Free editing zone',
  },
};

/** R2 路径 */
function bibleJsonPath(workId: string, lang: Lang) { return workContentPath(workId, lang, 'world_bible.json'); }
function bibleMdPath(workId: string, lang: Lang) { return workContentPath(workId, lang, 'world_bible.md'); }

/** 写 R2 双文件 */
async function writeBible(env: Env, workId: string, lang: Lang, slotData: R2SlotData, renderedMd: string) {
  const json = JSON.stringify(slotData, null, 2);
  await env.WORKS_BUCKET.put(bibleJsonPath(workId, lang), json, { httpMetadata: { contentType: 'application/json' } });
  await env.WORKS_BUCKET.put(bibleMdPath(workId, lang), renderedMd, { httpMetadata: { contentType: 'text/markdown; charset=utf-8' } });
}

/** 从 slot 数据提取约束规则 */
function extractConstraintsFromSlots(slots: Record<string, string>): { section: string; rule: string }[] {
  const constraints: { section: string; rule: string }[] = [];
  // 从 promise_checklist 中提取承诺作为约束
  const promises = slots.promise_checklist || '';
  const lines = promises.split('\n');
  for (const line of lines) {
    const match = line.match(/^\d+[).]\s*(.+)/);
    if (match && match[1].trim().length > 3) {
      constraints.push({ section: '五、承诺清单', rule: match[1].trim() });
    }
  }
  // 从 content_red_lines 提取禁区
  const redLines = slots.content_red_lines || '';
  for (const line of redLines.split('\n')) {
    const match = line.match(/^[-*]\s+(.+)/);
    if (match && match[1].trim().length > 3 && match[1].trim().length < 200) {
      constraints.push({ section: '六、禁区与风格', rule: match[1].trim() });
    }
  }
  return constraints;
}

// ============================================================
// POST /api/write/worldbuilding/generate
// ============================================================

export async function generateWorldbuilding(env: Env, request: Request): Promise<Response> {
  const body = await request.json() as { work_id: string; prompt?: string; style_notes?: string; bilingual?: boolean; langs?: string[] };
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

  const bilingual = body.bilingual ?? true;
  const targetLangs: Lang[] = bilingual
    ? (body.langs?.filter(l => SUPPORTED_LANGS.includes(l as Lang)) as Lang[] || DEFAULT_BILINGUAL)
    : [extractLang(request)];

  // 收集上下文
  const entities = await env.DB.prepare('SELECT name, type, description FROM entities WHERE work_id = ?').bind(body.work_id).all<Record<string, unknown>>();
  const sections = await env.DB.prepare('SELECT title, section_summary FROM sections WHERE work_id = ? ORDER BY order_index LIMIT 3').bind(body.work_id).all<Record<string, unknown>>();

  const entityContext = (entities.results || []).map(e => `- ${e.name}(${e.type}): ${e.description || '暂无描述'}`).join('\n');
  const outlineContext = (sections.results || []).map(s => `- ${s.title}: ${s.section_summary || ''}`).join('\n');

  const results: Record<string, { content: string; constraints: { section: string; rule: string }[] }> = {};

  await Promise.all(targetLangs.map(async (lang) => {
    const templateJson = renderTemplateAsJson(BIBLE_TEMPLATE, lang, 2);
    const langLabel = LANG_LABELS[lang];

    const prompt = renderText(worldbuildingGenMd, {
      work_title: work.title,
      category: work.category || '未指定',
      summary: work.summary || '未提供',
      author_prompt: body.prompt || '无',
      style_notes: body.style_notes || '专业、详细',
      entity_context: entityContext ? `已有角色/实体：\n${entityContext}` : '',
      outline_context: outlineContext ? `已有章节概要：\n${outlineContext}` : '',
      template_json: templateJson,
      lang_label: langLabel,
    });

    const aiResult = await callAI(env, [{ role: 'user', content: prompt }], {
      maxTokens: 4096,
      responseFormat: 'json',
    });

    if (!aiResult?.content) return;

    const parsed = extractTemplateJson(aiResult.content);
    if (!parsed) {
      console.error('[worldbuilding] JSON parse failed for', lang, 'raw:', aiResult.content.substring(0, 200));
      return;
    }

    const slotData: R2SlotData = { slots: parsed.slots };
    const renderedMd = renderTemplate(BIBLE_TEMPLATE, lang, 2, { prefills: parsed.slots, cleanOutput: true });

    await writeBible(env, body.work_id, lang, slotData, renderedMd);

    const constraints = extractConstraintsFromSlots(parsed.slots);
    const constraintsJson = JSON.stringify(constraints, null, 2);
    await env.WORKS_BUCKET.put(workContentPath(body.work_id, lang, 'constraints.json'), constraintsJson, {
      httpMetadata: { contentType: 'application/json' },
    });

    results[lang] = { content: renderedMd, constraints };
  }));

  return new Response(JSON.stringify(jsonSuccess({
    work_id: body.work_id,
    bilingual: targetLangs.length > 1,
    languages: targetLangs,
    results,
  })), {
    headers: { 'Content-Type': 'application/json' },
  });
}

// ============================================================
// GET /api/write/worldbuilding/{work_id}?lang=zh|en
// ============================================================

export async function readWorldbuilding(env: Env, request: Request, workId: string): Promise<Response> {
  // V3: 委托到统一 Module API
  const { getModule } = await import('./module');
  return getModule(env, request, `m1_${workId}`);
}

// ============================================================
// PUT /api/write/worldbuilding/{work_id}?lang=zh|en
// ============================================================

export async function updateWorldbuilding(env: Env, request: Request, workId: string): Promise<Response> {
  // V3: 委托到统一 Module API（三文件物理隔离：.json + .free.md + .md）
  const { updateModule } = await import('./module');
  return updateModule(env, request, `m1_${workId}`);
}

// ============================================================
// GET /api/write/worldbuilding/{work_id}/constraints?lang=zh|en
// ============================================================

export async function readConstraints(env: Env, _request: Request, workId: string): Promise<Response> {
  const lang = extractLang(_request);
  const key = workContentPath(workId, lang, 'constraints.json');
  const obj = await env.WORKS_BUCKET.get(key);
  if (!obj) {
    return new Response(JSON.stringify(jsonSuccess({
      work_id: workId,
      lang,
      constraints: [],
      message: lang === 'en'
        ? 'Constraints not yet extracted. Please generate the Setting Bible first.'
        : '约束尚未提取，请先生成世界观',
    })), {
      headers: { 'Content-Type': 'application/json' },
    });
  }
  const data = await obj.text();
  return new Response(data, {
    headers: { 'Content-Type': 'application/json' },
  });
}
