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
    this.powerups = [];  // 道具数组

    // 玩家当前激活的道具效果
    this.playerEffects = {
      speed: 0,      // 加速结束时间
      shield: 0,     // 护盾结束时间
      power: 0,      // 火力提升结束时间
      rapid: 0,      // 快速装填结束时间
      spread: 0      // 散射结束时间
    };

    // 关卡系统
    this.level = 1;           // 当前关卡
    this.waveKills = 0;      // 当前波击杀数
    this.waveEnemies = 5;    // 当前波需要击杀的敌人数

    // 连杀系统
    this.comboCount = 0;      // 当前连杀数
    this.lastKillTime = 0;    // 上次击杀时间
    this.comboTimeout = 3000; // 连杀有效时间（3秒内）

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
    if (this.player) {
      if (this.player.alive) {
        const control = this.input.getControl();

        // 开火
        if (control.fire && now >= this.player.nextFireAt) {
          this.fire(this.player, now);
        }

        // 应用加速道具效果
        const speedMult = Date.now() < this.playerEffects.speed ? 1.5 : 1;
        this.player.speedMult = speedMult;

        this.player.update(dt, this.terrain, this.input, now);

        // 处理仰角控制
        if (control.aim !== 0) {
          this.player.barrelAngleOffset += control.aim * dt * 1.5;
          // 限制在 -45° 到 +45° 之间 (约 ±0.785 弧度)
          this.player.barrelAngleOffset = Math.max(-0.785, Math.min(0.785, this.player.barrelAngleOffset));
        }
      }

      // 检测死亡（放在alive块外面，因为projectile可能先扣血再设alive=false）
      if (this.player.hp <= 0 && this.state === 'playing') {
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

    // —— 道具 ——
    this.updatePowerups(dt);

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

    // 道具
    this.powerups.forEach(p => r.drawPowerup(p, this.camera));

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
      r.drawHUD(this.player, this.lives, this.score, this.minionKills, ts, this.playerEffects, this.level);
    }
  }

  /* ========== 开火 ========== */

  fire(tank, now) {
    // 获取道具效果乘数
    const reloadMult = tank.isPlayer ? this.getReloadMultiplier() : 1;
    const spread = tank.isPlayer ? this.hasSpread() : false;
    const powerMult = tank.isPlayer ? this.getDamageMultiplier() : 1;

    if (tank.weapon === 'shell') {
      tank.nextFireAt = now + CFG.shell.reload * reloadMult;

      // 散射：发射3发
      if (spread) {
        this.projectiles.push(new Projectile(tank, tank.x, tank.y - CFG.w * 0.35, 'shell', null, -15));
        this.projectiles.push(new Projectile(tank, tank.x, tank.y - CFG.w * 0.35, 'shell', null, 0));
        this.projectiles.push(new Projectile(tank, tank.x, tank.y - CFG.w * 0.35, 'shell', null, 15));
      } else {
        this.projectiles.push(new Projectile(tank, tank.x, tank.y - CFG.w * 0.35, 'shell'));
      }
      this.audio.playShellFire();

      // 应用火力提升效果
      if (powerMult > 1) {
        for (const p of this.projectiles) {
          if (p.tank === tank && p.type === 'shell' && !p.damageBoosted) {
            p.damageBoosted = true;
          }
        }
      }

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
          // 检查护盾
          if (result.target.isPlayer && this.hasShield()) {
            // 护盾激活，跳过伤害
            this.particles.addPickupText(result.target.x, result.target.y - CFG.w * 0.6, '🛡 挡下了!');
            continue;
          }

          // 计算实际伤害（考虑道具火力提升）
          let actualDmg = p.type === 'shell' ? CFG.shell.damage : CFG.missile.damage;
          if (p.damageBoosted) actualDmg *= 1.5;
          actualDmg += (p.owner.damageBonus || 0);

          this.particles.addDamageText(
            result.target.x, result.target.y - CFG.w * 0.6,
            actualDmg
          );
          if (result.target.isPlayer) this.audio.playHurt();
        }
      }
    }
    this.projectiles = this.projectiles.filter(p => !p.dead);
  }

  /* ========== 敌人 AI ========== */

  updateEnemies(dt, now) {
    // 获取玩家的所有活动炮弹
    const playerProjectiles = this.projectiles.filter(p => p instanceof Projectile && p.owner === this.player && !p.dead);

    for (const e of this.enemies) {
      if (!e.alive) continue;

      // 躲避逻辑
      if (playerProjectiles.length > 0 && e.evadeTimer <= 0) {
        for (const p of playerProjectiles) {
          const d = dist(e.x, e.y, p.x, p.y);
          if (d < CFG.w * 2) { // 2w距离内检测到炮弹
            e.evadeTimer = 1.0; // 触发1秒躲避
            break;
          }
        }
      }

      // AI: 根据敌人类型和关卡有不同的行为
      const distToPlayer = e.x - this.player.x;
      const absDist = Math.abs(distToPlayer);
      const stopDist = CFG.w * 1.2;

      let move = 0;

      // 如果正在躲避，向垂直于炮弹方向移动
      if (e.evadeTimer > 0) {
        e.evadeTimer -= dt;
        // 简单躲避：远离玩家
        move = Math.sign(e.x - this.player.x) * 0.8;
      }

      // 预测玩家下一个位置
      const playerVx = dt > 0 ? (this.player.x - e.lastPlayerX) / dt : 0;
      e.lastPlayerVx = playerVx;
      e.predictX = this.player.x + playerVx * 0.5; // 预测0.5秒后的位置
      e.lastPlayerX = this.player.x;

      // 智能移动逻辑
      const enemyType = e.enemyType || 'normal';
      const isSniper = enemyType === 'sniper';
      const isFast = enemyType === 'fast';
      const isHeavy = enemyType === 'heavy';
      const isBoss = e.kind === 'robot' && e.weapon === 'missile';

      if (isSniper) {
        // 狙击手：保持距离，在远处射击
        const optimalRange = CFG.w * 15; // 从12改为15，保持更远距离
        if (absDist > optimalRange + CFG.w * 2) {
          move = -Math.sign(distToPlayer); // 靠近
        } else if (absDist < optimalRange - CFG.w * 2) {
          move = Math.sign(distToPlayer); // 后退保持距离
        }
      } else if (isHeavy) {
        // 重型坦克：缓慢逼近，靠近后停止
        if (absDist > stopDist * 2) {
          move = -Math.sign(distToPlayer) * 0.5; // 缓慢移动
        }
      } else if (isFast) {
        // 快速小兵：快速逼近
        if (absDist > stopDist) {
          move = -Math.sign(distToPlayer);
        }
      } else if (isBoss) {
        // Boss：智能移动，包抄玩家
        const angle = Math.atan2(
          this.player.y - e.y,
          this.player.x - e.x
        );
        // 简单的预判：向玩家预计位置移动
        if (absDist > stopDist * 1.5) {
          move = -Math.sign(distToPlayer);
        }
      } else {
        // 普通敌人：标准逻辑
        if (absDist > stopDist) {
          move = -Math.sign(distToPlayer);
        }
      }

      e.facing = -Math.sign(distToPlayer);

      // 武器射程判定
      let wantFire = false;
      let weaponRange = e.weapon === 'flame'
        ? CFG.flame.range * CFG.w * 1.2
        : CFG.w * 8;

      // 狙击手有更远的射程
      if (isSniper) weaponRange = CFG.w * 15;

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

        // 战利品掉落（医疗箱 + 道具）
        this.spawnLootOnKill(e.x, e.y, isBoss);

        // 计分
        this.addScore(isBoss ? 30 : 15);
        this.totalKills++;

        // 连杀检测
        this.checkCombo();

        // 玩家升级逻辑：每击杀5个小兵
        if (!isBoss && this.minionKills > 0 && (this.minionKills + 1) % 5 === 0) {
           this.upgradePlayer();
        }

        if (isBoss) {
          this.bossAlive = false;
          this.minionKills = 0;
          // Boss死亡，进入下一关
          this.levelUp();
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
    // 随机选择从左边还是右边出现
    const fromLeft = Math.random() < 0.5;

    let x;
    if (fromLeft) {
      // 从左侧出现：在相机左侧 -0.3倍屏幕宽度
      x = this.camera.x - this.renderer.width * 0.3;
    } else {
      // 从右侧出现：保持原有逻辑
      x = this.camera.x + this.renderer.width * 1.3;
    }

    // 根据关卡和权重选择敌人类型
    const enemyTypes = this.getAvailableEnemyTypes();
    const rand = Math.random();
    let cumsum = 0;
    let selectedType = 'normal';

    // 按权重选择
    for (const type of enemyTypes) {
      cumsum += CFG.enemyTypes[type].weight || 0.5;
      if (rand < cumsum) {
        selectedType = type;
        break;
      }
    }

    // 从enemyTypes配置中获取属性
    const typeCfg = CFG.enemyTypes[selectedType];
    const kind = typeCfg.speed > 0.8 ? 'wheel' : (typeCfg.hp > 35 ? 'robot' : 'track');
    const randWeapon = Math.random();
    let weapon;
    if (randWeapon < 0.5) weapon = 'shell';
    else if (randWeapon < 0.8) weapon = 'flame';
    else weapon = 'missile';

    const t = new Tank(kind, false, weapon, x, this.terrain.sampleY(x));
    // 应用敌人类型配置
    t.enemyType = selectedType;
    t.hp = typeCfg.hp;
    t.maxHp = typeCfg.hp;
    t.speed = typeCfg.speed * CFG.w;
    t.damageBonus = typeCfg.damage - 8; // 基础伤害是8
    t.color = typeCfg.color; // 用于渲染
    t.isFlying = typeCfg.flying || false;

    // 敌人状态新增属性
    t.evadeTimer = 0;       // 躲避冷却
    t.predictX = 0;         // 预测的玩家位置
    t.lastPlayerX = this.player ? this.player.x : 0;  // 上次玩家位置
    t.lastPlayerVx = 0;     // 玩家水平速度

    this.enemies.push(t);
  }

  // 根据当前关卡获取可用的敌人类型
  getAvailableEnemyTypes() {
    const types = ['normal']; // 普通敌人始终可用

    // 4-6关：快速小兵
    if (this.level >= 4) types.push('fast');
    // 7-9关：狙击手
    if (this.level >= 7) types.push('sniper');
    // 10关+：重型坦克
    if (this.level >= 10) types.push('heavy');
    // 12关+：飞行单位
    if (this.level >= 12) types.push('flyer');

    return types;
  }

  spawnBoss() {
    // 同样随机从左或右出现
    const fromLeft = Math.random() < 0.5;
    const x = fromLeft
      ? this.camera.x - this.renderer.width * 0.3
      : this.camera.x + this.renderer.width * 1.3;
    const t = new Tank('robot', false, 'missile', x, this.terrain.sampleY(x));
    // Boss血量随关卡增加
    t.hp = CFG.hpBoss + (this.level - 1) * 10;
    t.maxHp = t.hp;
    t.color = '#ef4444';
    this.enemies.push(t);
    this.bossAlive = true;

    // Boss 登场特效
    this.particles.triggerWarning(2.5);
    this.audio.playWarning();
  }

  // 关卡升级
  levelUp() {
    this.level++;
    this.waveKills = 0;
    // 每关增加敌人数量
    this.waveEnemies = 5 + Math.floor((this.level - 1) * 2);

    // 显示关卡过渡
    this.showLevelTransition();
  }

  // 连杀检测
  checkCombo() {
    const now = Date.now();
    if (now - this.lastKillTime < this.comboTimeout) {
      this.comboCount++;
    } else {
      this.comboCount = 1;
    }
    this.lastKillTime = now;

    // 显示连杀提示
    if (this.comboCount >= 2) {
      this.showComboText(this.comboCount);
    }

    // 屏幕震动增强（连杀时）
    if (this.comboCount >= 3) {
      this.particles.shake(5);
    }
  }

  // 显示连杀文字
  showComboText(count) {
    const comboNames = ['', '', '双杀!', '三杀!', '四杀!', '五杀!', '超神!'];
    const text = comboNames[Math.min(count, 6)];
    if (text && this.player) {
      this.particles.addPickupText(this.player.x, this.player.y - CFG.w, text);
    }
  }

  // 显示关卡过渡动画
  showLevelTransition() {
    const overlay = document.createElement('div');
    overlay.id = 'level-transition';
    overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0,0,0,0.7);
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      z-index: 1000;
      animation: fadeIn 0.5s ease;
    `;
    overlay.innerHTML = `
      <h1 style="color: #fbbf24; font-size: 3em; margin: 0; text-shadow: 0 0 20px #fbbf24;">
        第 ${this.level - 1} 关完成！
      </h1>
      <p style="color: #fff; font-size: 1.5em; margin: 20px 0;">
        准备进入第 <span style="color: #22d3ee;">${this.level}</span> 关
      </p>
      <p style="color: #94a3b8; font-size: 1em;">
        难度提升！敌人更强力
      </p>
    `;
    document.body.appendChild(overlay);

    // 2秒后进入下一关
    setTimeout(() => {
      overlay.style.animation = 'fadeOut 0.5s ease';
      setTimeout(() => {
        overlay.remove();
        // 重新生成医疗箱和道具
        this.spawnMedkits();
      }, 500);
    }, 2000);
  }

  spawnMedkits() {
    // 不再在地面生成医疗箱和道具，改为击杀敌人时掉落
    // 不清空现有道具，保留击杀掉落的战利品
  }

  // 击杀敌人时掉落战利品（医疗箱 + 道具）
  spawnLootOnKill(x, y, isBoss) {
    // 固定掉落：医疗箱或道具
    const dropCount = isBoss ? 3 : 1;

    // 获取已解锁的道具类型
    const powerupTypes = Object.keys(CFG.powerups);
    const unlockedTypes = powerupTypes.filter((type, i) =>
      type !== 'dropConfig' &&
      CFG.powerups[type].rarity &&
      (this.level >= CFG.levelConfig.enemiesToUnlock[i] || i === 0)
    );

    for (let i = 0; i < dropCount; i++) {
      // 50% 几率掉落医疗箱，50% 几率掉落道具
      const isMedkit = Math.random() < 0.5;

      if (isMedkit && unlockedTypes.length > 0) {
        // 掉落医疗箱
        this.medkits.push({
          x: x + (Math.random() - 0.5) * CFG.w * 2,
          y,
          alive: true
        });
      } else if (unlockedTypes.length > 0) {
        // 根据稀有度选择道具
        const rand = Math.random();
        let cumsum = 0;
        let selectedType = unlockedTypes[0];

        for (const type of unlockedTypes) {
          cumsum += CFG.powerups[type].rarity;
          if (rand < cumsum) {
            selectedType = type;
            break;
          }
        }

        // 在敌人死亡位置生成道具
        this.powerups.push({
          x: x + (Math.random() - 0.5) * CFG.w * 2,
          y,
          type: selectedType,
          alive: true
        });
      }
    }
  }

  /* ========== 道具更新 ========== */

  updatePowerups(dt) {
    for (const p of this.powerups) {
      if (!p.alive) continue;
      p.y = this.terrain.sampleY(p.x);

      // 玩家拾取
      if (this.player && this.player.alive) {
        if (dist(p.x, p.y, this.player.x, this.player.y) < CFG.w) {
          this.applyPowerup(p.type);
          p.alive = false;
          this.particles.pickupFlash(p.x, p.y - CFG.w * 0.3);
          this.particles.addPickupText(p.x, p.y - CFG.w * 0.5, this.getPowerupName(p.type));
          this.audio.playPickup();
        }
      }

      // 敌人推动
      for (const e of this.enemies) {
        if (!e.alive) continue;
        const dx = p.x - e.x;
        if (Math.abs(dx) < CFG.w) {
          p.x += Math.sign(dx) * e.speed * dt * 0.5;
        }
      }
    }
    this.powerups = this.powerups.filter(p => p.alive);
  }

  // 应用道具效果
  applyPowerup(type) {
    const now = Date.now();
    const cfg = CFG.powerups[type];
    if (!cfg) return;

    // 激活效果
    if (cfg.speedMult) this.playerEffects.speed = now + cfg.duration;
    if (cfg.invulnerable) this.playerEffects.shield = now + cfg.duration;
    if (cfg.damageMult) this.playerEffects.power = now + cfg.duration;
    if (cfg.reloadMult) this.playerEffects.rapid = now + cfg.duration;
    if (cfg.spread) this.playerEffects.spread = now + cfg.duration;
  }

  // 获取道具名称
  getPowerupName(type) {
    const names = {
      speed: '⚡ 加速',
      shield: '🛡️ 护盾',
      power: '🔥 火力',
      rapid: '⚡ 速射',
      spread: '🔱 散射'
    };
    return names[type] || type;
  }

  // 检查玩家是否有护盾
  hasShield() {
    return Date.now() < this.playerEffects.shield;
  }

  // 获取伤害乘数
  getDamageMultiplier() {
    return Date.now() < this.playerEffects.power ? 1.5 : 1;
  }

  // 获取装填乘数
  getReloadMultiplier() {
    return Date.now() < this.playerEffects.rapid ? 0.5 : 1;
  }

  // 是否散射
  hasSpread() {
    return Date.now() < this.playerEffects.spread;
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
    this.powerups = [];  // 清空道具
    this.score = 0;
    this.lives = 3;
    this.minionKills = 0;
    this.bossAlive = false;
    this.totalKills = 0;
    this.level = 1;  // 重置关卡
    this.waveKills = 0;
    this.waveEnemies = 5;
    // 清空连杀状态
    this.comboCount = 0;
    this.lastKillTime = 0;
    // 清空道具效果
    this.playerEffects = {
      speed: 0,
      shield: 0,
      power: 0,
      rapid: 0,
      spread: 0
    };
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
    this.player.barrelAngleOffset = 0; // 初始化仰角偏移

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
