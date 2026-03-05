/**
 * projectile.js — 弹药系统
 *
 * Projectile 类：处理炮弹（抛物线）和导弹（锁定追踪）。
 * Flame 类：火焰持续伤害（锥形范围检测）。
 */

import { CFG, dist } from './constants.js';

/**
 * 炮弹/导弹实体
 */
export class Projectile {
  /**
   * @param {Tank} owner   - 发射者
   * @param {number} x     - 发射位置 X
   * @param {number} y     - 发射位置 Y
   * @param {'shell'|'missile'} type - 弹药类型
   * @param {Tank} [target] - 导弹锁定目标
   * @param {number} [angleOffset] - 额外角度偏移（度），用于散射
   */
  constructor(owner, x, y, type, target, angleOffset = 0) {
    this.owner = owner;
    this.x = x;
    this.y = y;
    this.type = type;
    this.target = target || null;
    this.angleOffset = angleOffset; // 散射角度偏移
    this.damageBoosted = false;

    this.vx = 0;
    this.vy = 0;
    this.dead = false;

    const specs = type === 'shell' ? CFG.shell : CFG.missile;
    this.speed = specs.speed * CFG.w;

    if (type === 'shell') {
      // 炮弹从炮管尖端发射，沿炮管角度抛出
      const angle = owner.barrelAngle + (this.angleOffset * Math.PI / 180); // 应用角度偏移
      this.x += Math.cos(angle) * CFG.w * 0.6;
      this.y += Math.sin(angle) * CFG.w * 0.6;
      this.vx = Math.cos(angle) * this.speed;
      this.vy = Math.sin(angle) * this.speed;
    } else {
      // 导弹先上弹再追踪
      this.spawnTime = Date.now();
      this.duration = specs.duration;
      this.y -= CFG.w * 0.5;
    }
  }

  checkHitTarget(enemies, player) {
    const targets = this.owner.isPlayer ? enemies : [player];
    for (const t of targets) {
      if (!t || !t.alive) continue;
      const tx = t.x;
      const ty = t.y - CFG.w * 0.35;
      if (dist(this.x, this.y, tx, ty) < CFG.w * 0.6) {
        return t;
      }
    }
    return null;
  }

  /**
   * 每帧更新弹药位置和碰撞检测
   * @returns {{hit: boolean, x: number, y: number, target: Tank|null}} 命中信息
   */
  update(dt, terrain, enemies, player) {
    if (this.dead) return null;

    if (this.type === 'shell') {
      // —— 抛物线运动 ——
      this.vy += (CFG.gravity * 0.35) * dt;  // 减少重力影响，让炮弹飞得更远
      this.x += this.vx * dt;
      this.y += this.vy * dt;

      // 落地爆炸
      if (this.y >= terrain.sampleY(this.x)) {
        this.dead = true;
        let baseDmg = CFG.shell.damage;
        if (this.damageBoosted) baseDmg *= 1.5; // 火力提升
        const hitResult = this.checkHit(enemies, player, baseDmg);
        return { hit: true, x: this.x, y: terrain.sampleY(this.x), target: hitResult };
      }

      // 直接命中检测
      let dmg = CFG.shell.damage + (this.owner.damageBonus || 0);
      if (this.damageBoosted) dmg *= 1.5; // 火力提升
      const hitResult = this.checkHit(enemies, player, dmg);
      if (hitResult) {
        this.dead = true;
        return { hit: true, x: this.x, y: this.y, target: hitResult };
      }

    } else if (this.type === 'missile') {
      // —— 追踪导弹 ——
      const now = Date.now();
      if (now - this.spawnTime > this.duration) {
        this.dead = true; // 超时空爆
        return null;
      }

      if (!this.target || !this.target.alive) {
        // 目标丢失，直线飞行
        this.x += (this.owner.facing) * this.speed * dt;
      } else {
        // 追踪目标中心
        const tx = this.target.x;
        const ty = this.target.y - CFG.w * 0.5;
        const dx = tx - this.x;
        const dy = ty - this.y;
        const d = Math.hypot(dx, dy);

        // 命中判定
        if (d < CFG.w * 0.5) {
          let dmg = CFG.missile.damage + (this.owner.damageBonus || 0);
          if (this.damageBoosted) dmg *= 1.5; // 火力提升
          this.target.hp -= dmg;
          if (this.target.hp <= 0) this.target.alive = false;
          this.dead = true;
          return { hit: true, x: this.x, y: this.y, target: this.target };
        }

        this.vx = (dx / d) * this.speed;
        this.vy = (dy / d) * this.speed;
        this.x += this.vx * dt;
        this.y += this.vy * dt;
      }
    }
    return null;
  }

  /**
   * 碰撞检测 — 检查炮弹是否命中目标
   * @returns {Tank|null} 被命中的坦克，或 null
   */
  checkHit(enemies, player, dmg) {
    const targets = this.owner.isPlayer ? enemies : [player];
    for (const t of targets) {
      if (!t || !t.alive) continue;
      const tx = t.x;
      const ty = t.y - CFG.w * 0.35;
      if (dist(this.x, this.y, tx, ty) < CFG.w * 0.6) {
        t.hp -= dmg;
        if (t.hp <= 0) t.alive = false;
        return t;
      }
    }
    return null;
  }
}

/**
 * 火焰持续伤害 — 锥形范围检测
 */
export class Flame {
  constructor(owner) {
    this.owner = owner;
    /** @type {Map<Tank, number>} 每个目标的上次受伤时间 */
    this.lastHit = new Map();
    this.dead = false;
    this.lastUpdate = Date.now();
  }

  /**
   * 更新火焰范围伤害
   * @returns {Tank[]} 本次受到伤害的坦克列表
   */
  update(now, enemies, player, terrain) {
    if (!this.owner.alive) {
      this.dead = true;
      return [];
    }
    this.lastUpdate = now;

    const targets = this.owner.isPlayer ? enemies : [player];
    const angle = this.owner.barrelAngle;
    const range = CFG.flame.range * CFG.w;
    const cone = CFG.flame.angle;

    // 火焰起点：炮管尖端
    const ox = this.owner.x + Math.cos(angle) * CFG.w * 0.6;
    const oy = (this.owner.y - CFG.w * 0.35) + Math.sin(angle) * CFG.w * 0.6;

    const hitList = [];

    for (const t of targets) {
      if (!t || !t.alive) continue;
      const tx = t.x;
      const ty = t.y - CFG.w * 0.35;
      const dx = tx - ox;
      const dy = ty - oy;
      const d = Math.hypot(dx, dy);

      if (d > range) continue;

      // 检查是否在锥形范围内
      const a = Math.atan2(dy, dx);
      let diff = Math.abs(a - angle);
      if (diff > Math.PI) diff = 2 * Math.PI - diff;

      if (diff <= cone / 2) {
        const last = this.lastHit.get(t) || 0;
        if (now - last >= CFG.flame.interval) {
          const dmg = CFG.flame.damage + (this.owner.damageBonus || 0);
          t.hp -= dmg;
          if (t.hp <= 0) t.alive = false;
          this.lastHit.set(t, now);
          hitList.push(t);
        }
      }
    }

    return hitList;
  }
}
