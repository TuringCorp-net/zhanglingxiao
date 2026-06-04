/**
 * M3 人物卡 — character_card.ts
 *
 * 覆盖需求:
 *   SF-014: 角色/实体管理 — createCharacter() + updateEntity() + deleteEntity()
 *           entities 表 D1 CRUD（POST/PUT/DELETE /api/write/works/{id}/entities）
 *   SF-018: 人物卡模板 — CHARACTER_TEMPLATE（6 章框架，中英双语）
 *           首次无内容时返回完整模板框架，非空白
 *           v1.8.0 新增: arc_type（弧线类型）、关联 M1 世界规则、关联 M4 伏笔
 *   SF-071: M3/M4 模板拆分 — 人物卡模板从 entities.ts 独立为 character_card.ts
 *
 * CHARACTER_TEMPLATE 章节:
 *   一、基本信息 / 二、性格与动机 / 三、能力与限制（含 M1/M4 交叉引用）
 *   四、关系网络 / 五、成长弧线（含 arc_type） / 六、语言与行为特征
 */
import { Env } from '../../db/schema';
import { jsonSuccess, jsonError } from '../../lib/response';
import { ErrorCodes } from '../../lib/errors';
import { workContentPath, extractLang, type Lang } from '../../lib/l1/work-content';
import { renderTemplate, buildTemplateJson, type TemplateDef, type R2SlotData } from '../../lib/l1/template';

// ============================================================
// 人物卡 — 结构化模板定义（单一来源，双语）
// ============================================================

