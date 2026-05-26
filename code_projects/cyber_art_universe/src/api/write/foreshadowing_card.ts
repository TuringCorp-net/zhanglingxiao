// Story Forger — M4 伏笔卡：模板定义 + CRUD + JSON 槽位数据
import { Env } from '../../db/schema';
import { jsonSuccess, jsonError } from '../../lib/response';
import { ErrorCodes } from '../../lib/errors';
import { workContentPath, extractLang, type Lang } from '../../lib/work_content';
import { renderCard, buildCardJson, type SlotDef, type R2SlotData } from '../../lib/template';

// ============================================================
// 伏笔卡 — 结构化槽位定义（单一来源，双语）
// ============================================================

export const FORESHADOWING_CARD_SLOTS: SlotDef[] = [
  { id: 'fh_type',           level: 1, label: { zh: '伏笔类型', en: 'Hook Type' }, hint: { zh: '身份伏笔 / 道具伏笔 / 对白伏笔 / 能力伏笔 / 事件伏笔 / 意象伏笔', en: 'Identity / Prop / Dialogue / Ability / Event / Imagery' } },
  { id: 'fh_intensity',      level: 2, label: { zh: '伏笔强度', en: 'Hook Intensity' }, hint: { zh: '🔴 核心（贯穿全书）/ 🟡 重要（跨多章）/ 🟢 彩蛋（轻量）', en: '🔴 Core (throughout) / 🟡 Major (multi-chapter) / 🟢 Minor (Easter egg)' } },
  { id: 'fh_characters',     level: 1, label: { zh: '关联人物', en: 'Related Characters' }, hint: { zh: '此伏笔涉及的角色名', en: 'Characters involved in this hook' } },
  { id: 'fh_chapter_range',  level: 2, label: { zh: '关联章节范围', en: 'Chapter Range' }, hint: { zh: '第 ? 章 ～ 第 ? 章', en: 'ch? ~ ch?' } },
  { id: 'fh_m1_rule',        level: 2, label: { zh: '依赖的 M1 规则', en: 'Depends on M1 Rule' }, hint: { zh: '此伏笔依赖的世界规则', en: 'World rule this hook depends on' } },
  { id: 'fh_plant_chapter',  level: 2, label: { zh: '埋种计划', en: 'Planting Plan' }, hint: { zh: '埋种章节：第 ? 章', en: 'Plant in Chapter: ch?' } },
  { id: 'fh_plant_method',   level: 2, label: { zh: '埋种计划', en: 'Planting Plan' }, hint: { zh: '埋种方式：用什么方式让读者接触到这个伏笔？', en: 'Method: How will readers encounter this clue?' } },
  { id: 'fh_dev_reinforce',  level: 2, label: { zh: '发展路径', en: 'Development Path' }, hint: { zh: '强化暗示：第 ? 章，如何再次暗示或加强', en: 'Reinforcement: ch?, how to reinforce' } },
  { id: 'fh_dev_reveal',     level: 2, label: { zh: '发展路径', en: 'Development Path' }, hint: { zh: '部分揭示：第 ? 章，读者开始意识到什么？', en: 'Partial Reveal: ch?, what begins to surface?' } },
  { id: 'fh_dev_misdirect',  level: 2, label: { zh: '发展路径', en: 'Development Path' }, hint: { zh: '误导/反转（可选）：第 ? 章，是否有意误导读者？', en: 'Misdirection (optional): ch?' } },
  { id: 'fh_payoff_chapter', level: 2, label: { zh: '回收计划', en: 'Payoff Plan' }, hint: { zh: '回收章节：第 ? 章', en: 'Resolve in Chapter: ch?' } },
  { id: 'fh_payoff_method',  level: 2, label: { zh: '回收计划', en: 'Payoff Plan' }, hint: { zh: '回收方式：如何让读者恍然大悟、拍案叫绝？', en: 'Method: How to make readers gasp?' } },
  { id: 'fh_status',         level: 2, label: { zh: '状态', en: 'Status' }, hint: { zh: '🌱 已规划 / 🌿 已埋种 / 🌳 发展中 / 💡 部分揭示 / ✅ 已回收', en: '🌱 Planned / 🌿 Planted / 🌳 Developing / 💡 Partially Revealed / ✅ Resolved' } },
];

