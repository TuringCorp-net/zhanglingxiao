/**
 * Story Elf — 自包含浮动 AI 助手组件
 *
 * 覆盖需求:
 *   SF-053: Story Elf 浮动组件 — 自包含 JS，可拖拽，位置跨页面保持 (localStorage)
 *           <script src="/story-elf.js"> 即可使用，window.StoryElf API 暴露
 *   SF-054: Context-Aware 上下文感知 — StoryElf.setContext({page, work_id, ...})
 *   SF-072: Hint 对话泡 — 槽位聚焦时打字机效果逐字呈现 hint markdown
 *           数据来自模板 JSON SlotDef.hint 字段（前端直接消费 JSON 结构）
 *           ~40ms/字 + 标点智能停顿，markdown 渐进渲染
 *           与左侧聊天窗口（#elf-dialog）是两套独立系统
 *   SF-055: Write 侧写作精灵 — 一致性检查、建议、对话式润色
 *   SF-056: Read 侧伴读精灵 — 浮动形象 + 对话框，⏳ AI 后端待实现
 *
 * 组件架构（四大模块）:
 *   1. 浮动小精灵 UI — 拖拽移动 + 位置 localStorage 持久化
 *   2. 对话泡 (Hint Bubble) — hint 渲染 + requestAnimationFrame 打字机效果
 *   3. 聊天窗口 (#elf-dialog) — 与 AI 对话，独立于对话泡
 *   4. 动作按钮 — 检查/建议等快捷操作，write.js 通过 setActions() 注入
 *
 * Hint 对话泡设计意图：
 *   将槽位提示从 textarea placeholder 中移出，改为 Story Elf 以"对话泡"呈现
 *   - 槽位界面干净：所有 textarea 不设 placeholder hint
 *   - 对话感：用户点击槽位时 Elf 弹出对话泡，逐字显示
 *   - 提示常驻：即便槽位已有内容，提示也不消失（不像 placeholder 输入即隐藏）
 *
 * Hint 交互流程:
 *   用户聚焦槽位 → 对话泡出现 → 逐字打字 (~40ms/字, 标点+200ms/~100ms)
 *   → 用户边看边输入 → blur → 对话泡消失
 *   切换槽位时中断当前动画立即开始新的；手动关闭后可重新聚焦触发
 *
 * Session 由服务端统一管理（API Agent 和前端用户共用）。
 */


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
    + '        <button class="elf-dialog-close" id="elf-dialog-close">×</button>'
    + '      </div>'
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
  // 对话管理 — 每个 (work, page) 只有一个永续对话
  // 页面加载时从服务端加载历史消息；无需 Session ID
  // ============================================================
  var _messages = [];     // 用户+AI 消息（供 sendChat 发送）
  var _workId = '';       // 关联的作品 ID
  var _page = 'write';    // 当前页面类型

  function _getToken() { return localStorage.getItem('sf_user_token') || ''; }
  function _getLang() { return localStorage.getItem('sf_lang') || 'zh'; }

  // 从服务端加载永续对话历史
  async function _loadConversation(workId, page) {
    _workId = workId;
    _page = page || 'write';
    try {
      var resp = await fetch('/api/write/elf/conversation?work_id=' + workId + '&page=' + _page + '&lang=' + _getLang(), {
        headers: { 'Authorization': 'Bearer ' + _getToken() }
      });
      var data = await resp.json();
      if (data && data.ok) {
        _messages = (data.data.messages || []).slice();
        _renderMessages();
        return true;
      }
    } catch (x) { console.error('加载对话失败:', x); }
    return false;
  }

  // 渲染消息到聊天区（只显示 user + 有 content 的 assistant 消息）
  function _renderMessages() {
    StoryElf.clearMessages();
    _messages.forEach(function (m) {
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

  function getMessages() {
    return _messages.filter(function (m) {
      return m.role === 'user' || (m.role === 'assistant' && m.content);
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
      if (s.type === 'text_delta') {
        // 工具调用前的中间文本（如 "好的，让我先看看模板规范"）
        _renderMsgDOM(s.text, 'ai');
      } else if (s.type === 'tool_call') {
        _addSystemMsg('🔧 ' + _toolLabel(s.tool), 'step');
      } else if (s.type === 'tool_result') {
        _addSystemMsg('✅ ' + (s.summary || s.tool || ''), 'step');
      } else if (s.type === 'error') {
        _addSystemMsg('❌ ' + s.message, 'step error');
      }
      // done 最终回复已在 reply 中单独展示，不重复
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
    // 加载永续对话历史（Write/Read 页面在 DOM ready 后调用）
    loadConversation: function (workId, page) { return _loadConversation(workId, page); },

    toggle: function () {
      var d = document.getElementById('elf-dialog');
      if (!d) return;
      var wasHidden = d.style.display === 'none' || !d.style.display;
      d.style.display = wasHidden ? 'flex' : 'none';
      if (wasHidden) {
        // 打开时滚动到最新消息
        setTimeout(function () {
          var msgs = document.getElementById('elf-chat-messages');
          if (msgs) msgs.scrollTop = msgs.scrollHeight;
        }, 0);
      }
    },

    addMessage: function (text, role) {
      _renderMsgDOM(text, role);
      // 追加到内存（供 sendChat 发送）
      if (role === 'user' || role === 'assistant') {
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
      StoryElf.addMessage(t('label.ai_thinking', 'Story Elf thinking...'), 'system');
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
          messages: currentMessages,
          context: { section_title: ctx.section_title },
        }),
      }).then(function (r) { return r.json(); }).then(function (data) {
        var msgs = document.getElementById('elf-chat-messages');
        var last = msgs && msgs.lastChild;
        if (last && last.textContent === '...') last.remove();
        if (data && data.ok) {
          _addSteps(data.data.steps);
          StoryElf.addMessage(data.data.reply, 'assistant');
        } else {
          StoryElf.addMessage(t('elf.ai_unavailable', 'AI is temporarily unavailable, please try again later'), 'assistant');
        }
      }).catch(function () {
        var msgs = document.getElementById('elf-chat-messages');
        var last = msgs && msgs.lastChild;
        if (last && last.textContent === '...') last.remove();
        StoryElf.addMessage(t('elf.network_error', 'Network error, please try again later'), 'assistant');
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

    getMessages: getMessages,
    addSteps: _addSteps,
  };
})();
