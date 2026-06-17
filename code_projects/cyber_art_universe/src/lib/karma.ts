/**
 * 声望系统 — Phase 1 MVP
 * 声望不可消耗、不可购买、不可转移。
 * 唯一获取途径：被赞赏（其他用户消耗 3 点能量 → 你获得 1 点声望）。
 */

/**
 * 赞赏：消耗赞赏者 3 点能量，被赞赏者获得 1 点声望。
 * 声望是"铸入"而非"转移"——赞赏者的声望不减少。
 */
export function applaudKarma(targetKarma: number): { karmaGained: number; newKarma: number } {
  const karmaGained = 1;
  return {
    karmaGained,
    newKarma: targetKarma + karmaGained,
  };
}
