// 世界观引擎 — SF-010~012
import { Env } from '../../db/schema';
import { jsonSuccess, jsonError } from '../../lib/response';
import { ErrorCodes } from '../../lib/errors';
import { generateWithAI } from '../../lib/ai';

const WORLD_BIBLE_KEY = (workId: string) => `works/${workId}/world_bible.md`;
const CONSTRAINTS_KEY = (workId: string) => `works/${workId}/constraints.json`;

// POST /api/write/worldbuilding/generate
export async function generateWorldbuilding(env: Env, request: Request): Promise<Response> {
  const body = await request.json() as { work_id: string; prompt?: string; style_notes?: string };
  if (!body.work_id) {
    return new Response(JSON.stringify(jsonError(ErrorCodes.MISSING_REQUIRED_FIELD, 'work_id is required')), {
      status: 400, headers: { 'Content-Type': 'application/json' },
    });
  }

  const work = await env.DB.prepare('SELECT id, title, category, summary FROM works WHERE id = ?').bind(body.work_id).first<Record<string, unknown>>();
  if (!work) {
    return new Response(JSON.stringify(jsonError(ErrorCodes.WORK_NOT_FOUND, 'Work not found')), {
      status: 404, headers: { 'Content-Type': 'application/json' },
    });
  }

  // 收集上下文：已有实体 + 大纲
  const entities = await env.DB.prepare('SELECT name, type, description FROM entities WHERE work_id = ?').bind(body.work_id).all<Record<string, unknown>>();
  const sections = await env.DB.prepare('SELECT title, section_summary FROM sections WHERE work_id = ? ORDER BY order_index LIMIT 3').bind(body.work_id).all<Record<string, unknown>>();

  const entityContext = (entities.results || []).map(e => `- ${e.name}(${e.type}): ${e.description || '暂无描述'}`).join('\n');
  const outlineContext = (sections.results || []).map(s => `- ${s.title}: ${s.section_summary || ''}`).join('\n');

  const prompt = `你是一位专业的小说世界观设计师。请根据以下信息，为作品《${work.title}》生成一份结构化的世界观设定圣经（Setting Bible）。

作品题材：${work.category || '未指定'}
作品简介：${work.summary || '未提供'}
作者补充：${body.prompt || '无'}
风格要求：${body.style_notes || '专业、详细'}

${entityContext ? `已有角色/实体：\n${entityContext}` : ''}
${outlineContext ? `已有章节概要：\n${outlineContext}` : ''}

请按以下结构输出 Markdown：

# 世界观设定圣经

## 世界规则与边界
（力量体系/技术体系/组织结构/社会规则/禁忌与代价）

## 核心主题与价值观
（作品要传达的核心命题、情感基调、叙事立场）

## 角色体系
（主角与核心配角的人设、动机、能力边界、关系网、成长弧线）

## 场景与资源
（主要地点、关键道具/技能、可被反复使用的叙事资源）

## 承诺清单
（开篇对读者许诺了什么爽点或价值，后续必须兑现）

## 禁区与风格
（不能触碰的内容、语言风格、节奏偏好）`;

  const result = await generateWithAI(env, prompt, { maxTokens: 4096 });
  if (!result) {
    return new Response(JSON.stringify(jsonError(ErrorCodes.AI_SERVICE_UNAVAILABLE, 'AI service unavailable')), {
      status: 503, headers: { 'Content-Type': 'application/json' },
    });
  }

  // 写入 R2
  try {
    await env.WORKS_BUCKET.put(WORLD_BIBLE_KEY(body.work_id), result, {
      httpMetadata: { contentType: 'text/markdown; charset=utf-8' },
    });
  } catch (err) {
    console.error('R2 write failed for world_bible.md:', body.work_id, err);
  }

  // 提取约束
  const constraints = extractConstraints(result);
  try {
    await env.WORKS_BUCKET.put(CONSTRAINTS_KEY(body.work_id), JSON.stringify(constraints, null, 2), {
      httpMetadata: { contentType: 'application/json' },
    });
  } catch (err) {
    console.error('R2 write failed for constraints.json:', body.work_id, err);
  }

  return new Response(JSON.stringify(jsonSuccess({
    work_id: body.work_id,
    content: result,
    constraints,
  })), {
    headers: { 'Content-Type': 'application/json' },
  });
}

// GET /api/write/worldbuilding/{work_id}
export async function readWorldbuilding(env: Env, _request: Request, workId: string): Promise<Response> {
  const obj = await env.WORKS_BUCKET.get(WORLD_BIBLE_KEY(workId));
  if (!obj) {
    return new Response(JSON.stringify(jsonSuccess({ work_id: workId, content: null, message: '世界观尚未生成' })), {
      headers: { 'Content-Type': 'application/json' },
    });
  }
  const content = await obj.text();
  return new Response(JSON.stringify(jsonSuccess({ work_id: workId, content })), {
    headers: { 'Content-Type': 'application/json' },
  });
}

// PUT /api/write/worldbuilding/{work_id}
export async function updateWorldbuilding(env: Env, request: Request, workId: string): Promise<Response> {
  const body = await request.json() as { content: string };
  if (!body.content) {
    return new Response(JSON.stringify(jsonError(ErrorCodes.MISSING_REQUIRED_FIELD, 'content is required')), {
      status: 400, headers: { 'Content-Type': 'application/json' },
    });
  }

  await env.WORKS_BUCKET.put(WORLD_BIBLE_KEY(workId), body.content, {
    httpMetadata: { contentType: 'text/markdown; charset=utf-8' },
  });

  const constraints = extractConstraints(body.content);
  await env.WORKS_BUCKET.put(CONSTRAINTS_KEY(workId), JSON.stringify(constraints, null, 2), {
    httpMetadata: { contentType: 'application/json' },
  });

  return new Response(JSON.stringify(jsonSuccess({ work_id: workId, updated: true, constraints })), {
    headers: { 'Content-Type': 'application/json' },
  });
}

// GET /api/write/worldbuilding/{work_id}/constraints
export async function readConstraints(env: Env, _request: Request, workId: string): Promise<Response> {
  const obj = await env.WORKS_BUCKET.get(CONSTRAINTS_KEY(workId));
  if (!obj) {
    return new Response(JSON.stringify(jsonSuccess({ work_id: workId, constraints: [], message: '约束尚未提取，请先生成世界观' })), {
      headers: { 'Content-Type': 'application/json' },
    });
  }
  const data = await obj.text();
  return new Response(data, {
    headers: { 'Content-Type': 'application/json' },
  });
}

// 简单的约束提取：从 Markdown 中找出规则/禁忌
function extractConstraints(md: string): { section: string; rule: string }[] {
  const constraints: { section: string; rule: string }[] = [];
  const lines = md.split('\n');
  let currentSection = '';

  for (const line of lines) {
    if (line.startsWith('## ')) {
      currentSection = line.replace('## ', '').trim();
    }
    // 匹配列表项：- xxx 或 * xxx
    const match = line.match(/^[-*]\s+(.+)/);
    if (match && currentSection) {
      const rule = match[1].trim();
      if (rule.length > 5 && rule.length < 200) {
        constraints.push({ section: currentSection, rule });
      }
    }
  }

  return constraints;
}
