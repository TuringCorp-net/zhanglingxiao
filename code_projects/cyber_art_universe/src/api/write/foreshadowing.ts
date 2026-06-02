// Story Forger — 伏笔账本（SF-023）（多语言 + 规划导向 + JSON 槽位数据）
//
// 设计原则（区别于"AI 扫描已有章节提取伏笔"的反向做法）：
//   伏笔是作者主动设计的暗线。AI 的角色是：
//     1. 帮助作者在写作前基于大纲/世界观规划伏笔网络
//     2. M6 一致性校验时正向检查伏笔是否按计划回收
//   不做：AI 全盘扫描已写好的章节来"发现"伏笔
import { Env } from '../../db/schema';
import { jsonSuccess, jsonError } from '../../lib/response';
import { ErrorCodes } from '../../lib/errors';
import { workContentPath, extractLang, type Lang } from '../../lib/l1/work-content';
import { type TemplateDef } from '../../lib/l1/template';

// ============================================================
// 伏笔账本 — 结构化模板定义（单一来源，双语）
// ============================================================

export const FORESHADOWING_TEMPLATE: TemplateDef = {
  title: { zh: '伏笔账本', en: 'Foreshadowing Ledger' },
  intro: {
    zh: '伏笔是横跨多个章节的暗线。好的伏笔让读者在回收时恍然大悟。\n> 本文档帮助你在写作前主动规划伏笔网络，而非事后扫描。\n> 每条伏笔条目通过左侧面板独立管理（新增 / 删除），点击条目在右侧编辑。',
    en: 'Foreshadowing is the art of planting clues across chapters. Great foreshadowing makes readers gasp in hindsight.\n> This document helps you proactively plan your foreshadowing network before writing — not scan chapters after the fact.\n> Each hook entry is managed independently via the left panel (add / delete). Click an entry to edit in the right panel.',
  },
  sections: [
    {
      heading: { zh: '一、伏笔策略总览', en: 'I. Foreshadowing Strategy Overview' },
      slots: [
        { id: 'fh_strategy', level: 1, label: { zh: '', en: '' }, hint: { zh: '用一段话描述整部作品的伏笔策略：密集还是稀疏？以什么类型的伏笔为主？', en: 'Describe your overall foreshadowing strategy in a paragraph: dense or sparse? What types dominate?' } },
      ],
    },
  ],
  outro: {
    zh: 'M4 自由编辑区',
    en: 'M4 Free editing zone',
  },
};

/** R2 路径 */
function fhJsonPath(workId: string, lang: Lang) { return workContentPath(workId, lang, 'foreshadowing.json'); }
function fhMdPath(workId: string, lang: Lang) { return workContentPath(workId, lang, 'foreshadowing.md'); }

export async function readForeshadowing(env: Env, request: Request, workId: string): Promise<Response> {
  // V3: 委托到统一 Module API
  const { getModule } = await import('./module');
  return getModule(env, request, `m4_strategy_${workId}`);
}

// ============================================================
// PUT /api/write/foreshadowing/{work_id}?lang=zh|en
// ============================================================

export async function updateForeshadowing(env: Env, request: Request, workId: string): Promise<Response> {
  // V3: 委托到统一 Module API（三文件物理隔离：.json + .free.md + .md）
  const { updateModule } = await import('./module');
  return updateModule(env, request, `m4_strategy_${workId}`);
}
