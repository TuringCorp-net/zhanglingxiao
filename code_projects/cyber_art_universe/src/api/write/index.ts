/**
 * Story Forger Write 侧路由分发 — V4
 *
 * 全部写作交互统一通过 Story Elf 对话完成。API 收敛为三套体系:
 *   GET  — 读取 work / module 内容
 *   PUT/POST — 写入 work / module 内容 (Agent 只写 free_content)
 *   Chat — Story Elf 对话式协作
 *
 * 路由:
 *   工作区 (workspace.ts):
 *     GET    /api/write/works                — listMyWorks
 *     POST   /api/write/works                — createDraftWork
 *     GET    /api/write/works/{id}           — getMyWork
 *     PUT    /api/write/works/{id}           — updateMyWork
 *     DELETE /api/write/works/{id}           — deleteMyWork
 *     GET    /api/write/works/{id}/preview   — previewWork
 *     PATCH  /api/write/works/{id}/publish   — publishWork
 *     PATCH  /api/write/works/{id}/close     — closeWork
 *     PATCH  /api/write/works/{id}/reopen    — reopenWork
 *     GET    /api/write/works/{id}/config    — getWorkConfig
 *     PUT    /api/write/works/{id}/config    — updateWorkConfig
 *
 *   用户配置 (user_config.ts):
 *     GET    /api/write/me/config            — getUserConfig
 *     PUT    /api/write/me/config            — updateUserConfig
 *     POST   /api/write/works/{id}/sections  — createSection
 *     PUT    /api/write/works/{id}/sections/{sid} — updateSection
 *     DELETE /api/write/works/{id}/sections/{sid} — deleteSection
 *
 *   Module API (module.ts):
 *     GET    /api/write/module/{id}           — getModule
 *     PUT    /api/write/module/{id}           — updateModule
 *     GET    /api/write/modules               — listModules
 *     GET    /api/write/module/{id}/versions  — listModuleVersions
 *     GET    /api/write/module/{id}/diff      — diffModuleVersions
 *
 *   Story Elf (elf_chat.ts):
 *     POST   /api/write/elf/chat              — handleElfChat
 *     GET    /api/write/elf/conversation      — handleGetConversation (前端加载对话历史)
 *
 *   写作指南:
 *     GET    /api/write/guide/{module_type}   — getModuleGuide
 *
 *   测试:
 *     POST   /api/write/memory-test/setup       — 写入测试记忆数据
 *     POST   /api/write/memory-test/teardown    — 清理测试记忆数据
 *     POST   /api/write/memory-test/extract-l2  — 手动触发 STM 合并
 *     POST   /api/write/memory-test/extract-l3  — 手动触发 LTM 合并
 *     GET    /api/write/memory-test/read-l1     — 读取 L1 日志 (admin)
 *     GET    /api/write/memory-test/read-l2     — 读取 STM final (admin)
 *     GET    /api/write/memory-test/read-l3     — 读取 LTM final (admin)
 */
import { Env } from '../../db/schema';
import { jsonError } from '../../lib/response';
import { ErrorCodes } from '../../lib/errors';
import {
  listMyWorks, createDraftWork, getMyWork, updateMyWork, deleteMyWork,
  previewWork, publishWork, closeWork, reopenWork,
  createSection, updateSection, deleteSection,
  getWorkConfig, updateWorkConfig,
} from './workspace';
import { getModule, updateModule, deleteModule, listModules, createCard, listModuleVersions, diffModuleVersions } from './module';
import { handleElfChat, handleGetConversation, handlePutConversation } from './elf_chat';
import { getModuleGuide } from '../../lib/l2/guides';
import { jsonSuccess } from '../../lib/response';
import { extractLang, type Lang } from '../../lib/l1/work-content';
import { handleMemoryTestSetup, handleMemoryTestTeardown, handleMemoryExtractL2, handleMemoryExtractL3, handleMemoryReset, handleMemoryReadL1, handleMemoryReadL2, handleMemoryReadL3 } from './memory-test';
import { handleMemoryEval, handleMemoryEvalResults } from './memory-eval';
import { getUserConfig, updateUserConfig } from './user_config';

