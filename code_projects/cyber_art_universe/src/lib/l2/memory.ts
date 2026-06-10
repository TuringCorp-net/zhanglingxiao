// L2: 记忆系统核心
// 三级记忆模型：L1 瞬时（Session Log）→ L2 短期（STM final）→ L3 长期（LTM final）
// 设计文档：docs/story_elf/original_concept.md §agent memory
//
// 增量合并式提取（类似马赛克压缩）：
// - STM：每天凌晨 3:00，将当日 L1 + 现有 stm-final.md → LLM 合并 → 新 stm-final.md（同时保存 stm-memory/{date}.md 存档）
// - LTM：每 3 天一次，将近 3 日 L1 + 现有 ltm-final.md → LLM 合并 → 新 ltm-final.md（同时保存 ltm-memory/{date}.md 存档）
//
// 双标志位：
// - extracted_to_stm：L1 文件是否已参与 STM 合并
// - extracted_to_ltm：L1 文件是否已参与 LTM 合并
// 两个标志位独立，STM 每天执行，LTM 每 3 天执行。

import { Env } from '../../db/schema';
import { callAI, type Message } from '../l0/aiGateway';
import stmPrompt from './prompts/memory_stm/system.md';
import ltmPrompt from './prompts/memory_ltm/system.md';

// ============================================================
// 类型
// ============================================================

/** L1 每日日志（按天聚合，同一天多次对话追加到同一文件） */
interface DailyLog {
  date: string;
  page: string;
  work_id: string;
  work_title: string;
  entries: {
    timestamp: string;
    messages: SessionMessage[];
  }[];
  /** L1→L2 是否已提取 */
  extracted_to_stm: boolean;
  /** L2→L3 是否已提取 */
  extracted_to_ltm: boolean;
}

interface SessionMessage {
  role: 'user' | 'assistant' | 'tool_call' | 'tool_result';
  content?: string;
  tool?: string;
  params?: Record<string, unknown>;
  summary?: string;
  tool_call_id?: string;
}

/** L2→L3 提取状态（仅记录上次提取时间） */
interface ExtractionState {
  last_l3_extraction: string;    // YYYY-MM-DD
}

// ============================================================
// L1: 保存会话日志（每日追加）
// ============================================================

/**
 * 保存一轮对话记录到当日 L1 Memory Log（追加写入）。
 * 同一天内多次对话追加到同一文件。跨天自动创建新文件。
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
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const path = `users/${userToken}/memory-logs/${page}/${workId}/${today}.json`;

  // 转换 messages 为 L1 存储格式
  const sessionMessages: SessionMessage[] = messages.map(m => {
    if (m.role === 'tool') {
      return {
        role: 'tool_result',
        content: m.content || '',
        tool_call_id: m.tool_call_id,
      };
    }
    if (m.role === 'assistant' && m.tool_calls && m.tool_calls.length > 0) {
      return {
        role: 'tool_call',
        tool: m.tool_calls[0].function.name,
        params: safeJsonParse(m.tool_calls[0].function.arguments),
      };
    }
    return {
      role: m.role as 'user' | 'assistant',
      content: m.content || '',
    };
  });

  const entry = {
    timestamp: now.toISOString(),
    messages: sessionMessages,
  };

  try {
    let log: DailyLog;
    const existing = await env.WORKS_BUCKET.get(path);
    if (existing) {
      log = JSON.parse(await existing.text()) as DailyLog;
      log.entries.push(entry);
    } else {
      log = {
        date: today,
        page,
        work_id: workId,
        work_title: workTitle,
        entries: [entry],
        extracted_to_stm: false,
        extracted_to_ltm: false,
      };
    }
    await env.WORKS_BUCKET.put(path, JSON.stringify(log, null, 2), {
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
 * 扫描该用户近 1-2 天未处理的 L1，合并到 stm-final.md。
 * 每个 Worker invocation 只处理一个用户，天然支持 Cloudflare 动态扩容。
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
    const unprocessedKeys = await findUnprocessedLogs(env, userToken, dates, 'extracted_to_stm');
    if (unprocessedKeys.length === 0) return { sessions_extracted: 0 };

    const l1Contents: string[] = [];
    for (const key of unprocessedKeys) {
      try {
        const obj = await env.WORKS_BUCKET.get(key);
        if (!obj) continue;
        const log: DailyLog = JSON.parse(await obj.text());
        if (log.extracted_to_stm) continue;
        l1Contents.push(formatDailyLogForExtraction(log));
      } catch { /* 单文件损坏不中断批处理 */ }
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

    for (const key of unprocessedKeys) {
      await markExtracted(env, key, 'extracted_to_stm');
    }

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
// L2→L3: 长期画像增量合并（每 3 天执行）
// ============================================================

