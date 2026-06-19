// L2 记忆系统测试辅助端点
// 写入/清理预制的测试记忆数据到 R2，供手动触发提取验证使用。
//
// 端点：
//   POST /api/write/memory-test/setup       — 写入测试 L1 + STM final + LTM final + 提取状态
//   POST /api/write/memory-test/teardown    — 删除测试记忆文件
//   POST /api/write/memory-test/extract-l2  — 手动触发 L1→L2 STM 合并
//   POST /api/write/memory-test/extract-l3  — 手动触发 L2→L3 LTM 合并（自动满足 ≥3 天条件）
//   GET  /api/write/memory-test/read-l1     — 读取 L1 日志（admin token）
//   GET  /api/write/memory-test/read-l2     — 读取 STM final（admin token）
//   GET  /api/write/memory-test/read-l3     — 读取 LTM final（admin token）

import { Env } from '../../db/schema';
import { jsonSuccess, jsonError } from '../../lib/response';
import { ErrorCodes } from '../../lib/errors';
import { getUserId } from '../../lib/auth';
import { extractL1toL2, extractL2toL3IfDue } from '../../lib/l2/memory';

// ============================================================
// 测试数据
// ============================================================

/** L1 Day 1：偏好讨论 + 作品决策 */
const TEST_L1_DAY1 = {
  date: '2026-06-09',
  page: 'write',
  work_id: 'work_test_001',
  work_title: '测试作品·镜中棋局',
  entries: [
    {
      timestamp: '2026-06-09T10:00:00.000Z',
      messages: [
        { role: 'user' as const, content: '帮我看看世界观设定，我想写一个镜像世界的奇幻故事' },
        { role: 'tool_call' as const, tool: 'read_module', params: { module_type: 'm1' } },
        { role: 'assistant' as const, content: '当前 M1 世界观还是空的。让我帮你开始构建。你心中有这个世界最特别的地方吗？' },
        { role: 'user' as const, content: '我偏好软魔法体系——规则模糊但代价明确。不想搞那种"魔法科学"，更关注魔法对角色心理的影响。' },
        { role: 'assistant' as const, content: '好的，软魔法体系。这种体系下，魔法更像是一种有生命的力量，而非可计算的工具。我来为 M1 的力量体系部分生成初稿。' },
      ],
    },
    {
      timestamp: '2026-06-09T14:30:00.000Z',
      messages: [
        { role: 'user' as const, content: '继续讨论主角设定。我希望主角是女性，沉默但细致，能力来自天赋+代价而非训练。' },
        { role: 'assistant' as const, content: '这个设定很有力量。天赋+代价模式会让她的每一步成长都带着重量。她沉默是因为什么？是天性还是经历？' },
        { role: 'user' as const, content: '天性。她的成长弧线应该是"坠落型"的，类似佛罗多——不是变强，而是在艰难中保持自我。不喜欢传统英雄型。' },
        { role: 'assistant' as const, content: '坠落型弧线——在重压下不粉碎反而找到自己。这与软魔法体系很搭。我来记录这个决策。' },
        { role: 'user' as const, content: '对了，结局不要大团圆。我倾向"悲壮的希望"——有代价的胜利，开放式的。' },
        { role: 'assistant' as const, content: '悲壮的希望。这是很有质感的基调选择。我已经把这些记下来了。' },
      ],
    },
  ],
  extracted_to_stm: false,
  extracted_to_ltm: false,
};

/** L1 Day 2：更多偏好 + 反馈 */
const TEST_L1_DAY2 = {
  date: '2026-06-10',
  page: 'write',
  work_id: 'work_test_001',
  work_title: '测试作品·镜中棋局',
  entries: [
    {
      timestamp: '2026-06-10T09:00:00.000Z',
      messages: [
        { role: 'user' as const, content: '昨天讨论的角色设定我想再深化一下。主角需要一个镜像反派——与她对立的另一个女性角色，互为补充。' },
        { role: 'tool_call' as const, tool: 'read_module', params: { module_type: 'm3' } },
        { role: 'assistant' as const, content: '镜像反派是很强的叙事工具。她们在哪些维度上对立？目标、手段、还是价值观？' },
        { role: 'user' as const, content: '目标相同但手段不同。主角选择承受代价，反派选择转移代价给他人。这反映她们对"力量"的理解不同。' },
        { role: 'assistant' as const, content: '这个对立设置很精妙——不是简单的善恶对立，而是面对同一困境的两种回答。' },
      ],
    },
    {
      timestamp: '2026-06-10T11:00:00.000Z',
      messages: [
        { role: 'user' as const, content: '关于写作风格，我偏好短句、快节奏叙事。不喜欢冗长的环境描写，更喜欢用动作和对白来暗示氛围。' },
        { role: 'user' as const, content: '对话风格方面，要简洁、潜台词丰富。人物说的和想的往往不一样，避免"说教感"。' },
        { role: 'assistant' as const, content: '短句、快速、潜台词丰富。这种风格很适合你的坠落型主角——让行动胜过言语，让读者在留白中感受。' },
        { role: 'user' as const, content: '对记忆系统的设计很认可，特别是 L3 用 Markdown 格式。另外，在技术讨论中希望被解释原理而非直接给结论。' },
        { role: 'assistant' as const, content: '明白了。我会在技术决策时先讲清楚为什么，然后再实施。这也是你作为开发者的习惯。' },
      ],
    },
  ],
  extracted_to_stm: false,
  extracted_to_ltm: false,
};

