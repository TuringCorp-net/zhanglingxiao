/**
 * POST /api/interactions/applaud — 赞赏用户（声望传导）
 * Phase 1
 * 消耗赞赏者 3 点能量，将 1 点声望铸入对方账户。
 * 声望的唯一传导动作。
 */
import { Env } from '../../db/schema';
import { jsonSuccess, jsonError } from '../../lib/response';
import { ErrorCodes } from '../../lib/errors';
import { calculateEnergyRefill, consumeEnergy, ENERGY_COST } from '../../lib/energy';
import { applaudKarma } from '../../lib/karma';

export async function handleApplaud(env: Env, request: Request): Promise<Response> {
  const user = env.currentUser!;
  const body = await request.json() as Record<string, unknown>;
  const targetUserId = String(body.target_user_id || '');

  if (!targetUserId) {
    return new Response(JSON.stringify(jsonError(ErrorCodes.MISSING_REQUIRED_FIELD, 'target_user_id is required')), {
      status: 400, headers: { 'Content-Type': 'application/json' },
    });
  }

  // 不能赞赏自己
  if (targetUserId === user.id) {
    return new Response(JSON.stringify(jsonError(ErrorCodes.CANNOT_APPLAUD_SELF, 'Cannot applaud yourself')), {
      status: 400, headers: { 'Content-Type': 'application/json' },
    });
  }

  // 检查目标用户是否存在
  const targetUser = await env.DB.prepare('SELECT id, karma, cyber_name FROM users WHERE id = ?').bind(targetUserId).first<{ id: string; karma: number; cyber_name: string }>();
  if (!targetUser) {
    return new Response(JSON.stringify(jsonError(ErrorCodes.USER_NOT_FOUND, 'Target user not found')), {
      status: 404, headers: { 'Content-Type': 'application/json' },
    });
  }

  // 恢复能量
  const { newEnergy, newLastRefill } = await calculateEnergyRefill(user);

  if (newEnergy < ENERGY_COST.APPLAUD) {
    return new Response(JSON.stringify(jsonError(ErrorCodes.ENERGY_INSUFFICIENT, `Need ${ENERGY_COST.APPLAUD} energy to applaud, you have ${newEnergy}`)), {
      status: 429, headers: { 'Content-Type': 'application/json' },
    });
  }

  // 检查去重：同一赞赏者对同一目标只能赞赏一次
  const existing = await env.DB.prepare(
    'SELECT id FROM interactions WHERE user_id = ? AND target_type = ? AND target_id = ? AND action = ?'
  ).bind(user.id, 'user', targetUserId, 'applaud').first();

  if (existing) {
    return new Response(JSON.stringify(jsonError(ErrorCodes.ALREADY_APPLAUDED, 'Already applauded this user')), {
      status: 409, headers: { 'Content-Type': 'application/json' },
    });
  }

  const now = new Date().toISOString();
  const afterEnergy = consumeEnergy(newEnergy, ENERGY_COST.APPLAUD);

  // 计算声望
  const { newKarma } = applaudKarma(targetUser.karma);

  // 原子操作：消耗能量 + 对方声望 +1 + 记录互动
  await env.DB.prepare(
    'INSERT INTO interactions (id, user_id, target_type, target_id, action, created_at) VALUES (?, ?, ?, ?, ?, ?)'
  ).bind(crypto.randomUUID(), user.id, 'user', targetUserId, 'applaud', now).run();

  await env.DB.prepare(
    'UPDATE users SET energy = ?, last_energy_refill = ?, updated_at = ? WHERE id = ?'
  ).bind(afterEnergy, newLastRefill, now, user.id).run();

  await env.DB.prepare(
    'UPDATE users SET karma = ?, updated_at = ? WHERE id = ?'
  ).bind(newKarma, now, targetUserId).run();

  return new Response(JSON.stringify(jsonSuccess({
    energy_remaining: afterEnergy,
    karma_target: newKarma,
    message: `You forged 1 karma into ${targetUser.cyber_name}'s account`,
  })), {
    headers: { 'Content-Type': 'application/json' },
  });
}
