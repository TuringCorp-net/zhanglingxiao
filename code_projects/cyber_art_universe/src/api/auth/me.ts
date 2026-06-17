/**
 * GET /api/auth/me — 获取当前用户信息
 * PUT /api/auth/me — 更新用户档案
 * Phase 0
 */
import { Env } from '../../db/schema';
import { jsonSuccess, jsonError } from '../../lib/response';
import { ErrorCodes } from '../../lib/errors';

// GET /api/auth/me
export async function handleGetMe(env: Env, _request: Request): Promise<Response> {
  const user = env.currentUser!;

  return new Response(JSON.stringify(jsonSuccess({
    id: user.id,
    cyber_name: user.cyber_name,
    class: user.class,
    karma: user.karma,
    energy: user.energy,
    energy_cap: user.energy_cap,
    email: user.email,
    email_verified: user.email_verified === 1,
    read_vip_tier: user.read_vip_tier,
    write_vip_tier: user.write_vip_tier,
    created_at: user.created_at,
    updated_at: user.updated_at,
  })), {
    headers: { 'Content-Type': 'application/json' },
  });
}

// PUT /api/auth/me
export async function handleUpdateMe(env: Env, request: Request): Promise<Response> {
  const user = env.currentUser!;
  const body = await request.json() as Record<string, unknown>;

  const updates: string[] = [];
  const values: (string | number)[] = [];
  const now = new Date().toISOString();

  // 修改 Cyber Name
  if (body.cyber_name && String(body.cyber_name).trim() !== user.cyber_name) {
    const newName = String(body.cyber_name).trim();

    if (!/^[\w一-鿿-]{3,30}$/.test(newName)) {
      return new Response(JSON.stringify(jsonError(ErrorCodes.INVALID_CYBER_NAME, 'Cyber Name must be 3-30 characters')), {
        status: 400, headers: { 'Content-Type': 'application/json' },
      });
    }

    // 检查唯一性（仅检查 users 表，不封锁旧名）
    const existing = await env.DB.prepare('SELECT id FROM users WHERE cyber_name = ?').bind(newName).first();
    if (existing) {
      return new Response(JSON.stringify(jsonError(ErrorCodes.CYBER_NAME_TAKEN, 'Cyber Name is already taken')), {
        status: 409, headers: { 'Content-Type': 'application/json' },
      });
    }

    // 记录改名历史
    await env.DB.prepare(
      'INSERT INTO cyber_name_history (id, user_id, old_name, new_name, changed_at) VALUES (?, ?, ?, ?, ?)'
    ).bind(crypto.randomUUID(), user.id, user.cyber_name, newName, now).run();

    updates.push('cyber_name = ?');
    values.push(newName);
  }

  if (updates.length === 0) {
    return new Response(JSON.stringify(jsonSuccess({
      id: user.id,
      cyber_name: user.cyber_name,
      message: 'No changes',
    })), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  updates.push('updated_at = ?');
  values.push(now);
  values.push(user.id);

  await env.DB.prepare(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`).bind(...values).run();

  // 重新查询更新后的用户
  const updatedUser = await env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(user.id).first<Record<string, unknown>>();

  return new Response(JSON.stringify(jsonSuccess({
    id: updatedUser!.id,
    cyber_name: updatedUser!.cyber_name,
    class: updatedUser!.class,
    email: updatedUser!.email,
    email_verified: (updatedUser!.email_verified as number) === 1,
    updated_at: now,
  })), {
    headers: { 'Content-Type': 'application/json' },
  });
}
