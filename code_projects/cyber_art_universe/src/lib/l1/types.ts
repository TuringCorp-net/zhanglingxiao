// L1: 共享类型定义

// ============================================================
// 场景配置
// ============================================================

/** 场景配置：定义一个对话场景的 id 和对应的 prompt 模板 */
export interface ScenarioConfig {
  id: string;
  promptFile: string;
}

// ============================================================
// 上下文变量
// ============================================================

/** 作品基本信息（从 DB works 表读取） */
export interface WorkMeta {
  title: string;
  category: string;
  summary: string;
}

/** 上下文动态参数 */
export interface ContextOpts {
  module?: string;
  sectionId?: string;
  sectionTitle?: string;
}

/** assembleContext 返回的变量池 —— 供模板引擎注入 */
export interface AgentVars {
  work_title: string;
  category: string;
  summary: string;
  lang_label: string;

  // M0-M5 写作上下文包（由 context-package.ts 构建，一次性冻结）
  context_package: string;

  // 动态字段（不在 system 层，注入到 user message 前缀）
  module: string;
  section_title: string;
}
