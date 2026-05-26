// Story Forger — 智能提示系统（静态 + AI 动态，中英双语配对）
// 静态提示：R2 system/hints/{module}.json  → [{"zh":"...","en":"..."},...]
// 动态提示：R2 works/{wid}/hints/{module}.json  → [{"zh":"...","en":"..."},...]
//   由 Story Elf 内部生成，非公开 API（无 POST 端点）

import { Env } from '../../db/schema';
import { jsonSuccess, jsonError } from '../../lib/response';
import { ErrorCodes } from '../../lib/errors';
import { generateWithAI } from '../../lib/ai';
import { renderTemplate as renderText } from '../../lib/l1/render';
import hintsDynamicMd from '../../lib/l1/prompts/tools/hints_dynamic.md';
import { extractLang, type Lang, LANG_LABELS } from '../../lib/work_content';

const HINT_MODULES = ['m0', 'm1', 'm2'] as const;

type HintPair = { zh: string; en: string };

// 从配对数组中按语言提取扁平列表
function extractLangHints(raw: HintPair[] | string[], lang: Lang): string[] {
  if (!Array.isArray(raw) || raw.length === 0) return [];
  if (typeof raw[0] === 'object' && (raw[0] as HintPair).zh) {
    return (raw as HintPair[]).map(h => h[lang] || h['zh'] || '');
  }
  return raw as string[];
}

// ============================================================
// GET /api/write/hints/{module}?work_id=xxx&lang=zh
// ============================================================

export async function readHints(env: Env, request: Request, module: string): Promise<Response> {
  if (!HINT_MODULES.includes(module as typeof HINT_MODULES[number])) {
    return new Response(JSON.stringify(jsonError(ErrorCodes.INVALID_PARAMS, `Invalid module: ${module}. Use m0/m1/m2`)), {
      status: 400, headers: { 'Content-Type': 'application/json' },
    });
  }

  const url = new URL(request.url);
  const workId = url.searchParams.get('work_id') || '';
  const lang = extractLang(request);

  // 静态提示（双语配对格式）
  let staticHints: string[] = [];
  try {
    const obj = await env.WORKS_BUCKET.get(`system/hints/${module}.json`);
    if (obj) {
      staticHints = extractLangHints(JSON.parse(await obj.text()), lang);
    }
  } catch (e) { /* 容错 */ }

  // 动态提示（双语配对格式，无 lang 在路径中）
  let dynamicHints: string[] = [];
  if (workId) {
    try {
      const obj = await env.WORKS_BUCKET.get(`works/${workId}/hints/${module}.json`);
      if (obj) {
        dynamicHints = extractLangHints(JSON.parse(await obj.text()), lang);
      }
    } catch (e) { /* 容错 */ }
  }

  return new Response(JSON.stringify(jsonSuccess({
    module,
    work_id: workId || null,
    lang,
    static: staticHints,
    dynamic: dynamicHints,
    all: [...staticHints, ...dynamicHints],
    total: staticHints.length + dynamicHints.length,
  })), {
    headers: { 'Content-Type': 'application/json' },
  });
}

// ============================================================
// 内部函数：Story Elf 生成双语提示，追加到 R2
// 由 elf_chat.ts 在合适的时机调用，非公开 API
// ============================================================

export async function appendDynamicHint(
  env: Env, workId: string, module: string,
  workTitle: string, workCategory: string,
  contextSnippet: string
): Promise<HintPair | null> {
  if (!HINT_MODULES.includes(module as typeof HINT_MODULES[number])) return null;

  const modLabel = { m0: '原始构想 / Original Concept',
    m1: '世界观设定 / Setting Bible',
    m2: '长篇大纲 / Story Outline' }[module];

  const prompt = renderText(hintsDynamicMd, {
    work_title: workTitle || '未命名作品',
    category: workCategory || '未指定',
    module_label: modLabel,
    context_snippet: contextSnippet ? `当前内容供参考：\n${contextSnippet}` : '',
  });

  const result = await generateWithAI(env, prompt, { maxTokens: 300 });
  if (!result || !result.trim()) return null;

  let pair: HintPair | null = null;
  try {
    const jsonMatch = result.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      if (parsed.zh && parsed.en) {
        pair = { zh: parsed.zh.trim(), en: parsed.en.trim() };
      }
    }
  } catch (e) {
    // 尝试直接当纯文本处理
    const lines = result.trim().split('\n');
    if (lines.length >= 2) {
      pair = { zh: lines[0].trim(), en: lines[1].trim() };
    }
  }

  if (!pair) return null;

  // 追加到 R2（双语配对，无 lang 路径）
  const dynKey = `works/${workId}/hints/${module}.json`;
  let dynamicHints: HintPair[] = [];
  try {
    const existing = await env.WORKS_BUCKET.get(dynKey);
    if (existing) dynamicHints = JSON.parse(await existing.text());
  } catch (e) { /* 新文件 */ }

  // 去重（按中文文本）
  if (!dynamicHints.some(h => h.zh === pair!.zh)) {
    dynamicHints.push(pair);
    if (dynamicHints.length > 10) dynamicHints = dynamicHints.slice(-10);
  }

  await env.WORKS_BUCKET.put(dynKey, JSON.stringify(dynamicHints), {
    httpMetadata: { contentType: 'application/json' },
  });

  return pair;
}
