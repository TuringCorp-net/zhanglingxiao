/**
 * particles.js — 粒子系统、屏幕震动、伤害飘字
 * 
 * 提供通用粒子发射器，支持爆炸、烟雾、火花、拾取光效等。
 * 屏幕震动管理器在爆炸/受伤时触发，带衰减。
 * 伤害飘字在命中时上浮显示伤害数值后消失。
 */

import { CFG } from './constants.js';

/* ========== 单个粒子 ========== */
class Particle {
    constructor(x, y, vx, vy, life, color, size, gravity = 0, fade = true) {
        this.x = x;
        this.y = y;
        this.vx = vx;
        this.vy = vy;
        this.life = life;
        this.maxLife = life;
        this.color = color;
        this.size = size;
        this.gravity = gravity;
        this.fade = fade;
        this.dead = false;
    }

    update(dt) {
        this.vy += this.gravity * dt;
        this.x += this.vx * dt;
        this.y += this.vy * dt;
        this.life -= dt;
        if (this.life <= 0) this.dead = true;
    }

    /** 返回 0~1 的剩余生命比 */
    alpha() {
        return this.fade ? Math.max(0, this.life / this.maxLife) : 1;
    }
}

/* ========== 伤害飘字 ========== */
class DamageText {
    constructor(x, y, text, color = '#fff') {
        this.x = x;
        this.y = y;
        this.text = text;
        this.color = color;
        this.life = 1.0;    // 持续1秒
        this.maxLife = 1.0;
        this.dead = false;
    }

    update(dt) {
        this.y -= 40 * dt;   // 上浮
        this.life -= dt;
        if (this.life <= 0) this.dead = true;
    }

    alpha() {
        return Math.max(0, this.life / this.maxLife);
    }
}

/* ========== 粒子管理器 ========== */
export class ParticleSystem {
    constructor() {
        this.particles = [];
        this.texts = [];

        // 屏幕震动
        this.shakeIntensity = 0;
        this.shakeDecay = 8; // 每秒衰减量

        // Boss 警报
        this.warningTimer = 0;   // 剩余警报时间
        this.warningAlpha = 0;
    }

    update(dt) {
        // 更新粒子
        for (const p of this.particles) p.update(dt);
        this.particles = this.particles.filter(p => !p.dead);

        // 更新飘字
        for (const t of this.texts) t.update(dt);
        this.texts = this.texts.filter(t => !t.dead);

        // 衰减屏幕震动
        this.shakeIntensity = Math.max(0, this.shakeIntensity - this.shakeDecay * dt);

        // Boss 警报倒计时
        if (this.warningTimer > 0) {
            this.warningTimer -= dt;
            // 脉动效果
            this.warningAlpha = Math.abs(Math.sin(this.warningTimer * 6)) * 0.35;
        } else {
            this.warningAlpha = 0;
        }
    }

    /** 获取当前帧的震动偏移 */
    getShakeOffset() {
        if (this.shakeIntensity < 0.5) return { x: 0, y: 0 };
        return {
            x: (Math.random() - 0.5) * this.shakeIntensity,
            y: (Math.random() - 0.5) * this.shakeIntensity
        };
    }

    /* ---------- 效果触发方法 ---------- */

    /** 触发屏幕震动 */
    shake(intensity = 10) {
        this.shakeIntensity = Math.max(this.shakeIntensity, intensity);
    }

    /** 触发 Boss 警报（持续秒数） */
    triggerWarning(duration = 2.5) {
        this.warningTimer = duration;
    }

    /** 添加伤害飘字 */
    addDamageText(x, y, damage, color) {
        this.texts.push(new DamageText(x, y, `-${damage}`, color || '#ff6b6b'));
    }

    /** 添加拾取飘字 */
    addPickupText(x, y, text, color) {
        this.texts.push(new DamageText(x, y, text, color || '#4ade80'));
    }

