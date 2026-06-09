// L2 记忆系统测试辅助端点
// 写入/清理预制的测试记忆数据到 R2，供自动化验证使用。

import { Env } from '../../db/schema';
import { jsonSuccess, jsonError } from '../../lib/response';
import { ErrorCodes } from '../../lib/errors';
import { extractL1toL2, extractL2toL3IfDue } from '../../lib/l2/memory';

// ============================================================
// 测试数据
// ============================================================

const TEST_L2_DAY1 = `# 2026-06-01 短期记忆

## 写作偏好
- 偏好短句、快节奏叙事，不喜欢冗长环境描写 [[l1-sess_test001]]
- 对话风格偏好：简洁、潜台词丰富，避免"说教感" [[l1-sess_test001]]

## 作品决策（镜中棋局）
- 主角成长弧线定为"坠落型"（类似佛罗多），非"英雄型" [[l1-sess_test002]]
- 魔法体系选择软魔法，规则不明确、代价模糊 [[l1-sess_test002]]

## 作者反馈
- 2026-06-01: 对 M5 意图卡模板设计提出反馈，认为不应精简字段 [[l1-sess_test003]]

## 待办/计划
- 第 3 章需要重写情感转折段落
- M1 承诺清单缺少第 5 条，下次补充`;

const TEST_L2_DAY2 = `# 2026-06-02 短期记忆

## 写作偏好
- 倾向于用动作和对白暗示环境氛围，而非直接描写 [[l1-sess_test004]]

## 作品决策（镜中棋局）
- 结局确定为"悲壮的希望"，不要大团圆 [[l1-sess_test005]]
- 决定增加镜像反派角色"镜影"的戏份 [[l1-sess_test005]]

## 作者反馈
- 2026-06-02: 认可记忆系统的设计方向，建议 L3 使用 Markdown 格式 [[l1-sess_test006]]

## 待办/计划
- 开始设计 L3 长期画像的提取 Prompt`;

const TEST_L3_PROFILE = `# 用户画像

> 最后更新：2026-06-02 | 来源 L2 文件：2 份 | 来源 L2：[[l2-2026-06-01]]、[[l2-2026-06-02]]

## 写作风格

偏好快节奏叙事，句子简短有力。不喜欢冗长的环境描写，但善于用动作和对白来暗示环境氛围。
对话风格偏向潜台词丰富——人物说的和想的往往不一样。作品基调偏暗色但有希望感（"悲壮的希望"）。

## 世界观构建

倾向软魔法体系——规则模糊但代价明确。不追求"硬核魔法科学"，更关注魔法对角色心理的影响。
频繁使用镜像/对立/平行世界等二元结构来构建世界。

## 角色偏好

主角倾向"坠落型"成长弧线（类似佛罗多），非传统英雄型。喜欢设置镜像反派。
女性主角，沉默、细致、能力来自于天赋+代价而非训练。

## 互动风格

倾向直接纠错，不喜欢绕弯子。偏好专业口吻。对 Prompt 组装、缓存策略等底层细节有强烈兴趣。`;

// ============================================================
// 端点
// ============================================================

/**
 * POST /api/write/memory-test/setup
 * Body: { test_token: string }
 * 写入预制的 L2（2天）+ L3 测试文件到 R2
 */
export async function handleMemoryTestSetup(env: Env, request: Request): Promise<Response> {
  const body = await request.json() as { test_token?: string };
  const token = body.test_token || 'memory-test-001';

  try {
    // L2 Day 1
    await env.WORKS_BUCKET.put(
      `users/${token}/stm/stm-memory/2026-06-01.md`,
      TEST_L2_DAY1,
      { httpMetadata: { contentType: 'text/markdown; charset=utf-8' } },
    );
    // L2 Day 2
    await env.WORKS_BUCKET.put(
      `users/${token}/stm/stm-memory/2026-06-02.md`,
      TEST_L2_DAY2,
      { httpMetadata: { contentType: 'text/markdown; charset=utf-8' } },
    );
    // L3 Profile
    await env.WORKS_BUCKET.put(
      `users/${token}/ltm/memory-profile.md`,
      TEST_L3_PROFILE,
      { httpMetadata: { contentType: 'text/markdown; charset=utf-8' } },
    );

    return new Response(JSON.stringify(jsonSuccess({
      test_token: token,
      files_created: [
        `users/${token}/stm/stm-memory/2026-06-01.md`,
        `users/${token}/stm/stm-memory/2026-06-02.md`,
        `users/${token}/ltm/memory-profile.md`,
      ],
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
 * Body: { test_token: string }
 * 删除测试记忆文件
 */
export async function handleMemoryTestTeardown(env: Env, request: Request): Promise<Response> {
  const body = await request.json() as { test_token?: string };
  const token = body.test_token || 'memory-test-001';

  try {
    const files = [
      `users/${token}/stm/stm-memory/2026-06-01.md`,
      `users/${token}/stm/stm-memory/2026-06-02.md`,
      `users/${token}/ltm/memory-profile.md`,
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
 * Body: { user_token: string }
 * 手动触发 L1→L2 提取（测试用）。扫描未处理的 L1 日志，调用 LLM 提取为短期记忆。
 */
export async function handleMemoryExtractL2(env: Env, request: Request): Promise<Response> {
  const body = await request.json() as { user_token?: string };
  const token = body.user_token;

  if (!token) {
    return new Response(JSON.stringify(jsonError(ErrorCodes.MISSING_REQUIRED_FIELD, 'user_token is required')), {
      status: 400, headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    // 只针对指定用户做提取
    const result = await extractL1toL2(env);
    return new Response(JSON.stringify(jsonSuccess({
      user_token: token,
      users_processed: result.users_processed,
      sessions_extracted: result.sessions_extracted,
      note: result.sessions_extracted > 0
        ? `已提取 ${result.sessions_extracted} 个会话的 L1→L2 记忆`
        : '没有新的 L1 日志需要提取（所有日志已处理或近 2 天无活动）',
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
 * 手动触发 L2→L3 提取（测试用）。检查触发条件，满足则调用 LLM 提炼长期画像。
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
    // 强制触发（传 session_count=999 绕过 ≥10 条件的限制）
    const extracted = await extractL2toL3IfDue(env, token, 999);
    return new Response(JSON.stringify(jsonSuccess({
      user_token: token,
      extracted,
      note: extracted
        ? 'L2→L3 画像提取完成，已更新 memory-profile.md'
        : '不满足触发条件（距上次 <7 天）。如需强制提取，请直接调 extract-l2 后再试。',
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
// GET /api/write/memory-test/read-l1 — read L1 daily log (debug)
// ============================================================

function extractFullUserToken(request: Request): string {
  const auth = request.headers.get('Authorization') || '';
  return auth.startsWith('Bearer ') ? auth.slice(7) : '';
}

export async function handleMemoryReadL1(env: Env, request: Request): Promise<Response> {
  const token = extractFullUserToken(request);
  if (!token || token !== (env.ADMIN_TOKEN?.trim() || '')) {
    return new Response(JSON.stringify(jsonError(ErrorCodes.AUTH_REQUIRED, 'Admin token required')), {
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

  const path = `users/${token}/memory-logs/${page}/${workId}/${date}.json`;
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
