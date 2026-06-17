/**
 * 能量系统 — Phase 1
 * 随机呼吸模型：确定性 HMAC 计算，零额外存储
 */
import { User } from '../db/schema';

const REFILL_WINDOW_MIN = 90;  // 最短恢复间隔（分钟）
const REFILL_WINDOW_MAX = 150; // 最长恢复间隔（分钟）
const REFILL_AMOUNT = 1;       // 每次恢复 1 点

/**
 * 计算自上次恢复以来应恢复多少能量。
 * 使用 HMAC(entropy_seed, minute_slot) 生成确定性但不可预测的恢复间隔。
 */
export async function calculateEnergyRefill(user: User, now: Date = new Date()): Promise<{
  newEnergy: number;
  newLastRefill: string;
}> {
  const lastRefill = user.last_energy_refill
    ? new Date(user.last_energy_refill)
    : new Date(user.created_at);

  let recovered = 0;
  let currentSlot = Math.floor(lastRefill.getTime() / 60000);
  const endSlot = Math.floor(now.getTime() / 60000);

  while (currentSlot < endSlot) {
    const interval = await hashToRange(user.entropy_seed, currentSlot, REFILL_WINDOW_MIN, REFILL_WINDOW_MAX);
    currentSlot += interval;
    if (currentSlot <= endSlot) {
      recovered += REFILL_AMOUNT;
    }
  }

  const newEnergy = Math.min(user.energy + recovered, user.energy_cap);

  return {
    newEnergy,
    newLastRefill: now.toISOString(),
  };
}

/**
 * 消耗能量。返回更新后的能量值（扣除后的值）。
 * 调用前应先计算恢复：先 refill → 再消耗。
 */
export function consumeEnergy(energy: number, amount: number): number {
  return Math.max(0, energy - amount);
}

/**
 * 能量消耗规则
 */
export const ENERGY_COST = {
  LIKE: 1,
  COMMENT: 2,      // ≥50 字的评论
  COMMENT_SHORT: 1, // <50 字的短评
  APPLAUD: 3,       // 赞赏（声望传导）
} as const;

// HMAC 确定性哈希：seed + slot → [min, max] 范围
async function hashToRange(seed: string, slot: number, min: number, max: number): Promise<number> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(seed);
  const msgData = encoder.encode(slot.toString());

  const key = await crypto.subtle.importKey('raw', keyData, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const signature = await crypto.subtle.sign('HMAC', key, msgData);
  const bytes = new Uint8Array(signature);

  // 取前 4 字节作为 uint32
  const uint32 = (bytes[0] << 24) | (bytes[1] << 16) | (bytes[2] << 8) | bytes[3];

  return min + (uint32 % (max - min + 1));
}
