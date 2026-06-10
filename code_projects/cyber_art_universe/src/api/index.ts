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

// ============================================================
// 用户认证
//   ADMIN_TOKEN — 后台固定 token，永久有效（Claude / 自动化任务）
//   USER_TOKEN   — 用户 token，当前逗号分隔硬编码，未来替换为实时登录
// ============================================================
function isAuthenticated(request: Request, env: Env): boolean {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader) return false;
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader;

  // Admin token：固定值，独立校验，不随 USER_TOKEN 变化
  if (env.ADMIN_TOKEN && token === env.ADMIN_TOKEN.trim()) return true;

  // User token：当前逗号分隔的硬编码列表（未来由实时登录系统替换）
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
    // 内部端点（Cron fan-out 分发，无需鉴权）
    // ================================================================
    if (segments[0] === 'internal' && segments[1] === 'cron-memory') {
      return handleInternalCronMemory(env, request);
    }

    // Write 侧（Story Forger）
    // ================================================================
    if (segments[0] === 'write') {
      if (!isAuthenticated(request, env)) {
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
  // Fan-out 架构：每个用户触发一个独立的 Worker invocation，
  // Cloudflare 自动分布到多实例并发。1000 个用户和 10 个用户的耗时几乎一样。
  // 内部端点 /api/internal/cron-memory 无需鉴权（同 Worker 内部调用），
  // 无需重试（catch 跳过），无需幂等（标志位天然保护）。
  async scheduled(_controller: ScheduledController, env: Env): Promise<void> {
    console.log('[cron] 记忆提取开始（fan-out 模式）...');
    const today = new Date();
    const dates = [
      today.toISOString().slice(0, 10),
      new Date(today.getTime() - 86400000).toISOString().slice(0, 10),
    ];

    try {
      const userTokens = await discoverActiveUsers(env, dates);
      console.log(`[cron] 发现 ${userTokens.length} 个活跃用户，开始并发分发...`);

      if (userTokens.length === 0) {
        console.log('[cron] 无活跃用户，跳过');
        return;
      }

      // 分批并发：每批 N 个用户同时 fetch → Cloudflare 自动分布到多实例。
      // 批次大小受 Worker 子请求上限约束（Bundled 50 / Unbound 1000），
      // 取保守值 50，兼容所有付费计划。
      const BATCH_SIZE = 50;
      let success = 0, stmCount = 0, ltmCount = 0;

      for (let i = 0; i < userTokens.length; i += BATCH_SIZE) {
        const batch = userTokens.slice(i, i + BATCH_SIZE);
        const batchNum = Math.floor(i / BATCH_SIZE) + 1;
        const totalBatches = Math.ceil(userTokens.length / BATCH_SIZE);

        const results = await Promise.allSettled(
          batch.map(async (userToken) => {
            const url = new URL('/api/internal/cron-memory', 'https://cau.turingcorp.net');
            url.searchParams.set('user_token', userToken);
            const res = await fetch(url.toString(), { method: 'POST' });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            return await res.json() as { ok: boolean; data?: { stm_extracted: boolean; ltm_extracted: boolean } };
          })
        );

        for (const r of results) {
          if (r.status === 'fulfilled' && r.value?.ok) {
            success++;
            if (r.value.data?.stm_extracted) stmCount++;
            if (r.value.data?.ltm_extracted) ltmCount++;
          }
        }
        console.log(`[cron] 批次 ${batchNum}/${totalBatches} 完成 (${batch.length} 用户)`);
      }
      console.log(`[cron] 全部完成: ${success}/${userTokens.length} 成功, STM=${stmCount} LTM=${ltmCount}`);
    } catch (err) {
      console.error('[cron] 记忆提取失败:', (err as Error).message);
    }
  },
};
