// Story Forger — 写作桌主逻辑（v2.0：左右分栏 + Pipeline 唯一导航 + 槽位编辑器）
// 依赖：write-api.js (HTTP 层)

// ============================================================
// State
// ============================================================
var state = {
  currentWorkId: null,
  currentModule: null,
  currentSectionId: null,
  currentSectionTitle: '',
  currentEntityId: null,
  currentFhId: null,
  chapterFilter: 'all',
  leftPct: 33,   // 左栏百分比
  midPct: 34,    // 中栏百分比，右栏 = 100 - left - mid
};

function loadState() {
  try {
    var saved = JSON.parse(localStorage.getItem('sf_desk_v3') || '{}');
    Object.assign(state, { chapterFilter: 'all', leftPct: 33, midPct: 34 }, saved);
  } catch (e) {}
}
function saveState() {
  try {
    localStorage.setItem('sf_desk_v3', JSON.stringify({
      leftPct: state.leftPct,
      midPct: state.midPct,
      chapterFilter: state.chapterFilter,
    }));
  } catch (e) {}
}

// ============================================================
// DOM
// ============================================================
function qs(s) { return document.querySelector(s); }
function qsa(s) { return document.querySelectorAll(s); }

function loadingHTML() {
  return qs('#tmpl-loading').content.cloneNode(true);
}
function errorHTML(msg) {
  var el = qs('#tmpl-error').content.cloneNode(true);
  el.querySelector('.err-msg').textContent = msg || t('prompt.unknown_error');
  return el;
}

// ============================================================
// Pipeline Guide
// ============================================================
var PIPELINE_STEPS = [
  { id: 'M0', module: 'original_concept' },
  { id: 'M1', module: 'worldbuilding' },
  { id: 'M2', module: 'outline' },
  { id: 'M3', module: 'characters' },
  { id: 'M4', module: 'foreshadowing' },
  { id: 'M5', module: 'chapters' },
  { id: 'M6', module: 'writing' },
];

function plabel(s) { return t('pipeline.' + s.id); }

function renderPipelineSkeleton(el, workId) {
  var h = '';
  PIPELINE_STEPS.forEach(function (s, i) {
    h += '<div class="pipeline-step" data-module="' + s.module + '" data-step="' + s.id + '" onclick="switchModule(\'' + s.module + '\')">'
      + '<span class="pipeline-label">' + plabel(s) + '</span>'
      + '<span class="pipeline-id">' + s.id + '</span></div>';
    if (i < PIPELINE_STEPS.length - 1) h += '<span class="pipeline-arrow">&rsaquo;</span>';
  });
  el.innerHTML = h;
}

function updatePipelineStatuses(statuses) {
  // 未来可在此根据 statuses 更新视觉状态；当前统一外观
  PIPELINE_STEPS.forEach(function (s) {
    var el = qs('.pipeline-step[data-step="' + s.id + '"]');
    if (el) el.querySelector('.pipeline-label').textContent = plabel(s);
  });
}

async function refreshPipelineGuide(workId) {
  var guide = qs('#pipeline-guide');
  var el = qs('#pipeline-steps');
  if (!guide || !el || !workId) return;
  guide.style.display = 'block';
  renderPipelineSkeleton(el, workId);

  // V3: 获取模块列表 → 用于 pipeline 状态指示器（不预加载模块内容，按需加载）
  var allMods = await loadModuleList(workId);
  var byType = {};
  (allMods && allMods.data && allMods.data.modules || []).forEach(function (m) {
    byType[m.type] = byType[m.type] || [];
    byType[m.type].push(m);
  });

  // 根据 modules 表 status 字段更新 pipeline 状态
  function statusOf(type) {
    var mods = byType[type] || [];
    if (!mods.length) return 'empty';
    var done = mods.filter(function (m) { return m.status === 'done'; }).length;
    if (done === mods.length) return 'done';
    return done > 0 || mods.some(function (m) { return m.status === 'in_progress'; }) ? 'in_progress' : 'empty';
  }
  updatePipelineStatuses({
    M0: statusOf('m0'),
    M1: statusOf('m1'),
    M2: statusOf('m2'),
    M3: statusOf('m3_card'),
    M4: statusOf('m4_card'),
    M5: statusOf('m5_intent'),
    M6: statusOf('m6_chapter'),
  });

  var curMod = state.currentModule;
  if (curMod) {
    var stepEl = qs('.pipeline-step[data-module="' + curMod + '"]');
    if (stepEl) stepEl.classList.add('active');
  }
}

// ============================================================
// Workspace
// ============================================================
async function loadWorkspaces() {
  var sel = qs('#workspace-selector');
  sel.innerHTML = '<option value="">' + t('label.loading') + '</option>';
  var data = await hGet('/api/write/works');
  if (!data || !data.ok) { sel.innerHTML = '<option value="">' + t('label.load_failed') + '</option>'; return; }
  var works = data.data || [];
  sel.innerHTML = '<option value="">' + t('label.select_work') + '</option>';
  works.forEach(function (w) { sel.innerHTML += '<option value="' + w.id + '">' + escHtml(w.title) + ' (' + w.status + ')</option>'; });
  if (works.length > 0) { sel.value = works[0].id; onWorkspaceChange(); }
}

var _cacheReady = false;

async function preWarmCache(workId) {
  // 页面加载时一次性预加载所有单例模块 + 卡片列表到缓存
  var singletons = ['m0', 'm1', 'm2', 'm4_strategy'];
  var cardLists = ['m3_card', 'm4_card', 'm5_intent', 'm6_chapter'];
  await Promise.all(
    singletons.map(function (t) { return loadModule(t + '_' + workId); })
      .concat(cardLists.map(function (t) { return loadModuleList(workId, t); }))
  );
  _cacheReady = true;
}

async function onWorkspaceChange() {
  var id = qs('#workspace-selector').value;
  if (!id) {
    qs('#split-view').style.display = 'none';
    qs('#pipeline-guide').style.display = 'none';
    return;
  }
  state.currentWorkId = id;
  saveState();
  qs('#split-view').style.display = 'grid';
  applyGridColumns();
  cacheClear(); // 切换作品，清空旧缓存
  _cacheReady = false;

  refreshPipelineGuide(id);
  loadWorkConfig();
  preWarmCache(id); // 后台异步预加载，不阻塞渲染
  await switchModule('original_concept');
  updateElfContext();
}

// ============================================================
// Module Switching
// ============================================================
var _switchLock = null;
async function switchModule(module) {
  // 防抖：同一模块的重复点击忽略
  if (_switchLock === module) return;
  _switchLock = module;

  // 切换前保存当前模块（异步发，不阻塞 UI）
  clearTimeout(_autoSaveTimer);
  var p = capturePayload();
  if (p) {
    var fp = fingerprint(p);
    if (fp !== _lastSaved) {
      _pendingPayload = p;
      flushPendingPayload();  // 异步发送，不 await
    }
  }

  state.currentModule = module;
  state.currentSectionId = null;
  state.currentSectionTitle = '';
  state.currentEntityId = null;
  state.currentFhId = null;

  PIPELINE_STEPS.forEach(function (s) {
    var el = qs('.pipeline-step[data-module="' + s.module + '"]');
    if (el) el.classList.toggle('active', s.module === module);
  });

  if (!state.currentWorkId) return;
  showTextEditor('');

  switch (module) {
    case 'original_concept': await loadM0(); break;
    case 'worldbuilding': await loadM1(); break;
    case 'outline': await loadM2(); break;
    case 'characters': await loadM3(); break;
    case 'foreshadowing': await loadM4(); break;
    case 'chapters': await loadM5(); break;
    case 'writing': await loadM6(); break;
  }
  updateElfContext();
  _switchLock = null; // 切换完成后重置锁
}

function updateElfContext() {
  StoryElf.setContext({
    page: 'write',
    work_id: state.currentWorkId,
    module: state.currentModule,
    section_id: state.currentSectionId,
    section_title: state.currentSectionTitle,
  });
}

