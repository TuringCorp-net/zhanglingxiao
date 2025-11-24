(function() {
  const canvas = document.getElementById('game-canvas');
  const ctx = canvas.getContext('2d');
  const chargeFill = document.getElementById('charge-fill');
  const jumpCountEl = document.getElementById('jump-count');
  const overlay = document.getElementById('overlay');
  const finalStats = document.getElementById('final-stats');
  const leaderboardEl = document.getElementById('leaderboard');
  const submitBtn = document.getElementById('submit-score');
  const restartBtn = document.getElementById('restart');
  const playerNameInput = document.getElementById('player-name');

  // Config
  const VIEW_W = 900;
  const VIEW_H = 600;
  const TRI_SIZE = 24; // triangle side length
  const PLATFORM_SIZE = 64; // square side
  const MAX_JUMP_DIST = VIEW_W / 2; // pixels (half screen)
  const MIN_HOLD = 0.1; // s
  const MAX_HOLD = 2.0; // s
  const MIN_HORIZONTAL = PLATFORM_SIZE / 2; // at least half square to avoid too close
  const V_OFFSET_RANGE = 80; // vertical offset +- range
  const GRAVITY_VISUAL = 0.0022; // visual gravity multiplier for arc height

  const state = {
    cameraX: 0,
    jumpCount: 0,
    charging: false,
    chargeStartAt: 0,
    chargeAmount: 0, // 0..1
    player: { x: 120, y: VIEW_H/2, angle: 0 },
    platforms: [],
    targetPlatform: null,
    isJumping: false,
    jumpStart: null,
    jumpFrom: null,
    jumpTo: null,
    percentBeat: 0,
    ended: false,
  };

  function clamp(n, min, max) { return Math.max(min, Math.min(max, n)); }
  function lerp(a, b, t) { return a + (b - a) * t; }

  function init() {
    canvas.width = VIEW_W; canvas.height = VIEW_H;
    state.platforms = [];
    // initial platform
    const startPlat = { x: 80, y: VIEW_H/2, size: PLATFORM_SIZE };
    state.platforms.push(startPlat);
    state.targetPlatform = genNextPlatform(startPlat);
    state.player.x = startPlat.x; state.player.y = startPlat.y - PLATFORM_SIZE/2 - (Math.sqrt(3)/2 * TRI_SIZE)/2;
    state.cameraX = 0;
    state.jumpCount = 0;
    state.ended = false;
    overlay.classList.add('hidden');
    leaderboardEl.innerHTML = '';
    loop();
  }

  function genNextPlatform(prev) {
    // 水平生成：平台间距不超过最大跳跃距离，上下不产生高低落差；最小间距为平台宽度以避免重叠
    const minGap = PLATFORM_SIZE; // 保证两平台不相交
    const maxGap = Math.max(minGap + 1, MAX_JUMP_DIST - PLATFORM_SIZE/2);
    const dx = lerp(minGap, maxGap, Math.random());
    const next = {
      x: prev.x + dx,
      y: prev.y,
      size: PLATFORM_SIZE,
    };
    state.platforms.push(next);
    return next;
  }

  function getJumpDistanceFromHold(sec) {
    const hold = clamp(sec, MIN_HOLD, MAX_HOLD);
    const t = (hold - MIN_HOLD) / (MAX_HOLD - MIN_HOLD);
    return lerp(MIN_HORIZONTAL, MAX_JUMP_DIST, t);
  }

  function startCharge() {
    if (state.ended || state.isJumping || state.charging) return; // 防重入：充能中不重置起点
    state.charging = true;
    state.chargeStartAt = performance.now();
  }
  function endCharge() {
    if (!state.charging) return;
    state.charging = false;
    const holdSec = (performance.now() - state.chargeStartAt) / 1000;
    const dist = getJumpDistanceFromHold(holdSec);
    performJump(dist);
  }

  function performJump(dist) {
    if (state.isJumping) return;
    const from = { x: state.player.x, y: state.player.y };
    const toPlat = state.targetPlatform;
    const to = { x: toPlat.x, y: toPlat.y - PLATFORM_SIZE/2 - (Math.sqrt(3)/2 * TRI_SIZE)/2 };
    // adjust target X by dist: land approximately centered horizontally
    const dx = dist; // forward
    to.x = from.x + dx;

    state.isJumping = true;
    state.jumpStart = performance.now();
    state.jumpFrom = from;
    state.jumpTo = to;
  }

  function update(dt) {
    // charge bar
    if (state.charging) {
      const holdSec = (performance.now() - state.chargeStartAt) / 1000;
      const t = clamp((holdSec - MIN_HOLD) / (MAX_HOLD - MIN_HOLD), 0, 1);
      state.chargeAmount = t;
      chargeFill.style.width = (t * 100).toFixed(1) + '%';
    } else {
      state.chargeAmount = 0; chargeFill.style.width = '0%';
    }

    // jumping animation
    if (state.isJumping) {
      const T = 600; // total ms for jump anim
      const elapsed = performance.now() - state.jumpStart;
      const t = clamp(elapsed / T, 0, 1);
      const x = lerp(state.jumpFrom.x, state.jumpTo.x, t);
      const baseY = lerp(state.jumpFrom.y, state.jumpTo.y, t);
      const arc = Math.sin(Math.PI * t) * distToArcHeight(distance(state.jumpFrom, state.jumpTo));
      state.player.x = x;
      state.player.y = baseY - arc;
      // 摄影机不再强制居中玩家，改为在函数末尾进行水平平滑跟随
      // state.cameraX = state.player.x - VIEW_W / 2;
      if (t >= 1) {
        state.isJumping = false;
        onLand();
      }
    }
    // 摄影机仅水平跟随（不垂直），并做平滑处理以避免画面跳变
    const targetCamX = Math.max(0, state.player.x - VIEW_W * 0.45);
    state.cameraX = lerp(state.cameraX, targetCamX, 0.12);
  }

  function distance(a, b) { const dx = b.x - a.x, dy = b.y - a.y; return Math.hypot(dx, dy); }
  function distToArcHeight(d) { return Math.max(20, Math.min(140, d * 0.35)); }

  function onLand() {
    // success if triangle bottom-center point inside platform square (方案B)
    const plat = state.targetPlatform;
    const foot = { x: state.player.x, y: state.player.y + (Math.sqrt(3)/2 * TRI_SIZE)/2 };
    const left = plat.x - PLATFORM_SIZE/2;
    const right = plat.x + PLATFORM_SIZE/2;
    const top = plat.y - PLATFORM_SIZE/2;
    const bottom = plat.y + PLATFORM_SIZE/2;
    const inside = foot.x >= left && foot.x <= right && foot.y >= top && foot.y <= bottom;

    if (inside) {
      state.jumpCount++;
      jumpCountEl.textContent = `跳跃次数：${state.jumpCount}`;
      const next = genNextPlatform(plat);
      state.targetPlatform = next;
    } else {
      endGame();
    }
  }

  function endGame() {
    state.ended = true;
    overlay.classList.remove('hidden');
    // Percent beat fetch from KV API
    fetch('/api/percentile?score=' + state.jumpCount)
      .then(r => r.json()).then(data => {
        state.percentBeat = data.percent || 0;
        finalStats.textContent = `你完成了 ${state.jumpCount} 次跳跃，超过了 ${Math.round(state.percentBeat)}% 的玩家`;
      }).catch(() => {
        finalStats.textContent = `你完成了 ${state.jumpCount} 次跳跃，超过了 0% 的玩家`;
      });
    refreshLeaderboard();
  }

  function refreshLeaderboard() {
    fetch('/api/leaderboard')
      .then(r => r.json())
      .then(list => {
        leaderboardEl.innerHTML = '';
        list.slice(0, 50).forEach((item, idx) => {
          const li = document.createElement('li');
          li.textContent = `${idx+1}. ${item.name} - ${item.score}`;
          leaderboardEl.appendChild(li);
        });
      }).catch(() => {
        leaderboardEl.innerHTML = '<li>无法读取排行榜</li>';
      });
  }

  submitBtn.addEventListener('click', () => {
    const name = (playerNameInput.value || '').trim();
    if (!name) return;
    const payload = { name, score: state.jumpCount };
    fetch('/api/submit', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      .then(r => r.json())
      .then(() => refreshLeaderboard())
      .catch(() => {});
  });

  restartBtn.addEventListener('click', () => init());

  // Input: space on desktop, long press on mobile
  function setupInput() {
    // Desktop
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Space') { e.preventDefault(); if (e.repeat) return; startCharge(); }
    });
    window.addEventListener('keyup', (e) => {
      if (e.code === 'Space') { e.preventDefault(); endCharge(); }
    });
    // Mobile
    let touchActive = false; let touchStartAt = 0;
    canvas.addEventListener('touchstart', (e) => { e.preventDefault(); touchActive = true; startCharge(); touchStartAt = performance.now(); }, { passive: false });
    canvas.addEventListener('touchend', (e) => { e.preventDefault(); if (touchActive) { touchActive = false; endCharge(); } }, { passive: false });
  }

  function draw() {
    ctx.save();
    ctx.translate(-state.cameraX, 0);
    // background grid
    ctx.fillStyle = '#0b1220';
    ctx.fillRect(state.cameraX, 0, VIEW_W, VIEW_H);
    // platforms
    for (const p of state.platforms) {
      ctx.fillStyle = '#94a3b8';
      ctx.fillRect(p.x - PLATFORM_SIZE/2, p.y - PLATFORM_SIZE/2, PLATFORM_SIZE, PLATFORM_SIZE);
    }
    // target highlight
    if (state.targetPlatform) {
      ctx.strokeStyle = '#f59e0b';
      ctx.lineWidth = 2;
      const p = state.targetPlatform;
      ctx.strokeRect(p.x - PLATFORM_SIZE/2 - 3, p.y - PLATFORM_SIZE/2 - 3, PLATFORM_SIZE + 6, PLATFORM_SIZE + 6);
    }
    // player triangle
    drawTriangle(state.player.x, state.player.y, TRI_SIZE, '#22c55e');
    ctx.restore();
  }

  function drawTriangle(cx, cy, size, color) {
    const h = Math.sqrt(3)/2 * size;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(cx, cy - h/2);
    ctx.lineTo(cx - size/2, cy + h/2);
    ctx.lineTo(cx + size/2, cy + h/2);
    ctx.closePath();
    ctx.fill();
  }

  let last = performance.now();
  function loop() {
    const now = performance.now();
    const dt = now - last; last = now;
    update(dt);
    ctx.clearRect(0, 0, VIEW_W, VIEW_H);
    draw();
    requestAnimationFrame(loop);
  }

  setupInput();
  init();
})();