export const CHARACTER_TEMPLATE: TemplateDef = {
  title: { zh: '人物卡', en: 'Character Card' },
  intro: {
    zh: '本文档记录角色的完整设定。所有章节中该角色的言行必须与此卡一致。\n> 人物卡是 M6 一致性校验的强制参照源。',
    en: 'This document records the complete profile of the character. All depictions of this character in chapters must be consistent with this card.\n> Character Cards are mandatory reference sources for M6 Consistency Checks.',
  },
  sections: [
    {
      heading: { zh: '一、基本信息', en: 'I. Basic Information' },
      slots: [
        { id: 'name',          level: 1, label: { zh: '姓名', en: 'Name' }, hint: { zh: '角色的姓名', en: 'The character\'s full name' } },
        { id: 'identity',      level: 1, label: { zh: '身份/职业', en: 'Identity / Occupation' }, hint: { zh: '角色的社会身份和职业', en: 'The character\'s social identity and profession' } },
        { id: 'age',           level: 2, label: { zh: '年龄', en: 'Age' }, hint: { zh: '角色的年龄', en: 'The character\'s age' } },
        { id: 'appearance',    level: 2, label: { zh: '外表特征', en: 'Appearance' }, hint: { zh: '角色的外貌描述', en: 'Physical description of the character' } },
        { id: 'role_in_story', level: 1, label: { zh: '在故事中的角色', en: 'Role in Story' }, hint: { zh: '主角 / 核心配角 / 阶段人物 / 章节人物', en: 'Protagonist / Key Supporting / Stage Character / Chapter Character' } },
      ],
    },
    {
      heading: { zh: '二、性格与动机', en: 'II. Personality & Motivation' },
      slots: [
        { id: 'core_personality', level: 1, label: { zh: '核心性格', en: 'Core Personality' }, hint: { zh: '3-5 个关键词描述性格特征', en: '3-5 keywords describing personality traits' } },
        { id: 'inner_motivation', level: 1, label: { zh: '内在动机', en: 'Inner Motivation' }, hint: { zh: '这个角色真正想要的是什么？深层驱动力', en: 'What does this character truly want? Deep driving force' } },
        { id: 'external_goal',   level: 2, label: { zh: '外在目标', en: 'External Goal' }, hint: { zh: '这个角色表面上在追求什么？', en: 'What is this character pursuing on the surface?' } },
        { id: 'fears_weaknesses',level: 2, label: { zh: '恐惧与弱点', en: 'Fears & Weaknesses' }, hint: { zh: '角色的软肋、害怕什么、性格缺陷', en: 'Soft spots, what they fear, character flaws' } },
        { id: 'values_bottom_lines', level: 2, label: { zh: '价值观与底线', en: 'Values & Bottom Lines' }, hint: { zh: '角色不会逾越的原则', en: 'Principles they will not cross' } },
      ],
    },
    {
      heading: { zh: '三、能力与限制', en: 'III. Abilities & Limitations' },
      slots: [
        { id: 'skills',          level: 2, label: { zh: '能力/技能', en: 'Skills / Abilities' }, hint: { zh: '角色擅长什么，与世界观的力量体系如何关联', en: 'What is the character good at? How does it relate to the world\'s power system?' } },
        { id: 'ability_boundaries', level: 2, label: { zh: '能力边界', en: 'Ability Boundaries' }, hint: { zh: '角色不能做什么（受 Setting Bible 世界规则约束）', en: 'What can the character NOT do (constrained by the Setting Bible\'s world rules)?' } },
        { id: 'resources',       level: 2, label: { zh: '资源与人脉', en: 'Resources & Connections' }, hint: { zh: '角色可调用的外部资源', en: 'External resources the character can call upon' } },
        { id: 'related_m1',      level: 2, label: { zh: '关联的 M1 世界规则', en: 'Related M1 World Rules' }, hint: { zh: '列出此角色受约束的世界规则', en: 'List the world rules that constrain this character' } },
        { id: 'related_m4',      level: 2, label: { zh: '关联的 M4 伏笔', en: 'Related M4 Foreshadowing' }, hint: { zh: '与此角色相关的伏笔 ID 列表', en: 'Foreshadowing hook IDs related to this character' } },
      ],
    },
    {
      heading: { zh: '四、关系网络', en: 'IV. Relationship Network' },
      slots: [
        { id: 'rel_protagonist', level: 1, label: { zh: '与主角的关系', en: 'Relationship with Protagonist' }, hint: { zh: '描述此角色与主角之间的关系：是盟友？师徒？对手？', en: 'Describe the relationship with the protagonist: ally, mentor, rival?' } },
        { id: 'rel_others',      level: 2, label: { zh: '与其他核心人物的关系', en: 'Relationships with Other Key Characters' }, hint: { zh: '与主角之外的关键人物的关系', en: 'Relationships with key characters other than the protagonist' } },
        { id: 'rel_hostile',     level: 2, label: { zh: '敌对/竞争关系', en: 'Hostile / Competitive Relationships' }, hint: { zh: '此角色的对手、敌人或竞争者', en: 'This character\'s opponents, enemies, or competitors' } },
        { id: 'rel_emotional',   level: 2, label: { zh: '情感关系', en: 'Romantic / Emotional Relationships' }, hint: { zh: '恋爱、亲情、友情等情感纽带', en: 'Romantic, familial, friendship, and other emotional bonds' } },
      ],
    },
    {
      heading: { zh: '五、成长弧线', en: 'V. Growth Arc' },
      slots: [
        { id: 'arc_type',      level: 1, label: { zh: '弧线类型', en: 'Arc Type' }, hint: { zh: '成长(growth) / 堕落(fall) / 救赎(redemption) / 悲剧(tragic) / 觉醒(awakening) / 稳定(steady)', en: 'growth / fall / redemption / tragic / awakening / steady' } },
        { id: 'starting_state', level: 2, label: { zh: '起点状态', en: 'Starting State' }, hint: { zh: '角色在故事开始时的处境和心理状态', en: 'The character\'s situation and mental state at the beginning of the story' } },
        { id: 'growth_nodes',   level: 2, label: { zh: '关键成长节点', en: 'Key Growth Nodes' }, hint: { zh: '角色在哪些情节节点发生重大变化', en: 'At which plot nodes does the character undergo significant change?' } },
        { id: 'ending_state',   level: 2, label: { zh: '终点状态（预期）', en: 'Ending State (Projected)' }, hint: { zh: '角色在故事结束时预计的状态', en: 'The expected state of the character at the end of the story' } },
      ],
    },
    {
      heading: { zh: '六、语言与行为特征', en: 'VI. Speech & Behavioral Traits' },
      slots: [
        { id: 'catchphrases',    level: 2, label: { zh: '口头禅/说话风格', en: 'Catchphrases / Speaking Style' }, hint: { zh: '此角色的标志性语言风格、口头禅', en: 'Signature speech patterns, catchphrases' } },
        { id: 'gestures',        level: 2, label: { zh: '习惯动作', en: 'Habitual Gestures' }, hint: { zh: '此角色不自觉的身体语言、习惯性动作', en: 'Unconscious body language, habitual movements' } },
        { id: 'appearance_details', level: 2, label: { zh: '外貌细节', en: 'Appearance Details' }, hint: { zh: '区别于其他角色的外貌标志', en: 'Distinctive appearance markers that set this character apart' } },
        { id: 'quirks',          level: 2, label: { zh: '特殊癖好', en: 'Quirks' }, hint: { zh: '与众不同的嗜好或怪癖', en: 'Unique quirks or eccentricities' } },
      ],
    },
  ],
  outro: {
    zh: 'M3 自由编辑区',
    en: 'M3 Free editing zone',
  },
};

