// 大纲引擎 — SF-020~022（多语言支持 + 长篇框架模板）
import { Env } from '../../db/schema';
import { jsonSuccess, jsonError } from '../../lib/response';
import { ErrorCodes } from '../../lib/errors';
import { generateWithAI } from '../../lib/ai';
import { writeOutline, workContentPath, sectionR2Key, extractLang, readR2WithLangFallback, type Lang, LANG_LABELS } from '../../lib/work_content';

// ============================================================
// 长篇框架大纲 — 结构化模板（中英双语）
// ============================================================

const OUTLINE_TEMPLATE_ZH = `# 长篇框架大纲

> 本文件描述作品的整体叙事结构。包含主线/支线阶段划分、阶段目标、高潮点与转折点。
> 这是作品的"骨架"，所有章节编写必须在此框架内展开。可迭代优化，但始终不违背 Setting Bible 的约束。

## 一、故事概览

### 一句话梗概
<!-- 用一句话概括整个故事，类似电梯演讲 -->

### 故事类型
<!-- 王道RPG / 悬疑推理 / 史诗奇幻 / 都市情感 / 科幻冒险 ... -->

### 核心冲突
<!-- 推动整个故事的核心矛盾是什么？谁 vs 谁，为什么？-->

## 二、主线阶段划分

### 第一幕：开端
<!-- 阶段目标、登场人物、关键事件、幕末转折 -->

### 第二幕：发展
<!-- 可拆为多个子阶段。阶段目标、冲突升级、关键事件、幕末转折 -->

### 第三幕：高潮与结局
<!-- 阶段目标、最终对决、结局、情感回收 -->

## 三、支线规划

<!-- 每条支线简述：与主线的关系、独立价值、预计占用章节数 -->
- [ ] 支线A：
- [ ] 支线B：

## 四、节奏规划

| 阶段 | 章节范围 | 节奏 | 情绪曲线 |
|------|---------|------|---------|
| 开端 | ch1-ch? | 中速建立 | 好奇→投入 |
| 发展 | ch?-ch? | 加速升级 | 紧张⇄释放交替 |
| 高潮 | ch?-ch? | 全速冲刺 | 压抑→爆发 |
| 结局 | ch?-end | 舒缓回收 | 满足→回味 |

## 五、关键转折点

<!-- 列出所有不可逆的情节转折，标注预计所在章节 -->
- [ ]
- [ ]

## 六、伏笔埋设总体规划

<!-- 跨章节伏笔的整体布局（详细追踪由伏笔账本管理） -->
- [ ]
- [ ]
`;

const OUTLINE_TEMPLATE_EN = `# Story Framework Outline

> This document describes the overall narrative structure, including main/subplot phase planning, stage goals, climaxes, and turning points.
> This is the "skeleton" of the work. All chapter writing must unfold within this framework. Iterable, but must always respect the Setting Bible constraints.

## I. Story Overview

### One-Line Pitch
<!-- Summarize the entire story in one sentence — an elevator pitch -->

### Story Type
<!-- Hero's Journey / Mystery-Thriller / Epic Fantasy / Urban Drama / Sci-Fi Adventure ... -->

### Core Conflict
<!-- What is the central conflict driving the entire story? Who vs. Whom, and why? -->

## II. Main Plot — Act Structure

### Act I: Setup
<!-- Stage goals, introduced characters, key events, act-ending turn -->

### Act II: Development
<!-- May split into sub-stages. Stage goals, escalating conflict, key events, act-ending turn -->

### Act III: Climax & Resolution
<!-- Stage goals, final confrontation, resolution, emotional closure -->

## III. Subplot Planning

<!-- For each subplot: relationship to the main plot, standalone value, estimated chapter count -->
- [ ] Subplot A:
- [ ] Subplot B:

## IV. Pacing Plan

| Act | Chapter Range | Pace | Emotional Arc |
|------|-------------|------|---------------|
| Setup | ch1-ch? | Moderate build | Curiosity → Engagement |
| Development | ch?-ch? | Escalating | Tension ⇄ Release |
| Climax | ch?-ch? | Full sprint | Suppression → Eruption |
| Resolution | ch?-end | Gentle unwind | Satisfaction → Resonance |

## V. Key Turning Points

<!-- List all irreversible plot turns, with estimated chapter positions -->
- [ ]
- [ ]

## VI. Foreshadowing Master Plan

<!-- Cross-chapter foreshadowing layout (detailed tracking managed by the Foreshadowing Ledger) -->
- [ ]
- [ ]
`;