// ============================================================
// 模块数据缓存 —— 首次 pipeline 加载后复用，避免切模块时重复请求
// ============================================================
var _moduleCache = {};

function cacheGet(key) {
  return _moduleCache[key] || null;
}
function cacheSet(key, data) {
  if (data) _moduleCache[key] = data;
}
function cacheClear(keys) {
  if (!keys) { _moduleCache = {}; return; }
  (keys || []).forEach(function (k) { delete _moduleCache[k]; });
}

// ============================================================
// V3 统一数据层 — module_id → API 映射
// ============================================================
function getModuleId() {
  var wid = state.currentWorkId;
  var mod = state.currentModule;
  if (!wid || !mod) return null;
  switch (mod) {
    case 'original_concept': return 'm0_' + wid;
    case 'worldbuilding':    return 'm1_' + wid;
    case 'outline':          return 'm2_' + wid;
    case 'characters':       return state.currentEntityId ? 'm3_card_' + state.currentEntityId : null;
    case 'foreshadowing':    return state.currentFhId ? 'm4_card_' + state.currentFhId : 'm4_strategy_' + wid;
    case 'chapters':         return state.currentSectionId ? 'm5_intent_' + state.currentSectionId : null;
    case 'writing':          return state.currentSectionId ? 'm6_chapter_' + state.currentSectionId : null;
    default: return null;
  }
}

// 加载单个 Module（缓存优先）
async function loadModule(moduleId) {
  var cached = cacheGet(moduleId);
  if (cached) return cached;
  var data = await hGet('/api/write/module/' + moduleId);
  if (data && data.ok) {
    // 仅当缓存仍为空时写入，防止覆盖在 fetch 期间由 saveModule 写入的新数据
    if (!cacheGet(moduleId)) cacheSet(moduleId, data);
    return data;
  }
  return null;
}

// 保存 Module（V4: 携带修改前内容，服务端零 R2 读取即可生成历史快照）
// 409 Conflict: 自动处理——重新拉取最新内容、刷新缓存后静默重试保存
async function saveModule(moduleId, slots, freeContent, _retryCount) {
  _retryCount = _retryCount || 0;
  var cached = cacheGet(moduleId);
  var body = { slots: slots || {}, free_content: freeContent || '' };
  if (cached && cached.data) {
    if (cached.data.slots) body._prev_slots = cached.data.slots;
    if (cached.data.free_content !== undefined) body._prev_free_content = cached.data.free_content;
  }
  var resp = await hPut('/api/write/module/' + moduleId, body);

  // 409 Conflict：内容被 Story Elf 等外部修改过 → 静默刷新后重试
  if (resp && resp.status === 409 && _retryCount < 1) {
    cacheClear([moduleId]);
    // 重新拉取最新数据
    var fresh = await loadModule(moduleId);
    if (fresh && fresh.ok) {
      // 更新 DOM 中的模板槽位（用户可能正在看）
      refreshSlotsFromData(fresh.data);
      // 用新缓存的 _prev_slots 重试保存
      return saveModule(moduleId, slots, freeContent, _retryCount + 1);
    }
  }

  if (resp && resp.ok) {
    cacheSet(moduleId, resp);
  } else {
    cacheClear([moduleId]);
  }
  return resp;
}

// 静默更新 DOM 中的槽位内容（不覆盖用户正在编辑的文本）
function refreshSlotsFromData(data) {
  if (!data || !data.slots) return;
  var slots = data.slots;
  // 更新模板槽位 textarea
  Object.keys(slots).forEach(function (slotId) {
    var newContent = slots[slotId];
    if (!newContent || !newContent.trim()) return;
    var el = document.querySelector('[data-slot-id=\"' + slotId + '\"]');
    if (el && !el.matches(':focus')) {
      // 只在用户未聚焦该槽位时更新（不打断正在编辑的内容）
      el.value = newContent;
      // 更新缓存中的槽位数据
      var modId = getModuleId();
      if (modId) {
        var cached = cacheGet(modId);
        if (cached && cached.data && cached.data.slots) {
          cached.data.slots[slotId] = newContent;
        }
      }
    }
  });
  // 更新 rendered_md 预览（如果可见）
  var previewEl = document.getElementById('rendered-preview');
  if (previewEl && data.rendered_md) {
    previewEl.textContent = data.rendered_md;
  }
}

// 加载 ModuleList
async function loadModuleList(workId, type) {
  var cacheKey = 'list_' + type;
  var cached = cacheGet(cacheKey);
  if (cached) return cached;
  var data = await hGet('/api/write/modules?work_id=' + workId + '&type=' + type);
  if (data && data.ok) { cacheSet(cacheKey, data); return data; }
  return null;
}

// ============================================================
// Rotating Hint Engine
// ============================================================
var _hintTimer = null;
var _hintIndex = {};  // {module: current index} — 跨语言切换保持不变
var _hintShown = {};  // {module: [shown indices]} — 避免短期重复
var _hintCache = {};  // {module: hints[]}

async function loadRotatingHint(module) {
  var left = qs('#split-left');
  // 移除旧提示
  var old = left.querySelector('.rotating-hint');
  if (old) old.remove();

  // 添加占位
  var el = qs('#tmpl-rotating-hint').content.cloneNode(true);
  left.appendChild(el);

  var textEl = left.querySelector('.hint-text');

  var hints = [];
  try {
    var data = await hGet('/api/write/hints/' + module + '?work_id=' + (state.currentWorkId || '') + '&_t=' + Date.now());
    if (data && data.ok) {
      hints = data.data.all || [];
    }
  } catch (e) {}

  if (hints.length === 0) return;

  // 缓存
  _hintCache[module] = hints;

  // 选一条：如果已有记录（如切语言），用同一条；否则随机
  if (_hintIndex[module] != null && _hintIndex[module] < hints.length) {
    var pick = _hintIndex[module];
  } else {
    if (!_hintShown[module]) _hintShown[module] = [];
    var shown = _hintShown[module];
    var available = [];
    for (var j = 0; j < hints.length; j++) {
      if (shown.indexOf(j) < 0) available.push(j);
    }
    if (available.length === 0) {
      _hintShown[module] = [];
      available = hints.map(function (_, k) { return k; });
    }
    var pick = available[Math.floor(Math.random() * available.length)];
  }
  _hintIndex[module] = pick;
  _hintShown[module].push(pick);

  textEl.innerHTML = marked.parse(hints[pick]);

  // 设置下一次轮换（60-120 分钟随机）
  clearTimeout(_hintTimer);
  _hintTimer = setTimeout(function () {
    rotateHint(module);
  }, 3600000); // 1 小时
}

function rotateHint(module) {
  if (!_hintCache[module]) { loadRotatingHint(module); return; }

  var hints = _hintCache[module];
  var textEl = qs('#split-left .hint-text');
  if (!textEl) return;

  var shown = _hintShown[module] || [];
  var available = [];
  for (var i = 0; i < hints.length; i++) {
    if (shown.indexOf(i) < 0) available.push(i);
  }
  if (available.length === 0) {
    _hintShown[module] = [];
    available = hints.map(function (_, k) { return k; });
  }
  var pick = available[Math.floor(Math.random() * available.length)];
  _hintIndex[module] = pick;
  _hintShown[module].push(pick);

  // 动画：淡出再淡入
  var container = textEl.closest('.rotating-hint');
  if (container) {
    container.style.opacity = '0';
    container.style.transition = 'opacity 0.3s';
    setTimeout(function () {
      textEl.innerHTML = marked.parse(hints[pick]);
      container.style.opacity = '1';
    }, 350);
  } else {
    textEl.innerHTML = marked.parse(hints[pick]);
  }

  // 下次轮换
  clearTimeout(_hintTimer);
  _hintTimer = setTimeout(function () {
    rotateHint(module);
  }, 3600000); // 1 小时
}

// ============================================================
// Template Level 可见性控制
// ============================================================
var _currentLevel = 1; // 当前作品模板 level（默认 L1）

