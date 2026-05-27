// V3 统一 Module API — M0-M6 所有模块的读写统一入口
// GET  /api/write/module/{module_id}          → 读单个 module
// PUT  /api/write/module/{module_id}          → 写单个 module
// GET  /api/write/modules?work_id=&type=       → 列出某类型的全部 module
// POST /api/write/module/{module_id}/generate  → AI 生成（委托给各 handler）
import { Env } from '../../db/schema';
import { jsonSuccess, jsonError } from '../../lib/response';
import { ErrorCodes } from '../../lib/errors';
import {
  renderTemplate, renderCard, buildTemplateJson, buildCardJson,
  type TemplateDef, type SlotDef, type R2SlotData,
} from '../../lib/template';
import { workContentPath, extractLang, type Lang } from '../../lib/work_content';
import { BIBLE_TEMPLATE } from './worldbuilding';
import { OUTLINE_TEMPLATE } from './outline';
import { CHARACTER_TEMPLATE } from './character_card';
import { FORESHADOWING_TEMPLATE } from './foreshadowing';
import { FORESHADOWING_CARD_SLOTS } from './foreshadowing_card';
// generate handlers — 按 type 委托
import { generateWorldbuilding } from './worldbuilding';
import { generateOutline } from './outline';
import { generateDraft } from './draft';
import { generateForeshadowing } from './foreshadowing';

// ============================================================
// M0 / M6 单槽位模板 — 纯文本视为单槽位，与 slot editor 完全统一
// ============================================================
const ORIGINAL_CONCEPT_TEMPLATE: TemplateDef = {
  title: { zh: '原始构想', en: 'Original Concept' },
  intro: {
    zh: '写下你最初的故事构想、灵感来源、想要探索的主题。这是所有后续创作的起点。',
    en: 'Write down your initial story concept, sources of inspiration, and themes you want to explore. This is the seed for all subsequent creation.',
  },
  sections: [{
    heading: { zh: '核心构想', en: 'Core Concept' },
    slots: [
      { id: 'content', level: 1, label: { zh: '', en: '' }, hint: {
        zh: '在此自由书写你的原始构想：故事的核心创意、世界观设定、人物关系、情节走向……不必拘泥于格式',
        en: 'Write your original concept freely: core story ideas, world setting, character relationships, plot directions... No format constraints.',
      } },
    ],
  }],
  outro: { zh: 'M0 自由编辑区', en: 'M0 Free editing zone' },
};

const CHAPTER_TEMPLATE: TemplateDef = {
  title: { zh: '章节正文', en: 'Chapter Content' },
  intro: {
    zh: '在此撰写章节正文。左侧可参考大纲和意图卡。',
    en: 'Write the chapter body here. Reference the outline and intent card in the left panel.',
  },
  sections: [{
    heading: { zh: '正文', en: 'Body' },
    slots: [
      { id: 'content', level: 1, label: { zh: '', en: '' }, hint: {
        zh: '在此撰写章节正文内容',
        en: 'Write your chapter content here',
      } },
    ],
  }],
  outro: { zh: 'M6 自由编辑区', en: 'M6 Free editing zone' },
};

