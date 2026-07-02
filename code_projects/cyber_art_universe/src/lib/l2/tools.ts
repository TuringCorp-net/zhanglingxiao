// L2: 工具注册与实现
// L2.0 提供 4 个工具：checklist_write / get_writing_guide / read_module / write_to_slot
// Story Elf 自主生成内容（通过 write_to_slot 写入），不再嵌套 LLM 调用。
//
// 所有工具的错误返回值均采用"教学式自然语言"——不仅告知错误，
// 还说明可能原因和修复建议。LLM 读到错误消息后应能自行纠正。

import { Env } from '../../db/schema';
import type { L2ToolDef } from './types';
import { getModule, updateModule } from '../../api/write/module';
import { type Lang, workContentPath } from '../l1/work-content';
import { getModuleGuide } from './guides';
import { saveChecklist } from './memory';
import { listVersions, getVersion } from '../l1/version';
import { diffWithCurrent } from '../l1/diff';

// ============================================================
// 工具工厂
// ============================================================

export function createTools(env: Env, workId: string, lang: string): L2ToolDef[] {
  // Agent Loop 级别的时间戳缓存：read_module 存，write_to_slot 取
  // 确保 LLM 基于"读到的时间戳"做冲突检测，而非"写入前那一刻的时间戳"
  const timestampCache = new Map<string, Record<string, number>>();

  return [
    createChecklistTool(env),
    createWritingGuideTool(env),
    createReadModuleTool(env, timestampCache),
    createCardTool(env),
    createDeleteModuleTool(env),
    createWriteToSlotTool(env, timestampCache),
    createVersionHistoryTool(env),
    createVersionDiffTool(env),
  ];
}

// ============================================================
// 归属权校验辅助
// ============================================================

/** 校验当前用户是否对指定 work 有操作权限。返回 null=通过，string=错误消息。 */
async function checkWorkAccess(env: Env, workId: string, userToken: string, action: string): Promise<string | null> {
  if (!workId) return null;
  // 管理员用户（class='admin'）直接放行
  if (env.currentUser?.class === 'admin') return null;

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
        strict: true,
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
        strict: true,
        description: '获取指定模块或任务的写作指南，包括模块定位、模板结构、写作要点和特殊规则。在生成或修改任何内容之前调用此工具，确保输出符合规范。参数 module_type 可选: m0(原始构想), m1(世界观), m2(大纲), m3_card(人物卡), m4_card(伏笔卡), m5_intent(意图卡), m6_chapter(章节正文)',
        parameters: {
          type: 'object',
          properties: {
            module_type: {
              type: 'string',
              description: '模块类型',
              enum: ['m0', 'm1', 'm2', 'm3_card', 'm4_card', 'm5_intent', 'm6_chapter'],
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
        return '❌ get_writing_guide 需要传入 module_type 参数。\n可选的类型: m0, m1, m2, m3_card, m4_card, m5_intent, m6_chapter。\n例如: get_writing_guide({"module_type": "m3_card"}) 可以获取人物卡的写作指南。';
      }
      const lang = (params._lang as Lang) || 'zh';
      return getModuleGuide(moduleType, lang);
    },
  };
}

// ============================================================
// read_module
// ============================================================

