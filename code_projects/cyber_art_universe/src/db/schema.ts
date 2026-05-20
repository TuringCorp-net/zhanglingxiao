// Cyber Art Universe 数据库类型定义

// ============================================================
// 作品（Work）
// ============================================================
export interface Work {
  id: string;
  title: string;
  type: string; // 内部字段：novel / series / setting / character / outline / article
  category: string; // 对外题材分类 key：fantasy/science-fiction/romance/contemporary/adventure/mystery-thriller/historical/young-adult
  author: string;
  creation_attribution: string; // original / fanfiction / ai-assisted
  audience: string; // JSON 数组：male_lead / female_lead / no_cp / BL / GL / LGBTQ+
  tags: string; // JSON 数组
  status: string; // ongoing / completed / draft
  summary: string;
  r2_object_key: string;
  version: number;
  created_at: string;
  updated_at: string;
}

// ============================================================
// 章节（Section）
// ============================================================
export interface Section {
  id: string;
  work_id: string;
  title: string;
  order_index: number;
  section_summary: string;
  r2_object_key: string;
  word_count: number;
  entities_involved: string; // JSON 数组
  version: number;
  created_at: string;
  updated_at: string;
}

// ============================================================
// 实体（Entity）
// ============================================================
export interface Entity {
  id: string;
  work_id: string;
  name: string;
  type: string; // character / location / organization / concept / item / term / event
  description: string;
  first_appearance: string; // section_id
  related_entities: string; // JSON 数组
  version: number;
  created_at: string;
  updated_at: string;
}

// ============================================================
// AI 参与者（Agent）
// ============================================================
export interface Agent {
  id: string;
  agent_type: string; // author / reader / critic / editor
  name: string;
  persona: string; // JSON 配置
  status: string; // active / inactive
  config: string; // JSON 配置
  created_at: string;
  updated_at: string;
}

// ============================================================
// 评价/信号（Review）
// ============================================================
export interface Review {
  id: string;
  work_id: string;
  section_id: string | null;
  agent_id: string;
  reviewer_type: string; // AI / human
  score_overall: number | null;
  comment: string;
  parent_id: string | null;
  like_count: number;
  created_at: string;
}

// ============================================================
// 订阅（Subscription）
// ============================================================
export interface Subscription {
  id: string;
  user_id: string;
  subscribe_type: string; // work / author / tag / query
  target_id: string;
  query_condition: string; // JSON
  created_at: string;
}

// ============================================================
// 事件（Event）
// ============================================================
export interface Event {
  id: string;
  event_type: string;
  work_id: string;
  section_id: string | null;
  entity_id: string | null;
  delta_summary: string;
  affected_entities: string; // JSON 数组
  timestamp: string;
  processed: number; // 0 / 1
}

// ============================================================
// Workers Env 绑定
// ============================================================
export interface Env {
  DB: D1Database;
  WORKS_BUCKET: R2Bucket;
  ASSETS: Fetcher;
  USER_TOKEN?: string;   // 用户 token（逗号分隔，未来替换为实时登录校验）
  ADMIN_TOKEN?: string;  // 后台管理 token（固定值，Claude / 自动化任务使用）
  AI_PROVIDER?: string;
  AI_API_KEY?: string;
}
