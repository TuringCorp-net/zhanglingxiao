// L1: 场景注册中心
// 每个场景声明：包含哪些纵向领域 + 用什么 prompt 模板。
// 新增场景在此注册 + 在 l1/prompts/{scenario}/system.md 创建对应的指令模板。

import type { ScenarioConfig } from './types';

// ============================================================
// .md Prompt 模板导入（TypeScript 字符串 import）
// ============================================================

import readerCompanionMd from './prompts/reader_companion/system.md';
import writerCompanionMd from './prompts/writer_companion/system.md';

// ============================================================
// 预定义场景
// ============================================================

/** Read 侧伴读精灵 */
const READER_COMPANION: ScenarioConfig = {
  id: 'reader_companion',
  promptFile: 'reader_companion',
  verticals: [
    { key: 'world_bible',   source: 'r2', r2Path: 'world_bible.md',  maxChars: 1500 },
    { key: 'characters',    source: 'db', dbTable: 'entities',       dbWhere: "type != 'foreshadowing'", dbFields: ['name', 'type', 'description'], maxItems: 20 },
    { key: 'outline',       source: 'r2', r2Path: 'outline.md',      maxChars: 1000 },
    { key: 'current_chapter', source: 'r2', r2Path: 'chapters/{sectionId}.md', maxChars: 3000 },
  ],
};

/** Write 侧写作伴侣 */
const WRITER_COMPANION: ScenarioConfig = {
  id: 'writer_companion',
  promptFile: 'writer_companion',
  verticals: [
    { key: 'world_bible',   source: 'r2', r2Path: 'world_bible.md',  maxChars: 1500 },
    { key: 'characters',    source: 'db', dbTable: 'entities',       dbWhere: "type != 'foreshadowing'", dbFields: ['name', 'type', 'description'], maxItems: 20 },
    { key: 'outline',       source: 'r2', r2Path: 'outline.md',      maxChars: 1000 },
    { key: 'current_chapter', source: 'r2', r2Path: 'chapters/{sectionId}.md', maxChars: 3000 },
  ],
};

// ============================================================
// 场景注册表
// ============================================================

/** 所有已注册场景 */
const SCENARIOS: Record<string, ScenarioConfig> = {
  reader_companion: READER_COMPANION,
  writer_companion: WRITER_COMPANION,
};

/** 场景 → prompt 模板内容映射 */
const PROMPTS: Record<string, string> = {
  reader_companion: readerCompanionMd,
  writer_companion: writerCompanionMd,
};

// ============================================================
// 对外接口
// ============================================================

/** 根据场景 ID 获取场景配置 */
export function getScenario(id: string): ScenarioConfig | undefined {
  return SCENARIOS[id];
}

/** 获取场景对应的 prompt 模板内容 */
export function getPromptTemplate(promptFile: string): string | undefined {
  return PROMPTS[promptFile];
}
