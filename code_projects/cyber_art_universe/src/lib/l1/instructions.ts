// L1: 指令构建
// 加载 prompt 模板 .md 文件 → 注入 vars 变量 → 返回完整 system prompt。

import { renderTemplate } from './render';
import { getPromptTemplate } from './scenarios';
import type { AgentVars } from './types';

/**
 * 构建 system prompt：将 vars 注入 prompt 模板。
 *
 * @param promptFile  场景的 prompt 文件名（如 'reader_companion'）
 * @param vars        由 assembleContext() 返回的变量池
 * @returns 渲染后的 system prompt 字符串
 */
export function buildSystemPrompt(promptFile: string, vars: AgentVars): string {
  const template = getPromptTemplate(promptFile);
  if (!template) {
    throw new Error(`[instructions] 未找到 prompt 模板: ${promptFile}`);
  }

  return renderTemplate(template, vars);
}
