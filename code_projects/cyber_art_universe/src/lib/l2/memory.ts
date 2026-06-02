// L2: 记忆系统核心
// 三级记忆模型：L1 瞬时（Session Log）→ L2 短期（STM）→ L3 长期（LTM）
// 设计文档：docs/story_elf/L2_agent_memory.md

import { Env } from '../../db/schema';
import { callAI, type Message } from '../l0/aiGateway';

// ============================================================
// 类型
// ============================================================

/** L1 会话日志 */
export interface SessionLog {
  session_id: string;
  date: string;            // YYYY-MM-DD
  page: 'read' | 'write';
  work_id: string;
  work_title: string;
  messages: SessionMessage[];
  extracted_to_stm: boolean;
}

interface SessionMessage {
  role: 'user' | 'assistant' | 'tool_call' | 'tool_result';
  content?: string;
  tool?: string;
  params?: Record<string, unknown>;
  summary?: string;
  tool_call_id?: string;
}

/** L2→L3 提取状态 */
interface ExtractionState {
  last_l3_extraction: string;    // YYYY-MM-DD
  session_count_since_l3: number;
}

// ============================================================
// L1: 保存会话日志
// ============================================================

/**
 * 保存一次会话的完整消息记录到 R2。
 * 在 elf_chat.ts 的 Agent 循环结束后调用。
 */
