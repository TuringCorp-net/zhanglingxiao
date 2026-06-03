// L2: 模块写作指南
// get_writing_guide 工具返回的内容。每份指南 = 文字指导 + 模板结构（如有）。
// 指南不进 system prompt，由 LLM 按需通过工具调用获取（就近原则）。

import { renderTemplateAsJson, renderCardAsJson, type Lang } from '../l1/template';

// 模板定义（仅用于渲染模板结构部分）
import { BIBLE_TEMPLATE } from '../../api/write/worldbuilding';
import { OUTLINE_TEMPLATE } from '../../api/write/outline';
import { CHARACTER_TEMPLATE } from '../../api/write/character_card';
import { FORESHADOWING_TEMPLATE } from '../../api/write/foreshadowing';
import { FORESHADOWING_CARD_SLOTS } from '../../api/write/foreshadowing_card';

// ============================================================
// 文字指导（中文）
// ============================================================

const TEXT_GUIDES: Record<string, string> = {
  m0: `## M0 原始构想 — 写作指南

**定位**：这是作品的"种子"——作者最初被灵感击中的那一刻所记录的核心 idea。它是所有后续创作的原点。

**你的角色**：
- 你可以与作者讨论、提问、帮助澄清和深化这个构想
- 你**不能直接修改 M0 内容**。M0 是作者自己的编辑空间，是 ta 最原始的创作冲动
- 如果作者要求你修改 M0，请温和地说明 M0 由作者自行维护（通过自由编辑区），你可以提供建议让作者参考后自行修改

**模板结构**：M0 没有固定模板，它是自由文本 + 可选的结构化槽位（如核心概念、类型、情感内核等）。`,

  m1: `## M1 世界观设定圣经 — 写作指南

**定位**：这是作品的**最高约束文档**。所有 M2-M6 的创作都必须遵循 M1 中定义的规则。它相当于作品的"物理定律"。

**写作要点**：
- 力量/技术体系要明确来源、运作方式、代价和边界——模糊的魔法体系会让读者觉得"作者在耍赖"
- 承诺清单是给读者的契约：你承诺了什么，就要在后续章节中兑现
- 内容禁区帮助你记住"什么不能写"——这和"什么要写"同等重要
- 语言风格指南决定了整部作品的叙事基调

**与其他模块的关系**：
- M2（大纲）必须遵循 M1 的世界规则
- M3（人物）的能力边界受 M1 约束
- M4（伏笔）常依赖 M1 中的规则作为伏笔基础
- M6（正文）中任何违反 M1 规则的情节都需要特殊解释`,

  m2: `## M2 长篇框架大纲 — 写作指南

**定位**：作品的"骨架"。定义整体的叙事结构、节奏和章节分布。

**写作要点**：
- 三幕（或四幕）结构是长篇叙事的基础框架，但不必僵硬套用
- 每一幕需要有明确的情节点推动故事进入下一阶段
- 支线规划表帮助你在主线和支线之间分配注意力
- 节奏规划——哪里该快、哪里该慢——避免中段拖沓

**与其他模块的关系**：
- 大纲中的章节顺序决定了 M5 意图卡的创建顺序
- M4 伏笔的埋种和回收章节应在大纲中有对应位置`,

  m3_card: `## M3 人物卡 — 写作指南

**重要概念**：人物卡是**一个角色一张卡**，不是整个作品一张卡。通过左侧面板管理角色列表，每个角色有独立的卡片。

**写作要点**：
- 不要只填属性，要思考角色在故事中的**功能**——ta 推动什么冲突？体现什么主题？
- 成长弧线（character arc）是人物卡的灵魂——角色从第一章到最后一章发生了怎样的内在变化？
- 能力边界比能力本身更重要——读者更关心角色的限制而非超能力
- 关系网建立角色之间的联系，避免角色成为孤岛
- 镜像反派（如果有）是主角的黑暗面映射，增加主题深度

**与其他模块的关系**：
- 角色的能力边界受 M1 世界规则约束
- M4 伏笔常围绕角色的秘密和成长设计
- M5 意图卡中的 POV 角色从人物卡中选择`,

  m4_strategy: `## M4 伏笔策略 — 写作指南

**定位**：伏笔是横跨多个章节的暗线。本文档帮助你在写作前**主动规划**伏笔网络，而非事后扫描。每部作品只有一张策略表。

**写作要点**：
- 先定策略再写具体伏笔——密集还是稀疏？以什么类型为主？
- 强度分级（核心/重要/彩蛋）帮助你控制读者的注意力预算
- 生命周期阶段（已规划→已埋种→发展中→部分揭示→已回收）追踪每个伏笔的状态
- 注意交叉引用——多个伏笔之间可以相互关联，形成伏笔网络

**与其他模块的关系**：
- 每条具体伏笔以 M4 伏笔卡（m4_card）的形式独立管理
- M5 意图卡标记每章触发/回收的伏笔
- M6 正文一致性检查对照伏笔账本验证回收情况`,

  m4_card: `## M4 伏笔卡 — 写作指南

**重要概念**：伏笔卡是**一个伏笔一张卡**，不是整个作品一张卡。每张卡记录一个伏笔从埋种到回收的完整生命周期。

**写作要点**：
- 伏笔类型决定了读者发现它的方式——身份伏笔、道具伏笔、对白伏笔、事件伏笔各有不同的埋种技巧
- 埋种→强化→部分揭示→回收，这是伏笔的四个阶段。不是所有伏笔都需要走完四个阶段，但核心伏笔应该完整
- 误导/反转是可选的，但能让伏笔更精彩
- 状态标记帮助你追踪进度

**与其他模块的关系**：
- 依赖于 M1 的世界规则（如魔法体系的规则才能埋下"某人违反了规则"的伏笔）
- 关联章节范围应与 M2 大纲对应`,

  m5_intent: `## M5 章节意图卡 — 写作指南

**重要概念**：意图卡是**一个章节一张卡**。它是在动笔写正文之前，对本章"要达成什么"的规划。它不是章纲，而是创作意图的声明。

**写作要点**：
- 推进冲突、揭示信息、制造悬念——这是每章的三个核心功能，至少应明确其中两个
- 情绪目标决定读者读完本章后的感受——紧张、感动、好奇、悲伤
- POV 角色决定了叙事视角，也决定了读者"看到什么"和"看不到什么"
- 开篇钩子在 30 秒内抓住读者，章末卡点让读者翻到下一页
- 预估字数帮助控制节奏——2000 字的快节奏场景和 5000 字的情感深度场景节奏完全不同

**与其他模块的关系**：
- 意图卡基于 M2 大纲中的章节规划
- POV 角色来自 M3 人物卡
- 伏笔触发/回收对照 M4 伏笔账本
- M6 正文生成时，意图卡是核心约束文档`,

  m6_chapter: `## M6 章节正文 — 写作指南

**定位**：实际的小说正文。这是 Story Forger 中最"自由"的模块——没有固定模板，只有 Markdown 自由文本。

**写作要点**：
- 写作前先查看对应的 M5 意图卡——确保正文兑现了意图
- 参考 M1 的语言风格指南——叙事语调应保持一致
- POV 角色的声音要独特——不同 POV 章节的叙事风格应该不同
- 正文中出现的伏笔要素应记录到 M4 伏笔卡中
- 每章末尾应有一个"为什么读者必须翻到下一页"的理由

**与其他模块的关系**：
- 直接受 M5 意图卡约束——意图卡说了要揭示什么信息，正文就要揭示
- 受 M1 世界规则约束——不能违反已建立的世界逻辑
- 正文中的新设定应同步更新到 M1（如果影响世界规则）`,
};

