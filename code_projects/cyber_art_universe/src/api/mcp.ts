// MCP 集成 — 将 API 暴露为 MCP Resources/Tools
import { Env } from '../db/schema';
import { jsonSuccess, jsonError } from '../lib/response';
import { ErrorCodes } from '../lib/errors';
import { listWorks, getWork, getWorkOutline, getSection } from './works';
import { listEntities, getEntity } from './entities';
import { searchContent, retrieveInWork } from './search';
import { createSubscription } from './subscriptions';

// MCP 请求/响应类型
interface MCPRequest {
  type: 'resources/list' | 'resources/read' | 'tools/list' | 'tools/call';
  params?: Record<string, unknown>;
}

// POST /api/mcp
export async function handleMCP(env: Env, request: Request): Promise<Response> {
  const body = await request.json() as MCPRequest;

  switch (body.type) {
    case 'resources/list':
      return handleResourcesList(env, request);
    case 'resources/read':
      return handleResourcesRead(env, request, body.params);
    case 'tools/list':
      return handleToolsList();
    case 'tools/call':
      return handleToolsCall(env, request, body.params);
    default:
      return mcpError('Unknown method');
  }
}

// 列出资源
async function handleResourcesList(env: Env, request: Request): Promise<Response> {
  // 返回可用资源 URI 模式
  return new Response(JSON.stringify(jsonSuccess({
    resources: [
      { uri: 'novel://catalog', name: '作品目录', description: '所有作品的目录列表' },
      { uri: 'novel://work/{id}/outline', name: '作品大纲', description: '指定作品的大纲/目录' },
      { uri: 'novel://work/{id}/section/{sid}', name: '章节内容', description: '指定章节的内容' },
      { uri: 'novel://work/{id}/entities', name: '实体列表', description: '指定作品的实体列表' },
    ],
  })), {
    headers: { 'Content-Type': 'application/json' },
  });
}

// 读取资源
async function handleResourcesRead(env: Env, request: Request, params?: Record<string, unknown>): Promise<Response> {
  const uri = params?.uri as string || '';
  const parsed = parseNovelURI(uri);

  if (!parsed) {
    return mcpError(`Invalid URI: ${uri}`);
  }

  switch (parsed.resource) {
    case 'catalog': {
      const response = await listWorks(env, request);
      return response;
    }
    case 'outline': {
      if (!parsed.workId) return mcpError('work_id required');
      const response = await getWorkOutline(env, request, parsed.workId);
      return response;
    }
    case 'section': {
      if (!parsed.workId || !parsed.sectionId) return mcpError('work_id and section_id required');
      const response = await getSection(env, request, parsed.workId, parsed.sectionId);
      return response;
    }
    case 'entities': {
      if (!parsed.workId) return mcpError('work_id required');
      const response = await listEntities(env, request, parsed.workId);
      return response;
    }
    default:
      return mcpError(`Unknown resource: ${parsed.resource}`);
  }
}

// 列出工具
function handleToolsList(): Response {
  return new Response(JSON.stringify(jsonSuccess({
    tools: [
      { name: 'search_content', description: '语义搜索', inputSchema: { type: 'object', properties: { query: { type: 'string' } } } },
      { name: 'get_outline', description: '获取大纲', inputSchema: { type: 'object', properties: { work_id: { type: 'string' } } } },
      { name: 'get_section', description: '获取章节', inputSchema: { type: 'object', properties: { work_id: { type: 'string' }, section_id: { type: 'string' } } } },
      { name: 'retrieve_relevant_chunks', description: '检索相关段落', inputSchema: { type: 'object', properties: { work_id: { type: 'string' }, query: { type: 'string' } } } },
      { name: 'subscribe_to_updates', description: '订阅更新', inputSchema: { type: 'object', properties: { user_id: { type: 'string' }, target_type: { type: 'string' }, target_id: { type: 'string' } } } },
      { name: 'get_entity_graph', description: '获取实体关系图', inputSchema: { type: 'object', properties: { work_id: { type: 'string' }, entity_id: { type: 'string' } } } },
    ],
  })), {
    headers: { 'Content-Type': 'application/json' },
  });
}

// 调用工具
async function handleToolsCall(env: Env, request: Request, params?: Record<string, unknown>): Promise<Response> {
  const name = params?.name as string;
  const args = params?.arguments as Record<string, unknown> || {};

  switch (name) {
    case 'search_content': {
      const q = args.query as string || '';
      const searchReq = new Request(`${request.url}?q=${encodeURIComponent(q)}`);
      return searchContent(env, searchReq);
    }
    case 'get_outline': {
      const workId = args.work_id as string || '';
      return getWorkOutline(env, request, workId);
    }
    case 'get_section': {
      const workId = args.work_id as string || '';
      const sectionId = args.section_id as string || '';
      return getSection(env, request, workId, sectionId);
    }
    case 'retrieve_relevant_chunks': {
      const workId = args.work_id as string || '';
      const query = args.query as string || '';
      const retrieveReq = new Request(`${request.url}?query=${encodeURIComponent(query)}`);
      return retrieveInWork(env, retrieveReq, workId);
    }
    case 'subscribe_to_updates': {
      const subReq = new Request(request.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: args.user_id,
          subscribe_type: args.target_type,
          target_id: args.target_id,
        }),
      });
      return createSubscription(env, subReq);
    }
    case 'get_entity_graph': {
      const workId = args.work_id as string || '';
      const entityId = args.entity_id as string || '';
      return getEntity(env, request, workId, entityId);
    }
    default:
      return mcpError(`Unknown tool: ${name}`);
  }
}

// ============================================================
// 辅助函数
// ============================================================

function mcpError(message: string): Response {
  return new Response(JSON.stringify(jsonError(ErrorCodes.INVALID_PARAMS, message)), {
    status: 400, headers: { 'Content-Type': 'application/json' },
  });
}

function parseNovelURI(uri: string): { resource: string; workId?: string; sectionId?: string } | null {
  // novel://catalog
  if (uri === 'novel://catalog') return { resource: 'catalog' };

  const match = uri.match(/^novel:\/\/work\/([^/]+)\/([^/]+)(?:\/([^/]+))?$/);
  if (!match) return null;

  const [, workId, resource, sectionId] = match;
  if (resource === 'outline') return { resource: 'outline', workId };
  if (resource === 'section' && sectionId) return { resource: 'section', workId, sectionId };
  if (resource === 'entities') return { resource: 'entities', workId };

  return null;
}
