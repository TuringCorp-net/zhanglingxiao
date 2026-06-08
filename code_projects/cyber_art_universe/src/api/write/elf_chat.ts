/**
 * Story Elf AI 对话 — elf_chat.ts (L2 Agent 入口)
 *
 * 覆盖需求:
 *   SF-053: Story Elf 浮动组件 — 自包含 JS (story-elf.js)，可拖拽，位置跨页面保持
 *   SF-054: Context-Aware 上下文感知 — 页面自动将当前阅读/写作位置传给 Elf
 *   SF-055: Write 侧写作精灵 — 一致性检查、建议、对话式润色
 *   SF-056: Read 侧伴读精灵 — 浮动形象 + 对话框
 *   SF-072: Hint 对话泡 — 槽位聚焦时打字机效果呈现 hint markdown
 *
 * Read 侧（伴读精灵）和 Write 侧（写作精灵）共享此 POST /api/write/elf/chat 端点。
 * 上下文组装 → MosaicCompress → Agent 循环由 L2 模块完成。
 *
 * 架构 (v2 — 无 Session):
 *   每个 (user, work, page) 对应一个"永续对话"，存储在 R2。
 *   没有 Session 概念 — 用户切换作品时自动加载对应对话。
 *   MosaicCompress 在每次 agentLoop 前执行，保持上下文窗口不膨胀。
 *
 * ============================================================
 * 前端设计（Story Elf — story-elf.js / story-elf.css）
 * ============================================================
 *
 * 组件架构（四大模块）：
 *   1. 浮动小精灵 UI — 拖拽移动 + 位置 localStorage 持久化
 *   2. Hint 对话泡 — hint markdown 渲染 + requestAnimationFrame 打字机效果
 *   3. 聊天窗口 (#elf-dialog) — 与 AI 对话，独立于对话泡
 *   4. 动作按钮 — 检查/建议等快捷操作，write.js 通过 setActions() 注入
 *
 * Hint 对话泡设计意图：
 *   将槽位提示从 textarea placeholder 移出，以"对话泡"形式呈现
 *   - 槽位界面干净：textarea 不设 placeholder hint
 *   - 对话感：聚焦槽位时 Elf 弹出对话泡，逐字显示（~40ms/字，标点 +200ms/+100ms）
 *   - 提示常驻：即使槽位已有内容，提示也不消失（不像 placeholder 输入即隐藏）
 *
 * Hint 视觉规格（story-elf.css）：
 *   - 定位：跟随 Story Elf 浮动组件，出现在其上方或侧边
 *   - 最大宽度 320px，半透明深色面板，圆角卡片
 *   - 淡入动画（出现）+ requestAnimationFrame 逐字打字（内容）
 *   - z-index: 200（高于编辑器，低于模态弹窗）
 *   - blur 时淡出，手动关闭后可重新聚焦触发
 */

import { Env } from '../../db/schema';
import { jsonSuccess, jsonError } from '../../lib/response';
import { ErrorCodes } from '../../lib/errors';
import { AIError } from '../../lib/ai';
import { recordAIUsage, extractUserToken } from '../../lib/telemetry';
import { extractLang } from '../../lib/l1/work-content';
import { getOrBuildContextPackage } from '../../lib/l1/context-package';
import type { WorkMeta, ContextOpts } from '../../lib/l1/types';
import { agentLoop, agentDebug } from '../../lib/l2/agent';
import type { Message } from '../../lib/l0/aiGateway';
import { mosaicCompress, DEFAULT_MOSAIC_CONFIG } from '../../lib/l2/mosaic_compress';
import { saveDailyLog } from '../../lib/l2/memory';
import { buildAgentSystemPrompt } from '../../lib/l2/prompt';
import { createTools } from '../../lib/l2/tools';
import { assembleContext } from '../../lib/l1/context';

// ============================================================
// Conversation persistence (R2, per user+work+page)
// ============================================================

function convKey(userToken: string, workId: string, page: string): string {
  return `users/${userToken}/conversations/${workId}/${page}.json`;
}

async function loadConversation(env: Env, userToken: string, workId: string, page: string): Promise<Message[] | null> {
  try {
    const obj = await env.WORKS_BUCKET.get(convKey(userToken, workId, page));
    if (!obj) return null;
    return JSON.parse(await obj.text()) as Message[];
  } catch {
    return null;
  }
}