// ============================================================
// INTENT_TEMPLATE — M5 意图卡模板（14 个 slot）
// ============================================================
const INTENT_TEMPLATE: TemplateDef = {
  title: { zh: '章节意图卡', en: 'Chapter Intent Card' },
  intro: {
    zh: '每章写作前的创作意图规划。定义本章要推进什么冲突、揭示什么信息、制造什么悬念。',
    en: 'Creative intent planning before writing each chapter.',
  },
  sections: [{
    heading: { zh: '创作意图', en: 'Writing Intent' },
    slots: [
      { id: 'goal_advance_conflict', level: 1, label: { zh: '推进冲突', en: 'Advance Conflict' }, hint: { zh: '推进哪条剧情线（对应 M2 框架中的阶段/转折点）', en: 'Which plot line to advance' } },
      { id: 'goal_reveal_info',      level: 1, label: { zh: '揭示信息', en: 'Reveal Info' }, hint: { zh: '本章要交代什么信息给读者', en: 'What info to reveal to readers' } },
      { id: 'goal_create_suspense',  level: 1, label: { zh: '制造悬念', en: 'Create Suspense' }, hint: { zh: '本章要制造什么悬念', en: 'What suspense to create' } },
      { id: 'emotional_goal',       level: 1, label: { zh: '情绪目标', en: 'Emotional Goal' }, hint: { zh: '希望读者产生什么情绪', en: 'Desired emotional response' } },
      { id: 'pov_character',        level: 1, label: { zh: '视角角色', en: 'POV Character' }, hint: { zh: '本章以谁的视角展开', en: 'Whose POV' } },
      { id: 'pov_strategy',         level: 2, label: { zh: '视角策略', en: 'POV Strategy' }, hint: { zh: '固定单一/多线交替/不可靠叙述者/全知', en: 'Single/multi/unreliable/omniscient' } },
      { id: 'scene_type',           level: 2, label: { zh: '场景类型', en: 'Scene Type' }, hint: { zh: 'Wonder/一切尽失/终场/认知冲击', en: 'Scene type' } },
      { id: 'structure_opening',    level: 1, label: { zh: '开篇钩子', en: 'Opening Hook' }, hint: { zh: '用什么抓住读者', en: 'What hooks the reader' } },
      { id: 'structure_reversal',   level: 2, label: { zh: '反转点',   en: 'Reversal Point' }, hint: { zh: '本章的意外/转折', en: 'Twist or turning point' } },
      { id: 'structure_cliffhanger',level: 1, label: { zh: '章末卡点', en: 'Cliffhanger' }, hint: { zh: '用什么让读者想继续读下一章', en: 'End-of-chapter hook' } },
      { id: 'foreshadowing_triggered', level: 2, label: { zh: '伏笔触发', en: 'Foreshadowing Triggered' }, hint: { zh: '格式: hook_id:action', en: 'Format: hook_id:action' } },
      { id: 'characters_involved',  level: 1, label: { zh: '出场人物', en: 'Characters Involved' }, hint: { zh: '逗号分隔的角色名或 ID', en: 'Comma-separated character names' } },
      { id: 'estimated_words',      level: 2, label: { zh: '预估字数', en: 'Estimated Words' }, hint: { zh: '本章预估字数', en: 'Estimated word count' } },
      { id: 'style_notes',          level: 2, label: { zh: '风格备注', en: 'Style Notes' }, hint: { zh: '本章的特殊风格要求', en: 'Special style notes' } },
    ],
  }],
  outro: { zh: 'M5 自由编辑区', en: 'M5 Free editing zone' },
};

// ============================================================
// type → 模板 + R2 key 映射
// ============================================================
interface ModuleConfig {
  tmpl: TemplateDef;              // 模板定义（所有 type 都有模板）
  isCard: boolean;                 // 卡片模式（buildCardJson）
  cardSlots?: SlotDef[];           // 卡片槽位（仅 isCard 时）
  jsonKeyFromModule: (m: { id: string; r2_json_key?: string | null }) => string;
  mdKeyFromModule: (m: { id: string; r2_md_key?: string | null }) => string;
}

