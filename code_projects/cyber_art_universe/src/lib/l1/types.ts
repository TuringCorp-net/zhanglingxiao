// L1: 共享类型定义
// Scenario 配置、领域数据源定义、上下文变量类型

// ============================================================
// 领域数据源定义（纵向上下文）
// ============================================================

/** 数据源类型 */
export type SourceType = 'r2' | 'db';

/** 纵向领域定义：一条待组装的上下文数据源 */
export interface DomainDef {
  /** 变量名，如 world_bible、characters、outline */
  key: string;
  /** 数据源类型 */
  source: SourceType;
  /** R2 文件路径（source=r2 时），支持 {sectionId} 动态占位符 */
  r2Path?: string;
  /** DB 查询的表名（source=db 时） */
  dbTable?: string;
  /** DB 查询的额外 WHERE 条件 */
  dbWhere?: string;
  /** DB 查询字段映射 */
  dbFields?: string[];
  /** 字符串截断上限（字符数），0 = 不截断 */
  maxChars?: number;
  /** DB 列表上限（条数） */
  maxItems?: number;
}

// ============================================================
// 场景配置
// ============================================================

/** 场景配置：定义一次 Agent 调用需要哪些上下文 + 什么 prompt */
export interface ScenarioConfig {
  /** 场景唯一标识 */
  id: string;
  /** prompt 模板文件名（不含路径，如 'reader_companion'） */
  promptFile: string;
  /** 纵向领域列表（从 R2/DB 拉取的内容） */
  verticals: DomainDef[];
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
  // 作品元信息
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
