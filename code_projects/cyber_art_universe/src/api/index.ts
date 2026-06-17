/**
 * Cyber Art Universe — 路由分发入口
 *
 * 覆盖需求 (CAU SRS):
 *   F-001~006 内容层 (works.ts) / F-010~012 发现层 (discovery.ts)
 *   F-020~024 实体系统 (entities.ts) / F-030~032, F-044~047 评价 (reviews.ts)
 *   F-040~043 事件/榜单 (events.ts) / F-050~052 订阅 (subscriptions.ts)
 *   F-060~061 搜索 (search.ts) / F-070 MCP 集成 (mcp.ts)
 *   F-090 用户认证 (Authorization: Bearer)
 *
 * Write 侧路由 → src/api/write/index.ts
 *
 * ============================================================
 * 前端设计（CAU Read 侧 — style.css / index.html / read.html / work.html）
 * ============================================================
 *
 * 设计哲学：简约、沉浸、赛博
 *   - 简约：无框架，纯 HTML+CSS+Vanilla JS，极轻渲染壳
 *   - 沉浸：阅读页为第一优先级，排版干净，零干扰
 *   - 赛博：深色主题，紫/青霓虹点缀，呼应 "Cyber Art Universe"
 *
 * 色彩语义（全局 CSS Variables）：
 *   - 紫色系 (--accent #7c3aed) = Read 侧主色 / 激活态 / 主要操作
 *   - 青色系 (--cyan #06b6d4)  = Write 侧主色 / Pipeline 进行中 / 信息提示
 *   - 绿色 (--success) = 成功 / 红色 (--error) = 错误 / 黄色 (--warn) = 警告
 *
 * 页面结构：
 *   - index.html  — 首页（分类横条 + 作品列表 + Read/Write 双 tab）
 *   - work.html   — 作品详情（信息 + 章节目录 + 角色列表）
 *   - read.html   — 阅读器（Markdown 渲染 + 字体调节 + 章节导航）
 *   - write.html  — Story Forger 写作桌（Write 侧，见 write/index.ts）
 *
 * 技术选型：CSS Variables + 无框架 + marked.js (CDN) + 系统字体栈（零加载）
 * 数据流：HTML → fetch(API) → JSON → marked.parse() → DOM
 */
import { Env } from '../db/schema';
import { jsonSuccess, jsonError } from '../lib/response';
import { ErrorCodes } from '../lib/errors';
import {
  listWorks, getWork, getWorkOutline, getSection,
} from './works';
import {
  listEntities, getEntity, getTimeline, compareSections,
} from './entities';
import { submitReview, listReviews, getReview, likeReview } from './reviews';
import { getEventFeed, listRankings, getRanking } from './events';
import { listSubscriptions, createSubscription, deleteSubscription } from './subscriptions';
import { searchContent, retrieveInWork } from './search';
import { handleAgentManifest, handleLLMsTxt, handleOpenAPI } from './discovery';
import { handleMCP } from './mcp';
import { handleWriteRoute } from './write/index';
import { discoverActiveUsers, processMemoriesForUser } from '../lib/l2/memory';
import { authenticate as authMiddleware } from '../lib/auth';

// Auth API handlers
import { handleConnect } from './auth/connect';
import { handleVerifyEmail, handleResendVerification } from './auth/verify-email';
import { handleGetMe, handleUpdateMe } from './auth/me';
import { handleLogout } from './auth/logout';
import { handleRecover, handleRecoverConfirm } from './auth/recover';
import { handleGetUser } from './auth/users';

// ============================================================
// 用户认证（Phase 0 升级版）
//   1. 新用户系统：Bearer Token → D1 sessions 表 → users 表
//   2. ADMIN_TOKEN — 后台 token，向后兼容
//   3. 旧 USER_TOKEN — 向后兼容（逗号分隔，逐步迁移）
// ============================================================
async function isAuthenticated(request: Request, env: Env): Promise<boolean> {
  // 先试新鉴权
  const authResult = await authMiddleware(request, env);
  if (authResult === null) return true; // 新系统通过

  // 回退到旧鉴权（向后兼容）
  const authHeader = request.headers.get('Authorization');
  if (!authHeader) return false;
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader;

  if (env.ADMIN_TOKEN && token === env.ADMIN_TOKEN.trim()) return true;

  if (env.USER_TOKEN) {
    const validTokens = env.USER_TOKEN.split(',').map(t => t.trim()).filter(Boolean);
    if (validTokens.includes(token)) return true;
  }

  return false;
}

