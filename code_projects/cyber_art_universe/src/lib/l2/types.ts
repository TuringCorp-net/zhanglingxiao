// L2: Agent 层类型定义

import type { ToolDef as L0ToolDef } from '../l0/aiGateway';

// ============================================================
// 工具系统
// ============================================================

/** L2 工具定义——在 L0 ToolDef 基础上增加 execute 函数 */
export interface L2ToolDef {
  def: L0ToolDef;            // 传给 LLM 的工具描述
  execute: (params: Record<string, unknown>) => Promise<string>; // 工具执行函数
  is_mutating: boolean;      // 是否会修改内容（用于 Guardrails）
}

/** Agent 循环选项 */
export interface AgentLoopOptions {
  workId: string;
  lang: string;
  page: 'read' | 'write';
  userToken?: string;        // 用户标识（完整 token，用于 Session 持久化 + L2/L3 记忆 + 归属校验）
  sessionId?: string;        // Session ID（可选——不传则无状态模式）
  mockReply?: string;        // 测试用：模拟 AI 回复，不调 LLM，但完整走 Session 持久化流程
  contextModule?: string;
  contextSectionTitle?: string;
  maxIterations?: number;    // 最大工具调用轮次，默认 30（支持复杂任务分解）
  debug?: 'prompt';          // debug 模式：不调 LLM，返回组装好的 messages + layers（不持久化）
}

/** Agent 循环的单步结果（用于 SSE 推送） */
export type AgentStep =
  | { type: 'thinking'; text: string }
  | { type: 'tool_call'; tool: string; params: Record<string, unknown> }
  | { type: 'tool_result'; tool: string; summary: string }
  | { type: 'text_delta'; text: string }
  | { type: 'done'; text: string }
  | { type: 'error'; message: string };

/** generate_slot 工具参数 */
export interface GenerateSlotParams {
  module_type: string;       // 'm1' | 'm2' | 'm3_card' | 'm4_strategy' | 'm4_card' | 'm5_intent' | 'm6_chapter'
  slot_id?: string;          // 可选：只生成指定 slot；不指定则生成整个模块
  instructions?: string;     // 额外指令（可选）
}

/** write_to_slot 工具参数 */
export interface WriteToSlotParams {
  module_type: string;
  slot_values: Record<string, string>; // slot_id → 内容
  free_content?: string;     // 可选：同时更新自由写作区
}
