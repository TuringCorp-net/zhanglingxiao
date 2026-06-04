// Story Elf — 自包含浮动 AI 助手组件
// 使用方式：<script src="/story-elf.js"></script> + <link rel="stylesheet" href="/story-elf.css">
// 自动在页面右下角创建可拖拽的 Story Elf 浮动组件，位置跨页面保持。
// Write 页面可通过 window.StoryElf 覆盖行为（check / suggest / sendChat）。
// Session 由服务端统一管理（API Agent 和前端用户共用）。

(function () {
  'use strict';

  // ============================================================
  // HTML
  // ============================================================
  var ELF_HTML = ''
    + '<div id="story-elf">'
    + '  <div class="elf-dialog" id="elf-dialog" style="display:none">'
    + '    <div class="elf-dialog-header">'
    + '      <span>Story Elf</span>'
    + '      <div style="display:flex;align-items:center;gap:2px">'
    + '        <button class="elf-dialog-history-btn" id="elf-dialog-history" title="' + t('elf.history', '对话历史') + '">📜</button>'
    + '        <button class="elf-dialog-close" id="elf-dialog-close">×</button>'
    + '      </div>'
    + '    </div>'
    + '    <div class="elf-session-list" id="elf-session-list" style="display:none"></div>'
    + '    <div class="elf-chat-messages" id="elf-chat-messages"></div>'
    + '    <div class="elf-chat-input-row">'
    + '      <input id="elf-chat-input" placeholder="Ask Story Elf..." onkeydown="if(event.key===\'Enter\')StoryElf.sendChat()">'
    + '      <button class="btn btn-primary btn-sm" id="elf-send-btn" style="padding:0.3rem 0.6rem;font-size:0.7rem">' + t('elf.send', 'Send') + '</button>'
    + '    </div>'
    + '  </div>'
    + '  <div class="elf-hint-bubble" id="elf-hint-bubble" style="display:none">'
    + '    <button class="elf-hint-close" id="elf-hint-close">&times;</button>'
    + '    <div class="elf-hint-content" id="elf-hint-content"></div>'
    + '  </div>'
    + '  <div class="elf-body" id="elf-body">'
    + '    <div class="elf-avatar" title="Story Elf">'
    + '      <img src="/assets/story-elf.png" alt="Story Elf" class="elf-img">'
    + '    </div>'
    + '    <div class="elf-actions" id="elf-actions">'
    + '    </div>'
    + '  </div>'
    + '</div>';

  document.addEventListener('DOMContentLoaded', function () {
    var wrapper = document.createElement('div');
    wrapper.innerHTML = ELF_HTML;
    while (wrapper.firstChild) document.body.appendChild(wrapper.firstChild);
    restorePosition();
    bindEvents();
  });

  // ============================================================
  // 位置持久化
  // ============================================================
  var POS_KEY = 'sf_elf_pos';

  function restorePosition() {
    var elf = document.getElementById('story-elf');
    if (!elf) return;
    var saved;
    try { saved = JSON.parse(localStorage.getItem(POS_KEY)); } catch (x) {}
    elf.style.left = (saved && saved.l) || (window.innerWidth - 250) + 'px';
    elf.style.top  = (saved && saved.t) || (window.innerHeight - 300) + 'px';
  }

  function savePosition() {
    var elf = document.getElementById('story-elf');
    if (!elf) return;
    try { localStorage.setItem(POS_KEY, JSON.stringify({ l: elf.style.left, t: elf.style.top })); } catch (x) {}
  }

  // ============================================================
  // 会话管理 — 服务端统一管理（API Agent 和前端用户共用）
  // 前端仅缓存 active_session_id（用于恢复当前对话），消息历史从服务端 API 拉取
  // ============================================================
  var ACTIVE_KEY = 'sf_active_session';
  var _activeSessionId = localStorage.getItem(ACTIVE_KEY) || '';
  var _messages = [];     // 用户+AI 消息（供 sendChat 发送）
  var _workId = '';       // 关联的作品 ID

  function _getToken() { return localStorage.getItem('sf_user_token') || ''; }
  function _getLang() { return localStorage.getItem('sf_lang') || 'zh'; }

  // 从服务端加载 session 消息
  async function _loadSessionFromServer(sessionId) {
    try {
      var resp = await fetch('/api/write/elf/sessions/' + sessionId + '?lang=' + _getLang(), {
        headers: { 'Authorization': 'Bearer ' + _getToken() }
      });
      var data = await resp.json();
      if (data && data.ok) {
        _activeSessionId = sessionId;
        localStorage.setItem(ACTIVE_KEY, sessionId);
        // 存储完整 messages 数组（供 sendChat 发送）
        _messages = (data.data.messages || []).slice();
        // 更新 work_id
        if (data.data.work_id) _workId = data.data.work_id;
        _renderMessages();
        return true;
      }
    } catch (x) { console.error('加载 session 失败:', x); }
    return false;
  }

  // 在服务端创建新 session
  async function _createSessionOnServer(workId, page) {
    try {
      var resp = await fetch('/api/write/elf/sessions?lang=' + _getLang(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + _getToken() },
        body: JSON.stringify({ work_id: workId, page: page || 'write' })
      });
      var data = await resp.json();
      if (data && data.ok) {
        _activeSessionId = data.data.id;
        localStorage.setItem(ACTIVE_KEY, _activeSessionId);
        _workId = workId;
        _messages = [];
        StoryElf.clearMessages();
        return true;
      }
    } catch (x) { console.error('创建 session 失败:', x); }
    return false;
  }

  // 初始化：确保有活跃 session（由页面调用）
  async function _initSession(workId, page) {
    _workId = workId;
    if (_activeSessionId) {
      var ok = await _loadSessionFromServer(_activeSessionId);
      if (ok) return; // 恢复成功
      // session 已被归档或不存在 → 清除并新建
      _activeSessionId = '';
      localStorage.removeItem(ACTIVE_KEY);
    }
    await _createSessionOnServer(workId, page);
  }

  // 渲染消息到聊天区（只显示 user + 有 content 的 assistant 消息）
  function _renderMessages() {
    StoryElf.clearMessages();
    _messages.forEach(function (m) {
      // 只渲染 user 和 assistant 的最终回复（跳过 system、tool、tool_call）
      if (m.role === 'user') {
        _renderMsgDOM(m.content, 'user');
      } else if (m.role === 'assistant' && m.content) {
        _renderMsgDOM(m.content, 'ai');
      }
    });
    var msgs = document.getElementById('elf-chat-messages');
    if (msgs && _messages.length) msgs.scrollTop = msgs.scrollHeight;
  }

  function _renderMsgDOM(text, role) {
    var msgs = document.getElementById('elf-chat-messages');
    if (!msgs) return;
    var div = document.createElement('div');
    div.className = 'elf-chat-msg ' + (role === 'user' ? 'user' : role === 'step' ? 'step' : 'ai');
    _renderMessageContent(div, text, role);
    msgs.appendChild(div);
  }

  // — 对外接口 —
  function getSessionId() { return _activeSessionId; }

  function getMessages() {
    // 返回用户+AI 消息（不含 system/tool），供 sendChat 发送给 API
    return _messages.filter(function (m) {
      return m.role === 'user' || (m.role === 'assistant' && m.content);
    });
  }

  // 新建对话（归档当前 + 创建新 session）
  async function _newSession() {
    if (_activeSessionId && _messages.length > 0) {
      try {
        await fetch('/api/write/elf/sessions/' + _activeSessionId + '/archive?lang=' + _getLang(), {
          method: 'POST',
          headers: { 'Authorization': 'Bearer ' + _getToken() }
        });
      } catch (x) {}
    }
    await _createSessionOnServer(_workId, 'write');
  }

  // 归档当前 session
  async function _archiveCurrentSession() {
    if (!_activeSessionId) return;
    try {
      await fetch('/api/write/elf/sessions/' + _activeSessionId + '/archive?lang=' + _getLang(), {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + _getToken() }
      });
    } catch (x) {}
    _activeSessionId = '';
    localStorage.removeItem(ACTIVE_KEY);
    _messages = [];
  }

  // ============================================================
  // 对话列表 UI（数据来自服务端）
  // ============================================================
  function _showSessionList() {
    var list = document.getElementById('elf-session-list');
    var msgs = document.getElementById('elf-chat-messages');
    var inputRow = document.querySelector('.elf-chat-input-row');
    if (list) list.style.display = 'block';
    if (msgs) msgs.style.display = 'none';
    if (inputRow) inputRow.style.display = 'none';
    _renderSessionList();
  }

  function _hideSessionList() {
    var list = document.getElementById('elf-session-list');
    var msgs = document.getElementById('elf-chat-messages');
    var inputRow = document.querySelector('.elf-chat-input-row');
    if (list) list.style.display = 'none';
    if (msgs) msgs.style.display = '';
    if (inputRow) inputRow.style.display = '';
  }

  function _toggleSessionList() {
    var list = document.getElementById('elf-session-list');
    if (list && list.style.display === 'block') {
      _hideSessionList();
    } else {
      _showSessionList();
    }
  }

  async function _renderSessionList() {
    var list = document.getElementById('elf-session-list');
    if (!list) return;
    var html = '<button class="elf-new-session-btn" id="elf-new-session-btn">＋ ' + t('elf.new_chat', '新对话') + '</button>';

    try {
      var resp = await fetch('/api/write/elf/sessions?work_id=' + (_workId || '') + '&status=active&lang=' + _getLang(), {
        headers: { 'Authorization': 'Bearer ' + _getToken() }
      });
      var data = await resp.json();
      var sessions = (data && data.ok && data.data) ? data.data : [];

      if (sessions.length === 0) {
        html += '<div style="text-align:center;color:var(--text-muted);font-size:0.7rem;padding:1rem">' + t('elf.no_sessions', '暂无对话') + '</div>';
      } else {
        sessions.forEach(function (s) {
          var dateStr = '';
          try { dateStr = new Date(s.updated_at).toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' }); } catch (x) {}
          var isActive = s.id === _activeSessionId;
          html += '<div class="elf-session-item' + (isActive ? ' active' : '') + '" data-sid="' + s.id + '">'
            + '<div class="elf-session-info">'
            + '<div class="elf-session-title">' + _escapeHTML(s.title || t('elf.untitled', '未命名对话')) + '</div>'
            + '<div class="elf-session-meta">' + dateStr + ' · ' + (s.message_count || 0) + ' ' + t('elf.msgs', '条消息') + '</div>'
            + '</div>'
            + '<button class="elf-session-del" data-del="' + s.id + '" title="' + t('elf.archive', '归档') + '">📦</button>'
            + '</div>';
        });
      }
    } catch (x) {
      html += '<div style="text-align:center;color:var(--text-muted);font-size:0.7rem;padding:1rem">加载失败</div>';
    }

    list.innerHTML = html;

    var newBtn = document.getElementById('elf-new-session-btn');
    if (newBtn) newBtn.addEventListener('click', function () { _newSession().then(function () { _hideSessionList(); }); });

    list.querySelectorAll('.elf-session-item').forEach(function (item) {
      item.addEventListener('click', function (e) {
        if (e.target.closest('.elf-session-del')) return;
        var sid = item.getAttribute('data-sid');
        if (sid) { _loadSessionFromServer(sid).then(function () { _hideSessionList(); }); }
      });
    });

    list.querySelectorAll('.elf-session-del').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        var sid = btn.getAttribute('data-del');
        if (!sid) return;
        fetch('/api/write/elf/sessions/' + sid + '/archive?lang=' + _getLang(), {
          method: 'POST', headers: { 'Authorization': 'Bearer ' + _getToken() }
        }).then(function () {
          if (sid === _activeSessionId) {
            _activeSessionId = '';
            localStorage.removeItem(ACTIVE_KEY);
            _messages = [];
            StoryElf.clearMessages();
          }
          _renderSessionList();
        }).catch(function () {});
      });
    });
  }

  function _escapeHTML(str) {
    var div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  // ============================================================
  // 消息渲染
  // ============================================================

  // 消息内容渲染：AI/step 消息尝试 Markdown，user 消息纯文本
  function _renderMessageContent(div, text, role) {
    if (role === 'user') {
      div.textContent = text;
    } else {
      if (typeof marked !== 'undefined') {
        div.innerHTML = marked.parse(text);
      } else {
        div.textContent = text;
      }
    }
  }

  // ============================================================
  // Agent 步骤展示
  // ============================================================
  var _TOOL_LABELS = {
    'read_module': '读取模块',
    'get_writing_guide': '查阅写作指南',
    'generate_slot': '生成内容',
    'write_to_slot': '写入槽位',
    'checklist_write': '更新任务清单',
    'get_version_history': '查看版本历史',
    'get_version_diff': '对比版本差异',
  };

  function _toolLabel(toolName) {
    return _TOOL_LABELS[toolName] || toolName;
  }

  function _addSystemMsg(text, cssClass) {
    var msgs = document.getElementById('elf-chat-messages');
    if (!msgs) return;
    var div = document.createElement('div');
    div.className = 'elf-chat-msg ' + (cssClass || 'step');
    div.textContent = text;
    msgs.appendChild(div);
    msgs.scrollTop = msgs.scrollHeight;
  }

  function _addSteps(steps) {
    if (!steps || !steps.length) return;
    steps.forEach(function (s) {
      if (s.type === 'tool_call') {
        _addSystemMsg('🔧 ' + _toolLabel(s.tool), 'step');
      } else if (s.type === 'tool_result') {
        _addSystemMsg('✅ ' + (s.summary || s.tool || ''), 'step');
      } else if (s.type === 'error') {
        _addSystemMsg('❌ ' + s.message, 'step error');
      }
      // text_delta / done 不展示
    });
  }

  // ============================================================
  // 拖动
  // ============================================================
  var drag = { moved: false, sx: 0, sy: 0, ox: 0, oy: 0 };

  function bindEvents() {
    var body = document.getElementById('elf-body');
    if (body) body.addEventListener('mousedown', onDragStart);

    var closeBtn = document.getElementById('elf-dialog-close');
    if (closeBtn) closeBtn.addEventListener('click', function () {
      document.getElementById('elf-dialog').style.display = 'none';
    });

    var hintCloseBtn = document.getElementById('elf-hint-close');
    if (hintCloseBtn) hintCloseBtn.addEventListener('click', function () {
      _hideHintBubble();
    });

    var sendBtn = document.getElementById('elf-send-btn');
    if (sendBtn) sendBtn.addEventListener('click', function () { StoryElf.sendChat(); });

    var historyBtn = document.getElementById('elf-dialog-history');
    if (historyBtn) historyBtn.addEventListener('click', function () { _toggleSessionList(); });
  }

  function onDragStart(e) {
    if (e.target.closest('.elf-action-btn') || e.target.closest('.elf-dialog') || e.target.closest('input')) return;
    e.preventDefault();
    var elf = document.getElementById('story-elf');
    var r = elf.getBoundingClientRect();
    drag = { moved: false, sx: e.clientX, sy: e.clientY, ox: e.clientX - r.left, oy: e.clientY - r.top };
    elf.style.left = r.left + 'px';
    elf.style.top = r.top + 'px';
    document.addEventListener('mousemove', onDragMove);
    document.addEventListener('mouseup', onDragUp);
  }

  function onDragMove(e) {
    if (Math.abs(e.clientX - drag.sx) > 3 || Math.abs(e.clientY - drag.sy) > 3) drag.moved = true;
    if (!drag.moved) return;
    var elf = document.getElementById('story-elf');
    elf.style.left = Math.max(0, Math.min(window.innerWidth - 170, e.clientX - drag.ox)) + 'px';
    elf.style.top  = Math.max(0, Math.min(window.innerHeight - 220, e.clientY - drag.oy)) + 'px';
  }

  function onDragUp() {
    document.removeEventListener('mousemove', onDragMove);
    document.removeEventListener('mouseup', onDragUp);
    if (drag.moved) { savePosition(); }
    else { StoryElf.toggle(); }
    drag.moved = false;
  }

  // ============================================================
  // Hint 对话泡 —— 打字机效果引擎（独立于左侧聊天窗口）
  // ============================================================
  var _hintState = {
    timer: null,
    cancelled: false,
    activeSlotId: null,
    visible: false,
    _hideTimer: null,
  };

  function _stopHintTypewriter() {
    _hintState.cancelled = true;
    if (_hintState.timer) {
      clearTimeout(_hintState.timer);
      _hintState.timer = null;
    }
  }

  function _startHintTypewriter(el, rawMd) {
    _stopHintTypewriter();
    _hintState.cancelled = false;
    el.innerHTML = '';
    var i = 0;
    var speed = 40;

    function tick() {
      if (_hintState.cancelled) return;
      if (i < rawMd.length) {
        i++;
        var partial = rawMd.substring(0, i);
        try {
          el.innerHTML = marked.parse(partial);
        } catch(e) {
          el.textContent = partial;
        }
        var ch = rawMd[i - 1];
        var delay = speed;
        if ('。！？.!?'.indexOf(ch) >= 0) delay += 200;
        else if ('，、；：,.;:'.indexOf(ch) >= 0) delay += 100;
        _hintState.timer = setTimeout(tick, delay);
      } else {
        _hintState.timer = null;
      }
    }
    tick();
  }

  function _showHintBubble(rawMd, opts) {
    opts = opts || {};
    if (!rawMd || !rawMd.trim()) return;
    if (_hintState._hideTimer) {
      clearTimeout(_hintState._hideTimer);
      _hintState._hideTimer = null;
    }
    _stopHintTypewriter();
    var bubble = document.getElementById('elf-hint-bubble');
    var content = document.getElementById('elf-hint-content');
    if (!bubble || !content) return;
    bubble.classList.remove('hint-fade-out');
    bubble.style.display = 'block';
    _hintState.visible = true;
    _hintState.activeSlotId = (opts && opts.slotId) || '';
    _startHintTypewriter(content, rawMd.trim());
  }

  function _hideHintBubble() {
    _stopHintTypewriter();
    var bubble = document.getElementById('elf-hint-bubble');
    if (!bubble || bubble.style.display === 'none') return;
    bubble.classList.add('hint-fade-out');
    _hintState._hideTimer = setTimeout(function () {
      if (!bubble) return;
      bubble.style.display = 'none';
      bubble.classList.remove('hint-fade-out');
      _hintState.visible = false;
      _hintState.activeSlotId = null;
      _hintState._hideTimer = null;
    }, 150);
  }

  // ============================================================
  // 公共 API
  // ============================================================
  window.StoryElf = {
    // Session 初始化（Write/Read 页面在 DOM ready 后调用）
    initSession: function (workId, page) { return _initSession(workId, page); },

    toggle: function () {
      var d = document.getElementById('elf-dialog');
      if (d) d.style.display = d.style.display === 'none' ? 'flex' : 'none';
    },

    addMessage: function (text, role) {
      _renderMsgDOM(text, role);
      // 追加到内存（供 sendChat 发送）
      if (role === 'user' || role === 'ai') {
        _messages.push({ role: role, content: text });
      }
    },

    clearMessages: function () {
      var msgs = document.getElementById('elf-chat-messages');
      if (msgs) msgs.innerHTML = '';
    },

    getInput: function () {
      var inp = document.getElementById('elf-chat-input');
      return inp ? inp.value.trim() : '';
    },

    clearInput: function () {
      var inp = document.getElementById('elf-chat-input');
      if (inp) inp.value = '';
    },

    // 默认 sendChat — 用于 Read 侧伴读精灵。Write 页面会覆盖此函数。
    sendChat: function () {
      var msg = StoryElf.getInput();
      if (!msg) return;
      StoryElf.addMessage(msg, 'user');
      StoryElf.clearInput();
      var currentMessages = getMessages();
      StoryElf.addMessage('...', 'system');
      var ctx = StoryElf.getContext() || {};
      var token = _getToken();
      var lang = _getLang();
      fetch('/api/write/elf/chat?lang=' + lang, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
        body: JSON.stringify({
          work_id: ctx.work_id,
          section_id: ctx.section_id || undefined,
          page: ctx.page || 'read',
          session_id: getSessionId(),
          messages: currentMessages,
          context: { section_title: ctx.section_title },
        }),
      }).then(function (r) { return r.json(); }).then(function (data) {
        var msgs = document.getElementById('elf-chat-messages');
        var last = msgs && msgs.lastChild;
        if (last && last.textContent === '...') last.remove();
        if (data && data.ok) {
          _addSteps(data.data.steps);
          StoryElf.addMessage(data.data.reply, 'ai');
        } else {
          StoryElf.addMessage(t('elf.ai_unavailable', 'AI is temporarily unavailable, please try again later'), 'ai');
        }
      }).catch(function () {
        var msgs = document.getElementById('elf-chat-messages');
        var last = msgs && msgs.lastChild;
        if (last && last.textContent === '...') last.remove();
        StoryElf.addMessage(t('elf.network_error', 'Network error, please try again later'), 'ai');
      });
    },

    setActions: function (buttons) {
      var el = document.getElementById('elf-actions');
      if (!el) return;
      el.innerHTML = '';
      buttons.forEach(function (b) {
        var btn = document.createElement('button');
        btn.className = 'elf-action-btn';
        btn.textContent = b.label;
        btn.title = b.title || '';
        btn.addEventListener('click', b.onClick);
        el.appendChild(btn);
      });
    },

    setPage: function (type) {
      var input = document.getElementById('elf-chat-input');
      if (input) input.placeholder = type === 'write'
        ? t('elf.write_placeholder', 'Ask AI to polish this...')
        : '和 Story Elf 聊聊这部作品...';
    },

    _ctx: null,
    setContext: function (ctx) { StoryElf._ctx = ctx; },
    getContext: function () { return StoryElf._ctx; },

    // Hint 对话泡 API
    showHintBubble: function (rawMd, opts) { _showHintBubble(rawMd, opts); },
    hideHintBubble: function () { _hideHintBubble(); },
    setActiveSlot: function (slotId) { _hintState.activeSlotId = slotId; },

    // 会话管理（服务端统一管理）
    getSessionId: getSessionId,
    getMessages: getMessages,
    newSession: function () { return _newSession(); },
    archiveCurrent: _archiveCurrentSession,
    // Agent 步骤展示
    addSteps: _addSteps,
  };
})();
