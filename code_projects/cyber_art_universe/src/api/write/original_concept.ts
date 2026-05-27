// M0 原始构想 — Story Elf 禁止修改。人类和外部 AI/Agent 可正常读写。
// V3: CRUD 委托到统一 Module API（M0 为单槽位 content 模板 + .free.md 自由编辑区）
import { Env } from '../../db/schema';

// ============================================================
// GET /api/write/original-concept/{work_id}?lang=
// ============================================================

export async function readOriginalConcept(env: Env, request: Request, workId: string): Promise<Response> {
  const { getModule } = await import('./module');
  return getModule(env, request, `m0_${workId}`);
}

// ============================================================
// PUT /api/write/original-concept/{work_id}?lang=
// Story Elf（内部辅助AI）禁止使用此端点修改 M0。
// ============================================================

export async function updateOriginalConcept(env: Env, request: Request, workId: string): Promise<Response> {
  const { updateModule } = await import('./module');
  return updateModule(env, request, `m0_${workId}`);
}