/** 已有的 STM final（模拟 STM 中已有一些旧记忆，测试合并效果） */
const TEST_STM_FINAL = `# 短期记忆 (STM)

> 最后更新：2026-06-08 | 合并了 1 份新对话记录

## 写作偏好
- 偏好短句、快节奏叙事（2026-06-08）

## 作品决策（测试作品）
- 世界观采用镜像/平行世界二元结构（2026-06-08）
- 主角设定为女性，能力与代价绑定（2026-06-08）

## 待办/计划
- 完成 M1 世界观初稿`;

/** 已有的 LTM final（模拟 LTM 中已有一些基础画像） */
const TEST_LTM_FINAL = `# 用户画像

> 最后更新：2026-06-01 | 来源会话：3 份

## 写作风格

偏好快节奏叙事。作品基调偏暗色。

## 世界观构建

倾向软魔法体系。频繁使用镜像/对立/平行世界等二元结构来构建世界。

## 角色偏好

主角倾向"坠落型"成长弧线（类似佛罗多），非传统英雄型。喜欢设置镜像反派。

## 互动风格

对 Prompt 组装、缓存策略等底层细节有强烈兴趣。`;

/** 已有的 STM 存档（模拟之前某天的提取结果） */
const TEST_STM_ARCHIVE = `# 短期记忆 (STM)

> 最后更新：2026-06-08 | 合并了 1 份新对话记录

## 写作偏好
- 偏好短句、快节奏叙事（2026-06-08）

## 作品决策（测试作品）
- 世界观采用镜像/平行世界二元结构（2026-06-08）
- 主角设定为女性，能力与代价绑定（2026-06-08）

## 待办/计划
- 完成 M1 世界观初稿`;

/** 已有的 LTM 存档（模拟之前某次的提取结果） */
const TEST_LTM_ARCHIVE = `# 用户画像

> 最后更新：2026-06-01 | 来源会话：3 份

## 写作风格

偏好快节奏叙事。作品基调偏暗色。

## 世界观构建

倾向软魔法体系。频繁使用镜像/对立/平行世界等二元结构来构建世界。

## 互动风格

对 Prompt 组装、缓存策略等底层细节有强烈兴趣。`;

// ============================================================
// 端点
// ============================================================

/**
 * POST /api/write/memory-test/setup
 * Body: { test_token?: string }
 * 写入完整的测试记忆数据：
 *   - L1: 2 天 DailyLog 文件（未标记提取）
 *   - STM final: 已有的短期记忆（用于测试合并）
 *   - LTM final: 已有的用户画像（用于测试合并）
 *   - 提取状态: L3 上次提取设为 30 天前（确保手动触发 ≥3 天条件）
 */