/** R2 路径 */
function charJsonPath(workId: string, lang: Lang, entityId: string) { return workContentPath(workId, lang, `characters/${entityId}.json`); }
function charMdPath(workId: string, lang: Lang, entityId: string) { return workContentPath(workId, lang, `characters/${entityId}.md`); }

/** 生成初始 slot 数据（name 预填入） */
function emptyCharSlotData(name: string): R2SlotData {
  return { slots: { name } };
}

// ============================================================
// 人物卡 CRUD
// ============================================================

/** POST /api/write/works/{id}/entities (type=character) */
export async function createCharacter(env: Env, request: Request, workId: string): Promise<Response> {
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
    VALUES (?, ?, ?, 'character', ?, ?, ?, 1, ?, ?)
  `).bind(id, workId, body.name, body.description || null, body.first_appearance || null, relatedEntities, now, now).run();

  const lang = extractLang(request);
  const slotData = emptyCharSlotData(body.name);
  const cleanCard = renderTemplate(CHARACTER_TEMPLATE, lang, 2, { name: body.name, prefills: slotData.slots, cleanOutput: true });

  try {
    await env.WORKS_BUCKET.put(charJsonPath(workId, lang, id), JSON.stringify(slotData, null, 2), {
      httpMetadata: { contentType: 'application/json' },
    });
    await env.WORKS_BUCKET.put(charMdPath(workId, lang, id), cleanCard, {
      httpMetadata: { contentType: 'text/markdown; charset=utf-8' },
    });
  } catch (err) {
    console.error('R2 write failed for character card:', workId, id, err);
  }

  const template = buildTemplateJson(CHARACTER_TEMPLATE, lang, 2, slotData);

  return new Response(JSON.stringify(jsonSuccess({ id, type: 'character', template })), {
    status: 201, headers: { 'Content-Type': 'application/json' },
  });
}

/** GET /api/write/works/{id}/entities/{eid}/card (type=character) */
export async function readCharacterCard(env: Env, request: Request, workId: string, entityId: string): Promise<Response> {
  const entity = await env.DB.prepare('SELECT id, name FROM entities WHERE id = ? AND work_id = ? AND type = \'character\'').bind(entityId, workId).first<{ id: string; name: string }>();
  if (!entity) {
    return new Response(JSON.stringify(jsonError(ErrorCodes.ENTITY_NOT_FOUND, 'Character not found')), {
      status: 404, headers: { 'Content-Type': 'application/json' },
    });
  }

  const lang = extractLang(request);

  // 读 JSON 数据
  let slotData: R2SlotData | null = null;
  const jsonObj = await env.WORKS_BUCKET.get(charJsonPath(workId, lang, entityId));
  if (jsonObj) {
    try { slotData = JSON.parse(await jsonObj.text()) as R2SlotData; } catch { /* ignore */ }
  }

  // 读 Markdown
  let renderedMd = '';
  const mdObj = await env.WORKS_BUCKET.get(charMdPath(workId, lang, entityId));
  if (mdObj) renderedMd = await mdObj.text();

  if (!slotData && !renderedMd) {
    const emptySlotData = emptyCharSlotData(entity.name);
    const emptyMd = renderTemplate(CHARACTER_TEMPLATE, lang, 2, { name: entity.name, prefills: emptySlotData.slots, cleanOutput: true });
    const template = buildTemplateJson(CHARACTER_TEMPLATE, lang, 2, emptySlotData);
    return new Response(JSON.stringify(jsonSuccess({
      entity_id: entityId, name: entity.name, type: 'character', lang,
      template,
      rendered_md: emptyMd,
      is_template: true,
    })), { headers: { 'Content-Type': 'application/json' } });
  }

  const template = buildTemplateJson(CHARACTER_TEMPLATE, lang, 2, slotData);

  return new Response(JSON.stringify(jsonSuccess({
    entity_id: entityId, name: entity.name, type: 'character', lang,
    template,
    rendered_md: renderedMd,
    is_template: false,
  })), { headers: { 'Content-Type': 'application/json' } });
}

/** PUT /api/write/works/{id}/entities/{eid}/card (type=character) */
export async function updateCharacterCard(env: Env, request: Request, workId: string, entityId: string): Promise<Response> {
  const entity = await env.DB.prepare('SELECT id, name FROM entities WHERE id = ? AND work_id = ? AND type = \'character\'').bind(entityId, workId).first<{ id: string; name: string }>();
  if (!entity) {
    return new Response(JSON.stringify(jsonError(ErrorCodes.ENTITY_NOT_FOUND, 'Character not found')), {
      status: 404, headers: { 'Content-Type': 'application/json' },
    });
  }

  const lang = extractLang(request);
  const body = await request.json() as { slots?: Record<string, string>; free_content?: string };

  // 兼容旧的 content 字段（Markdown 字符串）
  if (!body.slots && typeof (body as { content?: string }).content === 'string') {
    // 旧格式：只更新 MD，不更新 JSON
    await env.WORKS_BUCKET.put(charMdPath(workId, lang, entityId), (body as { content: string }).content, {
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

  let cleanCard = renderTemplate(CHARACTER_TEMPLATE, lang, 2, { name: entity.name, prefills: body.slots, cleanOutput: true });
  if (body.free_content) {
    cleanCard = cleanCard.replace(/\n---\n[\s\S]*$/, '\n---\n\n' + body.free_content.trim() + '\n');
  }

  // V3 三文件模型：slots → .json，free_content → .free.md，渲染 → .md
  await env.WORKS_BUCKET.put(charJsonPath(workId, lang, entityId), JSON.stringify(slotData, null, 2), {
    httpMetadata: { contentType: 'application/json' },
  });
  if (body.free_content) {
    const freeKey = workContentPath(workId, lang, `characters/${entityId}.free.md`);
    await env.WORKS_BUCKET.put(freeKey, body.free_content, {
      httpMetadata: { contentType: 'text/markdown; charset=utf-8' },
    });
  }
  await env.WORKS_BUCKET.put(charMdPath(workId, lang, entityId), cleanCard, {
    httpMetadata: { contentType: 'text/markdown; charset=utf-8' },
  });

  const template = buildTemplateJson(CHARACTER_TEMPLATE, lang, 2, slotData);

  return new Response(JSON.stringify(jsonSuccess({
    entity_id: entityId, name: entity.name, lang, saved: true,
    template,
    rendered_md: cleanCard,
  })), {
    headers: { 'Content-Type': 'application/json' },
  });
}

// ============================================================
// 通用实体 CRUD（D1 entities 表）
// ============================================================

/** PUT /api/write/works/{id}/entities/{eid} */
export async function updateEntity(env: Env, request: Request, workId: string, entityId: string): Promise<Response> {
  const existing = await env.DB.prepare('SELECT id FROM entities WHERE id = ? AND work_id = ?').bind(entityId, workId).first();
  if (!existing) {
    return new Response(JSON.stringify(jsonError(ErrorCodes.ENTITY_NOT_FOUND, 'Entity not found')), {
      status: 404, headers: { 'Content-Type': 'application/json' },
    });
  }

  const body = await request.json() as { name?: string; type?: string; description?: string; first_appearance?: string; related_entities?: string[] };
  const now = new Date().toISOString();

  const fields: string[] = ['updated_at = ?'];
  const bindings: (string | number | null)[] = [now];
  const fieldMap: Record<string, unknown> = {
    name: body.name, type: body.type, description: body.description,
    first_appearance: body.first_appearance,
    related_entities: Array.isArray(body.related_entities) ? JSON.stringify(body.related_entities) : body.related_entities,
  };

  for (const [key, value] of Object.entries(fieldMap)) {
    if (value !== undefined) { fields.push(`${key} = ?`); bindings.push(value as string | number | null); }
  }

  bindings.push(entityId);
  await env.DB.prepare(`UPDATE entities SET ${fields.join(', ')} WHERE id = ?`).bind(...bindings).run();

  return new Response(JSON.stringify(jsonSuccess({ id: entityId })), {
    headers: { 'Content-Type': 'application/json' },
  });
}

/** DELETE /api/write/works/{id}/entities/{eid} */
export async function deleteEntity(env: Env, _request: Request, workId: string, entityId: string): Promise<Response> {
  const existing = await env.DB.prepare('SELECT id FROM entities WHERE id = ? AND work_id = ?').bind(entityId, workId).first();
  if (!existing) {
    return new Response(JSON.stringify(jsonError(ErrorCodes.ENTITY_NOT_FOUND, 'Entity not found')), {
      status: 404, headers: { 'Content-Type': 'application/json' },
    });
  }

  await env.DB.prepare('DELETE FROM entities WHERE id = ?').bind(entityId).run();
  return new Response(JSON.stringify(jsonSuccess({ id: entityId, deleted: true })), {
    headers: { 'Content-Type': 'application/json' },
  });
}
