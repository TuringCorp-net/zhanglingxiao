/**
 * renderer.js — 游戏渲染器
 *
 * 负责所有Canvas绘制：
 * - 多层视差滚动背景（星空、远山、近山）
 * - 地形渲染（渐变地层 + 地表纹理线）
 * - 坦克绘制（跟随地形倾斜、无敌闪烁、死亡灰化）
 * - 弹药/火焰/医疗箱绘制
 * - HUD（心形生命、武器图标、装填进度条、Boss血条）
 */

import { CFG, clamp } from './constants.js';

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.width = canvas.width;
    this.height = canvas.height;

    // 预生成装饰元素
    this._stars = this._genStars(120);
    this._mountains1 = this._genMountains(6, 0.55, 0.25); // 远山
    this._mountains2 = this._genMountains(8, 0.68, 0.15); // 近山
  }

  resize() {
    this.width = window.innerWidth;
    this.height = window.innerHeight;
    this.canvas.width = this.width;
    this.canvas.height = this.height;
  }

  /* ========== 背景 ========== */

  /** 生成随机星星位置 */
  _genStars(count) {
    const stars = [];
    for (let i = 0; i < count; i++) {
      stars.push({
        x: Math.random(),
        y: Math.random() * 0.6,
        size: 0.5 + Math.random() * 1.5,
        twinkle: Math.random() * Math.PI * 2
      });
    }
    return stars;
  }

  /** 生成山脉轮廓 */
  _genMountains(peakCount, baseY, height) {
    const pts = [];
    const step = 1 / peakCount;
    for (let i = 0; i <= peakCount; i++) {
      const x = i * step;
      const peakH = (Math.sin(i * 2.7 + 1.3) * 0.5 + 0.5) * height;
      pts.push({ x, y: baseY - peakH });
    }
    return pts;
  }

  /** 绘制天空背景 + 星星 + 远近山脉 */
  drawBackground(camera, time) {
    const ctx = this.ctx;
    const w = this.width;
    const h = this.height;

    // 天空渐变
    const sky = ctx.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, '#0a0e27');
    sky.addColorStop(0.4, '#141b3d');
    sky.addColorStop(0.7, '#1a2744');
    sky.addColorStop(1, '#1e3a5f');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, w, h);

    // 星星（微视差）
    const starParallax = camera.x * 0.01;
    const t = time * 0.001;
    for (const s of this._stars) {
      const sx = ((s.x * w * 2 - starParallax) % (w * 1.5) + w * 1.5) % (w * 1.5);
      const sy = s.y * h;
      const alpha = 0.4 + 0.4 * Math.sin(t + s.twinkle);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(sx, sy, s.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // 远山（慢视差）
    this._drawMountainLayer(ctx, this._mountains1, camera.x * 0.03, '#0f1b30', '#162340', w, h);
    // 近山（中视差）
    this._drawMountainLayer(ctx, this._mountains2, camera.x * 0.08, '#15233a', '#1c2e4a', w, h);
  }

  /** 绘制山脉层 */
  _drawMountainLayer(ctx, pts, offset, colorTop, colorBot, w, h) {
    const grad = ctx.createLinearGradient(0, h * 0.3, 0, h);
    grad.addColorStop(0, colorTop);
    grad.addColorStop(1, colorBot);
    ctx.fillStyle = grad;
    ctx.beginPath();

    // 根据 offset 平移整个山脉
    const shift = (offset % w);
    const totalW = w * 2;

    ctx.moveTo(0, h);
    for (let i = 0; i < pts.length; i++) {
      const px = pts[i].x * totalW - shift;
      const py = pts[i].y * h;
      ctx.lineTo(((px % totalW) + totalW) % totalW, py);
    }
    ctx.lineTo(w, h);
    ctx.closePath();
    ctx.fill();
  }

  /* ========== 地形 ========== */

  drawTerrain(terrain, camera) {
    const ctx = this.ctx;
    ctx.save();

    const startX = Math.floor(camera.x / CFG.groundStep) * CFG.groundStep;
    const endX = startX + this.width + CFG.groundStep * 2;

    // 地层渐变填充
    const grad = ctx.createLinearGradient(0, this.height * 0.3, 0, this.height);
    grad.addColorStop(0, '#2d4a3e');
    grad.addColorStop(0.3, '#263a35');
    grad.addColorStop(0.6, '#1a2c28');
    grad.addColorStop(1, '#0f1a18');
    ctx.fillStyle = grad;

    ctx.beginPath();
    ctx.moveTo(startX - camera.x, this.height + 10);
    for (let x = startX; x <= endX; x += 4) {
      const y = terrain.sampleY(x);
      ctx.lineTo(x - camera.x, y - camera.y);
    }
    ctx.lineTo(endX - camera.x, this.height + 10);
    ctx.closePath();
    ctx.fill();

    // 地表高亮线
    ctx.strokeStyle = '#4a7a5e';
    ctx.lineWidth = 3;
    ctx.shadowColor = '#4a7a5e';
    ctx.shadowBlur = 6;
    ctx.beginPath();
    for (let x = startX; x <= endX; x += 4) {
      const y = terrain.sampleY(x);
      const sx = x - camera.x;
      const sy = y - camera.y;
      if (x === startX) ctx.moveTo(sx, sy);
      else ctx.lineTo(sx, sy);
    }
    ctx.stroke();
    ctx.shadowBlur = 0;

    // 草地纹理小线段
    ctx.strokeStyle = '#5a9a6e';
    ctx.lineWidth = 1;
    for (let x = startX; x <= endX; x += 12) {
      const y = terrain.sampleY(x);
      const sx = x - camera.x;
      const sy = y - camera.y;
      const ang = terrain.slopeAngle(x);
      // 只在非陡坡处画草
      if (Math.abs(ang) < CFG.slopeThreshold * 0.8) {
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.lineTo(sx + Math.sin(x * 0.3) * 3, sy - 4 - Math.random() * 4);
        ctx.stroke();
      }
    }

    ctx.restore();
  }

  /* ========== 坦克 ========== */

  drawTank(tank, camera, invulnerable = false, time = 0) {
    if (!tank) return;
    const ctx = this.ctx;
    const x = tank.x - camera.x;
    const y = tank.y - camera.y;
    const w = CFG.w;

    // 无敌闪烁：每100ms 交替可见/不可见
    if (invulnerable && Math.floor(time / 100) % 2 === 0) return;

    ctx.save();
    ctx.translate(x, y);

    // 根据地形坡度旋转整个坦克
    ctx.rotate(tank.slopeAngle);

    const isBoss = !tank.isPlayer && tank.kind === 'robot' && tank.weapon === 'missile';
    let baseColor = tank.isPlayer ? '#22d3ee' : (isBoss ? '#ef4444' : '#eab308');

    if (!tank.alive) {
      baseColor = '#4b5563';
      ctx.globalAlpha = 0.6;
    }

    // —— 阴影 ——
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath();
    ctx.ellipse(0, 2, w * 0.35, w * 0.06, 0, 0, Math.PI * 2);
    ctx.fill();

    // —— 车体 ——
    if (tank.kind === 'wheel') {
      // 轮子
      ctx.fillStyle = tank.alive ? '#1e293b' : '#1f2937';
      ctx.beginPath();
      ctx.arc(-w * 0.3, -w * 0.08, w * 0.13, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(w * 0.3, -w * 0.08, w * 0.13, 0, Math.PI * 2);
      ctx.fill();
      // 底盘
      ctx.fillStyle = baseColor;
      ctx.beginPath();
      ctx.roundRect(-w * 0.38, -w * 0.35, w * 0.76, w * 0.27, 4);
      ctx.fill();
      // 装甲线条
      ctx.strokeStyle = 'rgba(255,255,255,0.15)';
      ctx.lineWidth = 1;
      ctx.strokeRect(-w * 0.35, -w * 0.33, w * 0.7, w * 0.23);

    } else if (tank.kind === 'track') {
      // 履带
      ctx.fillStyle = tank.alive ? '#334155' : '#374151';
      ctx.beginPath();
      ctx.roundRect(-w * 0.42, -w * 0.12, w * 0.84, w * 0.13, 5);
      ctx.fill();
      // 履带纹路
      ctx.strokeStyle = 'rgba(255,255,255,0.08)';
      ctx.lineWidth = 1;
      for (let i = -w * 0.38; i < w * 0.38; i += 8) {
        ctx.beginPath();
        ctx.moveTo(i, -w * 0.12);
        ctx.lineTo(i, -w * 0.01);
        ctx.stroke();
      }
      // 底盘
      ctx.fillStyle = baseColor;
      ctx.beginPath();
      ctx.roundRect(-w * 0.38, -w * 0.42, w * 0.76, w * 0.3, 4);
      ctx.fill();

    } else {
      // 机器人 — 腿部
      ctx.fillStyle = tank.alive ? '#475569' : '#4b5563';
      ctx.beginPath();
      ctx.moveTo(-w * 0.28, 0);
      ctx.lineTo(-w * 0.22, -w * 0.2);
      ctx.lineTo(-w * 0.12, -w * 0.2);
      ctx.lineTo(-w * 0.15, 0);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(w * 0.28, 0);
      ctx.lineTo(w * 0.22, -w * 0.2);
      ctx.lineTo(w * 0.12, -w * 0.2);
      ctx.lineTo(w * 0.15, 0);
      ctx.fill();
      // 躯干
      ctx.fillStyle = baseColor;
      ctx.beginPath();
      ctx.roundRect(-w * 0.28, -w * 0.55, w * 0.56, w * 0.38, 6);
      ctx.fill();
      // 眼睛/传感器
      if (tank.alive) {
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(tank.facing * w * 0.08, -w * 0.4, 3, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // —— 炮塔 ——
    ctx.save();
    // 炮塔需要反旋地形角度（因为已经旋转了整体），再加上炮管角度
    ctx.translate(0, -w * 0.32);
    ctx.rotate(-tank.slopeAngle + tank.barrelAngle);

    // 炮管
    ctx.fillStyle = tank.alive ? '#94a3b8' : '#6b7280';
    ctx.beginPath();
    ctx.roundRect(0, -3, w * 0.55, 6, 2);
    ctx.fill();
    // 炮口闪光效果（通过颜色提示）
    ctx.fillStyle = '#cbd5e1';
    ctx.beginPath();
    ctx.roundRect(w * 0.5, -4, 6, 8, 2);
    ctx.fill();

    // 炮塔圆盖
    ctx.fillStyle = baseColor;
    ctx.beginPath();
    ctx.arc(0, 0, w * 0.13, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.3)';
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.restore();

    // —— 血条 ——
    if (tank.alive) {
      // 需要反旋，让血条水平
      ctx.rotate(-tank.slopeAngle);
      const hpPct = clamp(tank.hp / tank.maxHp, 0, 1);
      const barW = w * 0.8;
      const barY = -w * 0.75;
      const barH = 5;

      // 背景
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.beginPath();
      ctx.roundRect(-barW / 2, barY, barW, barH, 2);
      ctx.fill();
      // 前景
      const hpColor = hpPct > 0.5 ? '#22c55e' : (hpPct > 0.2 ? '#eab308' : '#ef4444');
      ctx.fillStyle = hpColor;
      ctx.beginPath();
      ctx.roundRect(-barW / 2, barY, barW * hpPct, barH, 2);
      ctx.fill();
    }

    ctx.restore();
  }

  /* ========== 弹药 ========== */

  drawProjectile(p, camera) {
    if (p.dead) return;
    const ctx = this.ctx;
    const x = p.x - camera.x;
    const y = p.y - camera.y;

    ctx.save();
    ctx.translate(x, y);

    if (p.type === 'shell') {
      // 炮弹 — 发光小球
      ctx.shadowColor = '#fbbf24';
      ctx.shadowBlur = 8;
      ctx.fillStyle = '#fbbf24';
      ctx.beginPath();
      ctx.arc(0, 0, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      // 拖尾
      ctx.globalAlpha = 0.3;
      ctx.fillStyle = '#ffcc00';
      ctx.beginPath();
      ctx.arc(-p.vx * 0.01, -p.vy * 0.01, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    } else {
      // 导弹
      ctx.rotate(Math.atan2(p.vy, p.vx));
      // 尾焰
      ctx.fillStyle = '#fbbf24';
      ctx.beginPath();
      ctx.moveTo(-10, 0);
      ctx.lineTo(-16, -4);
      ctx.lineTo(-16, 4);
      ctx.closePath();
      ctx.fill();
      // 弹体
      ctx.fillStyle = '#f87171';
      ctx.beginPath();
      ctx.roundRect(-7, -3, 14, 6, 2);
      ctx.fill();
      // 弹头
      ctx.fillStyle = '#fca5a5';
      ctx.beginPath();
      ctx.arc(7, 0, 3, -Math.PI / 2, Math.PI / 2);
      ctx.fill();
    }
    ctx.restore();
  }

  /* ========== 火焰 ========== */

  drawFlame(f, camera) {
    const ctx = this.ctx;
    const o = f.owner;
    if (!o || !o.alive) return;

    const angle = o.barrelAngle;
    const ox = (o.x + Math.cos(angle) * CFG.w * 0.6) - camera.x;
    const oy = ((o.y - CFG.w * 0.35) + Math.sin(angle) * CFG.w * 0.6) - camera.y;

    ctx.save();
    ctx.translate(ox, oy);
    ctx.rotate(angle);

    const range = CFG.flame.range * CFG.w;
    const cone = CFG.flame.angle;

    // 多层渐变火焰
    const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, range);
    grad.addColorStop(0, 'rgba(255, 255, 200, 0.9)');
    grad.addColorStop(0.2, 'rgba(255, 200, 0, 0.7)');
    grad.addColorStop(0.5, 'rgba(255, 100, 0, 0.4)');
    grad.addColorStop(0.8, 'rgba(200, 30, 0, 0.15)');
    grad.addColorStop(1, 'rgba(100, 0, 0, 0)');

    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, range, -cone / 2, cone / 2);
    ctx.closePath();
    ctx.fill();

    // 外层辉光
    ctx.globalAlpha = 0.15;
    ctx.fillStyle = '#ff4400';
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, range * 1.1, -cone / 2 - 0.05, cone / 2 + 0.05);
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 1;

    ctx.restore();
  }

  /* ========== 医疗箱 ========== */

  drawMedkit(m, camera) {
    if (!m.alive) return;
    const ctx = this.ctx;
    const x = m.x - camera.x;
    const y = m.y - camera.y;
    const size = CFG.w * 0.35;

    ctx.save();
    ctx.translate(x, y - size / 2);

    // 柔和发光
    ctx.shadowColor = 'rgba(74, 222, 128, 0.5)';
    ctx.shadowBlur = 10;

    // 白色箱体
    ctx.fillStyle = '#f0fdf4';
    ctx.beginPath();
    ctx.roundRect(-size / 2, -size / 2, size, size, 4);
    ctx.fill();
    ctx.shadowBlur = 0;

    // 红十字
    ctx.fillStyle = '#ef4444';
    const thick = size * 0.25;
    ctx.fillRect(-thick / 2, -size * 0.35, thick, size * 0.7);
    ctx.fillRect(-size * 0.35, -thick / 2, size * 0.7, thick);

    ctx.restore();
  }

  /* ========== HUD ========== */

  /**
   * 绘制 HUD（血量、生命、武器、装填进度、分数）
   */
  drawHUD(player, lives, score, minionKills, time) {
    if (!player) return;
    const ctx = this.ctx;
    ctx.save();
    const pad = 16;
    let yOff = pad;

    // —— 血条 ——
    const hpPct = clamp(player.hp / player.maxHp, 0, 1);
    const barW = 200;
    const barH = 16;
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.beginPath();
    ctx.roundRect(pad, yOff, barW, barH, 4);
    ctx.fill();
    const hpColor = hpPct > 0.5 ? '#22c55e' : (hpPct > 0.2 ? '#eab308' : '#ef4444');
    ctx.fillStyle = hpColor;
    ctx.beginPath();
    ctx.roundRect(pad, yOff, barW * hpPct, barH, 4);
    ctx.fill();
    // HP 文字
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 12px "Orbitron", system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`${Math.ceil(player.hp)} / ${player.maxHp}`, pad + barW / 2, yOff + 12);
    ctx.textAlign = 'start';

    yOff += barH + 10;

    // —— 心形生命 ——
    ctx.font = '18px sans-serif';
    let heartsStr = '';
    for (let i = 0; i < lives; i++) heartsStr += '❤️ ';
    ctx.fillText(heartsStr, pad, yOff + 4);

    yOff += 22;

    // —— 武器 + 装填进度 ——
    const weaponNames = { shell: '🔫 穿甲炮', flame: '🔥 喷火器', missile: '🚀 追踪弹' };
    ctx.fillStyle = '#e2e8f0';
    ctx.font = 'bold 14px "Orbitron", system-ui, sans-serif';
    ctx.fillText(weaponNames[player.weapon] || player.weapon, pad, yOff + 4);

    // 装填进度条
    if (player.weapon !== 'flame') {
      const now = Date.now();
      const reloadTime = player.weapon === 'shell' ? CFG.shell.reload : CFG.missile.reload;
      const remaining = Math.max(0, player.nextFireAt - now);
      const reloadPct = 1 - remaining / reloadTime;

      yOff += 18;
      ctx.fillStyle = 'rgba(0,0,0,0.4)';
      ctx.beginPath();
      ctx.roundRect(pad, yOff, 120, 8, 3);
      ctx.fill();
      ctx.fillStyle = reloadPct >= 1 ? '#38bdf8' : '#64748b';
      ctx.beginPath();
      ctx.roundRect(pad, yOff, 120 * clamp(reloadPct, 0, 1), 8, 3);
      ctx.fill();
      if (reloadPct >= 1) {
        ctx.fillStyle = '#38bdf8';
        ctx.font = '10px system-ui, sans-serif';
        ctx.fillText('READY', pad + 130, yOff + 8);
      }
    }

    // —— 右上角分数 ——
    ctx.fillStyle = '#fbbf24';
    ctx.font = 'bold 20px "Orbitron", system-ui, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(`⭐ ${score}`, this.width - pad, pad + 18);

    // 击杀计数
    ctx.fillStyle = '#94a3b8';
    ctx.font = '14px "Orbitron", system-ui, sans-serif';
    ctx.fillText(`击杀 ${minionKills} / 5`, this.width - pad, pad + 38);
    ctx.textAlign = 'start';

    ctx.restore();
  }

  /** 清屏 */
  clear() {
    this.ctx.clearRect(0, 0, this.width, this.height);
  }
}
