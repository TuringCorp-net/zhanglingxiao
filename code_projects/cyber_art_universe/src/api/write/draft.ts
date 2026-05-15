// 章节生产流水线 — SF-030~034（多语言支持）
import { Env } from '../../db/schema';
import { jsonSuccess, jsonError } from '../../lib/response';
import { ErrorCodes } from '../../lib/errors';
import { generateWithAI } from '../../lib/ai';
import { writeSectionContent, readSectionMarkdown, workContentPath, extractLang } from '../../lib/work_content';

// 事件日志（审计）
async function logEvent(env: Env, eventType: string, workId: string, sectionId: string | null, summary: string): Promise<void> {
  try {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    await env.DB.prepare(
      'INSERT INTO events (id, event_type, work_id, section_id, delta_summary, timestamp) VALUES (?, ?, ?, ?, ?, ?)'
    ).bind(id, eventType, workId, sectionId, summary, now).run();
  } catch (err) {
    console.error('Event log failed:', eventType, workId, err);
  }
}

// ============================================================
// GET /api/write/draft/intent/{work_id}/{section_id}?lang=
// 读取指定章节的意图卡
// ============================================================
export async function readIntent(env: Env, request: Request, workId: string, sectionId: string): Promise<Response> {
  const lang = extractLang(request);
  const key = workContentPath(workId, lang, `intents/${sectionId}.json`);
  const obj = await env.WORKS_BUCKET.get(key);

  if (!obj) {
    return new Response(JSON.stringify(jsonSuccess({
      work_id: workId,
      section_id: sectionId,
      lang,
      intent: null,
      is_empty: true,
      message: lang === 'en'
        ? 'Intent card not yet created for this chapter.'
        : '本章尚未创建意图卡。',
    })), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const intent = await obj.json();
  return new Response(JSON.stringify(jsonSuccess({
    work_id: workId,
    section_id: sectionId,
    lang,
    intent,
    is_empty: false,
  })), {
    headers: { 'Content-Type': 'application/json' },
  });
}

// POST /api/write/draft/intent
export async function createIntent(env: Env, request: Request): Promise<Response> {
  const body = await request.json() as {
    work_id: string; section_id?: string; chapter_index?: number;
    goal: string; emotional_goal?: string;
    pov_character?: string; pov_strategy?: string;
    visual_keywords?: string[]; camera_notes?: string;
    gameplay_goal?: string; player_learning_goal?: string;
    branching?: string; scene_type?: string;
    hooks?: string[]; foreshadowing_ids?: string[]; style_notes?: string;
  };
  if (!body.work_id || !body.goal) {
    return new Response(JSON.stringify(jsonError(ErrorCodes.MISSING_REQUIRED_FIELD, 'work_id and goal are required')), {
      status: 400, headers: { 'Content-Type': 'application/json' },
    });
  }

  // 验证 work 存在
  const work = await env.DB.prepare('SELECT id FROM works WHERE id = ?').bind(body.work_id).first();
  if (!work) {
    return new Response(JSON.stringify(jsonError(ErrorCodes.WORK_NOT_FOUND, 'Work not found')), {
      status: 404, headers: { 'Content-Type': 'application/json' },
    });
  }

  const intent = {
    work_id: body.work_id,
    section_id: body.section_id || null,
    chapter_index: body.chapter_index || null,
    goal: body.goal,
    emotional_goal: body.emotional_goal || null,
    pov_character: body.pov_character || null,
    pov_strategy: body.pov_strategy || null,
    visual_keywords: body.visual_keywords || null,
    camera_notes: body.camera_notes || null,
    gameplay_goal: body.gameplay_goal || null,
    player_learning_goal: body.player_learning_goal || null,
    branching: body.branching || null,
    scene_type: body.scene_type || null,
    hooks: body.hooks || [],
    foreshadowing_ids: body.foreshadowing_ids || [],
    style_notes: body.style_notes || null,
    created_at: new Date().toISOString(),
  };

  const lang = extractLang(request);
  const key = workContentPath(body.work_id, lang, `intents/${body.section_id || crypto.randomUUID()}.json`);
  await env.WORKS_BUCKET.put(key, JSON.stringify(intent, null, 2), {
    httpMetadata: { contentType: 'application/json' },
  });

  return new Response(JSON.stringify(jsonSuccess({ key, lang, ...intent })), {
    status: 201, headers: { 'Content-Type': 'application/json' },
  });
}

// POST /api/write/draft/generate
export async function generateDraft(env: Env, request: Request): Promise<Response> {
  const body = await request.json() as { work_id: string; section_id: string };
  if (!body.work_id || !body.section_id) {
    return new Response(JSON.stringify(jsonError(ErrorCodes.MISSING_REQUIRED_FIELD, 'work_id and section_id are required')), {
      status: 400, headers: { 'Content-Type': 'application/json' },
    });
  }

  const lang = extractLang(request);

  const section = await env.DB.prepare(
    'SELECT id, title, order_index, section_summary FROM sections WHERE id = ? AND work_id = ?'
  ).bind(body.section_id, body.work_id).first<Record<string, unknown>>();
  if (!section) {
    return new Response(JSON.stringify(jsonError(ErrorCodes.SECTION_NOT_FOUND, 'Section not found')), {
      status: 404, headers: { 'Content-Type': 'application/json' },
    });
  }

  const work = await env.DB.prepare('SELECT id, title, category FROM works WHERE id = ?').bind(body.work_id).first<Record<string, unknown>>();
  if (!work) {
    return new Response(JSON.stringify(jsonError(ErrorCodes.WORK_NOT_FOUND, 'Work not found')), {
      status: 404, headers: { 'Content-Type': 'application/json' },
    });
  }

  // 构建写作上下文（语言感知）
  let worldContext = '';
  const wb = await env.WORKS_BUCKET.get(workContentPath(body.work_id, lang, 'world_bible.md'));
  if (wb) worldContext = (await wb.text()).substring(0, 3000);

  // 前 3 章摘要
  const prevChapters = await env.DB.prepare(
    'SELECT title, section_summary, word_count FROM sections WHERE work_id = ? AND order_index < ? ORDER BY order_index DESC LIMIT 3'
  ).bind(body.work_id, section.order_index).all<Record<string, unknown>>();
  const prevContext = (prevChapters.results || []).reverse().map(s =>
    `- ${s.title}: ${s.section_summary || '无摘要'} (${s.word_count}字)`
  ).join('\n');

  // 意图卡（语言感知路径）
  let intentContext = '';
  const intentsPrefix = workContentPath(body.work_id, lang, 'intents/');
  const intents = await env.WORKS_BUCKET.list({ prefix: intentsPrefix });
  for (const obj of intents.objects || []) {
    const raw = await env.WORKS_BUCKET.get(obj.key);
    if (raw) {
      const data = JSON.parse(await raw.text());
      if (data.section_id === body.section_id) {
        const emoGoal = data.emotional_goal ? `\n情绪目标：${data.emotional_goal}` : '';
        const povInfo = data.pov_character ? `\n视角角色：${data.pov_character}${data.pov_strategy ? `（策略：${data.pov_strategy}）` : ''}` : '';
        intentContext = `本章目标：${data.goal}${emoGoal}${povInfo}\n钩子：${(data.hooks || []).join('、')}\n风格：${data.style_notes || '无'}`;
        break;
      }
    }
  }

  const prompt = `你是一位专业小说作家。请为作品《${work.title}》（题材：${work.category || '未指定'}）写第 ${Number(section.order_index) + 1} 章：${section.title}。

${worldContext ? `【世界观设定】\n${worldContext}\n` : ''}
${prevContext ? `【前文概要】\n${prevContext}\n` : ''}
${intentContext ? `【本章创作意图】\n${intentContext}\n` : ''}
${section.section_summary ? `【章节摘要】${section.section_summary}` : ''}

要求：
- 保持人物性格和行为一致
- 严格遵守世界观设定
- 写完整的章节正文，包含场景描写、对话、心理活动
- 章末设置合理的悬念或过渡
- 直接输出 Markdown 格式的正文，不要输出前言/后记/元信息`;

  const result = await generateWithAI(env, prompt, { maxTokens: 4096 });
  if (!result) {
    return new Response(JSON.stringify(jsonError(ErrorCodes.AI_SERVICE_UNAVAILABLE, 'AI service unavailable')), {
      status: 503, headers: { 'Content-Type': 'application/json' },
    });
  }

  // 写入 R2（语言感知）
  await writeSectionContent(env, body.work_id, body.section_id, {
    title: section.title,
    order_index: section.order_index,
    ai_generated: true,
    version: 0,
  }, result, lang);

  // 更新 D1
  const wordCount = result.replace(/[#*\-\s]/g, '').length;
  const now = new Date().toISOString();
  await env.DB.prepare(
    'UPDATE sections SET word_count = ?, updated_at = ? WHERE id = ?'
  ).bind(wordCount, now, body.section_id).run();

  await logEvent(env, 'draft.generated', body.work_id, body.section_id as string, `Draft v0 generated: ${section.title} (${wordCount} chars)`);

  return new Response(JSON.stringify(jsonSuccess({
    section_id: body.section_id,
    work_id: body.work_id,
    title: section.title,
    body: result,
    word_count: wordCount,
    version: 0,
    ai_generated: true,
  })), {
    headers: { 'Content-Type': 'application/json' },
  });
}

// POST /api/write/draft/check/{work_id}/{section_id}
export async function checkConsistency(env: Env, _request: Request, workId: string, sectionId: string): Promise<Response> {
  const section = await env.DB.prepare('SELECT id, title FROM sections WHERE id = ? AND work_id = ?').bind(sectionId, workId).first<Record<string, unknown>>();
  if (!section) {
    return new Response(JSON.stringify(jsonError(ErrorCodes.SECTION_NOT_FOUND, 'Section not found')), {
      status: 404, headers: { 'Content-Type': 'application/json' },
    });
  }

  const lang = extractLang(_request);
  const content = await readSectionMarkdown(env, workId, sectionId, lang);
  if (!content || !content.body) {
    return new Response(JSON.stringify(jsonError(ErrorCodes.INVALID_PARAMS, 'Section has no content to check')), {
      status: 400, headers: { 'Content-Type': 'application/json' },
    });
  }

  // 读取约束上下文（语言感知）
  let constraintsContext = '';
  const constraintsObj = await env.WORKS_BUCKET.get(workContentPath(workId, lang, 'constraints.json'));
  if (constraintsObj) {
    const constraints = JSON.parse(await constraintsObj.text());
    constraintsContext = (constraints || []).map((c: { section: string; rule: string }) => `- [${c.section}] ${c.rule}`).join('\n');
  }

  const sectionBody = content.body.substring(0, 4000);

  const prompt = `你是一位严谨的小说编辑。请检查以下章节内容是否与世界观设定一致。

${constraintsContext ? `【世界观约束】\n${constraintsContext}\n` : ''}

【章节内容】
${sectionBody}

请找出所有不一致的地方，按 JSON 格式输出（只输出 JSON）：
{
  "issues": [
    {
      "severity": "warning 或 error",
      "type": "character_inconsistency 或 world_rule_violation 或 timeline_conflict 或 plot_hole",
      "description": "描述",
      "location": "问题所在章节位置",
      "suggestion": "修改建议"
    }
  ]
}
如果没有问题，返回 {"issues": []}`;

  const result = await generateWithAI(env, prompt, { maxTokens: 1024 });
  if (!result) {
    return new Response(JSON.stringify(jsonError(ErrorCodes.AI_SERVICE_UNAVAILABLE, 'AI service unavailable')), {
      status: 503, headers: { 'Content-Type': 'application/json' },
    });
  }

  let issues: Array<Record<string, unknown>> = [];
  try {
    const jsonMatch = result.match(/\{[\s\S]*\}/);
    if (jsonMatch) issues = JSON.parse(jsonMatch[0]).issues || [];
  } catch { /* keep empty issues */ }

  // 缓存检查结果（语言感知）
  await env.WORKS_BUCKET.put(workContentPath(workId, lang, `checks/${sectionId}.json`), JSON.stringify(issues, null, 2), {
    httpMetadata: { contentType: 'application/json' },
  });

  return new Response(JSON.stringify(jsonSuccess({ work_id: workId, section_id: sectionId, issues })), {
    headers: { 'Content-Type': 'application/json' },
  });
}

// POST /api/write/draft/polish
export async function polishDraft(env: Env, request: Request): Promise<Response> {
  const body = await request.json() as { section_id: string; work_id: string; fix_issues?: Array<Record<string, unknown>>; style_notes?: string };
  if (!body.section_id || !body.work_id) {
    return new Response(JSON.stringify(jsonError(ErrorCodes.MISSING_REQUIRED_FIELD, 'section_id and work_id are required')), {
      status: 400, headers: { 'Content-Type': 'application/json' },
    });
  }

  const lang = extractLang(request);
  const content = await readSectionMarkdown(env, body.work_id, body.section_id, lang);
  if (!content || !content.body) {
    return new Response(JSON.stringify(jsonError(ErrorCodes.INVALID_PARAMS, 'Section has no content')), {
      status: 400, headers: { 'Content-Type': 'application/json' },
    });
  }

  const fixContext = (body.fix_issues || []).map((i, idx) => `${idx + 1}. [${i.severity}] ${i.description} → 建议: ${i.suggestion}`).join('\n');

  const prompt = `请润色以下小说章节。

${fixContext ? `【需要修复的问题】\n${fixContext}\n` : ''}
${body.style_notes ? `【风格要求】${body.style_notes}\n` : '保持原文风格'}

【原文】
${content.body}

请输出润色后的完整章节（Markdown 格式），不要输出其他内容。`;

  const result = await generateWithAI(env, prompt, { maxTokens: 4096 });
  if (!result) {
    return new Response(JSON.stringify(jsonError(ErrorCodes.AI_SERVICE_UNAVAILABLE, 'AI service unavailable')), {
      status: 503, headers: { 'Content-Type': 'application/json' },
    });
  }

  // 版本化写入（语言感知）
  await writeSectionContent(env, body.work_id, body.section_id, {
    ...(content.frontmatter || {}),
    version: 1,
    ai_polished: true,
  }, result, lang);

  const wordCount = result.replace(/[#*\-\s]/g, '').length;
  const now = new Date().toISOString();
  await env.DB.prepare('UPDATE sections SET word_count = ?, version = 1, updated_at = ? WHERE id = ?')
    .bind(wordCount, now, body.section_id).run();

  await logEvent(env, 'draft.polished', body.work_id, body.section_id, `Draft polished to v1: ${wordCount} chars`);

  return new Response(JSON.stringify(jsonSuccess({
    section_id: body.section_id,
    body: result,
    word_count: wordCount,
    version: 1,
  })), {
    headers: { 'Content-Type': 'application/json' },
  });
}

// GET /api/write/draft/output/{section_id}?lang=zh|en
export async function outputDraft(env: Env, request: Request, sectionId: string): Promise<Response> {
  const lang = extractLang(request);
  const section = await env.DB.prepare('SELECT id, work_id, title, word_count, version, section_summary FROM sections WHERE id = ?').bind(sectionId).first<Record<string, unknown>>();
  if (!section) {
    return new Response(JSON.stringify(jsonError(ErrorCodes.SECTION_NOT_FOUND, 'Section not found')), {
      status: 404, headers: { 'Content-Type': 'application/json' },
    });
  }

  const content = await readSectionMarkdown(env, section.work_id as string, sectionId, lang);

  // 读取检查结果（语言感知）
  let checkIssues: Array<Record<string, unknown>> = [];
  const checkObj = await env.WORKS_BUCKET.get(workContentPath(section.work_id as string, lang, `checks/${sectionId}.json`));
  if (checkObj) checkIssues = JSON.parse(await checkObj.text());

  return new Response(JSON.stringify(jsonSuccess({
    section_id: sectionId,
    title: section.title,
    body: content?.body || null,
    word_count: section.word_count,
    version: section.version,
    audit_report: {
      has_content: !!content?.body,
      consistency_issues: checkIssues,
      unresolved_issues: checkIssues.filter((i: Record<string, unknown>) => i.severity === 'error').length,
      ai_generated: content?.frontmatter ? (content.frontmatter as Record<string, unknown>).ai_generated || false : false,
      ai_polished: content?.frontmatter ? (content.frontmatter as Record<string, unknown>).ai_polished || false : false,
      disclaimer: '本内容由 AI 生成/辅助生成，建议人工终审。',
    },
  })), {
    headers: { 'Content-Type': 'application/json' },
  });
}

// POST /api/write/draft/rewrite/{section_id} — SF-035 章节重写
export async function rewriteSection(env: Env, request: Request, sectionId: string): Promise<Response> {
  const body = await request.json() as { work_id: string; style_notes?: string; instructions?: string };
  if (!body.work_id) {
    return new Response(JSON.stringify(jsonError(ErrorCodes.MISSING_REQUIRED_FIELD, 'work_id is required')), {
      status: 400, headers: { 'Content-Type': 'application/json' },
    });
  }

  const lang = extractLang(request);

  const section = await env.DB.prepare(
    'SELECT id, title, order_index, section_summary, version FROM sections WHERE id = ? AND work_id = ?'
  ).bind(sectionId, body.work_id).first<{ id: string; title: string; order_index: number; section_summary: string; version: number }>();
  if (!section) {
    return new Response(JSON.stringify(jsonError(ErrorCodes.SECTION_NOT_FOUND, 'Section not found')), {
      status: 404, headers: { 'Content-Type': 'application/json' },
    });
  }

  const work = await env.DB.prepare('SELECT id, title, category FROM works WHERE id = ?').bind(body.work_id).first<Record<string, unknown>>();
  if (!work) {
    return new Response(JSON.stringify(jsonError(ErrorCodes.WORK_NOT_FOUND, 'Work not found')), {
      status: 404, headers: { 'Content-Type': 'application/json' },
    });
  }

  // 读取原有意图卡（语言感知）
  const intentsKey = workContentPath(body.work_id, lang, `intents/${sectionId}.json`);
  let intentCard: Record<string, unknown> = {};
  try {
    const intentObj = await env.WORKS_BUCKET.get(intentsKey);
    if (intentObj) intentCard = await intentObj.json() as Record<string, unknown>;
  } catch { /* 无意图卡也继续 */ }

  // 读取现有内容（语言感知）
  const existingContent = await readSectionMarkdown(env, body.work_id, sectionId, lang);

  // 收集上下文（语言感知）
  const wbObj = await env.WORKS_BUCKET.get(workContentPath(body.work_id, lang, 'world_bible.md'));
  const worldContext = wbObj ? (await wbObj.text()).substring(0, 2000) : '(无世界观)';

  const prevSections = await env.DB.prepare(
    'SELECT title, section_summary FROM sections WHERE work_id = ? AND order_index < ? ORDER BY order_index DESC LIMIT 3'
  ).bind(body.work_id, section.order_index).all<{ title: string; section_summary: string }>();

  const prevContext = (prevSections.results || []).reverse()
    .map(s => `「${s.title}」: ${s.section_summary || '(无摘要)'}`).join('\n');

  const intentContext = intentCard.goal
    ? `本章意图：${intentCard.goal}${intentCard.hooks ? '\n埋钩子：' + JSON.stringify(intentCard.hooks) : ''}${intentCard.foreshadowing_ids ? '\n回收伏笔：' + JSON.stringify(intentCard.foreshadowing_ids) : ''}`
    : '(无意图卡)';

  const prompt = `你是一位专业小说作家。请为以下章节重新撰写正文。

## 作品信息
标题：${work.title || '未知'}
类别：${work.category || '未知'}

## 世界观约束
${worldContext}

## 前文概要
${prevContext || '(此为开头章节)'}

## 本章信息
标题：${section.title}
简介：${section.section_summary || '(无)'}
${intentContext}

${body.instructions ? `## 重写要求\n${body.instructions}` : ''}
${body.style_notes ? `## 风格备注\n${body.style_notes}` : ''}

${existingContent?.body ? `## 当前版本（供参考，请改进）\n${existingContent.body.substring(0, 1500)}` : ''}

请直接用 Markdown 格式写出本章正文。不要输出 JSON 包装，直接输出章节内容。`;

  const result = await generateWithAI(env, prompt, { maxTokens: 4096 });
  if (!result) {
    return new Response(JSON.stringify(jsonError(ErrorCodes.AI_SERVICE_UNAVAILABLE, 'AI service unavailable')), {
      status: 503, headers: { 'Content-Type': 'application/json' },
    });
  }

  const newVersion = (section.version || 0) + 1;
  const frontmatter = {
    title: section.title,
    order_index: section.order_index,
    ai_generated: true,
    ai_rewritten: true,
    version: newVersion,
    rewritten_at: new Date().toISOString(),
  };

  const r2Key = await writeSectionContent(env, body.work_id, sectionId, frontmatter, result, lang);

  const wordCount = result.replace(/[#*\-\s]/g, '').length;
  await env.DB.prepare(
    'UPDATE sections SET word_count = ?, version = ?, updated_at = ? WHERE id = ?'
  ).bind(wordCount, newVersion, new Date().toISOString(), sectionId).run();

  await logEvent(env, 'draft.rewritten', body.work_id, sectionId, `Chapter rewritten to v${newVersion}: ${section.title} (${wordCount} chars)`);

  return new Response(JSON.stringify(jsonSuccess({
    section_id: sectionId,
    work_id: body.work_id,
    title: section.title,
    body: result,
    word_count: wordCount,
    version: newVersion,
    r2_object_key: r2Key,
  })), {
    status: 201, headers: { 'Content-Type': 'application/json' },
  });
}
