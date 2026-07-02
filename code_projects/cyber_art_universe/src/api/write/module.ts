/**
 * V4 统一 Module API — module.ts
 *
 * M0-M6 所有模块的统一读写入口。外部 Agent 和人类作者使用完全相同的 API。
 * Agent 只需往 free_content 写入 Markdown，Story Elf 负责结构化拆解。
 *
 * API 端点:
 *   GET  /api/write/module/{module_id}          → getModule()
 *   PUT  /api/write/module/{module_id}          → updateModule()
 *   GET  /api/write/modules?work_id=&type=       → listModules()
 *   GET  /api/write/module/{module_id}/versions  → listModuleVersions()
 *   GET  /api/write/module/{module_id}/diff      → diffModuleVersions()
 *
 * 存储隔离:
 *   slots → .json（Story Elf 结构化维护）
 *   free_content → .free.md（人类/Agent 自由写）
 *   渲染输出 → .md（从 slots + free_content 拼接，供人类阅读）
 *   三个文件物理隔离，永远不会互相覆盖
 *
 * V4 版本历史: 每次 PUT 自动快照到 R2 .versions/ + D1 file_versions 表
 */
import { Env } from '../../db/schema';
import { jsonSuccess, jsonError } from '../../lib/response';
import { ErrorCodes } from '../../lib/errors';
import {
  buildTemplateJson,
  type TemplateDef, type SlotDef, type R2SlotData,
} from '../../lib/l1/template';
import { workContentPath, extractLang, type Lang } from '../../lib/l1/work-content';
import { createSnapshot, listVersions } from '../../lib/l1/version';
import { diffVersions as diffModVersions, diffWithCurrent, type DiffResult } from '../../lib/l1/diff';

// ============================================================
// 模板定义 — M0-M6 所有模块的槽位结构
// ============================================================

// --- M0: 原始构想 ---
const ORIGINAL_CONCEPT_TEMPLATE: TemplateDef = {
  title: { zh: '原始构想', en: 'Original Concept' },
  intro: {
    zh: '写下你最初的故事构想、灵感来源、想要探索的主题。这是所有后续创作的起点。',
    en: 'Write down your initial story concept, sources of inspiration, and themes you want to explore. This is the seed for all subsequent creation.',
  },
  sections: [{
    heading: { zh: '核心构想', en: 'Core Concept' },
    slots: [
      { id: 'content', level: 1, label: { zh: '', en: '' }, hint: {
        zh: '在此自由书写你的原始构想：故事的核心创意、世界观设定、人物关系、情节走向……不必拘泥于格式',
        en: 'Write your original concept freely: core story ideas, world setting, character relationships, plot directions... No format constraints.',
      } },
    ],
  }],
  outro: { zh: 'M0 自由编辑区', en: 'M0 Free editing zone' },
};

// --- M1: 世界观设定圣经 ---
export const BIBLE_TEMPLATE: TemplateDef = {
  title: { zh: '世界观设定圣经', en: 'Setting Bible' },
  intro: {
    zh: '本文件是作品的最高约束文档。所有人物、情节、章节内容必须服从此圣经的规则。\n> 各章节标题为设定框架，内容由作者与 AI 共同填充。可版本化、可回滚。',
    en: 'This document is the supreme constraint for the work. All characters, plots, and chapter content must obey the rules herein.\n> Section headings form the structural framework; content is filled collaboratively by the author and AI. Version-controlled and rollback-capable.',
  },
  sections: [
    {
      heading: { zh: '世界规则与边界', en: 'World Rules & Boundaries' },
      slots: [
        { id: 'power_system',    level: 1, label: { zh: '力量/技术体系', en: 'Power / Technology System' }, hint: { zh: '描述这个世界的力量来源、等级划分、使用规则与代价', en: 'Describe the source of power, hierarchy, usage rules, and costs in this world' } },
        { id: 'social_structure', level: 2, label: { zh: '社会组织与结构', en: 'Social Organization & Structure' }, hint: { zh: '国家、势力、阶层、家族等社会组织形态', en: 'Nations, factions, classes, clans, and other social structures' } },
        { id: 'taboos_costs',     level: 2, label: { zh: '禁忌与代价', en: 'Taboos & Costs' }, hint: { zh: '世界中不可触碰的禁忌、使用力量的代价', en: 'Untouchable taboos in this world, costs of using power' } },
      ],
    },
    {
      heading: { zh: '核心主题与价值观', en: 'Core Themes & Values' },
      slots: [
        { id: 'central_thesis',   level: 1, label: { zh: '核心命题', en: 'Central Thesis' }, hint: { zh: '作品要传达的核心思想或问题', en: 'The core idea or question the work seeks to convey' } },
        { id: 'emotional_tone',   level: 2, label: { zh: '情感基调', en: 'Emotional Tone' }, hint: { zh: '整体的情感色彩：黑暗/希望/悲壮/轻松 等', en: 'Overall emotional register: dark / hopeful / tragic / lighthearted, etc.' } },
        { id: 'narrative_stance', level: 2, label: { zh: '叙事立场', en: 'Narrative Stance' }, hint: { zh: '从谁的视角看世界？隐含的价值判断', en: 'Whose perspective shapes the world? Implicit value judgments' } },
      ],
    },
    {
      heading: { zh: '角色体系', en: 'Character System' },
      slots: [
        { id: 'protagonist',             level: 1, label: { zh: '主角', en: 'Protagonist' }, hint: { zh: '姓名、身份、核心动机、能力边界、成长弧线', en: 'Name, identity, core motivation, ability boundaries, growth arc' } },
        { id: 'supporting_characters',  level: 2, label: { zh: '核心配角', en: 'Key Supporting Characters' }, hint: { zh: '与主角的关系、各自动机、在主线中的作用', en: 'Relationship to protagonist, individual motivations, role in the main plot' } },
        { id: 'relationship_web',       level: 2, label: { zh: '角色关系网', en: 'Character Relationship Web' }, hint: { zh: '角色之间的关键关系（可后续由 M3 人物卡模块细化）', en: 'Key relationships between characters (to be refined by M3 Character Cards)' } },
      ],
    },
    {
      heading: { zh: '场景与资源', en: 'Settings & Resources' },
      slots: [
        { id: 'major_locations', level: 2, label: { zh: '主要地点', en: 'Major Locations' }, hint: { zh: '关键场景的地理位置、特征、叙事功能', en: 'Geography, features, and narrative function of key settings' } },
        { id: 'key_items',       level: 2, label: { zh: '关键道具/技能', en: 'Key Items / Artifacts' }, hint: { zh: '可被反复使用的叙事资源（MacGuffin、圣物、核心能力等）', en: 'Reusable narrative resources (MacGuffins, relics, core abilities, etc.)' } },
      ],
    },
    {
      heading: { zh: '承诺清单', en: 'Promise Checklist' },
      slots: [
        { id: 'promise_checklist', level: 2, label: { zh: '', en: '' }, hint: {
          zh: '列出你对读者的承诺——可以是一条，也可以是多条。每条一句话概括。例如：\n1) 主角终将复仇\n2) 隐藏身份会被揭穿\n3) 两个敌对势力终有一战\n承诺是你与读者之间的契约——一旦写下，后续必须兑现。',
          en: 'List your promises to the reader — one or many. One sentence per promise. For example:\n1) The protagonist will ultimately take revenge\n2) The hidden identity will be exposed\n3) Two enemy factions will clash\nPromises are a contract with your readers — once written, they must be fulfilled.',
        } },
      ],
    },
    {
      heading: { zh: '禁区与风格', en: 'Boundaries & Style' },
      slots: [
        { id: 'content_red_lines', level: 1, label: { zh: '内容禁区', en: 'Content Red Lines' }, hint: { zh: '绝对不能触碰的内容主题', en: 'Themes and content that must never be touched' } },
        { id: 'language_style',    level: 2, label: { zh: '语言风格', en: 'Language Style' }, hint: { zh: '叙事语言的风格定位：简洁/华丽/口语化/文学性 等', en: 'Prose style: concise / ornate / colloquial / literary, etc.' } },
        { id: 'pacing_preference', level: 2, label: { zh: '节奏偏好', en: 'Pacing Preference' }, hint: { zh: '快节奏/慢热/张弛有度 等', en: 'Fast-paced / slow-burn / balanced rhythm, etc.' } },
      ],
    },
  ],
  outro: { zh: 'M1 自由编辑区', en: 'M1 Free editing zone' },
};

