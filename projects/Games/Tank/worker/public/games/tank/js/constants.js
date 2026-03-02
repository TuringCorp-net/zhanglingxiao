/**
 * constants.js — 游戏全局常量与工具函数
 *
 * 包含画面尺寸、物理参数、武器数据、坦克种类属性、血量等。
 * 所有距离单位以 w (坦克宽度) 为基准。
 */

export const CFG = {
  w: 64,             // 坦克宽度（基本单位）
  width: 1024,       // 设计分辨率宽
  height: 576,       // 设计分辨率高
  gravity: 1800,     // 重力加速度 (px/s²)
  groundStep: 32,    // 地形采样步长 (px)
  cameraLerp: 0.08,  // 镜头跟随插值系数

  // 坡度阈值：>40度视为陡坡
  slopeThreshold: 40 * Math.PI / 180,

  // 武器参数 —— 与需求描述对齐
  shell: { damage: 10, reload: 3000, speed: 12, gravity: true },  // 炮弹：3秒装填
  flame: { damage: 4, interval: 500, range: 2, angle: 30 * Math.PI / 180 }, // 火焰：0.5秒4伤
  missile: { damage: 13, reload: 4000, speed: 5, duration: 3000 },  // 导弹：4秒装填，3秒飞行

  // 坦克种类属性（速度单位：w/s，slide：陡坡下滑速度）
  wheel: { speed: 1.5, slide: 1.0 },
  track: { speed: 1.0, slide: 0.5 },
  robot: { speed: 0.5, slide: 0.0 },

  // 血量
  hpPlayer: 60,
  hpMinion: 20,
  hpBoss: 70
};

/* ========== 工具函数 ========== */

/** 限制 v 在 [a, b] 范围内 */
export function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

/** 线性插值 */
export function lerp(a, b, t) { return a + (b - a) * t; }

/** 角度转弧度 */
export function toRad(deg) { return deg * Math.PI / 180; }

/** 两点间距离 */
export function dist(x1, y1, x2, y2) { return Math.hypot(x2 - x1, y2 - y1); }
