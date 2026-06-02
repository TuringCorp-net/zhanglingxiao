// Story Elf — AI 对话 API（L2 Agent 入口）
// Read 侧（伴读精灵）和 Write 侧（写作精灵）共享此端点。
// 上下文组装、system prompt 构建、Agent 循环由 L2 模块完成。

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
import { saveSessionLog } from '../../lib/l2/memory';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface ElfChatRequest {
  work_id: string;
  section_id?: string;
  page: 'read' | 'write';
  session_id?: string;        // 前端管理的会话 ID（用于记忆系统）
  messages: ChatMessage[];
  context?: {
    module?: string;
    section_title?: string;
    panel?: string;
  };
  debug?: 'prompt';          // debug 模式：不调 LLM，返回组装好的 messages + layers
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

  // L1: 获取/构建写作上下文包（M0-M5，R2 缓存）
  const contextPkg = await getOrBuildContextPackage(env, body.work_id, lang);

  // 构建对话历史
  // 前端传来完整的 messages 数组（user/assistant 交替），最后一条是本轮用户输入
  const allMessages: Message[] = body.messages.map(m => ({
    role: m.role as 'user' | 'assistant',
    content: m.content,
  }));

  // 最后一条是本轮输入，前面的全是对话历史
  const userMessage = allMessages.length > 0 ? allMessages[allMessages.length - 1].content : '';
  const history: Message[] = allMessages.slice(0, -1);

  // 验证最后一条消息是 user 角色
  const lastMsg = allMessages[allMessages.length - 1];
  if (!lastMsg || lastMsg.role !== 'user' || !userMessage) {
    return new Response(JSON.stringify(jsonError(ErrorCodes.MISSING_REQUIRED_FIELD, 'Last message must be from user')), {
      status: 400, headers: { 'Content-Type': 'application/json' },
    });
  }

  const userToken = extractUserToken(request);

  try {
    // —— Debug 模式：不调 LLM，返回组装好的 messages + layers ——
    if ((body as { debug?: string }).debug === 'prompt') {
      const debugResult = await agentDebug(
        env,
        workMeta,
        contextPkg,
        {
          workId: body.work_id,
          lang,
          page: body.page,
          userToken,
          contextModule: opts.module,
          contextSectionTitle: opts.sectionTitle,
        },
        history,
        userMessage,
      );
      return new Response(JSON.stringify(jsonSuccess({
        work_id: body.work_id,
        lang,
        debug_mode: 'prompt',
        messages: debugResult.messages,
        system_prompt_layers: debugResult.system_prompt_layers,
        user_message_prefix: debugResult.user_message_prefix,
        stats: debugResult.stats,
      })), {
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
      });
    }

    const result = await agentLoop(
      env,
      workMeta,
      contextPkg,
      {
        workId: body.work_id,
        lang,
        page: body.page,
        userToken,
        contextModule: opts.module,
        contextSectionTitle: opts.sectionTitle,
      },
      history,
      userMessage,
    );

    // 遥测：记录用量
    await recordAIUsage(env, {
      work_id: body.work_id,
      user_token: userToken,
      page: body.page,
      model: result.usage.model,
      tokens_in: result.usage.input,
      tokens_out: result.usage.output,
      cache_hit: result.usage.cacheHit,
      cache_miss: result.usage.cacheMiss,
    });

    // L1 会话日志：保存完整对话记录（供记忆提取用）
    if (userToken) {
      const sessionId = body.session_id || crypto.randomUUID();
      // 构建 L1 消息：前端消息 + Agent 步骤
      const l1Messages: Message[] = [
        ...allMessages.slice(0, -1),  // 前端传来的历史（去除最后一条 user，避免重复）
        { role: 'user', content: userMessage },
      ];
      // 追加 Agent 的工具调用和最终回复
      for (const step of result.steps) {
        if (step.type === 'tool_call') {
          l1Messages.push({
            role: 'assistant',
            content: '',
            tool_calls: [{ id: 'l1', type: 'function', function: { name: step.tool, arguments: JSON.stringify(step.params) } }],
          });
        } else if (step.type === 'tool_result') {
          l1Messages.push({ role: 'tool', tool_call_id: 'l1', content: step.summary });
        }
      }
      // 追加最终回复
      l1Messages.push({ role: 'assistant', content: result.reply });

      // 异步保存（不阻塞响应）
      saveSessionLog(env, userToken, sessionId, body.page, body.work_id,
        String(work.title || ''), l1Messages).catch(err =>
        console.error('[elf_chat] L1 保存失败:', (err as Error).message));
    }

    return new Response(JSON.stringify(jsonSuccess({
      work_id: body.work_id,
      lang,
      reply: result.reply,
      steps: result.steps,
      usage: result.usage,
    })), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('[elf_chat] Agent loop failed:', (err as Error).message);
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