/** 根据当前 level 显示/隐藏 section 和 slot */
function applySlotLevel() {
  // Section div：父隐藏 → 子自动隐藏（DOM display:none 继承）
  var sections = document.querySelectorAll('#slot-groups .slot-section');
  sections.forEach(function(sec) {
    var lv = parseInt(sec.dataset.level) || 0;
    if (lv > _currentLevel) {
      sec.classList.add('slot-hidden');
    } else {
      sec.classList.remove('slot-hidden');
    }
  });
  // Slot item：同 section 内不同 slot 可能有不同 level
  var items = document.querySelectorAll('#slot-groups .slot-item');
  items.forEach(function(item) {
    var sl = parseInt((item.dataset.level || 'L2').replace('L', '')) || 2;
    if (sl > _currentLevel) {
      item.classList.add('slot-hidden');
    } else {
      item.classList.remove('slot-hidden');
    }
  });
}

/** 从服务端加载作品 config */
async function loadWorkConfig() {
  var wid = state.currentWorkId;
  if (!wid) return;
  try {
    var data = await hGet('/api/write/works/' + wid + '/config');
    if (data && data.ok && data.data && data.data.template_level) {
      _currentLevel = data.data.template_level;
    }
  } catch (e) {
    // 默认 L1
  }
  renderLevelIndicator();
  applySlotLevel();
}

/** 渲染 Level 指示器到 pipeline bar */
function renderLevelIndicator() {
  var el = document.getElementById('level-indicator');
  if (!el) {
    var stepsEl = document.getElementById('pipeline-steps');
    if (!stepsEl) return;
    el = document.createElement('span');
    el.id = 'level-indicator';
    el.className = 'level-indicator';
    el.title = '点击切换模板等级';
    el.addEventListener('click', function () {
      var next = _currentLevel >= 2 ? 1 : _currentLevel + 1;
      setSlotLevel(next);
    });
    stepsEl.parentNode.insertBefore(el, stepsEl.nextSibling);
  }
  updateLevelIndicator();
}

function updateLevelIndicator() {
  var el = document.getElementById('level-indicator');
  if (!el) return;
  el.textContent = 'L' + _currentLevel;
  el.title = _currentLevel >= 2 ? '当前：完整模板 (L2)。点击回到基础模板 (L1)' : '当前：基础模板 (L1)。点击解锁完整模板 (L2)';
  if (_currentLevel >= 2) {
    el.classList.add('level-unlocked');
  } else {
    el.classList.remove('level-unlocked');
  }
}

/** 设置 level 并持久化 */
function setSlotLevel(newLevel) {
  _currentLevel = newLevel;
  applySlotLevel();
  var wid = state.currentWorkId;
  if (wid) {
    hPut('/api/write/works/' + wid + '/config', { template_level: newLevel }).catch(function() {});
  }
  updateLevelIndicator();
}

// ============================================================
// Slot Editor Engine — JSON 直接消费
// ============================================================
var _templateData = null;   // 当前 template JSON
var _slotGroupList = null;  // 多 group 模式下的 groups 数组
var _textareaList = [];     // 序列化时遍历的 textarea 列表（按渲染顺序）

// 渲染 slot 编辑器（JSON 直接消费，无需 Markdown 解析）
function renderSlotEditor(data) {
  _templateData = data;
  _textareaList = [];
  _slotGroupList = null;
  var groupsEl = document.getElementById('slot-groups');
  if (!groupsEl) return;
  groupsEl.innerHTML = '';

  var useGroups = !!(data.groups && data.groups.length > 0);

  if (useGroups) {
    // 多 group 模式（卡片列表，如 M3 人物卡 / M4 伏笔卡）
    _slotGroupList = data.groups;
    data.groups.forEach(function(group) {
      var gEl = document.createElement('div');
      gEl.className = 'slot-group';
      // Header
      var hdr = document.createElement('div');
      hdr.className = 'slot-group-header';
      var ttl = document.createElement('span');
      ttl.className = 'slot-group-title';
      ttl.textContent = group.name || '';
      hdr.appendChild(ttl);
      var acts = document.createElement('div');
      acts.className = 'slot-group-actions';
      var delBtn = document.createElement('button');
      delBtn.className = 'slot-group-delete';
      delBtn.innerHTML = '&times;';
      delBtn.title = '删除此条目';
      delBtn.addEventListener('click', function () { removeSlotGroup(delBtn); });
      acts.appendChild(delBtn);
      hdr.appendChild(acts);
      gEl.appendChild(hdr);
      // Body — 渲染 slots
      var body = document.createElement('div');
      body.className = 'slot-group-body';
      (group.slots || []).forEach(function(slot) {
        renderSlotItem(body, slot);
      });
      gEl.appendChild(body);
      groupsEl.appendChild(gEl);
    });
    // 添加条目按钮
    var addBtn = document.createElement('button');
    addBtn.className = 'slot-group-add';
    addBtn.textContent = '+ 添加条目';
    addBtn.addEventListener('click', addSlotGroup);
    groupsEl.appendChild(addBtn);
  } else {
    // 单 sections 模式（如 M1 世界观 / M2 大纲）
    var sections = data.sections || [];
    sections.forEach(function(section) {
      var secDiv = document.createElement('div');
      secDiv.className = 'slot-section';
      secDiv.dataset.level = section.level || 0;
      // Section heading（Markdown → HTML，加 ## 前缀确保渲染为 h2 获得色块背景样式）
      if (section.heading) {
        var hDiv = document.createElement('div');
        hDiv.className = 'slot-framework';
        try { hDiv.innerHTML = marked.parse('## ' + section.heading); } catch(e) { hDiv.textContent = section.heading; }
        secDiv.appendChild(hDiv);
      }
      // Slots
      (section.slots || []).forEach(function(slot) {
        renderSlotItem(secDiv, slot);
      });
      groupsEl.appendChild(secDiv);
    });
  }

  var freeArea = document.getElementById('slot-free-area');
  if (freeArea) freeArea.value = data.free_content || '';

  applySlotLevel();
}

// 渲染单个 slot：有 label → 用 ### 渲染（h3 青色），hint 存入 data-hint 供 Story Elf 使用
function renderSlotItem(parent, slot) {
  var item = document.createElement('div');
  item.className = 'slot-item';
  item.dataset.level = 'L' + (slot.level || 1);

  // 有 label 则渲染为 ### heading（h3 青色样式）
  if (slot.label) {
    var lblDiv = document.createElement('div');
    lblDiv.className = 'slot-framework';
    try { lblDiv.innerHTML = marked.parse('### ' + slot.label); } catch(e) { lblDiv.textContent = slot.label; }
    item.appendChild(lblDiv);
  }

  // Textarea
  var ta = document.createElement('textarea');
  ta.className = 'slot-textarea';
  ta.rows = Math.max(2, Math.min(6, (slot.content || '').split('\n').length));
  ta.value = slot.content || '';
  ta.dataset.slotId = slot.id || '';
  if (slot.hint) ta.dataset.hint = slot.hint;
  item.appendChild(ta);
  parent.appendChild(item);
  _textareaList.push(ta);
}

// 序列化 slot 内容 → { slots: { id: value, ... }, free_content: "..." }
function serializeSlots() {
  var slots = {};
  _textareaList.forEach(function(ta) {
    var id = ta.dataset.slotId;
    if (id) slots[id] = ta.value;
  });
  var freeArea = document.getElementById('slot-free-area');
  var freeContent = freeArea ? freeArea.value.trim() : '';

  // 单槽位 text 模式（M0/M6 用 showTextEditor）：从 writing-editor 读取
  if (Object.keys(slots).length === 0) {
    var we = qs('#writing-editor');
    if (we && we.style.display !== 'none') {
      slots.content = we.value;
    }
  }

  return { slots: slots, free_content: freeContent };
}