function createReadModuleTool(env: Env, timestampCache: Map<string, Record<string, number>>): L2ToolDef {
  return {
    def: {
      type: 'function',
      function: {
        name: 'read_module',
        strict: true,
        description: '读取指定模块的内容。默认读取当前版本；传 version_id 可读取历史版本。使用方式取决于模块类型：\n\n**单文件模块 (m0/m1/m2)**：不传 module_id 直接用默认 ID 读取全部内容。\n\n**卡片类模块 (m3_card/m4_card/m5_intent/m6_chapter)**：分两步——① 不传 module_id → 获取卡片列表（仅 name + id）→ ② 选择目标卡片，传入 module_id → 获取该卡片的完整 slots + free_content。\n\n⚠️ 对于卡片类模块，请勿跳过第①步直接猜 module_id。拿到列表后选择合适的卡片，再传入 module_id 读取具体内容。\n\n📜 version_id 参数：不传读当前版本；传 "previous" 读上一个版本；传数字版本号如 "52" 读该版本完整快照。版本号可通过 get_version_history 获取。',
        parameters: {
          type: 'object',
          properties: {
            module_type: { type: 'string', description: '模块类型', enum: ['m0', 'm1', 'm2', 'm3_card', 'm4_card', 'm5_intent', 'm6_chapter'] },
            module_id: { type: 'string', description: '可选：指定具体的模块 ID。不传则单文件模块(m0/m1/m2)使用默认 ID，卡片类(m3_card/m4_card/m5_intent/m6_chapter)自动返回所有卡片' },
            version_id: { type: 'string', description: '可选：读取指定历史版本的完整内容。支持 "previous"（上一次修改前的版本）或数字版本号如 "52"。不传则读取当前版本。版本号可通过 get_version_history 获取。注意：version_id 仅对具体模块有意义，卡片列表模式（不传 module_id 的卡片类）下无效。' },
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
        return '❌ read_module 需要传入 module_type 参数。\n可选的类型: m1, m2, m3_card, m4_card, m5_intent, m6_chapter。\n例如: read_module({"module_type": "m1"}) 读取世界观设定。';
      }

      const accessError = await checkWorkAccess(env, workId, userToken, '读取');
      if (accessError) return accessError;

      const lang = (params._lang as string) || 'zh';

      // ── 版本读取分支 ──
      // 当 version_id 传入时，读取历史版本快照而非当前内容
      const versionId = params.version_id as string | undefined;
      if (versionId) {
        const moduleId = (params.module_id as string) || `${moduleType}_${workId}`;

        // 查询模块元信息（r2_json_key + name）
        const mod = await env.DB.prepare(
          'SELECT id, work_id, type, r2_json_key, name FROM modules WHERE id = ?'
        ).bind(moduleId).first<{ id: string; work_id: string; type: string; r2_json_key: string | null; name: string | null }>();

        if (!mod || !mod.r2_json_key) {
          return `❌ 模块 ${moduleId} 不存在或尚未创建，无法读取历史版本。\n请确认 module_type 和 module_id 正确。你可以先用 get_version_history({"module_type": "${moduleType}"}) 查看该模块的版本列表。`;
        }

        const jsonKey = workContentPath(mod.work_id, lang as 'zh' | 'en', mod.r2_json_key);

        // 解析 version_id 引用（与 get_version_diff 一致）
        const vers = await listVersions(env, jsonKey);
        let resolvedVersionId: string;

        if (versionId === 'previous') {
          if (vers.length === 0) {
            return `❌ 模块 ${moduleType} 没有历史版本。"previous" 不可用——此模块可能尚未被修改过。\n💡 去掉 version_id 参数即可读取当前内容。`;
          }
          resolvedVersionId = vers[0].id; // listVersions 按 version_num DESC 排列，第一个即最新
        } else {
          const num = parseInt(versionId, 10);
          if (!isNaN(num) && num > 0) {
            const found = vers.find(v => v.version_num === num);
            if (!found) {
              return `❌ 版本号 ${num} 不存在。可用版本号范围: 1-${vers.length}。\n💡 可通过 get_version_history({"module_type": "${moduleType}"}) 查看完整版本列表。`;
            }
            resolvedVersionId = found.id;
          } else {
            // 兜底：当作版本 UUID 直接使用
            resolvedVersionId = versionId;
          }
        }

        // 获取版本完整快照
        const snapshot = await getVersion(env, jsonKey, resolvedVersionId);
        if (snapshot === null) {
          return `❌ 版本 ${versionId} 的快照不存在或已被清理。\n系统默认保留最近 10 个版本，该版本可能已被自动清理。`;
        }

        // 解析快照并格式化（与当前版本读取保持一致的输出格式）
        const moduleName = mod.name || moduleType;
        const isJson = jsonKey.endsWith('.json');

        if (isJson) {
          try {
            const parsed = JSON.parse(snapshot);
            const slots = parsed.slots || {};
            const freeContent = parsed.free_content || '';

            let summary = `📜 历史版本: ${moduleName} (${moduleType})\n\n`;
            if (Object.keys(slots as object).length > 0) {
              summary += `=== 结构化槽位 ===\n${JSON.stringify(slots, null, 2)}\n\n`;
            }
            if (freeContent) {
              summary += `=== 自由写作区 ===\n${freeContent}`;
            }
            return summary || `版本 ${versionId} 的内容为空（新模块，尚未填写任何内容）。`;
          } catch {
            // JSON 解析失败，降级为纯文本返回
            return `📜 历史版本: ${moduleName} (${moduleType})\n\n${snapshot}`;
          }
        } else {
          return `📜 历史版本: ${moduleName} (${moduleType})\n\n${snapshot}`;
        }
      }

      // 卡片类模块：自动列出所有卡片并返回完整内容
      const CARD_TYPES = ['m3_card', 'm4_card', 'm5_intent', 'm6_chapter'];
      if (CARD_TYPES.includes(moduleType) && !params.module_id) {
        try {
          const mods = await env.DB.prepare(
            'SELECT id, name FROM modules WHERE work_id = ? AND type = ? ORDER BY order_index ASC'
          ).bind(workId, moduleType).all<{ id: string; name: string }>();

          if (!mods.results?.length) {
            return `模块类型 ${moduleType} 下暂无卡片。\n此作品可能还没有创建该类型的卡片。`;
          }

          // 只返回卡片列表（name + id），不读取具体内容。
          // 拿到目标卡片的 module_id 后，请再次调用 read_module 并传入 module_id 以获取完整内容。
          const cardList = mods.results.map(m => `- **${m.name}**: \`${m.id}\``).join('\n');
          return `模块类型: ${moduleType}（共 ${mods.results.length} 张卡片）\n\n${cardList}\n\n💡 请选择需要读取的卡片，用 read_module 传入对应的 module_id 获取完整内容。`;
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
        return `❌ 读取模块失败: ${errMsg}\n\n可能原因及修复建议:\n- 如果 module_id 不正确，请确认该模块的真实 ID。你可以不传 module_id，系统会自动使用默认 ID（格式: {module_type}_{work_id}）\n- 对于卡片类模块（m3_card/m4_card/m5_intent/m6_chapter），不传 module_id 会自动返回所有卡片\n- 如果模块确实不存在，说明该作品下还没有创建此模块`;
      }

      // 存储 slot_timestamps 到 Agent Loop 级别缓存，供 write_to_slot 做冲突检测
      const resultData = data.data as Record<string, unknown> | undefined;
      if (resultData?.slot_timestamps) {
        const cacheKey = `${moduleType}:${(params.module_id as string) || `${moduleType}_${workId}`}`;
        timestampCache.set(cacheKey, resultData.slot_timestamps as Record<string, number>);
      }

      const result = resultData || {};
      const slots = result.slots || {};
      const freeContent = result.free_content || '';
      const moduleName = result.name || moduleType;

      let summary = `模块: ${moduleName} (${moduleType})\n\n`;
      if (Object.keys(slots as object).length > 0) {
        summary += `=== 结构化槽位 ===\n${JSON.stringify(slots, null, 2)}\n\n`;
      }
      if (freeContent) {
        summary += `=== 自由写作区 ===\n${freeContent}`;
      }
      if (!summary.trim().endsWith('自由写作区')) {
        // Module has no content yet
      }
      return summary || `模块 ${moduleId} 内容为空（新模块，尚未填写任何内容）。`;
    },
  };
}

// ============================================================
// create_card — 新建卡片（人物卡、伏笔卡、章节蓝图、章节等）
// ============================================================

function createCardTool(env: Env): L2ToolDef {
  return {
    def: {
      type: 'function',
      function: {
        name: 'create_card',
        strict: true,
        description: '创建一张新卡片（人物卡/伏笔卡/章节蓝图/章节）。当你需要新增角色、伏笔条目、章节蓝图或具体章节时使用。成功创建后可用 write_to_slot 填入内容。参数: work_id, type(模块类型: m3_card/m4_card/m5_intent/m6_chapter), name(卡片名称，如角色名/伏笔名/章节名，必填)',
        parameters: {
          type: 'object',
          properties: {
            work_id: { type: 'string', description: '作品 ID' },
            type: { type: 'string', description: '模块类型。m3_card=人物卡, m4_card=伏笔卡, m5_intent=章节蓝图, m6_chapter=具体章节' },
            name: { type: 'string', description: '卡片名称。人物卡填角色名，伏笔卡填伏笔主题，章节蓝图/章节填章节标题' },
          },
          required: ['work_id', 'type', 'name'],
        },
      },
    },
    is_mutating: true,
    execute: async (params: Record<string, unknown>) => {
      const workId = (params.work_id as string) || '';
      const moduleType = (params.type as string) || '';
      const name = (params.name as string) || '';

      if (!moduleType) return '❌ create_card 需要传入 type 参数。可选的类型: m3_card, m4_card, m5_intent, m6_chapter';
      if (!name) return '❌ create_card 需要传入 name 参数（卡片名称）';

      const { createCard } = await import('../../api/write/module');
      const url = `https://internal/api/write/cards`;
      const req = new Request(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ work_id: workId, type: moduleType, name }),
      });
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const response = await createCard(env, req as any);
        const data = await response.json() as Record<string, unknown>;
        if (data.ok) {
          const d = data.data as Record<string, unknown>;
          return `✅ 卡片创建成功: ${d.name} (ID: ${d.id}, 类型: ${d.type})\n\n现在可以用 write_to_slot 往这张卡里写内容了。module_type 用 "${moduleType}"，如果有多张同类型卡片，需要用 module_id = "${d.id}" 来精确指定。`;
        }
        return `❌ 创建失败: ${JSON.stringify(data.error)}`;
      } catch (err) {
        return `❌ 创建卡片时出错: ${(err as Error).message}`;
      }
    },
  };
}

