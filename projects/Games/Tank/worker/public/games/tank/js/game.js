/**
 * game.js — 游戏主逻辑
 *
 * 管理游戏生命周期：菜单 → 选择 → 战斗 → 死亡/复活 → Game Over。
 * 集成粒子系统、音效系统，统一处理碰撞、生成、得分、UI 更新。
 */

import { CFG, lerp, dist, clamp } from './constants.js';
import { Terrain } from './terrain.js';
import { Tank } from './tank.js';
import { Projectile, Flame } from './projectile.js';
import { ParticleSystem } from './particles.js';
import { Audio } from './audio.js';

export class Game {
  constructor(renderer, input) {
    this.renderer = renderer;
    this.input = input;

    this.terrain = new Terrain();
    this.particles = new ParticleSystem();
    this.audio = new Audio();

    this.player = null;
    this.enemies = [];
    this.projectiles = [];
    this.medkits = [];

    this.score = 0;
    this.lives = 3;
    this.minionKills = 0;
    this.bossAlive = false;
    this.totalKills = 0;     // 总击杀（战绩用）
    this.startTime = 0;      // 开局时间（战绩用）

    this.state = 'start';    // start, playing, respawn, gameover
    this.invulnUntil = 0;

    this.lastTime = 0;
    this.camera = { x: 0, y: 0 };

    // DOM UI 引用
    this.ui = {
      screen: document.getElementById('screen'),
      hud: document.getElementById('hud')
    };
  }

  /** 初始化游戏 */
  init() {
    this.terrain.gen(CFG.width, CFG.height);
    this.showTankSelection();
  }

  /** 启动游戏循环 */
  startLoop() {
    requestAnimationFrame(t => this.loop(t));
  }

  /** 主循环 */
  loop(ts) {
    if (!this.lastTime) this.lastTime = ts;
    const dt = Math.min(0.05, (ts - this.lastTime) / 1000);
    this.lastTime = ts;

    if (this.state === 'playing') {
      this.update(dt, ts);
    }

    // 始终绘制（菜单也显示背景）
    this.draw(ts);

    requestAnimationFrame(t => this.loop(t));
  }

  /* ========== 更新逻辑 ========== */

  update(dt, ts) {
    const now = Date.now();

    // 更新粒子系统
    this.particles.update(dt);

    // —— 玩家 ——
    if (this.player && this.player.alive) {
      const control = this.input.getControl();

      // 开火
      if (control.fire && now >= this.player.nextFireAt) {
        this.fire(this.player, now);
      }

      this.player.update(dt, this.terrain, this.input, now);

      // 检测死亡
      if (this.player.hp <= 0 && this.player.alive) {
        this.player.alive = false;
        this.handleDeath();
      }
    }

    // —— 敌人 ——
    this.updateEnemies(dt, now);

    // —— 弹药 ——
    this.updateProjectiles(dt, now);

    // —— 医疗箱 ——
    this.updateMedkits(dt);

    // —— 碰撞 ——
    this.resolveCollisions();

    // —— 生成逻辑 ——
    this.spawnLogic();

    // —— 镜头跟随 ——
    if (this.player) {
      const shake = this.particles.getShakeOffset();
      this.camera.x = lerp(this.camera.x, this.player.x - this.renderer.width * 0.3, CFG.cameraLerp) + shake.x;
      this.camera.y = lerp(this.camera.y, this.player.y - this.renderer.height * 0.6, CFG.cameraLerp) + shake.y;
    }
  }

  /* ========== 绘制 ========== */

  draw(ts) {
    const r = this.renderer;
    r.clear();
    r.drawBackground(this.camera, ts);
    r.drawTerrain(this.terrain, this.camera);

    // 医疗箱
    this.medkits.forEach(m => r.drawMedkit(m, this.camera));

    // 坦克
    const invuln = this.player && Date.now() < this.invulnUntil;
    if (this.player) r.drawTank(this.player, this.camera, invuln, ts);
    this.enemies.forEach(e => {
      if (e.alive || !e.deadProcessed) {
        r.drawTank(e, this.camera, false, ts);
      }
    });

    // 弹药和火焰
    this.projectiles.forEach(p => {
      if (p instanceof Projectile) r.drawProjectile(p, this.camera);
      else if (p instanceof Flame) r.drawFlame(p, this.camera);
    });

    // 粒子/飘字/Boss警报
    this.particles.draw(r.ctx, this.camera);

    // HUD（仅在战斗中）
    if (this.state === 'playing' && this.player) {
      r.drawHUD(this.player, this.lives, this.score, this.minionKills, ts);
    }
  }