// ============================================================
// 路由分发
// ============================================================
async function handleRequest(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const pathname = url.pathname;

  // === 发现层入口（在 /api 之外）===
  if (request.method === 'GET') {
    if (pathname === '/.well-known/agent-manifest.json' || pathname === '/.well-known/ai-manifest.json') return handleAgentManifest(env, request);
    if (pathname === '/llms.txt') return handleLLMsTxt(env, request);
    if (pathname === '/llm.txt') return new Response(null, { status: 301, headers: { Location: '/llms.txt' } });
    if (pathname === '/openapi.yaml') return handleOpenAPI(env, request);
  }

  // === 非 API 路径 → 静态页面 ===
  if (!pathname.startsWith('/api/')) {
    return env.ASSETS.fetch(request);
  }

  // === API 路由 ===
  const path = pathname.slice(5); // 去掉 /api/
  const segments = path.split('/').filter(Boolean);

  // 健康检查
  if (path === 'health' || path === '') {
    return new Response(JSON.stringify(jsonSuccess({ status: 'ok', service: 'cyber-art-universe' })), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    // ================================================================
    // 公开端点
    // ================================================================

    // 内容 — 目录
    if (request.method === 'GET' && path === 'catalog') {
      return listWorks(env, request);
    }

    // 内容 — 作品元数据
    if (request.method === 'GET' && segments[0] === 'content' && segments[1] && !segments[2]) {
      return getWork(env, request, segments[1]);
    }

    // 内容 — 大纲
    if (request.method === 'GET' && segments[0] === 'content' && segments[1] && segments[2] === 'outline' && !segments[3]) {
      return getWorkOutline(env, request, segments[1]);
    }

    // 内容 — 章节
    if (request.method === 'GET' && segments[0] === 'content' && segments[1] && segments[2] === 'sections' && segments[3] && !segments[4]) {
      return getSection(env, request, segments[1], segments[3]);
    }

    // 内容 — 作品内检索
    if (request.method === 'GET' && segments[0] === 'content' && segments[1] && segments[2] === 'retrieve' && !segments[3]) {
      return retrieveInWork(env, request, segments[1]);
    }

    // 内容 — 实体列表
    if (request.method === 'GET' && segments[0] === 'content' && segments[1] && segments[2] === 'entities' && !segments[3]) {
      return listEntities(env, request, segments[1]);
    }

    // 内容 — 实体详情
    if (request.method === 'GET' && segments[0] === 'content' && segments[1] && segments[2] === 'entities' && segments[3] && !segments[4]) {
      return getEntity(env, request, segments[1], segments[3]);
    }

    // 内容 — 时间线
    if (request.method === 'GET' && segments[0] === 'content' && segments[1] && segments[2] === 'timeline' && !segments[3]) {
      return getTimeline(env, request, segments[1]);
    }

    // 内容 — 章节对比
    if (request.method === 'GET' && segments[0] === 'content' && segments[1] && segments[2] === 'compare' && !segments[3]) {
      return compareSections(env, request, segments[1]);
    }

    // 搜索
    if (request.method === 'GET' && segments[0] === 'search' && !segments[1]) {
      return searchContent(env, request);
    }

    // 事件 — feed
    if (request.method === 'GET' && segments[0] === 'events' && segments[1] === 'feed' && !segments[2]) {
      return getEventFeed(env, request);
    }

    // 榜单 — 列表
    if (request.method === 'GET' && segments[0] === 'rankings' && !segments[1]) {
      return listRankings(env, request);
    }

    // 榜单 — 详情
    if (request.method === 'GET' && segments[0] === 'rankings' && segments[1] && !segments[2]) {
      return getRanking(env, request, segments[1]);
    }

    // 订阅 — 查询
    if (request.method === 'GET' && segments[0] === 'subscriptions' && !segments[1]) {
      return listSubscriptions(env, request);
    }

    // 评价 — 查询
    if (request.method === 'GET' && segments[0] === 'reviews' && !segments[1]) {
      return listReviews(env, request);
    }

    // 评价 — 详情
    if (request.method === 'GET' && segments[0] === 'reviews' && segments[1] && !segments[2]) {
      return getReview(env, request, segments[1]);
    }

    // 评价 — 提交
    if (request.method === 'POST' && segments[0] === 'reviews' && !segments[1]) {
      return submitReview(env, request);
    }

    // 评价 — 点赞
    if (request.method === 'POST' && segments[0] === 'reviews' && segments[1] && segments[2] === 'like' && !segments[3]) {
      return likeReview(env, request, segments[1]);
    }

    // ================================================================
    // 互动端点（Phase 1：点赞/评论/赞赏）
    // ================================================================

    // 点赞
    if (request.method === 'POST' && segments[0] === 'interactions' && segments[1] === 'like' && !segments[2]) {
      const authErr = await authMiddleware(request, env);
      if (authErr) return authErr;
      const { handleLike } = await import('./interactions/like');
      return handleLike(env, request);
    }

    // 评论
    if (request.method === 'POST' && segments[0] === 'interactions' && segments[1] === 'comment' && !segments[2]) {
      const authErr = await authMiddleware(request, env);
      if (authErr) return authErr;
      const { handleComment } = await import('./interactions/comment');
      return handleComment(env, request);
    }

    // 赞赏
    if (request.method === 'POST' && segments[0] === 'interactions' && segments[1] === 'applaud' && !segments[2]) {
      const authErr = await authMiddleware(request, env);
      if (authErr) return authErr;
      const { handleApplaud } = await import('./interactions/applaud');
      return handleApplaud(env, request);
    }

    // 订阅 — 创建
    if (request.method === 'POST' && segments[0] === 'subscriptions' && !segments[1]) {
      return createSubscription(env, request);
    }

    // 订阅 — 取消
    if (request.method === 'DELETE' && segments[0] === 'subscriptions' && segments[1] && !segments[2]) {
      return deleteSubscription(env, request, segments[1]);
    }

    // MCP
    if (request.method === 'POST' && segments[0] === 'mcp' && !segments[1]) {
      return handleMCP(env, request);
    }

    // ================================================================
    // Auth 端点（Phase 0：用户账户系统）
    // ================================================================

    // 统一登录/注册（v2：用邮箱 + 密钥，自动识别）
    if (request.method === 'POST' && segments[0] === 'auth' && segments[1] === 'connect' && !segments[2]) {
      return handleConnect(env, request);
    }

    // 登出（需鉴权）
    if (request.method === 'POST' && segments[0] === 'auth' && segments[1] === 'logout' && !segments[2]) {
      const authErr = await authMiddleware(request, env);
      if (authErr) return authErr;
      return handleLogout(env, request);
    }

    // 我的信息（需鉴权）
    if (segments[0] === 'auth' && segments[1] === 'me' && !segments[2]) {
      const authErr = await authMiddleware(request, env);
      if (authErr) return authErr;
      if (request.method === 'GET') return handleGetMe(env, request);
      if (request.method === 'PUT') return handleUpdateMe(env, request);
    }

    // 邮箱验证（需鉴权）
    if (request.method === 'POST' && segments[0] === 'auth' && segments[1] === 'verify-email' && !segments[2]) {
      const authErr = await authMiddleware(request, env);
      if (authErr) return authErr;
      return handleVerifyEmail(env, request);
    }

    // 重新发送验证码（需鉴权）
    if (request.method === 'POST' && segments[0] === 'auth' && segments[1] === 'resend-verification' && !segments[2]) {
      const authErr = await authMiddleware(request, env);
      if (authErr) return authErr;
      return handleResendVerification(env, request);
    }

    // 账户恢复 — 发起
    if (request.method === 'POST' && segments[0] === 'auth' && segments[1] === 'recover' && !segments[2]) {
      return handleRecover(env, request);
    }

    // 账户恢复 — 确认
    if (request.method === 'POST' && segments[0] === 'auth' && segments[1] === 'recover-confirm' && !segments[2]) {
      return handleRecoverConfirm(env, request);
    }

    // 用户公开档案
    if (request.method === 'GET' && segments[0] === 'users' && segments[1] && !segments[2]) {
      return handleGetUser(env, request, segments[1]);
    }

    // ================================================================
    // 内部端点（Cron fan-out 分发，无需鉴权）
    // ================================================================
    if (segments[0] === 'internal' && segments[1] === 'cron-memory') {
      return handleInternalCronMemory(env, request);
    }

    // Write 侧（Story Forger）
    // ================================================================
    if (segments[0] === 'write') {
      if (!(await isAuthenticated(request, env))) {
        return new Response(JSON.stringify(jsonError(ErrorCodes.AUTH_REQUIRED, 'Authentication required')), {
          status: 401, headers: { 'Content-Type': 'application/json' },
        });
      }
      return handleWriteRoute(env, request, segments.slice(1));
    }

    // 未匹配
    return new Response(JSON.stringify(jsonError(ErrorCodes.NOT_FOUND, 'Endpoint not found')), {
      status: 404, headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('Unhandled error:', err);
    return new Response(JSON.stringify(jsonError(ErrorCodes.INTERNAL_ERROR, 'Internal server error')), {
      status: 500, headers: { 'Content-Type': 'application/json' },
    });
  }
}

// ============================================================
// Workers 入口
// ============================================================
// 内部端点：/api/internal/cron-memory?user_token=xxx
// 由 Cron fan-out 触发，每个 Worker invocation 处理一个用户。
// 无需鉴权（同一 Worker 内部调用）。
// ============================================================
async function handleInternalCronMemory(env: Env, request: Request): Promise<Response> {
  const url = new URL(request.url);
  const userToken = url.searchParams.get('user_token');
  if (!userToken) {
    return new Response(JSON.stringify(jsonError(ErrorCodes.MISSING_REQUIRED_FIELD, 'user_token required')), {
      status: 400, headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const result = await processMemoriesForUser(env, userToken);
    console.log(`[cron:${userToken}] STM=${result.stm_extracted} LTM=${result.ltm_extracted} sessions=${result.sessions}`);
    return new Response(JSON.stringify(jsonSuccess(result)), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error(`[cron:${userToken}] 失败:`, (err as Error).message);
    return new Response(JSON.stringify(jsonError(ErrorCodes.INTERNAL_ERROR, (err as Error).message)), {
      status: 500, headers: { 'Content-Type': 'application/json' },
    });
  }
}

// ============================================================
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    return handleRequest(request, env);
  },

  // Cron 定时任务：每天凌晨 3:00 执行记忆提取（"睡眠"）
  // - 浅睡：L1→L2 STM 增量合并（每天）
  // - 深睡：L2→L3 LTM 画像提炼（距上次 ≥ 3 天时自动触发）
  //
  // Fan-out 分批并发架构：
  //   每批 50 个用户并发 fetch 到内部端点 → Cloudflare 自动分布到多实例。
  //   批次间串行，避免子请求风暴。日志同时写 console + R2 system/logs/。
  async scheduled(_controller: ScheduledController, env: Env): Promise<void> {
    const runStartedAt = new Date();
    const todayStr = runStartedAt.toISOString().slice(0, 10);
    console.log(`[cron] ====== 记忆提取开始 ${todayStr} ======`);
    const dates = [
      todayStr,
      new Date(runStartedAt.getTime() - 86400000).toISOString().slice(0, 10),
    ];

    // 系统日志结构（最终写入 R2）
    const systemLog: {
      date: string;
      started_at: string;
      total_users_found: number;
      batches: Array<{
        batch: number;
        total_batches: number;
        users_in_batch: number;
        success: number;
        stm_extracted: number;
        ltm_extracted: number;
        failed: Array<{ user: string; reason: string }>;
      }>;
      summary: { success: number; failed: number; stm: number; ltm: number };
    } = {
      date: todayStr,
      started_at: runStartedAt.toISOString(),
      total_users_found: 0,
      batches: [],
      summary: { success: 0, failed: 0, stm: 0, ltm: 0 },
    };

    try {
      const userTokens = await discoverActiveUsers(env, dates);
      systemLog.total_users_found = userTokens.length;
      console.log(`[cron] 发现 ${userTokens.length} 个活跃用户`);

      if (userTokens.length === 0) {
        console.log('[cron] 无活跃用户，跳过');
        return;
      }

      const BATCH_SIZE = 50;
      let globalSuccess = 0, globalFail = 0, globalSTM = 0, globalLTM = 0;

      for (let i = 0; i < userTokens.length; i += BATCH_SIZE) {
        const batchTokens = userTokens.slice(i, i + BATCH_SIZE);
        const batchNum = Math.floor(i / BATCH_SIZE) + 1;
        const totalBatches = Math.ceil(userTokens.length / BATCH_SIZE);
        const batchStartedAt = Date.now();

        // 批内并发：每个用户通过 Service Binding 触发独立 Worker invocation
        // env.SELF.fetch → Cloudflare 内部控制面路由 → 每个 fetch 是一个独立实例
        // 不走公网 DNS，无 HTTP 522 问题。1000 个用户 ≈ 1000 个并发 Worker
        const results = await Promise.allSettled(
          batchTokens.map(async (userToken) => {
            try {
              const url = new URL('/api/internal/cron-memory', 'https://internal');
              url.searchParams.set('user_token', userToken);
              const res = await env.SELF.fetch(url.toString(), { method: 'POST' });
              if (!res.ok) return { user: userToken, status: 'error' as const, error: `HTTP ${res.status}` };
              const body = await res.json() as { ok: boolean; data?: { stm_extracted: boolean; ltm_extracted: boolean } };
              if (!body.ok) return { user: userToken, status: 'error' as const, error: 'internal endpoint returned ok=false' };
              return { user: userToken, status: 'ok' as const, stm: body.data?.stm_extracted ?? false, ltm: body.data?.ltm_extracted ?? false };
            } catch (err) {
              return { user: userToken, status: 'error' as const, error: (err as Error).message };
            }
          })
        );

        // 统计本批结果
        let batchSuccess = 0, batchSTM = 0, batchLTM = 0;
        const batchFailed: Array<{ user: string; reason: string }> = [];

        for (const r of results) {
          if (r.status === 'fulfilled') {
            if (r.value.status === 'ok') {
              batchSuccess++;
              if (r.value.stm) batchSTM++;
              if (r.value.ltm) batchLTM++;
            } else {
              batchFailed.push({ user: r.value.user, reason: r.value.error || 'unknown' });
            }
          } else {
            // Promise 本身 reject（理论上不会，因为内部 catch 了）
            batchFailed.push({ user: '(unknown)', reason: `Promise rejected: ${String(r.reason)}` });
          }
        }

        globalSuccess += batchSuccess;
        globalFail += batchFailed.length;
        globalSTM += batchSTM;
        globalLTM += batchLTM;

        const batchMs = Date.now() - batchStartedAt;
        const failDetail = batchFailed.length > 0
          ? ` | 失败: ${batchFailed.map(f => `${f.user.substring(0, 16)}(${f.reason})`).join(', ')}`
          : '';
        console.log(`[cron] 批次 ${batchNum}/${totalBatches} 完成 | ${batchSuccess}/${batchTokens.length} 成功 | STM=${batchSTM} LTM=${batchLTM} | ${batchMs}ms${failDetail}`);

        systemLog.batches.push({
          batch: batchNum,
          total_batches: totalBatches,
          users_in_batch: batchTokens.length,
          success: batchSuccess,
          stm_extracted: batchSTM,
          ltm_extracted: batchLTM,
          failed: batchFailed,
        });
      }

      systemLog.summary = { success: globalSuccess, failed: globalFail, stm: globalSTM, ltm: globalLTM };
      console.log(`[cron] ====== 全部完成: ${globalSuccess} 成功 ${globalFail} 失败 | STM=${globalSTM} LTM=${globalLTM} ======`);
    } catch (err) {
      console.error('[cron] 记忆提取致命错误:', (err as Error).message);
      systemLog.summary = { ...systemLog.summary, failed: systemLog.total_users_found };
    } finally {
      // 持久化系统日志到 R2（按天追加，同一天多次运行会覆盖为最新）
      try {
        const logPath = `system/logs/memory-cron/${todayStr}.json`;
        await env.WORKS_BUCKET.put(logPath, JSON.stringify(systemLog, null, 2), {
          httpMetadata: { contentType: 'application/json' },
        });
      } catch (logErr) {
        console.error('[cron] 系统日志写入失败:', (logErr as Error).message);
      }
    }
  },
};