// ============================================================
// delete_module — 删除模块（卡片/蓝图/章节）
// ============================================================

function createDeleteModuleTool(env: Env): L2ToolDef {
  return {
    def: {
      type: 'function',
      function: {
        name: 'delete_module',
        strict: true,
        description: '删除一个模块（人物卡/伏笔卡/章节蓝图/章节）。不可恢复，请谨慎使用。需要先通过 read_module 获取 module_id。参数: module_id(要删除的模块 ID，如 m3_card_xxx)',
        parameters: {
          type: 'object',
          properties: {
            module_id: { type: 'string', description: '要删除的模块 ID，如 m3_card_xxx' },
          },
          required: ['module_id'],
        },
      },
    },
    is_mutating: true,
    execute: async (params: Record<string, unknown>) => {
      const moduleId = (params.module_id as string) || '';
      if (!moduleId) return '❌ delete_module 需要传入 module_id 参数';

      const { deleteModule } = await import('../../api/write/module');
      const url = `https://internal/api/write/cards/${encodeURIComponent(moduleId)}`;
      const req = new Request(url, { method: 'DELETE' });
      try {
        const response = await deleteModule(env, req as any, moduleId);
        const data = await response.json() as Record<string, unknown>;
        if (data.ok) return `✅ 模块已删除: ${moduleId}`;
        return `❌ 删除失败: ${JSON.stringify(data.error)}`;
      } catch (err) {
        return `❌ 删除模块时出错: ${(err as Error).message}`;
      }
    },
  };
}

