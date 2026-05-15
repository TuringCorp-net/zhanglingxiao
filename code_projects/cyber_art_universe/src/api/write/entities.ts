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

- **姓名**：${name}
- **身份/职业**：
- **年龄**：
- **外表特征**：
- **在故事中的角色**：主角 / 核心配角 / 阶段人物 / 章节人物

## 二、性格与动机

### 核心性格
<!-- 3-5 个关键词描述性格特征 -->

### 内在动机
<!-- 这个角色真正想要的是什么？深层驱动力 -->

### 外在目标
<!-- 这个角色表面上在追求什么？-->

### 恐惧与弱点
<!-- 角色的软肋、害怕什么、性格缺陷 -->

### 价值观与底线
<!-- 角色不会逾越的原则 -->

## 三、能力与限制

### 能力/技能
<!-- 角色擅长什么，与世界观的力量体系如何关联 -->

### 能力边界
<!-- 角色不能做什么（受 Setting Bible 世界规则约束）-->

### 资源与人脉
<!-- 角色可调用的外部资源 -->

### 关联的 M1 世界规则
<!-- 列出此角色受约束的世界规则，如："一、力量体系——魔法需要等价交换" -->

### 关联的 M4 伏笔
<!-- 与此角色相关的伏笔 ID 列表，如：h_001, h_003 -->

## 四、关系网络

### 与主角的关系
### 与其他核心人物的关系
### 敌对/竞争关系
### 情感关系

## 五、成长弧线

- **弧线类型**：<!-- 成长(growth) / 堕落(fall) / 救赎(redemption) / 悲剧(tragic) / 觉醒(awakening) / 稳定(steady) -->

### 起点状态
<!-- 角色在故事开始时的处境和心理状态 -->

### 关键成长节点
<!-- 角色在哪些情节节点发生重大变化 -->

### 终点状态（预期）
<!-- 角色在故事结束时预计的状态 -->

## 六、语言与行为特征

### 口头禅/说话风格
### 习惯动作
### 外貌细节
### 特殊癖好
`;

const CHARACTER_CARD_TEMPLATE_EN = (name: string) => `# Character Card: ${name}

> This document records the complete profile of "${name}". All depictions of this character in chapters must be consistent with this card.
> Character Cards are mandatory reference sources for M6 Consistency Checks.

## I. Basic Information

- **Name**: ${name}
- **Identity / Occupation**:
- **Age**:
- **Appearance**:
- **Role in Story**: Protagonist / Key Supporting / Stage Character / Chapter Character

## II. Personality & Motivation

### Core Personality
<!-- 3-5 keywords describing personality traits -->

### Inner Motivation
<!-- What does this character truly want? Deep driving force -->

### External Goal
<!-- What is this character pursuing on the surface? -->

### Fears & Weaknesses
<!-- Soft spots, what they fear, character flaws -->

### Values & Bottom Lines
<!-- Principles they will not cross -->

## III. Abilities & Limitations

### Skills / Abilities
<!-- What is the character good at? How does it relate to the world's power system? -->

### Ability Boundaries
<!-- What can the character NOT do (constrained by the Setting Bible's world rules)? -->

### Resources & Connections
<!-- External resources the character can call upon -->

### Related M1 World Rules
<!-- List the world rules that constrain this character, e.g. "I. Power System — magic requires equivalent exchange" -->

### Related M4 Foreshadowing
<!-- Foreshadowing hook IDs related to this character, e.g. h_001, h_003 -->

## IV. Relationship Network

### Relationship with Protagonist
### Relationships with Other Key Characters
### Hostile / Competitive Relationships
### Romantic / Emotional Relationships

## V. Growth Arc

- **Arc Type**: <!-- growth / fall / redemption / tragic / awakening / steady -->

### Starting State
<!-- The character's situation and mental state at the beginning of the story -->

### Key Growth Nodes
<!-- At which plot nodes does the character undergo significant change? -->

### Ending State (Projected)
<!-- The expected state of the character at the end of the story -->

## VI. Speech & Behavioral Traits

### Catchphrases / Speaking Style
### Habitual Gestures
### Appearance Details
### Quirks
`;

function getCharacterCardTemplate(name: string, lang: Lang): string {
  return lang === 'en' ? CHARACTER_CARD_TEMPLATE_EN(name) : CHARACTER_CARD_TEMPLATE_ZH(name);
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

  // 如果是角色类型，自动写入人物卡 R2 模板
  if (body.type === 'character') {
    const lang = extractLang(request);
    const card = getCharacterCardTemplate(body.name, lang);
    try {
      await env.WORKS_BUCKET.put(workContentPath(workId, lang, `characters/${id}.md`), card, {
        httpMetadata: { contentType: 'text/markdown; charset=utf-8' },
      });
    } catch (err) {
      console.error('R2 write failed for character card:', workId, id, err);
    }
  }

  return new Response(JSON.stringify(jsonSuccess({ id })), {
    status: 201, headers: { 'Content-Type': 'application/json' },
  });
}

// GET /api/write/works/{id}/entities/{eid}/card?lang=zh|en
export async function readCharacterCard(env: Env, request: Request, workId: string, entityId: string): Promise<Response> {
  const entity = await env.DB.prepare('SELECT id, name, type FROM entities WHERE id = ? AND work_id = ?').bind(entityId, workId).first<{ id: string; name: string; type: string }>();
  if (!entity) {
    return new Response(JSON.stringify(jsonError(ErrorCodes.ENTITY_NOT_FOUND, 'Entity not found')), {
      status: 404, headers: { 'Content-Type': 'application/json' },
    });
  }

  const lang = extractLang(request);
  const key = workContentPath(workId, lang, `characters/${entityId}.md`);
  const obj = await env.WORKS_BUCKET.get(key);

  if (!obj) {
    // 返回模板
    const template = getCharacterCardTemplate(entity.name, lang);
    return new Response(JSON.stringify(jsonSuccess({
      entity_id: entityId,
      name: entity.name,
      type: entity.type,
      lang,
      content: template,
      is_template: true,
      message: lang === 'en'
        ? 'Character card template. Fill in or use AI to generate.'
        : '人物卡模板。请按章节填写或使用 AI 生成。',
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
// 手动编辑人物卡 R2 内容
// ============================================================

export async function updateCharacterCard(env: Env, request: Request, workId: string, entityId: string): Promise<Response> {
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

  const key = workContentPath(workId, lang, `characters/${entityId}.md`);
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
