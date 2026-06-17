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
  status: string; // draft / published / closed
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
// 模块（Module）— v3.0 统一数据架构
// M0-M6 所有模块实例统一存储于此表
// ============================================================
export interface Module {
  id: string;           // module_id: 'm1_worldbuilding', 'm3_card_{uuid}', etc.
  work_id: string;
  type: string;         // 'm0'|'m1'|'m2'|'m3_card'|'m4_strategy'|'m4_card'|'m5_intent'|'m6_chapter'
  name: string;
  order_index: number;
  status: string;       // 'empty'|'in_progress'|'done'
  r2_json_key: string;  // R2 .json 路径
  r2_md_key: string;    // R2 .md 路径
  created_at: string;
  updated_at: string;
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
// 文件版本历史（V4）
// ============================================================
export interface FileVersion {
  id: string;
  work_id: string;
  r2_key: string;
  version_num: number;
  snapshot_key: string;
  size_bytes: number | null;
  created_at: string;
}

// ============================================================
// 用户（User）— Phase 0
// ============================================================
export interface User {
  id: string;
  cyber_name: string;
  auth_key_hash: string;
  email: string;
  email_verified: number;
  entropy_seed: string;
  class: string;
  karma: number;
  energy: number;
  energy_cap: number;
  last_energy_refill: string | null;
  recommendation_votes_available: number;
  last_vote_refill: string | null;
  read_vip_tier: string;
  write_vip_tier: string;
  read_vip_expires_at: string | null;
  write_vip_expires_at: string | null;
  created_at: string;
  updated_at: string;
}

// ============================================================
// 会话（Session）
// ============================================================
export interface Session {
  id: string;
  user_id: string;
  token_hash: string;
  created_at: string;
  expires_at: string | null;
  revoked: number;
}

// ============================================================
// Workers Env 绑定
// ============================================================
export interface Env {
  DB: D1Database;
  WORKS_BUCKET: R2Bucket;
  ASSETS: Fetcher;
  SELF: Fetcher;
  RESEND_API_KEY?: string;   // Resend 邮件发送 API Key
  TEST_MODE?: string;          // 测试模式：跳过 IP 限流 + 固定验证码 000000
  USER_TOKEN?: string;        // @deprecated 迁移到用户实时登录系统
  ADMIN_TOKEN?: string;       // 后台管理 token
  AI_PROVIDER?: string;       // @deprecated
  AI_API_KEY?: string;        // @deprecated
  CF_AIG_TOKEN?: string;      // Cloudflare AI Gateway 认证 token
  // currentUser 由鉴权中间件注入
  currentUser?: User;
}

// ============================================================
// Story Elf Session
// ============================================================
export interface ElfSession {
  id: string;
  user_token: string;
  work_id: string;
  page: string;           // 'read' | 'write'
  title: string;
  status: string;         // 'active' | 'archived'
  message_count: number;
  created_at: string;
  updated_at: string;
}