const MODULE_CONFIG: Record<string, ModuleConfig> = {
  m0: {
    tmpl: ORIGINAL_CONCEPT_TEMPLATE, isCard: false,
    jsonKeyFromModule: () => 'original_concept.json',
    mdKeyFromModule: () => 'original_concept.md',
  },
  m1: {
    tmpl: BIBLE_TEMPLATE, isCard: false,
    jsonKeyFromModule: () => 'world_bible.json',
    mdKeyFromModule: () => 'world_bible.md',
  },
  m2: {
    tmpl: OUTLINE_TEMPLATE, isCard: false,
    jsonKeyFromModule: () => 'outline.json',
    mdKeyFromModule: () => 'outline.md',
  },
  m3_card: {
    tmpl: CHARACTER_TEMPLATE, isCard: false,
    jsonKeyFromModule: (m) => `characters/${m.id.replace('m3_card_', '')}.json`,
    mdKeyFromModule: (m) => `characters/${m.id.replace('m3_card_', '')}.md`,
  },
  m4_strategy: {
    tmpl: FORESHADOWING_TEMPLATE, isCard: false,
    jsonKeyFromModule: () => 'foreshadowing.json',
    mdKeyFromModule: () => 'foreshadowing.md',
  },
  m4_card: {
    tmpl: null!, isCard: true, cardSlots: FORESHADOWING_CARD_SLOTS,
    jsonKeyFromModule: (m) => `foreshadowing/${m.id.replace('m4_card_', '')}.json`,
    mdKeyFromModule: (m) => `foreshadowing/${m.id.replace('m4_card_', '')}.md`,
  },
  m5_intent: {
    tmpl: INTENT_TEMPLATE, isCard: false,
    jsonKeyFromModule: (m) => `intents/${m.id.replace('m5_intent_', '')}.json`,
    mdKeyFromModule: () => '',
  },
  m6_chapter: {
    tmpl: CHAPTER_TEMPLATE, isCard: false,
    jsonKeyFromModule: (m) => `chapters/${m.id.replace('m6_chapter_', '')}.json`,
    mdKeyFromModule: (m) => `chapters/${m.id.replace('m6_chapter_', '')}.md`,
  },
};

// ============================================================
// M5 intent ↔ slots 转换
// ============================================================
// 旧 intent JSON（嵌套格式）→ 平铺 slots
function intentToSlots(intent: Record<string, unknown>): Record<string, string> {
  const slots: Record<string, string> = {};
  const goal = intent.goal as Record<string, string> | undefined;
  if (goal) {
    if (goal.advance_conflict) slots.goal_advance_conflict = goal.advance_conflict;
    if (goal.reveal_info) slots.goal_reveal_info = goal.reveal_info;
    if (goal.create_suspense) slots.goal_create_suspense = goal.create_suspense;
  }
  const structure = intent.structure as Record<string, string> | undefined;
  if (structure) {
    if (structure.opening_hook) slots.structure_opening = structure.opening_hook;
    if (structure.reversal_point) slots.structure_reversal = structure.reversal_point;
    if (structure.cliffhanger) slots.structure_cliffhanger = structure.cliffhanger;
  }
  if (intent.emotional_goal) slots.emotional_goal = String(intent.emotional_goal);
  if (intent.pov_character) slots.pov_character = String(intent.pov_character);
  if (intent.pov_strategy) slots.pov_strategy = String(intent.pov_strategy);
  if (intent.scene_type) slots.scene_type = String(intent.scene_type);
  if (intent.style_notes) slots.style_notes = String(intent.style_notes);
  if (intent.estimated_words) slots.estimated_words = String(intent.estimated_words);
  // 数组字段 → 逗号分隔字符串
  const fh = intent.foreshadowing_triggered as Array<{ hook_id: string; action: string }> | undefined;
  if (fh?.length) slots.foreshadowing_triggered = fh.map(x => `${x.hook_id}:${x.action}`).join(', ');
  const chars = intent.characters_involved as string[] | undefined;
  if (chars?.length) slots.characters_involved = chars.join(', ');
  return slots;
}

