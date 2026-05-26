// 大纲引擎 — SF-020~022（多语言支持 + 长篇框架模板 + JSON 槽位数据）
import { Env } from '../../db/schema';
import { jsonSuccess, jsonError } from '../../lib/response';
import { ErrorCodes } from '../../lib/errors';
import { callAI } from '../../lib/ai';
import { renderTemplate as renderText } from '../../lib/l1/render';
import outlineGenMd from '../../lib/l1/prompts/tools/outline_gen.md';
import { writeOutline, workContentPath, sectionR2Key, extractLang, type Lang, LANG_LABELS } from '../../lib/work_content';
import { renderTemplate, renderTemplateAsJson, extractTemplateJson, buildTemplateJson, type TemplateDef, type R2SlotData } from '../../lib/template';

// ============================================================
// 长篇框架大纲 — 结构化模板定义（单一来源，双语）
// ============================================================

const OUTLINE_TEMPLATE: TemplateDef = {
  title: { zh: '长篇框架大纲', en: 'Story Framework Outline' },
  intro: {
    zh: '本文件描述作品的整体叙事结构。包含主线/支线阶段划分、阶段目标、高潮点与转折点。\n> 这是作品的"骨架"，所有章节编写必须在此框架内展开。可迭代优化，但始终不违背 Setting Bible 的约束。',
    en: 'This document describes the overall narrative structure, including main/subplot phase planning, stage goals, climaxes, and turning points.\n> This is the "skeleton" of the work. All chapter writing must unfold within this framework. Iterable, but must always respect the Setting Bible constraints.',
  },
  sections: [
    {
      heading: { zh: '一、故事概览', en: 'I. Story Overview' },
      slots: [
        { id: 'one_line_pitch', level: 1, label: { zh: '一句话梗概', en: 'One-Line Pitch' }, hint: { zh: '用一句话概括整个故事，类似电梯演讲', en: 'Summarize the entire story in one sentence — an elevator pitch' } },
        { id: 'story_type',     level: 2, label: { zh: '故事类型', en: 'Story Type' }, hint: { zh: '王道RPG / 悬疑推理 / 史诗奇幻 / 都市情感 / 科幻冒险 ...', en: 'Hero\'s Journey / Mystery-Thriller / Epic Fantasy / Urban Drama / Sci-Fi Adventure ...' } },
        { id: 'core_conflict',  level: 1, label: { zh: '核心冲突', en: 'Core Conflict' }, hint: { zh: '推动整个故事的核心矛盾是什么？谁 vs 谁，为什么？', en: 'What is the central conflict driving the entire story? Who vs. Whom, and why?' } },
      ],
    },
    {
      heading: { zh: '二、主线阶段划分', en: 'II. Main Plot — Act Structure' },
      slots: [
        { id: 'main_plot', level: 1, label: { zh: '', en: '' }, hint: {
          zh: '描述你的故事主线结构。可以参考三幕式（开端建立冲突 → 发展升级张力 → 高潮爆发回收 → 结局沉淀余韵），也可以自由安排你的结构。\n\n包含：各阶段的章节范围、核心事件、阶段目标、关键转折。',
          en: 'Describe your main storyline structure. You can use the classic three-act framework (Setup → Development → Climax → Resolution) or organize it your own way.\n\nInclude: chapter ranges for each phase, core events, phase goals, key turning points.',
        } },
      ],
    },
    {
      heading: { zh: '三、支线规划', en: 'III. Subplot Planning' },
      slots: [
        { id: 'subplots', level: 2, label: { zh: '', en: '' }, hint: {
          zh: '列出你的支线。每条简述：与主线关系、独立价值、预计章节数。\n\n支线不是填充物——每条支线都应揭示主线无法单独呈现的真相。\n\n例如：\n- 支线A（爱情线）：ch3-8，揭示主角的情感弱点\n- 支线B（复仇线）：ch2-12，与主线反派形成呼应',
          en: 'List your subplots. For each: relationship to the main plot, standalone value, estimated chapter count.\n\nSubplots aren\'t filler — each one should reveal a truth the main plot cannot show alone.\n\nExample:\n- Subplot A (Romance): ch3-8, reveals the protagonist\'s emotional vulnerability\n- Subplot B (Revenge): ch2-12, mirrors the main antagonist',
        } },
      ],
    },
    {
      heading: { zh: '四、节奏规划', en: 'IV. Pacing Plan' },
      slots: [
        { id: 'pacing', level: 2, label: { zh: '', en: '' }, hint: {
          zh: '规划各阶段的节奏和情绪曲线。可以参考以下表格格式，也可以自由描述：\n\n| 阶段 | 章节范围 | 节奏 | 情绪曲线 |\n|------|---------|------|---------|\n| 开端 | (如 ch1-3) | (如 中速建立) | (如 好奇→投入) |\n| 发展 | ... | ... | ... |\n| 高潮 | ... | ... | ... |\n| 结局 | ... | ... | ... |\n\n节奏比字数更重要——让高潮和低谷自然交替，给读者喘息的空间。',
          en: 'Plan the pacing and emotional arc for each phase. You can use the table format below or describe freely:\n\n| Phase | Chapter Range | Pace | Emotional Arc |\n|-------|-------------|------|---------------|\n| Setup | (e.g. ch1-3) | (e.g. Moderate build) | (e.g. Curiosity → Engagement) |\n| Development | ... | ... | ... |\n| Climax | ... | ... | ... |\n| Resolution | ... | ... | ... |\n\nPacing matters more than word count — let peaks and valleys alternate naturally.',
        } },
      ],
    },
    {
      heading: { zh: '五、关键转折点', en: 'V. Key Turning Points' },
      slots: [
        { id: 'turning_points', level: 2, label: { zh: '', en: '' }, hint: {
          zh: '列出所有不可逆的情节转折，标注预计所在章节。每一个转折点都应该让读者从此用不同的眼光看待这个故事。\n\n例如：\n- 转折 #1 (ch3)：主角发现养父才是杀死生父的真凶\n- 转折 #2 (ch7)：盟友叛变，主角失去所有后援',
          en: 'List all irreversible plot turns with estimated chapter positions. Each turning point should make readers see the story through different eyes.\n\nExample:\n- Turn #1 (ch3): Protagonist discovers their mentor was the true villain all along\n- Turn #2 (ch7): Ally betrays the protagonist, leaving them without support',
        } },
      ],
    },
    {
      heading: { zh: '六、伏笔埋设总体规划', en: 'VI. Foreshadowing Master Plan' },
      slots: [
        { id: 'foreshadowing_master', level: 2, label: { zh: '', en: '' }, hint: {
          zh: '规划跨章节的伏笔布局。标注每条伏笔的类型、埋设章节、回收章节。\n\n详细追踪由 M4 伏笔账本管理，此处只需总体规划。\n\n例如：\n- 伏笔 #1：主角的身世之谜（身份伏笔），ch1埋 → ch8揭示 → ch10回收\n- 伏笔 #2：神秘戒指的来历（道具伏笔），ch2埋 → ch6部分揭示 → ch12回收',
          en: 'Plan cross-chapter foreshadowing. Note each hook\'s type, planting chapter, and payoff chapter.\n\nDetailed tracking is managed by M4 Foreshadowing Ledger — this is just the master plan.\n\nExample:\n- Hook #1: The protagonist\'s true origin (identity), ch1 planted → ch8 revealed → ch10 resolved\n- Hook #2: The mysterious ring (object), ch2 planted → ch6 partial reveal → ch12 resolved',
        } },
      ],
    },
  ],
  outro: {
    zh: 'M2 自由编辑区',
    en: 'M2 Free editing zone',
  },
};

