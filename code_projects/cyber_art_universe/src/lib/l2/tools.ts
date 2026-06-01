// L2: 工具注册与实现
// L2.0 提供 5 个工具：checklist_write / get_writing_guide / read_module / generate_slot / write_to_slot
// generate_slot 吸收原 Story Forger 中各 generate 端点的 prompt 构建逻辑。

import { Env } from '../../db/schema';
import { callAI } from '../l0/aiGateway';
import type { L2ToolDef } from './types';
import { getModule, updateModule } from '../../api/write/module';
import { getOrBuildContextPackage } from '../l1/context-package';
import { renderTemplateAsJson, type TemplateDef } from '../l1/template';
import { renderTemplate as renderText } from '../l1/render';
import { workContentPath, type Lang, LANG_LABELS } from '../l1/work-content';
import { getModuleGuide } from './guides';

// 模板定义（M3_card 暂无专用 prompt 模板，使用通用生成逻辑）
import { BIBLE_TEMPLATE } from '../../api/write/worldbuilding';
import { OUTLINE_TEMPLATE } from '../../api/write/outline';
import { FORESHADOWING_TEMPLATE } from '../../api/write/foreshadowing';
import { CHARACTER_TEMPLATE } from '../../api/write/character_card';

// Prompt 模板（吸收自原 generate 端点）
import worldbuildingGenMd from '../l1/prompts/tools/worldbuilding_gen.md';
import outlineGenMd from '../l1/prompts/tools/outline_gen.md';
import draftGenerateMd from '../l1/prompts/tools/draft_generate.md';
import foreshadowingGenMd from '../l1/prompts/tools/foreshadowing_gen.md';

// ============================================================
// 工具工厂
// ============================================================

export function createTools(env: Env, workId: string, lang: string): L2ToolDef[] {
  return [
    createChecklistTool(env, workId),
    createWritingGuideTool(env),
    createReadModuleTool(env),
    createGenerateSlotTool(env, workId, lang),
    createWriteToSlotTool(env),
  ];
}


// ============================================================
// checklist_write — LLM 自管理任务进度
// ============================================================

// 共享的 checklist 状态（同一会话内跨 tool call 持久）
let _checklistState: { todos: { content: string; status: string }[] } = { todos: [] };

