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
import { readForeshadowing } from './write/foreshadowing';
import { readOriginalConcept } from './write/original_concept';

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
      // Read side (novel://)
      { uri: 'novel://catalog', name: 'Work Catalog', description: 'Directory listing of all published works' },
      { uri: 'novel://work/{id}/outline', name: 'Work Outline', description: 'Outline / table of contents for a specific work' },
      { uri: 'novel://work/{id}/section/{sid}', name: 'Chapter Content', description: 'Full content of a specific chapter' },
      { uri: 'novel://work/{id}/entities', name: 'Entity List', description: 'Entities (characters/locations/items) in a work' },
      // Write side (sf://) — SF-050 MCP Resources
      { uri: 'sf://workspace/{id}', name: 'Writing Workspace', description: 'Story Forger workspace overview (auth required)' },
      { uri: 'sf://worldbuilding/{id}', name: 'Setting Bible', description: 'The structured worldbuilding setting bible' },
      { uri: 'sf://foreshadowing/{id}', name: 'Foreshadowing Ledger', description: 'Planned foreshadowing hooks and their development paths' },
      { uri: 'sf://original_concept/{id}', name: 'Original Concept', description: 'Author original inspiration and creative notes (Story Elf FORBIDDEN from modifying)' },
    ],
  })), {
    headers: { 'Content-Type': 'application/json' },
  });
}

// 读取资源
async function handleResourcesRead(env: Env, request: Request, params?: Record<string, unknown>): Promise<Response> {
  const uri = params?.uri as string || '';

  // 先尝试 novel:// URI
  const novelParsed = parseNovelURI(uri);
  if (novelParsed) {
    switch (novelParsed.resource) {
      case 'catalog': return listWorks(env, request);
      case 'outline': {
        if (!novelParsed.workId) return mcpError('work_id required');
        return getWorkOutline(env, request, novelParsed.workId);
      }
      case 'section': {
        if (!novelParsed.workId || !novelParsed.sectionId) return mcpError('work_id and section_id required');
        return getSection(env, request, novelParsed.workId, novelParsed.sectionId);
      }
      case 'entities': {
        if (!novelParsed.workId) return mcpError('work_id required');
        return listEntities(env, request, novelParsed.workId);
      }
    }
  }

  // 再尝试 sf:// URI（Story Forger Write 侧资源）
  const sfParsed = parseSfURI(uri);
  if (sfParsed) {
    switch (sfParsed.resource) {
      case 'workspace': {
        if (!sfParsed.workId) return mcpError('work_id required');
        // workspace = 作品元数据 + 大纲
        return getWorkOutline(env, request, sfParsed.workId);
      }
      case 'worldbuilding': {
        if (!sfParsed.workId) return mcpError('work_id required');
        return readWorldbuilding(env, request, sfParsed.workId);
      }
      case 'foreshadowing': {
        if (!sfParsed.workId) return mcpError('work_id required');
        return readForeshadowing(env, request, sfParsed.workId);
      }
      case 'original_concept': {
        if (!sfParsed.workId) return mcpError('work_id required');
        return readOriginalConcept(env, request, sfParsed.workId);
      }
    }
  }

  return mcpError(`Invalid URI: ${uri}`);
}

// 列出工具
function handleToolsList(): Response {
  return new Response(JSON.stringify(jsonSuccess({
    tools: [
      // Read side tools
      { name: 'search_content', description: 'Semantic search across all content', inputSchema: { type: 'object', properties: { query: { type: 'string' } } } },
      { name: 'get_outline', description: 'Get work outline / table of contents', inputSchema: { type: 'object', properties: { work_id: { type: 'string' } } } },
      { name: 'get_section', description: 'Get full chapter content', inputSchema: { type: 'object', properties: { work_id: { type: 'string' }, section_id: { type: 'string' } } } },
      { name: 'retrieve_relevant_chunks', description: 'Retrieve relevant passages within a work', inputSchema: { type: 'object', properties: { work_id: { type: 'string' }, query: { type: 'string' } } } },
      { name: 'subscribe_to_updates', description: 'Subscribe to content updates', inputSchema: { type: 'object', properties: { user_id: { type: 'string' }, target_type: { type: 'string' }, target_id: { type: 'string' } } } },
      { name: 'get_entity_graph', description: 'Get entity relationship graph', inputSchema: { type: 'object', properties: { work_id: { type: 'string' }, entity_id: { type: 'string' } } } },
      // Write side tools — SF-051 MCP Tools
      { name: 'generate_worldbuilding', description: 'AI generate structured setting bible', inputSchema: { type: 'object', properties: { work_id: { type: 'string' }, prompt: { type: 'string' } }, required: ['work_id'] } },
      { name: 'generate_outline', description: 'AI generate chapter outline with sections', inputSchema: { type: 'object', properties: { work_id: { type: 'string' }, num_chapters: { type: 'number' } }, required: ['work_id'] } },
      { name: 'generate_chapter', description: 'AI generate full chapter draft (Draft v0)', inputSchema: { type: 'object', properties: { work_id: { type: 'string' }, section_id: { type: 'string' } }, required: ['work_id', 'section_id'] } },
      { name: 'check_consistency', description: 'Check chapter against worldbuilding constraints', inputSchema: { type: 'object', properties: { work_id: { type: 'string' }, section_id: { type: 'string' } }, required: ['work_id', 'section_id'] } },
      { name: 'polish_chapter', description: 'AI polish chapter based on check results', inputSchema: { type: 'object', properties: { work_id: { type: 'string' }, section_id: { type: 'string' }, style_notes: { type: 'string' } }, required: ['work_id', 'section_id'] } },
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

function parseSfURI(uri: string): { resource: string; workId?: string } | null {
  const match = uri.match(/^sf:\/\/(workspace|worldbuilding|foreshadowing|original_concept)\/([^/]+)$/);
  if (!match) return null;
  return { resource: match[1], workId: match[2] };
}