/** R2 路径 */
function outlineJsonPath(workId: string, lang: Lang) { return workContentPath(workId, lang, 'outline.json'); }

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
  const templateJson = renderTemplateAsJson(OUTLINE_TEMPLATE, lang, 2);
  const langLabel = LANG_LABELS[lang];

  const prompt = renderText(outlineGenMd, {
    work_title: work.title,
    category: work.category || '未指定',
    num_chapters: String(numChapters),
    world_context: worldContext ? `世界观设定参考：\n${worldContext.substring(0, 2000)}\n` : '',
    entity_names: entityNames ? `已有角色：${entityNames}` : '',
    template_json: templateJson,
    lang_label: langLabel,
  });

  const aiResult = await callAI(env, [{ role: 'user', content: prompt }], {
    maxTokens: 2048,
    responseFormat: 'json',
  });

  if (!aiResult?.content) {
    return new Response(JSON.stringify(jsonError(ErrorCodes.AI_SERVICE_UNAVAILABLE, 'AI service unavailable')), {
      status: 503, headers: { 'Content-Type': 'application/json' },
    });
  }

  const parsed = extractTemplateJson(aiResult.content) as { sections?: Array<Record<string, unknown>>; framework_slots?: Record<string, string> } | null;
  if (!parsed) {
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

  // 渲染框架 Markdown
  const frameworkSlots = parsed.framework_slots || {};
  const outlineMd = renderTemplate(OUTLINE_TEMPLATE, lang, 2, { prefills: frameworkSlots, cleanOutput: true });

  // 写 R2 双文件
  const slotData: R2SlotData = { slots: frameworkSlots };
  await env.WORKS_BUCKET.put(outlineJsonPath(body.work_id, lang), JSON.stringify(slotData, null, 2), {
    httpMetadata: { contentType: 'application/json' },
  });
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

  const template = buildTemplateJson(OUTLINE_TEMPLATE, lang, 2, slotData);

  return new Response(JSON.stringify(jsonSuccess({
    work_id: body.work_id, lang,
    sections: createdSections,
    template,
    rendered_md: outlineMd,
  })), {
    status: 201, headers: { 'Content-Type': 'application/json' },
  });
}

