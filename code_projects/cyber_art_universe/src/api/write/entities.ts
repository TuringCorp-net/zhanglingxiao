// Story Forger — 实体 CRUD + 人物卡模板（SF-014~015: 角色卡/地点卡/道具卡管理）
import { Env } from '../../db/schema';
import { jsonSuccess, jsonError } from '../../lib/response';
import { ErrorCodes } from '../../lib/errors';
import { workContentPath, extractLang, type Lang, LANG_LABELS } from '../../lib/work_content';

// ============================================================
// 人物卡 — 结构化模板（中英双语）
// ============================================================

const CHARACTER_CARD_TEMPLATE_ZH = (name: string) => `# 人物卡：${name}

> 本文档记录角色「${name}」的完整设定。所有章节中该角色的言行必须与此卡一致。
> 人物卡是 M6 一致性校验的强制参照源。

## 一、基本信息

### 姓名
<!-- hint:角色的姓名 -->
<!-- slot -->
${name}
<!-- /slot -->

### 身份/职业
<!-- hint:角色的社会身份和职业 -->
<!-- slot -->
<!-- /slot -->

### 年龄
<!-- hint:角色的年龄 -->
<!-- slot -->
<!-- /slot -->

### 外表特征
<!-- hint:角色的外貌描述 -->
<!-- slot -->
<!-- /slot -->

### 在故事中的角色
<!-- hint:主角 / 核心配角 / 阶段人物 / 章节人物 -->
<!-- slot -->
<!-- /slot -->

## 二、性格与动机

### 核心性格
<!-- hint:3-5 个关键词描述性格特征 -->
<!-- slot -->
<!-- /slot -->

### 内在动机
<!-- hint:这个角色真正想要的是什么？深层驱动力 -->
<!-- slot -->
<!-- /slot -->

### 外在目标
<!-- hint:这个角色表面上在追求什么？ -->
<!-- slot -->
<!-- /slot -->

### 恐惧与弱点
<!-- hint:角色的软肋、害怕什么、性格缺陷 -->
<!-- slot -->
<!-- /slot -->

### 价值观与底线
<!-- hint:角色不会逾越的原则 -->
<!-- slot -->
<!-- /slot -->

## 三、能力与限制

### 能力/技能
<!-- hint:角色擅长什么，与世界观的力量体系如何关联 -->
<!-- slot -->
<!-- /slot -->

### 能力边界
<!-- hint:角色不能做什么（受 Setting Bible 世界规则约束） -->
<!-- slot -->
<!-- /slot -->

### 资源与人脉
<!-- hint:角色可调用的外部资源 -->
<!-- slot -->
<!-- /slot -->

### 关联的 M1 世界规则
<!-- hint:列出此角色受约束的世界规则，如："一、力量体系——魔法需要等价交换" -->
<!-- slot -->
<!-- /slot -->

### 关联的 M4 伏笔
<!-- hint:与此角色相关的伏笔 ID 列表，如：h_001, h_003 -->
<!-- slot -->
<!-- /slot -->

## 四、关系网络

### 与主角的关系
<!-- hint:描述此角色与主角之间的关系：是盟友？师徒？对手？ -->
<!-- slot -->
<!-- /slot -->
### 与其他核心人物的关系
<!-- hint:与主角之外的关键人物的关系 -->
<!-- slot -->
<!-- /slot -->
### 敌对/竞争关系
<!-- hint:此角色的对手、敌人或竞争者 -->
<!-- slot -->
<!-- /slot -->
### 情感关系
<!-- hint:恋爱、亲情、友情等情感纽带 -->
<!-- slot -->
<!-- /slot -->

## 五、成长弧线

### 弧线类型
<!-- hint:成长(growth) / 堕落(fall) / 救赎(redemption) / 悲剧(tragic) / 觉醒(awakening) / 稳定(steady) -->
<!-- slot -->
<!-- /slot -->

### 起点状态
<!-- hint:角色在故事开始时的处境和心理状态 -->
<!-- slot -->
<!-- /slot -->

### 关键成长节点
<!-- hint:角色在哪些情节节点发生重大变化 -->
<!-- slot -->
<!-- /slot -->

### 终点状态（预期）
<!-- hint:角色在故事结束时预计的状态 -->
<!-- slot -->
<!-- /slot -->

## 六、语言与行为特征

### 口头禅/说话风格
<!-- hint:此角色的标志性语言风格、口头禅 -->
<!-- slot -->
<!-- /slot -->
### 习惯动作
<!-- hint:此角色不自觉的身体语言、习惯性动作 -->
<!-- slot -->
<!-- /slot -->
### 外貌细节
<!-- hint:区别于其他角色的外貌标志 -->
<!-- slot -->
<!-- /slot -->
### 特殊癖好
<!-- hint:与众不同的嗜好或怪癖 -->
<!-- slot -->
<!-- /slot -->

---

> 以下为自由编辑区，可按需添加模板框架之外的内容。
`;

