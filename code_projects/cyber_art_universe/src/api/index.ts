// Cyber Art Universe — 路由分发入口
import { Env } from '../db/schema';
import { jsonSuccess, jsonError } from '../lib/response';
import { ErrorCodes } from '../lib/errors';
import {
  listWorks, getWork, getWorkOutline, getSection,
  createWork, updateWork, deleteWork,
  createSection, updateSection, deleteSection,
} from './works';
import {
  listEntities, getEntity, getTimeline, compareSections,
  createEntity, updateEntity, deleteEntity,
} from './entities';
import { submitReview, listReviews, getReview } from './reviews';
import { getEventFeed, createEvent, listRankings, getRanking } from './events';
import { listSubscriptions, createSubscription, deleteSubscription } from './subscriptions';
import { searchContent, retrieveInWork } from './search';
import { handleAIManifest, handleLLMsTxt, handleOpenAPI } from './discovery';
import { handleMCP } from './mcp';

// ============================================================
// Admin 鉴权
// ============================================================
function isAdmin(request: Request, env: Env): boolean {
  const adminKey = request.headers.get('X-Admin-Key');
  if (!adminKey || !env.ADMIN_KEY) return false;
  return adminKey === env.ADMIN_KEY;
}

// ============================================================
// 路由分发
// ============================================================
async function handleRequest(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const pathname = url.pathname;

  // === 发现层入口（在 /api 之外）===
  if (request.method === 'GET') {
    if (pathname === '/.well-known/ai-manifest.json') return handleAIManifest(env, request);
    if (pathname === '/llms.txt') return handleLLMsTxt(env, request);
    if (pathname === '/openapi.yaml') return handleOpenAPI(env, request);
  }

  // === 非 API 路径 → 静态页面 ===
  if (!pathname.startsWith('/api/')) {
    return env.ASSETS.fetch(request);
  }

  // === API 路由 ===
  const path = pathname.slice(4); // 去掉 /api
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
    // 管理端点（需 Admin 鉴权）
    // ================================================================
    if (segments[0] === 'admin') {
      if (!isAdmin(request, env)) {
        return new Response(JSON.stringify(jsonError(ErrorCodes.ADMIN_KEY_REQUIRED, 'Admin authorization required')), {
          status: 401, headers: { 'Content-Type': 'application/json' },
        });
      }

      const a = segments.slice(1);

      // 作品
      if (request.method === 'POST' && a[0] === 'works' && !a[1]) return createWork(env, request);
      if (request.method === 'PUT' && a[0] === 'works' && a[1] && !a[2]) return updateWork(env, request, a[1]);
      if (request.method === 'DELETE' && a[0] === 'works' && a[1] && !a[2]) return deleteWork(env, request, a[1]);

      // 章节
      if (request.method === 'POST' && a[0] === 'works' && a[1] && a[2] === 'sections' && !a[3]) return createSection(env, request, a[1]);
      if (request.method === 'PUT' && a[0] === 'works' && a[1] && a[2] === 'sections' && a[3] && !a[4]) return updateSection(env, request, a[1], a[3]);
      if (request.method === 'DELETE' && a[0] === 'works' && a[1] && a[2] === 'sections' && a[3] && !a[4]) return deleteSection(env, request, a[1], a[3]);

      // 实体
      if (request.method === 'POST' && a[0] === 'works' && a[1] && a[2] === 'entities' && !a[3]) return createEntity(env, request, a[1]);
      if (request.method === 'PUT' && a[0] === 'works' && a[1] && a[2] === 'entities' && a[3] && !a[4]) return updateEntity(env, request, a[1], a[3]);
      if (request.method === 'DELETE' && a[0] === 'works' && a[1] && a[2] === 'entities' && a[3] && !a[4]) return deleteEntity(env, request, a[1], a[3]);

      // 事件
      if (request.method === 'POST' && a[0] === 'events' && !a[1]) return createEvent(env, request);

      return new Response(JSON.stringify(jsonError(ErrorCodes.NOT_FOUND, 'Admin endpoint not found')), {
        status: 404, headers: { 'Content-Type': 'application/json' },
      });
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
};