// GET /api/write/outline/{work_id}?lang=zh|en
export async function readOutline(env: Env, request: Request, workId: string): Promise<Response> {
  const lang = extractLang(request);
  const sections = await env.DB.prepare(
    'SELECT id, title, order_index, section_summary, word_count, entities_involved, version FROM sections WHERE work_id = ? ORDER BY order_index'
  ).bind(workId).all<Record<string, unknown>>();

  // 读 outline JSON 和 MD
  let slotData: R2SlotData | null = null;
  const jsonObj = await env.WORKS_BUCKET.get(outlineJsonPath(workId, lang));
  if (jsonObj) {
    try { slotData = JSON.parse(await jsonObj.text()) as R2SlotData; } catch { /* ignore */ }
  }

  let outlineMd = '';
  const mdObj = await env.WORKS_BUCKET.get(workContentPath(workId, lang, 'outline.md'));
  if (mdObj) outlineMd = await mdObj.text();

  // 如果没有任何章节且没有 JSON 数据，返回空模板
  if ((sections.results || []).length === 0 && !slotData && !outlineMd) {
    const emptyMd = renderTemplate(OUTLINE_TEMPLATE, lang, 2);
    const template = buildTemplateJson(OUTLINE_TEMPLATE, lang, 2, null);
    return new Response(JSON.stringify(jsonSuccess({
      work_id: workId,
      lang,
      sections: [],
      template,
      rendered_md: emptyMd,
      is_template: true,
      message: lang === 'en'
        ? 'Story framework not yet created. Below is the template. Please fill in or use AI generation.'
        : '长篇框架尚未创建，以下为设定模板。请按章节标题逐步填写，或使用 AI 生成。',
    })), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // 如果没有 MD 但有 JSON，重新渲染
  if (!outlineMd && slotData) {
    outlineMd = renderTemplate(OUTLINE_TEMPLATE, lang, 2, { prefills: slotData.slots, cleanOutput: true });
  }

  const template = buildTemplateJson(OUTLINE_TEMPLATE, lang, 2, slotData);

  return new Response(JSON.stringify(jsonSuccess({
    work_id: workId,
    lang,
    sections: (sections.results || []).map(s => ({
      ...s,
      entities_involved: typeof s.entities_involved === 'string' ? JSON.parse(s.entities_involved) : [],
    })),
    template,
    rendered_md: outlineMd,
  })), {
    headers: { 'Content-Type': 'application/json' },
  });
}

// PUT /api/write/outline/{work_id}
export async function updateOutline(env: Env, request: Request, workId: string): Promise<Response> {
  const lang = extractLang(request);
  const body = await request.json() as {
    sections?: Array<{ id?: string; title: string; order_index: number; section_summary?: string }>;
    outline_slots?: Record<string, string>;
    free_content?: string;
  };
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

  // 如果提供了 outline_slots，写 R2 双文件
  if (body.outline_slots && typeof body.outline_slots === 'object') {
    const slotData: R2SlotData = { slots: body.outline_slots };
    if (body.free_content) slotData.free_content = body.free_content;

    let outlineMd = renderTemplate(OUTLINE_TEMPLATE, lang, 2, { prefills: body.outline_slots, cleanOutput: true });
    if (body.free_content) {
      outlineMd = outlineMd.replace(/\n---\n[\s\S]*$/, '\n---\n\n' + body.free_content.trim() + '\n');
    }

    await env.WORKS_BUCKET.put(outlineJsonPath(workId, lang), JSON.stringify(slotData, null, 2), {
      httpMetadata: { contentType: 'application/json' },
    });
    await writeOutline(env, workId, outlineMd, lang);
  }

  // 更新 sections
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
