// Story Forger Write 侧路由分发
import { Env } from '../../db/schema';
import { jsonError } from '../../lib/response';
import { ErrorCodes } from '../../lib/errors';
import {
  listMyWorks, createDraftWork, getMyWork, updateMyWork, deleteMyWork,
  previewWork, publishWork, closeWork, reopenWork,
  createSection, updateSection, deleteSection,
  getWorkConfig, updateWorkConfig,
} from './workspace';
import { createCharacter, readCharacterCard, updateCharacterCard, updateEntity, deleteEntity } from './character_card';
import { createForeshadowing, readForeshadowingCard, updateForeshadowingCard } from './foreshadowing_card';
import { readWorldbuilding, updateWorldbuilding, readConstraints } from './worldbuilding';
import { readOutline, updateOutline } from './outline';
import { createIntent, readIntent, outputDraft } from './draft';
import { readForeshadowing, updateForeshadowing } from './foreshadowing';
import { readHints } from './hints';
import { readOriginalConcept, updateOriginalConcept } from './original_concept';
import { handleElfChat } from './elf_chat';
import { getModule, updateModule, listModules, listModuleVersions, diffModuleVersions } from './module';
import { getModuleGuide } from '../../lib/l2/guides';
import { jsonSuccess } from '../../lib/response';
import { extractLang, type Lang } from '../../lib/l1/work-content';
import { handleMemoryTestSetup, handleMemoryTestTeardown, handleMemoryExtractL2, handleMemoryExtractL3 } from './memory-test';

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
  // 实体 CRUD — 按 type 分发到 M3 人物卡 或 M4 伏笔卡
  if (resource === 'works' && resourceId && subResource === 'entities' && !subResourceId && !action) {
    if (request.method === 'POST') {
      const body = await request.clone().json() as { type?: string };
      if (body.type === 'foreshadowing') return createForeshadowing(env, request, resourceId);
      return createCharacter(env, request, resourceId);
    }
  }
  if (resource === 'works' && resourceId && subResource === 'entities' && subResourceId && action === 'card') {
    if (request.method === 'GET' || request.method === 'PUT') {
      const entity = await env.DB.prepare('SELECT type FROM entities WHERE id = ? AND work_id = ?').bind(subResourceId, resourceId).first<{ type: string }>();
      if (!entity) return new Response(JSON.stringify(jsonError(ErrorCodes.ENTITY_NOT_FOUND, 'Entity not found')), { status: 404, headers: { 'Content-Type': 'application/json' } });
      if (entity.type === 'foreshadowing') {
        if (request.method === 'GET') return readForeshadowingCard(env, request, resourceId, subResourceId);
        if (request.method === 'PUT') return updateForeshadowingCard(env, request, resourceId, subResourceId);
      } else {
        if (request.method === 'GET') return readCharacterCard(env, request, resourceId, subResourceId);
        if (request.method === 'PUT') return updateCharacterCard(env, request, resourceId, subResourceId);
      }
    }
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
  if (resource === 'works' && resourceId && subResource === 'config' && !action) {
    if (request.method === 'GET') return getWorkConfig(env, resourceId);
    if (request.method === 'PUT') return updateWorkConfig(env, request, resourceId);
  }

  // ================================================================
  // V3 统一 Module API
  // ================================================================
  if (resource === 'modules' && !resourceId && !subResource) {
    if (request.method === 'GET') return listModules(env, request);
  }
  if (resource === 'module' && resourceId && !subResource && !subResourceId) {
    if (request.method === 'GET') return getModule(env, request, resourceId);
    if (request.method === 'PUT') return updateModule(env, request, resourceId);
  }
  // V4: 版本历史 & diff
  if (resource === 'module' && resourceId && subResource === 'versions' && !subResourceId) {
    if (request.method === 'GET') return listModuleVersions(env, request, resourceId);
  }
  if (resource === 'module' && resourceId && subResource === 'diff' && !subResourceId) {
    if (request.method === 'GET') return diffModuleVersions(env, request, resourceId);
  }

  if (resource === 'worldbuilding') {
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
    if (resourceId === 'output' && subResource && !subResourceId && !action && request.method === 'GET') return outputDraft(env, request, subResource);
  }

  // ================================================================
  // 伏笔账本 (SF-023)
  // ================================================================
  if (resource === 'foreshadowing') {
    if (resourceId && !subResource && !action) {
      if (request.method === 'GET') return readForeshadowing(env, request, resourceId);
      if (request.method === 'PUT') return updateForeshadowing(env, request, resourceId);
    }
  }

  // ================================================================
  // 智能提示 (SF-067) — 静态 + Story Elf 动态
  // ================================================================
  if (resource === 'hints' && resourceId && !subResource && !action) {
    if (request.method === 'GET') return readHints(env, request, resourceId);
  }

  // ================================================================
  // Story Elf 对话 (SF-055 / SF-056)
  // ================================================================
  if (resource === 'elf' && resourceId === 'chat' && !subResource && !action) {
    if (request.method === 'POST') return handleElfChat(env, request);
  }

  // ================================================================
  // 写作指南 — 按模块类型获取 M0-M6 写作指南（供外部 Agent / Story Elf 工具调用）
  // ================================================================
  if (resource === 'guide' && resourceId && !subResource && !action) {
    if (request.method === 'GET') {
      const lang = extractLang(request);
      const guide = getModuleGuide(resourceId, lang as Lang);
      return new Response(JSON.stringify(jsonSuccess({ module_type: resourceId, lang, guide })), {
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
      });
    }
  }

  // ================================================================
  // 记忆系统测试辅助（写入/清理预制的测试记忆数据）
  // ================================================================
  if (resource === 'memory-test' && resourceId === 'setup' && !subResource && !action) {
    if (request.method === 'POST') return handleMemoryTestSetup(env, request);
  }
  if (resource === 'memory-test' && resourceId === 'teardown' && !subResource && !action) {
    if (request.method === 'POST') return handleMemoryTestTeardown(env, request);
  }
  if (resource === 'memory-test' && resourceId === 'extract-l2' && !subResource && !action) {
    if (request.method === 'POST') return handleMemoryExtractL2(env, request);
  }
  if (resource === 'memory-test' && resourceId === 'extract-l3' && !subResource && !action) {
    if (request.method === 'POST') return handleMemoryExtractL3(env, request);
  }

  // ================================================================
  // 营销辅助 (SF-040~042)
  // ================================================================
  return new Response(JSON.stringify(jsonError(ErrorCodes.NOT_FOUND, 'Write endpoint not found')), {
    status: 404, headers: { 'Content-Type': 'application/json' },
  });
}