// 添加/删除 group（多 group 模式：M3/M4 卡片列表）
function addSlotGroup() {
  if (!_slotGroupList || _slotGroupList.length === 0) return;
  var lastGroup = _slotGroupList[_slotGroupList.length - 1];
  // 克隆最后一个 group 的 slots 结构（清空 content）
  var newSlots = (lastGroup.slots || []).map(function(slot) {
    return { id: slot.id, level: slot.level, label: slot.label, hint: slot.hint, content: '' };
  });
  var newName = '#' + (_slotGroupList.length + 1);
  _slotGroupList.push({ name: newName, slots: newSlots });
  // 重新渲染
  renderSlotEditor({ groups: _slotGroupList, free_content: _templateData && _templateData.free_content || '' });
}

function removeSlotGroup(btn) {
  var groupEl = btn.closest('.slot-group');
  if (!groupEl || !_slotGroupList) return;
  var groupsEl = document.getElementById('slot-groups');
  var allGroups = groupsEl.querySelectorAll('.slot-group');
  var idx = Array.prototype.indexOf.call(allGroups, groupEl);
  if (idx >= 0 && _slotGroupList.length > 1) {
    _slotGroupList.splice(idx, 1);
    renderSlotEditor({ groups: _slotGroupList, free_content: _templateData && _templateData.free_content || '' });
  }
}

// 显示/切换编辑器类型（三栏：左=参考 / 中=自由编辑 / 右=模板）
function showSlotEditor(templateData) {
  setThreePanelMode();
  var te = qs('#writing-editor');
  var se = qs('#slot-editor');
  var fe = qs('#form-editor');
  var fz = qs('#slot-free-zone');
  if (te) te.style.display = 'none';
  if (fe) fe.style.display = 'none';
  if (fz) fz.style.display = ''; // 用 CSS 的 flex，不清空
  if (se) {
    se.style.display = 'flex';
    se.style.flexDirection = 'column';
    se.style.overflowY = 'auto';
    se.style.flex = '1';
    renderSlotEditor(templateData);
  }
}

function showTextEditor(val) {
  _textareaList = [];  // 清空槽位引用，防止残留数据污染其他模块保存
  _templateData = null;
  var te = qs('#writing-editor');
  var se = qs('#slot-editor');
  var fe = qs('#form-editor');
  var fz = qs('#slot-free-zone');
  if (se) se.style.display = 'none';
  if (fe) fe.style.display = 'none';
  if (fz) fz.style.display = 'none';
  if (te) {
    te.style.display = 'block';
    te.value = val || '';
  }
}

function showFormEditor(intentData) {
  setThreePanelMode();
  var te = qs('#writing-editor');
  var se = qs('#slot-editor');
  var fe = qs('#form-editor');
  var fz = qs('#slot-free-zone');
  if (te) te.style.display = 'none';
  if (se) se.style.display = 'none';
  if (fz) { fz.style.display = ''; }
  if (!fe) return;
  fe.style.display = 'block';

  var fields = [
    // goal — 嵌套对象，拆为 3 个子字段
    { key: 'goal.advance_conflict', label: '推进冲突', type: 'textarea', hint: '推进哪条剧情线（对应 M2 长篇框架中的阶段/转折点）' },
    { key: 'goal.reveal_info', label: '揭示信息', type: 'textarea', hint: '本章要交代什么信息给读者' },
    { key: 'goal.create_suspense', label: '制造悬念', type: 'textarea', hint: '本章要制造什么悬念' },
    { key: 'emotional_goal', label: '情绪目标', type: 'input', hint: '希望读者产生什么情绪？（恐惧/温暖/悲伤/兴奋/好奇/愤怒/释然）' },
    { key: 'pov_character', label: '视角角色', type: 'input', hint: '本章以谁的视角展开？' },
    { key: 'pov_strategy', label: '视角策略', type: 'input', hint: '固定单一/多线交替/不可靠叙述者/全知' },
    { key: 'scene_type', label: '场景类型', type: 'input', hint: 'Wonder/一切尽失/终场/认知冲击（通用可选）' },
    // structure — 嵌套对象
    { key: 'structure.opening_hook', label: '开篇钩子', type: 'textarea', hint: '用什么抓住读者' },
    { key: 'structure.reversal_point', label: '反转点', type: 'textarea', hint: '本章的意外/转折' },
    { key: 'structure.cliffhanger', label: '章末卡点', type: 'textarea', hint: '用什么让读者想继续读下一章' },
    // foreshadowing_triggered
    { key: 'foreshadowing_triggered', label: '伏笔触发', type: 'input', hint: '格式: hook_id:action, hook_id:action（action=plant/hint/reveal/resolve）' },
    { key: 'promise_checklist_refs', label: '承诺兑现', type: 'input', hint: '对应 M1 承诺清单的条目，逗号分隔' },
    { key: 'characters_involved', label: '出场人物', type: 'input', hint: '逗号分隔的角色名或 ID' },
    { key: 'estimated_words', label: '预估字数', type: 'input', hint: '本章预估字数（数字）' },
    { key: 'style_notes', label: '风格备注', type: 'textarea', hint: '本章的特殊风格要求' },
    { key: 'visual_keywords', label: '视觉关键词', type: 'input', hint: '视觉关键词，逗号分隔（剧本/视觉叙事用）' },
    { key: 'camera_notes', label: '镜头备注', type: 'textarea', hint: '镜头/分镜想法（剧本用）' },
  ];

  var container = document.getElementById('form-fields');
  if (!container) return;
  container.innerHTML = '';

  // 辅助: 从嵌套对象读取值 (如 intentData.goal.advance_conflict)
  function getNested(obj, path) {
    var parts = path.split('.');
    var cur = obj;
    for (var i = 0; i < parts.length; i++) {
      if (cur == null) return '';
      cur = cur[parts[i]];
    }
    return cur || '';
  }

  fields.forEach(function (f) {
    var div = document.createElement('div');
    div.className = 'form-field';
    var lbl = document.createElement('div');
    lbl.className = 'form-field-label';
    lbl.textContent = f.label;
    div.appendChild(lbl);

    var val = '';
    if (f.key === 'foreshadowing_triggered') {
      var arr = (intentData && intentData.foreshadowing_triggered) || [];
      val = Array.isArray(arr) ? arr.map(function (x) { return x.hook_id + ':' + x.action; }).join(', ') : '';
    } else if (f.key === 'visual_keywords' || f.key === 'promise_checklist_refs' || f.key === 'characters_involved') {
      var a2 = (intentData && intentData[f.key]) || [];
      val = Array.isArray(a2) ? a2.join(', ') : '';
    } else if (f.key.includes('.')) {
      val = getNested(intentData, f.key);
    } else {
      val = (intentData && intentData[f.key]) || '';
    }

    if (f.type === 'textarea') {
      var ta = document.createElement('textarea');
      ta.className = 'form-field-textarea';
      ta.dataset.fieldKey = f.key;
      ta.value = val;
      ta.rows = 2;
      ta.placeholder = f.hint || '';
      div.appendChild(ta);
    } else {
      var inp = document.createElement('input');
      inp.className = 'form-field-input';
      inp.dataset.fieldKey = f.key;
      inp.value = val;
      inp.placeholder = f.hint || '';
      div.appendChild(inp);
    }
    if (f.hint) {
      var hint = document.createElement('div');
      hint.className = 'form-field-hint';
      hint.textContent = f.hint;
      div.appendChild(hint);
    }
    container.appendChild(div);
  });
}