// ============================================================
// write_to_slot
// ============================================================
//
// TODO: 内容保护层
// 当前 LLM 手写 JSON 时，Markdown 中的特殊字符（引号、反斜杠等）可能未正确转义，
// 导致 JSON.parse 在 agent.ts 中失败。单 slot 模式已大幅降低失败率，但未完全消除。
// 未来应在此函数入口处添加一层保护：
//   - 接收原始 arguments 字符串 + 已解析的 params
//   - 若 params 为空（JSON.parse 失败），尝试从原始字符串中提取 content
//   - 或：考虑将 content 放在 HTTP body 顶层字段，绕过 JSON 嵌套转义
// 参考资料：OpenAI tool calling 规范、DeepSeek 官方文档

function createWriteToSlotTool(env: Env, timestampCache: Map<string, Record<string, number>>): L2ToolDef {
  return {
    def: {
      type: 'function',
      function: {
        name: 'write_to_slot',
        strict: true,
        description: '将你在回复正文中输出的 Markdown 内容写入指定槽位。工作流程：① 在回复正文中以 markdown 代码块输出要写入的完整内容（用 ```markdown ``` 包裹），② 再调用本工具，只传 module_type 和 slot_id。系统会自动从代码块中提取纯内容写入。\n\n示例回复格式：\n```markdown\n## 二、社会组织与结构\n### 2.1 弯月大陆基础格局\n...完整设定内容...\n```\n\n💡 重要：代码块中只放要写入槽位的纯 Markdown 内容，不要放对话性文字（如"好的"、"以下是内容"、"现在调用工具写入"等）。这些对话性文字可以写在代码块外面。参数: module_type(模块类型), slot_id(槽位ID)',
        parameters: {
          type: 'object',
          properties: {
            module_type: { type: 'string', description: '模块类型', enum: ['m1', 'm2', 'm3_card', 'm4_card', 'm5_intent', 'm6_chapter', 'm0'] },
            slot_id: { type: 'string', description: '槽位 ID。必须严格使用 get_writing_guide 返回的合法 slot_id' },
            module_id: { type: 'string', description: '可选：模块 ID。不传则使用默认值 {module_type}_{work_id}' },
          },
          required: ['module_type', 'slot_id'],
        },
      },
    },
    is_mutating: true,
    execute: async (params: Record<string, unknown>) => {
      const moduleType = params.module_type as string;
      const slotId = params.slot_id as string;
      const content = params.content as string;
      const workId = params.work_id as string;
      const userToken = (params._user_token as string) || '';

      // 参数校验（教学式错误消息）
      if (!moduleType) {
        return '❌ write_to_slot 需要传入 module_type 参数。\n可选的类型: m1, m2, m3_card, m4_card, m5_intent, m6_chapter。\n例如: write_to_slot({"module_type": "m1", "slot_id": "power_system", "content": "## 力量体系\\n\\n..."})';
      }

      if (!slotId) {
        return '❌ write_to_slot 需要传入 slot_id 参数。\n例如: write_to_slot({"module_type": "m1", "slot_id": "power_system"})\n\n💡 提示：请先在回复正文中输出要写入的完整 Markdown 内容，再调用本工具。系统会自动从你的回复正文中提取内容写入。合法 slot_id 列表请通过 get_writing_guide("' + (moduleType || 'm1') + '") 获取。';
      }

      // 归属权校验
      const accessError = await checkWorkAccess(env, workId, userToken, '修改');
      if (accessError) return accessError;

      // M0 保护
      if (moduleType === 'm0') {
        return '❌ M0（原始构想）不可通过工具修改。\nM0 是作者自己的编辑空间，用于记录最原始的创作灵感。你只能与作者讨论 M0 的内容，提供建议让作者参考后自行修改（通过自由编辑区）。\n如果你发现 M1-M6 的内容跟 M0 有冲突，可以提示作者注意，但不要直接修改 M0。';
      }

      const moduleId = (params.module_id as string) || `${moduleType}_${workId}`;

      const body: Record<string, unknown> = { slots: { [slotId]: content } };
      if (params.free_content !== undefined) body.free_content = params.free_content;

      // 乐观并发控制：携带时间戳基线（从 Agent Loop 级缓存获取，或即时读取）
      const cacheKey = `${moduleType}:${moduleId}`;
      let prevTimestamps = timestampCache.get(cacheKey);
      if (!prevTimestamps) {
        // LLM 未先调用 read_module → 即时读取当前 R2 时间戳作为基线
        try {
          const modRow = await env.DB.prepare(
            'SELECT work_id, r2_json_key FROM modules WHERE id = ?'
          ).bind(moduleId).first<{ work_id: string; r2_json_key: string | null }>();
          if (modRow?.r2_json_key) {
            const jsonKey = workContentPath(modRow.work_id, lang as 'zh' | 'en', modRow.r2_json_key);
            const obj = await env.WORKS_BUCKET.get(jsonKey);
            if (obj) {
              const r2Data = JSON.parse(await obj.text());
              if (r2Data.slot_timestamps) {
                prevTimestamps = r2Data.slot_timestamps as Record<string, number>;
                timestampCache.set(cacheKey, prevTimestamps);
              }
            }
          }
        } catch { /* 读取失败则不带时间戳，updateModule 将返回 400 */ }
      }
      if (prevTimestamps) {
        body._prev_slot_timestamps = prevTimestamps;
      }

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
        const errCode = (data as { error?: { code?: string } }).error?.code;
        const errMsg = (data as { error?: { message?: string } }).error?.message || JSON.stringify((data as { error?: { message?: string } }).error);

        // 409 冲突：时间戳不匹配 → 教学式错误，引导 LLM 重新读取
        if (errCode === 'CONTENT_STALE') {
          return `❌ 写入冲突：${errMsg}\n\n这说明在你准备修改期间，该模块的内容已被其他人（可能是作者在前端编辑）修改。\n\n👉 你需要：① 重新调用 read_module 获取最新内容和时间戳 ② 基于最新内容重新生成你的修改 ③ 再次调用 write_to_slot 写入。`;
        }

        // 400 缺少时间戳：向后兼容处理，引导 LLM 先读
        if (errCode === 'MISSING_TIMESTAMPS') {
          return `❌ 写入前需要先获取模块的时间戳基线。\n\n👉 请先调用 read_module({"module_type": "${moduleType}"${params.module_id ? `, "module_id": "${params.module_id}"` : ''}}) 获取当前内容，确认无误后再调用 write_to_slot 写入。`;
        }

        return `❌ 写入失败: ${errMsg}\n\n可能原因及修复建议:\n- 如果提示 "Module not found"：可能是不存在的卡片——请先用 create_card 创建，再用 write_to_slot 写入内容\n- 如果提示 slot ID 无效，说明你使用的 slot_id 不在模板中。请调用 get_writing_guide("${moduleType}") 获取该模块的合法 slot_id 列表，然后重新写入\n- 如果模块确实不存在，请检查 work_id 是否正确`;
      }

      const resultData = (data.data || {}) as Record<string, unknown>;
      const warnings = resultData.slot_warnings as string[] | undefined;

      let msg = `✅ 已将内容写入 ${moduleId} 的槽位 "${slotId}"。版本历史已自动保存，可回滚。`;
      if (warnings && warnings.length > 0) {
        msg += '\n\n' + warnings.join('\n');
      }
      return msg;
    },
  };
}