export async function handleWriteRoute(env: Env, request: Request, segments: string[], ctx?: ExecutionContext): Promise<Response> {
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
  if (resource === 'works' && resourceId && subResource === 'config' && !action) {
    if (request.method === 'GET') return getWorkConfig(env, resourceId);
    if (request.method === 'PUT') return updateWorkConfig(env, request, resourceId);
  }
  if (resource === 'works' && resourceId && subResource === 'sections' && !subResourceId && !action) {
    if (request.method === 'POST') return createSection(env, request, resourceId);
  }
  if (resource === 'works' && resourceId && subResource === 'sections' && subResourceId && !action) {
    if (request.method === 'PUT') return updateSection(env, request, resourceId, subResourceId);
    if (request.method === 'DELETE') return deleteSection(env, request, resourceId, subResourceId);
  }

  // ================================================================
  // V4 统一 Module API
  // ================================================================
  if (resource === 'modules' && !resourceId && !subResource) {
    if (request.method === 'GET') return listModules(env, request);
    if (request.method === 'POST') return createCard(env, request);
  }
  if (resource === 'module' && resourceId && !subResource && !subResourceId) {
    if (request.method === 'GET') return getModule(env, request, resourceId);
    if (request.method === 'PUT') return updateModule(env, request, resourceId);
    if (request.method === 'DELETE') return deleteModule(env, request, resourceId);
  }
  if (resource === 'module' && resourceId && subResource === 'versions' && !subResourceId) {
    if (request.method === 'GET') return listModuleVersions(env, request, resourceId);
  }
  if (resource === 'module' && resourceId && subResource === 'diff' && !subResourceId) {
    if (request.method === 'GET') return diffModuleVersions(env, request, resourceId);
  }

  // ================================================================
  // Story Elf
  // ================================================================
  if (resource === 'elf' && resourceId === 'conversation' && !subResource && !action) {
    if (request.method === 'GET') return handleGetConversation(env, request);
    if (request.method === 'PUT') return handlePutConversation(env, request);
  }
  if (resource === 'elf' && resourceId === 'chat' && !subResource && !action) {
    if (request.method === 'POST') return handleElfChat(env, request, ctx);
  }

  // ================================================================
  // 写作指南
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
  // 记忆系统测试辅助
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
  if (resource === 'memory-test' && resourceId === 'read-l1' && !subResource && !action) {
    if (request.method === 'GET') return handleMemoryReadL1(env, request);
  }
  if (resource === 'memory-test' && resourceId === 'extract-l3' && !subResource && !action) {
    if (request.method === 'POST') return handleMemoryExtractL3(env, request);
  }
  if (resource === 'memory-test' && resourceId === 'reset' && !subResource && !action) {
    if (request.method === 'POST') return handleMemoryReset(env, request);
  }
  if (resource === 'memory-test' && resourceId === 'read-l2' && !subResource && !action) {
    if (request.method === 'GET') return handleMemoryReadL2(env, request);
  }
  if (resource === 'memory-test' && resourceId === 'read-l3' && !subResource && !action) {
    if (request.method === 'GET') return handleMemoryReadL3(env, request);
  }
  if (resource === 'memory-test' && resourceId === 'eval' && !subResource && !action) {
    if (request.method === 'POST') return handleMemoryEval(env, request);
  }
  if (resource === 'memory-test' && resourceId === 'eval-results' && !subResource && !action) {
    if (request.method === 'GET') return handleMemoryEvalResults(env, request);
  }

  // ================================================================
  // 用户级配置（R2: users/{token}/config.json）
  // ================================================================
  if (resource === 'me' && resourceId === 'config' && !subResource && !action) {
    if (request.method === 'GET') return getUserConfig(env, request);
    if (request.method === 'PUT') return updateUserConfig(env, request);
  }

  return new Response(JSON.stringify(jsonError(ErrorCodes.NOT_FOUND, 'Write endpoint not found')), {
    status: 404, headers: { 'Content-Type': 'application/json' },
  });
}
