// Response helpers - per SRS F-040-04

export interface SuccessMeta {
  page?: number;
  total?: number;
  [key: string]: unknown;
}

export interface SuccessResponse<T = unknown> {
  ok: true;
  data: T;
  meta?: SuccessMeta;
}

export interface ErrorResponse {
  ok: false;
  error: {
    code: string;
    message: string;
  };
}

export function jsonSuccess<T>(data: T, meta?: SuccessMeta): SuccessResponse<T> {
  return { ok: true, data, meta };
}

export function jsonError(code: string, message: string): ErrorResponse {
  return { ok: false, error: { code, message } };
}

export function parseJSON<T>(value: string, fallback: T): T {
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}
