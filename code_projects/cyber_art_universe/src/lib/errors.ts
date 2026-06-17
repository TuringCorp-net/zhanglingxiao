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
  AUTH_REQUIRED: 'AUTH_REQUIRED',

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

  // 用户账户 — Phase 0
  CYBER_NAME_TAKEN: 'CYBER_NAME_TAKEN',
  EMAIL_ALREADY_REGISTERED: 'EMAIL_ALREADY_REGISTERED',
  INVALID_CYBER_NAME: 'INVALID_CYBER_NAME',
  INVALID_KEY: 'INVALID_KEY',
  INVALID_EMAIL: 'INVALID_EMAIL',
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  INVALID_CODE: 'INVALID_CODE',
  CODE_EXPIRED: 'CODE_EXPIRED',
  TOO_MANY_ATTEMPTS: 'TOO_MANY_ATTEMPTS',
  ALREADY_VERIFIED: 'ALREADY_VERIFIED',
  EMAIL_NOT_VERIFIED: 'EMAIL_NOT_VERIFIED',
  TOKEN_REVOKED: 'TOKEN_REVOKED',
  USER_NOT_FOUND: 'USER_NOT_FOUND',

  // 互动 — Phase 1
  ENERGY_INSUFFICIENT: 'ENERGY_INSUFFICIENT',
  CANNOT_APPLAUD_SELF: 'CANNOT_APPLAUD_SELF',
  ALREADY_LIKED: 'ALREADY_LIKED',
  ALREADY_APPLAUDED: 'ALREADY_APPLAUDED',

  // 业务逻辑 — 内容相关
  WORK_NOT_FOUND: 'WORK_NOT_FOUND',
  SECTION_NOT_FOUND: 'SECTION_NOT_FOUND',
  WORK_NOT_PUBLISHABLE: 'WORK_NOT_PUBLISHABLE',
  WORK_STATUS_CONFLICT: 'WORK_STATUS_CONFLICT',
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
  [ErrorCodes.AUTH_REQUIRED]: 'Authentication required',

  [ErrorCodes.DUPLICATE_ENTRY]: 'Duplicate entry',
  [ErrorCodes.RESOURCE_CONFLICT]: 'Resource conflict',

  [ErrorCodes.VALIDATION_ERROR]: 'Validation error',
  [ErrorCodes.MISSING_REQUIRED_FIELD]: 'Missing required field',
  [ErrorCodes.INVALID_STATUS_TRANSITION]: 'Invalid status transition',
  [ErrorCodes.INVALID_CONTENT_TYPE]: 'Invalid content type',

  [ErrorCodes.CYBER_NAME_TAKEN]: 'Cyber Name is already taken',
  [ErrorCodes.EMAIL_ALREADY_REGISTERED]: 'Email is already registered',
  [ErrorCodes.INVALID_CYBER_NAME]: 'Invalid Cyber Name format',
  [ErrorCodes.INVALID_KEY]: 'Invalid key format',
  [ErrorCodes.INVALID_EMAIL]: 'Invalid email format',
  [ErrorCodes.INVALID_CREDENTIALS]: 'Invalid Cyber Name or key',
  [ErrorCodes.INVALID_CODE]: 'Invalid verification code',
  [ErrorCodes.CODE_EXPIRED]: 'Verification code has expired',
  [ErrorCodes.TOO_MANY_ATTEMPTS]: 'Too many attempts, please request a new code',
  [ErrorCodes.ALREADY_VERIFIED]: 'Email is already verified',
  [ErrorCodes.EMAIL_NOT_VERIFIED]: 'Email not verified',
  [ErrorCodes.TOKEN_REVOKED]: 'Token has been revoked',
  [ErrorCodes.USER_NOT_FOUND]: 'User not found',

  [ErrorCodes.ENERGY_INSUFFICIENT]: 'Insufficient energy',
  [ErrorCodes.CANNOT_APPLAUD_SELF]: 'Cannot applaud yourself',
  [ErrorCodes.ALREADY_LIKED]: 'Already liked',
  [ErrorCodes.ALREADY_APPLAUDED]: 'Already applauded',

  [ErrorCodes.RATE_LIMIT_EXCEEDED]: 'Rate limit exceeded',
  [ErrorCodes.QUOTA_EXCEEDED]: 'Quota exceeded',

  [ErrorCodes.EXTERNAL_SERVICE_ERROR]: 'External service error',
  [ErrorCodes.AI_SERVICE_UNAVAILABLE]: 'AI service unavailable',

  [ErrorCodes.WORK_NOT_FOUND]: 'Work not found',
  [ErrorCodes.SECTION_NOT_FOUND]: 'Section not found',
  [ErrorCodes.WORK_NOT_PUBLISHABLE]: 'Work does not meet publish requirements',
  [ErrorCodes.WORK_STATUS_CONFLICT]: 'Invalid status transition for this work',
  [ErrorCodes.ENTITY_NOT_FOUND]: 'Entity not found',
  [ErrorCodes.SUBSCRIPTION_NOT_FOUND]: 'Subscription not found',
  [ErrorCodes.RANKING_NOT_FOUND]: 'Ranking not found',
  [ErrorCodes.AGENT_NOT_FOUND]: 'Agent not found',

  [ErrorCodes.FOREIGN_KEY_VIOLATION]: 'Foreign key constraint violation',
  [ErrorCodes.REFERENCED_RESOURCE_NOT_FOUND]: 'Referenced resource not found',
};