export async function handleMemoryTestSetup(env: Env, request: Request): Promise<Response> {
  const body = await request.json() as { test_token?: string };
  const token = body.test_token || 'memory-test-001';

  try {
    const files: string[] = [];

    // L1 Day 1
    const l1Day1Key = `users/${token}/memory-logs/write/work_test_001/2026-06-09.json`;
    await env.WORKS_BUCKET.put(l1Day1Key, JSON.stringify(TEST_L1_DAY1, null, 2), {
      httpMetadata: { contentType: 'application/json' },
    });
    files.push(l1Day1Key);

    // L1 Day 2
    const l1Day2Key = `users/${token}/memory-logs/write/work_test_001/2026-06-10.json`;
    await env.WORKS_BUCKET.put(l1Day2Key, JSON.stringify(TEST_L1_DAY2, null, 2), {
      httpMetadata: { contentType: 'application/json' },
    });
    files.push(l1Day2Key);

    // STM final（已有的短期记忆）
    const stmKey = `users/${token}/stm/stm-final.md`;
    await env.WORKS_BUCKET.put(stmKey, TEST_STM_FINAL, {
      httpMetadata: { contentType: 'text/markdown; charset=utf-8' },
    });
    files.push(stmKey);

    // STM 存档（模拟之前某天的提取结果）
    const stmArchiveKey = `users/${token}/stm/stm-memory/2026-06-08.md`;
    await env.WORKS_BUCKET.put(stmArchiveKey, TEST_STM_ARCHIVE, {
      httpMetadata: { contentType: 'text/markdown; charset=utf-8' },
    });
    files.push(stmArchiveKey);

    // LTM final（已有的用户画像）
    const ltmKey = `users/${token}/ltm/ltm-final.md`;
    await env.WORKS_BUCKET.put(ltmKey, TEST_LTM_FINAL, {
      httpMetadata: { contentType: 'text/markdown; charset=utf-8' },
    });
    files.push(ltmKey);

    // LTM 存档（模拟之前某次的提取结果）
    const ltmArchiveKey = `users/${token}/ltm/ltm-memory/2026-06-01.md`;
    await env.WORKS_BUCKET.put(ltmArchiveKey, TEST_LTM_ARCHIVE, {
      httpMetadata: { contentType: 'text/markdown; charset=utf-8' },
    });
    files.push(ltmArchiveKey);

    // 提取状态：L3 上次提取设为 30 天前（确保手动触发能通过 ≥3 天条件）
    const stateKey = `users/${token}/ltm/.extraction-state.json`;
    const oldDate = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
    await env.WORKS_BUCKET.put(stateKey, JSON.stringify({ last_l3_extraction: oldDate }), {
      httpMetadata: { contentType: 'application/json' },
    });
    files.push(stateKey);

    return new Response(JSON.stringify(jsonSuccess({
      test_token: token,
      files_created: files,
      note: '测试数据已就绪。可调用 extract-l2 手动触发 STM 合并，extract-l3 手动触发 LTM 合并。',
    })), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify(jsonError(ErrorCodes.INTERNAL_ERROR, `Setup failed: ${(err as Error).message}`)), {
      status: 500, headers: { 'Content-Type': 'application/json' },
    });
  }
}

/**
 * POST /api/write/memory-test/teardown
 * Body: { test_token?: string }
 * 删除测试记忆文件。
 */
export async function handleMemoryTestTeardown(env: Env, request: Request): Promise<Response> {
  const body = await request.json() as { test_token?: string };
  const token = body.test_token || 'memory-test-001';

  try {
    const files = [
      `users/${token}/memory-logs/write/work_test_001/2026-06-09.json`,
      `users/${token}/memory-logs/write/work_test_001/2026-06-10.json`,
      `users/${token}/stm/stm-final.md`,
      `users/${token}/stm/stm-memory/2026-06-08.md`,
      `users/${token}/ltm/ltm-final.md`,
      `users/${token}/ltm/ltm-memory/2026-06-01.md`,
      `users/${token}/ltm/.extraction-state.json`,
    ];
    for (const f of files) {
      await env.WORKS_BUCKET.delete(f);
    }

    return new Response(JSON.stringify(jsonSuccess({
      test_token: token,
      files_deleted: files,
      cleaned: true,
    })), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify(jsonError(ErrorCodes.INTERNAL_ERROR, `Teardown failed: ${(err as Error).message}`)), {
      status: 500, headers: { 'Content-Type': 'application/json' },
    });
  }
}

/**
 * POST /api/write/memory-test/extract-l2
 * Body: { user_token?: string }
 * 手动触发 L1→L2 STM 增量合并。
 * 扫描所有活跃用户的未处理 L1，与现有 stm-final.md 合并。
 */
export async function handleMemoryExtractL2(env: Env, request: Request): Promise<Response> {
  try {
    const result = await extractL1toL2(env);
    return new Response(JSON.stringify(jsonSuccess({
      users_processed: result.users_processed,
      sessions_extracted: result.sessions_extracted,
      users: result.users,
      note: result.sessions_extracted > 0
        ? `已为 ${result.users_processed} 个用户合并 STM（${result.sessions_extracted} 个会话）`
        : '没有新的 L1 日志需要处理（所有日志已标记 extracted_to_stm 或近 2 天无活动）',
    })), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify(jsonError(ErrorCodes.INTERNAL_ERROR, `L2 extraction failed: ${(err as Error).message}`)), {
      status: 500, headers: { 'Content-Type': 'application/json' },
    });
  }
}

/**
 * POST /api/write/memory-test/extract-l3
 * Body: { user_token: string }
 * 手动触发 L2→L3 LTM 增量合并。
 * 需要 setup 已将 L3 提取状态设为旧日期（≥3 天前）才能成功触发。
 */
