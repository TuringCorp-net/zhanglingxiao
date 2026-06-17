/**
 * POST /api/interactions/like — 点赞作品或评论
 * DELETE /api/interactions/like/{id} — 取消点赞
 * Phase 1
 */
import { Env } from '../../db/schema';
import { jsonSuccess, jsonError } from '../../lib/response';
import { ErrorCodes } from '../../lib/errors';
import { calculateEnergyRefill, consumeEnergy, ENERGY_COST } from '../../lib/energy';

// POST /api/interactions/like
export async function handleLike(env: Env, request: Request): Promise<Response> {
  const user = env.currentUser!;
  const body = await request.json() as Record<string, unknown>;
  const targetType = String(body.target_type || '');
  const targetId = String(body.target_id || '');

  if (!targetType || !targetId || !['work', 'review'].includes(targetType)) {
    return new Response(JSON.stringify(jsonError(ErrorCodes.INVALID_PARAMS, 'target_type (work|review) and target_id are required')), {
      status: 400, headers: { 'Content-Type': 'application/json' },
    });
  }

  // 恢复能量
  const { newEnergy, newLastRefill } = await calculateEnergyRefill(user);

  // 检查能量
  if (newEnergy < ENERGY_COST.LIKE) {
    return new Response(JSON.stringify(jsonError(ErrorCodes.ENERGY_INSUFFICIENT, `Need ${ENERGY_COST.LIKE} energy to like, you have ${newEnergy}`)), {
      status: 429, headers: { 'Content-Type': 'application/json' },
    });
  }

  // 检查去重
  const existing = await env.DB.prepare(
    'SELECT id FROM interactions WHERE user_id = ? AND target_type = ? AND target_id = ? AND action = ?'
  ).bind(user.id, targetType, targetId, 'like').first();

  if (existing) {
    return new Response(JSON.stringify(jsonError(ErrorCodes.ALREADY_LIKED, 'Already liked')), {
      status: 409, headers: { 'Content-Type': 'application/json' },
    });
  }

  const now = new Date().toISOString();
  const afterEnergy = consumeEnergy(newEnergy, ENERGY_COST.LIKE);

  // 写入互动记录
  await env.DB.prepare(
    'INSERT INTO interactions (id, user_id, target_type, target_id, action, created_at) VALUES (?, ?, ?, ?, ?, ?)'
  ).bind(crypto.randomUUID(), user.id, targetType, targetId, 'like', now).run();

  // 更新用户能量
  await env.DB.prepare(
    'UPDATE users SET energy = ?, last_energy_refill = ?, updated_at = ? WHERE id = ?'
  ).bind(afterEnergy, newLastRefill, now, user.id).run();

  // 更新目标的 like_count（reviews 表 / works 表未来加）
  if (targetType === 'review') {
    await env.DB.prepare('UPDATE reviews SET like_count = like_count + 1 WHERE id = ?').bind(targetId).run();
  }

  return new Response(JSON.stringify(jsonSuccess({
    energy_remaining: afterEnergy,
    energy_cap: user.energy_cap,
  })), {
    headers: { 'Content-Type': 'application/json' },
  });
}