// --- M2: 长篇框架大纲 ---
export const OUTLINE_TEMPLATE: TemplateDef = {
  title: { zh: '长篇框架大纲', en: 'Story Framework Outline' },
  intro: {
    zh: '本文件描述作品的整体叙事结构。包含主线/支线阶段划分、阶段目标、高潮点与转折点。\n> 这是作品的"骨架"，所有章节编写必须在此框架内展开。可迭代优化，但始终不违背 Setting Bible 的约束。',
    en: 'This document describes the overall narrative structure, including main/subplot phase planning, stage goals, climaxes, and turning points.\n> This is the "skeleton" of the work. All chapter writing must unfold within this framework. Iterable, but must always respect the Setting Bible constraints.',
  },
  sections: [
    {
      heading: { zh: '故事概览', en: 'Story Overview' },
      slots: [
        { id: 'one_line_pitch', level: 1, label: { zh: '一句话梗概', en: 'One-Line Pitch' }, hint: { zh: '用一句话概括整个故事，类似电梯演讲', en: 'Summarize the entire story in one sentence — an elevator pitch' } },
        { id: 'story_type',     level: 2, label: { zh: '故事类型', en: 'Story Type' }, hint: { zh: '王道RPG / 悬疑推理 / 史诗奇幻 / 都市情感 / 科幻冒险 ...', en: 'Hero\'s Journey / Mystery-Thriller / Epic Fantasy / Urban Drama / Sci-Fi Adventure ...' } },
        { id: 'core_conflict',  level: 1, label: { zh: '核心冲突', en: 'Core Conflict' }, hint: { zh: '推动整个故事的核心矛盾是什么？谁 vs 谁，为什么？', en: 'What is the central conflict driving the entire story? Who vs. Whom, and why?' } },
      ],
    },
    {
      heading: { zh: '主线阶段划分', en: 'Main Plot — Act Structure' },
      slots: [
        { id: 'main_plot', level: 1, label: { zh: '', en: '' }, hint: {
          zh: '描述你的故事主线结构。可以参考三幕式（开端建立冲突 → 发展升级张力 → 高潮爆发回收 → 结局沉淀余韵），也可以自由安排你的结构。\n\n包含：各阶段的章节范围、核心事件、阶段目标、关键转折。',
          en: 'Describe your main storyline structure. You can use the classic three-act framework (Setup → Development → Climax → Resolution) or organize it your own way.',
        } },
      ],
    },
    {
      heading: { zh: '支线规划', en: 'Subplot Planning' },
      slots: [
        { id: 'subplots', level: 2, label: { zh: '', en: '' }, hint: {
          zh: '列出你的支线。每条简述：与主线关系、独立价值、预计章节数。',
          en: 'List your subplots. For each: relationship to the main plot, standalone value, estimated chapter count.',
        } },
      ],
    },
    {
      heading: { zh: '节奏规划', en: 'Pacing Plan' },
      slots: [
        { id: 'pacing', level: 2, label: { zh: '', en: '' }, hint: {
          zh: '规划各阶段的节奏和情绪曲线。节奏比字数更重要——让高潮和低谷自然交替，给读者喘息的空间。',
          en: 'Plan the pacing and emotional arc for each phase. Pacing matters more than word count — let peaks and valleys alternate naturally.',
        } },
      ],
    },
    {
      heading: { zh: '关键转折点', en: 'Key Turning Points' },
      slots: [
        { id: 'turning_points', level: 2, label: { zh: '', en: '' }, hint: {
          zh: '列出所有不可逆的情节转折，标注预计所在章节。每一个转折点都应该让读者从此用不同的眼光看待这个故事。',
          en: 'List all irreversible plot turns with estimated chapter positions. Each turning point should make readers see the story through different eyes.',
        } },
      ],
    },
    {
      heading: { zh: '伏笔埋设总体规划', en: 'Foreshadowing Master Plan' },
      slots: [
        { id: 'foreshadowing_master', level: 1, label: { zh: '', en: '' }, hint: {
          zh: '整部作品的伏笔总体规划，代替旧的 M4 策略总览。\n\n第一部分 — 策略方向：伏笔整体是密集还是稀疏？以什么类型为主（身份/道具/对白/能力/事件/意象）？\n\n第二部分 — 跨章节布局：列出你计划埋设的主要伏笔线，每条标注类型、埋设章节、回收章节、大致的发展路径。\n\n详细追踪由 M4 伏笔卡逐条管理：每条伏笔一张卡，记录埋种→强化→部分揭示→回收的完整生命周期。此处只需总体规划。',
          en: 'The overall foreshadowing plan for the entire work.\n\nPart 1 — Strategy: Dense or sparse? What hook types dominate (Identity/Prop/Dialogue/Ability/Event/Imagery)?\n\nPart 2 — Cross-chapter layout: List your planned major hook lines. Note each one\'s type, planting chapter, payoff chapter, and rough development path.\n\nDetailed tracking is handled per-hook by M4 Foreshadowing Cards — one card per hook, tracking the full lifecycle from planting through payoff. This section only needs the master plan.',
        } },
      ],
    },
  ],
  outro: { zh: 'M2 自由编辑区', en: 'M2 Free editing zone' },
};

