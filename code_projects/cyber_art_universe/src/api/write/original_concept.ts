/**
 * M0 原始构想 — original_concept.ts
 *
 * 覆盖需求:
 *   SF-006: 原始构想读写 (GET/PUT /api/write/original-concept/{work_id})
 *           首次访问返回空，内容存入 R2 works/{id}/{lang}/original_concept.md
 *   SF-007: Story Elf 禁止修改 M0
 *           Story Elf（内部辅助AI）可读取作为参考上下文，但绝不修改
 *           外部 AI/Agent 视为作者，可正常读写
 *
 * V3: CRUD 委托到统一 Module API（M0 为单槽位 content 模板 + .free.md 自由编辑区）
 *
 * 权限规则:
 *   - 人类作者: 读 ✅, 写 ✅
 *   - 外部 AI/Agent: 读 ✅, 写 ✅（视为作者）
 *   - Story Elf: 读 ✅, 写 ❌ 禁止
 */
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
