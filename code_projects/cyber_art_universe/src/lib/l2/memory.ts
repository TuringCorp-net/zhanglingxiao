// L2: 记忆系统核心
// 三级记忆模型：L1 瞬时（Memory Log）→ L2 短期（STM final）→ L3 长期（LTM final）
// 设计文档：docs/story_elf/original_concept.md §agent memory
//
// 存储模型（v2 — PUT 全量快照，与 saveConversation 对称）：
// - L1: 每次对话结束 → PUT 覆盖当日 memory-logs/{page}/{workId}/{date}.json
//       内容是 agentFinal.messages（经 mosaicCompress 压缩后的完整对话快照）
// - STM：每天凌晨 3:00，读近 1-2 日 L1 + 现有 stm-final.md → LLM 合并
//        → stm-final.md + stm-memory/{date}.md
// - LTM：每 3 天一次，读近 3 日 STM 存档 + 现有 ltm-final.md → LLM 合并
//        → ltm-final.md + ltm-memory/{date}.md
//
// 提取追踪（日期级别，不嵌入数据文件）：
// - stm/.stm-processed.json：哪些日期的 L1 已被 STM 处理
// - stm/.ltm-processed.json：哪些日期的 STM 存档已被 LTM 处理

import { Env } from '../../db/schema';
import { callAI, type Message } from '../l0/aiGateway';
import stmPrompt from './prompts/memory_stm/system.md';
import ltmPrompt from './prompts/memory_ltm/system.md';

// ============================================================
// 类型
// ============================================================

/** L1 日志文件存储结构 */
interface MemoryLogFile {
  work_title: string;
  messages: Message[];
}

/** 日期追踪状态（STM/LTM 共用结构） */
interface ProcessedDatesState {
  processed_dates: string[];  // YYYY-MM-DD
}

/** LTM 提取时间状态（用于 ≥3 天触发判断） */
interface ExtractionState {
  last_l3_extraction: string;
}

// ============================================================
// L1: 保存每日日志（PUT 覆盖，与 saveConversation 对称）
// ============================================================

/**
 * 保存当日对话快照到 L1 Memory Log（PUT 覆盖模式）。
 * 内容是 agentFinal.messages（经 mosaicCompress 压缩后的完整对话），
 * 每次对话结束覆盖当日文件，始终保持最新状态。
 *
 * 在 elf_chat.ts 的 Agent 循环结束后调用。
 */
export async function saveDailyLog(
  env: Env,
  userToken: string,
  page: string,
  workId: string,
  workTitle: string,
  messages: Message[],
): Promise<void> {
  const today = new Date().toISOString().slice(0, 10);
  const path = `users/${userToken}/memory-logs/${page}/${workId}/${today}.json`;

  const data: MemoryLogFile = { work_title: workTitle, messages };

  try {
    await env.WORKS_BUCKET.put(path, JSON.stringify(data), {
      httpMetadata: { contentType: 'application/json' },
    });
  } catch (err) {
    console.error('[memory] L1 daily log save failed:', (err as Error).message);
  }
}

// ============================================================
// L1→L2: 短期记忆增量合并（每天执行）
// ============================================================

/**
 * 为单个用户执行 STM 提取（per-user，供 fan-out 架构调用）。
 * 扫描该用户近 1-2 天未被 STM 处理过的 L1 文件，合并到 stm-final.md。
 */