// --- M3: 人物卡 ---
export const CHARACTER_TEMPLATE: TemplateDef = {
  title: { zh: '人物卡', en: 'Character Card' },
  intro: {
    zh: '本文档记录角色的完整设定。所有章节中该角色的言行必须与此卡一致。',
    en: 'This document records the complete profile of the character. All depictions of this character in chapters must be consistent with this card.',
  },
  sections: [
    {
      heading: { zh: '基本信息', en: 'Basic Information' },
      slots: [
        { id: 'name',          level: 1, label: { zh: '姓名', en: 'Name' }, hint: { zh: '角色的姓名', en: 'The character\'s full name' } },
        { id: 'identity',      level: 1, label: { zh: '身份/职业', en: 'Identity / Occupation' }, hint: { zh: '角色的社会身份和职业', en: 'The character\'s social identity and profession' } },
        { id: 'age',           level: 2, label: { zh: '年龄', en: 'Age' }, hint: { zh: '角色的年龄', en: 'The character\'s age' } },
        { id: 'appearance',    level: 2, label: { zh: '外表特征', en: 'Appearance' }, hint: { zh: '角色的外貌描述', en: 'Physical description of the character' } },
        { id: 'role_in_story', level: 1, label: { zh: '在故事中的角色', en: 'Role in Story' }, hint: { zh: '主角 / 核心配角 / 阶段人物 / 章节人物', en: 'Protagonist / Key Supporting / Stage Character / Chapter Character' } },
      ],
    },
    {
      heading: { zh: '性格与动机', en: 'Personality & Motivation' },
      slots: [
        { id: 'core_personality', level: 1, label: { zh: '核心性格', en: 'Core Personality' }, hint: { zh: '3-5 个关键词描述性格特征', en: '3-5 keywords describing personality traits' } },
        { id: 'inner_motivation', level: 1, label: { zh: '内在动机', en: 'Inner Motivation' }, hint: { zh: '这个角色真正想要的是什么？深层驱动力', en: 'What does this character truly want? Deep driving force' } },
        { id: 'external_goal',   level: 2, label: { zh: '外在目标', en: 'External Goal' }, hint: { zh: '这个角色表面上在追求什么？', en: 'What is this character pursuing on the surface?' } },
        { id: 'fears_weaknesses',level: 2, label: { zh: '恐惧与弱点', en: 'Fears & Weaknesses' }, hint: { zh: '角色的软肋、害怕什么、性格缺陷', en: 'Soft spots, what they fear, character flaws' } },
        { id: 'values_bottom_lines', level: 2, label: { zh: '价值观与底线', en: 'Values & Bottom Lines' }, hint: { zh: '角色不会逾越的原则', en: 'Principles they will not cross' } },
      ],
    },
    {
      heading: { zh: '能力与限制', en: 'Abilities & Limitations' },
      slots: [
        { id: 'skills',          level: 2, label: { zh: '能力/技能', en: 'Skills / Abilities' }, hint: { zh: '角色擅长什么，与世界观的力量体系如何关联', en: 'What is the character good at? How does it relate to the world\'s power system?' } },
        { id: 'ability_boundaries', level: 2, label: { zh: '能力边界', en: 'Ability Boundaries' }, hint: { zh: '角色不能做什么（受 Setting Bible 世界规则约束）', en: 'What can the character NOT do (constrained by the Setting Bible\'s world rules)?' } },
        { id: 'resources',       level: 2, label: { zh: '资源与人脉', en: 'Resources & Connections' }, hint: { zh: '角色可调用的外部资源', en: 'External resources the character can call upon' } },
        { id: 'related_m1',      level: 2, label: { zh: '关联的 M1 世界规则', en: 'Related M1 World Rules' }, hint: { zh: '列出此角色受约束的世界规则', en: 'List the world rules that constrain this character' } },
        { id: 'related_m4',      level: 2, label: { zh: '关联的 M4 伏笔', en: 'Related M4 Foreshadowing' }, hint: { zh: '与此角色相关的伏笔 ID 列表', en: 'Foreshadowing hook IDs related to this character' } },
      ],
    },
    {
      heading: { zh: '关系网络', en: 'Relationship Network' },
      slots: [
        { id: 'rel_protagonist', level: 1, label: { zh: '与主角的关系', en: 'Relationship with Protagonist' }, hint: { zh: '描述此角色与主角之间的关系：是盟友？师徒？对手？', en: 'Describe the relationship with the protagonist: ally, mentor, rival?' } },
        { id: 'rel_others',      level: 2, label: { zh: '与其他核心人物的关系', en: 'Relationships with Other Key Characters' }, hint: { zh: '与主角之外的关键人物的关系', en: 'Relationships with key characters other than the protagonist' } },
        { id: 'rel_hostile',     level: 2, label: { zh: '敌对/竞争关系', en: 'Hostile / Competitive Relationships' }, hint: { zh: '此角色的对手、敌人或竞争者', en: 'This character\'s opponents, enemies, or competitors' } },
        { id: 'rel_emotional',   level: 2, label: { zh: '情感关系', en: 'Romantic / Emotional Relationships' }, hint: { zh: '恋爱、亲情、友情等情感纽带', en: 'Romantic, familial, friendship, and other emotional bonds' } },
      ],
    },
    {
      heading: { zh: '成长弧线', en: 'Growth Arc' },
      slots: [
        { id: 'arc_type',      level: 1, label: { zh: '弧线类型', en: 'Arc Type' }, hint: { zh: '成长(growth) / 堕落(fall) / 救赎(redemption) / 悲剧(tragic) / 觉醒(awakening) / 稳定(steady)', en: 'growth / fall / redemption / tragic / awakening / steady' } },
        { id: 'starting_state', level: 2, label: { zh: '起点状态', en: 'Starting State' }, hint: { zh: '角色在故事开始时的处境和心理状态', en: 'The character\'s situation and mental state at the beginning of the story' } },
        { id: 'growth_nodes',   level: 2, label: { zh: '关键成长节点', en: 'Key Growth Nodes' }, hint: { zh: '角色在哪些情节节点发生重大变化', en: 'At which plot nodes does the character undergo significant change?' } },
        { id: 'ending_state',   level: 2, label: { zh: '终点状态（预期）', en: 'Ending State (Projected)' }, hint: { zh: '角色在故事结束时预计的状态', en: 'The expected state of the character at the end of the story' } },
      ],
    },
    {
      heading: { zh: '语言与行为特征', en: 'Speech & Behavioral Traits' },
      slots: [
        { id: 'catchphrases',    level: 2, label: { zh: '口头禅/说话风格', en: 'Catchphrases / Speaking Style' }, hint: { zh: '此角色的标志性语言风格、口头禅', en: 'Signature speech patterns, catchphrases' } },
        { id: 'gestures',        level: 2, label: { zh: '习惯动作', en: 'Habitual Gestures' }, hint: { zh: '此角色不自觉的身体语言、习惯性动作', en: 'Unconscious body language, habitual movements' } },
        { id: 'appearance_details', level: 2, label: { zh: '外貌细节', en: 'Appearance Details' }, hint: { zh: '区别于其他角色的外貌标志', en: 'Distinctive appearance markers that set this character apart' } },
        { id: 'quirks',          level: 2, label: { zh: '特殊癖好', en: 'Quirks' }, hint: { zh: '与众不同的嗜好或怪癖', en: 'Unique quirks or eccentricities' } },
      ],
    },
  ],
  outro: { zh: 'M3 自由编辑区', en: 'M3 Free editing zone' },
};

