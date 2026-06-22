// L2: Agent 执行循环 (SSE 流式)
// async generator：while LLM 返回 tool_calls → 执行工具 → yield step → 继续
// 前端通过 SSE 逐步消费每个 step，实现"进展实时可见"

import { Env } from '../../db/schema';
import { callAI, type Message } from '../l0/aiGateway';
import type { AgentLoopOptions, AgentStep } from './types';
import { buildAgentSystemPrompt, buildAgentSystemPromptLayers, type SystemPromptLayers } from './prompt';
import { createTools } from './tools';
import { assembleContext } from '../l1/context';
import type { WorkMeta } from '../l1/types';
import { jsonrepair } from 'jsonrepair';

/** Agent 循环的最终结果（generator return 值，用于持久化） */
export interface AgentLoopFinal {
  reply: string;
  messages: Message[];  // 完整 messages 数组（含 system prompt + 所有轮次），供 R2 持久化
  usage: {
    input: number;
    output: number;
    cacheHit: number;
    cacheMiss: number;
    model: string;
  };
}

/** Debug 模式返回的 prompt 组装数据（不调 LLM） */
export interface AgentDebugResult {
  messages: Message[];
  system_prompt_layers: SystemPromptLayers;
  user_message_prefix: string;
  stats: {
    system_prompt_chars: number;
    layer_sizes: Record<string, number>;
  };
}

/**
 * Agent 执行循环（SSE 流式 async generator）
 *
 * 给定用户消息，在 while 循环中：
 *   1. LLM 返回文本 → 循环结束，文本即为最终回复
 *   2. LLM 返回 tool_calls → yield text_delta → 执行工具 → yield tool_call + tool_result → 继续
 *
 * 每完成一步就 yield 对应的 AgentStep，前端通过 SSE 实时消费。
 * 最大迭代次数由 options.maxIterations 控制（默认 30）。
 */
