// 错误码系统

export const ErrorCodes = {
  // 通用错误
  INVALID_PARAMS: 'INVALID_PARAMS',
  NOT_FOUND: 'NOT_FOUND',
  ALREADY_SUBSCRIBED: 'ALREADY_SUBSCRIBED',
  NOT_SUBSCRIBED: 'NOT_SUBSCRIBED',
  INTERNAL_ERROR: 'INTERNAL_ERROR',

  // 认证 & 授权
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  ADMIN_KEY_REQUIRED: 'ADMIN_KEY_REQUIRED',

  // 资源冲突
  DUPLICATE_ENTRY: 'DUPLICATE_ENTRY',
  RESOURCE_CONFLICT: 'RESOURCE_CONFLICT',

  // 验证错误
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  MISSING_REQUIRED_FIELD: 'MISSING_REQUIRED_FIELD',
  INVALID_STATUS_TRANSITION: 'INVALID_STATUS_TRANSITION',
  INVALID_CONTENT_TYPE: 'INVALID_CONTENT_TYPE',

  // 限流
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
  QUOTA_EXCEEDED: 'QUOTA_EXCEEDED',

  // 外部服务错误
  EXTERNAL_SERVICE_ERROR: 'EXTERNAL_SERVICE_ERROR',
  AI_SERVICE_UNAVAILABLE: 'AI_SERVICE_UNAVAILABLE',

  // 业务逻辑 — 内容相关
  WORK_NOT_FOUND: 'WORK_NOT_FOUND',
  SECTION_NOT_FOUND: 'SECTION_NOT_FOUND',
  ENTITY_NOT_FOUND: 'ENTITY_NOT_FOUND',
  SUBSCRIPTION_NOT_FOUND: 'SUBSCRIPTION_NOT_FOUND',
  RANKING_NOT_FOUND: 'RANKING_NOT_FOUND',
  AGENT_NOT_FOUND: 'AGENT_NOT_FOUND',

  // 数据完整性错误
  FOREIGN_KEY_VIOLATION: 'FOREIGN_KEY_VIOLATION',
  REFERENCED_RESOURCE_NOT_FOUND: 'REFERENCED_RESOURCE_NOT_FOUND',
} as const;

export type ErrorCode = typeof ErrorCodes[keyof typeof ErrorCodes];

export const ErrorMessages: Record<ErrorCode, string> = {
  [ErrorCodes.INVALID_PARAMS]: 'Invalid parameters provided',
  [ErrorCodes.NOT_FOUND]: 'Resource not found',
  [ErrorCodes.ALREADY_SUBSCRIBED]: 'Already subscribed',
  [ErrorCodes.NOT_SUBSCRIBED]: 'Not subscribed',
  [ErrorCodes.INTERNAL_ERROR]: 'Internal server error',

  [ErrorCodes.UNAUTHORIZED]: 'Unauthorized access',
  [ErrorCodes.FORBIDDEN]: 'Forbidden',
  [ErrorCodes.ADMIN_KEY_REQUIRED]: 'Admin authorization required',

  [ErrorCodes.DUPLICATE_ENTRY]: 'Duplicate entry',
  [ErrorCodes.RESOURCE_CONFLICT]: 'Resource conflict',

  [ErrorCodes.VALIDATION_ERROR]: 'Validation error',
  [ErrorCodes.MISSING_REQUIRED_FIELD]: 'Missing required field',
  [ErrorCodes.INVALID_STATUS_TRANSITION]: 'Invalid status transition',
  [ErrorCodes.INVALID_CONTENT_TYPE]: 'Invalid content type',

  [ErrorCodes.RATE_LIMIT_EXCEEDED]: 'Rate limit exceeded',
  [ErrorCodes.QUOTA_EXCEEDED]: 'Quota exceeded',

  [ErrorCodes.EXTERNAL_SERVICE_ERROR]: 'External service error',
  [ErrorCodes.AI_SERVICE_UNAVAILABLE]: 'AI service unavailable',

  [ErrorCodes.WORK_NOT_FOUND]: 'Work not found',
  [ErrorCodes.SECTION_NOT_FOUND]: 'Section not found',
  [ErrorCodes.ENTITY_NOT_FOUND]: 'Entity not found',
  [ErrorCodes.SUBSCRIPTION_NOT_FOUND]: 'Subscription not found',
  [ErrorCodes.RANKING_NOT_FOUND]: 'Ranking not found',
  [ErrorCodes.AGENT_NOT_FOUND]: 'Agent not found',

  [ErrorCodes.FOREIGN_KEY_VIOLATION]: 'Foreign key constraint violation',
  [ErrorCodes.REFERENCED_RESOURCE_NOT_FOUND]: 'Referenced resource not found',
};