  /* ========== 开火 ========== */

  fire(tank, now) {
    if (tank.weapon === 'shell') {
      tank.nextFireAt = now + CFG.shell.reload;
      this.projectiles.push(new Projectile(tank, tank.x, tank.y - CFG.w * 0.35, 'shell'));
      this.audio.playShellFire();

    } else if (tank.weapon === 'missile') {
      tank.nextFireAt = now + CFG.missile.reload;
      // 锁定最近目标
      let target = null;
      if (tank.isPlayer) {
        let minD = Infinity;
        for (const e of this.enemies) {
          if (!e.alive) continue;
          const d = dist(tank.x, tank.y, e.x, e.y);
          if (d < minD) { minD = d; target = e; }
        }
      } else {
        target = this.player;
      }
      this.projectiles.push(new Projectile(tank, tank.x, tank.y - CFG.w * 0.35, 'missile', target));
      this.audio.playMissileLaunch();

    } else if (tank.weapon === 'flame') {
      let f = tank.flameProjectile;
      if (!f || f.dead) {
        f = new Flame(tank);
        tank.flameProjectile = f;
        this.projectiles.push(f);
      }
      const hitList = f.update(now, this.enemies, this.player, this.terrain);
      // 火焰伤害飘字
      for (const t of hitList) {
        this.particles.addDamageText(t.x, t.y - CFG.w * 0.5, CFG.flame.damage, '#ff9500');
        if (t.isPlayer) this.audio.playHurt();
      }
    }
  }

  /* ========== 弹药更新 ========== */

  updateProjectiles(dt, now) {
    for (const p of this.projectiles) {
      if (p instanceof Flame) {
        // 火焰在未激活时自动消亡
        if (now - p.lastUpdate > 200) p.dead = true;
        continue;
      }

      const result = p.update(dt, this.terrain, this.enemies, this.player);
      if (result && result.hit) {
        // 命中效果
        this.particles.shellImpact(result.x, result.y);
        this.audio.playExplosion(false);
        if (result.target) {
          this.particles.addDamageText(
            result.target.x, result.target.y - CFG.w * 0.6,
            p.type === 'shell' ? CFG.shell.damage : CFG.missile.damage
          );
          if (result.target.isPlayer) this.audio.playHurt();
        }
      }
    }
    this.projectiles = this.projectiles.filter(p => !p.dead);
  }

  /* ========== 敌人 AI ========== */

  updateEnemies(dt, now) {
    for (const e of this.enemies) {
      if (!e.alive) continue;

      // AI: 朝玩家移动 + 射程内开火
      const distToPlayer = e.x - this.player.x;
      const absDist = Math.abs(distToPlayer);
      const stopDist = CFG.w * 1.2;

      let move = 0;
      if (absDist > stopDist) {
        move = -Math.sign(distToPlayer);
      }

      e.facing = -Math.sign(distToPlayer);

      // 武器射程判定 — 进入射程即攻击（不需要停下来）
      let wantFire = false;
      const weaponRange = e.weapon === 'flame'
        ? CFG.flame.range * CFG.w * 1.2
        : CFG.w * 8;
      if (absDist < weaponRange) {
        wantFire = true;
      }

      // AI 输入
      const aiInput = {
        keys: { has: () => false },
        move
      };

      e.update(dt, this.terrain, aiInput, now);

      // 开火
      if (wantFire && now >= e.nextFireAt && e.alive) {
        this.fire(e, now);
      }
    }

    // 处理死亡敌人
    for (const e of this.enemies) {
      if (!e.alive && !e.deadProcessed) {
        e.deadProcessed = true;
        const isBoss = e.kind === 'robot' && e.weapon === 'missile';

        // 爆炸效果
        this.particles.explode(e.x, e.y, isBoss);
        this.audio.playExplosion(isBoss);

        // 计分
        this.addScore(isBoss ? 30 : 15);
        this.totalKills++;

        // 玩家升级逻辑：每击杀5个小兵
        if (!isBoss && this.minionKills > 0 && (this.minionKills + 1) % 5 === 0) {
           this.upgradePlayer();
        }

        if (isBoss) {
          this.bossAlive = false;
          this.minionKills = 0;
        } else {
          this.minionKills++;
        }
      }
    }

    // 清理已处理的死亡敌人（延迟清除，让爆炸可见）
    this.enemies = this.enemies.filter(e => e.alive || !e.deadProcessed);
  }