// 平铺 slots → 嵌套 intent JSON
function slotsToIntent(slots: Record<string, string>, freeContent?: string): Record<string, unknown> {
  const intent: Record<string, unknown> = {};
  // goal 嵌套
  const goal: Record<string, string> = {};
  if (slots.goal_advance_conflict) goal.advance_conflict = slots.goal_advance_conflict;
  if (slots.goal_reveal_info) goal.reveal_info = slots.goal_reveal_info;
  if (slots.goal_create_suspense) goal.create_suspense = slots.goal_create_suspense;
  if (Object.keys(goal).length > 0) intent.goal = goal;
  // structure 嵌套
  const structure: Record<string, string> = {};
  if (slots.structure_opening) structure.opening_hook = slots.structure_opening;
  if (slots.structure_reversal) structure.reversal_point = slots.structure_reversal;
  if (slots.structure_cliffhanger) structure.cliffhanger = slots.structure_cliffhanger;
  if (Object.keys(structure).length > 0) intent.structure = structure;
  // 平铺字段
  if (slots.emotional_goal) intent.emotional_goal = slots.emotional_goal;
  if (slots.pov_character) intent.pov_character = slots.pov_character;
  if (slots.pov_strategy) intent.pov_strategy = slots.pov_strategy;
  if (slots.scene_type) intent.scene_type = slots.scene_type;
  if (slots.style_notes) intent.style_notes = slots.style_notes;
  if (slots.estimated_words) intent.estimated_words = parseInt(String(slots.estimated_words), 10) || null;
  // 数组字段
  const fhRaw = slots.foreshadowing_triggered;
  if (fhRaw) {
    intent.foreshadowing_triggered = fhRaw.split(/[,;，；]/).map(s => {
      const pair = s.trim().split(':');
      return { hook_id: (pair[0] || '').trim(), action: (pair[1] || 'plant').trim() };
    }).filter(x => x.hook_id);
  }
  const charsRaw = slots.characters_involved;
  if (charsRaw) intent.characters_involved = charsRaw.split(/[,;，；]/).map(s => s.trim()).filter(Boolean);
  if (freeContent) intent.free_content = freeContent;
  return intent;
}

// ============================================================
// R2 读写辅助
// ============================================================
function r2Path(workId: string, lang: Lang, relKey: string): string {
  if (!relKey) return '';
  return workContentPath(workId, lang, relKey);
}

async function readR2Json(env: Env, key: string): Promise<R2SlotData | null> {
  if (!key) return null;
  try {
    const obj = await env.WORKS_BUCKET.get(key);
    if (!obj) return null;
    return JSON.parse(await obj.text()) as R2SlotData;
  } catch { return null; }
}

async function readR2Text(env: Env, key: string): Promise<string> {
  if (!key) return '';
  try {
    const obj = await env.WORKS_BUCKET.get(key);
    return obj ? await obj.text() : '';
  } catch { return ''; }
}