/** R2 路径 */
function fhCardJsonPath(workId: string, lang: Lang, entityId: string) { return workContentPath(workId, lang, `foreshadowing/${entityId}.json`); }
function fhCardMdPath(workId: string, lang: Lang, entityId: string) { return workContentPath(workId, lang, `foreshadowing/${entityId}.md`); }

// ============================================================
// 伏笔卡 CRUD
// ============================================================

/** POST /api/write/works/{id}/entities (type=foreshadowing) */
export async function createForeshadowing(env: Env, request: Request, workId: string): Promise<Response> {
  const work = await env.DB.prepare('SELECT id FROM works WHERE id = ?').bind(workId).first();
  if (!work) {
    return new Response(JSON.stringify(jsonError(ErrorCodes.WORK_NOT_FOUND, 'Work not found')), {
      status: 404, headers: { 'Content-Type': 'application/json' },
    });
  }

  const body = await request.json() as { name: string; description?: string; first_appearance?: string; related_entities?: string[] };
  if (!body.name) {
    return new Response(JSON.stringify(jsonError(ErrorCodes.MISSING_REQUIRED_FIELD, 'name is required')), {
      status: 400, headers: { 'Content-Type': 'application/json' },
    });
  }

  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const relatedEntities = Array.isArray(body.related_entities) ? JSON.stringify(body.related_entities) : '[]';

  await env.DB.prepare(`
    INSERT INTO entities (id, work_id, name, type, description, first_appearance, related_entities, version, created_at, updated_at)
    VALUES (?, ?, ?, 'foreshadowing', ?, ?, ?, 1, ?, ?)
  `).bind(id, workId, body.name, body.description || null, body.first_appearance || null, relatedEntities, now, now).run();

  const lang = extractLang(request);
  const emptySlotData: R2SlotData = { slots: {} };
  const cleanCard = renderCard(body.name, FORESHADOWING_CARD_SLOTS, lang, 2, {}, true);

  try {
    await env.WORKS_BUCKET.put(fhCardJsonPath(workId, lang, id), JSON.stringify(emptySlotData, null, 2), {
      httpMetadata: { contentType: 'application/json' },
    });
    await env.WORKS_BUCKET.put(fhCardMdPath(workId, lang, id), cleanCard, {
      httpMetadata: { contentType: 'text/markdown; charset=utf-8' },
    });
  } catch (err) {
    console.error('R2 write failed for foreshadowing card:', workId, id, err);
  }

  const cardJson = buildCardJson(body.name, FORESHADOWING_CARD_SLOTS, lang, 2, emptySlotData);

  return new Response(JSON.stringify(jsonSuccess({ id, type: 'foreshadowing', template: cardJson })), {
    status: 201, headers: { 'Content-Type': 'application/json' },
  });
}