  /* ========== 医疗箱 ========== */

  updateMedkits(dt) {
    for (const m of this.medkits) {
      if (!m.alive) continue;
      m.y = this.terrain.sampleY(m.x);

      // 玩家拾取
      if (this.player && this.player.alive) {
        if (dist(m.x, m.y, this.player.x, this.player.y) < CFG.w) {
          this.player.hp = Math.min(this.player.maxHp, this.player.hp + 15);
          m.alive = false;
          this.particles.pickupFlash(m.x, m.y - CFG.w * 0.3);
          this.particles.addPickupText(m.x, m.y - CFG.w * 0.5, '+15 HP');
          this.audio.playPickup();
        }
      }

      // 敌人推动医疗箱
      for (const e of this.enemies) {
        if (!e.alive) continue;
        const dx = m.x - e.x;
        if (Math.abs(dx) < CFG.w) {
          m.x += Math.sign(dx) * e.speed * dt * 0.5;
        }
      }
    }
    this.medkits = this.medkits.filter(m => m.alive);
  }

  /* ========== 碰撞 ========== */

  resolveCollisions() {
    const allTanks = [this.player, ...this.enemies].filter(t => t && t.alive);

    // 坦克间碰撞
    for (let i = 0; i < allTanks.length; i++) {
      for (let j = i + 1; j < allTanks.length; j++) {
        const a = allTanks[i];
        const b = allTanks[j];
        const dx = b.x - a.x;
        const d = Math.abs(dx);
        if (d < CFG.w) {
          const push = (CFG.w - d) / 2;
          const dir = dx > 0 ? 1 : -1;
          a.x -= push * dir;
          b.x += push * dir;
        }
      }
    }

    // 坦克/医疗箱碰撞（推挤）
    for (const t of allTanks) {
      for (const m of this.medkits) {
        if (!m.alive) continue;
        const dx = m.x - t.x;
        const d = Math.abs(dx);
        if (d < CFG.w) {
          m.x += (CFG.w - d) * Math.sign(dx);
        }
      }
    }
  }

  /* ========== 生成 ========== */

  spawnLogic() {
    if (this.bossAlive) return;

    const aliveEnemies = this.enemies.filter(e => e.alive).length;

    if (this.minionKills >= 5 && aliveEnemies === 0) {
      this.spawnBoss();
    } else if (aliveEnemies < 3 && this.minionKills < 5) {
      this.spawnMinion();
    }
  }

  spawnMinion() {
    const x = this.camera.x + this.renderer.width * 1.3;
    const kind = Math.random() < 0.5 ? 'wheel' : 'track';
    const weapon = Math.random() < 0.5 ? 'shell' : 'flame';
    const t = new Tank(kind, false, weapon, x, this.terrain.sampleY(x));
    this.enemies.push(t);
  }

  spawnBoss() {
    const x = this.camera.x + this.renderer.width * 1.3;
    const t = new Tank('robot', false, 'missile', x, this.terrain.sampleY(x));
    this.enemies.push(t);
    this.bossAlive = true;

    // Boss 登场特效
    this.particles.triggerWarning(2.5);
    this.audio.playWarning();
  }

  spawnMedkits() {
    this.medkits = [];
    let tries = 0;
    while (this.medkits.length < 10 && tries < 1000) {
      const x = this.camera.x + Math.random() * this.renderer.width * 5 + this.renderer.width;
      let ok = true;
      for (const m of this.medkits) {
        if (Math.abs(m.x - x) < CFG.w * 5) ok = false;
      }
      // 不放在陡坡上
      const ang = this.terrain.slopeAngle(x);
      if (this.terrain.isSteep(ang)) ok = false;
      if (ok) {
        this.medkits.push({ x, y: this.terrain.sampleY(x), alive: true });
      }
      tries++;
    }
  }