// ============================================================
// GET /api/write/module/{module_id}
// ============================================================
export async function getModule(env: Env, request: Request, moduleId: string): Promise<Response> {
  const mod = await env.DB.prepare(
    'SELECT id, work_id, type, name, order_index, status, r2_json_key, r2_md_key FROM modules WHERE id = ?'
  ).bind(moduleId).first<{
    id: string; work_id: string; type: string; name: string;
    order_index: number; status: string;
    r2_json_key: string | null; r2_md_key: string | null;
  }>();

  if (!mod) {
    return new Response(JSON.stringify(jsonError(ErrorCodes.NOT_FOUND, 'Module not found')), {
      status: 404, headers: { 'Content-Type': 'application/json' },
    });
  }

  const lang = extractLang(request);
  const cfg = MODULE_CONFIG[mod.type];
  if (!cfg) {
    return new Response(JSON.stringify(jsonError(ErrorCodes.INTERNAL_ERROR, `Unknown module type: ${mod.type}`)), {
      status: 500, headers: { 'Content-Type': 'application/json' },
    });
  }

  const jsonKey = r2Path(mod.work_id, lang, cfg.jsonKeyFromModule(mod));
  const mdKey = r2Path(mod.work_id, lang, cfg.mdKeyFromModule(mod));

  // M5 intent 特殊处理：读取嵌套 JSON → 平铺 slots
  if (mod.type === 'm5_intent') {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rawObj: any = await readR2Json(env, jsonKey);
    let slotData: R2SlotData;
    if (rawObj && rawObj.slots) {
      slotData = rawObj as R2SlotData;
    } else if (rawObj) {
      slotData = { slots: intentToSlots(rawObj as Record<string, unknown>) };
      if (rawObj.free_content) {
        slotData.free_content = String(rawObj.free_content);
      }
    } else {
      slotData = { slots: {} };
    }
    const template = buildTemplateJson(INTENT_TEMPLATE, lang, 2, slotData);
    const renderedMd = renderTemplate(INTENT_TEMPLATE, lang, 2, {
      prefills: slotData.slots, cleanOutput: true,
    });

    return new Response(JSON.stringify(jsonSuccess({
      module_id: mod.id, work_id: mod.work_id, type: mod.type,
      name: mod.name, order_index: mod.order_index, status: mod.status,
      editor_type: 'slot',
      template,
      slots: slotData.slots,
      free_content: slotData.free_content || '',
      rendered_md: renderedMd,
      is_template: !rawObj,
    })), { headers: { 'Content-Type': 'application/json' } });
  }

  // 卡片模式（M4_card）
  if (cfg.isCard && cfg.cardSlots) {
    const slotData = await readR2Json(env, jsonKey);
    const md = await readR2Text(env, mdKey);
    const cardJson = buildCardJson(mod.name, cfg.cardSlots, lang, 2, slotData);

    return new Response(JSON.stringify(jsonSuccess({
      module_id: mod.id, work_id: mod.work_id, type: mod.type,
      name: mod.name, order_index: mod.order_index, status: mod.status,
      editor_type: 'slot',
      is_card: true,
      card: cardJson,
      slots: slotData?.slots || {},
      free_content: slotData?.free_content || '',
      rendered_md: md,
      is_template: !slotData && !md,
    })), { headers: { 'Content-Type': 'application/json' } });
  }

  // 槽位编辑器模式（M0, M1, M2, M3_card, M4_strategy, M6）
  let slotData = await readR2Json(env, jsonKey);
  const md = await readR2Text(env, mdKey);

  // 旧数据兼容：仅有 .md 无 .json 时，将 md 内容作为 content slot
  if (!slotData && md && jsonKey) {
    slotData = { slots: { content: md } };
  }

  if (!slotData && !md) {
    // 完全空模板
    const name = cfg.tmpl ? (mod.type === 'm3_card' ? mod.name : undefined) : undefined;
    const emptyMd = renderTemplate(cfg.tmpl, lang, 2, { name, cleanOutput: true });
    const template = buildTemplateJson(cfg.tmpl, lang, 2, null);
    return new Response(JSON.stringify(jsonSuccess({
      module_id: mod.id, work_id: mod.work_id, type: mod.type,
      name: mod.name, order_index: mod.order_index, status: mod.status,
      editor_type: 'slot',
      template,
      slots: {},
      free_content: '',
      rendered_md: emptyMd,
      is_template: true,
    })), { headers: { 'Content-Type': 'application/json' } });
  }

  const name = (mod.type === 'm3_card') ? mod.name : undefined;
  const template = buildTemplateJson(cfg.tmpl, lang, 2, slotData);
  return new Response(JSON.stringify(jsonSuccess({
    module_id: mod.id, work_id: mod.work_id, type: mod.type,
    name: mod.name, order_index: mod.order_index, status: mod.status,
    editor_type: 'slot',
    template,
    slots: slotData?.slots || {},
    free_content: slotData?.free_content || '',
    rendered_md: md,
    is_template: false,
  })), { headers: { 'Content-Type': 'application/json' } });
}