function serializeFormContent() {
  var container = document.getElementById('form-fields');
  if (!container) return '{}';
  var result = {};
  container.querySelectorAll('[data-field-key]').forEach(function (el) {
    var key = el.dataset.fieldKey;
    var val = el.value.trim();

    // 嵌套路径 (如 goal.advance_conflict)
    if (key.includes('.')) {
      var parts = key.split('.');
      if (!result[parts[0]]) result[parts[0]] = {};
      result[parts[0]][parts[1]] = val;
    } else if (key === 'foreshadowing_triggered') {
      // "hook_id:action, hook_id:action" → [{hook_id, action}]
      if (val) {
        result[key] = val.split(/[,;，；]/).map(function (s) {
          var pair = s.trim().split(':');
          return { hook_id: (pair[0] || '').trim(), action: (pair[1] || 'plant').trim() };
        }).filter(function (x) { return x.hook_id; });
      } else {
        result[key] = [];
      }
    } else if (key === 'visual_keywords' || key === 'promise_checklist_refs' || key === 'characters_involved') {
      result[key] = val ? val.split(/[,;，；]/).map(function (s) { return s.trim(); }).filter(Boolean) : [];
    } else if (key === 'estimated_words') {
      result[key] = val ? parseInt(val, 10) || null : null;
    } else {
      result[key] = val;
    }
  });
  var chIdx = state.currentSectionTitle ? (state.currentSectionTitle.match(/(\d+)/) || [])[1] : null;
  if (chIdx) result.chapter_index = parseInt(chIdx, 10);
  return JSON.stringify(result, null, 2);
}

// ============================================================
// M0: 原始构想
// ============================================================
async function loadM0() {
  var left = qs('#split-left');
  left.innerHTML = '';
  loadRotatingHint('m0');

  var moduleId = 'm0_' + state.currentWorkId;
  var data = await loadModule(moduleId);
  // M0 单槽位 → 两栏 + 纯文本编辑
  var content = (data && data.data && data.data.slots && data.data.slots.content) ? data.data.slots.content : '';
  setTwoPanelMode();
  showTextEditor(content);
}

// ============================================================
// M1: 世界观
// ============================================================
async function loadM1() {
  var left = qs('#split-left');
  left.innerHTML = '';
  loadRotatingHint('m1');
  var data = await loadModule('m1_' + state.currentWorkId);
  left.innerHTML = '';
  if (data && data.data && data.data.template) {
    data.data.template.free_content = data.data.free_content || '';
    showSlotEditor(data.data.template);
  } else {
    showTextEditor('');
  }
}

// ============================================================
// M2: 主线剧情
// ============================================================
async function loadM2() {
  var left = qs('#split-left');
  left.innerHTML = '';
  loadRotatingHint('m2');
  var data = await loadModule('m2_' + state.currentWorkId);
  left.innerHTML = '';
  if (data && data.data && data.data.template) {
    data.data.template.free_content = data.data.free_content || '';
    showSlotEditor(data.data.template);
  } else {
    showTextEditor('');
  }
}

// ============================================================
// M3: 人物卡
// ============================================================
async function loadM3() {
  showTextEditor('');

  await renderEntityCardList();
  // 默认选中第一个角色
  var first = qs('#split-left .card-item[data-entity-id]');
  if (first) first.click();
}

async function renderEntityCardList() {
  var left = qs('#split-left');
  left.innerHTML = '';
  var data = await loadModuleList(state.currentWorkId, 'm3_card');
  left.innerHTML = '';
  if (!data || !data.ok) { left.appendChild(errorHTML(t('label.load_failed'))); return; }

  var entities = (data.data.modules || []).map(function (m) { return { id: m.id.replace('m3_card_', ''), name: m.name, type: 'character' }; });
  if (!entities.length) { left.innerHTML = '<div class="left-panel-empty">' + t('label.no_characters') + '</div>'; return; }

  var byType = {};
  entities.forEach(function (e) { var t = e.type || 'other'; if (!byType[t]) byType[t] = []; byType[t].push(e); });
  var frag = document.createDocumentFragment();
  Object.keys(byType).forEach(function (type) {
    var title = document.createElement('div');
    title.style.cssText = 'font-size:0.7rem;color:var(--text-muted);padding:0.5rem 0 0.2rem 0.2rem;width:100%;';
    title.textContent = t('entity_type.' + type) || type;
    frag.appendChild(title);
    var list = document.createElement('div');
    list.className = 'card-list';
    byType[type].forEach(function (e) {
      var card = qs('#tmpl-entity-card-item').content.cloneNode(true);
      var root = card.querySelector('.card-item');
      root.dataset.entityId = e.id;
      if (state.currentEntityId === e.id) root.classList.add('active');
      root.addEventListener('click', function () { openEntityCard(e.id, e.name); });
      card.querySelector('.card-item-name').textContent = e.name;
      card.querySelector('.card-item-meta').textContent = (e.description || '').substring(0, 30);
      list.appendChild(card);
    });
    frag.appendChild(list);
  });
  left.appendChild(frag);
}

async function openEntityCard(entityId, name) {
  // 切换前保存当前卡片
  var p = capturePayload();
  if (p) {
    var fp = fingerprint(p);
    if (fp !== _lastSaved) { _pendingPayload = p; flushPendingPayload(); }
  }

  state.currentEntityId = entityId;
  var data = await loadModule('m3_card_' + entityId);
  var template = (data && data.data && data.data.template) ? data.data.template : null;
  if (template) {
    template.free_content = (data && data.data) ? (data.data.free_content || '') : '';
    showSlotEditor(template);
  }

  // 只更新高亮，不重建整个列表 DOM
  qsa('#split-left .card-item[data-entity-id]').forEach(function (el) {
    el.classList.toggle('active', el.dataset.entityId === entityId);
  });
  updateElfContext();
}

// ============================================================
// M4: 伏笔账本 — 与 M3 统一：左侧 entity 列表，右侧单文件编辑
// ============================================================
async function loadM4() {
  showTextEditor('');

  // 加载策略总览
  var data = await loadModule('m4_strategy_' + state.currentWorkId);
  var template = (data && data.data && data.data.template) ? data.data.template : null;
  if (template) {
    template.free_content = (data && data.data) ? (data.data.free_content || '') : '';
    showSlotEditor(template);
  } else showTextEditor('');

  await renderFhCardList();
  var first = qs('#split-left .card-item[data-entity-id]');
  if (first) first.click();
}

async function renderFhCardList() {
  var left = qs('#split-left');
  left.innerHTML = '';
  var data = await loadModuleList(state.currentWorkId, 'm4_card');
  left.innerHTML = '';
  if (!data || !data.ok) { left.appendChild(errorHTML(t('label.load_failed'))); return; }

  var entities = (data.data.modules || []).map(function (m) { return { id: m.id.replace('m4_card_', ''), name: m.name, type: 'foreshadowing' }; });

  // 策略总览入口（始终在顶部）
  var frag = document.createDocumentFragment();
  var overviewCard = document.createElement('div');
  overviewCard.style.cssText = 'padding:0.35rem 0.75rem;margin-bottom:0.4rem;font-size:0.78rem;cursor:pointer;border-radius:6px;border:1px solid var(--border);color:var(--cyan);';
  overviewCard.textContent = '📋 ' + (t('label.fh_strategy') || '伏笔策略总览');
  overviewCard.addEventListener('click', async function () {
    // 保存当前卡片
    var p = capturePayload();
    if (p) {
      var fp = fingerprint(p);
      if (fp !== _lastSaved) { _pendingPayload = p; flushPendingPayload(); }
    }
    state.currentFhId = null;
    var d = await loadModule('m4_strategy_' + state.currentWorkId);
    var tpl = (d && d.data && d.data.template) ? d.data.template : null;
    if (tpl) { tpl.free_content = (d && d.data) ? (d.data.free_content || '') : ''; showSlotEditor(tpl); }
    // 只更新高亮
    qsa('#split-left .card-item[data-entity-id]').forEach(function (el) { el.classList.remove('active'); });
  });
  frag.appendChild(overviewCard);

  if (!entities.length) {
    var empty = document.createElement('div');
    empty.className = 'left-panel-empty';
    empty.style.cssText = 'padding:1rem;';
    empty.textContent = t('label.no_foreshadowing') || '暂无伏笔条目';
    frag.appendChild(empty);
  }

  // 伏笔条目卡片（与 M3 人物卡同款）
  var list = document.createElement('div');
  list.className = 'card-list';
  entities.forEach(function (e) {
    var card = qs('#tmpl-entity-card-item').content.cloneNode(true);
    var root = card.querySelector('.card-item');
    root.dataset.entityId = e.id;
    if (state.currentFhId === e.id) root.classList.add('active');
    root.addEventListener('click', function () { openFhCard(e.id, e.name); });
    card.querySelector('.card-item-name').textContent = e.name;
    card.querySelector('.card-item-meta').textContent = (e.description || '').substring(0, 30);
    list.appendChild(card);
  });
  frag.appendChild(list);
  left.appendChild(frag);
}

