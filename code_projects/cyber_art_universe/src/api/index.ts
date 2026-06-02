// Cyber Art Universe — 路由分发入口
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
import { extractL1toL2, extractL2toL3IfDue } from '../lib/l2/memory';

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
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    return handleRequest(request, env);
  },

  // Cron 定时任务：每天凌晨 3:00 执行记忆提取（"睡眠"）
  async scheduled(_controller: ScheduledController, env: Env): Promise<void> {
    console.log('[cron] 记忆提取开始...');
    try {
      const result = await extractL1toL2(env);
      console.log(`[cron] L1→L2 完成: ${result.users_processed} 用户, ${result.sessions_extracted} 会话`);

      // L2→L3 条件触发（仅对本次有新会话的用户）
      if (result.users_processed > 0) {
        // 由于 extractL1toL2 已处理了所有用户，这里简单记录
        // L2→L3 的触发条件在 extractL2toL3IfDue 内部检查
        console.log('[cron] L2→L3 检查待后续完善（需逐个用户调用 extractL2toL3IfDue）');
      }
    } catch (err) {
      console.error('[cron] 记忆提取失败:', (err as Error).message);
    }
  },
};
