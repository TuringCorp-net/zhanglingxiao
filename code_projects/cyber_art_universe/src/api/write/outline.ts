// 大纲引擎 — SF-020~022（多语言支持 + 长篇框架模板 + JSON 槽位数据）
import { Env } from '../../db/schema';
import { jsonSuccess, jsonError } from '../../lib/response';
import { ErrorCodes } from '../../lib/errors';
import { extractLang, type Lang } from '../../lib/l1/work-content';
import { type TemplateDef } from '../../lib/l1/template';

// ============================================================
// 长篇框架大纲 — 结构化模板定义（单一来源，双语）
// ============================================================

export const OUTLINE_TEMPLATE: TemplateDef = {
  title: { zh: '长篇框架大纲', en: 'Story Framework Outline' },
  intro: {
    zh: '本文件描述作品的整体叙事结构。包含主线/支线阶段划分、阶段目标、高潮点与转折点。\n> 这是作品的"骨架"，所有章节编写必须在此框架内展开。可迭代优化，但始终不违背 Setting Bible 的约束。',
    en: 'This document describes the overall narrative structure, including main/subplot phase planning, stage goals, climaxes, and turning points.\n> This is the "skeleton" of the work. All chapter writing must unfold within this framework. Iterable, but must always respect the Setting Bible constraints.',
  },
  sections: [
    {
      heading: { zh: '一、故事概览', en: 'I. Story Overview' },
      slots: [
        { id: 'one_line_pitch', level: 1, label: { zh: '一句话梗概', en: 'One-Line Pitch' }, hint: { zh: '用一句话概括整个故事，类似电梯演讲', en: 'Summarize the entire story in one sentence — an elevator pitch' } },
        { id: 'story_type',     level: 2, label: { zh: '故事类型', en: 'Story Type' }, hint: { zh: '王道RPG / 悬疑推理 / 史诗奇幻 / 都市情感 / 科幻冒险 ...', en: 'Hero\'s Journey / Mystery-Thriller / Epic Fantasy / Urban Drama / Sci-Fi Adventure ...' } },
        { id: 'core_conflict',  level: 1, label: { zh: '核心冲突', en: 'Core Conflict' }, hint: { zh: '推动整个故事的核心矛盾是什么？谁 vs 谁，为什么？', en: 'What is the central conflict driving the entire story? Who vs. Whom, and why?' } },
      ],
    },
    {
      heading: { zh: '二、主线阶段划分', en: 'II. Main Plot — Act Structure' },
      slots: [
        { id: 'main_plot', level: 1, label: { zh: '', en: '' }, hint: {
          zh: '描述你的故事主线结构。可以参考三幕式（开端建立冲突 → 发展升级张力 → 高潮爆发回收 → 结局沉淀余韵），也可以自由安排你的结构。\n\n包含：各阶段的章节范围、核心事件、阶段目标、关键转折。',
          en: 'Describe your main storyline structure. You can use the classic three-act framework (Setup → Development → Climax → Resolution) or organize it your own way.\n\nInclude: chapter ranges for each phase, core events, phase goals, key turning points.',
        } },
      ],
    },
    {
      heading: { zh: '三、支线规划', en: 'III. Subplot Planning' },
      slots: [
        { id: 'subplots', level: 2, label: { zh: '', en: '' }, hint: {
          zh: '列出你的支线。每条简述：与主线关系、独立价值、预计章节数。\n\n支线不是填充物——每条支线都应揭示主线无法单独呈现的真相。\n\n例如：\n- 支线A（爱情线）：ch3-8，揭示主角的情感弱点\n- 支线B（复仇线）：ch2-12，与主线反派形成呼应',
          en: 'List your subplots. For each: relationship to the main plot, standalone value, estimated chapter count.\n\nSubplots aren\'t filler — each one should reveal a truth the main plot cannot show alone.\n\nExample:\n- Subplot A (Romance): ch3-8, reveals the protagonist\'s emotional vulnerability\n- Subplot B (Revenge): ch2-12, mirrors the main antagonist',
        } },
      ],
    },
    {
      heading: { zh: '四、节奏规划', en: 'IV. Pacing Plan' },
      slots: [
        { id: 'pacing', level: 2, label: { zh: '', en: '' }, hint: {
          zh: '规划各阶段的节奏和情绪曲线。可以参考以下表格格式，也可以自由描述：\n\n| 阶段 | 章节范围 | 节奏 | 情绪曲线 |\n|------|---------|------|---------|\n| 开端 | (如 ch1-3) | (如 中速建立) | (如 好奇→投入) |\n| 发展 | ... | ... | ... |\n| 高潮 | ... | ... | ... |\n| 结局 | ... | ... | ... |\n\n节奏比字数更重要——让高潮和低谷自然交替，给读者喘息的空间。',
          en: 'Plan the pacing and emotional arc for each phase. You can use the table format below or describe freely:\n\n| Phase | Chapter Range | Pace | Emotional Arc |\n|-------|-------------|------|---------------|\n| Setup | (e.g. ch1-3) | (e.g. Moderate build) | (e.g. Curiosity → Engagement) |\n| Development | ... | ... | ... |\n| Climax | ... | ... | ... |\n| Resolution | ... | ... | ... |\n\nPacing matters more than word count — let peaks and valleys alternate naturally.',
        } },
      ],
    },
    {
      heading: { zh: '五、关键转折点', en: 'V. Key Turning Points' },
      slots: [
        { id: 'turning_points', level: 2, label: { zh: '', en: '' }, hint: {
          zh: '列出所有不可逆的情节转折，标注预计所在章节。每一个转折点都应该让读者从此用不同的眼光看待这个故事。\n\n例如：\n- 转折 #1 (ch3)：主角发现养父才是杀死生父的真凶\n- 转折 #2 (ch7)：盟友叛变，主角失去所有后援',
          en: 'List all irreversible plot turns with estimated chapter positions. Each turning point should make readers see the story through different eyes.\n\nExample:\n- Turn #1 (ch3): Protagonist discovers their mentor was the true villain all along\n- Turn #2 (ch7): Ally betrays the protagonist, leaving them without support',
        } },
      ],
    },
    {
      heading: { zh: '六、伏笔埋设总体规划', en: 'VI. Foreshadowing Master Plan' },
      slots: [
        { id: 'foreshadowing_master', level: 2, label: { zh: '', en: '' }, hint: {
          zh: '规划跨章节的伏笔布局。标注每条伏笔的类型、埋设章节、回收章节。\n\n详细追踪由 M4 伏笔账本管理，此处只需总体规划。\n\n例如：\n- 伏笔 #1：主角的身世之谜（身份伏笔），ch1埋 → ch8揭示 → ch10回收\n- 伏笔 #2：神秘戒指的来历（道具伏笔），ch2埋 → ch6部分揭示 → ch12回收',
          en: 'Plan cross-chapter foreshadowing. Note each hook\'s type, planting chapter, and payoff chapter.\n\nDetailed tracking is managed by M4 Foreshadowing Ledger — this is just the master plan.\n\nExample:\n- Hook #1: The protagonist\'s true origin (identity), ch1 planted → ch8 revealed → ch10 resolved\n- Hook #2: The mysterious ring (object), ch2 planted → ch6 partial reveal → ch12 resolved',
        } },
      ],
    },
  ],
  outro: {
    zh: 'M2 自由编辑区',
    en: 'M2 Free editing zone',
  },
};
// GET /api/write/outline/{work_id}?lang=zh|en
export async function readOutline(env: Env, request: Request, workId: string): Promise<Response> {
  // V3: 委托到统一 Module API
  const { getModule } = await import('./module');
  return getModule(env, request, `m2_${workId}`);
}

// PUT /api/write/outline/{work_id}
export async function updateOutline(env: Env, request: Request, workId: string): Promise<Response> {
  // V3: 委托到统一 Module API（三文件物理隔离：.json + .free.md + .md）
  const { updateModule } = await import('./module');
  return updateModule(env, request, `m2_${workId}`);
}
