/**
 * terrain.js — 程序化地形生成与采样
 *
 * 使用多频正弦波叠加生成有机的二维侧视地形曲线。
 * 提供 Y 坐标采样、坡度角查询、陡坡判定等方法。
 */

import { CFG, lerp } from './constants.js';

export class Terrain {
  constructor() {
    /** @type {{x:number, y:number}[]} 地形采样点 */
    this.points = [];
  }

  /**
   * 查询指定 X 坐标的地表 Y 值（线性插值）
   * @param {number} x - 世界坐标 X
   * @returns {number} 地表 Y 坐标
   */
  sampleY(x) {
    if (!this.points.length) return CFG.height - CFG.w * 2;
    const p = this.points;
    if (x <= p[0].x) return p[0].y;
    if (x >= p[p.length - 1].x) return p[p.length - 1].y;

    let i = Math.floor((x - p[0].x) / CFG.groundStep);
    i = Math.max(0, Math.min(p.length - 2, i));

    const a = p[i];
    const b = p[i + 1];
    const t = (x - a.x) / (b.x - a.x);
    return lerp(a.y, b.y, t);
  }

  /**
   * 查询指定 X 坐标处的地形坡度角（弧度）
   * 正值 = 右侧下坡，负值 = 右侧上坡
   */
  slopeAngle(x) {
    const p = this.points;
    if (!p.length) return 0;
    let i = Math.floor((x - p[0].x) / CFG.groundStep);
    i = Math.max(0, Math.min(p.length - 2, i));
    const a = p[i];
    const b = p[i + 1];
    return Math.atan2(b.y - a.y, b.x - a.x);
  }

  /**
   * 判断给定坡度角是否为陡坡（>40度）
   * @param {number} angleRad - 坡度角（弧度）
   */
  isSteep(angleRad) {
    return Math.abs(angleRad) > CFG.slopeThreshold;
  }

  /**
   * 生成地形
   * 使用多频正弦波叠加 + 随机扰动，产生丰富起伏的地形。
   * 包含少量陡坡区域，让坡度机制有用武之地。
   */
  gen(width, height) {
    this.points = [];
    let x = -width * 6;
    const endX = width * 25; // 加大生成范围
    const baseline = height - CFG.w * 1.8;
    let y = baseline;

    // 多频振幅——更丰富的地形
    const amp1 = CFG.w * 1.2;   // 大山丘
    const amp2 = CFG.w * 0.5;   // 中等起伏
    const amp3 = CFG.w * 0.2;   // 小波动

    while (x <= endX) {
      // 多频正弦叠加 — 有机地形
      const n1 = Math.sin(x * 0.0008) * amp1;  // 低频大波
      const n2 = Math.sin(x * 0.003) * amp2;   // 中频
      const n3 = Math.sin(x * 0.012) * amp3;   // 高频细节

      const target = baseline + n1 + n2 + n3;
      y += (target - y) * 0.12; // 平滑过渡

      // 限制范围
      const minY = baseline - amp1 * 1.5;
      const maxY = baseline + CFG.w;
      if (y < minY) y = minY;
      if (y > maxY) y = maxY;

      this.points.push({ x, y });
      x += CFG.groundStep;
    }

    // 平滑处理 — 避免锯齿
    for (let pass = 0; pass < 2; pass++) {
      for (let i = 2; i < this.points.length - 2; i++) {
        const a = this.points[i - 2].y;
        const b = this.points[i - 1].y;
        const c = this.points[i].y;
        const d = this.points[i + 1].y;
        const e = this.points[i + 2].y;
        this.points[i].y = (a + b + c + d + e) / 5;
      }
    }
  }
}