export async function saveSessionLog(
  env: Env,
  userToken: string,
  sessionId: string,
  page: string,
  workId: string,
  workTitle: string,
  messages: Message[],
): Promise<void> {
  const today = new Date().toISOString().slice(0, 10);
  const path = `users/${userToken}/memory-logs/${page}/${workId}/${today}_${sessionId}.json`;

  // 将 Message[] 转换为 L1 格式
  const sessionMessages: SessionMessage[] = messages.map(m => {
    if (m.role === 'tool') {
      return {
        role: 'tool_result',
        content: m.content?.substring(0, 200) || '',  // 只存摘要
        tool_call_id: m.tool_call_id,
      };
    }
    if (m.role === 'assistant' && m.tool_calls && m.tool_calls.length > 0) {
      // 保存 tool_call 动作信号（不保存 tool_result——数据在 R2）
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

  const log: SessionLog = {
    session_id: sessionId,
    date: today,
    page: page as 'read' | 'write',
    work_id: workId,
    work_title: workTitle,
    messages: sessionMessages,
    extracted_to_stm: false,
  };

  try {
    await env.WORKS_BUCKET.put(path, JSON.stringify(log, null, 2), {
      httpMetadata: { contentType: 'application/json' },
    });
  } catch (err) {
    console.error('[memory] L1 日志保存失败:', (err as Error).message);
  }
}

// ============================================================
// L1→L2: 短期记忆提取
// ============================================================

/**
 * Cron 触发：批量提取未处理的 L1 日志 → L2 短期记忆。
 * 扫描近 1-2 天未提取的 L1 文件，按用户分组，为每个用户生成一次 LLM 提取调用。
 */
export async function extractL1toL2(env: Env): Promise<{ users_processed: number; sessions_extracted: number }> {
  const today = new Date();
  const dates = [
    today.toISOString().slice(0, 10),
    new Date(today.getTime() - 86400000).toISOString().slice(0, 10),
  ];

  // 1. 发现活跃用户
  const userTokens = await discoverActiveUsers(env, dates);

  let usersProcessed = 0;
  let sessionsExtracted = 0;

  for (const userToken of userTokens) {
    try {
      // 2. 为该用户查找未处理的 L1 文件
      const unprocessedLogs = await findUnprocessedLogs(env, userToken, dates);
      if (unprocessedLogs.length === 0) continue;

      // 3. 读取 L1 内容并合并
      const allSessions: { session_id: string; date: string; content: string }[] = [];
      for (const logKey of unprocessedLogs) {
        try {
          const obj = await env.WORKS_BUCKET.get(logKey);
          if (!obj) continue;
          const log: SessionLog = JSON.parse(await obj.text());
          if (log.extracted_to_stm) continue;

          // 将会话内容格式化为可读文本
          const content = formatSessionForExtraction(log);
          allSessions.push({ session_id: log.session_id, date: log.date, content });
        } catch { /* 单文件损坏不中断批处理 */ }
      }

      if (allSessions.length === 0) continue;

      // 4. 调用 LLM 提取 L2 记忆
      const stmEntry = await runL1toL2Extraction(env, allSessions);
      if (!stmEntry) continue;

      // 5. 追加到当天 L2 文件
      await appendToSTMFile(env, userToken, today.toISOString().slice(0, 10), stmEntry);

      // 6. 标记 L1 文件为已提取
      for (const logKey of unprocessedLogs) {
        await markExtracted(env, logKey);
      }

      usersProcessed++;
      sessionsExtracted += allSessions.length;
    } catch (err) {
      console.error(`[memory] 用户 ${userToken} 的 L1→L2 提取失败:`, (err as Error).message);
    }
  }

  return { users_processed: usersProcessed, sessions_extracted: sessionsExtracted };
}

// ============================================================
// L2→L3: 长期画像提取
// ============================================================

/**
 * 检查 L2→L3 触发条件（距上次 ≥7 天 且 ≥10 次新会话）。
 * 满足条件时触发 LLM 提取，更新 memory-profile.md。
 */
export async function extractL2toL3IfDue(env: Env, userToken: string, newSessionCount: number): Promise<boolean> {
  const state = await getExtractionState(env, userToken);
  const today = new Date().toISOString().slice(0, 10);

  const daysSinceLast = state.last_l3_extraction
    ? Math.floor((Date.now() - new Date(state.last_l3_extraction).getTime()) / 86400000)
    : 999;

  const totalSessions = state.session_count_since_l3 + newSessionCount;

  if (daysSinceLast < 7 || totalSessions < 10) {
    // 不满足触发条件 → 只更新计数
    await updateExtractionState(env, userToken, state.last_l3_extraction || today, totalSessions);
    return false;
  }

  // 触发 L2→L3 提取
  try {
    const l2Content = await readRecentL2Files(env, userToken, 30);
    if (!l2Content) return false;

    const newProfile = await runL2toL3Extraction(env, l2Content, userToken);
    if (!newProfile) return false;

    // 写入 memory-profile.md
    const profilePath = `users/${userToken}/ltm/memory-profile.md`;
    await env.WORKS_BUCKET.put(profilePath, newProfile, {
      httpMetadata: { contentType: 'text/markdown; charset=utf-8' },
    });

    // 重置计数
    await updateExtractionState(env, userToken, today, 0);
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
 * 读取近 N 天的 L2 短期记忆文件。
 * 供 prompt.ts 的 buildAgentSystemPromptLayers() 调用。
 */
export async function readRecentL2Files(env: Env, userToken: string, days: number): Promise<string> {
  const parts: string[] = [];
  const today = new Date();

  for (let i = 0; i < days; i++) {
    const d = new Date(today.getTime() - i * 86400000);
    const dateStr = d.toISOString().slice(0, 10);
    const path = `users/${userToken}/stm/stm-memory/${dateStr}.md`;

    try {
      const obj = await env.WORKS_BUCKET.get(path);
      if (obj) {
        const content = await obj.text();
        if (content.trim()) {
          parts.push(`### ${dateStr}\n\n${content}`);
        }
      }
    } catch { /* 缺失某天的文件正常 */ }
  }

  return parts.join('\n\n');
}

/**
 * 读取 L3 长期画像。
 */
export async function readL3Profile(env: Env, userToken: string): Promise<string> {
  try {
    const obj = await env.WORKS_BUCKET.get(`users/${userToken}/ltm/memory-profile.md`);
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

/** 发现近 N 天有活动的用户 */
async function discoverActiveUsers(env: Env, dates: string[]): Promise<string[]> {
  const users = new Set<string>();

  // 通过 R2 list 扫描 users/ 前缀
  try {
    let cursor: string | undefined;
    do {
      const listed = await env.WORKS_BUCKET.list({ prefix: 'users/', limit: 500, cursor });
      for (const obj of listed.objects) {
        // 检查是否匹配目标日期
        for (const d of dates) {
          if (obj.key.includes(`/${d}_`)) {
            // 提取 user_token：users/{token}/...
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

/** 查找某用户未处理的 L1 日志 */
async function findUnprocessedLogs(env: Env, userToken: string, dates: string[]): Promise<string[]> {
  const keys: string[] = [];
  const prefix = `users/${userToken}/memory-logs/`;

  try {
    let cursor: string | undefined;
    do {
      const listed = await env.WORKS_BUCKET.list({ prefix, limit: 200, cursor });
      for (const obj of listed.objects) {
        for (const d of dates) {
          if (obj.key.includes(`/${d}_`)) {
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

/** 将会话日志格式化为提取 LLM 可读的文本 */
function formatSessionForExtraction(log: SessionLog): string {
  const lines: string[] = [];
  lines.push(`## 会话 ${log.session_id}`);
  lines.push(`日期: ${log.date} | 作品: ${log.work_title} (${log.work_id}) | 页面: ${log.page}`);
  lines.push('');

  for (const msg of log.messages) {
    switch (msg.role) {
      case 'user':
        lines.push(`**作者**: ${msg.content || ''}`);
        break;
      case 'assistant':
        if (msg.content) {
          lines.push(`**Story Elf**: ${msg.content.substring(0, 500)}`);
        }
        break;
      case 'tool_call':
        lines.push(`_[调用了工具: ${msg.tool}(${JSON.stringify(msg.params || {})})]_`);
        break;
      case 'tool_result':
        // 不显示 tool_result 详情
        break;
    }
    lines.push('');
  }

  return lines.join('\n');
}

/** 调用 LLM 提取 L1→L2 */
async function runL1toL2Extraction(
  env: Env,
  sessions: { session_id: string; date: string; content: string }[],
): Promise<string | null> {
  const sessionTexts = sessions.map(s => s.content).join('\n\n---\n\n');

  const systemPrompt = `你是 Story Elf 的记忆提取器。你的任务是从对话记录中提取关键信息，形成声明式事实。

## 提取原则

1. **声明式事实，不是命令**
   ✅ "偏好短句、快节奏叙事"
   ❌ "永远用短句写"

2. **只提取用户明确表达或强烈暗示的信息**
   - 用户明确说的偏好、做的决策
   - 用户的反馈（正面或负面）
   - 创作方向的关键选择

3. **不提取以下内容**
   - 临时性的闲聊或客套话
   - 已经在对话中显然是一次性的操作
   - 工具调用的技术细节

4. **简洁**：每条事实一行，不超过 150 字。

## 输出格式

请按以下格式输出（只输出记忆条目，不要其他文字）：

## 写作偏好
- {事实}

## 作品决策（{作品名}）
- {决策}

## 作者反馈
- {反馈}

## 待办/计划
- {待办}`;

  try {
    const result = await callAI(env, [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: `以下是最新的对话记录。请从中提取关键信息：\n\n${sessionTexts.substring(0, 15000)}` },
    ], {
      model: 'deepseek-v4-flash',
      maxTokens: 1024,
      temperature: 0.3,
    });

    const content = result.content?.trim();
    if (!content || content.length < 10) return null;
    return content;
  } catch (err) {
    console.error('[memory] L1→L2 LLM 调用失败:', (err as Error).message);
    return null;
  }
}

/** 追加 L2 条目到当天 STM 文件 */
async function appendToSTMFile(env: Env, userToken: string, dateStr: string, entry: string): Promise<void> {
  const path = `users/${userToken}/stm/stm-memory/${dateStr}.md`;

  let existing = '';
  try {
    const obj = await env.WORKS_BUCKET.get(path);
    if (obj) existing = await obj.text();
  } catch { /* 文件可能不存在 */ }

  const header = existing ? '\n\n' : `# ${dateStr} 短期记忆\n\n`;
  const newContent = existing + header + entry;

  await env.WORKS_BUCKET.put(path, newContent, {
    httpMetadata: { contentType: 'text/markdown; charset=utf-8' },
  });
}

/** 标记 L1 文件为已提取 */
async function markExtracted(env: Env, key: string): Promise<void> {
  try {
    const obj = await env.WORKS_BUCKET.get(key);
    if (!obj) return;
    const log: SessionLog = JSON.parse(await obj.text());
    log.extracted_to_stm = true;
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
  return { last_l3_extraction: '', session_count_since_l3: 0 };
}

/** 更新 L2→L3 提取状态 */
async function updateExtractionState(env: Env, userToken: string, lastDate: string, count: number): Promise<void> {
  const state: ExtractionState = { last_l3_extraction: lastDate, session_count_since_l3: count };
  await env.WORKS_BUCKET.put(
    `users/${userToken}/ltm/.extraction-state.json`,
    JSON.stringify(state, null, 2),
    { httpMetadata: { contentType: 'application/json' } },
  );
}

/** 调用 LLM 提取 L2→L3 */
async function runL2toL3Extraction(env: Env, l2Content: string, userToken: string): Promise<string | null> {
  const systemPrompt = `你是 Story Elf 的长期画像提炼器。你的任务是从近期的短期记忆（L2）中，提炼用户的持久创作画像，写入 memory-profile.md。

## 提炼原则

1. 只关注跨作品、跨时间的稳定模式
   - 如果某偏好只在 1-2 天内出现 → 留在 L2
   - 如果某偏好在多个 L2 文件中反复出现 → 提炼到画像

2. 输出格式：Markdown，用约定的 ## 标题组织，标题下为自由叙述文本
   - ## 写作风格 — 节奏、句长、对话风格、描写密度、基调
   - ## 世界观构建 — 体系偏好、结构模式、关注点
   - ## 角色偏好 — 弧线类型、关系模式、角色原型
   - ## 互动风格 — 与 Elf 的互动方式、纠错偏好、沟通口吻
   - 允许按需添加新标题

3. 叙述风格：用完整的自然语言描述，不要列表化、不要缩写
   ✅ "偏好快节奏叙事，句子简短有力。不喜欢冗长的环境描写，
       但善于用动作和对白来暗示环境氛围。"
   ❌ "pace: fast, sentence_length: short"

4. 如果某个维度没有足够的证据，可以省略该标题。

5. 头部包含元信息：最后更新日期、来源 L2 文件数量`;

  try {
    const result = await callAI(env, [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: `以下是最新的短期记忆。请提炼用户画像：\n\n${l2Content.substring(0, 20000)}` },
    ], {
      model: 'deepseek-v4-flash',
      maxTokens: 2048,
      temperature: 0.3,
    });

    const content = result.content?.trim();
    if (!content || content.length < 20) return null;

    // 添加元信息头部
    const today = new Date().toISOString().slice(0, 10);
    const sourceCount = (l2Content.match(/^### \d{4}-\d{2}-\d{2}$/gm) || []).length;

    return `# 用户画像

> 最后更新：${today} | 来源 L2 文件：${sourceCount} 份

${content}`;
  } catch (err) {
    console.error('[memory] L2→L3 LLM 调用失败:', (err as Error).message);
    return null;
  }
}

// ============================================================
// 工具函数
// ============================================================

function safeJsonParse(s: string): Record<string, unknown> {
  try { return JSON.parse(s); } catch { return {}; }
}
