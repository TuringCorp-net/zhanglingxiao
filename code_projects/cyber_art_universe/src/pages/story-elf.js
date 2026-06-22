/**
 * Story Elf — AI 写作伴侣组件
 *
 * v2.7 重构:
 *   - 支持双模式: 浮动模式(非 write 页面) + 嵌入模式(write 页面左栏)
 *   - 移除: 拖拽移动、Hint 对话泡、操作按钮
 *   - 新增: mount() 嵌入模式 API、消息 DOM 上限 50 条
 *   - 输入框: textarea 动态高度 (3-6行)，模仿 Claude Code 体验
 *
 * 覆盖需求:
 *   SF-053: Story Elf 组件 — window.StoryElf API
 *   SF-054: Context-Aware — StoryElf.setContext({page, work_id, ...})
 *   SF-055: Write 侧写作精灵 — write.js 覆盖 sendChat
 *   SF-056: Read 侧伴读精灵 — 默认 sendChat
 *
 * Session 由服务端统一管理（API Agent 和前端用户共用）。
 */

(function () {
  'use strict';

  // ============================================================
  // 常量
  // ============================================================
  var MAX_DOM_MSGS = 50;       // DOM 渲染消息上限
  var MAX_INPUT_HEIGHT = 120;  // textarea 最大高度 px (~6行)
  var MIN_INPUT_HEIGHT = 60;   // textarea 最小高度 px (~3行)

  // ============================================================
  // HTML — 精简版，无 hint 对话泡，无操作按钮
  // ============================================================
  var ELF_HTML = ''
    + '<div id="story-elf">'
    + '  <div class="elf-avatar" title="Story Elf">'
    + '    <img src="/assets/story-elf.png" alt="Story Elf" class="elf-img">'
    + '  </div>'
    + '  <div class="elf-chat-messages" id="elf-chat-messages"></div>'
    + '  <div class="elf-chat-input-row">'
    + '    <textarea id="elf-chat-input" class="elf-chat-input" placeholder="' + (typeof t === 'function' ? t('elf.ask_placeholder', 'Ask Story Elf...') : 'Ask Story Elf...') + '" rows="1"></textarea>'
    + '    <button class="elf-send-btn" id="elf-send-btn">' + (typeof t === 'function' ? t('elf.send', 'Send') : 'Send') + '</button>'
    + '  </div>'
    + '</div>';

  document.addEventListener('DOMContentLoaded', function () {
    var wrapper = document.createElement('div');
    wrapper.innerHTML = ELF_HTML;
    while (wrapper.firstChild) document.body.appendChild(wrapper.firstChild);
    restorePosition();
    bindEvents();
    initTextarea();
  });

  // ============================================================
  // 位置持久化（仅浮动模式使用）
  // ============================================================
  var POS_KEY = 'sf_elf_pos';

  function restorePosition() {
    var elf = document.getElementById('story-elf');
    if (!elf || elf.classList.contains('elf-embedded')) return;
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
  // 对话管理 — 每个 (work, page) 一个永续对话
  // ============================================================
  var _messages = [];     // 用户+AI 消息（供 sendChat 发送）
  var _workId = '';       // 关联的作品 ID
  var _page = 'write';    // 当前页面类型

  // 页面级配置：Read 页和 Write 页通过 init() 注入差异
  var _config = {
    getWorkId: function () { return (StoryElf.getContext() || {}).work_id; },
    beforeSend: null,
    contextModule: null,
    onToolResult: null,
  };

  function _getToken() { return localStorage.getItem('cau_token') || ''; }
  function _getLang() { return localStorage.getItem('sf_lang') || 'zh'; }

  // 从服务端加载永续对话历史（仅恢复干净消息，工作块不持久化）
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

  // 渲染消息到聊天区（只显示 user + 有 content 的 assistant 消息，上限 MAX_DOM_MSGS）
  function _renderMessages() {
    StoryElf.clearMessages();
    // DOM 渲染上限: 取最后 N 条
    var renderList = _messages.length > MAX_DOM_MSGS
      ? _messages.slice(-MAX_DOM_MSGS)
      : _messages;
    renderList.forEach(function (m) {
      if (m.role === 'user') {
        _renderMsgDOM(m.content, 'user');
      } else if (m.role === 'assistant' && m.content) {
        _renderMsgDOM(m.content, 'ai');
      }
    });
    var msgs = document.getElementById('elf-chat-messages');
    if (msgs) msgs.scrollTop = msgs.scrollHeight;
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

  // ============================================================
  // 消息渲染
  // ============================================================
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
  // Agent 步骤展示 — 工作块（保持不变）
  // ============================================================
  var _TOOL_LABELS = {
    'read_module': '读取模块',
    'get_writing_guide': '查阅写作指南',
    'generate_slot': '生成内容',
    'write_to_slot': '写入槽位',
    'checklist_write': '更新任务清单',
    'create_card': '新建卡片',
    'get_version_history': '查看版本历史',
    'get_version_diff': '对比版本差异',
  };

  function _toolLabel(toolName) {
    return _TOOL_LABELS[toolName] || toolName;
  }

  var _workingBlockStylesInjected = false;
  function _injectWorkingBlockStyles() {
    if (_workingBlockStylesInjected) return;
    _workingBlockStylesInjected = true;
    var style = document.createElement('style');
    style.textContent = ''
      + '.elf-working-block { flex-shrink:0; align-self:flex-start; max-width:90%; width:100%; margin:6px 0; border:1px solid var(--border,#333); border-radius:6px; overflow:hidden; font-size:0.75rem; }'
      + '.elf-working-header { display:flex; justify-content:space-between; align-items:center; padding:5px 10px; background:var(--bg-hover,rgba(124,58,237,0.1)); cursor:pointer; color:var(--text-muted,#888); user-select:none; }'
      + '.elf-working-collapsed .elf-working-toggle { transform:rotate(-90deg); }'
      + '.elf-working-collapsed .elf-working-body { display:none; }'
      + '.elf-working-body { padding:6px 10px; max-height:300px; overflow-y:auto; }'
      + '.elf-checklist { background:var(--bg,rgba(0,0,0,0.15)); border:1px solid var(--border,#333); border-radius:4px; padding:6px 8px; margin-bottom:6px; }'
      + '.elf-checklist-title { font-weight:600; margin-bottom:3px; font-size:0.7rem; }'
      + '.elf-checklist-items { line-height:1.5; white-space:pre-wrap; font-size:0.7rem; color:var(--text-muted,#888); }'
      + '.elf-process-msg { margin:3px 0; padding:3px 6px; border-radius:4px; font-size:0.7rem; line-height:1.4; }'
      + '.elf-process-step { margin:2px 0; padding:2px 6px; font-size:0.68rem; color:var(--text-muted,#888); }'
      + '.elf-process-step.error { color:var(--error,#f44); }'
      + '.elf-working-toggle { background:none; border:none; color:var(--text-muted); cursor:pointer; font-size:0.8rem; padding:0 2px; transition:transform 0.15s; }';
    document.head.appendChild(style);
  }

  function _addSteps(steps) {
    if (!steps || !steps.length) return;

    var hasProcess = steps.some(function (s) {
      return s.type === 'text_delta' || s.type === 'tool_call' || s.type === 'tool_result' || s.type === 'error';
    });
    if (!hasProcess) return;

    _injectWorkingBlockStyles();

    var msgs = document.getElementById('elf-chat-messages');
    if (!msgs) return;

    var block = document.createElement('div');
    block.className = 'elf-working-block';

    var header = document.createElement('div');
    header.className = 'elf-working-header';
    header.innerHTML = '<span>' + (typeof t === 'function' ? t('elf.working', '⚙ Story Elf working...') : '⚙ Story Elf working...') + '</span><span class="elf-working-toggle">▾</span>';
    header.addEventListener('click', function () {
      block.classList.toggle('elf-working-collapsed');
    });
    block.appendChild(header);

    var body = document.createElement('div');
    body.className = 'elf-working-body';

    // Checklist cards (checklist_write results) — pinned at top
    var lastChecklist = null;
    steps.forEach(function (s) {
      if (s.type === 'tool_result' && s.tool === 'checklist_write' && s.summary) {
        lastChecklist = s.summary;
      }
    });
    if (lastChecklist) {
      var card = document.createElement('div');
      card.className = 'elf-checklist';
      var lines = lastChecklist.split('\n');
      if (lines.length > 0) {
        var title = document.createElement('div');
        title.className = 'elf-checklist-title';
        title.textContent = '📋 ' + lines[0];
        card.appendChild(title);
      }
      if (lines.length > 1) {
        var items = document.createElement('div');
        items.className = 'elf-checklist-items';
        items.textContent = lines.slice(1).join('\n');
        card.appendChild(items);
      }
      body.appendChild(card);
    }

    // Process steps（批量模式）
    steps.forEach(function (s) {
      if (s.type === 'text_delta') {
        var line = document.createElement('div');
        line.className = 'elf-process-msg';
        _renderMessageContent(line, s.text, 'ai');
        body.appendChild(line);
      } else if (s.type === 'tool_call') {
        var line = document.createElement('div');
        line.className = 'elf-process-step';
        line.textContent = '🔧 ' + _toolLabel(s.tool);
        body.appendChild(line);
      } else if (s.type === 'tool_result' && s.tool !== 'checklist_write') {
        var line = document.createElement('div');
        line.className = 'elf-process-step';
        var summary = s.summary || '';
        line.textContent = '✅ ' + (summary.length > 120 ? summary.substring(0, 120) + '...' : summary);
        body.appendChild(line);
        // 通知 onToolResult 回调（Write 页用于 _onWriteToSlot）
        if (_config.onToolResult) _config.onToolResult(s);
      } else if (s.type === 'error') {
        var line = document.createElement('div');
        line.className = 'elf-process-step error';
        line.textContent = '❌ ' + s.message;
        body.appendChild(line);
      }
    });

    block.appendChild(body);
    msgs.appendChild(block);
    msgs.scrollTop = msgs.scrollHeight;
  }

  // ============================================================
  // SSE 流式步骤渲染 — 增量追加到工作块
  // ============================================================
  var _workingBlock = null;     // 当前工作块 DOM 引用
  var _workingBlockBody = null; // 工作块 body 引用
  var _workingChecklist = null; // checklist 卡片引用

  function _initWorkingBlock() {
    if (_workingBlock) return; // 已初始化
    _injectWorkingBlockStyles();

    var msgs = document.getElementById('elf-chat-messages');
    if (!msgs) return;

    _workingBlock = document.createElement('div');
    _workingBlock.className = 'elf-working-block';
    var block = _workingBlock; // 闭包捕获，避免 _finishWorkingBlock 后引用变 null

    var header = document.createElement('div');
    header.className = 'elf-working-header';
    header.innerHTML = '<span>' + (typeof t === 'function' ? t('elf.working', '⚙ Story Elf 工作中...') : '⚙ Story Elf 工作中...') + '</span><span class="elf-working-toggle">▾</span>';
    header.addEventListener('click', function () {
      block.classList.toggle('elf-working-collapsed');
    });
    _workingBlock.appendChild(header);

    _workingBlockBody = document.createElement('div');
    _workingBlockBody.className = 'elf-working-body';
    _workingBlock.appendChild(_workingBlockBody);

    msgs.appendChild(_workingBlock);
    msgs.scrollTop = msgs.scrollHeight;
  }

  function _appendStep(step) {
    if (!_workingBlock) _initWorkingBlock();
    if (!_workingBlockBody) return;

    var msgs = document.getElementById('elf-chat-messages');

    if (step.type === 'text_delta') {
      var line = document.createElement('div');
      line.className = 'elf-process-msg';
      _renderMessageContent(line, step.text, 'ai');
      _workingBlockBody.appendChild(line);
    } else if (step.type === 'tool_call') {
      var line = document.createElement('div');
      line.className = 'elf-process-step';
      line.textContent = '🔧 ' + _toolLabel(step.tool);
      _workingBlockBody.appendChild(line);

    } else if (step.type === 'tool_result') {
      if (step.tool === 'checklist_write') {
        // 更新 checklist 卡片（替换旧卡片）
        if (_workingChecklist) _workingChecklist.remove();
        var summary = step.summary || '';
        if (summary) {
          var card = document.createElement('div');
          card.className = 'elf-checklist';
          var lines = summary.split('\n');
          if (lines.length > 0) {
            var title = document.createElement('div');
            title.className = 'elf-checklist-title';
            title.textContent = '📋 ' + lines[0];
            card.appendChild(title);
          }
          if (lines.length > 1) {
            var items = document.createElement('div');
            items.className = 'elf-checklist-items';
            items.textContent = lines.slice(1).join('\n');
            card.appendChild(items);
          }
          // 插入到 body 最前面（卡片置顶）
          _workingBlockBody.insertBefore(card, _workingBlockBody.firstChild);
          _workingChecklist = card;
        }
      } else {
        var line2 = document.createElement('div');
        line2.className = 'elf-process-step';
        var summary2 = step.summary || '';
        line2.textContent = '✅ ' + (summary2.length > 120 ? summary2.substring(0, 120) + '...' : summary2);
        _workingBlockBody.appendChild(line2);

      }
    } else if (step.type === 'error') {
      var line = document.createElement('div');
      line.className = 'elf-process-step error';
      line.textContent = '❌ ' + (step.message || 'Unknown error');
      _workingBlockBody.appendChild(line);
    }

    if (msgs) msgs.scrollTop = msgs.scrollHeight;
  }

  function _finishWorkingBlock() {
    _workingBlock = null;
    _workingBlockBody = null;
    _workingChecklist = null;
  }

  // ============================================================
  // Textarea 动态高度（模仿 Claude Code）
  // ============================================================
  function initTextarea() {
    var inputEl = document.getElementById('elf-chat-input');
    if (!inputEl) return;

    // 初始化 textarea + 按钮高度
    _syncInputHeight(inputEl);

    // Enter 发送，Shift+Enter 换行
    inputEl.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        StoryElf.sendChat();
      }
    });

    // 自动撑高（textarea + 按钮同步）
    inputEl.addEventListener('input', function () {
      _syncInputHeight(this);
    });
  }

  /** textarea 动态高度 + 按钮同步 */
  function _syncInputHeight(textarea) {
    textarea.style.height = 'auto';
    var newH = Math.min(textarea.scrollHeight, MAX_INPUT_HEIGHT);
    newH = Math.max(newH, MIN_INPUT_HEIGHT);
    textarea.style.height = newH + 'px';
    // 按钮同步高度
    var sendBtn = document.getElementById('elf-send-btn');
    if (sendBtn) sendBtn.style.height = newH + 'px';
  }

  // ============================================================
  // 事件绑定（浮动模式: 拖拽 + toggle；嵌入模式: 仅 send 按钮）
  // ============================================================
  var _drag = { moved: false, sx: 0, sy: 0, ox: 0, oy: 0 };

  function bindEvents() {
    var sendBtn = document.getElementById('elf-send-btn');
    if (sendBtn) sendBtn.addEventListener('click', function () { StoryElf.sendChat(); });

    // 浮动模式: 头像拖拽 + 点击 toggle
    var avatar = document.querySelector('#story-elf .elf-avatar');
    if (avatar) {
      avatar.addEventListener('mousedown', function (e) {
        var elf = document.getElementById('story-elf');
        if (!elf || elf.classList.contains('elf-embedded')) return;
        if (e.target.closest('textarea') || e.target.closest('input') || e.target.closest('button')) return;
        e.preventDefault();
        var r = elf.getBoundingClientRect();
        _drag = { moved: false, sx: e.clientX, sy: e.clientY, ox: e.clientX - r.left, oy: e.clientY - r.top };
        elf.style.left = r.left + 'px';
        elf.style.top = r.top + 'px';
        document.addEventListener('mousemove', onFloatDragMove);
        document.addEventListener('mouseup', onFloatDragUp);
      });
    }
  }

  function onFloatDragMove(e) {
    if (Math.abs(e.clientX - _drag.sx) > 3 || Math.abs(e.clientY - _drag.sy) > 3) _drag.moved = true;
    if (!_drag.moved) return;
    var elf = document.getElementById('story-elf');
    elf.style.left = Math.max(0, Math.min(window.innerWidth - 170, e.clientX - _drag.ox)) + 'px';
    elf.style.top  = Math.max(0, Math.min(window.innerHeight - 220, e.clientY - _drag.oy)) + 'px';
  }

  function onFloatDragUp() {
    document.removeEventListener('mousemove', onFloatDragMove);
    document.removeEventListener('mouseup', onFloatDragUp);
    if (_drag.moved) { savePosition(); }
    else { StoryElf._floatToggle(); }
    _drag.moved = false;
  }

  // ============================================================
  // 公共 API
  // ============================================================
  window.StoryElf = {
    /**
     * mount(container: HTMLElement | null)
     *
     * 切换运行模式:
     *   mount(containerEl) → 嵌入模式: #story-elf 移入 container，添加 .elf-embedded
     *   mount(null)        → 浮动模式: #story-elf 移回 body，移除 .elf-embedded
     */
    /** 页面初始化：注入差异配置（Read 页调用 setContext，Write 页调用 init） */
    init: function (opts) {
      if (opts.getWorkId) _config.getWorkId = opts.getWorkId;
      if (opts.beforeSend !== undefined) _config.beforeSend = opts.beforeSend;
      if (opts.contextModule !== undefined) _config.contextModule = opts.contextModule;
      if (opts.onToolResult !== undefined) _config.onToolResult = opts.onToolResult;
    },

    mount: function (container) {
      var elf = document.getElementById('story-elf');
      if (!elf) return;

      if (container) {
        // 嵌入模式: 头像移到 input-row 内（底部左对齐）
        var avatar = elf.querySelector('.elf-avatar');
        var inputRow = elf.querySelector('.elf-chat-input-row');
        if (avatar && inputRow) {
          inputRow.insertBefore(avatar, inputRow.firstChild);
        }
        container.appendChild(elf);
        elf.classList.add('elf-embedded');
        // 清理浮动模式的 inline style
        elf.style.left = '';
        elf.style.top = '';
        // 确保 textarea + 按钮高度正确
        var inp = document.getElementById('elf-chat-input');
        if (inp) _syncInputHeight(inp);
      } else {
        // 浮动模式: 头像移出 input-row，作为 #story-elf 的第一个子元素
        var avatar = elf.querySelector('.elf-avatar');
        var msgs = elf.querySelector('#elf-chat-messages');
        if (avatar && msgs) {
          elf.insertBefore(avatar, msgs);
        }
        document.body.appendChild(elf);
        elf.classList.remove('elf-embedded');
        restorePosition();
        // 恢复浮动模式默认隐藏状态（仅隐藏消息和输入栏，头像保持可见）
        if (msgs) msgs.style.display = 'none';
        var inputRow = elf.querySelector('.elf-chat-input-row');
        if (inputRow) inputRow.style.display = 'none';
      }
    },

    // 加载永续对话历史
    loadConversation: function (workId, page) { return _loadConversation(workId, page); },

    // 添加消息（同时追加到 DOM 和 _messages 数组）
    addMessage: function (text, role) {
      _renderMsgDOM(text, role);
      if (role === 'user' || role === 'assistant') {
        _messages.push({ role: role, content: text });
      }
      // 如果 DOM 消息超出上限，重新渲染（截断尾部）
      if (_messages.length > MAX_DOM_MSGS + 10) {
        _renderMessages();
      }
    },

    clearMessages: function () {
      var msgs = document.getElementById('elf-chat-messages');
      if (!msgs) return;
      // 仅清除聊天消息（.elf-chat-msg），保留工作块（.elf-working-block）
      var toRemove = msgs.querySelectorAll('.elf-chat-msg');
      for (var i = 0; i < toRemove.length; i++) { toRemove[i].remove(); }
    },

    getInput: function () {
      var inp = document.getElementById('elf-chat-input');
      return inp ? inp.value.trim() : '';
    },

    clearInput: function () {
      var inp = document.getElementById('elf-chat-input');
      if (inp) {
        inp.value = '';
        // 重置 textarea + 按钮高度
        _syncInputHeight(inp);
      }
    },

    // 统一 sendChat — Read 侧 + Write 侧共用。差异通过 init({...}) 注入。
    sendChat: function () {
      var msg = StoryElf.getInput();
      if (!msg) return;
      if (_config.beforeSend) _config.beforeSend();
      StoryElf.addMessage(msg, 'user');
      StoryElf.clearInput();
      var currentMessages = getMessages();
      var token = _getToken();
      var lang = _getLang();
      var ctx = StoryElf.getContext() || {};
      var msgs = document.getElementById('elf-chat-messages');
      StoryElf.initWorkingBlock();

      var mod = typeof _config.contextModule === 'function' ? _config.contextModule() : _config.contextModule;
      var reqCtx = { section_title: ctx.section_title };
      if (mod) reqCtx.module = mod;

      fetch('/api/write/elf/chat?lang=' + lang, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
        body: JSON.stringify({
          work_id: _config.getWorkId(),
          section_id: ctx.section_id || undefined,
          page: ctx.page || 'read',
          messages: currentMessages,
          context: reqCtx,
        }),
      }).then(function (response) {
        if (!response.ok) {
          return response.json().then(function () {
            StoryElf.finishWorkingBlock();
            StoryElf.addMessage((typeof t === 'function' ? t('elf.ai_unavailable', 'AI is temporarily unavailable, please try again later') : 'AI is temporarily unavailable, please try again later'), 'assistant');
          });
        }

        var reader = response.body.getReader();
        var decoder = new TextDecoder();
        var buffer = '';

        function pump() {
          return reader.read().then(function (_a) {
            var done = _a.done, value = _a.value;
            if (done) return;
            buffer += decoder.decode(value, { stream: true });
            var parts = buffer.split('\n\n');
            buffer = parts.pop() || '';
            parts.forEach(function (part) {
              if (!part.trim()) return;
              var lines = part.split('\n');
              var eventType = '', dataStr = '';
              lines.forEach(function (l) {
                if (l.startsWith('event: ')) eventType = l.slice(7);
                if (l.startsWith('data: ')) dataStr = l.slice(6);
              });
              if (!dataStr) return;
              try {
                var data = JSON.parse(dataStr);
                if (eventType === 'step') {
                  StoryElf.appendStep(data);
                  // 通知页面 onToolResult 回调（Write 页用于处理 write_to_slot）
                  if (_config.onToolResult && data.type === 'tool_result') {
                    _config.onToolResult(data);
                  }
                } else if (eventType === 'done') {
                  StoryElf.finishWorkingBlock();
                  StoryElf.addMessage(data.reply, 'assistant');
                  if (msgs) msgs.scrollTop = msgs.scrollHeight;
                } else if (eventType === 'error') {
                  StoryElf.finishWorkingBlock();
                  StoryElf.addMessage((typeof t === 'function' ? t('elf.ai_unavailable', 'AI is temporarily unavailable, please try again later') : 'AI is temporarily unavailable, please try again later'), 'assistant');
                }
              } catch (e) { console.error('[SSE] JSON parse error, eventType=' + eventType + ' err=' + (e.message || e) + ' preview=' + dataStr.substring(0, 200)); }
            });
            return pump();
          });
        }
        return pump();
      }).catch(function () {
        StoryElf.finishWorkingBlock();
        StoryElf.addMessage((typeof t === 'function' ? t('elf.network_error', 'Network error, please try again later') : 'Network error, please try again later'), 'assistant');
      });
    },

    setPage: function (type) {
      var input = document.getElementById('elf-chat-input');
      if (input) input.placeholder = type === 'write'
        ? (typeof t === 'function' ? t('elf.write_placeholder', 'Ask AI to polish this...') : 'Ask AI to polish this...')
        : (typeof t === 'function' ? t('elf.read_placeholder', '和 Story Elf 聊聊这部作品...') : '和 Story Elf 聊聊这部作品...');
    },

    _ctx: null,
    setContext: function (ctx) { StoryElf._ctx = ctx; },
    getContext: function () { return StoryElf._ctx; },

    getMessages: getMessages,
    addSteps: _addSteps,               // 批量渲染（旧兼容）
    initWorkingBlock: _initWorkingBlock,   // SSE: 创建工作块
    appendStep: _appendStep,               // SSE: 增量追加步骤
    finishWorkingBlock: _finishWorkingBlock, // SSE: 工作完成

    /** 浮动模式: 切换消息区和输入栏的显示/隐藏 */
    _floatToggle: function () {
      var elf = document.getElementById('story-elf');
      if (!elf || elf.classList.contains('elf-embedded')) return;
      var msgs = document.getElementById('elf-chat-messages');
      var inputRow = elf.querySelector('.elf-chat-input-row');
      var isHidden = msgs && (msgs.style.display === 'none' || !msgs.style.display);
      if (msgs) msgs.style.display = isHidden ? 'flex' : 'none';
      if (inputRow) inputRow.style.display = isHidden ? 'flex' : 'none';
      if (isHidden) {
        // 打开时滚动到底部
        setTimeout(function () {
          if (msgs) msgs.scrollTop = msgs.scrollHeight;
        }, 0);
      }
    },
  };
})();
