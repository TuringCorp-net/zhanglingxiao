// L2: Agent 执行循环
// 核心 ~60 行：while LLM 返回 tool_calls → 执行工具 → 结果反馈 → 继续

import { Env } from '../../db/schema';
import { callAI, type Message } from '../l0/aiGateway';
import type { AgentLoopOptions, AgentStep } from './types';
import { buildAgentSystemPrompt, buildAgentSystemPromptLayers, type SystemPromptLayers } from './prompt';
import { createTools } from './tools';
import { assembleContext } from '../l1/context';
import type { WorkMeta } from '../l1/types';

/** Agent 循环的完整结果 */
export interface AgentLoopResult {
  reply: string;
  steps: AgentStep[];
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
 * Agent 执行循环
 *
 * 给定用户消息，在 while 循环中：
 *   1. LLM 返回文本 → 循环结束，文本即为最终回复
 *   2. LLM 返回 tool_calls → 执行工具 → 结果追加到 messages → 继续循环
 *
 * 最大迭代次数由 options.maxIterations 控制（默认 30）。
 */
export async function agentLoop(
  env: Env,
  workMeta: WorkMeta,
  contextPkg: string,
  opts: AgentLoopOptions,
  conversationHistory: Message[],
  userMessage: string,
): Promise<AgentLoopResult> {
  const maxIterations = opts.maxIterations || 30;
  const lang = opts.lang as 'zh' | 'en';
  const steps: AgentStep[] = [];
  let totalInput = 0;
  let totalOutput = 0;
  let totalCacheHit = 0;
  let totalCacheMiss = 0;
  let lastModel = '';

  // 1. 构建 System Prompt
  const tools = createTools(env, opts.workId, lang);
  const toolDefs = tools.map(t => t.def);

  const ctxVars = assembleContext(workMeta, lang, contextPkg, {
    module: opts.contextModule,
    sectionTitle: opts.contextSectionTitle,
  });
  const systemPrompt = await buildAgentSystemPrompt(env, ctxVars, toolDefs, opts.workId, opts.userToken);

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
    // 找到最后一条 user 消息（即刚追加的）
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === 'user') {
        messages[i] = { role: 'user', content: userMessagePrefix + messages[i].content };
        break;
      }
    }
  }

  // 3. Agent 循环
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

    // 无 tool_calls → 循环结束，返回最终回复
    if (!result.tool_calls || result.tool_calls.length === 0) {
      steps.push({ type: 'done', text: result.content });
      return { reply: result.content, steps, usage: { input: totalInput, output: totalOutput, cacheHit: totalCacheHit, cacheMiss: totalCacheMiss, model: lastModel } };
    }

    // 有 tool_calls → 执行工具
    // 先将 assistant 消息（含 tool_calls）加入 messages
    messages.push({
      role: 'assistant',
      content: result.content || '',
      tool_calls: result.tool_calls,
    });

    for (const tc of result.tool_calls) {
      const toolName = tc.function.name;
      let toolParams: Record<string, unknown>;
      try {
        toolParams = JSON.parse(tc.function.arguments);
      } catch {
        toolParams = {};
      }

      // 注入隐式参数
      toolParams._lang = lang;
      toolParams.work_id = opts.workId;

      steps.push({ type: 'tool_call', tool: toolName, params: toolParams });

      // 查找并执行工具
      const tool = tools.find(t => t.def.function.name === toolName);
      let toolResult: string;
      if (tool) {
        try {
          toolResult = await tool.execute(toolParams);
        } catch (err) {
          toolResult = `工具执行错误: ${(err as Error).message}`;
        }
      } else {
        toolResult = `未知工具: ${toolName}`;
      }

      const summary = toolResult.length > 200 ? toolResult.substring(0, 200) + '...' : toolResult;
      steps.push({ type: 'tool_result', tool: toolName, summary });

      // 工具结果追加到 messages
      messages.push({
        role: 'tool',
        tool_call_id: tc.id,
        content: toolResult,
      });
    }
  }

  // 达到最大迭代次数 → 强制 LLM 总结
  const summaryPrompt = lang === 'en'
    ? 'Based on all the tool call results above, please give the author a complete response.'
    : '请基于以上所有工具调用的结果，给作者一个完整的回复。';
  messages.push({ role: 'user', content: summaryPrompt });
  const finalResult = await callAI(env, messages);
  if (finalResult.usage) {
    totalInput += finalResult.usage.input;
    totalOutput += finalResult.usage.output;
  }
  steps.push({ type: 'done', text: finalResult.content });
  return { reply: finalResult.content, steps, usage: { input: totalInput, output: totalOutput, cacheHit: totalCacheHit, cacheMiss: totalCacheMiss, model: lastModel } };
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

  // 与 agentLoop 完全相同的构建路径
  const tools = createTools(env, opts.workId, lang);
  const toolDefs = tools.map(t => t.def);

  const ctxVars = assembleContext(workMeta, lang, contextPkg, {
    module: opts.contextModule,
    sectionTitle: opts.contextSectionTitle,
  });

  // 使用分层构建，同时获得完整 prompt 和逐层数据
  const layers = await buildAgentSystemPromptLayers(env, ctxVars, toolDefs, opts.workId, opts.userToken);

  // 构建 messages（与 agentLoop 相同）
  const messages: Message[] = [
    { role: 'system', content: layers.full },
    ...conversationHistory,
    { role: 'user', content: userMessage },
  ];

  // 注入当前模块信息到 user message 前缀（与 agentLoop 相同）
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
        '2_context': layers.layer_2_context_package.length,
        '3_references': layers.layer_3_references.length,
        '4_tools': layers.layer_4_tools.length,
        '5_memory': layers.layer_5_memory.length,
      },
    },
  };
}
