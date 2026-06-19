/**
 * Story Elf AI 对话 — elf_chat.ts (L2 Agent 入口, SSE 流式)
 *
 * 架构 v3 — SSE 流式:
 *   agentLoop 改为 async generator，每一步工具调用/结果实时通过 SSE 推送给前端。
 *   前端逐步渲染工作块，用户可实时看到 Agent 进展（而非等待全部完成后一次性显示）。
 *
 * 持久化（R2 对话 + L1 日志 + 遥测）在 Agent 完成后统一执行。
 */

import { Env } from '../../db/schema';
import { jsonSuccess, jsonError } from '../../lib/response';
import { ErrorCodes } from '../../lib/errors';
import { AIError } from '../../lib/ai';
import { recordAIUsage } from '../../lib/telemetry';
import { getUserId } from '../../lib/auth';
import { extractLang } from '../../lib/l1/work-content';
import { getOrBuildContextPackage } from '../../lib/l1/context-package';
import type { WorkMeta, ContextOpts } from '../../lib/l1/types';
import { agentLoop, agentDebug } from '../../lib/l2/agent';
import type { AgentLoopFinal } from '../../lib/l2/agent';
import type { AgentStep } from '../../lib/l2/types';
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

/** R2 对话快照：messages 供 agent 续上下文，rounds 供前端按轮次渲染工作块 */
interface ConversationSnapshot {
  messages: Message[];
  rounds: AgentStep[][];  // rounds[i] = 第 i 轮的工具调用步骤
}

async function loadConversation(env: Env, userToken: string, workId: string, page: string): Promise<ConversationSnapshot | null> {
  try {
    const obj = await env.WORKS_BUCKET.get(convKey(userToken, workId, page));
    if (!obj) return null;
    const raw = JSON.parse(await obj.text());
    // 兼容旧格式（Message[] 或 {messages, steps}）
    if (Array.isArray(raw)) return { messages: raw, rounds: [] };
    if (!raw.rounds) {
      // 旧格式 {messages, steps}: steps 是全部轮次混在一起的扁数组，无法拆分
      // 作为单轮展示（后续新轮次会正确累积）
      const legacyRounds: AgentStep[][] = raw.steps && raw.steps.length > 0 ? [raw.steps] : [];
      return { messages: raw.messages || [], rounds: legacyRounds };
    }
    return { messages: raw.messages || [], rounds: raw.rounds || [] };
  } catch {
    return null;
  }
}

