/**
 * tank.js — 坦克实体类
 *
 * 管理坦克的物理运动（含坡度滑动、转向）、血量、武器状态等。
 * 支持轮式/履带/机器人三种类型，每种有不同的速度和坡度行为。
 */

import { CFG } from './constants.js';

export class Tank {
  /**
   * @param {'wheel'|'track'|'robot'} kind  - 坦克类型
   * @param {boolean} isPlayer              - 是否为玩家
   * @param {'shell'|'flame'|'missile'} weapon - 武器类型
   * @param {number} x - 初始世界坐标 X
   * @param {number} y - 初始世界坐标 Y
   */
  constructor(kind, isPlayer, weapon, x, y) {
    this.kind = kind;
    this.isPlayer = isPlayer;
    this.weapon = weapon;

    this.x = x;
    this.y = y;
    this.vx = 0;
    this.width = CFG.w;
    this.height = CFG.w;

    // 从配置读取速度
    const specs = CFG[kind] || CFG.wheel;
    this.speed = specs.speed * CFG.w;     // 最大移动速度 (px/s)
    this.slideSpeed = specs.slide * CFG.w; // 陡坡下滑速度 (px/s)

    // 血量
    this.hp = isPlayer ? CFG.hpPlayer : (weapon === 'missile' ? CFG.hpBoss : CFG.hpMinion);
    this.maxHp = this.hp;

    this.facing = isPlayer ? 1 : -1; // 1=右, -1=左
    this.barrelAngle = 0;            // 炮管世界角度
    this.barrelAngleOffset = 0;      // 炮管仰角偏移（玩家通过W/S控制）
    this.slopeAngle = 0;             // 当前所在位置的地形坡角（供渲染器使用）

    this.nextFireAt = 0;  // 下次可开火的时间戳
    this.alive = true;
    this.deadProcessed = false;

    // 火焰持续攻击引用
    this.flameProjectile = null;
  }

  /**
   * 每帧更新坦克状态
   * @param {number} dt           - 帧间隔（秒）
   * @param {Terrain} terrain     - 地形对象
   * @param {object} input        - 输入对象（玩家为 Input 实例，AI 为 shim）
   * @param {number} time         - 当前时间戳 (ms)
   */
  update(dt, terrain, input, time) {
    if (!this.alive) {
        this.vx = 0; // 确保死亡后速度归零
        return;
    }

    const angle = terrain.slopeAngle(this.x);
    this.slopeAngle = angle;
    const isSteep = terrain.isSteep(angle);

    this.vx = 0;
    let move = 0;

    // 获取移动方向
    if (this.isPlayer) {
      if (input.keys.has('ArrowRight') || input.keys.has('KeyD')) move = 1;
      if (input.keys.has('ArrowLeft') || input.keys.has('KeyA')) move = -1;
    } else {
      move = input.move || 0;
    }

    // 更新朝向：玩家根据移动方向，敌人也根据移动方向
    if (move !== 0) this.facing = move;

    // —— 移动逻辑（分坦克类型） ——
    // 应用道具的速度乘数
    const speedMult = this.speedMult || 1;
    const effectiveSpeed = this.speed * speedMult;

    if (this.kind === 'wheel') {
      if (isSteep) {
        // 轮式在陡坡无法控制，快速下滑
        this.vx = Math.sign(angle) * this.slideSpeed;
      } else {
        this.vx = move * effectiveSpeed;
      }
    } else if (this.kind === 'track') {
      if (isSteep) {
        // 履带在陡坡缓慢下滑，但仍可加速/刹车/倒车
        const slide = Math.sign(angle) * this.slideSpeed;
        this.vx = slide + (move * effectiveSpeed);
      } else {
        this.vx = move * effectiveSpeed;
      }
    } else {
      // 机器人 — 不受陡坡影响
      this.vx = move * effectiveSpeed;
    }

    this.x += this.vx * dt;

    // 飞行单位保持一定高度，不贴地
    if (this.isFlying) {
      this.y = terrain.sampleY(this.x) - CFG.w * 0.8; // 悬浮在地面上
    } else {
      this.y = terrain.sampleY(this.x);
    }

    // —— 炮管朝向 ——
    // 基于地形坡度微调，facing 决定大方向
    const baseAngle = angle * 0.5;
    // 玩家可以通过barrelAngleOffset控制仰角（仅玩家有效）
    // 面向左时需要反转offset的符号，使上键抬头的行为一致
    const aimOffset = this.isPlayer ? (this.barrelAngleOffset * this.facing) : 0;
    this.barrelAngle = (this.facing > 0 ? 0 : Math.PI) + baseAngle + aimOffset;
  }
}