async function openFhCard(entityId, name) {
  // 切换前保存当前卡片
  var p = capturePayload();
  if (p) {
    var fp = fingerprint(p);
    if (fp !== _lastSaved) { _pendingPayload = p; flushPendingPayload(); }
  }

  state.currentFhId = entityId;
  var data = await loadModule('m4_card_' + entityId);
  var template = null;
  if (data && data.data) {
    if (data.data.card && data.data.card.slots) {
      template = { sections: [{ heading: data.data.card.name || name, level: 1, slots: data.data.card.slots }], free_content: data.data.free_content || '' };
    } else if (data.data.template) {
      template = data.data.template;
      template.free_content = data.data.free_content || '';
    }
  }
  if (template) showSlotEditor(template);

  // 只更新高亮，不重建整个列表 DOM
  qsa('#split-left .card-item[data-entity-id]').forEach(function (el) {
    el.classList.toggle('active', el.dataset.entityId === entityId);
  });
  updateElfContext();
}

// ============================================================
// M5 / M6: 章节蓝图 / 逐章编写
// ============================================================
async function loadM5() {
  setThreePanelMode();
  // 显示自由编辑区（中栏），隐藏右侧槽位编辑器（M5 用表单编辑器）
  var te = qs('#writing-editor');
  var se = qs('#slot-editor');
  var fz = qs('#slot-free-zone');
  if (te) te.style.display = 'none';
  if (se) se.style.display = 'none';
  if (fz) fz.style.display = '';

  await loadChapterCardList();
  // 默认选中第一章
  var first = qs('#split-left .chapter-card[data-section-id]');
  if (first) first.click();
}

async function loadM6() {
  setTwoPanelMode();
  showTextEditor(''); // 占位，openChapter 会填入内容

  await loadChapterCardList();
  var first = qs('#split-left .chapter-card[data-section-id]');
  if (first) first.click();
}

async function loadChapterCardList() {
  var left = qs('#split-left');
  left.innerHTML = '';

  // V3: 从 modules 表获取章节列表（已缓存）
  var modList = await loadModuleList(state.currentWorkId, state.currentModule === 'chapters' ? 'm5_intent' : 'm6_chapter');

  left.innerHTML = '';
  if (!modList || !modList.ok) { left.appendChild(errorHTML(t('label.load_failed'))); return; }

  var sections = (modList.data.modules || []).map(function (m) {
    var sid = m.id.replace(/^m[56]_(intent|chapter)_/, '');
    return { id: sid, title: m.name, order_index: m.order_index,
      section_summary: null, word_count: 0, version: m.status === 'done' ? 2 : (m.status === 'in_progress' ? 1 : 0) };
  });
  if (!sections.length) {
    var wid = state.currentWorkId;
    left.innerHTML = '<div class="left-panel-empty">' + t('label.no_chapters')
      + '<div style="margin-top:0.5rem"><button class="btn btn-ghost btn-sm" onclick="generateOutline(\'' + wid + '\')">' + t('action.generate_outline') + '</button></div></div>';
    return;
  }

  // 筛选按钮
  var filterDiv = document.createElement('div');
  filterDiv.className = 'chapter-filters';
  ['all', 'draft', 'done'].forEach(function (f) {
    var btn = document.createElement('button');
    btn.className = 'chapter-filter-btn' + (state.chapterFilter === f ? ' active' : '');
    btn.textContent = t('chapter_filter.' + f);
    btn.addEventListener('click', function () { state.chapterFilter = f; saveState(); loadChapterCardList(); });
    filterDiv.appendChild(btn);
  });
  left.appendChild(filterDiv);

  var filtered = sections;
  if (state.chapterFilter === 'draft') filtered = sections.filter(function (s) { return s.version < 2; });
  else if (state.chapterFilter === 'done') filtered = sections.filter(function (s) { return s.version >= 2 && s.word_count > 0; });

  if (!filtered.length) { left.appendChild(document.createTextNode(t('label.no_match'))); return; }

  var list = document.createElement('div');
  list.className = 'card-list';
  filtered.forEach(function (s) {
    var stIcon = s.version === 0 ? (s.word_count > 0 ? '[draft]' : '[new]') : (s.word_count > 0 ? '[done]' : '[planned]');
    var card = qs('#tmpl-chapter-card-item').content.cloneNode(true);
    var root = card.querySelector('.card-item');
    root.dataset.sectionId = s.id;
    if (state.currentSectionId === s.id) root.classList.add('active');
    root.addEventListener('click', function () { openChapter(s.id, s.title); });
    card.querySelector('.card-status').textContent = stIcon;
    card.querySelector('.card-item-name').textContent = s.title;
    card.querySelector('.card-item-meta').textContent = (s.word_count || 0) + '字';
    list.appendChild(card);
  });
  left.appendChild(list);

  // 拖拽排序（仅 M6）
  if (state.currentModule === 'writing') initChapterDrag();
}

async function openChapter(sectionId, title) {
  state.currentSectionId = sectionId;
  state.currentSectionTitle = title;

  if (state.currentModule === 'chapters') {
    // M5: 意图卡 — V3 统一 API + 槽位编辑器
    var moduleId = 'm5_intent_' + sectionId;
    var data = await loadModule(moduleId);
    if (data && data.data && data.data.template) {
      showSlotEditor(data.data.template);
      // 填充自由编辑区
      var freeArea = qs('#slot-free-area');
      if (freeArea && data.data.free_content) freeArea.value = data.data.free_content;
    } else {
      // 降级：空意图卡用表单编辑器（模板为空时）
      showFormEditor({ goal: {}, chapter_index: (title.match(/(\d+)/) || [])[1] });
      var freeArea2 = qs('#slot-free-area');
      if (freeArea2) freeArea2.value = '';
    }
  } else {
    // M6: 章节正文 — 单槽位，两栏 + 纯文本编辑
    var moduleId6 = 'm6_chapter_' + sectionId;
    var data6 = await loadModule(moduleId6);
    var chapterContent = (data6 && data6.data && data6.data.slots && data6.data.slots.content) ? data6.data.slots.content : '';
    setTwoPanelMode();
    showTextEditor(chapterContent);
  }

  // 刷新左侧列表以高亮当前选中
  if (state.currentModule === 'chapters' || state.currentModule === 'writing') {
    loadChapterCardList();
  }
  updateElfContext();
}

// 章节拖拽
var _dragSrc = null;
function initChapterDrag() {
  qsa('#split-left .card-item').forEach(function (item) {
    item.addEventListener('dragstart', function (e) { _dragSrc = item.dataset.sectionId; item.classList.add('dragging'); e.dataTransfer.effectAllowed = 'move'; });
    item.addEventListener('dragend', function () { item.classList.remove('dragging'); qsa('#split-left .card-item').forEach(function (i) { i.classList.remove('drag-over'); }); });
    item.addEventListener('dragover', function (e) { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; if (item.dataset.sectionId !== _dragSrc) item.classList.add('drag-over'); });
    item.addEventListener('dragleave', function () { item.classList.remove('drag-over'); });
    item.addEventListener('drop', async function (e) {
      e.preventDefault(); item.classList.remove('drag-over');
      var tid = item.dataset.sectionId;
      if (_dragSrc === tid) return;
      var od = await hGet('/api/write/outline/' + state.currentWorkId);
      if (!od || !od.ok) return;
      var secs = od.data.sections.slice();
      var fi = secs.findIndex(function (x) { return x.id === _dragSrc; });
      var ti = secs.findIndex(function (x) { return x.id === tid; });
      if (fi < 0 || ti < 0) return;
      var mv = secs.splice(fi, 1)[0]; secs.splice(ti, 0, mv);
      var r = await hPut('/api/write/outline/' + state.currentWorkId, { sections: secs.map(function (x, i) { return { id: x.id, title: x.title, order_index: i }; }) });
      if (r && r.ok) { cacheClear(); loadChapterCardList(); }
    });
  });
}