// --- M4_card: 伏笔条目卡 ---
const _FH_SLOTS: SlotDef[] = [
  { id: 'fh_type',           level: 1, label: { zh: '伏笔类型', en: 'Hook Type' }, hint: { zh: '身份伏笔 / 道具伏笔 / 对白伏笔 / 能力伏笔 / 事件伏笔 / 意象伏笔', en: 'Identity / Prop / Dialogue / Ability / Event / Imagery' } },
  { id: 'fh_intensity',      level: 2, label: { zh: '伏笔强度', en: 'Hook Intensity' }, hint: { zh: '🔴 核心（贯穿全书）/ 🟡 重要（跨多章）/ 🟢 彩蛋（轻量）', en: '🔴 Core (throughout) / 🟡 Major (multi-chapter) / 🟢 Minor (Easter egg)' } },
  { id: 'fh_characters',     level: 1, label: { zh: '关联人物', en: 'Related Characters' }, hint: { zh: '此伏笔涉及的角色名', en: 'Characters involved in this hook' } },
  { id: 'fh_chapter_range',  level: 2, label: { zh: '关联章节范围', en: 'Chapter Range' }, hint: { zh: '第 ? 章 ～ 第 ? 章', en: 'ch? ~ ch?' } },
  { id: 'fh_m1_rule',        level: 2, label: { zh: '依赖的 M1 规则', en: 'Depends on M1 Rule' }, hint: { zh: '此伏笔依赖的世界规则', en: 'World rule this hook depends on' } },
  { id: 'fh_plant_chapter',  level: 2, label: { zh: '埋种章节', en: 'Plant Chapter' }, hint: { zh: '埋种章节：第 ? 章', en: 'Plant in Chapter: ch?' } },
  { id: 'fh_plant_method',   level: 2, label: { zh: '埋种方式', en: 'Plant Method' }, hint: { zh: '用什么方式让读者接触到这个伏笔？', en: 'How will readers encounter this clue?' } },
  { id: 'fh_dev_reinforce',  level: 2, label: { zh: '强化暗示', en: 'Reinforcement' }, hint: { zh: '第 ? 章，如何再次暗示或加强', en: 'ch?, how to reinforce' } },
  { id: 'fh_dev_reveal',     level: 2, label: { zh: '部分揭示', en: 'Partial Reveal' }, hint: { zh: '第 ? 章，读者开始意识到什么？', en: 'ch?, what begins to surface?' } },
  { id: 'fh_dev_misdirect',  level: 2, label: { zh: '误导/反转', en: 'Misdirection' }, hint: { zh: '（可选）第 ? 章，是否有意误导读者？', en: '(optional) ch?, misdirect?' } },
  { id: 'fh_payoff_chapter', level: 2, label: { zh: '回收章节', en: 'Payoff Chapter' }, hint: { zh: '回收章节：第 ? 章', en: 'Resolve in Chapter: ch?' } },
  { id: 'fh_payoff_method',  level: 2, label: { zh: '回收方式', en: 'Payoff Method' }, hint: { zh: '如何让读者恍然大悟、拍案叫绝？', en: 'How to make readers gasp?' } },
  { id: 'fh_status',         level: 2, label: { zh: '状态', en: 'Status' }, hint: { zh: '🌱 已规划 / 🌿 已埋种 / 🌳 发展中 / 💡 部分揭示 / ✅ 已回收', en: '🌱 Planned / 🌿 Planted / 🌳 Developing / 💡 Partially Revealed / ✅ Resolved' } },
];

function _fhSlot(id: string): SlotDef {
  return _FH_SLOTS.find(s => s.id === id)!;
}

export const FORESHADOWING_TEMPLATE: TemplateDef = {
  title: { zh: '伏笔卡', en: 'Foreshadowing Card' },
  intro: {
    zh: '逐条管理伏笔暗线。每个伏笔一张卡，记录从埋种到回收的完整生命周期。',
    en: 'Track each foreshadowing hook individually. One card per hook — record the full lifecycle from planting to payoff.',
  },
  sections: [
    {
      heading: { zh: '基本信息', en: 'Basic Info' },
      slots: [_fhSlot('fh_type'), _fhSlot('fh_intensity')],
    },
    {
      heading: { zh: '关联', en: 'References' },
      slots: [_fhSlot('fh_characters'), _fhSlot('fh_chapter_range'), _fhSlot('fh_m1_rule')],
    },
    {
      heading: { zh: '埋种', en: 'Planting' },
      slots: [_fhSlot('fh_plant_chapter'), _fhSlot('fh_plant_method')],
    },
    {
      heading: { zh: '发展', en: 'Development' },
      slots: [_fhSlot('fh_dev_reinforce'), _fhSlot('fh_dev_reveal'), _fhSlot('fh_dev_misdirect')],
    },
    {
      heading: { zh: '回收', en: 'Payoff' },
      slots: [_fhSlot('fh_payoff_chapter'), _fhSlot('fh_payoff_method')],
    },
    {
      heading: { zh: '状态', en: 'Status' },
      slots: [_fhSlot('fh_status')],
    },
  ],
  outro: { zh: 'M4 自由编辑区', en: 'M4 Free editing zone' },
};

// --- M5: 章节意图卡 ---
export const INTENT_TEMPLATE: TemplateDef = {
  title: { zh: '章节意图卡', en: 'Chapter Intent Card' },
  intro: {
    zh: '每章写作前的创作意图规划。定义本章要推进什么冲突、揭示什么信息、制造什么悬念。',
    en: 'Creative intent planning before writing each chapter.',
  },
  sections: [
    {
      heading: { zh: '目标与冲突', en: 'Goals & Conflict' },
      slots: [
        { id: 'goal_advance_conflict', level: 1, label: { zh: '推进冲突', en: 'Advance Conflict' }, hint: { zh: '推进哪条剧情线（对应 M2 框架中的阶段/转折点）', en: 'Which plot line to advance' } },
        { id: 'goal_reveal_info',      level: 1, label: { zh: '揭示信息', en: 'Reveal Info' }, hint: { zh: '本章要交代什么信息给读者', en: 'What info to reveal to readers' } },
        { id: 'goal_create_suspense',  level: 1, label: { zh: '制造悬念', en: 'Create Suspense' }, hint: { zh: '本章要制造什么悬念', en: 'What suspense to create' } },
      ],
    },
    {
      heading: { zh: '情绪与视角', en: 'Emotion & POV' },
      slots: [
        { id: 'emotional_goal',       level: 1, label: { zh: '情绪目标', en: 'Emotional Goal' }, hint: { zh: '希望读者产生什么情绪', en: 'Desired emotional response' } },
        { id: 'pov_character',        level: 1, label: { zh: '视角角色', en: 'POV Character' }, hint: { zh: '本章以谁的视角展开', en: 'Whose POV' } },
        { id: 'pov_strategy',         level: 2, label: { zh: '视角策略', en: 'POV Strategy' }, hint: { zh: '固定单一/多线交替/不可靠叙述者/全知', en: 'Single/multi/unreliable/omniscient' } },
        { id: 'scene_type',           level: 2, label: { zh: '场景类型', en: 'Scene Type' }, hint: { zh: 'Wonder/一切尽失/终场/认知冲击', en: 'Scene type' } },
      ],
    },
    {
      heading: { zh: '结构框架', en: 'Structure' },
      slots: [
        { id: 'structure_opening',    level: 1, label: { zh: '开篇钩子', en: 'Opening Hook' }, hint: { zh: '用什么抓住读者', en: 'What hooks the reader' } },
        { id: 'structure_reversal',   level: 2, label: { zh: '反转点',   en: 'Reversal Point' }, hint: { zh: '本章的意外/转折', en: 'Twist or turning point' } },
        { id: 'structure_cliffhanger',level: 1, label: { zh: '章末卡点', en: 'Cliffhanger' }, hint: { zh: '用什么让读者想继续读下一章', en: 'End-of-chapter hook' } },
      ],
    },
    {
      heading: { zh: '伏笔与人物', en: 'Foreshadowing & Characters' },
      slots: [
        { id: 'foreshadowing_triggered', level: 2, label: { zh: '伏笔触发', en: 'Foreshadowing Triggered' }, hint: { zh: '格式: hook_id:action', en: 'Format: hook_id:action' } },
        { id: 'characters_involved',  level: 1, label: { zh: '出场人物', en: 'Characters Involved' }, hint: { zh: '逗号分隔的角色名或 ID', en: 'Comma-separated character names' } },
      ],
    },
    {
      heading: { zh: '写作参数', en: 'Writing Parameters' },
      slots: [
        { id: 'estimated_words',      level: 2, label: { zh: '预估字数', en: 'Estimated Words' }, hint: { zh: '本章预估字数', en: 'Estimated word count' } },
        { id: 'style_notes',          level: 2, label: { zh: '风格备注', en: 'Style Notes' }, hint: { zh: '本章的特殊风格要求', en: 'Special style notes' } },
      ],
    },
  ],
  outro: { zh: 'M5 自由编辑区', en: 'M5 Free editing zone' },
};