// ============================================================
// 组合：文字指导 + 模板结构
// ============================================================

/**
 * 获取指定模块的完整写作指南。
 * @param moduleType 模块类型
 * @param lang 语言（模板结构会渲染为对应语言）
 * @returns 格式化的指南文本
 */
export function getModuleGuide(moduleType: string, lang: Lang): string {
  const textGuide = TEXT_GUIDES[moduleType];
  if (!textGuide) {
    return `未知模块类型: ${moduleType}。支持: m0, m1, m2, m3_card, m4_strategy, m4_card, m5_intent, m6_chapter`;
  }

  const parts: string[] = [textGuide];

  // 附加模板结构（仅当模块有结构化模板定义时）
  const templateJson = renderTemplateStructure(moduleType, lang);
  if (templateJson) {
    parts.push(`\n## 模板结构\n\n以下是该模块的模板定义（含所有槽位的 ID、label、hint）。**调用 write_to_slot 时，slot_values 的 key 必须严格使用此模板中的 slot_id，不可自行发明或修改。**\n\n\`\`\`json\n${templateJson}\n\`\`\``);
  }

  return parts.join('\n');
}

/**
 * 渲染模块的模板结构 JSON（供指南使用）。
 * 仅返回结构信息（id/label/hint），不包含填充内容。
 */
