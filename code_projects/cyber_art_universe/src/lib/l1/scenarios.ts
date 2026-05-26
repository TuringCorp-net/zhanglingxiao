// L1: 场景注册中心
// 对话场景统一注册到 SCENARIOS 表。新增场景 = 创建 prompts/{id}/system.md + 在此注册一行。
// L1 只负责 persona 级别区分（writer vs reader），不做任务级场景。
// 任务级约束（"只改人物卡"、"输出格式"）由 L2 工作流层负责。

import type { ScenarioConfig } from './types';

// ============================================================
// .md Prompt 模板导入
// ============================================================

import readerCompanionMd from './prompts/reader_companion/system.md';
import writerCompanionMd from './prompts/writer_companion/system.md';

// ============================================================
// 场景注册表（id → { config, template }）
// ============================================================

interface ScenarioEntry {
  config: ScenarioConfig;
  template: string;
}

const SCENARIOS: Record<string, ScenarioEntry> = {
  reader_companion: {
    config: { id: 'reader_companion', promptFile: 'reader_companion' },
    template: readerCompanionMd,
  },
  writer_companion: {
    config: { id: 'writer_companion', promptFile: 'writer_companion' },
    template: writerCompanionMd,
  },
};

// ============================================================
// 对外接口
// ============================================================

export function getScenario(id: string): ScenarioConfig | undefined {
  return SCENARIOS[id]?.config;
}

export function getPromptTemplate(promptFile: string): string | undefined {
  return SCENARIOS[promptFile]?.template;
}