/** GET /api/write/works/{id}/entities/{eid}/card (type=foreshadowing) */
export async function readForeshadowingCard(env: Env, request: Request, workId: string, entityId: string): Promise<Response> {
  const entity = await env.DB.prepare('SELECT id, name FROM entities WHERE id = ? AND work_id = ? AND type = \'foreshadowing\'').bind(entityId, workId).first<{ id: string; name: string }>();
  if (!entity) {
    return new Response(JSON.stringify(jsonError(ErrorCodes.ENTITY_NOT_FOUND, 'Foreshadowing hook not found')), {
      status: 404, headers: { 'Content-Type': 'application/json' },
    });
  }

  const lang = extractLang(request);

  let slotData: R2SlotData | null = null;
  const jsonObj = await env.WORKS_BUCKET.get(fhCardJsonPath(workId, lang, entityId));
  if (jsonObj) {
    try { slotData = JSON.parse(await jsonObj.text()) as R2SlotData; } catch { /* ignore */ }
  }

  let renderedMd = '';
  const mdObj = await env.WORKS_BUCKET.get(fhCardMdPath(workId, lang, entityId));
  if (mdObj) renderedMd = await mdObj.text();

  if (!slotData && !renderedMd) {
    const emptyCard = renderCard(entity.name, FORESHADOWING_CARD_SLOTS, lang, 2);
    const cardJson = buildCardJson(entity.name, FORESHADOWING_CARD_SLOTS, lang, 2, null);
    return new Response(JSON.stringify(jsonSuccess({
      entity_id: entityId, name: entity.name, type: 'foreshadowing', lang,
      template: cardJson,
      rendered_md: emptyCard,
      is_template: true,
    })), { headers: { 'Content-Type': 'application/json' } });
  }

  const cardJson = buildCardJson(entity.name, FORESHADOWING_CARD_SLOTS, lang, 2, slotData);

  return new Response(JSON.stringify(jsonSuccess({
    entity_id: entityId, name: entity.name, type: 'foreshadowing', lang,
    template: cardJson,
    rendered_md: renderedMd,
    is_template: false,
  })), { headers: { 'Content-Type': 'application/json' } });
}

/** PUT /api/write/works/{id}/entities/{eid}/card (type=foreshadowing) */
export async function updateForeshadowingCard(env: Env, request: Request, workId: string, entityId: string): Promise<Response> {
  const entity = await env.DB.prepare('SELECT id, name FROM entities WHERE id = ? AND work_id = ? AND type = \'foreshadowing\'').bind(entityId, workId).first<{ id: string; name: string }>();
  if (!entity) {
    return new Response(JSON.stringify(jsonError(ErrorCodes.ENTITY_NOT_FOUND, 'Foreshadowing hook not found')), {
      status: 404, headers: { 'Content-Type': 'application/json' },
    });
  }

  const lang = extractLang(request);
  const body = await request.json() as { slots?: Record<string, string>; free_content?: string };

  // 兼容旧的 content 字段
  if (!body.slots && typeof (body as { content?: string }).content === 'string') {
    await env.WORKS_BUCKET.put(fhCardMdPath(workId, lang, entityId), (body as { content: string }).content, {
      httpMetadata: { contentType: 'text/markdown; charset=utf-8' },
    });
    return new Response(JSON.stringify(jsonSuccess({ entity_id: entityId, name: entity.name, lang, saved: true })), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (!body.slots || typeof body.slots !== 'object') {
    return new Response(JSON.stringify(jsonError(ErrorCodes.MISSING_REQUIRED_FIELD, 'slots object is required')), {
      status: 400, headers: { 'Content-Type': 'application/json' },
    });
  }

  const slotData: R2SlotData = { slots: body.slots };
  if (body.free_content) slotData.free_content = body.free_content;

  let cleanCard = renderCard(entity.name, FORESHADOWING_CARD_SLOTS, lang, 2, body.slots, true);
  if (body.free_content) {
    cleanCard = cleanCard.replace(/\n---\n[\s\S]*$/, '\n---\n\n' + body.free_content.trim() + '\n');
  }

  await env.WORKS_BUCKET.put(fhCardJsonPath(workId, lang, entityId), JSON.stringify(slotData, null, 2), {
    httpMetadata: { contentType: 'application/json' },
  });
  await env.WORKS_BUCKET.put(fhCardMdPath(workId, lang, entityId), cleanCard, {
    httpMetadata: { contentType: 'text/markdown; charset=utf-8' },
  });

  const cardJson = buildCardJson(entity.name, FORESHADOWING_CARD_SLOTS, lang, 2, slotData);

  return new Response(JSON.stringify(jsonSuccess({
    entity_id: entityId, name: entity.name, lang, saved: true,
    template: cardJson,
    rendered_md: cleanCard,
  })), {
    headers: { 'Content-Type': 'application/json' },
  });
}
