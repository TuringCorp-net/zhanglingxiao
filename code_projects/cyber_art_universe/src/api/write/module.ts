// V3 统一 Module API — M0-M6 所有模块的读写统一入口
// GET  /api/write/module/{module_id}          → 读单个 module
// PUT  /api/write/module/{module_id}          → 写单个 module
// GET  /api/write/modules?work_id=&type=       → 列出某类型的全部 module
// POST /api/write/module/{module_id}/generate  → AI 生成（委托给各 handler）
//
// 存储隔离：slots → .json（Story Elf 维护），free_content → .free.md（人类/Agent 自由写）
// 两个文件物理隔离，free_content 的写入永远不会覆盖结构化 slot 数据。
import { Env } from '../../db/schema';
import { jsonSuccess, jsonError } from '../../lib/response';
import { ErrorCodes } from '../../lib/errors';
import {
  renderTemplate, renderCard, buildTemplateJson, buildCardJson,
  type TemplateDef, type SlotDef, type R2SlotData,
} from '../../lib/l1/template';
import { workContentPath, extractLang, type Lang } from '../../lib/l1/work-content';
import { createSnapshot, listVersions } from '../../lib/l1/version';
import { diffVersions as diffModVersions, diffWithCurrent, type DiffResult } from '../../lib/l1/diff';
import { BIBLE_TEMPLATE } from './worldbuilding';
import { OUTLINE_TEMPLATE } from './outline';
import { CHARACTER_TEMPLATE } from './character_card';
import { FORESHADOWING_TEMPLATE } from './foreshadowing';
import { FORESHADOWING_CARD_SLOTS } from './foreshadowing_card';

// ============================================================
// 模板定义
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
  tmpl: TemplateDef;
  isCard: boolean;
  cardSlots?: SlotDef[];
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
    mdKeyFromModule: (m) => `intents/${m.id.replace('m5_intent_', '')}.md`,
  },
  m6_chapter: {
    tmpl: CHAPTER_TEMPLATE, isCard: false,
    jsonKeyFromModule: (m) => `chapters/${m.id.replace('m6_chapter_', '')}.json`,
    mdKeyFromModule: (m) => `chapters/${m.id.replace('m6_chapter_', '')}.md`,
  },
};

// ============================================================
// R2 路径 & 读写辅助
// ============================================================
function r2Path(workId: string, lang: Lang, relKey: string): string {
  if (!relKey) return '';
  return workContentPath(workId, lang, relKey);
}