function renderTemplateStructure(moduleType: string, lang: Lang): string | null {
  try {
    switch (moduleType) {
      case 'm1':
        return renderTemplateAsJson(BIBLE_TEMPLATE, lang, 2);
      case 'm2':
        return renderTemplateAsJson(OUTLINE_TEMPLATE, lang, 2);
      case 'm3_card':
        return renderTemplateAsJson(CHARACTER_TEMPLATE, lang, 2);
      case 'm4_strategy':
        return renderTemplateAsJson(FORESHADOWING_TEMPLATE, lang, 2);
      case 'm4_card':
        return renderCardAsJson('伏笔卡', FORESHADOWING_CARD_SLOTS, lang, 2);
      case 'm0':
        // M0 无结构化模板，返回 null（纯文字指南足够）
        return null;
      case 'm5_intent': {
        // M5 无 TemplateDef，从 createIntent 的结构提取字段说明
        const fields = [
          { id: 'goal_advance_conflict', label: '推进冲突', hint: '推进哪条剧情线' },
          { id: 'goal_reveal_info', label: '揭示信息', hint: '本章要交代什么信息' },
          { id: 'goal_create_suspense', label: '制造悬念', hint: '本章要制造什么悬念' },
          { id: 'emotional_goal', label: '情绪目标', hint: '希望读者产生什么情绪' },
          { id: 'pov_character', label: '视角角色', hint: '本章以谁的视角展开' },
          { id: 'structure_opening', label: '开篇钩子', hint: '用什么在 30 秒内抓住读者' },
          { id: 'structure_cliffhanger', label: '章末卡点', hint: '用什么让读者想继续读下一章' },
          { id: 'characters_involved', label: '出场人物', hint: '逗号分隔的角色名列表' },
          { id: 'estimated_words', label: '预估字数', hint: '本章预估字数' },
          { id: 'style_notes', label: '风格备注', hint: '本章特有的风格/语气要求' },
        ];
        return JSON.stringify({
          type: 'm5_intent',
          description: lang === 'zh' ? '章节意图卡——每章一张，记录本章的创作意图' : 'Chapter intent card — one per chapter',
          fields: fields.map(f => ({
            id: f.id,
            label: f.label,
            hint: f.hint,
          })),
        }, null, 2);
      }
      case 'm6_chapter':
        // M6 是自由文本，无结构化模板
        return JSON.stringify({
          type: 'm6_chapter',
          description: lang === 'zh'
            ? '章节正文——自由 Markdown 文本。参考对应章节的 M5 意图卡进行创作。无固定模板。'
            : 'Chapter body — free Markdown text. Write based on the corresponding M5 intent card. No fixed template.',
          format: 'markdown',
          note: lang === 'zh'
            ? '正文写入时使用 write_to_slot(module_type="m6_chapter", slot_values={"body": markdown内容})'
            : 'Use write_to_slot(module_type="m6_chapter", slot_values={"body": markdown_content}) when saving',
        }, null, 2);
      default:
        return null;
    }
  } catch (err) {
    console.error(`[guides] 模板结构渲染失败 (${moduleType}):`, (err as Error).message);
    return null;
  }
}
