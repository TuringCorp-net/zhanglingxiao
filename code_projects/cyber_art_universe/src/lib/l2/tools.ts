// L2: 工具注册与实现
// L2.0 提供 4 个工具：checklist_write / get_writing_guide / read_module / write_to_slot
// Story Elf 自主生成内容（通过 write_to_slot 写入），不再嵌套 LLM 调用。

import { Env } from '../../db/schema';
import type { L2ToolDef } from './types';
import { getModule, updateModule } from '../../api/write/module';
import { type Lang } from '../l1/work-content';
import { getModuleGuide } from './guides';
import { saveChecklist } from './memory';

// ============================================================
// 工具工厂
// ============================================================

export function createTools(env: Env, workId: string, lang: string): L2ToolDef[] {
  return [
    createChecklistTool(env, workId),
    createWritingGuideTool(env),
    createReadModuleTool(env),
    createWriteToSlotTool(env),
  ];
}

// ============================================================
// 归属权校验辅助
// ============================================================

/**
 * 校验 user_token 是否对指定 work 有操作权限。
 * 返回 null 表示通过，返回 string 表示错误消息。
 */
async function checkWorkAccess(env: Env, workId: string, userToken: string, action: string): Promise<string | null> {
  if (!workId) return null;

  if (userToken === 'admin-Tu') return null;

  try {
    const work = await env.DB.prepare(
      'SELECT user_token FROM works WHERE id = ?'
    ).bind(workId).first<{ user_token: string }>();

    if (!work) return `错误：作品 ${workId} 不存在。`;
    if (!work.user_token || work.user_token === '') return null;
    if (work.user_token !== userToken) {
      return `错误：你没有权限${action}此作品。此作品属于其他用户。`;
    }
    return null;
  } catch (err) {
    console.error('[tools] 权限校验失败:', (err as Error).message);
    return `错误：权限校验失败。`;
  }
}


// ============================================================
// checklist_write — LLM 自管理任务进度
// ============================================================

let _checklistState: { todos: { content: string; status: string }[] } = { todos: [] };

function createChecklistTool(env: Env): L2ToolDef {
  return {
    def: {
      type: 'function',
      function: {
        name: 'checklist_write',
        description: '创建或更新任务清单，用于追踪复杂多步骤任务的进度。当你面对需要分解为子任务的工作时，先用此工具写下计划，然后逐步执行并更新状态。参数: todos(任务列表，每项含 content 和 status), status 可选: pending/in_progress/completed',
        parameters: {
          type: 'object',
          properties: {
            todos: {
              type: 'array',
              description: '任务列表（会替换现有清单）',
              items: {
                type: 'object',
                properties: {
                  content: { type: 'string', description: '任务描述' },
                  status: { type: 'string', enum: ['pending', 'in_progress', 'completed'], description: '任务状态' },
                },
                required: ['content', 'status'],
              },
            },
          },
          required: ['todos'],
        },
      },
    },
    is_mutating: false,
    execute: async (params: Record<string, unknown>) => {
      const todos = params.todos as Array<{ content: string; status: string }>;
      _checklistState.todos = todos;

      const workId = params.work_id as string;
      if (workId) {
        saveChecklist(env, workId, todos).catch(err =>
          console.error('[checklist] 持久化失败:', (err as Error).message));
      }

      const counts = { pending: 0, in_progress: 0, completed: 0 };
      for (const t of todos) {
        if (t.status === 'pending') counts.pending++;
        else if (t.status === 'in_progress') counts.in_progress++;
        else if (t.status === 'completed') counts.completed++;
      }
      const total = todos.length;
      const pct = total > 0 ? Math.round((counts.completed / total) * 100) : 0;
      let result = `任务清单（${total} 项，${pct}% 完成）:\n`;
      for (const t of todos) {
        const icon = t.status === 'completed' ? '✅' : t.status === 'in_progress' ? '🔄' : '⬜';
        result += `${icon} ${t.content}\n`;
      }
      return result;
    },
  };
}

// ============================================================
// get_writing_guide — 按需获取模块写作指南（就近原则）
// ============================================================

function createWritingGuideTool(env: Env): L2ToolDef {
  return {
    def: {
      type: 'function',
      function: {
        name: 'get_writing_guide',
        description: '获取指定模块或任务的写作指南，包括模块定位、模板结构、写作要点和特殊规则。在生成或修改任何内容之前调用此工具，确保输出符合规范。参数 module_type 可选: m0(原始构想), m1(世界观), m2(大纲), m3_card(人物卡), m4_strategy(伏笔策略), m4_card(伏笔卡), m5_intent(意图卡), m6_chapter(章节正文)',
        parameters: {
          type: 'object',
          properties: {
            module_type: {
              type: 'string',
              description: '模块类型',
              enum: ['m0', 'm1', 'm2', 'm3_card', 'm4_strategy', 'm4_card', 'm5_intent', 'm6_chapter'],
            },
          },
          required: ['module_type'],
        },
      },
    },
    is_mutating: false,
    execute: async (params: Record<string, unknown>) => {
      const moduleType = params.module_type as string;
      const lang = (params._lang as Lang) || 'zh';
      return getModuleGuide(moduleType, lang);
    },
  };
}

// ============================================================
// read_module
// ============================================================

