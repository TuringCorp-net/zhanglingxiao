// Story Forger Write 侧路由分发
import { Env } from '../../db/schema';
import { jsonError } from '../../lib/response';
import { ErrorCodes } from '../../lib/errors';
import {
  listMyWorks, createDraftWork, getMyWork, updateMyWork, deleteMyWork,
  previewWork, publishWork, closeWork, reopenWork,
} from './workspace';
import { generateWorldbuilding, readWorldbuilding, updateWorldbuilding, readConstraints } from './worldbuilding';
import { generateOutline, readOutline, updateOutline } from './outline';
import { createIntent, generateDraft, checkConsistency, polishDraft, outputDraft } from './draft';

export async function handleWriteRoute(env: Env, request: Request, segments: string[]): Promise<Response> {
  const [resource, resourceId, subResource, subResourceId, action] = segments;

  // ================================================================
  // 工作区
  // ================================================================
  if (resource === 'works' && !resourceId && !subResource) {
    if (request.method === 'GET') return listMyWorks(env, request);
    if (request.method === 'POST') return createDraftWork(env, request);
  }
  if (resource === 'works' && resourceId && !subResource && !action) {
    if (request.method === 'GET') return getMyWork(env, request, resourceId);
    if (request.method === 'PUT') return updateMyWork(env, request, resourceId);
    if (request.method === 'DELETE') return deleteMyWork(env, request, resourceId);
  }
  if (resource === 'works' && resourceId && subResource === 'preview' && !action) {
    if (request.method === 'GET') return previewWork(env, request, resourceId);
  }
  if (resource === 'works' && resourceId && subResource === 'publish' && !action) {
    if (request.method === 'PATCH') return publishWork(env, request, resourceId);
  }
  if (resource === 'works' && resourceId && subResource === 'close' && !action) {
    if (request.method === 'PATCH') return closeWork(env, request, resourceId);
  }
  if (resource === 'works' && resourceId && subResource === 'reopen' && !action) {
    if (request.method === 'PATCH') return reopenWork(env, request, resourceId);
  }

  if (resource === 'worldbuilding') {
    if (resourceId === 'generate' && !subResource && request.method === 'POST') return generateWorldbuilding(env, request);
    if (resourceId && subResource === 'constraints' && !action && request.method === 'GET') return readConstraints(env, request, resourceId);
    if (resourceId && !subResource && !action) {
      if (request.method === 'GET') return readWorldbuilding(env, request, resourceId);
      if (request.method === 'PUT') return updateWorldbuilding(env, request, resourceId);
    }
  }

  // ================================================================
  // 大纲
  // ================================================================
  if (resource === 'outline') {
    if (resourceId === 'generate' && !subResource && request.method === 'POST') return generateOutline(env, request);
    if (resourceId && !subResource && !action) {
      if (request.method === 'GET') return readOutline(env, request, resourceId);
      if (request.method === 'PUT') return updateOutline(env, request, resourceId);
    }
  }

  // ================================================================
  // 章节生产
  // ================================================================
  if (resource === 'draft') {
    // POST /api/write/draft/intent
    if (resourceId === 'intent' && !subResource && request.method === 'POST') return createIntent(env, request);
    // POST /api/write/draft/generate
    if (resourceId === 'generate' && !subResource && request.method === 'POST') return generateDraft(env, request);
    // POST /api/write/draft/polish
    if (resourceId === 'polish' && !subResource && request.method === 'POST') return polishDraft(env, request);
    // POST /api/write/draft/check/{work_id}/{section_id}
    if (resourceId === 'check' && subResource && subResourceId && !action && request.method === 'POST') return checkConsistency(env, request, subResource, subResourceId);
    // GET /api/write/draft/output/{section_id}
    if (resourceId === 'output' && subResource && !subResourceId && !action && request.method === 'GET') return outputDraft(env, request, subResource);
  }

  return new Response(JSON.stringify(jsonError(ErrorCodes.NOT_FOUND, 'Write endpoint not found')), {
    status: 404, headers: { 'Content-Type': 'application/json' },
  });
}
