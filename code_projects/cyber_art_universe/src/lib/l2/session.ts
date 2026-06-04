// L2: Session Manager
// 负责 Session 全生命周期管理：创建、恢复、持久化、归档
// 编排层：加载 Session → 调 agentLoop → 保存结果
//
// API 层（elf_chat.ts / elf_sessions.ts）通过本模块操作 Session，
// 不直接接触 R2 路径和 D1 表结构。

import { Env, ElfSession } from '../../db/schema';
import type { Message } from '../l0/aiGateway';
import { agentLoop, type AgentLoopResult } from './agent';
import type { AgentLoopOptions } from './types';
import type { WorkMeta } from '../l1/types';

// ============================================================
// R2 路径
// ============================================================

function sessionMessagesKey(userToken: string, sessionId: string): string {
  return `users/${userToken}/elf-sessions/${sessionId}/messages.json`;
}

// ============================================================
// Session CRUD
// ============================================================

/** 创建新 Session（仅 D1 元信息，messages 在首次对话后由 continueSession 写入 R2） */
export async function createSession(
  env: Env,
  userToken: string,
  workId: string,
  page: string,
  title?: string,
): Promise<ElfSession> {
  const sessionId = crypto.randomUUID();
  const now = new Date().toISOString();

  await env.DB.prepare(
    'INSERT INTO elf_sessions (id, user_token, work_id, page, title, status, message_count, created_at, updated_at) VALUES (?, ?, ?, ?, ?, \'active\', 0, ?, ?)'
  ).bind(sessionId, userToken, workId, page, title || '', now, now).run();

  return {
    id: sessionId,
    user_token: userToken,
    work_id: workId,
    page,
    title: title || '',
    status: 'active',
    message_count: 0,
    created_at: now,
    updated_at: now,
  };
}

/** 列出 Session（按 updated_at 倒序） */
export async function listSessions(
  env: Env,
  userToken: string,
  workId?: string,
  status?: string,
): Promise<ElfSession[]> {
  let sql = 'SELECT id, user_token, work_id, page, title, status, message_count, created_at, updated_at FROM elf_sessions WHERE user_token = ?';
  const params: string[] = [userToken];

  if (workId) { sql += ' AND work_id = ?'; params.push(workId); }
  if (status) { sql += ' AND status = ?'; params.push(status); }
  sql += ' ORDER BY updated_at DESC';

  const result = await env.DB.prepare(sql).bind(...params).all();
  return (result.results || []) as ElfSession[];
}

/** 获取 Session 元信息 + 完整 messages 数组 */
export async function getSession(
  env: Env,
  userToken: string,
  sessionId: string,
): Promise<{ session: ElfSession; messages: Message[] } | null> {
  const session = await env.DB.prepare(
    'SELECT id, user_token, work_id, page, title, status, message_count, created_at, updated_at FROM elf_sessions WHERE id = ? AND user_token = ?'
  ).bind(sessionId, userToken).first<ElfSession>();

  if (!session) return null;

  let messages: Message[] = [];
  try {
    const obj = await env.WORKS_BUCKET.get(sessionMessagesKey(userToken, sessionId));
    if (obj) messages = JSON.parse(await obj.text());
  } catch { /* R2 文件不存在 → 空数组 */ }

  return { session, messages };
}

/** 归档 Session（软删除，数据保留用于记忆提取） */
export async function archiveSession(
  env: Env,
  userToken: string,
  sessionId: string,
): Promise<ElfSession | null> {
  const session = await env.DB.prepare(
    'SELECT id, status FROM elf_sessions WHERE id = ? AND user_token = ?'
  ).bind(sessionId, userToken).first<{ id: string; status: string }>();

  if (!session) return null;
  if (session.status === 'archived') return null; // 已归档，幂等返回

  const now = new Date().toISOString();
  await env.DB.prepare(
    'UPDATE elf_sessions SET status = \'archived\', updated_at = ? WHERE id = ?'
  ).bind(now, sessionId).run();

  return (await env.DB.prepare(
    'SELECT id, user_token, work_id, page, title, status, message_count, created_at, updated_at FROM elf_sessions WHERE id = ?'
  ).bind(sessionId).first()) as ElfSession;
}

// ============================================================
// Session 内部操作（供 continueSession 使用）
// ============================================================

async function loadSessionMessages(env: Env, userToken: string, sessionId: string): Promise<Message[] | null> {
  try {
    const obj = await env.WORKS_BUCKET.get(sessionMessagesKey(userToken, sessionId));
    if (!obj) return null;
    return JSON.parse(await obj.text()) as Message[];
  } catch {
    return null;
  }
}

async function saveSessionMessages(env: Env, userToken: string, sessionId: string, messages: Message[]): Promise<void> {
  await env.WORKS_BUCKET.put(sessionMessagesKey(userToken, sessionId), JSON.stringify(messages), {
    httpMetadata: { contentType: 'application/json' },
  });
}

async function updateSessionMeta(env: Env, sessionId: string, messages: Message[]): Promise<void> {
  const firstUser = messages.find((m: Message) => m.role === 'user');
  const title = firstUser ? (firstUser.content || '').substring(0, 30) : '';
  if (title) {
    await env.DB.prepare(
      'UPDATE elf_sessions SET message_count = message_count + 1, updated_at = datetime(\'now\'), title = ? WHERE id = ?'
    ).bind(title, sessionId).run();
  } else {
    await env.DB.prepare(
      'UPDATE elf_sessions SET message_count = message_count + 1, updated_at = datetime(\'now\') WHERE id = ?'
    ).bind(sessionId).run();
  }
}

// ============================================================
// 对话回合编排
// ============================================================

/**
 * 继续一个 Session 对话：
 * 1. 尝试从 R2 加载已存储的 messages[]
 * 2. 如果 messages[0] 是 system → 提取为 preBuiltSystemPrompt（复用 ImmutablePrefix）
 * 3. 调 agentLoop 执行 AI 循环
 * 4. 持久化新的 messages[] 到 R2 + 更新 D1 元信息
 */
export async function continueSession(
  env: Env,
  workMeta: WorkMeta,
  contextPkg: string,
  opts: AgentLoopOptions,
  conversationHistory: Message[],
  userMessage: string,
): Promise<AgentLoopResult> {
  // 1. 尝试加载已存储的 System Prompt（存在于 messages[0]，天然位置，无需特殊处理）
  let preBuiltSystemPrompt: string | undefined;
  if (opts.sessionId && opts.userToken) {
    const storedMessages = await loadSessionMessages(env, opts.userToken, opts.sessionId);
    if (storedMessages && storedMessages.length > 0 && storedMessages[0].role === 'system') {
      preBuiltSystemPrompt = storedMessages[0].content;
    }
  }

  // 2. 执行 Agent 循环（纯函数，不感知 Session）
  const result = await agentLoop(env, workMeta, contextPkg, opts, conversationHistory, userMessage, preBuiltSystemPrompt);

  // 3. 持久化完整 messages 数组到 R2 + 更新 D1
  if (opts.sessionId && opts.userToken) {
    try {
      await saveSessionMessages(env, opts.userToken, opts.sessionId, result.messages);
      await updateSessionMeta(env, opts.sessionId, result.messages);
    } catch (err) {
      console.error('[session] 持久化失败:', (err as Error).message);
    }
  }

  return result;
}
