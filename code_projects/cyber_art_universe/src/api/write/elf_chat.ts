// Story Elf — AI 对话 API
// Read 侧（伴读精灵）和 Write 侧（写作精灵）共享此端点。
// 上下文组装和 system prompt 由 L1 模块完成。

import { Env } from '../../db/schema';
import { jsonSuccess, jsonError } from '../../lib/response';
import { ErrorCodes } from '../../lib/errors';
import { callAI, AIError, type Message } from '../../lib/ai';
import { recordAIUsage, extractUserToken } from '../../lib/telemetry';
import { extractLang } from '../../lib/work_content';
import { getScenario } from '../../lib/l1/scenarios';
import { assembleContext } from '../../lib/l1/context';
import { buildSystemPrompt } from '../../lib/l1/instructions';
import { getOrBuildContextPackage } from '../../lib/l1/context-package';
import type { WorkMeta, ContextOpts } from '../../lib/l1/types';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface ElfChatRequest {
  work_id: string;
  section_id?: string;
  page: 'read' | 'write';
  messages: ChatMessage[];
  context?: {
    module?: string;
    section_title?: string;
    panel?: string;
  };
}

export async function handleElfChat(env: Env, request: Request): Promise<Response> {
  const body = await request.json() as ElfChatRequest;
  if (!body.work_id || !body.messages?.length || !body.page) {
    return new Response(JSON.stringify(jsonError(ErrorCodes.MISSING_REQUIRED_FIELD, 'work_id, messages, and page are required')), {
      status: 400, headers: { 'Content-Type': 'application/json' },
    });
  }

  // 查询作品基本信息
  const work = await env.DB.prepare(
    'SELECT id, title, category, summary FROM works WHERE id = ?'
  ).bind(body.work_id).first<Record<string, unknown>>();
  if (!work) {
    return new Response(JSON.stringify(jsonError(ErrorCodes.WORK_NOT_FOUND, 'Work not found')), {
      status: 404, headers: { 'Content-Type': 'application/json' },
    });
  }

  const lang = extractLang(request);
  const workMeta: WorkMeta = {
    title: String(work.title || ''),
    category: String(work.category || ''),
    summary: String(work.summary || ''),
  };
  const opts: ContextOpts = {
    module: body.context?.module,
    sectionId: body.section_id,
    sectionTitle: body.context?.section_title,
  };

  // L1: 获取/构建写作上下文包（M0-M5，R2 缓存） → 组装 vars → 渲染 system prompt
  const scenarioId = body.page === 'write' ? 'writer_companion' : 'reader_companion';
  const scenario = getScenario(scenarioId);
  if (!scenario) {
    return new Response(JSON.stringify(jsonError(ErrorCodes.AI_SERVICE_UNAVAILABLE, `Unknown scenario: ${scenarioId}`)), {
      status: 500, headers: { 'Content-Type': 'application/json' },
    });
  }

  // 上下文包：首次调用构建并缓存到 R2，后续会话直接复用（同作品+同语言 = 完全固定 → 缓存命中）
  const contextPkg = await getOrBuildContextPackage(env, body.work_id, lang);
  const vars = assembleContext(workMeta, lang, contextPkg, opts);
  const systemPrompt = buildSystemPrompt(scenario.promptFile, vars);

  // 构建消息：system（frozen，缓存命中） + user/assistant 对话历史
  // 动态上下文（模块/章节）放在 user message 前缀，避免破坏 system prompt 的缓存稳定性
  const conversationMessages: Message[] = body.messages.map(m => ({
    role: m.role as 'user' | 'assistant',
    content: m.content,
  }));

  // 在第一条 user message 前注入当前模块/章节信息（如果有）
  if (opts.module || opts.sectionTitle) {
    const prefixParts: string[] = [];
    if (opts.module) prefixParts.push(`[当前模块: ${opts.module}]`);
    if (opts.sectionTitle) prefixParts.push(`[当前章节: ${opts.sectionTitle}]`);
    const prefix = prefixParts.join(' ') + '\n\n';

    const firstUserIdx = conversationMessages.findIndex(m => m.role === 'user');
    if (firstUserIdx >= 0) {
      conversationMessages[firstUserIdx] = {
        role: 'user',
        content: prefix + conversationMessages[firstUserIdx].content,
      };
    } else {
      // 没有 user 消息（罕见），创建一条
      conversationMessages.unshift({ role: 'user', content: prefix });
    }
  }

  const messages: Message[] = [
    { role: 'system', content: systemPrompt },
    ...conversationMessages,
  ];

  try {
    const result = await callAI(env, messages);

    // 遥测：记录用量
    if (result.usage) {
      await recordAIUsage(env, {
        work_id: body.work_id,
        user_token: extractUserToken(request),
        page: body.page,
        model: result.model,
        tokens_in: result.usage.input,
        tokens_out: result.usage.output,
        cache_hit: result.usage.cacheHit || 0,
        cache_miss: result.usage.cacheMiss || 0,
      });
    }

    return new Response(JSON.stringify(jsonSuccess({
      work_id: body.work_id,
      lang,
      reply: result.content.trim(),
    })), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('[elf_chat] AI call failed:', (err as Error).message);
    if (err instanceof AIError) {
      const status = err.code === 'TIMEOUT' ? 504 : err.code === 'RATE_LIMITED' ? 429 : 503;
      return new Response(JSON.stringify(jsonError(ErrorCodes.AI_SERVICE_UNAVAILABLE, err.message)), {
        status, headers: { 'Content-Type': 'application/json' },
      });
    }
    return new Response(JSON.stringify(jsonError(ErrorCodes.AI_SERVICE_UNAVAILABLE, 'AI service unavailable')), {
      status: 503, headers: { 'Content-Type': 'application/json' },
    });
  }
}