const CHARACTER_CARD_TEMPLATE_EN = (name: string) => `# Character Card: ${name}

> This document records the complete profile of "${name}". All depictions of this character in chapters must be consistent with this card.
> Character Cards are mandatory reference sources for M6 Consistency Checks.

## I. Basic Information

### Name
<!-- hint:The character's full name -->
<!-- slot -->
${name}
<!-- /slot -->

### Identity / Occupation
<!-- hint:The character's social identity and profession -->
<!-- slot -->
<!-- /slot -->

### Age
<!-- hint:The character's age -->
<!-- slot -->
<!-- /slot -->

### Appearance
<!-- hint:Physical description of the character -->
<!-- slot -->
<!-- /slot -->

### Role in Story
<!-- hint:Protagonist / Key Supporting / Stage Character / Chapter Character -->
<!-- slot -->
<!-- /slot -->

## II. Personality & Motivation

### Core Personality
<!-- hint:3-5 keywords describing personality traits -->
<!-- slot -->
<!-- /slot -->

### Inner Motivation
<!-- hint:What does this character truly want? Deep driving force -->
<!-- slot -->
<!-- /slot -->

### External Goal
<!-- hint:What is this character pursuing on the surface? -->
<!-- slot -->
<!-- /slot -->

### Fears & Weaknesses
<!-- hint:Soft spots, what they fear, character flaws -->
<!-- slot -->
<!-- /slot -->

### Values & Bottom Lines
<!-- hint:Principles they will not cross -->
<!-- slot -->
<!-- /slot -->

## III. Abilities & Limitations

### Skills / Abilities
<!-- hint:What is the character good at? How does it relate to the world's power system? -->
<!-- slot -->
<!-- /slot -->

### Ability Boundaries
<!-- hint:What can the character NOT do (constrained by the Setting Bible's world rules)? -->
<!-- slot -->
<!-- /slot -->

### Resources & Connections
<!-- hint:External resources the character can call upon -->
<!-- slot -->
<!-- /slot -->

### Related M1 World Rules
<!-- hint:List the world rules that constrain this character, e.g. "I. Power System — magic requires equivalent exchange" -->
<!-- slot -->
<!-- /slot -->

### Related M4 Foreshadowing
<!-- hint:Foreshadowing hook IDs related to this character, e.g. h_001, h_003 -->
<!-- slot -->
<!-- /slot -->

## IV. Relationship Network

### Relationship with Protagonist
<!-- hint:Describe the relationship with the protagonist: ally, mentor, rival? -->
<!-- slot -->
<!-- /slot -->
### Relationships with Other Key Characters
<!-- hint:Relationships with key characters other than the protagonist -->
<!-- slot -->
<!-- /slot -->
### Hostile / Competitive Relationships
<!-- hint:This character's opponents, enemies, or competitors -->
<!-- slot -->
<!-- /slot -->
### Romantic / Emotional Relationships
<!-- hint:Romantic, familial, friendship, and other emotional bonds -->
<!-- slot -->
<!-- /slot -->

## V. Growth Arc

### Arc Type
<!-- hint:growth / fall / redemption / tragic / awakening / steady -->
<!-- slot -->
<!-- /slot -->

### Starting State
<!-- hint:The character's situation and mental state at the beginning of the story -->
<!-- slot -->
<!-- /slot -->

### Key Growth Nodes
<!-- hint:At which plot nodes does the character undergo significant change? -->
<!-- slot -->
<!-- /slot -->

### Ending State (Projected)
<!-- hint:The expected state of the character at the end of the story -->
<!-- slot -->
<!-- /slot -->

## VI. Speech & Behavioral Traits

### Catchphrases / Speaking Style
<!-- hint:Signature speech patterns, catchphrases -->
<!-- slot -->
<!-- /slot -->
### Habitual Gestures
<!-- hint:Unconscious body language, habitual movements -->
<!-- slot -->
<!-- /slot -->
### Appearance Details
<!-- hint:Distinctive appearance markers that set this character apart -->
<!-- slot -->
<!-- /slot -->
### Quirks
<!-- hint:Unique quirks or eccentricities -->
<!-- slot -->
<!-- /slot -->

---

> Free editing zone — add any content beyond the template framework here.
`;