  /* ========== 升级 ========== */
  
  upgradePlayer() {
    if (!this.player || !this.player.alive) return;
    
    // 增加属性
    this.player.maxHp += 10;
    this.player.hp = Math.min(this.player.hp + 10, this.player.maxHp); // 同时回血10点？需求只说上限增加。通常增加上限会保留当前损失或按比例。这里直接加满新增部分比较合理。
    this.player.speed *= 1.05; // 增加5%移动速度
    this.player.damageBonus = (this.player.damageBonus || 0) + 3; // 增加3点伤害
    
    // 显示升级提示
    this.showUpgradeMessage();
    this.particles.pickupFlash(this.player.x, this.player.y);
    this.audio.playPickup(); // 借用拾取音效
  }

  showUpgradeMessage() {
    const msg = document.createElement('div');
    msg.className = 'upgrade-message';
    msg.innerHTML = `
      <h3 style="margin:0;color:#fbbf24;text-shadow:0 0 10px rgba(251,191,36,0.5)">LEVEL UP!</h3>
      <div style="font-size:0.9em;margin-top:5px">
        血量上限 +10<br>
        移动速度 +5%<br>
        攻击伤害 +3
      </div>
    `;
    // 样式需要添加到 CSS，或者直接内联
    msg.style.position = 'absolute';
    msg.style.top = '20%';
    msg.style.left = '50%';
    msg.style.transform = 'translate(-50%, -50%)';
    msg.style.textAlign = 'center';
    msg.style.color = '#fff';
    msg.style.fontFamily = '"Orbitron", sans-serif';
    msg.style.pointerEvents = 'none';
    msg.style.animation = 'floatUp 3s forwards';
    msg.style.zIndex = '1000';
    
    document.body.appendChild(msg);
    setTimeout(() => msg.remove(), 3000);
  }

  /* ========== 计分 ========== */

  addScore(pts) {
    const oldScore = this.score;
    this.score += pts;
    // 每满50分额外加10
    if (Math.floor(this.score / 50) > Math.floor(oldScore / 50)) {
      this.score += 10;
    }
  }

  /* ========== 死亡/复活 ========== */

  handleDeath() {
    // 爆炸效果
    this.particles.explode(this.player.x, this.player.y, false);
    this.audio.playExplosion(true);

    this.lives--;

    if (this.lives > 0) {
      this.state = 'respawn';
      this.ui.screen.innerHTML = `
        <h2 class="title-glow">💀 你牺牲了</h2>
        <p>剩余复活次数: <span style="color:#ff6b6b;font-weight:bold;font-size:1.5em">${this.lives}</span></p>
      `;
      this.ui.screen.style.display = 'block';

      setTimeout(() => this.respawnPlayer(), 2000);
    } else {
      this.state = 'gameover';
      const surviveTime = Math.floor((Date.now() - this.startTime) / 1000);
      const minutes = Math.floor(surviveTime / 60);
      const seconds = surviveTime % 60;

      this.ui.screen.innerHTML = `
        <h2 class="title-glow" style="color:#ef4444">GAME OVER</h2>
        <div class="stats-grid">
          <div class="stat-item">
            <div class="stat-value">${this.score}</div>
            <div class="stat-label">最终得分</div>
          </div>
          <div class="stat-item">
            <div class="stat-value">${this.totalKills}</div>
            <div class="stat-label">总击杀</div>
          </div>
          <div class="stat-item">
            <div class="stat-value">${minutes}:${String(seconds).padStart(2, '0')}</div>
            <div class="stat-label">存活时间</div>
          </div>
        </div>
        <button class="btn-primary" id="btn-restart">🔄 重新开始</button>
      `;
      this.ui.screen.style.display = 'block';
      setTimeout(() => {
        const btn = document.getElementById('btn-restart');
        if (btn) btn.onclick = () => this.restart();
      }, 100);
    }
  }