// ============================================================
// 保存逻辑：失焦即存 + 输入时防抖保存（双重保障）
// ============================================================
var _autoSaveTimer = null;
var _pendingPayload = null;  // 失焦时捕获的待发送数据
var _lastSaved = '';         // 上次保存的 payload 指纹（用于去重）

// 输入时防抖保存（5 秒无输入后触发。有变更才写，避免无效 R2 写入）
function autoSave() {
  clearTimeout(_autoSaveTimer);
  _autoSaveTimer = setTimeout(function () {
    var p = capturePayload();
    if (!p) return;
    var fp = fingerprint(p);
    if (fp !== _lastSaved) {
      _pendingPayload = p;
      flushPendingPayload();
    }
  }, 5000);
}

// 生成 payload 指纹（JSON 序列化，用于变更检测）
function fingerprint(p) {
  return JSON.stringify(p);
}

// 失焦时同步捕获数据，异步发送（不阻塞 click 导航）
function saveOnBlur() {
  clearTimeout(_autoSaveTimer);
  _pendingPayload = capturePayload();
  if (_pendingPayload) {
    setTimeout(function () { flushPendingPayload(); }, 0);
  }
}

// 同步捕获当前编辑区数据（V3 统一：module_id 驱动）
function capturePayload() {
  var moduleId = getModuleId();
  if (!moduleId) return null;

  var data = serializeSlots();
  return { moduleId: moduleId, mod: state.currentModule, slots: data.slots, free_content: data.free_content };
}

// 异步发送捕获的数据
function flushPendingPayload() {
  if (!_pendingPayload) return;
  var p = _pendingPayload;
  _pendingPayload = null;
  sendPayload(p);
}

var _saving = false;  // 防止并发 sendPayload 产生重复快照

// V3 统一保存：module_id → PUT /api/write/module/{id}
async function sendPayload(p) {
  if (_saving) { _pendingPayload = p; return; }
  _saving = true;
  try {
    var resp = await saveModule(p.moduleId, p.slots, p.free_content);
    if (resp && resp.ok) {
      _lastSaved = fingerprint(p);
    } else if (resp && resp.status === 409) {
      // 409 已在 saveModule 中静默处理（刷新后重试），不报错
      _lastSaved = fingerprint(p);
    } else {
      console.error('[sendPayload] FAILED mod=' + p.mod + (resp ? ' HTTP ' + (resp.status || '') : ' network'));
      _lastSaved = '';
    }
  } catch (e) {
    console.error('[sendPayload] FAILED mod=' + p.mod, e);
    _lastSaved = '';
  } finally {
    _saving = false;
    // 发送期间堆积的新 payload，立即发送
    if (_pendingPayload) {
      var next = _pendingPayload;
      _pendingPayload = null;
      sendPayload(next);
    }
  }
}

// Ctrl+S / 手动保存时同步执行
async function saveModuleContent(silent) {
  clearTimeout(_autoSaveTimer);
  _pendingPayload = null;
  var p = capturePayload();
  if (p) {
    await sendPayload(p);
    // fingerprint 在 sendPayload 成功后内部更新
  }
}

async function aiGenerateForModule() {
  var wid = state.currentWorkId;
  if (!wid) return;
  if (!confirm(t('prompt.ai_chapter_confirm'))) return; // TODO: per-module confirm messages

  var mid = getModuleId();
  if (state.currentModule === 'worldbuilding') {
    cacheClear([mid]);
    await hPost('/api/write/module/' + mid + '/generate', { work_id: wid, bilingual: typeof bilingual !== 'undefined' ? bilingual : true });
    loadM1();
  } else if (state.currentModule === 'outline') {
    cacheClear([mid]);
    await hPost('/api/write/module/' + mid + '/generate?overwrite=true', { work_id: wid, num_chapters: 5 });
    loadM2();
  } else if (state.currentModule === 'foreshadowing') {
    cacheClear([mid, 'm4_strategy_' + wid]);
    await hPost('/api/write/module/m4_strategy_' + wid + '/generate', { work_id: wid });
    loadM4();
  } else if ((state.currentModule === 'writing' || state.currentModule === 'chapters') && state.currentSectionId) {
    var data = await hPost('/api/write/draft/generate', { work_id: wid, section_id: state.currentSectionId });
    if (data && data.ok) showTextEditor(data.data.body || '');
  }
  refreshPipelineGuide(wid);
}

async function aiPolishForModule() {
  var wid = state.currentWorkId, sid = state.currentSectionId;
  if (!wid) return;
  if (state.currentModule === 'writing' && sid) {
    if (!confirm(t('prompt.ai_polish_confirm'))) return;
    var data = await hPost('/api/write/draft/polish', { work_id: wid, section_id: sid });
    if (data && data.ok) showTextEditor(data.data.body || '');
  } else {
    // 对于非 M6 模块，polish = 用当前编辑器内容调用
    StoryElf.toggle();
    var inp = document.getElementById('elf-chat-input');
    if (inp) { inp.value = t('prompt.ai_polish_confirm'); StoryElf.sendChat(); }
  }
}

async function generateOutline(workId) {
  if (!confirm(t('prompt.outline_confirm'))) return;
  cacheClear(['m2_' + workId]); // 大纲 regenerate 后缓存失效
  await hPost('/api/write/module/m2_' + workId + '/generate?overwrite=true', { work_id: workId, num_chapters: 5 });
  loadM6();
  refreshPipelineGuide(workId);
}