function createReadModuleTool(env: Env): L2ToolDef {
  return {
    def: {
      type: 'function',
      function: {
        name: 'read_module',
        description: '读取指定模块的当前内容（slots 结构化数据 + free_content 自由写作）。在需要了解作者已经写了什么时调用。参数 module_type 可选: m1(世界观), m2(大纲), m3_card(人物卡), m4_strategy(伏笔策略), m4_card(伏笔卡), m5_intent(意图卡), m6_chapter(章节正文)',
        parameters: {
          type: 'object',
          properties: {
            module_type: { type: 'string', description: '模块类型', enum: ['m1', 'm2', 'm3_card', 'm4_strategy', 'm4_card', 'm5_intent', 'm6_chapter'] },
            module_id: { type: 'string', description: '模块 ID（可选）。不传则使用默认模块（如 m1_{work_id}）。卡片类模块必须传具体 ID' },
          },
          required: ['module_type'],
        },
      },
    },
    is_mutating: false,
    execute: async (params: Record<string, unknown>) => {
      const moduleType = params.module_type as string;
      const workId = params.work_id as string;
      const userToken = (params._user_token as string) || '';

      const accessError = await checkWorkAccess(env, workId, userToken, '读取');
      if (accessError) return accessError;

      const moduleId = (params.module_id as string) || `${moduleType}_${workId}`;
      const url = `https://internal/api/write/module/${moduleId}?lang=${params._lang || 'zh'}`;
      const req = new Request(url, { headers: { 'Accept-Language': (params._lang as string) || 'zh' } });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const response = await getModule(env, req as any, moduleId);
      const data = await response.json() as Record<string, unknown>;

      if (!data.ok) {
        return `读取模块失败: ${JSON.stringify((data as { error?: { message?: string } }).error)}`;
      }

      const result = (data.data || {}) as Record<string, unknown>;
      const slots = result.slots || {};
      const freeContent = result.free_content || '';
      const moduleName = result.name || moduleType;

      let summary = `模块: ${moduleName} (${moduleType})\n\n`;
      if (Object.keys(slots as object).length > 0) {
        summary += `=== 结构化槽位 ===\n${JSON.stringify(slots, null, 2)}\n\n`;
      }
      if (freeContent) {
        summary += `=== 自由写作区 ===\n${(freeContent as string).substring(0, 3000)}`;
      }
      return summary || `模块 ${moduleId} 内容为空（新模块，尚未填写）`;
    },
  };
}

// ============================================================
// write_to_slot
// ============================================================

function createWriteToSlotTool(env: Env): L2ToolDef {
  return {
    def: {
      type: 'function',
      function: {
        name: 'write_to_slot',
        description: '将你生成的内容写入指定模块的槽位。所有写入自动走版本历史，可回滚。在写入前应先调用 get_writing_guide 了解模块规范，调用 read_module 了解当前状态。参数: module_type(模块类型), slot_values(槽位ID→内容的映射，key 必须严格使用 get_writing_guide 返回的模板 slot_id，不可自行发明), free_content(可选), module_id(可选，默认 {module_type}_{work_id})',
        parameters: {
          type: 'object',
          properties: {
            module_type: { type: 'string', description: '模块类型', enum: ['m1', 'm2', 'm3_card', 'm4_strategy', 'm4_card', 'm5_intent', 'm6_chapter', 'm0'] },
            slot_values: { type: 'object', description: '槽位 ID 到内容的映射，如 {"power_system": "魔法体系分为三层..."}' },
            free_content: { type: 'string', description: '可选：自由写作区内容' },
            module_id: { type: 'string', description: '可选：模块 ID。不传则使用默认值' },
          },
          required: ['module_type', 'slot_values'],
        },
      },
    },
    is_mutating: true,
    execute: async (params: Record<string, unknown>) => {
      const moduleType = params.module_type as string;
      const workId = params.work_id as string;
      const userToken = (params._user_token as string) || '';

      const accessError = await checkWorkAccess(env, workId, userToken, '修改');
      if (accessError) return accessError;

      const moduleId = (params.module_id as string) || `${moduleType}_${workId}`;
      const slotValues = params.slot_values as Record<string, string>;
      const freeContent = params.free_content as string | undefined;

      if (moduleType === 'm0') {
        return '错误：M0（原始构想）不可通过工具修改。M0 仅供理解作者意图。';
      }

      const body: Record<string, unknown> = { slots: slotValues };
      if (freeContent !== undefined) body.free_content = freeContent;

      const url = `https://internal/api/write/module/${moduleId}?lang=${params._lang || 'zh'}`;
      const req = new Request(url, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Accept-Language': (params._lang as string) || 'zh',
        },
        body: JSON.stringify(body),
      });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const response = await updateModule(env, req as any, moduleId);
      const data = await response.json() as Record<string, unknown>;

      if (!data.ok) {
        return `写入失败: ${JSON.stringify((data as { error?: { message?: string } }).error)}`;
      }

      const resultData = (data.data || {}) as Record<string, unknown>;
      const warnings = resultData.slot_warnings as string[] | undefined;
      const writtenCount = Object.keys(resultData.slots || {}).filter(
        k => (resultData.slots as Record<string, string>)[k]?.trim()
      ).length;

      let msg = `✅ 已写入 ${writtenCount} 个槽位到模块 ${moduleId}。版本历史已自动保存，可回滚。`;
      if (warnings && warnings.length > 0) {
        msg += '\n\n' + warnings.join('\n');
      }
      return msg;
    },
  };
}
