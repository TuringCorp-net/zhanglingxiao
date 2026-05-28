// L1: 上下文组装
// 将作品元信息 + 上下文包 + 动态参数组装成 AgentVars。

import { type Lang, LANG_LABELS } from './work-content';
import type { AgentVars, WorkMeta, ContextOpts } from './types';

/**
 * 组装 Agent 上下文变量池。
 * 注意：M0-M5 内容由 context-package.ts 预先构建（`contextPkg` 参数），
 * 此处只负责拼装模板渲染所需的 vars。
 */
export function assembleContext(
  workMeta: WorkMeta,
  lang: Lang,
  contextPkg: string,
  opts: ContextOpts,
): AgentVars {
  return {
    work_title: workMeta.title,
    category: workMeta.category || '',
    summary: workMeta.summary || '',
    lang_label: LANG_LABELS[lang],
    context_package: contextPkg,
    module: opts.module || '',
    section_title: opts.sectionTitle || '',
  };
}