export async function* agentLoop(
  env: Env,
  workMeta: WorkMeta,
  contextPkg: string,
  opts: AgentLoopOptions,
  conversationHistory: Message[],
  userMessage: string,
  preBuiltSystemPrompt?: string,
): AsyncGenerator<AgentStep, AgentLoopFinal, undefined> {
  const maxIterations = opts.maxIterations || 30;
  const lang = opts.lang as 'zh' | 'en';
  let totalInput = 0;
  let totalOutput = 0;
  let totalCacheHit = 0;
  let totalCacheMiss = 0;
  let lastModel = '';

  // 1. System Prompt
  const tools = createTools(env, opts.workId, lang);
  const toolDefs = tools.map(t => t.def);

  const ctxVars = assembleContext(workMeta, lang, contextPkg, {
    module: opts.contextModule,
    sectionTitle: opts.contextSectionTitle,
  });
  const systemPrompt = preBuiltSystemPrompt || await buildAgentSystemPrompt(env, ctxVars, toolDefs, opts.workId, opts.userToken);

  // 2. 构建初始 messages
  const messages: Message[] = [
    { role: 'system', content: systemPrompt },
    ...conversationHistory,
    { role: 'user', content: userMessage },
  ];

  // 注入当前模块信息到 user message 前缀
  let userMessagePrefix = '';
  if (opts.contextModule || opts.contextSectionTitle) {
    const prefixParts: string[] = [];
    if (opts.contextModule) prefixParts.push(`[当前模块: ${opts.contextModule}]`);
    if (opts.contextSectionTitle) prefixParts.push(`[当前章节: ${opts.contextSectionTitle}]`);
    userMessagePrefix = prefixParts.join(' ') + '\n\n';
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === 'user') {
        messages[i] = { role: 'user', content: userMessagePrefix + messages[i].content };
        break;
      }
    }
  }

  // —— Mock 模式（多步骤）——
  if (opts.mockSteps && opts.mockSteps.length > 0) {
    for (const step of opts.mockSteps) {
      yield step;
    }
    const reply = opts.mockReply || 'Mock done.';
    messages.push({ role: 'assistant', content: reply });
    yield { type: 'done', text: reply };
    return { reply, messages, usage: { input: 0, output: 0, cacheHit: 0, cacheMiss: 0, model: 'mock' } };
  }

  // —— Mock 模式（单步骤）——
  if (opts.mockReply) {
    messages.push({ role: 'assistant', content: opts.mockReply });
    yield { type: 'done', text: opts.mockReply };
    return { reply: opts.mockReply, messages, usage: { input: 0, output: 0, cacheHit: 0, cacheMiss: 0, model: 'mock' } };
  }

  // 3. Agent 循环
  let reply = '';
  for (let iteration = 0; iteration < maxIterations; iteration++) {
    const result = await callAI(env, messages, {
      tools: toolDefs.length > 0 ? toolDefs : undefined,
      tool_choice: toolDefs.length > 0 ? 'auto' : undefined,
    });

    lastModel = result.model;
    if (result.usage) {
      totalInput += result.usage.input;
      totalOutput += result.usage.output;
      totalCacheHit += result.usage.cacheHit || 0;
      totalCacheMiss += result.usage.cacheMiss || 0;
    }

    // 无 tool_calls → 循环结束
    if (!result.tool_calls || result.tool_calls.length === 0) {
      messages.push({ role: 'assistant', content: result.content });
      reply = result.content;
      yield { type: 'done', text: result.content };
      break;
    }

    // 有 tool_calls → 执行工具
    const assistantMsg: Message = {
      role: 'assistant',
      content: result.content || '',
      tool_calls: result.tool_calls,
    };
    if (result.reasoning_content) {
      assistantMsg.reasoning_content = result.reasoning_content;
    }
    messages.push(assistantMsg);

    // 将 assistant 工具调用前的文本（如 "好的，让我先看看模板"）yield
    if (result.content) {
      yield { type: 'text_delta', text: result.content };
    }

    for (const tc of result.tool_calls) {
      const toolName = tc.function.name;
      let toolParams: Record<string, unknown>;
      try { toolParams = JSON.parse(tc.function.arguments); } catch {
        // 尝试 jsonrepair 修复常见 JSON 错误（未转义引号、缺失逗号等）
        try {
          const repaired = jsonrepair(tc.function.arguments);
          toolParams = JSON.parse(repaired);
        } catch {
          // 修复也失败 → 给 LLM 可操作的错误反馈
          const rawArgs = tc.function.arguments;
          const preview = rawArgs.length > 200 ? rawArgs.substring(0, 200) + '…' : rawArgs;
          messages.push({ role: 'tool', tool_call_id: tc.id, content: `❌ 工具调用 JSON 解析失败。\n\n可能原因：content 中包含未转义的特殊字符（如双引号 "、反斜杠 \\）。\n请在下次调用时对 Markdown 内容中的这些字符进行转义（\\" 和 \\\\）。\n\n收到的参数预览:\n${preview}` });
          continue;
        }
      }

      toolParams._lang = lang;
      toolParams.work_id = opts.workId;
      toolParams._user_token = opts.userToken || '';

      // write_to_slot: 内容从 assistant.content 提取，tool args 只传元信息
      // LLM 先输出 Markdown 正文，再调工具 → Worker 自动拼合，绕过 JSON 转义
      //
      // 为防止对话性文字（"好的"、"现在调用工具写入——"等）污染槽位内容，
      // 优先从 ```markdown ``` 代码块中提取纯内容；无代码块则 fallback 全文。
      if (toolName === 'write_to_slot' && (!toolParams.content || !(toolParams.content as string).trim())) {
        // 从后往前查找最近的 assistant 消息（处理多 tool_call 场景：前面的 tool result
        // 已 push 进 messages，messages[last] 可能不是 assistant 消息）
        let assistantContent = '';
        for (let i = messages.length - 1; i >= 0; i--) {
          if (messages[i].role === 'assistant' && messages[i].content) {
            assistantContent = messages[i].content as string;
            break;
          }
        }
        if (assistantContent) {
          let content = assistantContent;
          // 尝试从 markdown/md 代码块中提取纯内容（非贪婪匹配第一个代码块）
          const codeBlockMatch = content.match(/```(?:markdown|md)?\s*\n([\s\S]*?)\n\s*```/);
          if (codeBlockMatch && codeBlockMatch[1].trim().length > 0) {
            content = codeBlockMatch[1];
          }
          toolParams.content = content;
        }
      }

      yield { type: 'tool_call', tool: toolName, params: toolParams };

      const tool = tools.find(t => t.def.function.name === toolName);
      let toolResult: string;
      if (tool) {
        try { toolResult = await tool.execute(toolParams); }
        catch (err) { toolResult = `工具执行错误: ${(err as Error).message}`; }
      } else {
        toolResult = `未知工具: ${toolName}`;
      }

      const summary = toolResult;
      yield { type: 'tool_result', tool: toolName, summary, params: toolParams };

      messages.push({ role: 'tool', tool_call_id: tc.id, content: toolResult });
    }
  }

  // 达到最大迭代次数 → 强制 LLM 总结
  if (!reply) {
    const summaryPrompt = lang === 'en'
      ? 'Based on all the tool call results above, please give the author a complete response.'
      : '请基于以上所有工具调用的结果，给作者一个完整的回复。';
    messages.push({ role: 'user', content: summaryPrompt });
    const finalResult = await callAI(env, messages);
    if (finalResult.usage) {
      totalInput += finalResult.usage.input;
      totalOutput += finalResult.usage.output;
    }
    messages.push({ role: 'assistant', content: finalResult.content });
    reply = finalResult.content;
    yield { type: 'done', text: finalResult.content };
  }

  return { reply, messages, usage: { input: totalInput, output: totalOutput, cacheHit: totalCacheHit, cacheMiss: totalCacheMiss, model: lastModel } };
}

