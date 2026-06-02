// Story Elf — 自包含浮动 AI 助手组件
// 使用方式：<script src="/story-elf.js"></script>
// 自动在页面右下角创建可拖拽的 Story Elf 浮动组件，位置跨页面保持。
// Write 页面可通过 window.StoryElf 覆盖行为（check / suggest / sendChat）。

(function () {
  'use strict';

  // ============================================================
  // CSS
  // ============================================================
  var CSS = '\
#story-elf{position:fixed;z-index:200;display:flex;flex-direction:column;align-items:center;user-select:none;}\
.elf-body{display:flex;flex-direction:column;align-items:center;gap:6px;cursor:grab;}\
.elf-body:active{cursor:grabbing;}\
.elf-avatar{width:150px;height:150px;border-radius:14px;background:transparent;display:flex;align-items:center;justify-content:center;overflow:hidden;transition:transform 0.2s;}\
.elf-avatar:hover{transform:scale(1.06);}\
.elf-img{width:100%;height:100%;object-fit:cover;display:block;}\
.elf-actions{display:flex;gap:4px;}\
.elf-action-btn{width:36px;height:22px;border-radius:11px;border:1px solid var(--border);background:var(--bg-card);color:var(--text-dim);font-size:0.65rem;cursor:pointer;transition:all 0.15s;padding:0;display:flex;align-items:center;justify-content:center;}\
.elf-action-btn:hover{border-color:var(--cyan);color:var(--cyan);background:rgba(6,182,212,0.08);}\
.elf-dialog{position:absolute;right:165px;bottom:0;width:300px;max-height:400px;background:var(--bg-card);border:1px solid var(--border);border-radius:10px;display:flex;flex-direction:column;box-shadow:0 4px 24px rgba(0,0,0,0.5);animation:elf-in 0.2s ease;}\
@keyframes elf-in{from{opacity:0;transform:translateX(8px);}to{opacity:1;transform:translateX(0);}}\
.elf-dialog-header{display:flex;justify-content:space-between;align-items:center;padding:0.5rem 0.75rem;border-bottom:1px solid var(--border);font-size:0.8rem;font-weight:600;color:var(--cyan);}\
.elf-dialog-close{width:22px;height:22px;border-radius:50%;border:none;background:transparent;color:var(--text-muted);font-size:1rem;cursor:pointer;line-height:1;}\
.elf-dialog-close:hover{color:var(--text);background:var(--bg-hover);}\
.elf-chat-messages{flex:1;overflow-y:auto;padding:0.5rem;display:flex;flex-direction:column;gap:0.4rem;min-height:120px;max-height:240px;}\
.elf-chat-input-row{display:flex;gap:0.3rem;padding:0.4rem 0.5rem;border-top:1px solid var(--border);}\
.elf-chat-input-row input{flex:1;padding:0.35rem 0.5rem;border-radius:6px;border:1px solid var(--border);background:var(--bg);color:var(--text);font-size:0.75rem;outline:none;}\
.elf-chat-input-row input:focus{border-color:var(--accent-light);}\
.elf-chat-msg{padding:0.5rem 0.65rem;border-radius:10px;font-size:0.78rem;line-height:1.5;max-width:90%;}\
.elf-chat-msg.user{align-self:flex-end;background:rgba(124,58,237,0.2);color:var(--text);}\
.elf-chat-msg.ai{align-self:flex-start;background:var(--bg-hover);color:var(--text-dim);}\
/* Hint 对话泡 —— 独立于左侧聊天窗口的右侧/上方提示气泡 */\
.elf-hint-bubble{position:absolute;bottom:160px;left:50%;transform:translateX(-50%);width:300px;max-height:250px;overflow-y:auto;background:var(--bg-card);border:1px solid var(--border);border-radius:10px;padding:0.65rem 0.75rem;box-shadow:0 4px 24px rgba(0,0,0,0.5);z-index:201;display:flex;flex-direction:column;animation:elf-hint-in 0.2s ease;}\
.elf-hint-bubble.hint-fade-out{animation:elf-hint-out 0.15s ease forwards;}\
@keyframes elf-hint-in{from{opacity:0;transform:translateX(-50%) translateY(4px);}to{opacity:1;transform:translateX(-50%) translateY(0);}}\
@keyframes elf-hint-out{from{opacity:1;transform:translateX(-50%) translateY(0);}to{opacity:0;transform:translateX(-50%) translateY(4px);}}\
.elf-hint-content{font-size:0.78rem;line-height:1.6;color:var(--cyan);}\
.elf-hint-content p{margin:0 0 0.3rem;}\
.elf-hint-content p:last-child{margin-bottom:0;}\
.elf-hint-content strong{color:var(--text);}\
.elf-hint-content code{background:var(--bg-hover);padding:0.1rem 0.3rem;border-radius:3px;font-size:0.72rem;}\
.elf-hint-content a{color:var(--cyan);}\
.elf-hint-content em{color:var(--text-muted);}\
.elf-hint-close{position:absolute;top:4px;right:8px;width:20px;height:20px;border-radius:50%;border:none;background:transparent;color:var(--text-muted);font-size:0.9rem;cursor:pointer;line-height:1;padding:0;}\
.elf-hint-close:hover{color:var(--text);background:var(--bg-hover);}\
';

  var style = document.createElement('style');
  style.textContent = CSS;
  document.head.appendChild(style);

  // ============================================================
  // HTML
  // ============================================================
  var ELF_HTML = ''
    + '<div id="story-elf">'
    + '  <div class="elf-dialog" id="elf-dialog" style="display:none">'
    + '    <div class="elf-dialog-header">'
    + '      <span>Story Elf</span>'
    + '      <button class="elf-dialog-close" id="elf-dialog-close">×</button>'
    + '    </div>'
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

    // 初始化位置：优先 localStorage，否则右下角距边 100px
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
  // 会话管理 — 用于记忆系统的 session 连续性
  // ============================================================
  var SESSION_KEY = 'sf_session_id';
  var MSGS_KEY = 'sf_session_msgs';
  var _messages = [];

  // 恢复之前保存的会话状态
  try {
    var savedMsgs = JSON.parse(localStorage.getItem(MSGS_KEY) || '[]');
    if (Array.isArray(savedMsgs)) _messages = savedMsgs;
  } catch (x) {}

  function getSessionId() {
    var id = localStorage.getItem(SESSION_KEY);
    if (!id) {
      id = 'sess_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
      localStorage.setItem(SESSION_KEY, id);
    }
    return id;
  }

  function getMessages() { return _messages.slice(); }

  function saveMessages() {
    try {
      // 只保留最近 50 条消息（防止 localStorage 溢出）
      if (_messages.length > 50) _messages = _messages.slice(-50);
      localStorage.setItem(MSGS_KEY, JSON.stringify(_messages));
    } catch (x) {}
  }

  function clearSession() {
    localStorage.removeItem(SESSION_KEY);
    localStorage.removeItem(MSGS_KEY);
    _messages = [];
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
    _hideTimer: null, // 延迟隐藏定时器，处理快速切换槽位竞态
  };

  function _stopHintTypewriter() {
    _hintState.cancelled = true;
    if (_hintState.timer) {
      clearTimeout(_hintState.timer);
      _hintState.timer = null;
    }
  }

  // 打字机引擎：逐字累积原始 markdown → 渐进渲染
  // 不能先渲染 HTML 再逐字输出——用户会看到 <stro 等标签碎片
  // 20-80 字的 hint 每字 parse 一次耗时微秒级，无性能问题
  function _startHintTypewriter(el, rawMd) {
    _stopHintTypewriter();
    _hintState.cancelled = false;
    el.innerHTML = '';
    var i = 0;
    var speed = 40; // ms/字

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
        // 标点停顿——模拟自然停顿
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

    // 无 hint 文本则不弹出
    if (!rawMd || !rawMd.trim()) return;

    // 取消待执行的隐藏定时器（处理快速切换槽位的竞态）
    if (_hintState._hideTimer) {
      clearTimeout(_hintState._hideTimer);
      _hintState._hideTimer = null;
    }

    _stopHintTypewriter();

    var bubble = document.getElementById('elf-hint-bubble');
    var content = document.getElementById('elf-hint-content');
    if (!bubble || !content) return;

    // 移除淡出动画残留
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
    toggle: function () {
      var d = document.getElementById('elf-dialog');
      if (d) d.style.display = d.style.display === 'none' ? 'flex' : 'none';
    },

    addMessage: function (text, role) {
      var msgs = document.getElementById('elf-chat-messages');
      if (!msgs) return;
      var div = document.createElement('div');
      div.className = 'elf-chat-msg ' + (role === 'user' ? 'user' : 'ai');
      div.textContent = text;
      msgs.appendChild(div);
      msgs.scrollTop = msgs.scrollHeight;
      // 记忆系统：将消息追加到会话历史
      if (role === 'user' || role === 'ai') {
        _messages.push({ role: role, content: text });
        saveMessages();
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
      StoryElf.addMessage('...', 'ai');
      var ctx = StoryElf.getContext() || {};
      var token = localStorage.getItem('sf_user_token') || '';
      var lang = localStorage.getItem('sf_lang') || 'zh';
      fetch('/api/write/elf/chat?lang=' + lang, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
        body: JSON.stringify({
          work_id: ctx.work_id,
          section_id: ctx.section_id || undefined,
          page: ctx.page || 'read',
          session_id: getSessionId(),
          messages: getMessages(),
          context: { section_title: ctx.section_title },
        }),
      }).then(function (r) { return r.json(); }).then(function (data) {
        var msgs = document.getElementById('elf-chat-messages');
        var last = msgs && msgs.lastChild;
        if (last && last.textContent === '...') last.remove();
        if (data && data.ok) {
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

    // 设置操作按钮 — Write 页面调用
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

    // 页面类型（Read / Write）
    setPage: function (type) {
      var input = document.getElementById('elf-chat-input');
      if (input) input.placeholder = type === 'write'
        ? t('elf.write_placeholder', 'Ask AI to polish this...')
        : '和 Story Elf 聊聊这部作品...';
    },

    // 上下文感知：页面自动传入当前阅读/写作位置，Elf 天然知道用户在哪里
    _ctx: null,
    setContext: function (ctx) { StoryElf._ctx = ctx; },
    getContext: function () { return StoryElf._ctx; },

    // Hint 对话泡 API（独立于左侧聊天窗口）
    // 显示 hint 对话泡，以打字机效果逐字呈现 markdown 提示
    // 每次聚焦都会重新展示（允许回顾之前看过的 hint）
    showHintBubble: function (rawMd, opts) { _showHintBubble(rawMd, opts); },

    // 隐藏 hint 对话泡（带淡出动画）
    hideHintBubble: function () { _hideHintBubble(); },

    // 设置当前活跃槽位
    setActiveSlot: function (slotId) { _hintState.activeSlotId = slotId; },

    // 会话管理（用于记忆系统）
    getSessionId: getSessionId,
    getMessages: getMessages,
    clearSession: clearSession,
  };
})();
