// Error codes per SRS F-040-05
// M-02: Expanded from 5 to 15+ error codes for better error handling

export const ErrorCodes = {
  // General errors
  INVALID_PARAMS: 'INVALID_PARAMS',
  NOT_FOUND: 'NOT_FOUND',
  ALREADY_SUBSCRIBED: 'ALREADY_SUBSCRIBED',
  NOT_SUBSCRIBED: 'NOT_SUBSCRIBED',
  INTERNAL_ERROR: 'INTERNAL_ERROR',

  // Authentication & Authorization
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  ADMIN_KEY_REQUIRED: 'ADMIN_KEY_REQUIRED',

  // Resource conflicts
  DUPLICATE_ENTRY: 'DUPLICATE_ENTRY',
  RESOURCE_CONFLICT: 'RESOURCE_CONFLICT',
  EMAIL_ALREADY_EXISTS: 'EMAIL_ALREADY_EXISTS',
  TAG_ALREADY_EXISTS: 'TAG_ALREADY_EXISTS',
  SLUG_ALREADY_EXISTS: 'SLUG_ALREADY_EXISTS',

  // Validation errors
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  MISSING_REQUIRED_FIELD: 'MISSING_REQUIRED_FIELD',
  INVALID_STATUS_TRANSITION: 'INVALID_STATUS_TRANSITION',
  INVALID_CONTENT_TYPE: 'INVALID_CONTENT_TYPE',
  DISCLOSURE_REQUIRED: 'DISCLOSURE_REQUIRED',

  // Rate limiting & quotas
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
  QUOTA_EXCEEDED: 'QUOTA_EXCEEDED',

  // External service errors
  EXTERNAL_SERVICE_ERROR: 'EXTERNAL_SERVICE_ERROR',
  AI_SERVICE_UNAVAILABLE: 'AI_SERVICE_UNAVAILABLE',
  EMAIL_SERVICE_ERROR: 'EMAIL_SERVICE_ERROR',

  // Business logic errors
  TOPIC_NOT_APPROVED: 'TOPIC_NOT_APPROVED',
  NO_PRODUCTS_SELECTED: 'NO_PRODUCTS_SELECTED',
  INSUFFICIENT_PERMISSIONS: 'INSUFFICIENT_PERMISSIONS',
  MEMBERSHIP_REQUIRED: 'MEMBERSHIP_REQUIRED',
  TIER_ACCESS_DENIED: 'TIER_ACCESS_DENIED',

  // Data integrity errors
  FOREIGN_KEY_VIOLATION: 'FOREIGN_KEY_VIOLATION',
  REFERENCED_RESOURCE_NOT_FOUND: 'REFERENCED_RESOURCE_NOT_FOUND',
} as const;

export type ErrorCode = typeof ErrorCodes[keyof typeof ErrorCodes];

export const ErrorMessages: Record<ErrorCode, string> = {
  // General errors
  [ErrorCodes.INVALID_PARAMS]: 'Invalid parameters provided',
  [ErrorCodes.NOT_FOUND]: 'Resource not found',
  [ErrorCodes.ALREADY_SUBSCRIBED]: 'Already subscribed',
  [ErrorCodes.NOT_SUBSCRIBED]: 'Not subscribed',
  [ErrorCodes.INTERNAL_ERROR]: 'Internal server error',

  // Authentication & Authorization
  [ErrorCodes.UNAUTHORIZED]: 'Unauthorized access',
  [ErrorCodes.FORBIDDEN]: 'Forbidden',
  [ErrorCodes.ADMIN_KEY_REQUIRED]: 'Admin authorization required',

  // Resource conflicts
  [ErrorCodes.DUPLICATE_ENTRY]: 'Duplicate entry',
  [ErrorCodes.RESOURCE_CONFLICT]: 'Resource conflict',
  [ErrorCodes.EMAIL_ALREADY_EXISTS]: 'Email already exists',
  [ErrorCodes.TAG_ALREADY_EXISTS]: 'Tag already exists',
  [ErrorCodes.SLUG_ALREADY_EXISTS]: 'Slug already exists',

  // Validation errors
  [ErrorCodes.VALIDATION_ERROR]: 'Validation error',
  [ErrorCodes.MISSING_REQUIRED_FIELD]: 'Missing required field',
  [ErrorCodes.INVALID_STATUS_TRANSITION]: 'Invalid status transition',
  [ErrorCodes.INVALID_CONTENT_TYPE]: 'Invalid content type',
  [ErrorCodes.DISCLOSURE_REQUIRED]: 'Disclosure declaration required for affiliate or sponsored content',

  // Rate limiting & quotas
  [ErrorCodes.RATE_LIMIT_EXCEEDED]: 'Rate limit exceeded',
  [ErrorCodes.QUOTA_EXCEEDED]: 'Quota exceeded',

  // External service errors
  [ErrorCodes.EXTERNAL_SERVICE_ERROR]: 'External service error',
  [ErrorCodes.AI_SERVICE_UNAVAILABLE]: 'AI service unavailable',
  [ErrorCodes.EMAIL_SERVICE_ERROR]: 'Email service error',

  // Business logic errors
  [ErrorCodes.TOPIC_NOT_APPROVED]: 'Topic must be in approved status to publish',
  [ErrorCodes.NO_PRODUCTS_SELECTED]: 'No products selected',
  [ErrorCodes.INSUFFICIENT_PERMISSIONS]: 'Insufficient permissions',
  [ErrorCodes.MEMBERSHIP_REQUIRED]: 'Membership required for this action',
  [ErrorCodes.TIER_ACCESS_DENIED]: 'Your membership tier does not allow this action',

  // Data integrity errors
  [ErrorCodes.FOREIGN_KEY_VIOLATION]: 'Foreign key constraint violation',
  [ErrorCodes.REFERENCED_RESOURCE_NOT_FOUND]: 'Referenced resource not found',
};