export async function extractSTMForUser(env: Env, userToken: string): Promise<{
  sessions_extracted: number;
}> {
  const today = new Date();
  const dates = [
    today.toISOString().slice(0, 10),
    new Date(today.getTime() - 86400000).toISOString().slice(0, 10),
  ];

  try {
    // 获取已处理的日期
    const processedDates = await getSTMProcessedDates(env, userToken);

    // 读取未处理的 L1 文件
    const l1Contents: string[] = [];
    for (const date of dates) {
      if (processedDates.includes(date)) continue;
      try {
        const keys = await findL1KeysForDate(env, userToken, date);
        for (const key of keys) {
          const obj = await env.WORKS_BUCKET.get(key);
          if (!obj) continue;
          const log: MemoryLogFile = JSON.parse(await obj.text());
          l1Contents.push(formatMessagesForSTM(log.messages, date, log.work_title));
        }
      } catch { /* 该日期无 L1 或读取失败，跳过 */ }
    }

    if (l1Contents.length === 0) return { sessions_extracted: 0 };

    const existingSTM = await readSTMFinal(env, userToken);
    const newSTM = await runSTMMerge(env, l1Contents.join('\n\n---\n\n'), existingSTM);
    if (!newSTM) return { sessions_extracted: 0 };

    // 写入 STM final + 按日存档
    await env.WORKS_BUCKET.put(
      `users/${userToken}/stm/stm-final.md`,
      newSTM,
      { httpMetadata: { contentType: 'text/markdown; charset=utf-8' } },
    );
    const todayStr = today.toISOString().slice(0, 10);
    await env.WORKS_BUCKET.put(
      `users/${userToken}/stm/stm-memory/${todayStr}.md`,
      newSTM,
      { httpMetadata: { contentType: 'text/markdown; charset=utf-8' } },
    );

    // 标记已处理
    await markSTMDateAsProcessed(env, userToken, dates.filter(d => !processedDates.includes(d)));

    return { sessions_extracted: l1Contents.length };
  } catch (err) {
    console.error(`[memory] 用户 ${userToken} 的 L1→L2 提取失败:`, (err as Error).message);
    return { sessions_extracted: 0 };
  }
}

/**
 * 为单个用户执行全部记忆处理（STM + LTM）。
 * 供内部 Cron 分发端点调用。
 */
export async function processMemoriesForUser(env: Env, userToken: string): Promise<{
  stm_extracted: boolean;
  ltm_extracted: boolean;
  sessions: number;
}> {
  const stm = await extractSTMForUser(env, userToken);
  const ltm = await extractL2toL3IfDue(env, userToken);
  return {
    stm_extracted: stm.sessions_extracted > 0,
    ltm_extracted: ltm,
    sessions: stm.sessions_extracted,
  };
}

/**
 * Cron 触发（批量模式）：扫描所有活跃用户，串行执行 STM 提取。
 * 保留给 memory-test 端点使用。生产 Cron 请用 processMemoriesForUser + fan-out。
 */
export async function extractL1toL2(env: Env): Promise<{
  users_processed: number;
  sessions_extracted: number;
  users: string[];
}> {
  const today = new Date();
  const dates = [
    today.toISOString().slice(0, 10),
    new Date(today.getTime() - 86400000).toISOString().slice(0, 10),
  ];

  const userTokens = await discoverActiveUsers(env, dates);
  const processedUsers: string[] = [];
  let usersProcessed = 0;
  let sessionsExtracted = 0;

  for (const userToken of userTokens) {
    const result = await extractSTMForUser(env, userToken);
    if (result.sessions_extracted > 0) {
      usersProcessed++;
      sessionsExtracted += result.sessions_extracted;
      processedUsers.push(userToken);
    }
  }

  return { users_processed: usersProcessed, sessions_extracted: sessionsExtracted, users: processedUsers };
}

// ============================================================
// L2→L3: 长期记忆增量合并（每 3 天执行）
// ============================================================

/**
 * 检查 L2→L3 触发条件：距上次 L3 提取 ≥ 3 天。
 * 满足条件时，将近 3 日 STM 存档（stm-memory/{date}.md）+ 现有 ltm-final.md → LLM 合并。
 * 每个 STM 存档最多被 LTM 提取一次（通过 stm/.ltm-processed.json 追踪）。
 */