async function saveConversation(env: Env, userToken: string, workId: string, page: string, messages: Message[], rounds: AgentStep[][]): Promise<void> {
  const snapshot: ConversationSnapshot = { messages, rounds };
  await env.WORKS_BUCKET.put(convKey(userToken, workId, page), JSON.stringify(snapshot), {
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
  mock_steps?: AgentStep[];  // 测试用：模拟多步骤 Agent 流程（走完整 SSE + 持久化）
  messages: ChatMessage[];
  context?: {
    module?: string;
    section_title?: string;
    panel?: string;
  };
  debug?: 'prompt';
}

// ============================================================
// SSE helper
// ============================================================

function sseEvent(data: unknown): string {
  return `event: step\ndata: ${JSON.stringify(data)}\n\n`;
}

function sseDone(data: unknown): string {
  return `event: done\ndata: ${JSON.stringify(data)}\n\n`;
}

function sseError(message: string): string {
  return `event: error\ndata: ${JSON.stringify({ message })}\n\n`;
}

// ============================================================
// Main handler (SSE streaming)
// ============================================================

export async function handleElfChat(env: Env, request: Request, ctx?: ExecutionContext): Promise<Response> {
  const body = await request.json() as ElfChatRequest;
  if (!body.work_id || !body.messages?.length || !body.page) {
    return new Response(JSON.stringify(jsonError(ErrorCodes.MISSING_REQUIRED_FIELD, 'work_id, messages, and page are required')), {
      status: 400, headers: { 'Content-Type': 'application/json' },
    });
  }

  // 用户标识：统一由鉴权中间件注入的 env.currentUser 确定
  const userToken = body.user_token || getUserId(env);
  const isAdmin = env.currentUser?.class === 'admin';
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

  const workUserToken = String(work.user_token || '');
  if (!isAdmin && !isDebug && workUserToken !== '' && workUserToken !== userToken) {
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

  // L1: build context package
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

  const tools = createTools(env, body.work_id, lang as 'zh' | 'en');
  const toolDefs = tools.map(t => t.def);
  const ctxVars = assembleContext(workMeta, lang, contextPkg, {
    module: opts.module,
    sectionTitle: opts.sectionTitle,
  });

  const systemPrompt = await buildAgentSystemPrompt(env, ctxVars, toolDefs, body.work_id, userToken);

  try {
    // —— Debug mode ——
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

    // —— Load / compress conversation ——
    const snapshot = await loadConversation(env, userToken, body.work_id, body.page);
    let storedMessages: Message[] = snapshot?.messages || [];
    if (storedMessages.length > 0) {
      if (storedMessages[0].role === 'system') {
        storedMessages[0] = { role: 'system', content: systemPrompt };
      }
    } else {
      storedMessages = [{ role: 'system', content: systemPrompt }];
    }
    storedMessages.push({ role: 'user', content: userMessage });

    const compressed = await mosaicCompress(env, storedMessages, DEFAULT_MOSAIC_CONFIG);
    const preBuiltSystemPrompt = compressed[0].content;
    const conversationHistory = compressed.slice(1, -1);
    const latestUserMsg = compressed[compressed.length - 1].content;

    // —— SSE 流式 Agent Loop（ctx.waitUntil 保护断连）——
    // 架构：Agent 在独立 Promise 中执行（agentTask），SSE 流只负责向前端推送。
    // ctx.waitUntil(agentTask) 确保即使前端关闭连接，Agent 也继续运行到完成并持久化。
    const gen = agentLoop(
      env, workMeta, contextPkg,
      {
        workId: body.work_id, lang, page: body.page, userToken,
        mockReply: body.mock_reply,
        mockSteps: body.mock_steps,
        contextModule: opts.module,
        contextSectionTitle: opts.sectionTitle,
      },
      conversationHistory,
      latestUserMsg,
      preBuiltSystemPrompt,
    );

    const sharedSteps: AgentStep[] = [];
    const notify = { fn: null as (() => void) | null };
    let agentFinished = false;
    let agentFinal: AgentLoopFinal | null = null;
    let agentErr: Error | null = null;
    const encoder = new TextEncoder();

    // Agent 独立运行（不被流生命周期约束）
    const agentTask = (async () => {
      try {
        let stepResult: IteratorResult<AgentStep, AgentLoopFinal>;
        while (!(stepResult = await gen.next()).done) {
          sharedSteps.push(stepResult.value);
          if (notify.fn) { const resolve = notify.fn as () => void; notify.fn = null; resolve(); }
        }
        agentFinal = stepResult.value;

        // 持久化（前端是否还在线都执行）
        const persist: Promise<void>[] = [];
        if (userToken) {
          // 累积 rounds：已有快照的 rounds + 本轮步骤为新的一轮
          const prevRounds = snapshot?.rounds || [];
          const allRounds = [...prevRounds, sharedSteps];
          console.log(`[elf_chat] 持久化 rounds: 已有 ${prevRounds.length} 轮 + 本轮 ${sharedSteps.length} 步 → 共 ${allRounds.length} 轮`);
          persist.push(saveConversation(env, userToken, body.work_id, body.page, agentFinal.messages, allRounds));
        }
        persist.push(recordAIUsage(env, {
          work_id: body.work_id, user_token: userToken, page: body.page,
          model: agentFinal.usage.model,
          tokens_in: agentFinal.usage.input, tokens_out: agentFinal.usage.output,
          cache_hit: agentFinal.usage.cacheHit, cache_miss: agentFinal.usage.cacheMiss,
        }));
        if (userToken) {
          const prefixParts: string[] = [];
          if (opts.module) prefixParts.push(`[当前模块: ${opts.module}]`);
          if (opts.sectionTitle) prefixParts.push(`[当前章节: ${opts.sectionTitle}]`);
          const userPrefix = prefixParts.length > 0 ? prefixParts.join(' ') + '\n\n' : '';
          const l1Messages: Message[] = [
            ...allMessages.slice(0, -1),
            { role: 'user', content: userPrefix + userMessage },
          ];
          for (const s of sharedSteps) {
            if (s.type === 'tool_call') {
              l1Messages.push({
                role: 'assistant', content: '',
                tool_calls: [{ id: 'l1', type: 'function', function: { name: s.tool, arguments: JSON.stringify(s.params) } }],
              });
            } else if (s.type === 'tool_result') {
              l1Messages.push({ role: 'tool', tool_call_id: 'l1', content: s.summary });
            }
          }
          l1Messages.push({ role: 'assistant', content: agentFinal.reply });
          persist.push(saveDailyLog(env, userToken, body.page, body.work_id, String(work.title || ''), l1Messages));
        }
        await Promise.all(persist);
      } catch (err) {
        agentErr = err as Error;
        console.error('[elf_chat] Agent error:', agentErr.message);
      } finally {
        agentFinished = true;
        if (notify.fn) { const resolve = notify.fn as () => void; notify.fn = null; resolve(); }
      }
    })();

    // keep Worker alive even if client disconnects
    if (ctx) ctx.waitUntil(agentTask);

    // SSE 流：从 sharedSteps 取数据推送，客户端断开时安静退出
    let delivered = 0;
    const stream = new ReadableStream({
      async pull(controller) {
        while (delivered < sharedSteps.length) {
          const step = sharedSteps[delivered++];
          try {
            controller.enqueue(encoder.encode(sseEvent(step)));
          } catch {
            return; // client disconnected, stop delivering (agent continues)
          }
        }

        if (agentFinished) {
          if (agentErr) {
            try { controller.enqueue(encoder.encode(sseError(agentErr.message))); } catch {}
          } else if (agentFinal) {
            try {
              controller.enqueue(encoder.encode(sseDone({ reply: agentFinal.reply, usage: agentFinal.usage })));
            } catch {}
          }
          try { controller.close(); } catch {}
          return;
        }

        // 等待 Agent 产出新步骤
        if (delivered >= sharedSteps.length) {
          await new Promise<void>(resolve => { notify.fn = resolve; });
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no',
      },
    });

  } catch (err) {
    console.error('[elf_chat] Setup error:', JSON.stringify({
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
// PUT /api/write/elf/conversation
// ============================================================

export async function handlePutConversation(env: Env, request: Request): Promise<Response> {
  const userToken = getUserId(env);
  if (!userToken || userToken === 'anonymous') {
    return new Response(JSON.stringify(jsonError(ErrorCodes.AUTH_REQUIRED, 'auth required')), {
      status: 401, headers: { 'Content-Type': 'application/json' },
    });
  }

  const body = await request.json() as { work_id: string; page?: string; messages: Message[] };
  if (!body.work_id || !Array.isArray(body.messages)) {
    return new Response(JSON.stringify(jsonError(ErrorCodes.MISSING_REQUIRED_FIELD, 'work_id and messages[] required')), {
      status: 400, headers: { 'Content-Type': 'application/json' },
    });
  }

  const page = body.page || 'write';

  try {
    await saveConversation(env, userToken, body.work_id, page, body.messages, []); // PUT 恢复不携带 rounds
    return new Response(JSON.stringify(jsonSuccess({ saved: true, work_id: body.work_id, page, count: body.messages.length })), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('[elf_chat] Conversation PUT failed:', (err as Error).message);
    return new Response(JSON.stringify(jsonError(ErrorCodes.INTERNAL_ERROR, 'Failed to save conversation')), {
      status: 500, headers: { 'Content-Type': 'application/json' },
    });
  }
}

// ============================================================
// GET /api/write/elf/conversation
// ============================================================

export async function handleGetConversation(env: Env, request: Request): Promise<Response> {
  const url = new URL(request.url);
  const workId = url.searchParams.get('work_id');
  const page = url.searchParams.get('page') || 'write';

  const userToken = getUserId(env);
  if (!userToken || userToken === 'anonymous' || !workId) {
    return new Response(JSON.stringify(jsonError(ErrorCodes.MISSING_REQUIRED_FIELD, 'user_token and work_id required')), {
      status: 400, headers: { 'Content-Type': 'application/json' },
    });
  }

  const snapshot = await loadConversation(env, userToken, workId, page);
  if (!snapshot || !snapshot.messages.length) {
    return new Response(JSON.stringify(jsonSuccess({ messages: [], rounds: [], work_id: workId, page })), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // 干净对话消息（user + 最终 assistant，不含中间 tool_calls）
  const displayMessages: Message[] = [];
  for (const m of snapshot.messages) {
    if (m.role === 'user') {
      displayMessages.push(m);
    } else if (m.role === 'assistant' && m.content && !m.tool_calls) {
      displayMessages.push(m);
    }
  }

  return new Response(JSON.stringify(jsonSuccess({
    work_id: workId, page,
    messages: displayMessages.slice(-50),
    rounds: snapshot.rounds || [],
  })), { headers: { 'Content-Type': 'application/json' } });
}