// --- M6: 章节正文 ---
export const CHAPTER_TEMPLATE: TemplateDef = {
  title: { zh: '章节正文', en: 'Chapter Content' },
  intro: {
    zh: '在此撰写章节正文。左侧可参考大纲和意图卡。',
    en: 'Write the chapter body here. Reference the outline and intent card in the left panel.',
  },
  sections: [{
    heading: { zh: '正文', en: 'Body' },
    slots: [
      { id: 'content', level: 1, label: { zh: '', en: '' }, hint: {
        zh: '在此撰写章节正文内容',
        en: 'Write your chapter content here',
      } },
    ],
  }],
  outro: { zh: 'M6 自由编辑区', en: 'M6 Free editing zone' },
};

// ============================================================
// type → 模板 + R2 key 映射
// ============================================================
interface ModuleConfig {
  tmpl: TemplateDef;
  jsonKeyFromModule: (m: { id: string; r2_json_key?: string | null }) => string;
  mdKeyFromModule: (m: { id: string; r2_md_key?: string | null }) => string;
}

const MODULE_CONFIG: Record<string, ModuleConfig> = {
  m0: {
    tmpl: ORIGINAL_CONCEPT_TEMPLATE,
    jsonKeyFromModule: () => 'original_concept.json',
    mdKeyFromModule: () => 'original_concept.md',
  },
  m1: {
    tmpl: BIBLE_TEMPLATE,
    jsonKeyFromModule: () => 'world_bible.json',
    mdKeyFromModule: () => 'world_bible.md',
  },
  m2: {
    tmpl: OUTLINE_TEMPLATE,
    jsonKeyFromModule: () => 'outline.json',
    mdKeyFromModule: () => 'outline.md',
  },
  m3_card: {
    tmpl: CHARACTER_TEMPLATE,
    jsonKeyFromModule: (m) => `characters/${m.id.replace('m3_card_', '')}.json`,
    mdKeyFromModule: (m) => `characters/${m.id.replace('m3_card_', '')}.md`,
  },
  m4_card: {
    tmpl: FORESHADOWING_TEMPLATE,
    jsonKeyFromModule: (m) => `foreshadowing/${m.id.replace('m4_card_', '')}.json`,
    mdKeyFromModule: (m) => `foreshadowing/${m.id.replace('m4_card_', '')}.md`,
  },
  m5_intent: {
    tmpl: INTENT_TEMPLATE,
    jsonKeyFromModule: (m) => `intents/${m.id.replace('m5_intent_', '')}.json`,
    mdKeyFromModule: (m) => `intents/${m.id.replace('m5_intent_', '')}.md`,
  },
  m6_chapter: {
    tmpl: CHAPTER_TEMPLATE,
    jsonKeyFromModule: (m) => `chapters/${m.id.replace('m6_chapter_', '')}.json`,
    mdKeyFromModule: (m) => `chapters/${m.id.replace('m6_chapter_', '')}.md`,
  },
};

// ============================================================
// R2 路径 & 读写辅助
// ============================================================
function r2Path(workId: string, lang: Lang, relKey: string): string {
  if (!relKey) return '';
  return workContentPath(workId, lang, relKey);
}

function freeKeyFromJsonKey(jsonRelKey: string): string {
  if (!jsonRelKey) return '';
  return jsonRelKey.replace(/\.json$/, '.free.md');
}

async function readR2Json(env: Env, key: string): Promise<R2SlotData | null> {
  if (!key) return null;
  try {
    const obj = await env.WORKS_BUCKET.get(key);
    if (!obj) return null;
    return JSON.parse(await obj.text()) as R2SlotData;
  } catch { return null; }
}

/**
 * 从 R2 数据中提取 slot 时间戳，用于乐观并发冲突检测。
 * 若数据中尚无时间戳（首次访问无时间戳的 R2 文件），返回全 0 哨兵值。
 * 全 0 时间戳在冲突检测中会被视为"无基线"，任何写入均放行。
 * 首次成功写入后，真实时间戳持久化到 R2，冲突检测正式生效。
 */
function resolveSlotTimestamps(data: R2SlotData | null): Record<string, number> {
  if (data?.slot_timestamps && Object.keys(data.slot_timestamps).length > 0) {
    return data.slot_timestamps;
  }
  // 首次访问：返回哨兵值 0（冲突检测中 0 = 无基线，放行）
  const ts: Record<string, number> = {};
  if (data?.slots) {
    for (const key of Object.keys(data.slots)) {
      ts[key] = 0;
    }
  }
  return ts;
}

async function readR2Text(env: Env, key: string): Promise<string> {
  if (!key) return '';
  try {
    const obj = await env.WORKS_BUCKET.get(key);
    return obj ? await obj.text() : '';
  } catch { return ''; }
}

// ============================================================
// POST /api/write/cards — create a new card (character, foreshadowing, chapter, etc.)
// ============================================================

export async function createCard(env: Env, request: Request): Promise<Response> {
  const body = await request.json() as { work_id: string; type: string; name?: string };
  if (!body.work_id || !body.type) {
    return new Response(JSON.stringify(jsonError(ErrorCodes.MISSING_REQUIRED_FIELD, 'work_id and type are required')), {
      status: 400, headers: { 'Content-Type': 'application/json' },
    });
  }

  // Validate module type
  const validTypes = ['m3_card', 'm4_card', 'm5_intent', 'm6_chapter'];
  if (!validTypes.includes(body.type)) {
    return new Response(JSON.stringify(jsonError(ErrorCodes.INVALID_PARAMS, `type must be one of: ${validTypes.join(', ')}`)), {
      status: 400, headers: { 'Content-Type': 'application/json' },
    });
  }

  // Verify work exists
  const work = await env.DB.prepare('SELECT id FROM works WHERE id = ?').bind(body.work_id).first();
  if (!work) {
    return new Response(JSON.stringify(jsonError(ErrorCodes.NOT_FOUND, 'Work not found')), {
      status: 404, headers: { 'Content-Type': 'application/json' },
    });
  }

  // Get next order_index
  const maxOrder = await env.DB.prepare(
    'SELECT MAX(order_index) as mx FROM modules WHERE work_id = ? AND type = ?'
  ).bind(body.work_id, body.type).first<{ mx: number | null }>();
  const orderIndex = (maxOrder?.mx ?? -1) + 1;

  const moduleId = `${body.type}_${crypto.randomUUID()}`;
  const name = body.name || `${body.type} #${orderIndex + 1}`;
  const now = new Date().toISOString();

  await env.DB.prepare(
    'INSERT INTO modules (id, work_id, type, name, order_index, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, \'empty\', ?, ?)'
  ).bind(moduleId, body.work_id, body.type, name, orderIndex, now, now).run();

  return new Response(JSON.stringify(jsonSuccess({
    id: moduleId,
    work_id: body.work_id,
    type: body.type,
    name,
    order_index: orderIndex,
    status: 'empty',
    created_at: now,
  })), {
    status: 201, headers: { 'Content-Type': 'application/json' },
  });
}