/**
 * 检查 L2→L3 触发条件：距上次 L3 提取 ≥ 3 天。
 * 满足条件时，将近 3 天未提取 LTM 的 L1 + 现有 ltm-final.md → LLM 合并。
 * 同时保存按日存档（ltm/ltm-memory/{date}.md）供未来回溯。
 * 纯时间驱动，不再依赖会话次数。
 */
export async function extractL2toL3IfDue(env: Env, userToken: string): Promise<boolean> {
  const state = await getExtractionState(env, userToken);
  const today = new Date().toISOString().slice(0, 10);

  const daysSinceLast = state.last_l3_extraction
    ? Math.floor((Date.now() - new Date(state.last_l3_extraction).getTime()) / 86400000)
    : 999;

  if (daysSinceLast < 3) return false;

  // 近 30 天的日期列表（足够覆盖用户沉默期，extracted_to_ltm 标志位防止重复提取）
  const dates: string[] = [];
  for (let i = 0; i < 30; i++) {
    dates.push(new Date(Date.now() - i * 86400000).toISOString().slice(0, 10));
  }

  try {
    const unprocessedKeys = await findUnprocessedLogs(env, userToken, dates, 'extracted_to_ltm');
    if (unprocessedKeys.length === 0) {
      // 没有新 L1，但仍更新状态避免反复检查
      await updateExtractionState(env, userToken, today);
      return false;
    }

    // 读取并格式化 L1 内容
    const l1Contents: string[] = [];
    for (const key of unprocessedKeys) {
      try {
        const obj = await env.WORKS_BUCKET.get(key);
        if (!obj) continue;
        const log: DailyLog = JSON.parse(await obj.text());
        if (log.extracted_to_ltm) continue;
        l1Contents.push(formatDailyLogForExtraction(log));
      } catch { /* skip corrupted */ }
    }

    if (l1Contents.length === 0) return false;

    // 读取现有 LTM final
    const existingLTM = await readLTMFinal(env, userToken);

    // LLM 合并：近期 L1 + 现有 LTM → 新 LTM
    const newLTM = await runLTMMerge(env, l1Contents.join('\n\n---\n\n'), existingLTM);
    if (!newLTM) return false;

    // 写入新 LTM final（注入 prompt 用）
    await env.WORKS_BUCKET.put(
      `users/${userToken}/ltm/ltm-final.md`,
      newLTM,
      { httpMetadata: { contentType: 'text/markdown; charset=utf-8' } },
    );

    // 同时保存按日存档（保留原始提取结果，供未来回溯/二次精炼）
    await env.WORKS_BUCKET.put(
      `users/${userToken}/ltm/ltm-memory/${today}.md`,
      newLTM,
      { httpMetadata: { contentType: 'text/markdown; charset=utf-8' } },
    );

    // 标记 L1 文件为已提取 LTM
    for (const key of unprocessedKeys) {
      await markExtracted(env, key, 'extracted_to_ltm');
    }

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

/**
 * 读取 STM final（增量合并后的短期记忆，单文件）。
 * 供 prompt.ts 的 Layer 5 注入调用。
 */
export async function readSTMFinal(env: Env, userToken: string): Promise<string> {
  try {
    const obj = await env.WORKS_BUCKET.get(`users/${userToken}/stm/stm-final.md`);
    if (!obj) return '';
    return await obj.text();
  } catch {
    return '';
  }
}

/**
 * 读取 LTM final（长期用户画像，单文件）。
 * 供 prompt.ts 的 Layer 5 注入调用。
 */
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

/**
 * 保存当前 checklist 状态到 R2（用于跨会话恢复）。
 */
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
// 内部函数
// ============================================================

/** 发现近 N 天有 L1 日志活动的用户（供 Cron fan-out 使用） */
export async function discoverActiveUsers(env: Env, dates: string[]): Promise<string[]> {
  const users = new Set<string>();

  try {
    let cursor: string | undefined;
    do {
      const listed = await env.WORKS_BUCKET.list({ prefix: 'users/', limit: 500, cursor });
      for (const obj of listed.objects) {
        // 检查是否匹配目标日期的 L1 日志文件
        // 路径格式：users/{token}/memory-logs/{page}/{work_id}/{date}.json
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

/**
 * 查找某用户未处理的 L1 日志。
 * @param flag 要检查的标志位：'extracted_to_stm' 或 'extracted_to_ltm'
 */
async function findUnprocessedLogs(
  env: Env,
  userToken: string,
  dates: string[],
  flag: 'extracted_to_stm' | 'extracted_to_ltm',
): Promise<string[]> {
  const keys: string[] = [];
  const prefix = `users/${userToken}/memory-logs/`;

  try {
    let cursor: string | undefined;
    do {
      const listed = await env.WORKS_BUCKET.list({ prefix, limit: 200, cursor });
      for (const obj of listed.objects) {
        // 匹配 {date}.json 结尾的文件
        for (const d of dates) {
          if (obj.key.endsWith(`/${d}.json`)) {
            keys.push(obj.key);
            break;
          }
        }
      }
      cursor = listed.truncated ? listed.cursor : undefined;
    } while (cursor);
  } catch (err) {
    console.error(`[memory] 查找 L1 日志失败 (${userToken}):`, (err as Error).message);
  }

  return keys;
}

/**
 * 将 DailyLog 格式化为 LLM 可读的文本。
 * DailyLog 结构：{ entries: [{ timestamp, messages: [...] }] }
 */
function formatDailyLogForExtraction(log: DailyLog): string {
  const lines: string[] = [];
  lines.push(`## ${log.date} | 作品: ${log.work_title} (${log.work_id}) | 页面: ${log.page}`);
  lines.push('');

  for (const entry of log.entries) {
    lines.push(`### ${entry.timestamp}`);
    lines.push('');
    for (const msg of entry.messages) {
      switch (msg.role) {
        case 'user':
          lines.push(`**作者**: ${msg.content || ''}`);
          break;
        case 'assistant':
          if (msg.content) {
            lines.push(`**Story Elf**: ${msg.content}`);
          }
          break;
        case 'tool_call':
          lines.push(`_[调用了工具: ${msg.tool}(${JSON.stringify(msg.params || {})})]_`);
          break;
        case 'tool_result':
          // 不保存 tool_result 详情（数据已在 R2，重复存储无意义）
          break;
      }
      lines.push('');
    }
  }

  return lines.join('\n');
}

// ============================================================
// LLM 调用：增量合并
// ============================================================

/**
 * STM 合并：当日 L1 内容 + 现有 STM final → 新 STM final。
 * 一次 LLM 调用完成"提取新信息 + 与旧记忆合并去重 + 自然遗忘"。
 */
export async function runSTMMerge(
  env: Env,
  l1Content: string,
  existingSTM: string,
): Promise<string | null> {
  const hasExisting = existingSTM.trim().length > 0;
  const today = new Date().toISOString().slice(0, 10);

  // 统计 L1 中的会话条目数
  const sessionCount = (l1Content.match(/^### /gm) || []).length;

  const userPrompt = hasExisting
    ? `以下是现有短期记忆，请结合最新的对话记录进行合并更新。\n\n## 现有短期记忆\n\n${existingSTM.trim()}\n\n---\n\n## 最新对话记录\n\n${l1Content}\n\n请输出合并后的完整短期记忆（${today}，合并了 ${sessionCount} 份新对话记录）。`
    : `以下是最新的对话记录。请从中提取关键信息，生成初始短期记忆。\n\n${l1Content}\n\n请输出完整的短期记忆文件（${today}，来自 ${sessionCount} 份新对话记录）。`;

  try {
    const result = await callAI(env, [
      { role: 'system', content: stmPrompt },
      { role: 'user', content: userPrompt },
    ], {
      model: 'deepseek-v4-flash',
      maxTokens: 2048,
      temperature: 0.3,
    });

    const content = result.content?.trim();
    if (!content || content.length < 20) return null;
    return content;
  } catch (err) {
    console.error('[memory] STM 合并 LLM 调用失败:', (err as Error).message);
    return null;
  }
}

/**
 * LTM 合并：近期 L1 内容 + 现有 LTM final → 新 LTM final。
 * 一次 LLM 调用完成"提炼持久画像 + 与旧画像合并 + 自然演化"。
 */
export async function runLTMMerge(
  env: Env,
  l1Content: string,
  existingLTM: string,
): Promise<string | null> {
  const hasExisting = existingLTM.trim().length > 0;
  const today = new Date().toISOString().slice(0, 10);
  const sessionCount = (l1Content.match(/^### /gm) || []).length;

  const userPrompt = hasExisting
    ? `以下是现有用户画像，请结合最新的对话记录进行合并更新。\n\n## 现有用户画像\n\n${existingLTM.trim()}\n\n---\n\n## 最新对话记录\n\n${l1Content}\n\n请输出更新后的完整用户画像（${today}，基于 ${sessionCount} 份新对话记录）。`
    : `以下是最新的对话记录。请从中提炼用户的持久创作画像。\n\n${l1Content}\n\n请输出完整的用户画像文件（${today}，基于 ${sessionCount} 份新对话记录）。`;

  try {
    const result = await callAI(env, [
      { role: 'system', content: ltmPrompt },
      { role: 'user', content: userPrompt },
    ], {
      model: 'deepseek-v4-flash',
      maxTokens: 2048,
      temperature: 0.3,
    });

    const content = result.content?.trim();
    if (!content || content.length < 20) return null;
    return content;
  } catch (err) {
    console.error('[memory] LTM 合并 LLM 调用失败:', (err as Error).message);
    return null;
  }
}

// ============================================================
// 提取状态管理
// ============================================================

/** 标记 L1 文件为已提取 */
async function markExtracted(
  env: Env,
  key: string,
  flag: 'extracted_to_stm' | 'extracted_to_ltm',
): Promise<void> {
  try {
    const obj = await env.WORKS_BUCKET.get(key);
    if (!obj) return;
    const log: DailyLog = JSON.parse(await obj.text());
    log[flag] = true;
    await env.WORKS_BUCKET.put(key, JSON.stringify(log, null, 2), {
      httpMetadata: { contentType: 'application/json' },
    });
  } catch { /* 标记失败不中断批处理 */ }
}

/** 获取 L2→L3 提取状态 */
async function getExtractionState(env: Env, userToken: string): Promise<ExtractionState> {
  try {
    const obj = await env.WORKS_BUCKET.get(`users/${userToken}/ltm/.extraction-state.json`);
    if (obj) return JSON.parse(await obj.text()) as ExtractionState;
  } catch { /* 文件不存在，返回默认 */ }
  return { last_l3_extraction: '' };
}

/** 更新 L2→L3 提取状态 */
async function updateExtractionState(env: Env, userToken: string, lastDate: string): Promise<void> {
  const state: ExtractionState = { last_l3_extraction: lastDate };
  await env.WORKS_BUCKET.put(
    `users/${userToken}/ltm/.extraction-state.json`,
    JSON.stringify(state, null, 2),
    { httpMetadata: { contentType: 'application/json' } },
  );
}

// ============================================================
// 工具函数
// ============================================================

function safeJsonParse(s: string): Record<string, unknown> {
  try { return JSON.parse(s); } catch { return {}; }
}
