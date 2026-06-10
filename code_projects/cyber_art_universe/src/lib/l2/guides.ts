// L2: 模块写作指南
// get_writing_guide 工具返回的内容。每份指南 = 文字指导 + 模板结构（如有）。
// 指南不进 system prompt，由 LLM 按需通过工具调用获取（就近原则）。
// 指南文本维护在 prompts/guides/*.md 文件中，便于独立编辑。

import { renderTemplateAsJson, renderCardAsJson, type Lang } from '../l1/template';
import { BIBLE_TEMPLATE, OUTLINE_TEMPLATE, CHARACTER_TEMPLATE, FORESHADOWING_TEMPLATE, FORESHADOWING_CARD_SLOTS } from '../../api/write/module';

// ============================================================
// 文字指导（从 .md 文件导入）
// ============================================================

import m0Guide from './prompts/guides/m0.md';
import m1Guide from './prompts/guides/m1.md';
import m2Guide from './prompts/guides/m2.md';
import m3CardGuide from './prompts/guides/m3_card.md';
import m4StrategyGuide from './prompts/guides/m4_strategy.md';
import m4CardGuide from './prompts/guides/m4_card.md';
import m5IntentGuide from './prompts/guides/m5_intent.md';
import m6ChapterGuide from './prompts/guides/m6_chapter.md';

const TEXT_GUIDES: Record<string, string> = {
  m0: m0Guide,
  m1: m1Guide,
  m2: m2Guide,
  m3_card: m3CardGuide,
  m4_strategy: m4StrategyGuide,
  m4_card: m4CardGuide,
  m5_intent: m5IntentGuide,
  m6_chapter: m6ChapterGuide,
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
