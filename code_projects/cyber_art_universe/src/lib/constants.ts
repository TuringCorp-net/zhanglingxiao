// 共享常量

// 分页参数默认值
export const DEFAULT_PAGE = 1;
export const DEFAULT_LIMIT_SMALL = 20;
export const DEFAULT_LIMIT_MEDIUM = 50;
export const DEFAULT_LIMIT_LARGE = 100;
export const MAX_LIMIT = 100;

/**
 * 解析分页参数
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
 * 解析简单 limit 参数
 */
export function parseLimit(url: URL, defaultLimit: number = DEFAULT_LIMIT_SMALL): number {
  return Math.min(MAX_LIMIT, Math.max(1, parseInt(url.searchParams.get('limit') || String(defaultLimit))));
}
