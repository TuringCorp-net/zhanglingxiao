// Error codes per SRS F-040-05

export const ErrorCodes = {
  INVALID_PARAMS: 'INVALID_PARAMS',
  NOT_FOUND: 'NOT_FOUND',
  ALREADY_SUBSCRIBED: 'ALREADY_SUBSCRIBED',
  NOT_SUBSCRIBED: 'NOT_SUBSCRIBED',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const;

export type ErrorCode = typeof ErrorCodes[keyof typeof ErrorCodes];

export const ErrorMessages: Record<ErrorCode, string> = {
  [ErrorCodes.INVALID_PARAMS]: 'Invalid parameters provided',
  [ErrorCodes.NOT_FOUND]: 'Resource not found',
  [ErrorCodes.ALREADY_SUBSCRIBED]: 'Already subscribed',
  [ErrorCodes.NOT_SUBSCRIBED]: 'Not subscribed',
  [ErrorCodes.INTERNAL_ERROR]: 'Internal server error',
};
