// Story Forger Write 侧路由分发
import { Env } from '../../db/schema';
import { jsonError } from '../../lib/response';
import { ErrorCodes } from '../../lib/errors';
import {
  listMyWorks, createDraftWork, getMyWork, updateMyWork, deleteMyWork,
  previewWork, publishWork, closeWork, reopenWork,
  createSection, updateSection, deleteSection,
} from './workspace';
import { createEntity, updateEntity, deleteEntity, readCharacterCard } from './entities';
import { generateWorldbuilding, readWorldbuilding, updateWorldbuilding, readConstraints } from './worldbuilding';
import { generateOutline, readOutline, updateOutline } from './outline';
import { createIntent, readIntent, generateDraft, checkConsistency, polishDraft, outputDraft, rewriteSection } from './draft';
import { generateForeshadowing, readForeshadowing, updateForeshadowing } from './foreshadowing';
import { extractHooks, generateTitles, repurposeSection } from './marketing';
import { readOriginalConcept, updateOriginalConcept } from './original_concept';
import { handleElfChat } from './elf_chat';

export async function handleWriteRoute(env: Env, request: Request, segments: string[]): Promise<Response> {
  const [resource, resourceId, subResource, subResourceId, action] = segments;

  // ================================================================
  // 工作区
  // ================================================================
  if (resource === 'works' && !resourceId && !subResource) {
    if (request.method === 'GET') return listMyWorks(env, request);
    if (request.method === 'POST') return createDraftWork(env, request);
  }
  if (resource === 'works' && resourceId && subResource === 'sections' && !subResourceId && !action) {
    if (request.method === 'POST') return createSection(env, request, resourceId);
  }
  if (resource === 'works' && resourceId && subResource === 'sections' && subResourceId && !action) {
    if (request.method === 'PUT') return updateSection(env, request, resourceId, subResourceId);
    if (request.method === 'DELETE') return deleteSection(env, request, resourceId, subResourceId);
  }
  if (resource === 'works' && resourceId && subResource === 'entities' && !subResourceId && !action) {
    if (request.method === 'POST') return createEntity(env, request, resourceId);
  }
  if (resource === 'works' && resourceId && subResource === 'entities' && subResourceId && action === 'card') {
    if (request.method === 'GET') return readCharacterCard(env, request, resourceId, subResourceId);
  }
  if (resource === 'works' && resourceId && subResource === 'entities' && subResourceId && !action) {
    if (request.method === 'PUT') return updateEntity(env, request, resourceId, subResourceId);
    if (request.method === 'DELETE') return deleteEntity(env, request, resourceId, subResourceId);
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
  // M0 原始构想（Story Elf 禁止修改，外部 AI/Agent 视为作者可读写）
  // ================================================================
  if (resource === 'original-concept') {
    if (resourceId && !subResource && !action) {
      if (request.method === 'GET') return readOriginalConcept(env, request, resourceId);
      if (request.method === 'PUT') return updateOriginalConcept(env, request, resourceId);
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
    if (resourceId === 'intent' && !subResource && request.method === 'POST') return createIntent(env, request);
    if (resourceId === 'intent' && subResource && subResourceId && !action) {
      if (request.method === 'GET') return readIntent(env, request, subResource, subResourceId);
    }
    if (resourceId === 'generate' && !subResource && request.method === 'POST') return generateDraft(env, request);
    if (resourceId === 'polish' && !subResource && request.method === 'POST') return polishDraft(env, request);
    if (resourceId === 'rewrite' && subResource && !subResourceId && !action && request.method === 'POST') return rewriteSection(env, request, subResource);
    if (resourceId === 'check' && subResource && subResourceId && !action && request.method === 'POST') return checkConsistency(env, request, subResource, subResourceId);
    if (resourceId === 'output' && subResource && !subResourceId && !action && request.method === 'GET') return outputDraft(env, request, subResource);
  }

  // ================================================================
  // 伏笔账本 (SF-023)
  // ================================================================
  if (resource === 'foreshadowing') {
    if (resourceId === 'generate' && !subResource && request.method === 'POST') return generateForeshadowing(env, request);
    if (resourceId && !subResource && !action) {
      if (request.method === 'GET') return readForeshadowing(env, request, resourceId);
      if (request.method === 'PUT') return updateForeshadowing(env, request, resourceId);
    }
  }

  // ================================================================
  // Story Elf 对话 (SF-055 / SF-056)
  // ================================================================
  if (resource === 'elf' && resourceId === 'chat' && !subResource && !action) {
    if (request.method === 'POST') return handleElfChat(env, request);
  }

  // ================================================================
  // 营销辅助 (SF-040~042)
  // ================================================================
  if (resource === 'marketing') {
    if (resourceId === 'extract' && subResource && !subResourceId && !action && request.method === 'POST') return extractHooks(env, request, subResource);
    if (resourceId === 'titles' && subResource && !subResourceId && !action && request.method === 'POST') return generateTitles(env, request, subResource);
    if (resourceId === 'repurpose' && subResource && !subResourceId && !action && request.method === 'POST') return repurposeSection(env, request, subResource);
  }

  return new Response(JSON.stringify(jsonError(ErrorCodes.NOT_FOUND, 'Write endpoint not found')), {
    status: 404, headers: { 'Content-Type': 'application/json' },
  });
}
