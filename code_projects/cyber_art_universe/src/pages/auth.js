/**
 * auth.js — 用户鉴权共享工具
 * Phase 0：Token 存储、登录状态管理、API 封装
 * 所有 HTML 页面通过 <script src="/auth.js"></script> 引入
 */
(function () {
  'use strict';

  const TOKEN_KEY = 'cau_token';
  const USER_KEY = 'cau_user';

  // ============================================================
  // Token 管理
  // ============================================================
  function getToken() {
    return localStorage.getItem(TOKEN_KEY);
  }

  function setToken(token) {
    localStorage.setItem(TOKEN_KEY, token);
  }

  function clearToken() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  }

  function getUser() {
    try {
      const raw = localStorage.getItem(USER_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  }

  function setUser(user) {
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  }

  function isLoggedIn() {
    return !!getToken();
  }

  // ============================================================
  // API 请求封装
  // ============================================================
  async function api(path, options = {}) {
    const headers = { 'Content-Type': 'application/json', ...options.headers };
    const token = getToken();
    if (token) {
      headers['Authorization'] = 'Bearer ' + token;
    }

    const resp = await fetch(path, { ...options, headers });
    const data = await resp.json();

    if (!resp.ok) {
      const err = new Error(data.error?.message || 'Request failed');
      err.code = data.error?.code;
      err.status = resp.status;
      throw err;
    }

    return data;
  }

  // ============================================================
  // Auth 操作（v2：统一 connect）
  // ============================================================
  async function connect(email, key, confirm) {
    const body = { email: email, key: key };
    if (confirm) body.confirm = true;
    const data = await api('/api/auth/connect', {
      method: 'POST',
      body: JSON.stringify(body),
    });
    if (data.ok && (data.data.action === 'login' || data.data.action === 'registered')) {
      setToken(data.data.token);
      setUser(data.data.user);
    }
    return data;
  }

  async function logout() {
    try { await api('/api/auth/logout', { method: 'POST' }); } catch (_) {}
    clearToken();
  }

  async function getMe() {
    const data = await api('/api/auth/me');
    if (data.ok) setUser(data.data);
    return data;
  }

  async function updateMe(fields) {
    const data = await api('/api/auth/me', {
      method: 'PUT',
      body: JSON.stringify(fields),
    });
    if (data.ok) setUser(data.data);
    return data;
  }

  async function verifyEmail(code) {
    return api('/api/auth/verify-email', {
      method: 'POST',
      body: JSON.stringify({ code: code }),
    });
  }

  async function resendVerification() {
    return api('/api/auth/resend-verification', { method: 'POST' });
  }

  // ============================================================
  // 互动 API（Phase 1）
  // ============================================================
  async function likeWork(workId) {
    return api('/api/interactions/like', {
      method: 'POST',
      body: JSON.stringify({ target_type: 'work', target_id: workId }),
    });
  }

  async function likeReview(reviewId) {
    return api('/api/interactions/like', {
      method: 'POST',
      body: JSON.stringify({ target_type: 'review', target_id: reviewId }),
    });
  }

  async function submitComment(workId, content, sectionId, scoreOverall, parentId) {
    return api('/api/interactions/comment', {
      method: 'POST',
      body: JSON.stringify({
        work_id: workId,
        comment: content,
        section_id: sectionId || undefined,
        score_overall: scoreOverall || undefined,
        parent_id: parentId || undefined,
      }),
    });
  }

  async function applaudUser(targetUserId) {
    return api('/api/interactions/applaud', {
      method: 'POST',
      body: JSON.stringify({ target_user_id: targetUserId }),
    });
  }

  // ============================================================
  // 登录按钮更新（不改导航结构，只替换登录按钮内容）
  // ============================================================
  async function updateLoginButton() {
    const btn = document.getElementById('nav-login-btn');
    if (!btn) return;

    const user = getUser();
    if (user && user.id) {
      // 有本地 token → 向服务器验证是否仍然有效
      try {
        const resp = await getMe();
        if (resp.ok) {
          setUser(resp.data);
          btn.textContent = resp.data.cyber_name;
          btn.title = '个人设置';
          btn.onclick = function() { openSettingsModal(); };
          return;
        }
      } catch (_) {}
      clearToken();
    }
    // 未登录 或 token 已失效
    btn.textContent = (typeof t === 'function') ? t('nav.login') : '登录';
    btn.title = '';
    btn.onclick = function() { openConnectModal(); };
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  // ============================================================
  // 暴露全局 API
  // ============================================================
  window.CAU = {
    // Token
    getToken, setToken, clearToken,
    getUser, setUser, isLoggedIn,
    // Auth
    api, connect, logout, getMe, updateMe,
    verifyEmail, resendVerification,
    // Interactions
    likeWork, likeReview, submitComment, applaudUser,
    // UI
    updateLoginButton,
  };
  // openConnectModal / openSettingsModal 由下方 Modal IIFE 挂在 window 上
})();

// ============================================================
// 浮动层 Modal 系统
// HTML 模板在 /modals/connect-fragment.html 和 settings-fragment.html
// ============================================================
(function() {
  // 加载外部 CSS（避免内联）
  var cssLink = document.createElement('link');
  cssLink.rel = 'stylesheet';
  cssLink.href = '/modals/modal.css';
  document.head.appendChild(cssLink);

  // 模板缓存
  var _connectTpl = null;
  var _settingsTpl = null;

  function openModal(html) {
    var overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = html;
    overlay.addEventListener('click', function(e) {
      if (e.target === overlay) overlay.remove();
    });
    document.body.appendChild(overlay);
    return overlay;
  }

  async function loadTemplate(name) {
    if (name === 'connect' && _connectTpl) return _connectTpl;
    if (name === 'settings' && _settingsTpl) return _settingsTpl;
    var resp = await fetch('/modals/' + name + '-fragment.html');
    var html = await resp.text();
    if (name === 'connect') _connectTpl = html;
    else _settingsTpl = html;
    return html;
  }

  // ---- Connect Modal ----
  window.openConnectModal = async function() {
    var html = await loadTemplate('connect');
    var overlay = openModal(html);
    var email, key;

    document.getElementById('mc-key').addEventListener('keydown', function(e) { if (e.key==='Enter') doGo(); });
    document.getElementById('mc-btn-go').onclick = doGo;
    document.getElementById('mc-btn-confirm').onclick = doConfirm;
    document.getElementById('mc-btn-back').onclick = resetForm;

    function showErr(msg) {
      var el = document.getElementById('mc-msg'); el.textContent=msg; el.className='msg msg-err'; el.style.display='block';
    }

    async function doGo() {
      email = document.getElementById('mc-email').value.trim();
      key = document.getElementById('mc-key').value;
      var btn = document.getElementById('mc-btn-go');
      document.getElementById('mc-msg').style.display='none';
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { showErr('Please enter a valid email address.'); return; }
      if (key.length<8) { showErr('Key must be at least 8 characters.'); return; }
      btn.disabled=true; btn.textContent='Checking...';
      try {
        var resp = await fetch('/api/auth/connect', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({email:email,key:key}) });
        var data = await resp.json();
        if (!resp.ok && resp.status!==401) { showErr(data.error?.message||'Something went wrong.'); btn.disabled=false; btn.textContent='Continue'; return; }
        if (data.ok) {
          var action = data.data.action;
          if (action==='login') { CAU.setToken(data.data.token); CAU.setUser(data.data.user); CAU.updateLoginButton(); overlay.remove(); }
          else if (action==='new_account') { document.getElementById('mc-step-input').style.display='none'; document.getElementById('mc-step-confirm').style.display='block'; document.getElementById('mc-confirm-msg').textContent='No account found for '+email+'. Your Cyber Name will be « '+data.data.suggested_cyber_name+' ». You can change it later.'; btn.disabled=false; btn.textContent='Continue'; }
          else if (action==='registered') { CAU.setToken(data.data.token); CAU.setUser(data.data.user); CAU.updateLoginButton(); overlay.remove(); location.href='/verify-email.html'; }
          else if (action==='wrong_key') { showErr(data.data.message||'Incorrect key.'); btn.disabled=false; btn.textContent='Continue'; }
        } else if (resp.status===429) { showErr(data.error?.message||'Too many attempts.'); btn.disabled=false; btn.textContent='Continue'; }
      } catch(e) { showErr('Network error.'); btn.disabled=false; btn.textContent='Continue'; }
    }

    async function doConfirm() {
      var btn = document.getElementById('mc-btn-confirm');
      btn.disabled=true; btn.textContent='Creating...';
      try {
        var resp = await fetch('/api/auth/connect', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({email:email,key:key,confirm:true}) });
        var data = await resp.json();
        if (data.ok) { CAU.setToken(data.data.token); CAU.setUser(data.data.user); CAU.updateLoginButton(); overlay.remove(); location.href='/verify-email.html'; }
        else { showErr(data.error?.message||'Failed.'); btn.disabled=false; btn.textContent='Yes, create my account'; }
      } catch(e) { showErr('Network error.'); btn.disabled=false; btn.textContent='Yes, create my account'; }
    }

    function resetForm() { document.getElementById('mc-step-input').style.display='block'; document.getElementById('mc-step-confirm').style.display='none'; document.getElementById('mc-msg').style.display='none'; }
  };

  // ---- Settings Modal ----
  window.openSettingsModal = async function() {
    var html = await loadTemplate('settings');
    var overlay = openModal(html);

    try {
      var resp = await CAU.getMe();
      var u = resp.data;

      document.getElementById('ms-loading').style.display = 'none';
      document.getElementById('ms-content').style.display = 'block';

      document.getElementById('ms-cyber-name').textContent = u.cyber_name;
      document.getElementById('ms-class').textContent = u.class==='apprentice'?'Apprentice':u.class;
      document.getElementById('ms-karma').textContent = '✦ ' + u.karma;
      document.getElementById('ms-energy').textContent = '⚡ ' + u.energy + '/' + u.energy_cap;
      document.getElementById('ms-email-display').value = u.email;

      if (!u.email_verified) document.getElementById('ms-verify-warn').style.display = 'block';

      // 修改 Cyber Name
      document.getElementById('ms-btn-name').onclick = async function() {
        var newName = document.getElementById('ms-new-name').value.trim();
        var errEl = document.getElementById('ms-err-name'); errEl.style.display='none';
        if (!newName) return;
        if (newName.length<3) { errEl.textContent='At least 3 characters'; errEl.style.display='block'; return; }
        try {
          await CAU.updateMe({ cyber_name: newName });
          document.getElementById('ms-ok-name').textContent='Changed! Next login use: '+newName;
          document.getElementById('ms-ok-name').style.display='block';
          document.getElementById('ms-cyber-name').textContent = newName;
          CAU.updateLoginButton();
        } catch(e) { errEl.textContent=e.message||'Failed'; errEl.style.display='block'; }
      };

      // 修改邮箱
      document.getElementById('ms-btn-email').onclick = async function() {
        var newEmail = document.getElementById('ms-new-email').value.trim();
        var errEl = document.getElementById('ms-err-email'); errEl.style.display='none';
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail)) { errEl.textContent='Invalid email format'; errEl.style.display='block'; return; }
        try {
          await CAU.updateMe({ email: newEmail });
          document.getElementById('ms-ok-email').textContent='Email changed. Verification code sent.';
          document.getElementById('ms-ok-email').style.display='block';
          setTimeout(function(){ location.href='/verify-email.html'; }, 1500);
        } catch(e) { errEl.textContent=e.message||'Failed'; errEl.style.display='block'; }
      };

      // 登出
      document.getElementById('ms-btn-logout').onclick = function() {
        CAU.logout().then(function(){ location.reload(); });
      };

    } catch(e) {
      document.getElementById('ms-loading').textContent = 'Failed to load profile.';
    }
  };
})();