export async function handleMemoryExtractL3(env: Env, request: Request): Promise<Response> {
  const body = await request.json() as { user_token?: string };
  const token = body.user_token;

  if (!token) {
    return new Response(JSON.stringify(jsonError(ErrorCodes.MISSING_REQUIRED_FIELD, 'user_token is required')), {
      status: 400, headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const extracted = await extractL2toL3IfDue(env, token);
    return new Response(JSON.stringify(jsonSuccess({
      user_token: token,
      extracted,
      note: extracted
        ? 'L2→L3 画像合并完成，已更新 ltm-final.md（同时保存了 ltm-memory/{date}.md 存档）'
        : '不满足触发条件（距上次 < 3 天）。如需要，请先调用 setup 重置提取状态（会将 last_l3_extraction 设为 30 天前）。',
    })), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify(jsonError(ErrorCodes.INTERNAL_ERROR, `L3 extraction failed: ${(err as Error).message}`)), {
      status: 500, headers: { 'Content-Type': 'application/json' },
    });
  }
}

// ============================================================
// POST /api/write/memory-test/reset
// ============================================================

/**
 * POST /api/write/memory-test/reset
 * Body: { user_token: string }
 * 重置指定用户的所有记忆提取状态：标志位 → false，删除 STM/LTM final 和存档。
 * 用于生产环境测试——恢复到 Cron 从未运行过的状态。
 */
export async function handleMemoryReset(env: Env, request: Request): Promise<Response> {
  const body = await request.json() as { user_token?: string };
  const token = body.user_token;
  if (!token) {
    return new Response(JSON.stringify(jsonError(ErrorCodes.MISSING_REQUIRED_FIELD, 'user_token is required')), {
      status: 400, headers: { 'Content-Type': 'application/json' },
    });
  }

  const actions: string[] = [];
  try {
    // 1. 重置所有 L1 文件的标志位
    const l1Prefix = `users/${token}/memory-logs/`;
    let cursor: string | undefined;
    let l1Reset = 0;
    do {
      const listed = await env.WORKS_BUCKET.list({ prefix: l1Prefix, limit: 200, cursor });
      for (const obj of listed.objects) {
        try {
          const file = await env.WORKS_BUCKET.get(obj.key);
          if (!file) continue;
          const log = JSON.parse(await file.text());
          if (log.extracted_to_stm !== undefined) {
            log.extracted_to_stm = false;
            log.extracted_to_ltm = false;
            await env.WORKS_BUCKET.put(obj.key, JSON.stringify(log, null, 2), {
              httpMetadata: { contentType: 'application/json' },
            });
            l1Reset++;
          }
        } catch { /* skip corrupted */ }
      }
      cursor = listed.truncated ? listed.cursor : undefined;
    } while (cursor);
    actions.push(`重置 ${l1Reset} 个 L1 文件的标志位为 false`);

    // 2. 删除 STM final + 存档
    const stmPrefix = `users/${token}/stm/`;
    cursor = undefined;
    let stmDeleted = 0;
    do {
      const listed = await env.WORKS_BUCKET.list({ prefix: stmPrefix, limit: 200, cursor });
      for (const obj of listed.objects) {
        await env.WORKS_BUCKET.delete(obj.key);
        stmDeleted++;
      }
      cursor = listed.truncated ? listed.cursor : undefined;
    } while (cursor);
    actions.push(`删除 ${stmDeleted} 个 STM 文件`);

    // 3. 删除 LTM final + 存档 + 提取状态
    const ltmPrefix = `users/${token}/ltm/`;
    cursor = undefined;
    let ltmDeleted = 0;
    do {
      const listed = await env.WORKS_BUCKET.list({ prefix: ltmPrefix, limit: 200, cursor });
      for (const obj of listed.objects) {
        await env.WORKS_BUCKET.delete(obj.key);
        ltmDeleted++;
      }
      cursor = listed.truncated ? listed.cursor : undefined;
    } while (cursor);
    actions.push(`删除 ${ltmDeleted} 个 LTM 文件（含 .extraction-state.json）`);

    return new Response(JSON.stringify(jsonSuccess({
      user_token: token,
      actions,
      note: '状态已重置。下次 Cron 将视为首次提取。',
    })), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify(jsonError(ErrorCodes.INTERNAL_ERROR, `Reset failed: ${(err as Error).message}`)), {
      status: 500, headers: { 'Content-Type': 'application/json' },
    });
  }
}

// ============================================================
// 读取端点（debug，需管理员权限）
// ============================================================

/**
 * GET /api/write/memory-test/read-l1
 * Query: work_id, page=write, date=today
 * 读取 L1 每日日志（需管理员权限）。
 */
export async function handleMemoryReadL1(env: Env, request: Request): Promise<Response> {
  if (env.currentUser?.class !== 'admin') {
    return new Response(JSON.stringify(jsonError(ErrorCodes.AUTH_REQUIRED, 'Admin permission required')), {
      status: 401, headers: { 'Content-Type': 'application/json' },
    });
  }

  const url = new URL(request.url);
  const workId = url.searchParams.get('work_id');
  const page = url.searchParams.get('page') || 'write';
  const date = url.searchParams.get('date') || new Date().toISOString().slice(0, 10);

  if (!workId) {
    return new Response(JSON.stringify(jsonError(ErrorCodes.MISSING_REQUIRED_FIELD, 'work_id required')), {
      status: 400, headers: { 'Content-Type': 'application/json' },
    });
  }

  const userId = getUserId(env);
  const path = `users/${userId}/memory-logs/${page}/${workId}/${date}.json`;
  try {
    const obj = await env.WORKS_BUCKET.get(path);
    if (!obj) {
      return new Response(JSON.stringify(jsonSuccess({ exists: false, path })), {
        headers: { 'Content-Type': 'application/json' },
      });
    }
    const raw = await obj.text();
    const log = JSON.parse(raw);
    return new Response(JSON.stringify(jsonSuccess({ exists: true, path, log })), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify(jsonError(ErrorCodes.INTERNAL_ERROR, `Read failed: ${(err as Error).message}`)), {
      status: 500, headers: { 'Content-Type': 'application/json' },
    });
  }
}

/**
 * GET /api/write/memory-test/read-l2
 * Query: user_id (可选，默认取当前用户)
 * 读取 STM final 内容（需管理员权限；admin 可通过 user_id 参数查看其他用户的记忆）。
 */
export async function handleMemoryReadL2(env: Env, request: Request): Promise<Response> {
  if (env.currentUser?.class !== 'admin') {
    return new Response(JSON.stringify(jsonError(ErrorCodes.AUTH_REQUIRED, 'Admin permission required')), {
      status: 401, headers: { 'Content-Type': 'application/json' },
    });
  }

  const url = new URL(request.url);
  const userId = url.searchParams.get('user_id') || getUserId(env);

  if (!userId) {
    return new Response(JSON.stringify(jsonError(ErrorCodes.AUTH_REQUIRED, 'user_id required')), {
      status: 401, headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const path = `users/${userId}/stm/stm-final.md`;
    const obj = await env.WORKS_BUCKET.get(path);
    if (!obj) {
      return new Response(JSON.stringify(jsonSuccess({ exists: false, path })), {
        headers: { 'Content-Type': 'application/json' },
      });
    }
    const content = await obj.text();
    return new Response(JSON.stringify(jsonSuccess({ exists: true, path, content })), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify(jsonError(ErrorCodes.INTERNAL_ERROR, `Read STM failed: ${(err as Error).message}`)), {
      status: 500, headers: { 'Content-Type': 'application/json' },
    });
  }
}

/**
 * GET /api/write/memory-test/read-l3
 * Query: user_id (可选，默认取当前用户)
 * 读取 LTM final 内容（需管理员权限；admin 可通过 user_id 参数查看其他用户的记忆）。
 */
export async function handleMemoryReadL3(env: Env, request: Request): Promise<Response> {
  if (env.currentUser?.class !== 'admin') {
    return new Response(JSON.stringify(jsonError(ErrorCodes.AUTH_REQUIRED, 'Admin permission required')), {
      status: 401, headers: { 'Content-Type': 'application/json' },
    });
  }

  const url = new URL(request.url);
  const userId = url.searchParams.get('user_id') || getUserId(env);

  if (!userId) {
    return new Response(JSON.stringify(jsonError(ErrorCodes.AUTH_REQUIRED, 'user_id required')), {
      status: 401, headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const path = `users/${userId}/ltm/ltm-final.md`;
    const obj = await env.WORKS_BUCKET.get(path);
    if (!obj) {
      return new Response(JSON.stringify(jsonSuccess({ exists: false, path })), {
        headers: { 'Content-Type': 'application/json' },
      });
    }
    const content = await obj.text();
    return new Response(JSON.stringify(jsonSuccess({ exists: true, path, content })), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify(jsonError(ErrorCodes.INTERNAL_ERROR, `Read LTM failed: ${(err as Error).message}`)), {
      status: 500, headers: { 'Content-Type': 'application/json' },
    });
  }
}