export async function extractL2toL3IfDue(env: Env, userToken: string): Promise<boolean> {
  const state = await getExtractionState(env, userToken);
  const today = new Date().toISOString().slice(0, 10);

  const daysSinceLast = state.last_l3_extraction
    ? Math.floor((Date.now() - new Date(state.last_l3_extraction).getTime()) / 86400000)
    : 999;

  if (daysSinceLast < 3) return false;

  const dates: string[] = [];
  for (let i = 0; i < 3; i++) {
    dates.push(new Date(Date.now() - i * 86400000).toISOString().slice(0, 10));
  }

  try {
    const processedDates = await getLTMProcessedDates(env, userToken);

    const stmArchives: { date: string; content: string }[] = [];
    for (const date of dates) {
      if (processedDates.includes(date)) continue;
      try {
        const obj = await env.WORKS_BUCKET.get(`users/${userToken}/stm/stm-memory/${date}.md`);
        if (obj) {
          const content = await obj.text();
          if (content.trim().length > 0) {
            stmArchives.push({ date, content: content.trim() });
          }
        }
      } catch { /* 该日期无 STM 存档，跳过 */ }
    }

    if (stmArchives.length === 0) {
      await updateExtractionState(env, userToken, today);
      return false;
    }

    const existingLTM = await readLTMFinal(env, userToken);
    const newLTM = await runLTMMerge(env, stmArchives, existingLTM);
    if (!newLTM) return false;

    await env.WORKS_BUCKET.put(
      `users/${userToken}/ltm/ltm-final.md`,
      newLTM,
      { httpMetadata: { contentType: 'text/markdown; charset=utf-8' } },
    );
    await env.WORKS_BUCKET.put(
      `users/${userToken}/ltm/ltm-memory/${today}.md`,
      newLTM,
      { httpMetadata: { contentType: 'text/markdown; charset=utf-8' } },
    );

    await markLTMDateAsProcessed(env, userToken, stmArchives.map(a => a.date));
    await updateExtractionState(env, userToken, today);
    return true;
  } catch (err) {
    console.error('[memory] L2→L3 提取失败:', (err as Error).message);
    return false;
  }
}

// ============================================================
// L2/L3 读取（供 prompt.ts Layer 5 注入使用）
// ============================================================

export async function readSTMFinal(env: Env, userToken: string): Promise<string> {
  try {
    const obj = await env.WORKS_BUCKET.get(`users/${userToken}/stm/stm-final.md`);
    if (!obj) return '';
    return await obj.text();
  } catch {
    return '';
  }
}

export async function readLTMFinal(env: Env, userToken: string): Promise<string> {
  try {
    const obj = await env.WORKS_BUCKET.get(`users/${userToken}/ltm/ltm-final.md`);
    if (!obj) return '';
    return await obj.text();
  } catch {
    return '';
  }
}

// ============================================================
// Checklist 持久化
// ============================================================

export async function saveChecklist(
  env: Env,
  workId: string,
  todos: { content: string; status: string }[],
): Promise<void> {
  try {
    const path = `works/${workId}/elf_checklist.json`;
    const data = JSON.stringify({
      todos,
      updated_at: new Date().toISOString(),
    }, null, 2);
    await env.WORKS_BUCKET.put(path, data, {
      httpMetadata: { contentType: 'application/json' },
    });
  } catch (err) {
    console.error('[memory] Checklist 保存失败:', (err as Error).message);
  }
}

// ============================================================
// 用户发现
// ============================================================

/** 发现近 N 天有 L1 日志活动的用户（供 Cron fan-out 使用） */
export async function discoverActiveUsers(env: Env, dates: string[]): Promise<string[]> {
  const users = new Set<string>();

  try {
    let cursor: string | undefined;
    do {
      const listed = await env.WORKS_BUCKET.list({ prefix: 'users/', limit: 500, cursor });
      for (const obj of listed.objects) {
        if (!obj.key.includes('/memory-logs/')) continue;
        for (const d of dates) {
          if (obj.key.endsWith(`/${d}.json`)) {
            const parts = obj.key.split('/');
            if (parts.length >= 2 && parts[0] === 'users') {
              users.add(parts[1]);
            }
            break;
          }
        }
      }
      cursor = listed.truncated ? listed.cursor : undefined;
    } while (cursor);
  } catch (err) {
    console.error('[memory] 用户发现失败:', (err as Error).message);
  }

  return Array.from(users);
}

// ============================================================
// 内部函数 — L1 查找与格式化
// ============================================================

