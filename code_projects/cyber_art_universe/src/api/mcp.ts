// MCP 集成 — 将 API 暴露为 MCP Resources/Tools（Read + Write）
import { Env } from '../db/schema';
import { jsonSuccess, jsonError } from '../lib/response';
import { ErrorCodes } from '../lib/errors';
import { listWorks, getWork, getWorkOutline, getSection } from './works';
import { listEntities, getEntity } from './entities';
import { searchContent, retrieveInWork } from './search';
import { createSubscription } from './subscriptions';
import { readWorldbuilding } from './write/worldbuilding';
import { readOutline } from './write/outline';
import { generateDraft, checkConsistency, polishDraft } from './write/draft';
import { generateWorldbuilding } from './write/worldbuilding';
import { generateOutline } from './write/outline';

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
  return new Response(JSON.stringify(jsonSuccess({
    resources: [
      // Read 侧（novel://）
      { uri: 'novel://catalog', name: '作品目录', description: '所有作品的目录列表' },
      { uri: 'novel://work/{id}/outline', name: '作品大纲', description: '指定作品的大纲/目录' },
      { uri: 'novel://work/{id}/section/{sid}', name: '章节内容', description: '指定章节的内容' },
      { uri: 'novel://work/{id}/entities', name: '实体列表', description: '指定作品的实体列表' },
      // Write 侧（sf://）— SF-050 MCP Resources
      { uri: 'sf://workspace/{id}', name: '写作工作区', description: 'Story Forger 工作区（需认证）' },
      { uri: 'sf://worldbuilding/{id}', name: '世界观设定', description: '作品的设定圣经' },
      { uri: 'sf://foreshadowing/{id}', name: '伏笔账本', description: '作品的伏笔暗线规划与追踪' },
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
      // Read 侧工具
      { name: 'search_content', description: '语义搜索', inputSchema: { type: 'object', properties: { query: { type: 'string' } } } },
      { name: 'get_outline', description: '获取大纲', inputSchema: { type: 'object', properties: { work_id: { type: 'string' } } } },
      { name: 'get_section', description: '获取章节', inputSchema: { type: 'object', properties: { work_id: { type: 'string' }, section_id: { type: 'string' } } } },
      { name: 'retrieve_relevant_chunks', description: '检索相关段落', inputSchema: { type: 'object', properties: { work_id: { type: 'string' }, query: { type: 'string' } } } },
      { name: 'subscribe_to_updates', description: '订阅更新', inputSchema: { type: 'object', properties: { user_id: { type: 'string' }, target_type: { type: 'string' }, target_id: { type: 'string' } } } },
      { name: 'get_entity_graph', description: '获取实体关系图', inputSchema: { type: 'object', properties: { work_id: { type: 'string' }, entity_id: { type: 'string' } } } },
      // Write 侧工具 — SF-051 MCP Tools
      { name: 'generate_worldbuilding', description: 'AI 生成世界观设定', inputSchema: { type: 'object', properties: { work_id: { type: 'string' }, prompt: { type: 'string' } }, required: ['work_id'] } },
      { name: 'generate_outline', description: 'AI 生成大纲', inputSchema: { type: 'object', properties: { work_id: { type: 'string' }, num_chapters: { type: 'number' } }, required: ['work_id'] } },
      { name: 'generate_chapter', description: 'AI 生成章节正文', inputSchema: { type: 'object', properties: { work_id: { type: 'string' }, section_id: { type: 'string' } }, required: ['work_id', 'section_id'] } },
      { name: 'check_consistency', description: '检查章节一致性', inputSchema: { type: 'object', properties: { work_id: { type: 'string' }, section_id: { type: 'string' } }, required: ['work_id', 'section_id'] } },
      { name: 'polish_chapter', description: '润色章节', inputSchema: { type: 'object', properties: { work_id: { type: 'string' }, section_id: { type: 'string' }, style_notes: { type: 'string' } }, required: ['work_id', 'section_id'] } },
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
    // Write 工具 — SF-052 与 REST 共用处理函数
    case 'generate_worldbuilding': {
      const genWbReq = new Request(request.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ work_id: args.work_id, prompt: args.prompt }),
      });
      return generateWorldbuilding(env, genWbReq);
    }
    case 'generate_outline': {
      const genOlReq = new Request(request.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ work_id: args.work_id, num_chapters: args.num_chapters || 5 }),
      });
      return generateOutline(env, genOlReq);
    }
    case 'generate_chapter': {
      const genChReq = new Request(request.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ work_id: args.work_id, section_id: args.section_id }),
      });
      return generateDraft(env, genChReq);
    }
    case 'check_consistency': {
      const checkReq = new Request(request.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      return checkConsistency(env, checkReq, args.work_id as string, args.section_id as string);
    }
    case 'polish_chapter': {
      const polishReq = new Request(request.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ work_id: args.work_id, section_id: args.section_id, style_notes: args.style_notes }),
      });
      return polishDraft(env, polishReq);
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