function getOutlineTemplate(lang: Lang): string {
  return lang === 'en' ? OUTLINE_TEMPLATE_EN : OUTLINE_TEMPLATE_ZH;
}

// POST /api/write/outline/generate
export async function generateOutline(env: Env, request: Request): Promise<Response> {
  const body = await request.json() as { work_id: string; num_chapters?: number; style?: string };
  if (!body.work_id) {
    return new Response(JSON.stringify(jsonError(ErrorCodes.MISSING_REQUIRED_FIELD, 'work_id is required')), {
      status: 400, headers: { 'Content-Type': 'application/json' },
    });
  }

  const lang = extractLang(request);

  const work = await env.DB.prepare('SELECT id, title, category, summary FROM works WHERE id = ?').bind(body.work_id).first<Record<string, unknown>>();
  if (!work) {
    return new Response(JSON.stringify(jsonError(ErrorCodes.WORK_NOT_FOUND, 'Work not found')), {
      status: 404, headers: { 'Content-Type': 'application/json' },
    });
  }

  // 检查覆盖
  const url = new URL(request.url);
  if (url.searchParams.get('overwrite') !== 'true') {
    const existing = await env.DB.prepare('SELECT COUNT(*) as c FROM sections WHERE work_id = ?').bind(body.work_id).first<{ c: number }>();
    if (existing && existing.c > 0) {
      return new Response(JSON.stringify(jsonError(ErrorCodes.RESOURCE_CONFLICT, 'Outline already exists. Use ?overwrite=true to regenerate.')), {
        status: 409, headers: { 'Content-Type': 'application/json' },
      });
    }
  }

  // 读取世界设定（语言感知）
  let worldContext = '';
  const wb = await env.WORKS_BUCKET.get(workContentPath(body.work_id, lang, 'world_bible.md'));
  if (wb) worldContext = await wb.text();

  // 读取已有实体
  const entities = await env.DB.prepare('SELECT name, type FROM entities WHERE work_id = ?').bind(body.work_id).all<Record<string, unknown>>();
  const entityNames = (entities.results || []).map(e => e.name).join('、');

  const numChapters = body.num_chapters || 5;
  const outlineTemplate = getOutlineTemplate(lang);
  const langLabel = LANG_LABELS[lang];

  const prompt = `你是一位专业的小说大纲设计师。请为作品《${work.title}》（题材：${work.category || '未指定'}）生成一份 ${numChapters} 章的大纲。

${worldContext ? `世界观设定参考：\n${worldContext.substring(0, 2000)}\n` : ''}
${entityNames ? `已有角色：${entityNames}` : ''}

请先理解以下长篇框架模板的结构，然后生成章节列表。框架模板（参考其结构，但不需要输出框架本身）：

${outlineTemplate}

请按以下 JSON 格式输出章节列表（只输出 JSON，不要其他内容）：
{
  "sections": [
    {
      "title": "章节标题",
      "section_summary": "本章一句话摘要（30字以内）",
      "act": "第一幕/第二幕/第三幕",
      "key_entities": ["涉及的角色名"],
      "hooks": "本章的悬念/钩子",
      "estimated_words": 3000
    }
  ],
  "framework_filled": "根据作品信息填充的长篇框架 Markdown 正文（请将上述框架模板中的 <!-- 注释 --> 替换为实际内容）"
}

要求：
- 每章有清晰的起承转合，章节之间有递进关系
- 所有章节分配到三幕结构中
- framework_filled 字段包含完整的框架填充内容（用于写入 outline.md）
- 用${langLabel}输出`;

  const result = await generateWithAI(env, prompt, { maxTokens: 2048 });
  if (!result) {
    return new Response(JSON.stringify(jsonError(ErrorCodes.AI_SERVICE_UNAVAILABLE, 'AI service unavailable')), {
      status: 503, headers: { 'Content-Type': 'application/json' },
    });
  }

  let parsed: { sections?: Array<Record<string, unknown>>; framework_filled?: string } = {};
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

  // 写入 R2 outline.md（AI 填充的长篇框架，或自动生成的基本大纲）
  const outlineMd = parsed.framework_filled
    || `# 《${work.title}》大纲\n\n${sections.map((s, i) => `## 第${i + 1}章：${s.title}\n${s.section_summary || ''}\n`).join('\n')}`;
  await writeOutline(env, body.work_id, outlineMd, lang);

  // 写入 D1 sections 表
  const now = new Date().toISOString();
  const createdSections: Record<string, unknown>[] = [];

  for (let i = 0; i < sections.length; i++) {
    const s = sections[i];
    const sectionId = crypto.randomUUID();
    const title = String(s.title || `第${i + 1}章`);
    const summary = String(s.section_summary || '');
    const r2Key = sectionR2Key(body.work_id, sectionId, lang);

    await env.DB.prepare(`
      INSERT INTO sections (id, work_id, title, order_index, section_summary, r2_object_key, word_count, entities_involved, version, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, 0, '[]', 1, ?, ?)
    `).bind(sectionId, body.work_id, title, i, summary, r2Key, now, now).run();

    createdSections.push({
      id: sectionId, title, order_index: i,
      section_summary: summary,
      act: s.act || null,
      key_entities: s.key_entities || [],
      hooks: s.hooks || null,
      estimated_words: s.estimated_words || null,
    });
  }

  return new Response(JSON.stringify(jsonSuccess({ work_id: body.work_id, lang, sections: createdSections })), {
    status: 201, headers: { 'Content-Type': 'application/json' },
  });
}