// ============================================================
// get_version_history — 查看模块的修改历史
// ============================================================

function createVersionHistoryTool(env: Env): L2ToolDef {
  return {
    def: {
      type: 'function',
      function: {
        name: 'get_version_history',
        strict: true,
        description: '查看指定模块的历史版本列表。在修改前可调用此工具了解最近的变更记录，避免重复劳动或冲突。参数 module_type 即可，无需版本 ID。返回最近 10 个版本的编号、时间和概要。',
        parameters: {
          type: 'object',
          properties: {
            module_type: { type: 'string', description: '模块类型', enum: ['m1', 'm2', 'm3_card', 'm4_card', 'm5_intent', 'm6_chapter'] },
          },
          required: ['module_type'],
        },
      },
    },
    is_mutating: false,
    execute: async (params: Record<string, unknown>) => {
      const moduleType = params.module_type as string;
      const workId = params.work_id as string;
      const lang = (params._lang as string) || 'zh';

      if (!moduleType) {
        return '❌ get_version_history 需要传入 module_type 参数。\n例如: get_version_history({"module_type": "m1"})';
      }

      try {
        // 查询模块
        const moduleId = `${moduleType}_${workId}`;
        const mod = await env.DB.prepare(
          'SELECT id, work_id, type, r2_json_key FROM modules WHERE id = ?'
        ).bind(moduleId).first<{ id: string; work_id: string; type: string; r2_json_key: string | null }>();

        if (!mod || !mod.r2_json_key) {
          return `模块 ${moduleType} 暂无版本历史。此模块可能尚未创建或从未被修改过。`;
        }

        const jsonKey = workContentPath(mod.work_id, lang as 'zh' | 'en', mod.r2_json_key);
        const versions = await listVersions(env, jsonKey);

        if (!versions || versions.length === 0) {
          return `模块 ${moduleType} 暂无历史版本记录。每次通过 write_to_slot 写入内容时，系统会自动保存修改前的版本。`;
        }

        let result = `模块 ${moduleType} 的版本历史（共 ${versions.length} 个版本，最近 ${Math.min(10, versions.length)} 个）:\n\n`;
        for (const v of versions.slice(0, 10)) {
          const date = new Date(v.created_at).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' });
          const sizeStr = v.size_bytes ? ` (${Math.round(v.size_bytes / 1024)}KB)` : '';
          result += `- v${v.version_num} — ${date}${sizeStr}\n`;
        }

        if (versions.length > 1) {
          result += `\n💡 要查看两次修改之间的具体差异，请使用 get_version_diff。\n例如对比上一次修改与当前内容: get_version_diff({"module_type": "${moduleType}", "v1": "previous"})\n或对比特定版本号: get_version_diff({"module_type": "${moduleType}", "v1": 1})`;
        }
        return result;
      } catch (err) {
        return `❌ 获取版本历史失败: ${(err as Error).message}`;
      }
    },
  };
}