  respawnPlayer() {
    const origin = this.player.x;
    // 搜索安全复活点
    let rx = origin;
    const candidates = [origin, origin - CFG.w * 2, origin + CFG.w * 2, origin - CFG.w * 4, origin + CFG.w * 4];
    for (const c of candidates) {
      const a = this.terrain.slopeAngle(c);
      if (!this.terrain.isSteep(a)) { rx = c; break; }
    }

    this.player.hp = this.player.maxHp;
    this.player.alive = true;
    this.player.x = rx;
    this.player.y = this.terrain.sampleY(rx);
    this.player.deadProcessed = false;

    this.state = 'playing';
    this.ui.screen.style.display = 'none';
    this.invulnUntil = Date.now() + 2000;
  }

  restart() {
    this.enemies = [];
    this.projectiles = [];
    this.medkits = [];
    this.score = 0;
    this.lives = 3;
    this.minionKills = 0;
    this.bossAlive = false;
    this.totalKills = 0;
    this.terrain.gen(CFG.width, CFG.height);
    this.showTankSelection();
  }

  /* ========== UI 菜单 ========== */

  showTankSelection() {
    this.state = 'menu';
    this.ui.screen.innerHTML = `
      <h2 class="title-glow">🎮 坦克大战</h2>
      <p class="subtitle">选择你的战斗载具</p>
      <div class="card-grid">
        <button class="card" id="btn-wheel">
          <div class="card-icon">🏎️</div>
          <div class="card-title">轮式战车</div>
          <div class="card-desc">速度 ★★★<br>操控 ★☆☆<br>高速移动，陡坡易滑</div>
        </button>
        <button class="card" id="btn-track">
          <div class="card-icon">🛡️</div>
          <div class="card-title">履带战车</div>
          <div class="card-desc">速度 ★★☆<br>操控 ★★☆<br>均衡稳定，陡坡可控</div>
        </button>
        <button class="card" id="btn-robot">
          <div class="card-icon">🤖</div>
          <div class="card-title">机甲战士</div>
          <div class="card-desc">速度 ★☆☆<br>操控 ★★★<br>完美抓地，无惧陡坡</div>
        </button>
      </div>
    `;
    this.ui.screen.style.display = 'block';

    document.getElementById('btn-wheel').onclick = () => this.selectTank('wheel');
    document.getElementById('btn-track').onclick = () => this.selectTank('track');
    document.getElementById('btn-robot').onclick = () => this.selectTank('robot');
  }

  selectTank(kind) {
    this.audio.init(); // 首次用户交互时初始化 AudioContext
    this.tempTankKind = kind;
    this.showWeaponSelection();
  }

  showWeaponSelection() {
    this.ui.screen.innerHTML = `
      <h2 class="title-glow">⚔️ 选择武器</h2>
      <p class="subtitle">选择你的攻击方式</p>
      <div class="card-grid">
        <button class="card" id="btn-shell">
          <div class="card-icon">💥</div>
          <div class="card-title">穿甲炮</div>
          <div class="card-desc">抛物线弹道<br>单发 10 伤害<br>3秒装填</div>
        </button>
        <button class="card" id="btn-flame">
          <div class="card-icon">🔥</div>
          <div class="card-title">喷火器</div>
          <div class="card-desc">锥形持续灼烧<br>0.5秒 4 伤害<br>射程 2w</div>
        </button>
        <button class="card" id="btn-missile">
          <div class="card-icon">🚀</div>
          <div class="card-title">追踪弹</div>
          <div class="card-desc">自动锁定目标<br>单发 13 伤害<br>4秒装填</div>
        </button>
      </div>
    `;
    this.ui.screen.style.display = 'block';

    document.getElementById('btn-shell').onclick = () => this.startGame('shell');
    document.getElementById('btn-flame').onclick = () => this.startGame('flame');
    document.getElementById('btn-missile').onclick = () => this.startGame('missile');
  }

  startGame(weapon) {
    this.ui.screen.style.display = 'none';
    this.state = 'playing';

    // 创建玩家
    const startX = CFG.width * 0.2;
    this.player = new Tank(this.tempTankKind, true, weapon, startX, this.terrain.sampleY(startX));

    this.spawnMedkits();
    this.enemies = [];
    this.projectiles = [];
    this.minionKills = 0;
    this.bossAlive = false;
    this.score = 0;
    this.lives = 3;
    this.totalKills = 0;
    this.startTime = Date.now();
  }
}