function createChecklistTool(): L2ToolDef {
  return {
    def: {
      type: 'function',
      function: {
        name: 'checklist_write',
        description: '创建或更新任务清单，用于追踪复杂多步骤任务的进度。当你面对需要分解为子任务的工作时，先用此工具写下计划，然后逐步执行并用 checklist_update 标记完成。参数: todos(任务列表，每项含 content 和 status), status 可选: pending/in_progress/completed',
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
        description: '获取指定模块的写作指南，包括模块定位、模板结构、写作要点和特殊规则。在生成或修改某个模块内容之前调用此工具，确保输出符合规范。参数 module_type 可选: m0(原始构想), m1(世界观), m2(大纲), m3_card(人物卡), m4_strategy(伏笔策略), m4_card(伏笔卡), m5_intent(意图卡), m6_chapter(章节正文)',
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
// generate_slot — 吸收原 generate 端点
// ============================================================

// 模块类型 → { 模板, prompt 模板, 名称 }
const MODULE_GEN_CONFIG: Record<string, {
  tmpl: TemplateDef;
  promptMd: string;
  name: string;
}> = {
  m1: { tmpl: BIBLE_TEMPLATE, promptMd: worldbuildingGenMd, name: '世界观设定圣经' },
  m2: { tmpl: OUTLINE_TEMPLATE, promptMd: outlineGenMd, name: '长篇框架大纲' },
  m4_strategy: { tmpl: FORESHADOWING_TEMPLATE, promptMd: foreshadowingGenMd, name: '伏笔策略' },
};

/**
 * 共享的模块内容生成函数。
 * 被 generate_slot 工具和 REST generateModule 端点共用。
 *
 * 与原 generate 端点的关键升级：system/user 消息分离，使 system 可被 DeepSeek 缓存。
 */
export async function generateModuleContent(
  env: Env,
  workId: string,
  moduleType: string,
  lang: Lang,
  opts: { slotId?: string; instructions?: string; sectionId?: string } = {},
): Promise<string> {
  const langLabel = LANG_LABELS[lang];

  // 加载上下文包（R2 缓存）
  const contextPkg = await getOrBuildContextPackage(env, workId, lang);

  // 查询作品元数据
  const work = await env.DB.prepare(
    'SELECT id, title, category, summary FROM works WHERE id = ?'
  ).bind(workId).first<Record<string, unknown>>();

  // 查询已有实体
  const entities = await env.DB.prepare(
    'SELECT name, type FROM entities WHERE work_id = ?'
  ).bind(workId).all<Record<string, unknown>>();
  const entityNames = (entities.results || []).map(e => e.name).join('、');

  // 读取 M1 世界观（用于下游模块生成上下文）
  let worldContext = '';
  try {
    const wb = await env.WORKS_BUCKET.get(workContentPath(workId, lang, 'world_bible.md'));
    if (wb) worldContext = (await wb.text()).substring(0, 3000);
  } catch { /* 无世界观也继续 */ }

  const config = MODULE_GEN_CONFIG[moduleType];
  if (!config && moduleType !== 'm3_card' && moduleType !== 'm5_intent' && moduleType !== 'm6_chapter') {
    return `不支持的模块类型: ${moduleType}。支持: m1, m2, m3_card, m4_strategy, m5_intent, m6_chapter`;
  }

  // —— 构建 prompt（使用原 generate 端点的 prompt 模板） ——
  let prompt: string;
  const isJson = !!config;

  if (config) {
    const templateJson = renderTemplateAsJson(config.tmpl, lang, 2);
    prompt = renderText(config.promptMd, {
      work_title: work?.title || '未命名',
      category: work?.category || '未指定',
      summary: work?.summary || '未提供',
      author_prompt: opts.instructions || '无',
      style_notes: '专业、详细',
      entity_context: entityNames ? `已有角色/实体：${entityNames}` : '',
      outline_context: '',
      world_context: worldContext ? `世界观设定参考：\n${worldContext}\n` : '',
      entity_names: entityNames,
      num_chapters: '5',
      template_json: templateJson,
      lang_label: langLabel,
    });
  } else if (moduleType === 'm6_chapter') {
    // 使用 sectionId 查询指定章节，否则默认取第一章
    let section: Record<string, unknown> | null = null;
    if (opts.sectionId) {
      section = await env.DB.prepare(
        'SELECT id, title, order_index, section_summary FROM sections WHERE id = ? AND work_id = ?'
      ).bind(opts.sectionId, workId).first<Record<string, unknown>>();
    }
    if (!section) {
      section = await env.DB.prepare(
        'SELECT id, title, order_index, section_summary FROM sections WHERE work_id = ? ORDER BY order_index ASC LIMIT 1'
      ).bind(workId).first<Record<string, unknown>>();
    }

    const chapterIndex = section?.order_index != null ? String(Number(section.order_index) + 1) : '1';
    prompt = renderText(draftGenerateMd, {
      work_title: work?.title || '未命名',
      category: work?.category || '未指定',
      chapter_index: chapterIndex,
      chapter_title: section?.title || '第1章',
      world_context: worldContext ? `【世界观设定】\n${worldContext}\n` : '',
      prev_context: '',
      intent_context: '',
      section_summary: section?.section_summary || '',
    });
  } else if (moduleType === 'm3_card') {
    // M3 人物卡：使用 CHARACTER_TEMPLATE 结构引导
    const charTemplateJson = renderTemplateAsJson(CHARACTER_TEMPLATE, lang, 2);
    prompt = `请为作品生成人物卡。\n\n## 作品完整上下文\n\n${contextPkg}\n\n`;
    prompt += `## 模板结构\n\`\`\`json\n${charTemplateJson}\n\`\`\`\n\n`;
    prompt += `请输出符合模板结构的 JSON。`;
    if (opts.instructions) prompt += `\n额外要求：${opts.instructions}`;
    prompt += `\n请用${langLabel}输出。`;
  } else {
    // M5 意图卡：输出结构化规划
    prompt = `请为作品的关键章节生成意图卡。\n\n## 作品完整上下文\n\n${contextPkg}\n\n`;
    prompt += `每张意图卡请包含以下字段：\n`;
    prompt += `- 推进冲突(goal_advance_conflict): 推进哪条剧情线\n`;
    prompt += `- 揭示信息(goal_reveal_info): 本章要交代什么信息\n`;
    prompt += `- 制造悬念(goal_create_suspense): 本章要制造什么悬念\n`;
    prompt += `- 情绪目标(emotional_goal): 希望读者产生什么情绪\n`;
    prompt += `- 视角角色(pov_character): 本章以谁的视角展开\n`;
    prompt += `- 开篇钩子(structure_opening): 用什么抓住读者\n`;
    prompt += `- 章末卡点(structure_cliffhanger): 用什么让读者想继续读下一章\n`;
    prompt += `- 出场人物(characters_involved): 逗号分隔的角色名\n`;
    prompt += `- 预估字数(estimated_words): 本章预估字数\n`;
    if (opts.instructions) prompt += `\n额外要求：${opts.instructions}`;
    prompt += `\n请用${langLabel}输出。`;
  }

  // slotId：所有类型通用；instructions 对于 config 类型已通过 prompt 模板注入（author_prompt），不重复
  if (opts.slotId) prompt += `\n请重点生成槽位 "${opts.slotId}" 的内容。`;

  // system/user 分离 — 核心升级点
  const result = await callAI(env, [
    { role: 'system', content: '你是 Story Elf，一位专业的创作助手。请严格按模板结构输出内容。' },
    { role: 'user', content: prompt },
  ], {
    maxTokens: 4096,
    responseFormat: isJson ? 'json' : 'text',
  });

  return result.content;
}

function createGenerateSlotTool(env: Env, workId: string, lang: string): L2ToolDef {
  return {
    def: {
      type: 'function',
      function: {
        name: 'generate_slot',
        description: '为指定模块生成内容。调用前应先 read_module 了解当前状态。生成的内容为建议/初稿，需作者确认后才写入。参数: module_type(模块类型), slot_id(可选), instructions(可选)',
        parameters: {
          type: 'object',
          properties: {
            module_type: { type: 'string', description: '要生成的模块类型', enum: ['m1', 'm2', 'm3_card', 'm4_strategy', 'm5_intent', 'm6_chapter'] },
            slot_id: { type: 'string', description: '可选：只生成指定槽位' },
            instructions: { type: 'string', description: '可选的额外指令' },
          },
          required: ['module_type'],
        },
      },
    },
    is_mutating: false,
    execute: async (params: Record<string, unknown>) => {
      try {
        return await generateModuleContent(env, workId, params.module_type as string, lang as Lang, {
          slotId: params.slot_id as string | undefined,
          instructions: params.instructions as string | undefined,
        });
      } catch (err) {
        return `生成失败: ${(err as Error).message}`;
      }
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
        description: '将生成的内容写入指定模块的槽位。所有写入自动走版本历史，可回滚。参数: module_type(模块类型), slot_values(槽位ID→内容的映射), free_content(可选), module_id(可选，默认 {module_type}_{work_id})',
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
      const moduleId = (params.module_id as string) || `${moduleType}_${params.work_id as string}`;
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

      const slotCount = Object.keys(slotValues).length;
      return `✅ 已写入 ${slotCount} 个槽位到模块 ${moduleId}。版本历史已自动保存，可回滚。`;
    },
  };
}