// GET /api/write/outline/{work_id}?lang=zh|en
export async function readOutline(env: Env, request: Request, workId: string): Promise<Response> {
  const lang = extractLang(request);
  const sections = await env.DB.prepare(
    'SELECT id, title, order_index, section_summary, word_count, entities_involved, version FROM sections WHERE work_id = ? ORDER BY order_index'
  ).bind(workId).all<Record<string, unknown>>();

  // 如果没有任何章节，检查 R2 是否有长篇框架内容
  if ((sections.results || []).length === 0) {
    const r2Obj = await env.WORKS_BUCKET.get(workContentPath(workId, lang, 'outline.md'));
    if (!r2Obj) {
      // 返回结构化空模板
      const template = getOutlineTemplate(lang);
      return new Response(JSON.stringify(jsonSuccess({
        work_id: workId,
        lang,
        sections: [],
        outline_md: template,
        is_template: true,
        message: lang === 'en'
          ? 'Story framework not yet created. Below is the template. Please fill in or use AI generation.'
          : '长篇框架尚未创建，以下为设定模板。请按章节标题逐步填写，或使用 AI 生成。',
      })), {
        headers: { 'Content-Type': 'application/json' },
      });
    }
    // R2 有内容但还没有生成章节（大纲已写但未拆分）
    const outlineMd = await r2Obj.text();
    return new Response(JSON.stringify(jsonSuccess({
      work_id: workId,
      lang,
      sections: [],
      outline_md: outlineMd,
      is_template: false,
    })), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // 章节存在，同时尝试读取 R2 outline.md（含语言回退）
  const { content: outlineMd } = await readR2WithLangFallback(env, workId, lang, 'outline.md');

  return new Response(JSON.stringify(jsonSuccess({
    work_id: workId,
    lang,
    sections: (sections.results || []).map(s => ({
      ...s,
      entities_involved: typeof s.entities_involved === 'string' ? JSON.parse(s.entities_involved) : [],
    })),
    outline_md: outlineMd,
  })), {
    headers: { 'Content-Type': 'application/json' },
  });
}

// PUT /api/write/outline/{work_id}
export async function updateOutline(env: Env, request: Request, workId: string): Promise<Response> {
  const lang = extractLang(request);
  const body = await request.json() as { sections?: Array<{ id?: string; title: string; order_index: number; section_summary?: string }>; outline_md?: string };
  if (!body.sections || !Array.isArray(body.sections)) {
    return new Response(JSON.stringify(jsonError(ErrorCodes.INVALID_PARAMS, 'sections array is required')), {
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

  const now = new Date().toISOString();

  // 如果提供了 outline_md，同时写入 R2 长篇框架文件
  if (typeof body.outline_md === 'string') {
    await writeOutline(env, workId, body.outline_md, lang);
  }

  for (const s of body.sections) {
    if (s.id) {
      await env.DB.prepare(
        'UPDATE sections SET title = ?, order_index = ?, section_summary = ?, updated_at = ? WHERE id = ? AND work_id = ?'
      ).bind(s.title, s.order_index, s.section_summary || null, now, s.id, workId).run();
    } else {
      const sectionId = crypto.randomUUID();
      const r2Key = sectionR2Key(workId, sectionId, lang);
      await env.DB.prepare(`
        INSERT INTO sections (id, work_id, title, order_index, section_summary, r2_object_key, word_count, entities_involved, version, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, 0, '[]', 1, ?, ?)
      `).bind(sectionId, workId, s.title, s.order_index, s.section_summary || null, r2Key, now, now).run();
    }
  }

  return new Response(JSON.stringify(jsonSuccess({ work_id: workId, lang, updated: body.sections.length })), {
    headers: { 'Content-Type': 'application/json' },
  });
}
