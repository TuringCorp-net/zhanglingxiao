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
  // Auth 操作
  // ============================================================
  async function register(cyberName, key, email) {
    const data = await api('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ cyber_name: cyberName, key: key, email: email }),
    });
    if (data.ok) {
      setToken(data.data.token);
      setUser(data.data.user);
    }
    return data;
  }

  async function login(cyberName, key) {
    const data = await api('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ cyber_name: cyberName, key: key }),
    });
    if (data.ok) {
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
  // 全局导航更新
  // ============================================================
  function updateNav() {
    const navEl = document.getElementById('global-nav');
    if (!navEl) return;

    const user = getUser();
    if (user && user.id) {
      navEl.innerHTML = `
        <div class="nav-left">
          <a href="/" class="nav-brand">Cyber Art Universe</a>
        </div>
        <div class="nav-right">
          <span class="nav-cyber-name">${escapeHtml(user.cyber_name)}</span>
          <span class="nav-energy" title="能量">⚡ ${user.energy ?? '?'}</span>
          <span class="nav-karma" title="声望">✦ ${user.karma ?? 0}</span>
          <a href="/settings.html">设置</a>
          <a href="#" onclick="CAU.logout().then(()=>location.reload());return false">登出</a>
        </div>`;
    } else {
      navEl.innerHTML = `
        <div class="nav-left">
          <a href="/" class="nav-brand">Cyber Art Universe</a>
        </div>
        <div class="nav-right">
          <a href="/login.html">登录</a>
          <a href="/register.html">注册</a>
        </div>`;
    }
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
    api, register, login, logout, getMe, updateMe,
    verifyEmail, resendVerification,
    // Interactions
    likeWork, likeReview, submitComment, applaudUser,
    // UI
    updateNav,
  };
})();