async function saveConversation(env: Env, userToken: string, workId: string, page: string, messages: Message[]): Promise<void> {
  await env.WORKS_BUCKET.put(convKey(userToken, workId, page), JSON.stringify(messages), {
    httpMetadata: { contentType: 'application/json' },
  });
}

// ============================================================
// Request types
// ============================================================

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface ElfChatRequest {
  work_id: string;
  section_id?: string;
  page: 'read' | 'write';
  user_token?: string;
  mock_reply?: string;
  messages: ChatMessage[];
  context?: {
    module?: string;
    section_title?: string;
    panel?: string;
  };
  debug?: 'prompt';
}

// ============================================================
// Main handler
// ============================================================

export async function handleElfChat(env: Env, request: Request): Promise<Response> {
  const body = await request.json() as ElfChatRequest;
  if (!body.work_id || !body.messages?.length || !body.page) {
    return new Response(JSON.stringify(jsonError(ErrorCodes.MISSING_REQUIRED_FIELD, 'work_id, messages, and page are required')), {
      status: 400, headers: { 'Content-Type': 'application/json' },
    });
  }

  const userToken = body.user_token || extractUserToken(request);
  const isAdmin = userToken === (env.ADMIN_TOKEN?.trim() || '');
  const isDebug = body.debug === 'prompt';

  // Query work + ownership check
  const work = await env.DB.prepare(
    'SELECT id, title, category, summary, user_token FROM works WHERE id = ?'
  ).bind(body.work_id).first<Record<string, unknown>>();
  if (!work) {
    return new Response(JSON.stringify(jsonError(ErrorCodes.WORK_NOT_FOUND, 'Work not found')), {
      status: 404, headers: { 'Content-Type': 'application/json' },
    });
  }

  if (!isAdmin && !isDebug && String(work.user_token || '') !== '' && String(work.user_token) !== userToken) {
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

  // L1: build context package (M0-M5 for write, M6 only for read)
  const contextPkg = await getOrBuildContextPackage(env, body.work_id, lang);

  // Frontend sends full message array; last one is current user input
  const allMessages: Message[] = body.messages.map(m => ({
    role: m.role as 'user' | 'assistant',
    content: m.content,
  }));
  const userMessage = allMessages.length > 0 ? allMessages[allMessages.length - 1].content : '';
  if (!userMessage || allMessages[allMessages.length - 1]?.role !== 'user') {
    return new Response(JSON.stringify(jsonError(ErrorCodes.MISSING_REQUIRED_FIELD, 'Last message must be from user')), {
      status: 400, headers: { 'Content-Type': 'application/json' },
    });
  }

  // Build tools for agent loop
  const tools = createTools(env, body.work_id, lang as 'zh' | 'en');
  const toolDefs = tools.map(t => t.def);
  const ctxVars = assembleContext(workMeta, lang, contextPkg, {
    module: opts.module,
    sectionTitle: opts.sectionTitle,
  });

  // Build fresh system prompt (cache-friendly: same work → same content → cache hit)
  const systemPrompt = await buildAgentSystemPrompt(env, ctxVars, toolDefs, body.work_id, userToken);

  try {
    // —— Debug mode: return assembled messages + layers without LLM call ——
    if (isDebug) {
      const debugResult = await agentDebug(
        env, workMeta, contextPkg,
        { workId: body.work_id, lang, page: body.page, userToken, contextModule: opts.module, contextSectionTitle: opts.sectionTitle },
        allMessages.slice(0, -1), userMessage,
      );
      return new Response(JSON.stringify(jsonSuccess({
        work_id: body.work_id, lang, debug_mode: 'prompt',
        messages: debugResult.messages,
        system_prompt_layers: debugResult.system_prompt_layers,
        user_message_prefix: debugResult.user_message_prefix,
        stats: debugResult.stats,
      })), { headers: { 'Content-Type': 'application/json; charset=utf-8' } });
    }

    // —— Load perpetual conversation from R2 ——
    let storedMessages = await loadConversation(env, userToken, body.work_id, body.page);

    if (storedMessages && storedMessages.length > 0) {
      // Replace system prompt (work may have been updated; DeepSeek cache is content-addressed)
      if (storedMessages[0].role === 'system') {
        storedMessages[0] = { role: 'system', content: systemPrompt };
      }
    } else {
      // First conversation for this (user, work, page)
      storedMessages = [{ role: 'system', content: systemPrompt }];
    }

    // Append new user message
    storedMessages.push({ role: 'user', content: userMessage });

    // —— MosaicCompress: keep context window bounded ——
    const compressed = await mosaicCompress(env, storedMessages, DEFAULT_MOSAIC_CONFIG);

    // Split compressed result for agentLoop
    const preBuiltSystemPrompt = compressed[0].content;
    const conversationHistory = compressed.slice(1, -1); // between system and latest user
    const latestUserMsg = compressed[compressed.length - 1].content;

    // —— Agent loop ——
    const result = await agentLoop(
      env, workMeta, contextPkg,
      {
        workId: body.work_id, lang, page: body.page, userToken,
        mockReply: body.mock_reply,
        contextModule: opts.module,
        contextSectionTitle: opts.sectionTitle,
      },
      conversationHistory,
      latestUserMsg,
      preBuiltSystemPrompt,
    );

    // —— Persist compressed result to R2 ——
    if (userToken) {
      saveConversation(env, userToken, body.work_id, body.page, result.messages)
        .catch(err => console.error('[elf_chat] Conversation save failed:', (err as Error).message));
    }

    // —— Telemetry ——
    await recordAIUsage(env, {
      work_id: body.work_id, user_token: userToken, page: body.page,
      model: result.usage.model,
      tokens_in: result.usage.input, tokens_out: result.usage.output,
      cache_hit: result.usage.cacheHit, cache_miss: result.usage.cacheMiss,
    });

    // —— L1 Memory Log: save raw conversation for memory extraction (daily rotation) ——
    if (userToken) {
      // Build raw L1 messages: frontend messages + agent steps + final reply
      const l1Messages: Message[] = [
        ...allMessages.slice(0, -1),
        { role: 'user', content: userMessage },
      ];
      for (const step of result.steps) {
        if (step.type === 'tool_call') {
          l1Messages.push({
            role: 'assistant', content: '',
            tool_calls: [{ id: 'l1', type: 'function', function: { name: step.tool, arguments: JSON.stringify(step.params) } }],
          });
        } else if (step.type === 'tool_result') {
          l1Messages.push({ role: 'tool', tool_call_id: 'l1', content: step.summary });
        }
      }
      l1Messages.push({ role: 'assistant', content: result.reply });

      saveDailyLog(env, userToken, body.page, body.work_id, String(work.title || ''), l1Messages)
        .catch(err => console.error('[elf_chat] L1 daily log save failed:', (err as Error).message));
    }

    return new Response(JSON.stringify(jsonSuccess({
      work_id: body.work_id, lang,
      reply: result.reply, steps: result.steps, usage: result.usage,
    })), { headers: { 'Content-Type': 'application/json' } });

  } catch (err) {
    console.error('[elf_chat] Error:', JSON.stringify({
      message: (err as Error).message, name: (err as Error).name,
      isAIError: err instanceof AIError,
      aiCode: err instanceof AIError ? (err as AIError).code : 'N/A',
    }));
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

// ============================================================
// GET /api/write/elf/conversation — return recent messages for frontend display
// ============================================================

export async function handleGetConversation(env: Env, request: Request): Promise<Response> {
  const url = new URL(request.url);
  const workId = url.searchParams.get('work_id');
  const page = url.searchParams.get('page') || 'write';

  const userToken = extractUserToken(request);
  if (!userToken || !workId) {
    return new Response(JSON.stringify(jsonError(ErrorCodes.MISSING_REQUIRED_FIELD, 'user_token and work_id required')), {
      status: 400, headers: { 'Content-Type': 'application/json' },
    });
  }

  const messages = await loadConversation(env, userToken, workId, page);
  if (!messages || messages.length === 0) {
    return new Response(JSON.stringify(jsonSuccess({ messages: [], work_id: workId, page })), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Filter to user + assistant messages only (no system, no tool, no tool_call), return last 50
  const displayMessages = messages
    .filter(m => (m.role === 'user' || m.role === 'assistant') && m.content)
    .slice(-50);

  return new Response(JSON.stringify(jsonSuccess({
    work_id: workId, page,
    messages: displayMessages,
  })), { headers: { 'Content-Type': 'application/json' } });
}
