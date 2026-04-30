// 共享常量定义 - 用于消除代码重复（P2-1, P2-2优化）
// 注意：此文件为P2优化项，不影响功能正确性

// ============================================================
// F-015 行为推荐权重常量
// ============================================================

// 行为权重（F-015-01评分公式）
export const BEHAVIOR_WEIGHT_CLICK = 1;
export const BEHAVIOR_WEIGHT_FAVORITE = 5;
export const BEHAVIOR_WEIGHT_SAVE = 3;
export const BEHAVIOR_WEIGHT_DISLIKE = 8;

// 时间衰减常数（30天衰减至20%）
export const BEHAVIOR_DECAY_LAMBDA = 0.1;

// 冷启动阈值（<5次行为 → 纯规则推荐）
export const COLD_START_THRESHOLD = 5;

// 协同过滤阈值
export const COLLAB_USER_MIN = 100;
export const COLLAB_TAG_MIN_USERS = 10;

// ============================================================
// F-014 规则推荐权重常量
// ============================================================

// 规则推荐评分权重（recommendations.ts注释公式）
export const RULE_CATEGORY_MATCH = 10;
export const RULE_TAG_MATCH = 3;
export const RULE_CLICK_WEIGHT = 1;
export const RULE_FAVORITE_WEIGHT = 2;
export const RULE_PRICE_MATCH = 5;
export const RULE_RECENCY_DAYS = 0.1;
export const RULE_RECENCY_MAX_DAYS = 7; // 最大7天新鲜度加成

// ============================================================
// F-015 行为+规则混合推荐权重
// ============================================================

export const RULE_WEIGHT = 0.6;      // 规则推荐权重
export const BEHAVIOR_WEIGHT = 0.4;  // 行为推荐权重

// ============================================================
// MMR多样性控制常量（F-015-04）
// ============================================================

export const MMR_SUB_CATEGORY_RATIO = 0.3;  // 同一subcategory商品≤30%
export const MMR_MIN_TAGS = 3;               // 覆盖至少3个不同标签
export const MMR_TIMEOUT_MS = 50;            // 计算超时预算≤50ms

// ============================================================
// 分页参数默认值
// ============================================================

export const DEFAULT_PAGE = 1;
export const DEFAULT_LIMIT_SMALL = 20;
export const DEFAULT_LIMIT_MEDIUM = 50;
export const DEFAULT_LIMIT_LARGE = 100;
export const MAX_LIMIT = 100;

// ============================================================
// URL参数解析辅助函数
// ============================================================

/**
 * 解析分页参数
 * @param url URL对象
 * @param defaultLimit 默认每页数量
 * @returns 分页参数 { page, limit, offset }
 */
export function parsePagination(url: URL, defaultLimit: number = DEFAULT_LIMIT_SMALL): {
  page: number;
  limit: number;
  offset: number;
} {
  const page = Math.max(1, parseInt(url.searchParams.get('page') || String(DEFAULT_PAGE)));
  const limit = Math.min(MAX_LIMIT, Math.max(1, parseInt(url.searchParams.get('limit') || String(defaultLimit))));
  const offset = (page - 1) * limit;
  return { page, limit, offset };
}

/**
 * 解析简单限制参数（只有limit，没有page）
 * @param url URL对象
 * @param defaultLimit 默认限制数量
 * @returns 限制数量
 */
export function parseLimit(url: URL, defaultLimit: number = DEFAULT_LIMIT_SMALL): number {
  return Math.min(MAX_LIMIT, Math.max(1, parseInt(url.searchParams.get('limit') || String(defaultLimit))));
}