// ============================================================
// PUT /api/write/module/{module_id}
// ============================================================
export async function updateModule(env: Env, request: Request, moduleId: string): Promise<Response> {
  const mod = await env.DB.prepare(
    'SELECT id, work_id, type, name, r2_json_key, r2_md_key FROM modules WHERE id = ?'
  ).bind(moduleId).first<{
    id: string; work_id: string; type: string; name: string;
    r2_json_key: string | null; r2_md_key: string | null;
  }>();

  if (!mod) {
    return new Response(JSON.stringify(jsonError(ErrorCodes.NOT_FOUND, 'Module not found')), {
      status: 404, headers: { 'Content-Type': 'application/json' },
    });
  }

  const lang = extractLang(request);
  const cfg = MODULE_CONFIG[mod.type];
  if (!cfg) {
    return new Response(JSON.stringify(jsonError(ErrorCodes.INTERNAL_ERROR, `Unknown module type: ${mod.type}`)), {
      status: 500, headers: { 'Content-Type': 'application/json' },
    });
  }

  const body = await request.json() as { slots?: Record<string, string>; free_content?: string };

  // M5 intent 特殊处理：平铺 slots → 嵌套 JSON
  if (mod.type === 'm5_intent') {
    const intentObj = slotsToIntent(body.slots || {}, body.free_content);
    intentObj.work_id = mod.work_id;
    intentObj.section_id = mod.id.replace('m5_intent_', '');
    const jsonKey = r2Path(mod.work_id, lang, cfg.jsonKeyFromModule(mod));
    await env.WORKS_BUCKET.put(jsonKey, JSON.stringify(intentObj, null, 2), {
      httpMetadata: { contentType: 'application/json' },
    });
    await touchModule(env, moduleId);

    const slotData: R2SlotData = { slots: body.slots || {} };
    if (body.free_content) slotData.free_content = body.free_content;
    const renderedMd = renderTemplate(INTENT_TEMPLATE, lang, 2, {
      prefills: slotData.slots, cleanOutput: true,
    });
    const template = buildTemplateJson(INTENT_TEMPLATE, lang, 2, slotData);

    return new Response(JSON.stringify(jsonSuccess({
      module_id: moduleId, lang, saved: true,
      template,
      slots: slotData.slots,
      free_content: slotData.free_content || '',
      rendered_md: renderedMd,
    })), { headers: { 'Content-Type': 'application/json' } });
  }

  // 槽位编辑器 / 卡片模式
  const slots = (body.slots && typeof body.slots === 'object') ? body.slots : {};
  if (Object.keys(slots).length === 0 && !body.free_content) {
    return new Response(JSON.stringify(jsonError(ErrorCodes.MISSING_REQUIRED_FIELD, 'slots or free_content is required')), {
      status: 400, headers: { 'Content-Type': 'application/json' },
    });
  }

  const slotData: R2SlotData = { slots };
  if (body.free_content) slotData.free_content = body.free_content;

  const jsonKey = r2Path(mod.work_id, lang, cfg.jsonKeyFromModule(mod));
  const mdKey = r2Path(mod.work_id, lang, cfg.mdKeyFromModule(mod));

  // 写入 R2 JSON
  if (jsonKey) {
    await env.WORKS_BUCKET.put(jsonKey, JSON.stringify(slotData, null, 2), {
      httpMetadata: { contentType: 'application/json' },
    });
  }

  // 渲染并写入 R2 MD
  let renderedMd = '';
  if (cfg.isCard && cfg.cardSlots && mdKey) {
    renderedMd = renderCardOnly(mod.name, cfg.cardSlots, lang, 2, slots, body.free_content);
    await env.WORKS_BUCKET.put(mdKey, renderedMd, {
      httpMetadata: { contentType: 'text/markdown; charset=utf-8' },
    });
  } else if (cfg.tmpl && mdKey) {
    const name = (mod.type === 'm3_card') ? mod.name : undefined;
    renderedMd = renderTemplate(cfg.tmpl, lang, 2, { name, prefills: slots, cleanOutput: true });
    if (body.free_content) {
      renderedMd = renderedMd.replace(/\n---\n[\s\S]*$/, '\n---\n\n' + body.free_content.trim() + '\n');
    }
    await env.WORKS_BUCKET.put(mdKey, renderedMd, {
      httpMetadata: { contentType: 'text/markdown; charset=utf-8' },
    });
  }

  await touchModule(env, moduleId);

  // 构建响应
  if (cfg.isCard && cfg.cardSlots) {
    const cardJson = buildCardJson(mod.name, cfg.cardSlots, lang, 2, slotData);
    return new Response(JSON.stringify(jsonSuccess({
      module_id: moduleId, lang, saved: true,
      is_card: true,
      card: cardJson,
      slots: slotData.slots,
      free_content: slotData.free_content || '',
      rendered_md: renderedMd,
    })), { headers: { 'Content-Type': 'application/json' } });
  }

  const name = (mod.type === 'm3_card') ? mod.name : undefined;
  const template = buildTemplateJson(cfg.tmpl, lang, 2, slotData);
  return new Response(JSON.stringify(jsonSuccess({
    module_id: moduleId, lang, saved: true,
    template,
    slots: slotData.slots,
    free_content: slotData.free_content || '',
    rendered_md: renderedMd,
  })), { headers: { 'Content-Type': 'application/json' } });
}

