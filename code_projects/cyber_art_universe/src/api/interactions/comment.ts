/**
 * POST /api/interactions/comment — 发表评论
 * Phase 1
 * 复用现有 reviews 表，agent_id → user_id
 */
import { Env } from '../../db/schema';
import { jsonSuccess, jsonError } from '../../lib/response';
import { ErrorCodes } from '../../lib/errors';
import { calculateEnergyRefill, consumeEnergy, ENERGY_COST } from '../../lib/energy';

export async function handleComment(env: Env, request: Request): Promise<Response> {
  const user = env.currentUser!;
  const body = await request.json() as Record<string, unknown>;
  const workId = String(body.work_id || '');
  const sectionId = body.section_id ? String(body.section_id) : null;
  const content = String(body.comment || body.content || '').trim();
  const parentId = body.parent_id ? String(body.parent_id) : null;
  const scoreOverall = body.score_overall ? Number(body.score_overall) : null;

  if (!workId) {
    return new Response(JSON.stringify(jsonError(ErrorCodes.MISSING_REQUIRED_FIELD, 'work_id is required')), {
      status: 400, headers: { 'Content-Type': 'application/json' },
    });
  }

  if (content.length < 1) {
    return new Response(JSON.stringify(jsonError(ErrorCodes.VALIDATION_ERROR, 'Comment cannot be empty')), {
      status: 400, headers: { 'Content-Type': 'application/json' },
    });
  }

  // 评论消耗：≥50 字 = 2 能量，<50 字 = 1 能量
  const energyCost = content.length >= 50 ? ENERGY_COST.COMMENT : ENERGY_COST.COMMENT_SHORT;

  // 恢复能量
  const { newEnergy, newLastRefill } = await calculateEnergyRefill(user);

  if (newEnergy < energyCost) {
    return new Response(JSON.stringify(jsonError(ErrorCodes.ENERGY_INSUFFICIENT, `Need ${energyCost} energy to comment, you have ${newEnergy}`)), {
      status: 429, headers: { 'Content-Type': 'application/json' },
    });
  }

  const now = new Date().toISOString();
  const afterEnergy = consumeEnergy(newEnergy, energyCost);
  const reviewId = crypto.randomUUID();

  // 写入 reviews 表
  await env.DB.prepare(
    `INSERT INTO reviews (id, work_id, section_id, agent_id, reviewer_type, score_overall, comment, parent_id, like_count, created_at)
     VALUES (?, ?, ?, ?, 'human', ?, ?, ?, 0, ?)`
  ).bind(reviewId, workId, sectionId, user.id, scoreOverall, content, parentId, now).run();

  // 更新用户能量
  await env.DB.prepare(
    'UPDATE users SET energy = ?, last_energy_refill = ?, updated_at = ? WHERE id = ?'
  ).bind(afterEnergy, newLastRefill, now, user.id).run();

  return new Response(JSON.stringify(jsonSuccess({
    review_id: reviewId,
    energy_remaining: afterEnergy,
  })), {
    status: 201, headers: { 'Content-Type': 'application/json' },
  });
}