// ============================================================
// Markdown 渲染
// ============================================================
function renderBibleContent(md) {
  if (!md) return '';
  return md
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/^# (.+)$/gm, '<h2 class="bible-h1">$1</h2>')
    .replace(/^## (.+)$/gm, '<h3 class="bible-h2">$1</h3>')
    .replace(/^### (.+)$/gm, '<h4 class="bible-h3">$1</h4>')
    .replace(/^&gt; (.+)$/gm, '<blockquote class="bible-quote">$1</blockquote>')
    .replace(/<!-- (.+?) -->/g, '<span class="bible-comment">$1</span>')
    .replace(/^- \[([ x])\] (.+)$/gm, '<div class="bible-checklist"><input type="checkbox" $1disabled> $2</div>')
    .replace(/\n\n/g, '<br><br>').replace(/\n/g, '<br>');
}

// ============================================================
// Split Divider Drag
// ============================================================
function initSplitDrag() {
  var container = qs('#split-view');
  if (!container) return;

  // 分隔线 #1（左 | 中）：右栏不动，左和中分配剩余空间
  var d1 = qs('#split-divider-1');
  if (d1) {
    d1.addEventListener('mousedown', function (e) {
      e.preventDefault();
      d1.classList.add('active');
      var startX = e.clientX;
      var startLeft = state.leftPct;
      var fixedRight = 100 - state.leftPct - state.midPct; // 右栏不动
      function mv(ev) {
        var cw = container.offsetWidth;
        var delta = ((ev.clientX - startX) / cw) * 100;
        var newLeft = Math.max(15, Math.min(100 - fixedRight - 15, startLeft + delta));
        state.leftPct = newLeft;
        state.midPct = 100 - fixedRight - newLeft;
        applyGridColumns();
      }
      function up() {
        d1.classList.remove('active');
        document.removeEventListener('mousemove', mv);
        document.removeEventListener('mouseup', up);
        saveState();
      }
      document.addEventListener('mousemove', mv);
      document.addEventListener('mouseup', up);
    });
  }

  // 分隔线 #2（中 | 右）：左栏不动，中和右分配剩余空间
  var d2 = qs('#split-divider-2');
  if (d2) {
    d2.addEventListener('mousedown', function (e) {
      e.preventDefault();
      d2.classList.add('active');
      var startX = e.clientX;
      var startMid = state.midPct;
      var fixedLeft = state.leftPct; // 左栏不动
      function mv(ev) {
        var cw = container.offsetWidth;
        var delta = ((ev.clientX - startX) / cw) * 100;
        var newMid = Math.max(15, Math.min(100 - fixedLeft - 15, startMid + delta));
        state.midPct = newMid;
        applyGridColumns();
      }
      function up() {
        d2.classList.remove('active');
        document.removeEventListener('mousemove', mv);
        document.removeEventListener('mouseup', up);
        saveState();
      }
      document.addEventListener('mousemove', mv);
      document.addEventListener('mouseup', up);
    });
  }
}

var _panelMode = 'three'; // 'two' | 'three'

function applyGridColumns() {
  var container = qs('#split-view');
  if (!container) return;
  if (_panelMode === 'two') {
    container.style.gridTemplateColumns = state.leftPct + '% 8px ' + (100 - state.leftPct) + '% 0px 0%';
  } else {
    var right = 100 - state.leftPct - state.midPct;
    container.style.gridTemplateColumns = state.leftPct + '% 8px ' + state.midPct + '% 8px ' + Math.max(15, right) + '%';
  }
}

/** M0/M6 两栏模式 */
function setTwoPanelMode() {
  _panelMode = 'two';
  var d2 = qs('#split-divider-2');
  var right = qs('.split-right');
  if (d2) d2.style.display = 'none';
  if (right) right.style.display = 'none';
  applyGridColumns();
}

/** M1-M5 三栏模式 */
function setThreePanelMode() {
  _panelMode = 'three';
  var d2 = qs('#split-divider-2');
  var right = qs('.split-right');
  if (d2) d2.style.display = '';
  if (right) right.style.display = '';
  applyGridColumns();
}

// ============================================================
// Story Elf 行为覆盖
// ============================================================
StoryElf.setPage('write');
StoryElf.setActions([
  { label: '检', title: '检查', onClick: function () { StoryElf.toggle(); if (state.currentSectionId) loadLintToElf(); } },
  { label: '议', title: '建议', onClick: function () { StoryElf.toggle(); var inp = document.getElementById('elf-chat-input'); if (inp) { inp.value = t('prompt.ai_polish_confirm'); StoryElf.sendChat(); } } },
]);

StoryElf.sendChat = function () {
  var msg = StoryElf.getInput();
  if (!msg) return;
  StoryElf.addMessage(msg, 'user');
  StoryElf.clearInput();
  StoryElf.addMessage(t('label.ai_thinking'), 'ai');
  var ctx = StoryElf.getContext() || {};
  hPost('/api/write/elf/chat', {
    work_id: state.currentWorkId,
    section_id: state.currentSectionId || undefined,
    page: 'write',
    messages: [{ role: 'user', content: msg }],
    context: { module: state.currentModule, section_title: ctx.section_title || state.currentSectionTitle, panel: ctx.panel },
  }).then(function (data) {
    var msgs = document.getElementById('elf-chat-messages');
    var last = msgs && msgs.lastChild;
    if (last) last.remove();
    if (data && data.ok) {
      StoryElf.addMessage(data.data.reply, 'ai');
    } else {
      var err = document.createElement('div');
      err.className = 'elf-chat-msg ai';
      err.style.color = 'var(--error)';
      err.textContent = t('prompt.ai_unavailable');
      if (msgs) { msgs.appendChild(err); msgs.scrollTop = msgs.scrollHeight; }
    }
  });
};

async function loadLintToElf() {
  var wid = state.currentWorkId, sid = state.currentSectionId;
  if (!wid || !sid) return;
  StoryElf.addMessage(t('label.loading'), 'ai');
  var data = await hPost('/api/write/draft/check/' + wid + '/' + sid, {});
  var msgs = document.getElementById('elf-chat-messages');
  var last = msgs && msgs.lastChild;
  if (last) last.remove();
  if (data && data.ok) {
    var issues = data.data.issues || [];
    if (!issues.length) { StoryElf.addMessage(t('status.no_issues'), 'ai'); return; }
    issues.forEach(function (i) {
      StoryElf.addMessage((i.severity === 'error' ? '[' + t('status.error') + '] ' : '[' + t('status.warning') + '] ') + (i.description || ''), 'ai');
    });
  } else {
    StoryElf.addMessage(t('prompt.ai_unavailable'), 'ai');
  }
}

// ============================================================
// 初始化
// ============================================================
document.addEventListener('DOMContentLoaded', function () {
  qs('#global-nav').innerHTML = renderNav();
  loadState();
  initSplitDrag();

  // === 保存策略：失焦即存（主）+ 输入防抖（辅）+ Ctrl+S ===
  // 输入时防抖保存（打字中途也存，防止浏览器崩溃丢失）
  qs('#writing-editor').addEventListener('input', autoSave);
  qs('#slot-editor').addEventListener('input', function (e) {
    if (e.target.tagName === 'TEXTAREA') autoSave();
  });
  qs('#slot-free-area').addEventListener('input', autoSave);
  qs('#form-editor').addEventListener('input', function (e) {
    if (e.target.tagName === 'TEXTAREA' || e.target.tagName === 'INPUT') autoSave();
  });

  // 失焦立即保存（切换模块/卡片/章节/点击别处 → textarea 失焦 → 触发保存）
  qs('#writing-editor').addEventListener('focusout', function (e) {
    if (e.target.tagName === 'TEXTAREA') saveOnBlur();
  });
  qs('#slot-editor').addEventListener('focusout', function (e) {
    if (e.target.tagName === 'TEXTAREA') saveOnBlur();
  });
  qs('#slot-free-area').addEventListener('focusout', function (e) {
    if (e.target.tagName === 'TEXTAREA') saveOnBlur();
  });
  qs('#form-editor').addEventListener('focusout', function (e) {
    if (e.target.tagName === 'TEXTAREA' || e.target.tagName === 'INPUT') saveOnBlur();
  });

  document.addEventListener('keydown', function (e) {
    if ((e.ctrlKey || e.metaKey) && e.key === 's') { e.preventDefault(); saveModuleContent(); }
  });

  // Story Elf Hint 对话泡：槽位聚焦 → 打字机呈现 hint；blur → 淡出
  var slotEditor = qs('#slot-editor');
  var _hintBlurTimer = null;
  if (slotEditor) {
    slotEditor.addEventListener('focusin', function (e) {
      var ta = e.target;
      if (ta.tagName === 'TEXTAREA' && ta.dataset.hint) {
        if (_hintBlurTimer) { clearTimeout(_hintBlurTimer); _hintBlurTimer = null; }
        StoryElf.showHintBubble(ta.dataset.hint, { slotId: ta.dataset.slotId || '' });
      }
    });
    slotEditor.addEventListener('focusout', function (e) {
      if (e.target.tagName === 'TEXTAREA') {
        _hintBlurTimer = setTimeout(function () {
          _hintBlurTimer = null;
          StoryElf.hideHintBubble();
        }, 150);
      }
    });
  }

  // 自由编辑区 hint（与槽位 hint 同样的机制）
  var freeArea = qs('#slot-free-area');
  if (freeArea) {
    freeArea.addEventListener('focusin', function (e) {
      var ta = e.target;
      if (ta.tagName === 'TEXTAREA' && ta.dataset.hint) {
        if (_hintBlurTimer) { clearTimeout(_hintBlurTimer); _hintBlurTimer = null; }
        StoryElf.showHintBubble(ta.dataset.hint, { slotId: 'free-zone' });
      }
    });
    freeArea.addEventListener('focusout', function (e) {
      if (e.target.tagName === 'TEXTAREA') {
        _hintBlurTimer = setTimeout(function () {
          _hintBlurTimer = null;
          StoryElf.hideHintBubble();
        }, 150);
      }
    });
  }

  if (typeof userToken !== 'undefined' && userToken) loadWorkspaces();
});