// ============================================================
// GET /api/write/modules?work_id=X&type=m3_card
// ============================================================
export async function listModules(env: Env, request: Request): Promise<Response> {
  const url = new URL(request.url);
  const workId = url.searchParams.get('work_id');
  const type = url.searchParams.get('type');

  if (!workId) {
    return new Response(JSON.stringify(jsonError(ErrorCodes.MISSING_REQUIRED_FIELD, 'work_id is required')), {
      status: 400, headers: { 'Content-Type': 'application/json' },
    });
  }

  let query = 'SELECT id, type, name, order_index, status FROM modules WHERE work_id = ?';
  const bindings: string[] = [workId];
  if (type) {
    query += ' AND type = ?';
    bindings.push(type);
  }
  query += ' ORDER BY order_index ASC, name ASC';

  const result = await env.DB.prepare(query).bind(...bindings).all<{
    id: string; type: string; name: string; order_index: number; status: string;
  }>();

  return new Response(JSON.stringify(jsonSuccess({
    work_id: workId,
    type: type || null,
    modules: result.results || [],
  })), { headers: { 'Content-Type': 'application/json' } });
}

// ============================================================
// POST /api/write/module/{module_id}/generate
// ============================================================
export async function generateModule(env: Env, request: Request, moduleId: string): Promise<Response> {
  const mod = await env.DB.prepare(
    'SELECT id, work_id, type FROM modules WHERE id = ?'
  ).bind(moduleId).first<{ id: string; work_id: string; type: string }>();

  if (!mod) {
    return new Response(JSON.stringify(jsonError(ErrorCodes.NOT_FOUND, 'Module not found')), {
      status: 404, headers: { 'Content-Type': 'application/json' },
    });
  }

  // 按 type 委托给现有 generate handler
  switch (mod.type) {
    case 'm1':
      return generateWorldbuilding(env, request);
    case 'm2':
      return generateOutline(env, request);
    case 'm4_strategy':
      return generateForeshadowing(env, request);
    case 'm5_intent':
    case 'm6_chapter': {
      // 改写 body，注入 section_id
      const body = await request.clone().json() as Record<string, unknown>;
      body.section_id = mod.id.replace(/^m[56]_(intent|chapter)_/, '');
      const newReq = new Request(request.url, {
        method: 'POST',
        headers: request.headers,
        body: JSON.stringify(body),
      });
      return generateDraft(env, newReq);
    }
    default:
      return new Response(JSON.stringify(jsonError(ErrorCodes.NOT_FOUND, `Generate not supported for type: ${mod.type}`)), {
        status: 400, headers: { 'Content-Type': 'application/json' },
      });
  }
}

// ============================================================
// 内部辅助
// ============================================================
async function touchModule(env: Env, moduleId: string): Promise<void> {
  const now = new Date().toISOString();
  await env.DB.prepare(
    'UPDATE modules SET status = CASE WHEN status = \'empty\' THEN \'in_progress\' ELSE status END, updated_at = ? WHERE id = ?'
  ).bind(now, moduleId).run();
}

// renderCard 包装：拼接自由编辑区
function renderCardOnly(
  name: string, slots: SlotDef[], lang: Lang, userLevel: number,
  prefills: Record<string, string>, freeContent?: string,
): string {
  let md = renderCard(name, slots, lang, userLevel, prefills, true);
  if (freeContent) {
    md = md.replace(/\n---\n[\s\S]*$/, '\n---\n\n' + freeContent.trim() + '\n');
  }
  return md;
}