/** free_content 独立文件路径：.json → .free.md */
function freeKeyFromJsonKey(jsonRelKey: string): string {
  if (!jsonRelKey) return '';
  return jsonRelKey.replace(/\.json$/, '.free.md');
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

  const jsonRelKey = cfg.jsonKeyFromModule(mod);
  const mdRelKey = cfg.mdKeyFromModule(mod);
  const jsonKey = r2Path(mod.work_id, lang, jsonRelKey);
  const mdKey = r2Path(mod.work_id, lang, mdRelKey);
  const freeKey = r2Path(mod.work_id, lang, freeKeyFromJsonKey(jsonRelKey));

  // 并发读取 slots + free_content（物理隔离，互不影响）
  const [slotData, md, freeContent] = await Promise.all([
    readR2Json(env, jsonKey),
    readR2Text(env, mdKey),
    readR2Text(env, freeKey),
  ]);

  // 卡片模式（M4_card）
  if (cfg.isCard && cfg.cardSlots) {
    const cardJson = buildCardJson(mod.name, cfg.cardSlots, lang, 2, slotData);
    return new Response(JSON.stringify(jsonSuccess({
      module_id: mod.id, work_id: mod.work_id, type: mod.type,
      name: mod.name, order_index: mod.order_index, status: mod.status,
      editor_type: 'slot',
      is_card: true,
      card: cardJson,
      slots: slotData?.slots || {},
      free_content: freeContent,
      rendered_md: md,
      is_template: !slotData && !md && !freeContent,
    })), { headers: { 'Content-Type': 'application/json' } });
  }

  // 槽位编辑器模式（M0, M1, M2, M3_card, M4_strategy, M6）
  let resolvedSlotData = slotData;
  // 旧数据兼容：仅有 .md 无 .json 时，将 md 内容作为 content slot
  if (!resolvedSlotData && md && jsonKey) {
    resolvedSlotData = { slots: { content: md } };
  }

  if (!resolvedSlotData && !md && !freeContent) {
    const name = (mod.type === 'm3_card') ? mod.name : undefined;
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
  const template = buildTemplateJson(cfg.tmpl, lang, 2, resolvedSlotData);
  // rendered_md 不含 free_content — 前端自行在自由编辑区渲染
  const renderedMd = md || (cfg.tmpl ? renderTemplate(cfg.tmpl, lang, 2, {
    name, prefills: resolvedSlotData?.slots || {}, cleanOutput: true,
  }) : '');

  return new Response(JSON.stringify(jsonSuccess({
    module_id: mod.id, work_id: mod.work_id, type: mod.type,
    name: mod.name, order_index: mod.order_index, status: mod.status,
    editor_type: 'slot',
    template,
    slots: resolvedSlotData?.slots || {},
    free_content: freeContent,
    rendered_md: renderedMd,
    is_template: false,
  })), { headers: { 'Content-Type': 'application/json' } });
}

// ============================================================
// PUT /api/write/module/{module_id}
// slots → .json（Story Elf 维护），free_content → .free.md（人类/Agent 自由写）
// 两个文件物理隔离，永远不会互相覆盖
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

  const body = await request.json() as {
    slots?: Record<string, string>;
    free_content?: string;
    _prev_slots?: Record<string, string>;     // V4: 前端缓存中的旧 slots
    _prev_free_content?: string;               // V4: 前端缓存中的旧 free_content
  };
  const hasSlots = body.slots && typeof body.slots === 'object' && Object.keys(body.slots).length > 0;
  const hasFreeContent = body.free_content !== undefined;

  if (!hasSlots && !hasFreeContent) {
    return new Response(JSON.stringify(jsonError(ErrorCodes.MISSING_REQUIRED_FIELD, 'slots or free_content is required')), {
      status: 400, headers: { 'Content-Type': 'application/json' },
    });
  }

  // 校验 slot ID：过滤掉模板中不存在的 slot_id，仅写入有效部分
  // 不硬拒绝整个请求——让 LLM 看到反馈后自行纠正
  let slotWarnings: string[] = [];
  if (hasSlots && body.slots) {
    const validIds = new Set<string>();
    if (cfg.isCard && cfg.cardSlots) {
      cfg.cardSlots.forEach(s => validIds.add(s.id));
    } else if (cfg.tmpl) {
      cfg.tmpl.sections.forEach(sec => sec.slots.forEach(s => validIds.add(s.id)));
    }
    if (validIds.size > 0) {
      const unknown = Object.keys(body.slots).filter(id => !validIds.has(id));
      if (unknown.length > 0) {
        const suggestions = unknown.map(id => {
          // 尝试找相似的有效 ID
          const similar = [...validIds].find(vid => vid.includes(id.substring(0, 3)) || id.includes(vid.substring(0, 3)));
          return similar ? `"${id}" → 建议使用 "${similar}"` : `"${id}"`;
        });
        slotWarnings = [
          `⚠️ 以下 ${unknown.length} 个槽位 ID 不属于 ${mod.type} 模板，已跳过：`,
          ...suggestions.map(s => `  - ${s}`),
          `💡 请调用 get_writing_guide("${mod.type}") 获取精确的 slot_id 后重新写入这些内容。`,
        ];
        // 移除无效 slot，只写入有效部分
        for (const id of unknown) {
          delete body.slots[id];
        }
        // 如果全部无效且无 free_content，返回友好提示
        if (Object.keys(body.slots).length === 0 && !hasFreeContent) {
          return new Response(JSON.stringify(jsonError(ErrorCodes.INVALID_PARAMS, slotWarnings.join('\n'))), {
            status: 400, headers: { 'Content-Type': 'application/json' },
          });
        }
      }
    }
  }

  const jsonRelKey = cfg.jsonKeyFromModule(mod);
  const mdRelKey = cfg.mdKeyFromModule(mod);
  const jsonKey = r2Path(mod.work_id, lang, jsonRelKey);
  const mdKey = r2Path(mod.work_id, lang, mdRelKey);
  const freeKey = r2Path(mod.work_id, lang, freeKeyFromJsonKey(jsonRelKey));

  // ---- V4: 优先使用前端缓存中的旧内容（零 R2 读取）；无则回退 R2 ----
  // 只有实际被修改的文件才产生快照（未修改的文件不需要重复快照）
  const prevJsonContent = body._prev_slots
    ? JSON.stringify({ slots: body._prev_slots }, null, 2)
    : ((hasSlots && jsonKey) ? await readR2Text(env, jsonKey) : null);
  const prevFreeContent = body._prev_free_content !== undefined
    ? body._prev_free_content
    : ((hasFreeContent && freeKey) ? await readR2Text(env, freeKey) : null);

  // ---- 写 free_content → .free.md（独立文件，永远不碰 .json） ----
  if (hasFreeContent) {
    await env.WORKS_BUCKET.put(freeKey, body.free_content!, {
      httpMetadata: { contentType: 'text/markdown; charset=utf-8' },
    });
  }

  // 获取当前的 free_content（可能刚写入，也可能来自已有文件）
  const currentFreeContent = hasFreeContent ? body.free_content! : await readR2Text(env, freeKey);

  // ---- 写 slots → .json（独立文件，永远不碰 .free.md） ----
  // 合并写入：先读取现有 slot 数据，将新 slot 值合并进去（而非替换全部）
  let mergedSlots: Record<string, string> = {};
  if (hasSlots) {
    if (jsonKey) {
      const existing = await readR2Json(env, jsonKey);
      mergedSlots = { ...(existing?.slots || {}), ...body.slots! };
    } else {
      mergedSlots = body.slots!;
    }

    // 写合并后的 slots
    const slotData: R2SlotData = { slots: mergedSlots };
    await env.WORKS_BUCKET.put(jsonKey, JSON.stringify(slotData, null, 2), {
      httpMetadata: { contentType: 'application/json' },
    });
  }

  // ---- 渲染 .md（从 slots + free_content 拼接） ----
  let renderedMd = '';
  if (hasSlots) {
    const writeSlots = mergedSlots;
    if (cfg.isCard && cfg.cardSlots && mdKey) {
      renderedMd = renderCardOnly(mod.name, cfg.cardSlots, lang, 2, writeSlots, currentFreeContent);
      await env.WORKS_BUCKET.put(mdKey, renderedMd, {
        httpMetadata: { contentType: 'text/markdown; charset=utf-8' },
      });
    } else if (cfg.tmpl && mdKey) {
      const name = (mod.type === 'm3_card') ? mod.name : undefined;
      renderedMd = renderTemplate(cfg.tmpl, lang, 2, { name, prefills: writeSlots, cleanOutput: true });
      if (currentFreeContent) {
        renderedMd = renderedMd.replace(/\n---\n[\s\S]*$/, '\n---\n\n' + currentFreeContent.trim() + '\n');
      }
      await env.WORKS_BUCKET.put(mdKey, renderedMd, {
        httpMetadata: { contentType: 'text/markdown; charset=utf-8' },
      });
    }
  }

  await touchModule(env, moduleId);

  // ---- V4 自动版本快照（文件被写入 + 内容确实变化 → 才快照旧内容） ----
  const newJsonContent = hasSlots ? JSON.stringify({ slots: mergedSlots }, null, 2) : '';
  const newFreeContent = hasFreeContent ? body.free_content! : '';
  if (hasSlots && prevJsonContent && prevJsonContent !== newJsonContent) {
    await createSnapshot(env, mod.work_id, jsonKey, prevJsonContent);
  }
  if (hasFreeContent && prevFreeContent && prevFreeContent !== newFreeContent) {
    await createSnapshot(env, mod.work_id, freeKey, prevFreeContent);
  }

  // 读回当前 slots 用于响应
  const currentSlotData = hasSlots ? { slots: mergedSlots } : await readR2Json(env, jsonKey);
  const currentSlots = currentSlotData?.slots || {};

  if (cfg.isCard && cfg.cardSlots) {
    const cardJson = buildCardJson(mod.name, cfg.cardSlots, lang, 2, { slots: currentSlots });
    return new Response(JSON.stringify(jsonSuccess({
      module_id: moduleId, lang, saved: true,
      ...(slotWarnings.length > 0 ? { slot_warnings: slotWarnings } : {}),
      is_card: true,
      card: cardJson,
      slots: currentSlots,
      free_content: currentFreeContent,
      rendered_md: renderedMd,
    })), { headers: { 'Content-Type': 'application/json' } });
  }

  const name = (mod.type === 'm3_card') ? mod.name : undefined;
  const template = buildTemplateJson(cfg.tmpl, lang, 2, { slots: currentSlots });
  return new Response(JSON.stringify(jsonSuccess({
    module_id: moduleId, lang, saved: true,
    ...(slotWarnings.length > 0 ? { slot_warnings: slotWarnings } : {}),
    template,
    slots: currentSlots,
    free_content: currentFreeContent,
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
// GET /api/write/module/{module_id}/versions — 列出历史版本
// ============================================================
export async function listModuleVersions(env: Env, request: Request, moduleId: string): Promise<Response> {
  const mod = await env.DB.prepare(
    'SELECT id, work_id, type, r2_json_key, r2_md_key FROM modules WHERE id = ?'
  ).bind(moduleId).first<{
    id: string; work_id: string; type: string;
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

  const jsonRelKey = cfg.jsonKeyFromModule(mod);
  const jsonKey = r2Path(mod.work_id, lang, jsonRelKey);
  const freeKey = r2Path(mod.work_id, lang, freeKeyFromJsonKey(jsonRelKey));

  // 返回 .json 和 .free.md 各自的版本列表
  const [jsonVersions, freeVersions] = await Promise.all([
    jsonKey ? listVersions(env, jsonKey) : Promise.resolve([]),
    freeKey ? listVersions(env, freeKey) : Promise.resolve([]),
  ]);

  return new Response(JSON.stringify(jsonSuccess({
    module_id: moduleId,
    json_key: jsonKey,
    free_key: freeKey,
    json_versions: jsonVersions,
    free_versions: freeVersions,
  })), { headers: { 'Content-Type': 'application/json' } });
}

// ============================================================
// GET /api/write/module/{module_id}/diff?v1=X&v2=Y — 对比版本
// v1/v2 支持 relative references：previous / current / 版本号(1,2,3...) / UUID
// v2=current 时对比当前内容与历史版本
// ============================================================
export async function diffModuleVersions(env: Env, request: Request, moduleId: string): Promise<Response> {
  const mod = await env.DB.prepare(
    'SELECT id, work_id, type, r2_json_key, r2_md_key FROM modules WHERE id = ?'
  ).bind(moduleId).first<{
    id: string; work_id: string; type: string;
    r2_json_key: string | null; r2_md_key: string | null;
  }>();

  if (!mod) {
    return new Response(JSON.stringify(jsonError(ErrorCodes.NOT_FOUND, 'Module not found')), {
      status: 404, headers: { 'Content-Type': 'application/json' },
    });
  }

  const url = new URL(request.url);
  const v1Raw = url.searchParams.get('v1');
  const v2Raw = url.searchParams.get('v2');
  const targetKey = url.searchParams.get('key');
  const slotOnly = url.searchParams.get('slot_only') === '1';

  if (!v1Raw || !v2Raw) {
    return new Response(JSON.stringify(jsonError(ErrorCodes.MISSING_REQUIRED_FIELD, 'v1 and v2 query params required')), {
      status: 400, headers: { 'Content-Type': 'application/json' },
    });
  }

  const lang = extractLang(request);
  const cfg = MODULE_CONFIG[mod.type];
  if (!cfg) {
    return new Response(JSON.stringify(jsonError(ErrorCodes.INTERNAL_ERROR, `Unknown module type: ${mod.type}`)), {
      status: 500, headers: { 'Content-Type': 'application/json' },
    });
  }

  const jsonRelKey = cfg.jsonKeyFromModule(mod);
  const jsonKey = r2Path(mod.work_id, lang, jsonRelKey);
  const freeKey = r2Path(mod.work_id, lang, freeKeyFromJsonKey(jsonRelKey));

  // 解析 relative references：previous / current / 版本号 → 真实 version ID
  const resolveRef = async (raw: string, key: string): Promise<string> => {
    if (raw === 'current') return 'current'; // current 已是原生支持
    if (raw === 'previous' || raw === 'latest') {
      const vers = await listVersions(env, key);
      if (raw === 'previous') {
        // previous = 最后一个历史快照（不含 current）
        if (vers.length < 1) return 'current'; // 没有历史版本
        return vers[0].id; // listVersions returns newest first
      }
      // latest = 最新版本（包含 current... 其实就是 current）
      return 'current';
    }
    // 版本号：数字 → 查找对应 UUID
    const num = parseInt(raw, 10);
    if (!isNaN(num) && num > 0) {
      const vers = await listVersions(env, key);
      const found = vers.find(v => v.version_num === num);
      if (found) return found.id;
      return raw; // 找不到，当作 UUID 尝试
    }
    return raw; // 默认当作 UUID
  };

  const v1 = targetKey === 'free' ? v1Raw : await resolveRef(v1Raw, jsonKey);
  const v2 = targetKey === 'free' ? v2Raw : await resolveRef(v2Raw, jsonKey);

  // 默认对比 .json 文件；如果传了 key=free 则对比 .free.md
  const r2Key = targetKey === 'free' ? freeKey : jsonKey;
  if (!r2Key) {
    return new Response(JSON.stringify(jsonError(ErrorCodes.INTERNAL_ERROR, 'No file to diff')), {
      status: 500, headers: { 'Content-Type': 'application/json' },
    });
  }

  let result: DiffResult | null = null;

  if (v2 === 'current') {
    // 对比历史版本与当前内容
    let currentContent = '';
    try {
      const obj = await env.WORKS_BUCKET.get(r2Key);
      if (obj) currentContent = await obj.text();
    } catch { /* empty */ }
    result = await diffWithCurrent(env, r2Key, currentContent, v1);
  } else {
    result = await diffModVersions(env, r2Key, v1, v2);
  }

  if (!result) {
    return new Response(JSON.stringify(jsonError(ErrorCodes.NOT_FOUND, 'Version(s) not found')), {
      status: 404, headers: { 'Content-Type': 'application/json' },
    });
  }

  // 如果请求 slot_only，则只返回 slots 级 diff
  if (slotOnly && r2Key.endsWith('.json')) {
    const slotChanges = result.changes.filter(c => c.path.startsWith('slots.'));
    return new Response(JSON.stringify(jsonSuccess({
      ...result,
      changes: slotChanges,
    })), { headers: { 'Content-Type': 'application/json' } });
  }

  return new Response(JSON.stringify(jsonSuccess(result)), {
    headers: { 'Content-Type': 'application/json' },
  });
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