function getCharacterCardTemplate(name: string, lang: Lang): string {
  return lang === 'en' ? CHARACTER_CARD_TEMPLATE_EN(name) : CHARACTER_CARD_TEMPLATE_ZH(name);
}

// ============================================================
// 伏笔卡 — 单条模板（中英双语）
// ============================================================

const FORESHADOWING_CARD_TEMPLATE_ZH = (name: string) => `### ${name}

### 伏笔类型
<!-- hint:身份伏笔 / 道具伏笔 / 对白伏笔 / 能力伏笔 / 事件伏笔 / 意象伏笔 -->
<!-- slot -->
<!-- /slot -->

### 伏笔强度
<!-- hint:🔴 核心（贯穿全书）/ 🟡 重要（跨多章）/ 🟢 彩蛋（轻量） -->
<!-- slot -->
<!-- /slot -->

### 关联人物
<!-- hint:此伏笔涉及的角色名 -->
<!-- slot -->
<!-- /slot -->

### 关联章节范围
<!-- hint:第 ? 章 ～ 第 ? 章 -->
<!-- slot -->
<!-- /slot -->

### 依赖的 M1 规则
<!-- hint:此伏笔依赖的世界规则 -->
<!-- slot -->
<!-- /slot -->

### 埋种计划
<!-- hint:埋种章节：第 ? 章 -->
<!-- slot -->
<!-- /slot -->
<!-- hint:埋种方式：用什么方式让读者接触到这个伏笔？ -->
<!-- slot -->
<!-- /slot -->

### 发展路径
<!-- hint:强化暗示：第 ? 章，如何再次暗示或加强 -->
<!-- slot -->
<!-- /slot -->
<!-- hint:部分揭示：第 ? 章，读者开始意识到什么？ -->
<!-- slot -->
<!-- /slot -->
<!-- hint:误导/反转（可选）：第 ? 章，是否有意误导读者？ -->
<!-- slot -->
<!-- /slot -->

### 回收计划
<!-- hint:回收章节：第 ? 章 -->
<!-- slot -->
<!-- /slot -->
<!-- hint:回收方式：如何让读者恍然大悟、拍案叫绝？ -->
<!-- slot -->
<!-- /slot -->

### 状态
<!-- hint:🌱 已规划 / 🌿 已埋种 / 🌳 发展中 / 💡 部分揭示 / ✅ 已回收 -->
<!-- slot -->
<!-- /slot -->

---

> 以下为自由编辑区，可按需添加模板框架之外的内容。
`;