// ============================================================
// DELETE /api/write/module/{module_id}
// 删除模块的 D1 记录及其 R2 文件
// ============================================================
export async function deleteModule(env: Env, request: Request, moduleId: string): Promise<Response> {
  const mod = await env.DB.prepare(
    'SELECT id, work_id, type, r2_json_key, r2_md_key FROM modules WHERE id = ?'
  ).bind(moduleId).first<{
    id: string; work_id: string; type: string;
    r2_json_key: string | null; r2_md_key: string | null;
  }>();

  if (!mod) {
    return new Response(JSON.stringify(jsonError(ErrorCodes.NOT_FOUND, 'Module not found')), {
      status: 404, headers: { 'Content-Type': 'application/json' },
    });
  }

  // 删除 R2 文件（.json / .md / .free.md / .versions/）
  const cfg = MODULE_CONFIG[mod.type];
  if (cfg) {
    const jsonRelKey = cfg.jsonKeyFromModule(mod as any);
    if (jsonRelKey) {
      const lang = extractLang(request);
      const jsonKey = r2Path(mod.work_id, lang, jsonRelKey);
      const freeKey = r2Path(mod.work_id, lang, freeKeyFromJsonKey(jsonRelKey));
      const mdKey = r2Path(mod.work_id, lang, jsonRelKey.replace(/\.json$/, '.md'));
      // 删除主文件（忽略不存在的文件）
      try { await env.WORKS_BUCKET.delete(jsonKey); } catch (_) {}
      try { await env.WORKS_BUCKET.delete(freeKey); } catch (_) {}
      try { await env.WORKS_BUCKET.delete(mdKey); } catch (_) {}
      // 删除版本快照目录
      const versionsPrefix = r2Path(mod.work_id, lang, '.versions/' + jsonRelKey.replace(/\.json$/, '') + '/');
      try {
        const list = await env.WORKS_BUCKET.list({ prefix: versionsPrefix });
        for (const obj of list.objects) {
          try { await env.WORKS_BUCKET.delete(obj.key); } catch (_) {}
        }
      } catch (_) {}
    }
  }

  // 删除 D1 记录
  await env.DB.prepare('DELETE FROM modules WHERE id = ?').bind(moduleId).run();
  // 删除版本记录
  await env.DB.prepare('DELETE FROM file_versions WHERE module_id = ?').bind(moduleId).run();

  return new Response(JSON.stringify(jsonSuccess({ deleted: moduleId })), {
    status: 200, headers: { 'Content-Type': 'application/json' },
  });
}

// ============================================================
// GET /api/write/module/{module_id}
// ============================================================
export async function getModule(env: Env, request: Request, moduleId: string): Promise<Response> {
  const mod = await env.DB.prepare(
    'SELECT id, work_id, type, name, order_index, status, r2_json_key, r2_md_key FROM modules WHERE id = ?'
  ).bind(moduleId).first<{
    id: string; work_id: string; type: string; name: string;
    order_index: number; status: string;
    r2_json_key: string | null; r2_md_key: string | null;
  }>();

  if (!mod) {
    return new Response(JSON.stringify(jsonError(ErrorCodes.NOT_FOUND, 'Module not found')), {
      status: 404, headers: { 'Content-Type': 'application/json' },
    });
  }

  const lang = extractLang(request);
  const cfg = MODULE_CONFIG[mod.type];
  if (!cfg) {
    return new Response(JSON.stringify(jsonError(ErrorCodes.INTERNAL_ERROR, `Unknown module type: ${mod.type}`)), {
      status: 500, headers: { 'Content-Type': 'application/json' },
    });
  }

  const jsonRelKey = cfg.jsonKeyFromModule(mod);
  const mdRelKey = cfg.mdKeyFromModule(mod);
  const jsonKey = r2Path(mod.work_id, lang, jsonRelKey);
  const mdKey = r2Path(mod.work_id, lang, mdRelKey);
  const freeKey = r2Path(mod.work_id, lang, freeKeyFromJsonKey(jsonRelKey));

  const [slotData, md, freeContent] = await Promise.all([
    readR2Json(env, jsonKey),
    readR2Text(env, mdKey),
    readR2Text(env, freeKey),
  ]);

  const name = (mod.type === 'm3_card') ? mod.name : undefined;
  const isEmpty = !slotData && !md && !freeContent;

  const timestamps = resolveSlotTimestamps(slotData);

  // 槽位编辑器模式（所有模块统一）
  const template = buildTemplateJson(cfg.tmpl, lang, 2, slotData);
  return new Response(JSON.stringify(jsonSuccess({
    module_id: mod.id, work_id: mod.work_id, type: mod.type,
    name: mod.name, order_index: mod.order_index, status: mod.status,
    editor_type: 'slot',
    template,
    slots: slotData?.slots || {},
    slot_timestamps: timestamps,
    free_content: freeContent,
    rendered_md: md,
    is_template: isEmpty,
  })), { headers: { 'Content-Type': 'application/json' } });
}

