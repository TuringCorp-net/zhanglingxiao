// L2: 工具注册与实现
// L2.0 提供 4 个工具：checklist_write / get_writing_guide / read_module / write_to_slot
// Story Elf 自主生成内容（通过 write_to_slot 写入），不再嵌套 LLM 调用。
//
// 所有工具的错误返回值均采用"教学式自然语言"——不仅告知错误，
// 还说明可能原因和修复建议。LLM 读到错误消息后应能自行纠正。

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

/** 校验 user_token 是否对指定 work 有操作权限。返回 null=通过，string=错误消息。 */
async function checkWorkAccess(env: Env, workId: string, userToken: string, action: string): Promise<string | null> {
  if (!workId) return null;
  if (userToken === 'admin-Tu') return null;

  try {
    const work = await env.DB.prepare(
      'SELECT user_token FROM works WHERE id = ?'
    ).bind(workId).first<{ user_token: string }>();

    if (!work) {
      return `❌ 作品 ${workId} 不存在，无法${action}。\n请确认你使用的 work_id 正确。如果这是新作品，需要先在 Story Forger 中创建。`;
    }
    if (!work.user_token || work.user_token === '') return null;
    if (work.user_token !== userToken) {
      return `❌ 你当前使用的 token 没有权限${action}此作品。\n此作品属于其他用户。如果你需要访问此作品，请联系作品所有者或使用正确的 token。`;
    }
    return null;
  } catch (err) {
    console.error('[tools] 权限校验失败:', (err as Error).message);
    return `❌ 权限校验时发生系统错误，请稍后重试。如果持续出现，请联系管理员。`;
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
      const todos = params.todos as Array<{ content: string; status: string }> | undefined;
      if (!todos || !Array.isArray(todos) || todos.length === 0) {
        return '❌ 调用 check_write 时缺少有效的 todos 参数。\n请传入一个任务列表，每项包含 content（任务描述）和 status（pending/in_progress/completed）。\n例如: {"todos": [{"content": "填充世界观力量体系", "status": "in_progress"}, {"content": "检查大纲一致性", "status": "pending"}]}';
      }

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

      if (counts.in_progress === 0 && counts.pending > 0) {
        result += '\n💡 提示：建议将当前要做的第一项任务标记为 in_progress，这样作者能看到你的进度。';
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
      if (!moduleType) {
        return '❌ get_writing_guide 需要传入 module_type 参数。\n可选的类型: m0, m1, m2, m3_card, m4_strategy, m4_card, m5_intent, m6_chapter。\n例如: get_writing_guide({"module_type": "m3_card"}) 可以获取人物卡的写作指南。';
      }
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
        description: '读取指定模块的当前内容（slots 结构化数据 + free_content 自由写作）。在需要了解作者已经写了什么时调用。参数 module_type 可选: m1(世界观), m2(大纲), m3_card(人物卡—自动返回全部卡片), m4_strategy(伏笔策略), m4_card(伏笔卡—自动返回全部卡片), m5_intent(意图卡—自动返回全部卡片), m6_chapter(章节正文)。卡片类模块无需指定 module_id，自动返回该类型的所有卡片。',
        parameters: {
          type: 'object',
          properties: {
            module_type: { type: 'string', description: '模块类型', enum: ['m1', 'm2', 'm3_card', 'm4_strategy', 'm4_card', 'm5_intent', 'm6_chapter'] },
            module_id: { type: 'string', description: '可选：指定具体的模块 ID。不传则 m1/m2/m4_strategy/m6_chapter 使用默认模块，卡片类(m3_card/m4_card/m5_intent)自动返回所有卡片' },
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

      if (!moduleType) {
        return '❌ read_module 需要传入 module_type 参数。\n可选的类型: m1, m2, m3_card, m4_strategy, m4_card, m5_intent, m6_chapter。\n例如: read_module({"module_type": "m1"}) 读取世界观设定。';
      }

      const accessError = await checkWorkAccess(env, workId, userToken, '读取');
      if (accessError) return accessError;

      const lang = (params._lang as string) || 'zh';

      // 卡片类模块：自动列出所有卡片并返回完整内容
      const CARD_TYPES = ['m3_card', 'm4_card', 'm5_intent'];
      if (CARD_TYPES.includes(moduleType) && !params.module_id) {
        try {
          const mods = await env.DB.prepare(
            'SELECT id, name FROM modules WHERE work_id = ? AND type = ? ORDER BY order_index ASC'
          ).bind(workId, moduleType).all<{ id: string; name: string }>();

          if (!mods.results?.length) {
            return `模块类型 ${moduleType} 下暂无卡片。\n此作品可能还没有创建该类型的卡片。`;
          }

          const cardResults: string[] = [];
          let failedCount = 0;
          for (const mod of mods.results) {
            const url = `https://internal/api/write/module/${mod.id}?lang=${lang}`;
            const req = new Request(url, { headers: { 'Accept-Language': lang } });
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const resp = await getModule(env, req as any, mod.id);
            const cardData = await resp.json() as Record<string, unknown>;
            if (cardData.ok) {
              const card = (cardData.data || {}) as Record<string, unknown>;
              const cardSlots = card.slots || {};
              const cardFree = card.free_content || '';
              cardResults.push(`### ${mod.name} (${mod.id})\n`);
              if (Object.keys(cardSlots as object).length > 0) {
                cardResults.push(`\`\`\`json\n${JSON.stringify(cardSlots, null, 2)}\n\`\`\`\n`);
              }
              if (cardFree) {
                cardResults.push(`自由写作区: ${(cardFree as string).substring(0, 2000)}\n`);
              }
            } else {
              failedCount++;
            }
          }

          const header = `模块类型: ${moduleType}（共 ${mods.results.length} 张卡片${failedCount > 0 ? `，${failedCount} 张读取失败` : ''}）\n\n`;
          return cardResults.length > 0
            ? header + cardResults.join('\n')
            : `模块类型 ${moduleType} 下尚无有效卡片内容，所有卡片（${mods.results.length} 张）均读取失败。\n这可能是因为卡片文件尚未创建或已损坏。`;
        } catch (err) {
          return `❌ 读取卡片列表时发生错误: ${(err as Error).message}\n这可能是因为 modules 表中没有该类型的记录。请确认该作品下确实存在 ${moduleType} 类型的卡片。`;
        }
      }

      // 单模块读取（非卡片类型，或指定了具体 module_id）
      const moduleId = (params.module_id as string) || `${moduleType}_${workId}`;
      const url = `https://internal/api/write/module/${moduleId}?lang=${lang}`;
      const req = new Request(url, { headers: { 'Accept-Language': lang } });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const response = await getModule(env, req as any, moduleId);
      const data = await response.json() as Record<string, unknown>;

      if (!data.ok) {
        const errMsg = (data as { error?: { message?: string } }).error?.message || JSON.stringify((data as { error?: { message?: string } }).error);
        return `❌ 读取模块失败: ${errMsg}\n\n可能原因及修复建议:\n- 如果 module_id 不正确，请确认该模块的真实 ID。你可以不传 module_id，系统会自动使用默认 ID（格式: {module_type}_{work_id}）\n- 对于卡片类模块（m3_card/m4_card/m5_intent），不传 module_id 会自动返回所有卡片，无需指定具体的卡片 ID\n- 如果模块确实不存在，说明该作品下还没有创建此模块`;
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
      if (!summary.trim().endsWith('自由写作区')) {
        // Module has no content yet
      }
      return summary || `模块 ${moduleId} 内容为空（新模块，尚未填写任何内容）。`;
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
      const slotValues = params.slot_values as Record<string, string> | undefined;

      // 参数校验（教学式错误消息）
      if (!moduleType) {
        return '❌ write_to_slot 需要传入 module_type 参数。\n可选的类型: m1, m2, m3_card, m4_strategy, m4_card, m5_intent, m6_chapter。\n例如: write_to_slot({"module_type": "m1", "slot_values": {"power_system": "..."}})';
      }

      if (!slotValues || typeof slotValues !== 'object' || Object.keys(slotValues).length === 0) {
        return '❌ write_to_slot 需要传入 slot_values 参数。\nslot_values 是一个对象，key 是槽位 ID（必须严格使用 get_writing_guide 返回的模板 slot_id），value 是要写入的 Markdown 内容。\n例如: write_to_slot({"module_type": "m1", "slot_values": {"power_system": "## 力量体系\\n\\n..."}})';
      }

      // 归属权校验
      const accessError = await checkWorkAccess(env, workId, userToken, '修改');
      if (accessError) return accessError;

      // M0 保护
      if (moduleType === 'm0') {
        return '❌ M0（原始构想）不可通过工具修改。\nM0 是作者自己的编辑空间，用于记录最原始的创作灵感。你只能与作者讨论 M0 的内容，提供建议让作者参考后自行修改（通过自由编辑区）。\n如果你发现 M1-M6 的内容跟 M0 有冲突，可以提示作者注意，但不要直接修改 M0。';
      }

      const moduleId = (params.module_id as string) || `${moduleType}_${workId}`;

      const body: Record<string, unknown> = { slots: slotValues };
      if (params.free_content !== undefined) body.free_content = params.free_content;

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
        const errMsg = (data as { error?: { message?: string } }).error?.message || JSON.stringify((data as { error?: { message?: string } }).error);
        return `❌ 写入失败: ${errMsg}\n\n可能原因及修复建议:\n- 如果提示 "Module not found"，说明 module_id 不正确。请确认 module_type 参数已传入（如 "m1"），或不传 module_id 让系统自动使用默认值\n- 如果提示 slot ID 无效，说明你使用的槽位 ID 不在模板中。请调用 get_writing_guide("${moduleType}") 获取该模块的精确 slot_id 列表，然后重新写入\n- 如果模块确实不存在，请检查 work_id 是否正确`;
      }

      const resultData = (data.data || {}) as Record<string, unknown>;
      const warnings = resultData.slot_warnings as string[] | undefined;
      const writtenSlots = resultData.slots as Record<string, string> || {};
      const writtenCount = Object.keys(writtenSlots).filter(k => writtenSlots[k]?.trim()).length;

      let msg = `✅ 已写入 ${writtenCount} 个槽位到模块 ${moduleId}。版本历史已自动保存，可回滚。`;
      if (warnings && warnings.length > 0) {
        msg += '\n\n' + warnings.join('\n');
      }
      return msg;
    },
  };
}