const FORESHADOWING_CARD_TEMPLATE_EN = (name: string) => `### ${name}

### Hook Type
<!-- hint:Identity / Prop / Dialogue / Ability / Event / Imagery -->
<!-- slot -->
<!-- /slot -->

### Hook Intensity
<!-- hint:🔴 Core (throughout) / 🟡 Major (multi-chapter) / 🟢 Minor (Easter egg) -->
<!-- slot -->
<!-- /slot -->

### Related Characters
<!-- hint:Characters involved in this hook -->
<!-- slot -->
<!-- /slot -->

### Chapter Range
<!-- hint:ch? ~ ch? -->
<!-- slot -->
<!-- /slot -->

### Depends on M1 Rule
<!-- hint:World rule this hook depends on -->
<!-- slot -->
<!-- /slot -->

### Planting Plan
<!-- hint:Plant in Chapter: ch? -->
<!-- slot -->
<!-- /slot -->
<!-- hint:Method: How will readers encounter this clue? -->
<!-- slot -->
<!-- /slot -->

### Development Path
<!-- hint:Reinforcement: ch?, how to reinforce -->
<!-- slot -->
<!-- /slot -->
<!-- hint:Partial Reveal: ch?, what begins to surface? -->
<!-- slot -->
<!-- /slot -->
<!-- hint:Misdirection (optional): ch? -->
<!-- slot -->
<!-- /slot -->

### Payoff Plan
<!-- hint:Resolve in Chapter: ch? -->
<!-- slot -->
<!-- /slot -->
<!-- hint:Method: How to make readers gasp? -->
<!-- slot -->
<!-- /slot -->

### Status
<!-- hint:🌱 Planned / 🌿 Planted / 🌳 Developing / 💡 Partially Revealed / ✅ Resolved -->
<!-- slot -->
<!-- /slot -->

---

> Free editing zone — add any content beyond the template framework here.
`;

function getForeshadowingCardTemplate(name: string, lang: Lang): string {
  return lang === 'en' ? FORESHADOWING_CARD_TEMPLATE_EN(name) : FORESHADOWING_CARD_TEMPLATE_ZH(name);
}

// ============================================================
// CRUD 端点
// ============================================================

// POST /api/write/works/{id}/entities?lang=zh|en
export async function createEntity(env: Env, request: Request, workId: string): Promise<Response> {
  const work = await env.DB.prepare('SELECT id FROM works WHERE id = ?').bind(workId).first();
  if (!work) {
    return new Response(JSON.stringify(jsonError(ErrorCodes.WORK_NOT_FOUND, 'Work not found')), {
      status: 404, headers: { 'Content-Type': 'application/json' },
    });
  }

  const body = await request.json() as { name: string; type: string; description?: string; first_appearance?: string; related_entities?: string[] };
  if (!body.name || !body.type) {
    return new Response(JSON.stringify(jsonError(ErrorCodes.MISSING_REQUIRED_FIELD, 'name and type are required')), {
      status: 400, headers: { 'Content-Type': 'application/json' },
    });
  }

  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const relatedEntities = Array.isArray(body.related_entities) ? JSON.stringify(body.related_entities) : '[]';

  await env.DB.prepare(`
    INSERT INTO entities (id, work_id, name, type, description, first_appearance, related_entities, version, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
  `).bind(id, workId, body.name, body.type, body.description || null, body.first_appearance || null, relatedEntities, now, now).run();

  // 根据类型自动写入对应的 R2 模板
  const lang = extractLang(request);
  if (body.type === 'character') {
    const card = getCharacterCardTemplate(body.name, lang);
    try {
      await env.WORKS_BUCKET.put(workContentPath(workId, lang, `characters/${id}.md`), card, {
        httpMetadata: { contentType: 'text/markdown; charset=utf-8' },
      });
    } catch (err) {
      console.error('R2 write failed for character card:', workId, id, err);
    }
  } else if (body.type === 'foreshadowing') {
    const card = getForeshadowingCardTemplate(body.name, lang);
    try {
      await env.WORKS_BUCKET.put(workContentPath(workId, lang, `foreshadowing/${id}.md`), card, {
        httpMetadata: { contentType: 'text/markdown; charset=utf-8' },
      });
    } catch (err) {
      console.error('R2 write failed for foreshadowing card:', workId, id, err);
    }
  }

  return new Response(JSON.stringify(jsonSuccess({ id })), {
    status: 201, headers: { 'Content-Type': 'application/json' },
  });
}