// ============================================================
// PUT /api/write/module/{module_id}
// ============================================================
export async function updateModule(env: Env, request: Request, moduleId: string): Promise<Response> {
  const mod = await env.DB.prepare(
    'SELECT id, work_id, type, name, r2_json_key, r2_md_key FROM modules WHERE id = ?'
  ).bind(moduleId).first<{
    id: string; work_id: string; type: string; name: string;
    r2_json_key: string | null; r2_md_key: string | null;
  }>();

  if (!mod) {
    return new Response(JSON.stringify(jsonError(ErrorCodes.NOT_FOUND, 'Module not found')), {
      status: 404, headers: { 'Content-Type': 'application/json' },
    });
  }

  const lang = extractLang(request);
  const cfg = MODULE_CONFIG[mod.type];
  if (!cfg) {
    return new Response(JSON.stringify(jsonError(ErrorCodes.INTERNAL_ERROR, `Unknown module type: ${mod.type}`)), {
      status: 500, headers: { 'Content-Type': 'application/json' },
    });
  }

  const body = await request.json() as {
    slots?: Record<string, string>;
    free_content?: string;
    name?: string;
    _prev_slots?: Record<string, string>;
    _prev_free_content?: string;
    _prev_slot_timestamps?: Record<string, number>;
    _debug_skip_conflict_check?: boolean;
  };
  const hasSlots = body.slots && typeof body.slots === 'object' && Object.keys(body.slots).length > 0;
  const hasFreeContent = body.free_content !== undefined;
  const hasName = typeof body.name === 'string' && body.name.trim().length > 0;

  // 重命名
  if (hasName && !hasSlots && !hasFreeContent) {
    await env.DB.prepare('UPDATE modules SET name = ?, updated_at = ? WHERE id = ?')
      .bind(body.name!.trim(), new Date().toISOString(), moduleId).run();
    return new Response(JSON.stringify(jsonSuccess({ id: moduleId, name: body.name!.trim() })), {
      status: 200, headers: { 'Content-Type': 'application/json' },
    });
  }

  if (!hasSlots && !hasFreeContent) {
    return new Response(JSON.stringify(jsonError(ErrorCodes.MISSING_REQUIRED_FIELD, 'slots, free_content, or name is required')), {
      status: 400, headers: { 'Content-Type': 'application/json' },
    });
  }

  // 校验 slot ID
  let slotWarnings: string[] = [];
  if (hasSlots && body.slots) {
    const validIds = new Set<string>();
    if (cfg.tmpl) {
      cfg.tmpl.sections.forEach(sec => sec.slots.forEach(s => validIds.add(s.id)));
    }
    if (validIds.size > 0) {
      const unknown = Object.keys(body.slots).filter(id => !validIds.has(id));
      if (unknown.length > 0) {
        slotWarnings = [
          `⚠️ 以下 ${unknown.length} 个槽位 ID 不属于 ${mod.type} 模板：${unknown.join(', ')}`,
          `💡 有效 ID: ${[...validIds].join(', ')}`,
        ];
        for (const id of unknown) delete body.slots[id];
        if (Object.keys(body.slots).length === 0 && !hasFreeContent) {
          return new Response(JSON.stringify(jsonError(ErrorCodes.INVALID_PARAMS, slotWarnings.join('\n'))), {
            status: 400, headers: { 'Content-Type': 'application/json' },
          });
        }
      }
    }
  }

  const jsonRelKey = cfg.jsonKeyFromModule(mod);
  const jsonKey = r2Path(mod.work_id, lang, jsonRelKey);
  const freeKey = r2Path(mod.work_id, lang, freeKeyFromJsonKey(jsonRelKey));

  // ── 乐观并发控制：强制时间戳 + 冲突检测 ──
  // 读取当前 R2 内容（一次读取，复用于冲突检测 + 快照 + 合并）
  const existingR2 = (hasSlots && jsonKey) ? await readR2Json(env, jsonKey) : null;

  if (hasSlots) {
    const isDebugBypass = body._debug_skip_conflict_check === true && env.TEST_MODE === 'true';

    if (!isDebugBypass && !body._prev_slot_timestamps) {
      return new Response(JSON.stringify(jsonError(
        'MISSING_TIMESTAMPS',
        '缺少 _prev_slot_timestamps 参数。写入操作必须先通过 GET 获取模块的 slot_timestamps，然后原样传入。如果你是通过 Story Elf 写入，请先调用 read_module。'
      )), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    if (body._prev_slot_timestamps && jsonKey) {
      const currentTimestamps = resolveSlotTimestamps(existingR2);
      const prevTimestamps = body._prev_slot_timestamps;
      const staleSlots: string[] = [];

      for (const slotId of Object.keys(body.slots!)) {
        const prevTs = prevTimestamps[slotId] || 0;
        const currTs = currentTimestamps[slotId] || 0;
        // prevTs === 0：该 slot 在基线中不存在（新增）→ 放行
        // currTs === 0：该 slot 在 R2 中不存在（首次写入）→ 放行
        // 否则必须完全匹配
        if (prevTs !== 0 && currTs !== 0 && prevTs !== currTs) {
          staleSlots.push(slotId);
        }
      }

      if (staleSlots.length > 0) {
        return new Response(JSON.stringify(jsonError(
          'CONTENT_STALE',
          `以下槽位已被修改（可能由 Story Elf 或另一端编辑导致）：${staleSlots.join(', ')}。请刷新获取最新内容后再试。注意：刷新页面将丢失当前未保存的编辑。`
        )), { status: 409, headers: { 'Content-Type': 'application/json' } });
      }
    }
  }

  // V4: 旧内容快照
  const prevJsonContent = body._prev_slots
    ? JSON.stringify({ slots: body._prev_slots, slot_timestamps: resolveSlotTimestamps(existingR2) }, null, 2)
    : (existingR2 ? JSON.stringify({ slots: existingR2.slots, slot_timestamps: resolveSlotTimestamps(existingR2) }, null, 2) : null);
  const prevFreeContent = body._prev_free_content !== undefined
    ? body._prev_free_content
    : ((hasFreeContent && freeKey) ? await readR2Text(env, freeKey) : null);

  // 写 free_content → .free.md
  if (hasFreeContent) {
    await env.WORKS_BUCKET.put(freeKey, body.free_content!, {
      httpMetadata: { contentType: 'text/markdown; charset=utf-8' },
    });
  }

  const currentFreeContent = hasFreeContent ? body.free_content! : await readR2Text(env, freeKey);

  // 写 slots → .json（合并，非替换）+ 更新时间戳
  let mergedSlots: Record<string, string> = {};
  let updatedTimestamps: Record<string, number> = {};
  let slotsActuallyChanged = false;
  if (hasSlots) {
    if (jsonKey) {
      mergedSlots = { ...(existingR2?.slots || {}), ...body.slots! };
    } else {
      mergedSlots = body.slots!;
    }
    // 只更新内容实际发生变化的 slot 的时间戳（避免假冲突）
    updatedTimestamps = { ...resolveSlotTimestamps(existingR2) };
    const writeTime = Date.now();
    for (const slotId of Object.keys(body.slots!)) {
      const oldContent = (existingR2?.slots || {})[slotId] || '';
      if (oldContent !== body.slots![slotId]) {
        updatedTimestamps[slotId] = writeTime;
        slotsActuallyChanged = true;
      }
    }
    // 内容确实变了才写 R2（节省 R2 写入成本）
    if (slotsActuallyChanged) {
      await env.WORKS_BUCKET.put(jsonKey, JSON.stringify({ slots: mergedSlots, slot_timestamps: updatedTimestamps }, null, 2), {
        httpMetadata: { contentType: 'application/json' },
      });
    }
  }

  await touchModule(env, moduleId);

  // V4 自动版本快照（含 slot_timestamps，确保对比准确）
  const newJsonContent = hasSlots ? JSON.stringify({ slots: mergedSlots, slot_timestamps: updatedTimestamps }, null, 2) : '';
  const newFreeContent = hasFreeContent ? body.free_content! : '';
  if (hasSlots && prevJsonContent && prevJsonContent !== newJsonContent) {
    await createSnapshot(env, mod.work_id, jsonKey, prevJsonContent);
  }
  if (hasFreeContent && prevFreeContent && prevFreeContent !== newFreeContent) {
    await createSnapshot(env, mod.work_id, freeKey, prevFreeContent);
  }

  const currentSlotData = hasSlots ? { slots: mergedSlots } : await readR2Json(env, jsonKey);
  const currentSlots = currentSlotData?.slots || {};

  const currentTimestamps = hasSlots ? updatedTimestamps : resolveSlotTimestamps(currentSlotData);

  const name = (mod.type === 'm3_card') ? mod.name : undefined;
  const template = buildTemplateJson(cfg.tmpl, lang, 2, { slots: currentSlots });
  return new Response(JSON.stringify(jsonSuccess({
    module_id: moduleId, lang, saved: true,
    ...(slotWarnings.length > 0 ? { slot_warnings: slotWarnings } : {}),
    template, slots: currentSlots,
    slot_timestamps: currentTimestamps,
    free_content: currentFreeContent,
  })), { headers: { 'Content-Type': 'application/json' } });
}

// ============================================================
// GET /api/write/modules?work_id=X&type=Y
// ============================================================
export async function listModules(env: Env, request: Request): Promise<Response> {
  const url = new URL(request.url);
  const workId = url.searchParams.get('work_id');
  const type = url.searchParams.get('type');

  if (!workId) {
    return new Response(JSON.stringify(jsonError(ErrorCodes.MISSING_REQUIRED_FIELD, 'work_id is required')), {
      status: 400, headers: { 'Content-Type': 'application/json' },
    });
  }

  let query = 'SELECT id, type, name, order_index, status FROM modules WHERE work_id = ?';
  const bindings: string[] = [workId];
  if (type) { query += ' AND type = ?'; bindings.push(type); }
  query += ' ORDER BY order_index ASC, name ASC';

  const result = await env.DB.prepare(query).bind(...bindings).all<{
    id: string; type: string; name: string; order_index: number; status: string;
  }>();

  return new Response(JSON.stringify(jsonSuccess({
    work_id: workId,
    type: type || null,
    modules: result.results || [],
  })), { headers: { 'Content-Type': 'application/json' } });
}

// ============================================================
// GET /api/write/module/{module_id}/versions
// ============================================================
export async function listModuleVersions(env: Env, request: Request, moduleId: string): Promise<Response> {
  const mod = await env.DB.prepare(
    'SELECT id, work_id, type, r2_json_key, r2_md_key FROM modules WHERE id = ?'
  ).bind(moduleId).first<{
    id: string; work_id: string; type: string;
    r2_json_key: string | null; r2_md_key: string | null;
  }>();

  if (!mod) {
    return new Response(JSON.stringify(jsonError(ErrorCodes.NOT_FOUND, 'Module not found')), {
      status: 404, headers: { 'Content-Type': 'application/json' },
    });
  }

  const lang = extractLang(request);
  const cfg = MODULE_CONFIG[mod.type];
  if (!cfg) {
    return new Response(JSON.stringify(jsonError(ErrorCodes.INTERNAL_ERROR, `Unknown module type: ${mod.type}`)), {
      status: 500, headers: { 'Content-Type': 'application/json' },
    });
  }

  const jsonRelKey = cfg.jsonKeyFromModule(mod);
  const jsonKey = r2Path(mod.work_id, lang, jsonRelKey);
  const freeKey = r2Path(mod.work_id, lang, freeKeyFromJsonKey(jsonRelKey));

  const [jsonVersions, freeVersions] = await Promise.all([
    jsonKey ? listVersions(env, jsonKey) : Promise.resolve([]),
    freeKey ? listVersions(env, freeKey) : Promise.resolve([]),
  ]);

  return new Response(JSON.stringify(jsonSuccess({
    module_id: moduleId,
    json_key: jsonKey, free_key: freeKey,
    json_versions: jsonVersions, free_versions: freeVersions,
  })), { headers: { 'Content-Type': 'application/json' } });
}

// ============================================================
// GET /api/write/module/{module_id}/diff?v1=X&v2=Y
// ============================================================
export async function diffModuleVersions(env: Env, request: Request, moduleId: string): Promise<Response> {
  const mod = await env.DB.prepare(
    'SELECT id, work_id, type, r2_json_key, r2_md_key FROM modules WHERE id = ?'
  ).bind(moduleId).first<{
    id: string; work_id: string; type: string;
    r2_json_key: string | null; r2_md_key: string | null;
  }>();

  if (!mod) {
    return new Response(JSON.stringify(jsonError(ErrorCodes.NOT_FOUND, 'Module not found')), {
      status: 404, headers: { 'Content-Type': 'application/json' },
    });
  }

  const url = new URL(request.url);
  const v1Raw = url.searchParams.get('v1');
  const v2Raw = url.searchParams.get('v2');
  const targetKey = url.searchParams.get('key');
  const slotOnly = url.searchParams.get('slot_only') === '1';

  if (!v1Raw || !v2Raw) {
    return new Response(JSON.stringify(jsonError(ErrorCodes.MISSING_REQUIRED_FIELD, 'v1 and v2 query params required')), {
      status: 400, headers: { 'Content-Type': 'application/json' },
    });
  }

  const lang = extractLang(request);
  const cfg = MODULE_CONFIG[mod.type];
  if (!cfg) {
    return new Response(JSON.stringify(jsonError(ErrorCodes.INTERNAL_ERROR, `Unknown module type: ${mod.type}`)), {
      status: 500, headers: { 'Content-Type': 'application/json' },
    });
  }

  const jsonRelKey = cfg.jsonKeyFromModule(mod);
  const jsonKey = r2Path(mod.work_id, lang, jsonRelKey);
  const freeKey = r2Path(mod.work_id, lang, freeKeyFromJsonKey(jsonRelKey));

  const resolveRef = async (raw: string, key: string): Promise<string> => {
    if (raw === 'current') return 'current';
    if (raw === 'previous' || raw === 'latest') {
      const vers = await listVersions(env, key);
      if (raw === 'previous') return vers.length < 1 ? 'current' : vers[0].id;
      return 'current';
    }
    const num = parseInt(raw, 10);
    if (!isNaN(num) && num > 0) {
      const vers = await listVersions(env, key);
      const found = vers.find(v => v.version_num === num);
      if (found) return found.id;
      return raw;
    }
    return raw;
  };

  const v1 = targetKey === 'free' ? v1Raw : await resolveRef(v1Raw, jsonKey);
  const v2 = targetKey === 'free' ? v2Raw : await resolveRef(v2Raw, jsonKey);

  const r2Key = targetKey === 'free' ? freeKey : jsonKey;
  if (!r2Key) {
    return new Response(JSON.stringify(jsonError(ErrorCodes.INTERNAL_ERROR, 'No file to diff')), {
      status: 500, headers: { 'Content-Type': 'application/json' },
    });
  }

  let result: DiffResult | null = null;
  if (v2 === 'current') {
    let currentContent = '';
    try { const obj = await env.WORKS_BUCKET.get(r2Key); if (obj) currentContent = await obj.text(); } catch { /* empty */ }
    result = await diffWithCurrent(env, r2Key, currentContent, v1);
  } else {
    result = await diffModVersions(env, r2Key, v1, v2);
  }

  if (!result) {
    return new Response(JSON.stringify(jsonError(ErrorCodes.NOT_FOUND, 'Version(s) not found')), {
      status: 404, headers: { 'Content-Type': 'application/json' },
    });
  }

  if (slotOnly && r2Key.endsWith('.json')) {
    const slotChanges = result.changes.filter(c => c.path.startsWith('slots.'));
    return new Response(JSON.stringify(jsonSuccess({ ...result, changes: slotChanges })), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify(jsonSuccess(result)), {
    headers: { 'Content-Type': 'application/json' },
  });
}

// ============================================================
// 内部辅助
// ============================================================
async function touchModule(env: Env, moduleId: string): Promise<void> {
  const now = new Date().toISOString();
  await env.DB.prepare(
    'UPDATE modules SET status = CASE WHEN status = \'empty\' THEN \'in_progress\' ELSE status END, updated_at = ? WHERE id = ?'
  ).bind(now, moduleId).run();
}