/**
 * Debug 模式：组装完整的 messages 数组和分层 system prompt，
 * 但不调用 LLM。用于验证 prompt 组装逻辑。
 */
export async function agentDebug(
  env: Env,
  workMeta: WorkMeta,
  contextPkg: string,
  opts: AgentLoopOptions,
  conversationHistory: Message[],
  userMessage: string,
): Promise<AgentDebugResult> {
  const lang = opts.lang as 'zh' | 'en';

  const tools = createTools(env, opts.workId, lang);
  const toolDefs = tools.map(t => t.def);

  const ctxVars = assembleContext(workMeta, lang, contextPkg, {
    module: opts.contextModule,
    sectionTitle: opts.contextSectionTitle,
  });

  const layers = await buildAgentSystemPromptLayers(env, ctxVars, toolDefs, opts.workId, opts.userToken);

  const messages: Message[] = [
    { role: 'system', content: layers.full },
    ...conversationHistory,
    { role: 'user', content: userMessage },
  ];

  let userMessagePrefix = '';
  if (opts.contextModule || opts.contextSectionTitle) {
    const prefixParts: string[] = [];
    if (opts.contextModule) prefixParts.push(`[当前模块: ${opts.contextModule}]`);
    if (opts.contextSectionTitle) prefixParts.push(`[当前章节: ${opts.contextSectionTitle}]`);
    userMessagePrefix = prefixParts.join(' ') + '\n\n';
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === 'user') {
        messages[i] = { role: 'user', content: userMessagePrefix + messages[i].content };
        break;
      }
    }
  }

  return {
    messages,
    system_prompt_layers: layers,
    user_message_prefix: userMessagePrefix,
    stats: {
      system_prompt_chars: layers.full.length,
      layer_sizes: {
        '1_persona': layers.layer_1_persona.length,
        '2_references': layers.layer_2_references.length,
        '3_tools': layers.layer_3_tools.length,
        '4_context': layers.layer_4_context_package.length,
        '5_memory': layers.layer_5_memory.length,
      },
    },
  };
}
