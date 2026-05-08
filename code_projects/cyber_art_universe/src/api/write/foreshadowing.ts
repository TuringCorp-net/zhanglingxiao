// Story Forger — 伏笔账本 (SF-023)
// AI 从章节中提取伏笔线索，追踪埋点与回收状态
import { Env } from '../../db/schema';
import { jsonSuccess, jsonError } from '../../lib/response';
import { ErrorCodes } from '../../lib/errors';
import { generateWithAI } from '../../lib/ai';

const FORESHADOWING_KEY = (workId: string) => `works/${workId}/foreshadowing.json`;

// POST /api/write/foreshadowing/generate
export async function generateForeshadowing(env: Env, request: Request): Promise<Response> {
  const body = await request.json() as { work_id: string; style_notes?: string };
  if (!body.work_id) {
    return new Response(JSON.stringify(jsonError(ErrorCodes.MISSING_REQUIRED_FIELD, 'work_id is required')), {
      status: 400, headers: { 'Content-Type': 'application/json' },
    });
  }

  // 作品存在性检查
  const work = await env.DB.prepare('SELECT id, title FROM works WHERE id = ?').bind(body.work_id).first();
  if (!work) {
    return new Response(JSON.stringify(jsonError(ErrorCodes.WORK_NOT_FOUND, 'Work not found')), {
      status: 404, headers: { 'Content-Type': 'application/json' },
    });
  }

  // overwrite 保护
  const url = new URL(request.url);
  if (url.searchParams.get('overwrite') !== 'true') {
    const existing = await env.WORKS_BUCKET.get(FORESHADOWING_KEY(body.work_id));
    if (existing) {
      return new Response(JSON.stringify(jsonError(ErrorCodes.RESOURCE_CONFLICT, '伏笔账本已存在。使用 ?overwrite=true 重新生成')), {
        status: 409, headers: { 'Content-Type': 'application/json' },
      });
    }
  }

  // 收集上下文：所有章节摘要
  const sections = await env.DB.prepare(
    'SELECT id, title, order_index, section_summary, word_count FROM sections WHERE work_id = ? ORDER BY order_index'
  ).bind(body.work_id).all<{ id: string; title: string; order_index: number; section_summary: string; word_count: number }>();

  const chapterContexts = (sections.results || []).map(s =>
    `第${s.order_index + 1}章「${s.title}」: ${s.section_summary || '(无摘要)'}`
  ).join('\n');

  if ((sections.results || []).length === 0) {
    return new Response(JSON.stringify(jsonError(ErrorCodes.WORK_NOT_PUBLISHABLE, '作品无章节，无法提取伏笔线索')), {
      status: 400, headers: { 'Content-Type': 'application/json' },
    });
  }

  const prompt = `你是一位资深故事编辑。请仔细阅读以下章节摘要，提取所有伏笔线索（foreshadowing hooks）。

伏笔的定义：
- 作者在早期章节中埋下的暗示、悬念、未解之谜
- 一个角色说/做的某件事，暗示未来会发生的事
- 悬而未决的冲突或问题
- 反复出现的意象或主题元素

对每条伏笔，请判断其"回收状态"：
- "planted" — 已埋下，尚未回收
- "developing" — 正在发展中
- "resolved" — 已回收/解答

${body.style_notes ? `作者备注：${body.style_notes}` : ''}

## 章节摘要
${chapterContexts.substring(0, 4000)}

请严格按以下 JSON 格式输出，不要包含任何其他文本：
{
  "hooks": [
    {
      "id": "h_001",
      "description": "伏笔描述（一句话）",
      "planted_in": "埋在第几章（如 第1章）",
      "expected_payoff_in": "预计在第几章回收，如不确定填 'unknown'",
      "status": "planted | developing | resolved",
      "notes": "补充说明"
    }
  ]
}`;

  const result = await generateWithAI(env, prompt, { maxTokens: 2048 });
  if (!result) {
    return new Response(JSON.stringify(jsonError(ErrorCodes.AI_SERVICE_UNAVAILABLE, 'AI service unavailable')), {
      status: 503, headers: { 'Content-Type': 'application/json' },
    });
  }

  let parsed: { hooks?: Array<Record<string, unknown>> };
  try {
    const jsonMatch = result.match(/\{[\s\S]*\}/);
    if (jsonMatch) parsed = JSON.parse(jsonMatch[0]);
    else parsed = {};
  } catch {
    return new Response(JSON.stringify(jsonError(ErrorCodes.EXTERNAL_SERVICE_ERROR, 'AI returned invalid JSON')), {
      status: 500, headers: { 'Content-Type': 'application/json' },
    });
  }

  const hooks = parsed.hooks || [];
  const summary = {
    total: hooks.length,
    planted: hooks.filter((h: Record<string, unknown>) => h.status === 'planted').length,
    developing: hooks.filter((h: Record<string, unknown>) => h.status === 'developing').length,
    resolved: hooks.filter((h: Record<string, unknown>) => h.status === 'resolved').length,
  };

  const data = { work_id: body.work_id, hooks, summary, generated_at: new Date().toISOString() };

  try {
    await env.WORKS_BUCKET.put(FORESHADOWING_KEY(body.work_id), JSON.stringify(data, null, 2), {
      httpMetadata: { contentType: 'application/json' },
    });
  } catch (err) {
    console.error('R2 write failed for foreshadowing.json:', body.work_id, err);
  }

  return new Response(JSON.stringify(jsonSuccess(data)), {
    status: 201, headers: { 'Content-Type': 'application/json' },
  });
}

// GET /api/write/foreshadowing/{work_id}
export async function readForeshadowing(env: Env, _request: Request, workId: string): Promise<Response> {
  const obj = await env.WORKS_BUCKET.get(FORESHADOWING_KEY(workId));
  if (!obj) {
    return new Response(JSON.stringify(jsonSuccess({
      work_id: workId,
      hooks: [],
      summary: { total: 0, planted: 0, developing: 0, resolved: 0 },
      message: '伏笔账本尚未生成。使用 POST /api/write/foreshadowing/generate 生成',
    })), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const text = await obj.text();
  return new Response(JSON.stringify(jsonSuccess(JSON.parse(text))), {
    headers: { 'Content-Type': 'application/json' },
  });
}