// GET /api/write/works/{id}/entities/{eid}/card?lang=zh|en
// 通用：人物卡 / 伏笔卡 均通过此端点读写
export async function readEntityCard(env: Env, request: Request, workId: string, entityId: string): Promise<Response> {
  const entity = await env.DB.prepare('SELECT id, name, type FROM entities WHERE id = ? AND work_id = ?').bind(entityId, workId).first<{ id: string; name: string; type: string }>();
  if (!entity) {
    return new Response(JSON.stringify(jsonError(ErrorCodes.ENTITY_NOT_FOUND, 'Entity not found')), {
      status: 404, headers: { 'Content-Type': 'application/json' },
    });
  }

  const lang = extractLang(request);
  const folder = entity.type === 'foreshadowing' ? 'foreshadowing' : 'characters';
  const key = workContentPath(workId, lang, `${folder}/${entityId}.md`);
  const obj = await env.WORKS_BUCKET.get(key);

  if (!obj) {
    // 返回模板
    const template = entity.type === 'foreshadowing'
      ? getForeshadowingCardTemplate(entity.name, lang)
      : getCharacterCardTemplate(entity.name, lang);
    return new Response(JSON.stringify(jsonSuccess({
      entity_id: entityId,
      name: entity.name,
      type: entity.type,
      lang,
      content: template,
      is_template: true,
    })), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const content = await obj.text();
  return new Response(JSON.stringify(jsonSuccess({
    entity_id: entityId,
    name: entity.name,
    type: entity.type,
    lang,
    content,
    is_template: false,
  })), {
    headers: { 'Content-Type': 'application/json' },
  });
}

// ============================================================
// PUT /api/write/works/{id}/entities/{eid}/card?lang=zh|en
// 通用：人物卡 / 伏笔卡 手动编辑
// ============================================================

export async function updateEntityCard(env: Env, request: Request, workId: string, entityId: string): Promise<Response> {
  const entity = await env.DB.prepare('SELECT id, name, type FROM entities WHERE id = ? AND work_id = ?').bind(entityId, workId).first<{ id: string; name: string; type: string }>();
  if (!entity) {
    return new Response(JSON.stringify(jsonError(ErrorCodes.ENTITY_NOT_FOUND, 'Entity not found')), {
      status: 404, headers: { 'Content-Type': 'application/json' },
    });
  }

  const lang = extractLang(request);
  const body = await request.json() as { content: string };
  if (typeof body.content !== 'string') {
    return new Response(JSON.stringify(jsonError(ErrorCodes.MISSING_REQUIRED_FIELD, 'content is required')), {
      status: 400, headers: { 'Content-Type': 'application/json' },
    });
  }

  const folder = entity.type === 'foreshadowing' ? 'foreshadowing' : 'characters';
  const key = workContentPath(workId, lang, `${folder}/${entityId}.md`);
  await env.WORKS_BUCKET.put(key, body.content, {
    httpMetadata: { contentType: 'text/markdown; charset=utf-8' },
  });

  return new Response(JSON.stringify(jsonSuccess({
    entity_id: entityId,
    name: entity.name,
    lang,
    saved: true,
  })), {
    headers: { 'Content-Type': 'application/json' },
  });
}

// PUT /api/write/works/{id}/entities/{eid}
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

// DELETE /api/write/works/{id}/entities/{eid}
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