/** 查找某用户某日期的所有 L1 文件（可能跨 page/work） */
async function findL1KeysForDate(env: Env, userToken: string, date: string): Promise<string[]> {
  const keys: string[] = [];
  const prefix = `users/${userToken}/memory-logs/`;

  try {
    let cursor: string | undefined;
    do {
      const listed = await env.WORKS_BUCKET.list({ prefix, limit: 200, cursor });
      for (const obj of listed.objects) {
        if (obj.key.endsWith(`/${date}.json`)) {
          keys.push(obj.key);
        }
      }
      cursor = listed.truncated ? listed.cursor : undefined;
    } while (cursor);
  } catch (err) {
    console.error(`[memory] 查找 L1 失败 (${userToken}/${date}):`, (err as Error).message);
  }

  return keys;
}

/**
 * 将 Message[] 格式化为 STM 提取用的可读文本。
 * 直接处理 LLM 原生消息格式。tool 内容已在落盘时被 compactMessages() 截断，
 * 此处直接原样输出即可，无需额外截断。
 */
function formatMessagesForSTM(messages: Message[], date: string, workTitle: string): string {
  const lines: string[] = [];
  lines.push(`## ${date} | 作品: ${workTitle}`);
  lines.push('');

  for (const msg of messages) {
    if (msg.role === 'system') continue;

    switch (msg.role) {
      case 'user':
        lines.push(`**作者**: ${msg.content || ''}`);
        break;
      case 'assistant':
        if (msg.tool_calls && msg.tool_calls.length > 0) {
          for (const tc of msg.tool_calls) {
            lines.push(`_[调用了工具: ${tc.function.name}(${tc.function.arguments})]_`);
          }
        }
        if (msg.content) {
          lines.push(`**Story Elf**: ${msg.content}`);
        }
        break;
      case 'tool':
        // tool result 已被 compactMessages 压缩，对 STM 有参考价值
        if (msg.content && msg.content.length > 0) {
          lines.push(`_[工具结果: ${msg.content.substring(0, 200)}]_`);
        }
        break;
    }
    lines.push('');
  }

  return lines.join('\n');
}

// ============================================================
// LLM 调用：增量合并
// ============================================================