// ============================================================
// get_version_diff — 对比两个版本之间的差异
// ============================================================

function createVersionDiffTool(env: Env): L2ToolDef {
  return {
    def: {
      type: 'function',
      function: {
        name: 'get_version_diff',
        strict: true,
        description: '对比模块两个版本之间的差异，查看具体修改了什么内容。v1/v2 可使用相对引用（无需 UUID）：默认 v1="previous"(上次修改前)、v2="current"(当前内容)。也可指定版本号如 v1=1（对比版本1与当前内容）。',
        parameters: {
          type: 'object',
          properties: {
            module_type: { type: 'string', description: '模块类型', enum: ['m1', 'm2', 'm3_card', 'm4_card', 'm5_intent', 'm6_chapter'] },
            v1: { type: 'string', description: '对比的起点版本。默认"previous"（上次修改前的版本）。可选: "previous", "current", 版本号(如1,2,3), 或具体版本ID' },
            v2: { type: 'string', description: '对比的终点版本。默认"current"（当前内容）。可选: "previous", "current", 版本号, 或具体版本ID' },
          },
          required: ['module_type'],
        },
      },
    },
    is_mutating: false,
    execute: async (params: Record<string, unknown>) => {
      const moduleType = params.module_type as string;
      const workId = params.work_id as string;
      const lang = (params._lang as string) || 'zh';
      const v1Raw = (params.v1 as string) || 'previous';
      const v2Raw = (params.v2 as string) || 'current';

      if (!moduleType) {
        return '❌ get_version_diff 需要传入 module_type 参数。\n例如对比上次修改与当前内容: get_version_diff({"module_type": "m1"})\n或对比特定版本: get_version_diff({"module_type": "m1", "v1": 1})';
      }

      try {
        const moduleId = `${moduleType}_${workId}`;
        const mod = await env.DB.prepare(
          'SELECT id, work_id, type, r2_json_key FROM modules WHERE id = ?'
        ).bind(moduleId).first<{ id: string; work_id: string; type: string; r2_json_key: string | null }>();

        if (!mod || !mod.r2_json_key) {
          return `模块 ${moduleType} 暂无版本数据，无法对比。`;
        }

        const jsonKey = workContentPath(mod.work_id, lang as 'zh' | 'en', mod.r2_json_key);

        // 解析 relative references
        const resolveRef = async (raw: string, key: string): Promise<string> => {
          if (raw === 'current') return 'current';
          const vers = await listVersions(env, key);
          if (raw === 'previous') {
            return vers.length > 0 ? vers[0].id : 'current';
          }
          const num = parseInt(raw, 10);
          if (!isNaN(num) && num > 0) {
            const found = vers.find(v => v.version_num === num);
            if (found) return found.id;
            return `版本号 ${num} 不存在。可用版本号范围: 1-${vers.length}。`;
          }
          return raw; // 当作 UUID
        };

        const v1 = await resolveRef(v1Raw, jsonKey);
        if (v1.startsWith('版本号')) return `❌ ${v1}`;

        if (v2Raw === 'current') {
          // 对比历史版本 v1 vs 当前内容
          let currentContent = '';
          try {
            const obj = await env.WORKS_BUCKET.get(jsonKey);
            if (obj) currentContent = await obj.text();
          } catch { /* empty */ }

          const result = await diffWithCurrent(env, jsonKey, currentContent, v1);
          if (!result) return `版本 ${v1Raw} 与当前内容之间没有差异，或版本不存在。`;

          let msg = `对比 ${v1Raw} → 当前内容（共 ${result.changes.length} 处变更）:\n\n`;
          for (const c of result.changes.slice(0, 20)) {
            const icon = c.type === 'added' ? '+' : c.type === 'removed' ? '-' : '~';
            msg += `${icon} ${c.path}`;
            if (c.type === 'modified' && c.oldValue && c.newValue) {
              const oldShort = c.oldValue.substring(0, 60).replace(/\n/g, ' ');
              const newShort = c.newValue.substring(0, 60).replace(/\n/g, ' ');
              msg += `\n   旧: ${oldShort}${c.oldValue.length > 60 ? '...' : ''}`;
              msg += `\n   新: ${newShort}${c.newValue.length > 60 ? '...' : ''}`;
            }
            msg += '\n';
          }
          if (result.changes.length > 20) {
            msg += `\n... 还有 ${result.changes.length - 20} 处变更未显示。`;
          }
          return msg;
        } else {
          // v2 不是 current，需要解析
          const v2 = await resolveRef(v2Raw, jsonKey);
          if (v2.startsWith('版本号')) return `❌ ${v2}`;

          const { diffVersions } = await import('../l1/diff');
          const result = await diffVersions(env, jsonKey, v1, v2);
          if (!result) return `版本 ${v1Raw} 与 ${v2Raw} 之间没有差异，或版本不存在。`;

          let msg = `对比 v${v1Raw} → v${v2Raw}（共 ${result.changes.length} 处变更）:\n\n`;
          for (const c of result.changes.slice(0, 20)) {
            const icon = c.type === 'added' ? '+' : c.type === 'removed' ? '-' : '~';
            msg += `${icon} ${c.path}\n`;
          }
          if (result.changes.length > 20) {
            msg += `\n... 还有 ${result.changes.length - 20} 处变更未显示。`;
          }
          return msg;
        }
      } catch (err) {
        return `❌ 获取版本差异失败: ${(err as Error).message}`;
      }
    },
  };
}
