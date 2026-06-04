/**
 * Story Forger Write 侧路由分发 — index.ts
 *
 * 路由总览（逐条映射到 SRS 需求 ID + handler 函数）:
 *
 * 工作区 (workspace.ts):
 *   GET    /api/write/works                → SF-002 listMyWorks
 *   POST   /api/write/works                → SF-001 createDraftWork
 *   GET    /api/write/works/{id}           → SF-003 getMyWork
 *   PUT    /api/write/works/{id}           → SF-003 updateMyWork
 *   DELETE /api/write/works/{id}           → SF-004 deleteMyWork
 *   GET    /api/write/works/{id}/preview   → SF-005 previewWork
 *   PATCH  /api/write/works/{id}/publish   → 状态: draft→published
 *   PATCH  /api/write/works/{id}/close     → 状态: published→closed
 *   PATCH  /api/write/works/{id}/reopen    → 状态: closed→published
 *   GET    /api/write/works/{id}/config    → 作品配置读取
 *   PUT    /api/write/works/{id}/config    → 作品配置更新
 *   POST   /api/write/works/{id}/sections  → createSection
 *   PUT    /api/write/works/{id}/sections/{sid} → updateSection
 *   DELETE /api/write/works/{id}/sections/{sid} → deleteSection
 *
 * V3 统一 Module API (module.ts):
 *   GET    /api/write/module/{id}          → getModule (M0-M6)
 *   PUT    /api/write/module/{id}          → updateModule (M0-M6)
 *   GET    /api/write/modules              → listModules
 *   GET    /api/write/module/{id}/versions → listModuleVersions [V4]
 *   GET    /api/write/module/{id}/diff     → diffModuleVersions [V4]
 *
 * 实体 CRUD → 按 type 分发 (character_card.ts / foreshadowing_card.ts):
 *   POST   /api/write/works/{id}/entities  → SF-014 createCharacter / createForeshadowing
 *   PUT    /api/write/works/{id}/entities/{eid}      → updateEntity
 *   DELETE /api/write/works/{id}/entities/{eid}      → deleteEntity
 *   GET    /api/write/works/{id}/entities/{eid}/card → readCharacterCard / readForeshadowingCard
 *   PUT    /api/write/works/{id}/entities/{eid}/card → updateCharacterCard / updateForeshadowingCard
 *
 * 世界观 (worldbuilding.ts):
 *   GET    /api/write/worldbuilding/{id}             → SF-011 readWorldbuilding
 *   PUT    /api/write/worldbuilding/{id}             → SF-012 updateWorldbuilding
 *   GET    /api/write/worldbuilding/{id}/constraints → SF-013 readConstraints
 *
 * 原始构想 (original_concept.ts):
 *   GET    /api/write/original-concept/{id}  → SF-006 readOriginalConcept
 *   PUT    /api/write/original-concept/{id}  → SF-006 updateOriginalConcept
 *
 * 大纲 (outline.ts):
 *   GET    /api/write/outline/{id}           → SF-021 readOutline
 *   PUT    /api/write/outline/{id}           → SF-022 updateOutline
 *
 * 章节 (draft.ts):
 *   POST   /api/write/draft/intent           → SF-030 createIntent
 *   GET    /api/write/draft/intent/{wid}/{sid} → readIntent
 *   GET    /api/write/draft/output/{sid}     → SF-034 outputDraft
 *
 * 伏笔 (foreshadowing.ts):
 *   GET    /api/write/foreshadowing/{id}     → SF-023 readForeshadowing
 *   PUT    /api/write/foreshadowing/{id}     → SF-023 updateForeshadowing
 *
 * 提示 (hints.ts):
 *   GET    /api/write/hints/{module}         → SF-067 readHints
 *
 * Story Elf (elf_chat.ts / elf_sessions.ts):
 *   POST   /api/write/elf/chat               → SF-055 handleElfChat
 *   POST   /api/write/elf/sessions           → handleCreateSession
 *   GET    /api/write/elf/sessions           → handleListSessions
 *   GET    /api/write/elf/sessions/{id}      → handleGetSession
 *   POST   /api/write/elf/sessions/{id}/archive → handleArchiveSession
 *
 * 写作指南:
 *   GET    /api/write/guide/{module_type}     → getModuleGuide
 *
 * ⚠️ 注意: 以下端点的 handler 函数存在但当前路由未接线:
 *   - SF-031: generateDraft (POST /api/write/draft/generate)
 *   - SF-032: checkConsistency (POST /api/write/draft/check)
 *   - SF-033: polishDraft (POST /api/write/draft/polish)
 *   - SF-035: rewriteSection (POST /api/write/draft/rewrite)
 *   - SF-040: extractHooks (POST /api/write/marketing/extract)
 *   - SF-041: generateTitles (POST /api/write/marketing/titles)
 *   - SF-042: repurposeSection (POST /api/write/marketing/repurpose)
 *
 * ============================================================
 * 前端设计（写作桌 — write.html / write.js）
 * ============================================================
 *
 * 设计哲学（四个关键词）：
 *   - 桌面感：不是"打开一个编辑器"，而是"进入创作桌面，所有工具都在手边"
 *   - 结构化：世界观/长篇框架/人物卡/伏笔账本是预设模板，作者往里面填内容
 *   - 统一界面：不区分"规划模式"和"写作模式"，Pipeline 导航 + 分栏 + Story Elf，一个界面
 *   - 可配置：分隔线可拖拽调整宽度，预设合理默认值
 *
 * 三栏布局设计原则：
 *   - 左栏（参考层）：轮换提示 / 人物卡片 / 章节卡片 / 伏笔列表
 *   - 中栏（自由编辑区）：视觉焦点，鼓励"先吐出来，再结构化"
 *   - 右栏（模板槽位）：模板框架只读 + 槽位 textarea 可编辑，按 level 分级
 *   - Story Elf 浮动在右下角，是左（参考）+ 中（自由写作）→ 右（模板槽位）的桥梁
 *   - 分隔线可拖拽，默认各 1/3，最小 15%
 *
 * Pipeline 引导条设计意图：
 *   - 长篇创作最大障碍是"不知道从哪开始"，引导条将 M0→M1→...→M6 可视化
 *   - 始终可见、状态驱动（R2 资产判定）、点击跳转、建议但不强制顺序
 *   - ⚠️ SF-063 状态自动判定尚未实现（updatePipelineStatuses() 已预留）
 *
 * 技术选型：纯 HTML+CSS+JS / CSS Grid + Flexbox 三栏 / HTML5 Drag & Drop / marked.js / 系统字体
 * 与 CAU Read 侧的关系：共享 style.css + app.js / Write --cyan vs Read --accent / 作者需 Token
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
import { createCharacter, readCharacterCard, updateCharacterCard, updateEntity, deleteEntity } from './character_card';
import { createForeshadowing, readForeshadowingCard, updateForeshadowingCard } from './foreshadowing_card';
import { readWorldbuilding, updateWorldbuilding, readConstraints } from './worldbuilding';
import { readOutline, updateOutline } from './outline';
import { createIntent, readIntent, outputDraft } from './draft';
import { readForeshadowing, updateForeshadowing } from './foreshadowing';
import { readHints } from './hints';
import { readOriginalConcept, updateOriginalConcept } from './original_concept';
import { handleElfChat } from './elf_chat';
import { handleCreateSession, handleListSessions, handleGetSession, handleArchiveSession } from './elf_sessions';
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
  // Story Elf Session 管理
  // ================================================================
  if (resource === 'elf' && resourceId === 'sessions' && !subResource && !action) {
    if (request.method === 'POST') return handleCreateSession(env, request);
    if (request.method === 'GET') return handleListSessions(env, request);
  }
  if (resource === 'elf' && resourceId === 'sessions' && subResource && !subResourceId && !action) {
    if (request.method === 'GET') return handleGetSession(env, request, subResource);
  }
  if (resource === 'elf' && resourceId === 'sessions' && subResource && subResourceId === 'archive' && !action) {
    if (request.method === 'POST') return handleArchiveSession(env, request, subResource);
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
