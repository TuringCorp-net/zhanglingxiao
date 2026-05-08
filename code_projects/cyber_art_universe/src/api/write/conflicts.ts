// Story Forger — 冲突地图 (SF-024)
// AI 生成主线/支线冲突的起因—升级—代价—回收路径
import { Env } from '../../db/schema';
import { jsonSuccess, jsonError } from '../../lib/response';
import { ErrorCodes } from '../../lib/errors';
import { generateWithAI } from '../../lib/ai';

const CONFLICTS_KEY = (workId: string) => `works/${workId}/conflicts.json`;

// POST /api/write/conflicts/generate
export async function generateConflicts(env: Env, request: Request): Promise<Response> {
  const body = await request.json() as { work_id: string; style_notes?: string };
  if (!body.work_id) {
    return new Response(JSON.stringify(jsonError(ErrorCodes.MISSING_REQUIRED_FIELD, 'work_id is required')), {
      status: 400, headers: { 'Content-Type': 'application/json' },
    });
  }

  const work = await env.DB.prepare('SELECT id, title FROM works WHERE id = ?').bind(body.work_id).first();
  if (!work) {
    return new Response(JSON.stringify(jsonError(ErrorCodes.WORK_NOT_FOUND, 'Work not found')), {
      status: 404, headers: { 'Content-Type': 'application/json' },
    });
  }

  const url = new URL(request.url);
  if (url.searchParams.get('overwrite') !== 'true') {
    const existing = await env.WORKS_BUCKET.get(CONFLICTS_KEY(body.work_id));
    if (existing) {
      return new Response(JSON.stringify(jsonError(ErrorCodes.RESOURCE_CONFLICT, '冲突地图已存在。使用 ?overwrite=true 重新生成')), {
        status: 409, headers: { 'Content-Type': 'application/json' },
      });
    }
  }

  // 收集章节和人物上下文
  const sections = await env.DB.prepare(
    'SELECT id, title, order_index, section_summary FROM sections WHERE work_id = ? ORDER BY order_index'
  ).bind(body.work_id).all<{ id: string; title: string; order_index: number; section_summary: string }>();

  const chapterText = (sections.results || []).map(s =>
    `第${s.order_index + 1}章「${s.title}」: ${s.section_summary || '(无摘要)'}`
  ).join('\n');

  const entities = await env.DB.prepare(
    'SELECT name, type, description FROM entities WHERE work_id = ?'
  ).bind(body.work_id).all<{ name: string; type: string; description: string }>();

  const characterText = (entities.results || [])
    .filter(e => e.type === 'character')
    .map(e => `${e.name}: ${e.description || '(无描述)'}`)
    .join('\n');

  if ((sections.results || []).length === 0) {
    return new Response(JSON.stringify(jsonError(ErrorCodes.WORK_NOT_PUBLISHABLE, '作品无章节，无法生成冲突地图')), {
      status: 400, headers: { 'Content-Type': 'application/json' },
    });
  }

  const prompt = `你是一位资深故事结构分析师。请根据以下章节摘要和角色信息，分析故事中的冲突结构。

冲突地图要覆盖：
- 主线冲突（main）：推动故事主轴的冲突
- 支线冲突（sub）：次要情节线的冲突
- 内部冲突（internal）：角色的内心挣扎

每条冲突请分析：
- 起因（what triggers it）
- 升级路径（how it escalates）
- 代价（what the character loses/risks）
- 回收路径（how it resolves or is expected to resolve）

${body.style_notes ? `作者备注：${body.style_notes}` : ''}

## 角色信息
${characterText.substring(0, 1500)}

## 章节摘要
${chapterText.substring(0, 3000)}

请严格按以下 JSON 格式输出，不要包含任何其他文本：
{
  "conflicts": [
    {
      "id": "c_001",
      "name": "冲突名称",
      "type": "main | sub | internal",
      "cause": "起因（一句话）",
      "escalation": "升级路径",
      "cost": "角色付出的代价",
      "resolution_path": "回收路径（已知或推测）",
      "involved_characters": ["角色名"],
      "arcs": ["所属情节线"]
    }
  ]
}`;

  const result = await generateWithAI(env, prompt, { maxTokens: 2048 });
  if (!result) {
    return new Response(JSON.stringify(jsonError(ErrorCodes.AI_SERVICE_UNAVAILABLE, 'AI service unavailable')), {
      status: 503, headers: { 'Content-Type': 'application/json' },
    });
  }

  let parsed: { conflicts?: Array<Record<string, unknown>> };
  try {
    const jsonMatch = result.match(/\{[\s\S]*\}/);
    if (jsonMatch) parsed = JSON.parse(jsonMatch[0]);
    else parsed = {};
  } catch {
    return new Response(JSON.stringify(jsonError(ErrorCodes.EXTERNAL_SERVICE_ERROR, 'AI returned invalid JSON')), {
      status: 500, headers: { 'Content-Type': 'application/json' },
    });
  }

  const conflicts = parsed.conflicts || [];
  const summary = {
    total: conflicts.length,
    main: conflicts.filter((c: Record<string, unknown>) => c.type === 'main').length,
    sub: conflicts.filter((c: Record<string, unknown>) => c.type === 'sub').length,
    internal: conflicts.filter((c: Record<string, unknown>) => c.type === 'internal').length,
  };

  const data = { work_id: body.work_id, conflicts, summary, generated_at: new Date().toISOString() };

  try {
    await env.WORKS_BUCKET.put(CONFLICTS_KEY(body.work_id), JSON.stringify(data, null, 2), {
      httpMetadata: { contentType: 'application/json' },
    });
  } catch (err) {
    console.error('R2 write failed for conflicts.json:', body.work_id, err);
  }

  return new Response(JSON.stringify(jsonSuccess(data)), {
    status: 201, headers: { 'Content-Type': 'application/json' },
  });
}

// GET /api/write/conflicts/{work_id}
export async function readConflicts(env: Env, _request: Request, workId: string): Promise<Response> {
  const obj = await env.WORKS_BUCKET.get(CONFLICTS_KEY(workId));
  if (!obj) {
    return new Response(JSON.stringify(jsonSuccess({
      work_id: workId,
      conflicts: [],
      summary: { total: 0, main: 0, sub: 0, internal: 0 },
      message: '冲突地图尚未生成。使用 POST /api/write/conflicts/generate 生成',
    })), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const text = await obj.text();
  return new Response(JSON.stringify(jsonSuccess(JSON.parse(text))), {
    headers: { 'Content-Type': 'application/json' },
  });
}
