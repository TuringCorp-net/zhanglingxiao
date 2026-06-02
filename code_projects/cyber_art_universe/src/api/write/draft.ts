// 章节生产流水线 — SF-030~034（多语言支持 + JSON 输出统一）
import { Env } from '../../db/schema';
import { jsonSuccess, jsonError } from '../../lib/response';
import { ErrorCodes } from '../../lib/errors';
import { callAI, generateWithAI } from '../../lib/ai';
import { renderTemplate as renderText } from '../../lib/l1/render';
import draftCheckMd from '../../lib/l1/prompts/tools/draft_check.md';
import draftPolishMd from '../../lib/l1/prompts/tools/draft_polish.md';
import draftRewriteMd from '../../lib/l1/prompts/tools/draft_rewrite.md';
import { writeSectionContent, readSectionMarkdown, workContentPath, extractLang, readR2JSONWithLangFallback } from '../../lib/l1/work-content';
import { extractTemplateJson } from '../../lib/l1/template';

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
// ============================================================
export async function readIntent(env: Env, request: Request, workId: string, sectionId: string): Promise<Response> {
  const lang = extractLang(request);
  const { data: intent, actualLang } = await readR2JSONWithLangFallback(env, workId, lang, `intents/${sectionId}.json`);

  if (!intent) {
    return new Response(JSON.stringify(jsonSuccess({
      work_id: workId,
      section_id: sectionId,
      lang: actualLang,
      intent: null,
      is_empty: true,
      message: lang === 'en'
        ? 'Intent card not yet created for this chapter.'
        : '本章尚未创建意图卡。',
    })), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify(jsonSuccess({
    work_id: workId,
    section_id: sectionId,
    lang: actualLang,
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
    goal?: { advance_conflict?: string; reveal_info?: string; create_suspense?: string };
    emotional_goal?: string;
    pov_character?: string; pov_strategy?: string;
    structure?: { opening_hook?: string; reversal_point?: string; cliffhanger?: string };
    foreshadowing_triggered?: { hook_id: string; action: string }[];
    promise_checklist_refs?: string[];
    characters_involved?: string[];
    estimated_words?: number;
    visual_keywords?: string[]; camera_notes?: string;
    gameplay_goal?: string; player_learning_goal?: string;
    branching?: string; scene_type?: string;
    style_notes?: string;
  };
  if (!body.work_id) {
    return new Response(JSON.stringify(jsonError(ErrorCodes.MISSING_REQUIRED_FIELD, 'work_id is required')), {
      status: 400, headers: { 'Content-Type': 'application/json' },
    });
  }

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
    goal: body.goal || {},
    emotional_goal: body.emotional_goal || null,
    pov_character: body.pov_character || null,
    pov_strategy: body.pov_strategy || null,
    structure: body.structure || {},
    foreshadowing_triggered: body.foreshadowing_triggered || [],
    promise_checklist_refs: body.promise_checklist_refs || [],
    characters_involved: body.characters_involved || [],
    estimated_words: body.estimated_words || null,
    visual_keywords: body.visual_keywords || null,
    camera_notes: body.camera_notes || null,
    gameplay_goal: body.gameplay_goal || null,
    player_learning_goal: body.player_learning_goal || null,
    branching: body.branching || null,
    scene_type: body.scene_type || null,
    style_notes: body.style_notes || null,
    free_content: (body as { free_content?: string }).free_content || null,
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

// ============================================================
// POST /api/write/draft/check/{work_id}/{section_id}
// ============================================================
export async function checkConsistency(env: Env, request: Request, workId: string, sectionId: string): Promise<Response> {
  const section = await env.DB.prepare('SELECT id, title FROM sections WHERE id = ? AND work_id = ?').bind(sectionId, workId).first<Record<string, unknown>>();
  if (!section) {
    return new Response(JSON.stringify(jsonError(ErrorCodes.SECTION_NOT_FOUND, 'Section not found')), {
      status: 404, headers: { 'Content-Type': 'application/json' },
    });
  }

  const lang = extractLang(request);
  const content = await readSectionMarkdown(env, workId, sectionId, lang);
  if (!content || !content.body) {
    return new Response(JSON.stringify(jsonError(ErrorCodes.INVALID_PARAMS, 'Section has no content to check')), {
      status: 400, headers: { 'Content-Type': 'application/json' },
    });
  }

  // 读取约束上下文
  let constraintsContext = '';
  const constraintsObj = await env.WORKS_BUCKET.get(workContentPath(workId, lang, 'constraints.json'));
  if (constraintsObj) {
    const constraints = JSON.parse(await constraintsObj.text());
    constraintsContext = (constraints || []).map((c: { section: string; rule: string }) => `- [${c.section}] ${c.rule}`).join('\n');
  }

  const sectionBody = content.body.substring(0, 4000);

  const prompt = renderText(draftCheckMd, {
    world_context: constraintsContext ? `【世界观约束】\n${constraintsContext}\n` : '',
    chapter_content: sectionBody,
    prev_context: '',
    intent_context: '',
  });

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

  const prompt = renderText(draftPolishMd, {
    style_notes: body.style_notes ? `【风格要求】${body.style_notes}` : '保持原文风格',
    fixes_section: fixContext ? `【需要修复的问题】\n${fixContext}` : '',
    chapter_content: content.body,
  });

  const aiResult = await callAI(env, [{ role: 'user', content: prompt }], {
    maxTokens: 4096,
    responseFormat: 'json',
  });

  if (!aiResult?.content) {
    return new Response(JSON.stringify(jsonError(ErrorCodes.AI_SERVICE_UNAVAILABLE, 'AI service unavailable')), {
      status: 503, headers: { 'Content-Type': 'application/json' },
    });
  }

  const parsed = extractTemplateJson(aiResult.content);
  const chapterBody = parsed?.slots?.content || aiResult.content;

  await writeSectionContent(env, body.work_id, body.section_id, {
    ...(content.frontmatter || {}),
    version: 1,
    ai_polished: true,
  }, chapterBody, lang);

  const wordCount = chapterBody.replace(/[#*\-\s]/g, '').length;
  const now = new Date().toISOString();
  await env.DB.prepare('UPDATE sections SET word_count = ?, version = 1, updated_at = ? WHERE id = ?')
    .bind(wordCount, now, body.section_id).run();

  await logEvent(env, 'draft.polished', body.work_id, body.section_id, `Draft polished to v1: ${wordCount} chars`);

  return new Response(JSON.stringify(jsonSuccess({
    section_id: body.section_id,
    body: chapterBody,
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

  // 读取意图卡
  const intentsKey = workContentPath(body.work_id, lang, `intents/${sectionId}.json`);
  let intentCard: Record<string, unknown> = {};
  try {
    const intentObj = await env.WORKS_BUCKET.get(intentsKey);
    if (intentObj) intentCard = await intentObj.json() as Record<string, unknown>;
  } catch { /* 无意图卡也继续 */ }

  // 读取现有内容
  const existingContent = await readSectionMarkdown(env, body.work_id, sectionId, lang);

  // 收集上下文
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

  const prompt = renderText(draftRewriteMd, {
    world_context: worldContext ? `## 世界观约束\n${worldContext}` : '',
    prev_context: prevContext ? `## 前文概要\n${prevContext}` : '(此为开头章节)',
    intent_context: intentContext || '',
    reference_content: existingContent?.body ? `## 当前版本（供参考，请改进）\n${existingContent.body.substring(0, 1500)}` : '',
    instructions_section: body.instructions ? `## 重写要求\n${body.instructions}` : '',
  });

  const aiResult = await callAI(env, [{ role: 'user', content: prompt }], {
    maxTokens: 4096,
    responseFormat: 'json',
  });

  if (!aiResult?.content) {
    return new Response(JSON.stringify(jsonError(ErrorCodes.AI_SERVICE_UNAVAILABLE, 'AI service unavailable')), {
      status: 503, headers: { 'Content-Type': 'application/json' },
    });
  }

  const parsed = extractTemplateJson(aiResult.content);
  const chapterBody = parsed?.slots?.content || aiResult.content;

  const newVersion = (section.version || 0) + 1;
  const frontmatter = {
    title: section.title,
    order_index: section.order_index,
    ai_generated: true,
    ai_rewritten: true,
    version: newVersion,
    rewritten_at: new Date().toISOString(),
  };

  const r2Key = await writeSectionContent(env, body.work_id, sectionId, frontmatter, chapterBody, lang);

  const wordCount = chapterBody.replace(/[#*\-\s]/g, '').length;
  await env.DB.prepare(
    'UPDATE sections SET word_count = ?, version = ?, updated_at = ? WHERE id = ?'
  ).bind(wordCount, newVersion, new Date().toISOString(), sectionId).run();

  await logEvent(env, 'draft.rewritten', body.work_id, sectionId, `Chapter rewritten to v${newVersion}: ${section.title} (${wordCount} chars)`);

  return new Response(JSON.stringify(jsonSuccess({
    section_id: sectionId,
    work_id: body.work_id,
    title: section.title,
    body: chapterBody,
    word_count: wordCount,
    version: newVersion,
    r2_object_key: r2Key,
  })), {
    status: 201, headers: { 'Content-Type': 'application/json' },
  });
}