    /**
     * 坦克爆炸效果
     * @param {number} x - 世界坐标 X
     * @param {number} y - 世界坐标 Y
     * @param {boolean} isBoss - 是否为Boss（大爆炸）
     */
    explode(x, y, isBoss = false) {
        const count = isBoss ? 60 : 30;
        const speedMult = isBoss ? 1.6 : 1;
        const colors = isBoss
            ? ['#ff4444', '#ff8800', '#ffcc00', '#ffffff']
            : ['#ff6600', '#ff9900', '#ffcc33', '#ffee88'];

        for (let i = 0; i < count; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = (30 + Math.random() * 120) * speedMult;
            const color = colors[Math.floor(Math.random() * colors.length)];
            const size = 2 + Math.random() * (isBoss ? 5 : 3);
            const life = 0.4 + Math.random() * (isBoss ? 0.8 : 0.5);

            this.particles.push(new Particle(
                x, y,
                Math.cos(angle) * speed,
                Math.sin(angle) * speed - 40,
                life, color, size,
                200, true // 重力 + 淡出
            ));
        }

        // 烟雾粒子（较慢、较大、较暗）
        const smokeCount = isBoss ? 15 : 8;
        for (let i = 0; i < smokeCount; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = 10 + Math.random() * 40;
            this.particles.push(new Particle(
                x, y,
                Math.cos(angle) * speed,
                Math.sin(angle) * speed - 20,
                0.6 + Math.random() * 0.8,
                '#888', 4 + Math.random() * 4,
                50, true
            ));
        }

        this.shake(isBoss ? 18 : 10);
    }

    /** 炮弹落地小爆炸 */
    shellImpact(x, y) {
        const colors = ['#ffa500', '#ff8c00', '#ffcc00'];
        for (let i = 0; i < 12; i++) {
            const angle = -Math.PI * 0.1 + Math.random() * (-Math.PI * 0.8);
            const speed = 30 + Math.random() * 80;
            const color = colors[Math.floor(Math.random() * colors.length)];
            this.particles.push(new Particle(
                x, y,
                Math.cos(angle) * speed,
                Math.sin(angle) * speed,
                0.3 + Math.random() * 0.3,
                color, 2 + Math.random() * 2,
                300, true
            ));
        }
        // 泥土飞溅
        for (let i = 0; i < 6; i++) {
            const angle = -Math.PI * 0.2 + Math.random() * (-Math.PI * 0.6);
            const speed = 20 + Math.random() * 60;
            this.particles.push(new Particle(
                x, y,
                Math.cos(angle) * speed,
                Math.sin(angle) * speed,
                0.4 + Math.random() * 0.3,
                '#6b5b3a', 2 + Math.random() * 3,
                400, true
            ));
        }
        this.shake(5);
    }

    /** 拾取医疗箱闪光 */
    pickupFlash(x, y) {
        for (let i = 0; i < 10; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = 20 + Math.random() * 50;
            this.particles.push(new Particle(
                x, y,
                Math.cos(angle) * speed,
                Math.sin(angle) * speed,
                0.4 + Math.random() * 0.3,
                '#4ade80', 2 + Math.random() * 2,
                0, true
            ));
        }
    }

    /**
     * 绘制所有粒子和飘字
     * @param {CanvasRenderingContext2D} ctx
     * @param {{x:number, y:number}} camera
     */
    draw(ctx, camera) {
        // 粒子
        for (const p of this.particles) {
            const sx = p.x - camera.x;
            const sy = p.y - camera.y;
            ctx.globalAlpha = p.alpha();
            ctx.fillStyle = p.color;
            ctx.beginPath();
            ctx.arc(sx, sy, p.size, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.globalAlpha = 1;

        // 飘字
        for (const t of this.texts) {
            const sx = t.x - camera.x;
            const sy = t.y - camera.y;
            ctx.globalAlpha = t.alpha();
            ctx.fillStyle = t.color;
            ctx.font = 'bold 18px "Orbitron", system-ui, sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(t.text, sx, sy);
        }
        ctx.globalAlpha = 1;
        ctx.textAlign = 'start';

        // Boss 警报红色叠加
        if (this.warningAlpha > 0.01) {
            ctx.fillStyle = `rgba(255, 0, 0, ${this.warningAlpha})`;
            ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);

            // WARNING 文字
            if (this.warningTimer > 0.5) {
                ctx.globalAlpha = Math.abs(Math.sin(this.warningTimer * 8));
                ctx.fillStyle = '#ff0000';
                ctx.font = 'bold 64px "Orbitron", system-ui, sans-serif';
                ctx.textAlign = 'center';
                ctx.fillText('⚠ WARNING ⚠', ctx.canvas.width / 2, ctx.canvas.height / 2);
                ctx.font = 'bold 28px "Orbitron", system-ui, sans-serif';
                ctx.fillStyle = '#ffcc00';
                ctx.fillText('BOSS 来袭！', ctx.canvas.width / 2, ctx.canvas.height / 2 + 50);
                ctx.textAlign = 'start';
                ctx.globalAlpha = 1;
            }
        }
    }
}
