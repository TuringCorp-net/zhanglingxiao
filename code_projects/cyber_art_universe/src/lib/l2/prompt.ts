// L2: System Prompt 构建器
// 5 层结构：统一人格 → 上下文包 → 参考案例库 → 工具说明 → 记忆注入

import { Env } from '../../db/schema';
import { getPromptTemplate } from '../l1/scenarios';
import { renderTemplate } from '../l1/render';
import type { AgentVars } from '../l1/types';
import type { ToolDef } from '../l0/aiGateway';

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
  /** 逐层内容 */
  layer_1_persona: string;
  layer_2_context_package: string;
  layer_3_references: string;
  layer_4_tools: string;
  layer_5_memory: string;
}

// ============================================================
// System Prompt 构建
// ============================================================

/**
 * 构建 L2 Agent System Prompt（5 层结构）
 *
 * Layer 1: 统一人格（跨 Read/Write，来自 L1 scenarios + prompt 模板）
 * Layer 2: 上下文包（M0-M5）
 * Layer 3: 参考案例库（4 部经典作品框架分析）
 * Layer 4: 工具说明 + 行为建议
 * Layer 5: 作品级记忆（预留，当前为空）
 *
 * 排列顺序：最静态在前（最大化 DeepSeek 缓存命中），最动态在后。
 */
export async function buildAgentSystemPrompt(
  env: Env,
  vars: AgentVars,
  tools: ToolDef[],
  workId: string,
): Promise<string> {
  const layers = await buildAgentSystemPromptLayers(env, vars, tools, workId);
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
): Promise<SystemPromptLayers> {
  // —— Layer 1: 统一人格 ——
  let layer1 = '';
  const personaTemplate = getPromptTemplate('writer_companion');
  if (personaTemplate) {
    layer1 = renderTemplate(personaTemplate, vars);
  }

  // —— Layer 2: 上下文包（M0-M5） ——
  let layer2 = '';
  if (vars.context_package) {
    layer2 = `## 作品完整上下文\n\n${vars.context_package}`;
  }

  // —— Layer 3: 参考案例库 ——
  let layer3 = '';
  const refPkg = await loadReferencePackage(env);
  if (refPkg) {
    layer3 = `## 经典作品创作框架参考\n\n以下为 4 部经典作品按 Story Forger M1-M5 模板拆解的结构化分析。在作者需要灵感或参考创作手法时，你可以参考这些案例的框架结构。不需要强行套用——只在创作方向与参考案例相关时才借鉴。\n\n${refPkg}`;
  }

  // —— Layer 4: 工具说明 + 行为建议 ——
  let layer4 = '';
  if (tools.length > 0) {
    const toolDescriptions = tools.map(t =>
      `- **${t.function.name}**: ${t.function.description}`
    ).join('\n');
    layer4 = `## 可用工具\n\n你可以调用以下工具来辅助作者创作。工具是可选的——只在确实需要时才调用。你可以在一轮对话中调用多个工具，按自己判断的顺序执行。每次工具调用后你会收到结果，然后可以决定下一步做什么。\n\n${toolDescriptions}\n\n**工具使用指南**：\n- 不确定作者当前模块的内容时，先用 \`read_module\` 了解现状\n- 生成内容前，确认理解了模板结构和上下文包中的约束\n- 生成后，用 \`write_to_slot\` 保存结果（自动走版本历史）\n- 如果作者的要求不够具体，先问清楚再操作，不要自行决定

**处理复杂任务**：
当作者的任务涉及多个步骤时（如"参考XX优化角色"、"帮我完成这一章"），你应该：
1. 先将复杂任务分解为 2-5 个子步骤
2. 在回复中简要说明你的计划（如"我将分三步：先读现状，再参考案例，最后生成修改"）
3. 逐步执行每个子步骤，每步可以包含多次工具调用
4. 全部完成后给出总结
你最多可以进行 30 轮工具调用——足够完成大多数复杂创作任务。

对于特别复杂的任务，你可以使用 \`checklist_write\` 工具来创建任务清单，然后逐步执行并在完成每个子任务时更新状态。这样作者能看到你的进度，你也可以在需要作者确认的节点停下来等待反馈。`;
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

  // 5b. 作品级记忆（L2.1 接入）
  memParts.push('*（作品级记忆和用户画像将在 L2.1 接入，当前暂未启用。）*');

  const layer5 = memParts.join('\n\n');

  // 拼接完整 system prompt
  const parts = [layer1, layer2, layer3, layer4, layer5].filter(p => p.length > 0);
  const full = parts.join('\n\n---\n\n');

  return {
    full,
    layer_1_persona: layer1,
    layer_2_context_package: layer2,
    layer_3_references: layer3,
    layer_4_tools: layer4,
    layer_5_memory: layer5,
  };
}