export async function runSTMMerge(
  env: Env,
  l1Content: string,
  existingSTM: string,
): Promise<string | null> {
  const hasExisting = existingSTM.trim().length > 0;
  const today = new Date().toISOString().slice(0, 10);
  const sessionCount = (l1Content.match(/^## \d{4}-\d{2}-\d{2}/gm) || []).length;

  const userPrompt = hasExisting
    ? `以下是现有短期记忆，请结合最新的对话记录进行合并更新。\n\n## 现有短期记忆\n\n${existingSTM.trim()}\n\n---\n\n## 最新对话记录\n\n${l1Content}\n\n请输出合并后的完整短期记忆（${today}，合并了 ${sessionCount} 份日志）。`
    : `以下是最新的对话记录。请从中提取关键信息，生成初始短期记忆。\n\n${l1Content}\n\n请输出完整的短期记忆文件（${today}，来自 ${sessionCount} 份日志）。`;

  try {
    const result = await callAI(env, [
      { role: 'system', content: stmPrompt },
      { role: 'user', content: userPrompt },
    ], { model: 'deepseek-v4-flash' });

    const content = result.content?.trim();
    if (!content || content.length < 20) return null;
    return content;
  } catch (err) {
    console.error('[memory] STM 合并 LLM 调用失败:', (err as Error).message);
    return null;
  }
}

export async function runLTMMerge(
  env: Env,
  stmArchives: { date: string; content: string }[],
  existingLTM: string,
): Promise<string | null> {
  const hasExisting = existingLTM.trim().length > 0;
  const today = new Date().toISOString().slice(0, 10);
  const sorted = [...stmArchives].sort((a, b) => b.date.localeCompare(a.date));

  const stmSections = sorted.map(a =>
    `### ${a.date} 短期记忆\n\n${a.content}`
  ).join('\n\n---\n\n');

  const userPrompt = hasExisting
    ? `以下是现有用户画像，请结合近三日的短期记忆进行合并更新。\n\n## 现有用户画像\n\n${existingLTM.trim()}\n\n---\n\n## 近三日短期记忆\n\n${stmSections}\n\n请输出更新后的完整用户画像（${today}，基于 ${sorted.length} 日的短期记忆）。`
    : `以下是近期的短期记忆。请从中提炼用户的持久创作画像。\n\n${stmSections}\n\n请输出完整的用户画像文件（${today}，基于 ${sorted.length} 日的短期记忆）。`;

  try {
    const result = await callAI(env, [
      { role: 'system', content: ltmPrompt },
      { role: 'user', content: userPrompt },
    ], { model: 'deepseek-v4-flash' });

    const content = result.content?.trim();
    if (!content || content.length < 20) return null;
    return content;
  } catch (err) {
    console.error('[memory] LTM 合并 LLM 调用失败:', (err as Error).message);
    return null;
  }
}

// ============================================================
// 提取追踪 — STM（L1→L2）
// ============================================================

const STM_PROCESSED_PATH = (userToken: string) =>
  `users/${userToken}/stm/.stm-processed.json`;

async function getSTMProcessedDates(env: Env, userToken: string): Promise<string[]> {
  try {
    const obj = await env.WORKS_BUCKET.get(STM_PROCESSED_PATH(userToken));
    if (obj) {
      const state: ProcessedDatesState = JSON.parse(await obj.text());
      return state.processed_dates || [];
    }
  } catch { /* 文件不存在或损坏 */ }
  return [];
}

async function markSTMDateAsProcessed(env: Env, userToken: string, newDates: string[]): Promise<void> {
  try {
    const existing = await getSTMProcessedDates(env, userToken);
    const merged = [...new Set([...existing, ...newDates])].sort().reverse();
    const cutoff = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
    const trimmed = merged.filter(d => d >= cutoff);
    await env.WORKS_BUCKET.put(
      STM_PROCESSED_PATH(userToken),
      JSON.stringify({ processed_dates: trimmed } as ProcessedDatesState),
      { httpMetadata: { contentType: 'application/json' } },
    );
  } catch (err) {
    console.error('[memory] STM processed 标记失败:', (err as Error).message);
  }
}

// ============================================================
// 提取追踪 — LTM（STM→LTM）
// ============================================================

const LTM_PROCESSED_PATH = (userToken: string) =>
  `users/${userToken}/stm/.ltm-processed.json`;

async function getLTMProcessedDates(env: Env, userToken: string): Promise<string[]> {
  try {
    const obj = await env.WORKS_BUCKET.get(LTM_PROCESSED_PATH(userToken));
    if (obj) {
      const state: ProcessedDatesState = JSON.parse(await obj.text());
      return state.processed_dates || [];
    }
  } catch { /* 文件不存在或损坏 */ }
  return [];
}

async function markLTMDateAsProcessed(env: Env, userToken: string, newDates: string[]): Promise<void> {
  try {
    const existing = await getLTMProcessedDates(env, userToken);
    const merged = [...new Set([...existing, ...newDates])].sort().reverse();
    const cutoff = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
    const trimmed = merged.filter(d => d >= cutoff);
    await env.WORKS_BUCKET.put(
      LTM_PROCESSED_PATH(userToken),
      JSON.stringify({ processed_dates: trimmed } as ProcessedDatesState),
      { httpMetadata: { contentType: 'application/json' } },
    );
  } catch (err) {
    console.error('[memory] LTM processed 标记失败:', (err as Error).message);
  }
}

// ============================================================
// LTM 提取时间状态
// ============================================================

async function getExtractionState(env: Env, userToken: string): Promise<ExtractionState> {
  try {
    const obj = await env.WORKS_BUCKET.get(`users/${userToken}/ltm/.extraction-state.json`);
    if (obj) return JSON.parse(await obj.text()) as ExtractionState;
  } catch { /* 文件不存在 */ }
  return { last_l3_extraction: '' };
}

async function updateExtractionState(env: Env, userToken: string, lastDate: string): Promise<void> {
  await env.WORKS_BUCKET.put(
    `users/${userToken}/ltm/.extraction-state.json`,
    JSON.stringify({ last_l3_extraction: lastDate } as ExtractionState),
    { httpMetadata: { contentType: 'application/json' } },
  );
}
