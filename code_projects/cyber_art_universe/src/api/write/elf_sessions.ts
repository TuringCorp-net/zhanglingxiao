// Story Elf Session API Handler（薄层）
// 校验 auth + 参数 → 委托 L2 session.ts 执行实际操作

import { Env } from '../../db/schema';
import { jsonSuccess, jsonError } from '../../lib/response';
import { ErrorCodes } from '../../lib/errors';
import {
  createSession,
  listSessions,
  getSession,
  archiveSession,
} from '../../lib/l2/session';

/** 从 Authorization header 提取完整 user_token */
function extractFullUserToken(request: Request): string {
  const auth = request.headers.get('Authorization') || '';
  return auth.startsWith('Bearer ') ? auth.slice(7) : '';
}

/** 校验作品归属权 */
async function checkWorkOwnership(env: Env, workId: string, userToken: string): Promise<boolean> {
  const work = await env.DB.prepare(
    'SELECT id, user_token FROM works WHERE id = ?'
  ).bind(workId).first<{ id: string; user_token: string }>();
  if (!work) return false;
  const isAdmin = userToken === env.ADMIN_TOKEN?.trim();
  if (!isAdmin && work.user_token && work.user_token !== userToken) return false;
  return true;
}

// ============================================================
// POST /api/write/elf/sessions — 创建 Session
// ============================================================
export async function handleCreateSession(env: Env, request: Request): Promise<Response> {
  const userToken = extractFullUserToken(request);
  if (!userToken) {
    return new Response(JSON.stringify(jsonError(ErrorCodes.AUTH_REQUIRED, 'Authentication required')), {
      status: 401, headers: { 'Content-Type': 'application/json' },
    });
  }

  const body = await request.json() as { work_id?: string; page?: string; title?: string };
  if (!body.work_id) {
    return new Response(JSON.stringify(jsonError(ErrorCodes.MISSING_REQUIRED_FIELD, 'work_id is required')), {
      status: 400, headers: { 'Content-Type': 'application/json' },
    });
  }

  const owned = await checkWorkOwnership(env, body.work_id, userToken);
  if (!owned) {
    return new Response(JSON.stringify(jsonError(ErrorCodes.WORK_NOT_FOUND, 'Work not found')), {
      status: 404, headers: { 'Content-Type': 'application/json' },
    });
  }

  const session = await createSession(env, userToken, body.work_id, body.page || 'write', body.title);
  return new Response(JSON.stringify(jsonSuccess(session)), {
    status: 201, headers: { 'Content-Type': 'application/json' },
  });
}

// ============================================================
// GET /api/write/elf/sessions — 列出 Session
// ============================================================
export async function handleListSessions(env: Env, request: Request): Promise<Response> {
  const userToken = extractFullUserToken(request);
  if (!userToken) {
    return new Response(JSON.stringify(jsonError(ErrorCodes.AUTH_REQUIRED, 'Authentication required')), {
      status: 401, headers: { 'Content-Type': 'application/json' },
    });
  }

  const url = new URL(request.url);
  const sessions = await listSessions(
    env, userToken,
    url.searchParams.get('work_id') || undefined,
    url.searchParams.get('status') || undefined,
  );

  return new Response(JSON.stringify(jsonSuccess(sessions)), {
    headers: { 'Content-Type': 'application/json' },
  });
}

// ============================================================
// GET /api/write/elf/sessions/{id} — 获取 Session（含完整 messages）
// ============================================================
export async function handleGetSession(env: Env, request: Request, sessionId: string): Promise<Response> {
  const userToken = extractFullUserToken(request);
  if (!userToken) {
    return new Response(JSON.stringify(jsonError(ErrorCodes.AUTH_REQUIRED, 'Authentication required')), {
      status: 401, headers: { 'Content-Type': 'application/json' },
    });
  }

  const result = await getSession(env, userToken, sessionId);
  if (!result) {
    return new Response(JSON.stringify(jsonError(ErrorCodes.NOT_FOUND, 'Session not found')), {
      status: 404, headers: { 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify(jsonSuccess({
    ...result.session,
    messages: result.messages,
  })), {
    headers: { 'Content-Type': 'application/json' },
  });
}

// ============================================================
// POST /api/write/elf/sessions/{id}/archive — 归档 Session
// ============================================================
export async function handleArchiveSession(env: Env, request: Request, sessionId: string): Promise<Response> {
  const userToken = extractFullUserToken(request);
  if (!userToken) {
    return new Response(JSON.stringify(jsonError(ErrorCodes.AUTH_REQUIRED, 'Authentication required')), {
      status: 401, headers: { 'Content-Type': 'application/json' },
    });
  }

  const session = await archiveSession(env, userToken, sessionId);
  if (!session) {
    return new Response(JSON.stringify(jsonError(ErrorCodes.NOT_FOUND, 'Session not found')), {
      status: 404, headers: { 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify(jsonSuccess(session)), {
    headers: { 'Content-Type': 'application/json' },
  });
}
