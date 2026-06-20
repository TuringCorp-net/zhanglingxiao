// L2: System Prompt 构建器
// 5 层结构：统一人格 → 上下文包 → 参考案例库 → 工具说明 → 记忆注入

import { Env } from '../../db/schema';
import { getPromptTemplate } from '../l1/scenarios';
import { renderTemplate } from '../l1/render';
import type { AgentVars } from '../l1/types';
import type { ToolDef } from '../l0/aiGateway';
import { readSTMFinal, readLTMFinal } from './memory';
import toolGuideTemplate from './prompts/tool_guide.md';

// ============================================================
// 参考案例包（R2 缓存 key）
// ============================================================

const REFERENCE_PACKAGE_KEY = 'system/case_knowledge/case_reference_package.md';

/** 从 R2 加载参考案例包（同 key 跨作品共享，频繁命中 R2 边缘缓存） */
async function loadReferencePackage(env: Env): Promise<string> {
  try {
    const obj = await env.WORKS_BUCKET.get(REFERENCE_PACKAGE_KEY);
    if (!obj) return '';
    return await obj.text();
  } catch {
    console.error('[l2/prompt] 参考案例包加载失败');
    return '';
  }
}

// ============================================================
// 分层结构（供 debug 模式使用）
// ============================================================

export interface SystemPromptLayers {
  /** 完整 system prompt（5 层拼接） */
  full: string;
  /** 逐层内容（按组装顺序：static → dynamic） */
  layer_1_persona: string;
  layer_2_references: string;
  layer_3_tools: string;
  layer_4_context_package: string;
  layer_5_memory: string;
}

// ============================================================
// System Prompt 构建
// ============================================================

/**
 * 构建 L2 Agent System Prompt（5 层结构）
 *
 * Layer 1: 统一人格（static，跨 Read/Write）
 * Layer 2: 参考案例库（static，4 部经典作品框架分析）
 * Layer 3: 工具说明 + 行为建议（static）
 * Layer 4: 上下文包（dynamic，M0-M5，随写作进度变化）
 * Layer 5: 记忆注入层（dynamic，STM+LTM，每日更新）
 *
 * 排列顺序：静态在前（最大化 DeepSeek 缓存命中），动态在后。
 */
export async function buildAgentSystemPrompt(
  env: Env,
  vars: AgentVars,
  tools: ToolDef[],
  workId: string,
  userToken?: string,
): Promise<string> {
  const layers = await buildAgentSystemPromptLayers(env, vars, tools, workId, userToken);
  return layers.full;
}

/**
 * 构建 L2 Agent System Prompt，并返回分层数据。
 * 供 Agent 循环（生产）和 debug 模式（验证）共用。
 */
export async function buildAgentSystemPromptLayers(
  env: Env,
  vars: AgentVars,
  tools: ToolDef[],
  workId: string,
  userToken?: string,
): Promise<SystemPromptLayers> {
  // —— Layer 1: 统一人格（static） ——
  let layer1 = '';
  const personaTemplate = getPromptTemplate('writer_companion');
  if (personaTemplate) {
    layer1 = renderTemplate(personaTemplate, vars);
  }

  // —— Layer 2: 参考案例库（static） ——
  let layer2 = '';
  const refPkg = await loadReferencePackage(env);
  if (refPkg) {
    layer2 = `## 经典作品创作框架参考\n\n以下为 4 部经典作品按 Story Forger M1-M5 模板拆解的结构化分析。在作者需要灵感或参考创作手法时，你可以参考这些案例的框架结构。不需要强行套用——只在创作方向与参考案例相关时才借鉴。\n\n${refPkg}`;
  }

  // —— Layer 3: 工具说明 + 行为建议（static） ——
  let layer3 = '';
  if (tools.length > 0) {
    const toolDescriptions = tools.map(t =>
      `- **${t.function.name}**: ${t.function.description}`
    ).join('\n');
    layer3 = toolGuideTemplate.replace('{{tool_list}}', toolDescriptions);
  }

  // —— Layer 4: 上下文包（dynamic） ——
  let layer4 = '';
  if (vars.context_package) {
    layer4 = `## 作品完整上下文\n\n${vars.context_package}`;
  }

  // —— Layer 5: 记忆注入层 ——
  const memParts: string[] = [];

  // 5a. 加载上次未完成的 checklist（R2 持久化）
  try {
    const checklistObj = await env.WORKS_BUCKET.get(`works/${workId}/elf_checklist.json`);
    if (checklistObj) {
      const checklist = JSON.parse(await checklistObj.text()) as { todos: { content: string; status: string }[]; updated_at: string };
      const incomplete = checklist.todos.filter(t => t.status !== 'completed');
      if (incomplete.length > 0) {
        memParts.push(`## 上次未完成的任务清单\n\n以下是你上次会话中创建但未完成的任务清单（保存于 ${checklist.updated_at}）。如果作者让你继续之前的工作，从这里开始：\n\n${checklist.todos.map(t => {
          const icon = t.status === 'completed' ? '✅' : t.status === 'in_progress' ? '🔄' : '⬜';
          return `${icon} ${t.content}`;
        }).join('\n')}\n\n你可以用 \`checklist_write\` 更新此清单。`);
      }
    }
  } catch { /* checklist 加载失败不影响主流程 */ }

  // 5b. L2 短期记忆 + L3 长期记忆
  if (userToken) {
    try {
      const stmContent = await readSTMFinal(env, userToken);
      if (stmContent) {
        memParts.push(`## 短期记忆\n\n${stmContent}`);
      }
    } catch { /* 记忆加载失败不影响主流程 */ }

    try {
      const l3Profile = await readLTMFinal(env, userToken);
      if (l3Profile) {
        memParts.push(`## 长期记忆\n\n${l3Profile}`);
      }
    } catch { /* 记忆加载失败不影响主流程 */ }
  }

  if (memParts.length === 0) {
    memParts.push('## 短期记忆\n\n*（暂无数据。随着对话积累，短期记忆将在此展示。）*\n\n---\n\n## 长期记忆\n\n*（暂无数据。随着对话积累，长期记忆将在此展示。）*');
  }

  const layer5 = memParts.join('\n\n---\n\n');

  // 拼接完整 system prompt
  const parts = [layer1, layer2, layer3, layer4, layer5].filter(p => p.length > 0);
  const full = parts.join('\n\n---\n\n');

  return {
    full,
    layer_1_persona: layer1,
    layer_2_references: layer2,
    layer_3_tools: layer3,
    layer_4_context_package: layer4,
    layer_5_memory: layer5,
  };
}
