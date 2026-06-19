/**
 * Story Forger — 写作桌主逻辑
 *
 * 覆盖需求:
 *   SF-061: 写作桌界面 — Pipeline 导航 (M0-M6) + 左右分栏（左=结构化参考，右=编辑区）
 *           Pipeline 胶囊点击切换模块，左栏按模块呈现参考内容，右栏统一编辑器
 *   SF-062: 左右分栏系统 — 分隔线拖拽调整比例（25%~65%），位置持久化 localStorage
 *           默认 40:60，虚线分隔（上下留空）
 *   SF-064: 槽位编辑器引擎（v2.5 JSON 化）— 模板框架只读渲染 + 槽位 textarea 可编辑
 *           前端直接消费 API JSON template.slots 结构渲染 DOM
 *           中栏独立自由编辑区（free_content 字段）
 *   SF-065: 重复结构支持 — 同类条目 [+] 追加 / [×] 删除按钮
 *   SF-066: M5 意图卡槽位编辑器 — INTENT_TEMPLATE 14 slot 统一槽位编辑
 *   SF-068: 模板分级系统 — 按 SlotDef.level (L1/L2) 过滤可见性，Pipeline 右侧 L1/L2 切换按钮
 *   SF-063: 写作引导流程 — ⏳ 待实现（Pipeline 状态指示）
 *
 * 依赖: write-api.js (HTTP 层), story-elf.js (AI 伴侣)
 */


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
  leftPct: 33,            // 左栏百分比
  midPct: 34,             // 中栏百分比，右栏 = 100 - left - mid
  leftPanelUpperPct: 40,  // 左栏上半部百分比 (卡片区)
};

function loadState() {
  try {
    var saved = JSON.parse(localStorage.getItem('sf_desk_v3') || '{}');
    Object.assign(state, { chapterFilter: 'all', leftPct: 33, midPct: 34, leftPanelUpperPct: 40 }, saved);
  } catch (e) {}
}
function saveState() {
  try {
    localStorage.setItem('sf_desk_v3', JSON.stringify({
      leftPct: state.leftPct,
      midPct: state.midPct,
      chapterFilter: state.chapterFilter,
      leftPanelUpperPct: state.leftPanelUpperPct,
    }));
  } catch (e) {}
}

// 用户级配置 — 从 R2 加载 / 保存到 R2（跨设备持久化）
async function loadUserConfig() {
  if (!userToken) return;
  var data = await hGet('/api/write/me/config');
  if (data && data.ok && data.data && data.data.current_work_id) {
    state.currentWorkId = data.data.current_work_id;
  }
}

async function saveUserConfig() {
  if (!userToken) return;
  await hPut('/api/write/me/config', { current_work_id: state.currentWorkId || null });
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
// Workspace — 作品集（浮出层替代 <select> 下拉框）
// ============================================================
var _worksList = [];

// 打开作品集浮出层
function openWorkspaceModal() {
  var overlay = qs('#workspace-overlay');
  if (overlay) overlay.style.display = 'flex';
  loadWorkspaces();
}

// 关闭作品集浮出层（点击遮罩关闭）
function closeWorkspaceModal(e) {
  if (e && e.target !== e.currentTarget) return;
  var overlay = qs('#workspace-overlay');
  if (overlay) overlay.style.display = 'none';
  cancelNewWork();
}

// 加载作品列表 → 渲染卡片（autoSelect: 仅在初始加载时恢复作品选择）
async function loadWorkspaces(autoSelect) {
  var grid = qs('#ws-card-grid');
  if (!grid) return;
  grid.innerHTML = '<div class="loading" style="padding:2rem;text-align:center;color:var(--text-muted)">' + t('label.loading') + '</div>';

  var data = await hGet('/api/write/works');
  if (!data || !data.ok) {
    grid.innerHTML = '<div class="ws-card-empty">' + t('label.load_failed') + '</div>';
    return;
  }
  _worksList = data.data || [];
  renderWorkspaceCards();

  // 仅在初始页面加载时恢复上次选择的作品，模态框打开时不触发
  if (autoSelect && _worksList.length > 0) {
    var targetId = state.currentWorkId;
    // 检查上次选择的作品是否仍在列表中，否则回退第一个
    var found = targetId && _worksList.some(function (w) { return w.id === targetId; });
    if (!found) targetId = _worksList[0].id;
    onWorkspaceChange(targetId);
  }
}

// 渲染作品卡片
function renderWorkspaceCards() {
  var grid = qs('#ws-card-grid');
  if (!grid) return;

  if (_worksList.length === 0) {
    grid.innerHTML = '<div class="ws-card-empty">' + t('label.no_works') + '</div>';
    return;
  }

  var html = '';
  _worksList.forEach(function (w) {
    var isActive = state.currentWorkId === w.id;
    var statusLabel = { draft: '草稿', published: '已发布', closed: '草稿' }[w.status] || w.status;
    html += '<div class="ws-card' + (isActive ? ' active' : '') + '" onclick="onWorkspaceChange(\'' + w.id + '\')">'
      + '<button class="ws-card-menu-btn" onclick="event.stopPropagation();toggleCardMenu(event,\'' + w.id + '\')" title="' + t('action.edit') + '">⋯</button>'
      + '<div class="ws-card-title">' + escHtml(w.title) + '</div>'
      + '<div class="ws-card-meta">'
        + '<span class="ws-card-status ' + w.status + '">' + statusLabel + '</span>'
      + '</div>'
      + '</div>';
  });
  grid.innerHTML = html;
  updateWorkspaceBtn();
}

// — 卡片菜单（三点按钮） —
var _menuWorkId = null;

function toggleCardMenu(event, workId) {
  event.stopPropagation();
  var menu = qs('#ws-card-menu');
  if (!menu) return;

  // 已打开同一菜单 → 关闭
  if (_menuWorkId === workId && menu.style.display === 'block') {
    closeCardMenu();
    return;
  }

  _menuWorkId = workId;
  var w = _worksList.find(function (x) { return x.id === workId; });
  if (!w) return;

  // 定位菜单
  var btn = event.currentTarget;
  var btnRect = btn.getBoundingClientRect();
  var modal = qs('.ws-modal');
  var modalRect = modal.getBoundingClientRect();
  menu.style.top = (btnRect.top - modalRect.top + 4) + 'px';
  menu.style.left = Math.min(btnRect.right - modalRect.left - 180, modalRect.width - 190) + 'px';
  menu.style.display = 'block';

  // 渲染菜单项
  cancelEditTitle();
  renderCardMenuItems(w);

  // 点击其他地方关闭
  setTimeout(function () { document.addEventListener('click', closeCardMenu, { once: true }); }, 0);
}

function closeCardMenu() {
  var menu = qs('#ws-card-menu');
  if (menu) { menu.style.display = 'none'; cancelEditTitle(); }
  _menuWorkId = null;
}

function renderCardMenuItems(w) {
  var itemsEl = qs('#ws-card-menu-items');
  var editEl = qs('#ws-card-menu-edit');
  if (!itemsEl || !editEl) return;
  editEl.style.display = 'none';
  itemsEl.style.display = '';

  var html = '';
  // 编辑名称
  html += '<button class="ws-card-menu-item" onclick="editTitle()">' + t('ws.edit_title') + '</button>';

  // 状态切换（仅双态：草稿 ↔ 已发布）
  var statusActions = {
    draft:     { label: t('ws.publish_work') },
    published: { label: t('ws.unpublish_work') },
    closed:    { label: t('ws.publish_work') }, // 遗留 closed 视为草稿
  };
  var action = statusActions[w.status];
  if (action) {
    html += '<button class="ws-card-menu-item" onclick="changeWorkStatus(\'' + w.id + '\',\'' + w.status + '\')">' + action.label + '</button>';
  }

  // 分隔线 + 删除
  html += '<div class="ws-card-menu-divider"></div>';
  html += '<button class="ws-card-menu-item ws-card-menu-item-danger" onclick="deleteWork(\'' + w.id + '\')">' + t('ws.delete_work') + '</button>';

  itemsEl.innerHTML = html;
}

// — 编辑标题 —
var _editingWorkId = null;

function editTitle() {
  _editingWorkId = _menuWorkId;
  var w = _worksList.find(function (x) { return x.id === _menuWorkId; });
  if (!w) return;
  var itemsEl = qs('#ws-card-menu-items');
  var editEl = qs('#ws-card-menu-edit');
  var inp = qs('#ws-card-menu-edit-input');
  if (!itemsEl || !editEl || !inp) return;
  itemsEl.style.display = 'none';
  editEl.style.display = '';
  inp.value = w.title;
  setTimeout(function () { inp.focus(); inp.select(); }, 50);
}

function cancelEditTitle() {
  _editingWorkId = null;
  var editEl = qs('#ws-card-menu-edit');
  if (editEl) editEl.style.display = 'none';
  var itemsEl = qs('#ws-card-menu-items');
  if (itemsEl) itemsEl.style.display = '';
}

async function confirmEditTitle() {
  var inp = qs('#ws-card-menu-edit-input');
  if (!inp || !_editingWorkId) return;
  var newTitle = inp.value.trim();
  if (!newTitle) { inp.focus(); return; }

  var data = await hPut('/api/write/works/' + _editingWorkId, { title: newTitle });
  if (data && data.ok) {
    // 更新本地缓存
    var w = _worksList.find(function (x) { return x.id === _editingWorkId; });
    if (w) w.title = newTitle;
    closeCardMenu();
    renderWorkspaceCards();
  } else {
    alert(t('ws.update_failed'));
  }
}

// — 修改状态（双态：草稿 ↔ 已发布） —
async function changeWorkStatus(workId, currentStatus) {
  var endpoint;
  var newStatus;
  if (currentStatus === 'draft' || currentStatus === 'closed') {
    endpoint = '/api/write/works/' + workId + '/publish';
    newStatus = 'published';
  } else if (currentStatus === 'published') {
    endpoint = '/api/write/works/' + workId + '/close';
    newStatus = 'draft';
  } else return;

  closeCardMenu();
  var data = await hPatch(endpoint);
  if (data && data.ok) {
    var w = _worksList.find(function (x) { return x.id === workId; });
    if (w) w.status = (data.data && data.data.status) ? data.data.status : newStatus;
    renderWorkspaceCards();
  } else {
    alert(t('ws.update_failed') + (data && data.error ? ': ' + data.error : ''));
  }
}

// — 删除作品 —
async function deleteWork(workId) {
  closeCardMenu();
  var w = _worksList.find(function (x) { return x.id === workId; });
  var title = w ? w.title : workId;
  if (!confirm(t('ws.delete_confirm').replace('{title}', title))) return;

  var data = await hDelete('/api/write/works/' + workId);
  if (data && data.ok) {
    _worksList = _worksList.filter(function (x) { return x.id !== workId; });
    // 如果删除的是当前作品，清空状态
    if (state.currentWorkId === workId) {
      state.currentWorkId = null;
      saveUserConfig();
      qs('#split-view').style.display = 'none';
      qs('#pipeline-guide').style.display = 'none';
    }
    renderWorkspaceCards();
  } else {
    var errMsg = '';
    if (data && data.error) {
      // 根据错误码查 i18n 表，找不到则 fallback 到后端返回的 message
      if (data.error.code === 'WORK_STATUS_CONFLICT') {
        errMsg = t('ws.error_published_delete');
      } else {
        errMsg = data.error.message;
      }
    }
    alert(t('ws.delete_failed') + (errMsg ? ': ' + errMsg : ''));
  }
}

// 更新 pipeline bar 按钮文字为当前作品名
function updateWorkspaceBtn() {
  var btn = qs('#workspace-btn');
  if (!btn) return;
  if (state.currentWorkId) {
    var w = _worksList.find(function (x) { return x.id === state.currentWorkId; });
    btn.textContent = w ? w.title : t('label.select_work');
    btn.classList.toggle('has-work', !!w);
  } else {
    btn.textContent = t('label.select_work');
    btn.classList.remove('has-work');
  }
}

// 选择作品 — 与原 onWorkspaceChange() 逻辑完全一致，仅改为接收 workId 参数
async function onWorkspaceChange(workId) {
  if (!workId) {
    qs('#split-view').style.display = 'none';
    qs('#pipeline-guide').style.display = 'none';
    return;
  }
  // 同一作品 — 仅当浮出层打开时关闭它，不重复加载
  if (state.currentWorkId === workId) {
    var overlay = qs('#workspace-overlay');
    if (overlay && overlay.style.display !== 'none') {
      closeWorkspaceModal();
      return;
    }
    // 浮出层未打开（初始加载恢复）→ 继续完整加载流程
  }

  // 1. 先保存当前作品的内容（此时 state.currentWorkId 仍是旧作品）
  clearTimeout(_autoSaveTimer);
  var p = capturePayload();
  if (p) await sendPayload(p);

  // 2. 切换到新作品
  state.currentWorkId = workId;
  state.currentModule = null;  // 阻止 switchModule 内部重复保存（capturePayload 返回 null）
  _lastSaved = '';
  saveUserConfig();
  StoryElf.loadConversation(workId, 'write');
  qs('#split-view').style.display = 'grid';
  applyGridColumns();
  _cacheReady = false;

  // 更新 UI + 关闭浮出层
  updateWorkspaceBtn();
  renderWorkspaceCards();
  closeWorkspaceModal();

  refreshPipelineGuide(workId);
  preWarmCache(workId);
  await switchModule('original_concept');
  updateElfContext();
}

// — 新增作品 —
function showNewWorkInput() {
  var row = qs('#ws-new-work-row');
  if (row) { row.style.display = 'flex'; }
  var inp = qs('#ws-new-work-input');
  if (inp) { inp.value = ''; setTimeout(function () { inp.focus(); }, 100); }
}

function cancelNewWork() {
  var row = qs('#ws-new-work-row');
  if (row) row.style.display = 'none';
  var inp = qs('#ws-new-work-input');
  if (inp) inp.value = '';
}

async function createNewWork() {
  var inp = qs('#ws-new-work-input');
  if (!inp) return;
  var title = inp.value.trim();
  if (!title) { inp.focus(); return; }

  // 从 token 推导默认作者名（格式如 "CAU-TuringCorp-13572468" → "TuringCorp"）
  var author = localStorage.getItem('sf_author_name');
  if (!author && userToken) {
    var parts = userToken.split('-');
    author = parts.length >= 2 ? parts[1] : 'CAU Author';
  } else if (!author) {
    author = 'CAU Author';
  }

  inp.disabled = true;
  var confirmBtn = qs('.ws-new-work-confirm');
  if (confirmBtn) { confirmBtn.disabled = true; confirmBtn.textContent = t('label.creating'); }

  var data = await hPost('/api/write/works', { title: title, author: author });
  if (data && data.ok) {
    localStorage.setItem('sf_author_name', author);
    cancelNewWork();
    await loadWorkspaces();
    if (data.data && data.data.id) onWorkspaceChange(data.data.id);
  } else {
    inp.disabled = false;
    if (confirmBtn) { confirmBtn.disabled = false; confirmBtn.textContent = t('action.confirm'); }
    alert(t('prompt.create_failed') + ((data && data.error) ? data.error : ''));
  }
}

var _cacheReady = false;

async function preWarmCache(workId) {
  var singletons = ['m0', 'm1', 'm2'];
  var cardLists = ['m3_card', 'm4_card', 'm5_intent', 'm6_chapter'];

  // 检查全部模块是否已在 localStorage 中有缓存（如之前访问过该作品）
  var miss = false;
  var sKeys = singletons.map(function (t) { return t + '_' + workId; });
  var cKeys = cardLists.map(function (t) { return 'list_' + workId + '_' + t; });
  var allKeys = sKeys.concat(cKeys);
  for (var i = 0; i < allKeys.length; i++) {
    if (!cacheGet(allKeys[i])) { miss = true; break; }
  }

  if (!miss) {
    // 全部命中 localStorage → 无需 API 请求，直接恢复
    _cacheReady = true;
    return;
  }

  await Promise.all(
    singletons.map(function (t) { return loadModule(t + '_' + workId); })
      .concat(cardLists.map(function (t) { return loadModuleList(workId, t); }))
  );
  _cacheReady = true;
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
// 模块数据缓存 —— 内存 + localStorage (per workId) 双层缓存
// 切作品不清 localStorage，切回来时秒恢复，无需重复 API 请求
// ============================================================
var _moduleCache = {};

function _lsKey() {
  return 'sf_pipe_' + (state.currentWorkId || '');
}

function cacheGet(key) {
  // 1. 内存命中
  if (_moduleCache[key]) return _moduleCache[key];
  // 2. localStorage 恢复（切回之前访问过的作品时）
  try {
    var stored = JSON.parse(localStorage.getItem(_lsKey()) || '{}');
    if (stored.d && stored.d[key]) {
      _moduleCache[key] = stored.d[key];
      return stored.d[key];
    }
  } catch (_) {}
  return null;
}

function cacheSet(key, data) {
  if (!data) return;
  _moduleCache[key] = data;
  // 同步写 localStorage（per workId，不阻塞 UI）
  try {
    var ck = _lsKey();
    if (!ck) return;
    var stored = JSON.parse(localStorage.getItem(ck) || '{}');
    stored.d = stored.d || {};
    stored.d[key] = data;
    stored.ts = Date.now();
    localStorage.setItem(ck, JSON.stringify(stored));
  } catch (_) {}
}

function cacheClear(keys) {
  // 无参数 = 数据变更导致当前作品缓存全部失效：内存 + localStorage 同步清除
  if (!keys) {
    _moduleCache = {};
    try { if (state.currentWorkId) localStorage.removeItem(_lsKey()); } catch (_) {}
    return;
  }
  // 指定 key = 精确失效（AI 生成/保存失败等）：内存 + localStorage 同步清除
  (keys || []).forEach(function (k) {
    delete _moduleCache[k];
    try {
      var ck = _lsKey();
      if (!ck) return;
      var stored = JSON.parse(localStorage.getItem(ck) || '{}');
      if (stored.d) { delete stored.d[k]; localStorage.setItem(ck, JSON.stringify(stored)); }
    } catch (_) {}
  });
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
    case 'foreshadowing':    return state.currentFhId ? 'm4_card_' + state.currentFhId : null;
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
async function saveModule(moduleId, slots, freeContent) {
  var cached = cacheGet(moduleId);
  var body = { slots: slots || {}, free_content: freeContent || '' };
  if (cached && cached.data) {
    if (cached.data.slots) body._prev_slots = cached.data.slots;
    if (cached.data.free_content !== undefined) body._prev_free_content = cached.data.free_content;
  }
  var resp = await hPut('/api/write/module/' + moduleId, body);
  if (resp && resp.ok) {
    cacheSet(moduleId, resp);
  } else {
    cacheClear([moduleId]);
  }
  return resp;
}

// 加载 ModuleList
async function loadModuleList(workId, type) {
  var cacheKey = 'list_' + workId + '_' + type;
  var cached = cacheGet(cacheKey);
  if (cached) return cached;
  var data = await hGet('/api/write/modules?work_id=' + workId + '&type=' + type);
  if (data && data.ok) { cacheSet(cacheKey, data); return data; }
  return null;
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
      // Section heading（Markdown → HTML，加 ## 前缀确保渲染为 h2 获得色块背景样式）
      if (section.heading) {
        var hDiv = document.createElement('div');
        hDiv.className = 'slot-framework';
        try { hDiv.innerHTML = marked.parse('## ' + section.heading); } catch(e) { hDiv.textContent = section.heading; }
        // Collapse/expand toggle icon on the h2 (一级目录 only)
        var h2 = hDiv.querySelector('h2');
        if (h2) {
          var collapseIcon = document.createElement('span');
          collapseIcon.className = 'slot-framework-collapse-icon';
          collapseIcon.textContent = '−';
          h2.appendChild(collapseIcon);
          h2.addEventListener('click', function (e) {
            e.stopPropagation();
            secDiv.classList.toggle('slot-section-collapsed');
            collapseIcon.textContent = secDiv.classList.contains('slot-section-collapsed') ? '+' : '−';
          });
        }
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
}

// 渲染单个 slot — Preview (Markdown 渲染) / Edit (纯文本) 切换
// 默认 Preview：点击 → Edit；blur → 回到 Preview
function renderSlotItem(parent, slot) {
  var item = document.createElement('div');
  item.className = 'slot-item';

  // 有 label 则渲染为 ### heading（h3 青色样式）
  if (slot.label) {
    var lblDiv = document.createElement('div');
    lblDiv.className = 'slot-framework';
    try { lblDiv.innerHTML = marked.parse('### ' + slot.label); } catch(e) { lblDiv.textContent = slot.label; }
    item.appendChild(lblDiv);
  }

  // Preview div（Markdown 渲染）
  var preview = document.createElement('div');
  preview.className = 'slot-preview';
  var rawContent = slot.content || '';
  try { preview.innerHTML = rawContent ? marked.parse(rawContent) : '<span class=\"slot-preview-empty\"></span>'; } catch(e) { preview.textContent = rawContent; }
  item.appendChild(preview);

  // Textarea（隐藏，点击 preview 时切换）
  var ta = document.createElement('textarea');
  ta.className = 'slot-textarea';
  ta.value = rawContent;
  ta.dataset.slotId = slot.id || '';
  if (slot.hint) ta.dataset.hint = slot.hint;
  ta.style.display = 'none';
  item.appendChild(ta);

  // 点击 Preview → 切到 Edit（光标自动置于末尾，后续优化光标定位）
  preview.addEventListener('click', function () {
    ta.rows = Math.max(2, Math.min(12, (ta.value || '').split('\n').length));
    preview.style.display = 'none';
    ta.style.display = '';
    ta.focus();
  });

  // 离开 Edit → 切回 Preview
  ta.addEventListener('blur', function () {
    var newRaw = ta.value;
    try { preview.innerHTML = newRaw ? marked.parse(newRaw) : '<span class=\"slot-preview-empty\"></span>'; } catch(e) { preview.textContent = newRaw; }
    preview.style.display = '';
    ta.style.display = 'none';
  });

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
  setLeftPanelMode('full');

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
  setLeftPanelMode('full');
  var data = await loadModule('m1_' + state.currentWorkId);
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
  setLeftPanelMode('full');
  var data = await loadModule('m2_' + state.currentWorkId);
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
  setLeftPanelMode('split');
  showTextEditor('');

  await renderEntityCardList();
  // 默认选中第一个角色
  var first = qs('#left-upper .card-item[data-entity-id]');
  if (first) first.click();
}

async function renderEntityCardList() {
  var left = qs('#left-upper');
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
  qsa('#left-upper .card-item[data-entity-id]').forEach(function (el) {
    el.classList.toggle('active', el.dataset.entityId === entityId);
  });
  updateElfContext();
}

// ============================================================
// M4: 伏笔卡 — 纯卡片模块（策略总览已合并到 M2 第六节）
// ============================================================
async function loadM4() {
  setLeftPanelMode('split');
  showTextEditor('');

  await renderFhCardList();
  var first = qs('#left-upper .card-item[data-entity-id]');
  if (first) first.click();
}

async function renderFhCardList() {
  var left = qs('#left-upper');
  left.innerHTML = '';
  var data = await loadModuleList(state.currentWorkId, 'm4_card');
  left.innerHTML = '';
  if (!data || !data.ok) { left.appendChild(errorHTML(t('label.load_failed'))); return; }

  var entities = (data.data.modules || []).map(function (m) { return { id: m.id.replace('m4_card_', ''), name: m.name, type: 'foreshadowing' }; });

  var frag = document.createDocumentFragment();

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
  qsa('#left-upper .card-item[data-entity-id]').forEach(function (el) {
    el.classList.toggle('active', el.dataset.entityId === entityId);
  });
  updateElfContext();
}

// ============================================================
// M5 / M6: 章节蓝图 / 逐章编写
// ============================================================
async function loadM5() {
  setLeftPanelMode('split');
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
  var first = qs('#left-upper .chapter-card[data-section-id]');
  if (first) first.click();
}

async function loadM6() {
  setLeftPanelMode('split');
  setTwoPanelMode();
  showTextEditor(''); // 占位，openChapter 会填入内容

  await loadChapterCardList();
  var first = qs('#left-upper .chapter-card[data-section-id]');
  if (first) first.click();
}

async function loadChapterCardList() {
  var left = qs('#left-upper');
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
  qsa('#left-upper .card-item').forEach(function (item) {
    item.addEventListener('dragstart', function (e) { _dragSrc = item.dataset.sectionId; item.classList.add('dragging'); e.dataTransfer.effectAllowed = 'move'; });
    item.addEventListener('dragend', function () { item.classList.remove('dragging'); qsa('#left-upper .card-item').forEach(function (i) { i.classList.remove('drag-over'); }); });
    item.addEventListener('dragover', function (e) { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; if (item.dataset.sectionId !== _dragSrc) item.classList.add('drag-over'); });
    item.addEventListener('dragleave', function () { item.classList.remove('drag-over'); });
    item.addEventListener('drop', async function (e) {
      e.preventDefault(); item.classList.remove('drag-over');
      var tid = item.dataset.sectionId;
      if (_dragSrc === tid) return;
      // V4: 章节重排待适配 module API (GET/PUT /api/write/module/m2_{workId})
      // 旧 outline 端点格式(sections数组)与 module slots 格式不兼容
      console.warn('章节重排功能待适配 V4 module API');
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

StoryElf.sendChat = function () {
  var msg = StoryElf.getInput();
  if (!msg) return;
  clearTimeout(_autoSaveTimer);
  StoryElf.addMessage(msg, 'user');
  StoryElf.clearInput();
  var currentMessages = StoryElf.getMessages();
  // 立即显示工作块，不等后端首次响应（避免 10-20s 空白等待）
  StoryElf.initWorkingBlock();
  var ctx = StoryElf.getContext() || {};
  var reqBody = {
    work_id: state.currentWorkId,
    section_id: state.currentSectionId || undefined,
    page: 'write',
    messages: currentMessages,
    context: { module: state.currentModule, section_title: ctx.section_title || state.currentSectionTitle, panel: ctx.panel },
  };

  // SSE 流式请求
  var token = localStorage.getItem('cau_token') || '';
  fetch('/api/write/elf/chat?lang=' + (localStorage.getItem('sf_lang') || 'zh'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
    body: JSON.stringify(reqBody),
  }).then(function (response) {
    if (!response.ok) {
      // 非流式错误 — 后端在 setup 阶段就失败了
      return response.json().then(function (errData) {
        StoryElf.finishWorkingBlock();
        var msgs = document.getElementById('elf-chat-messages');
        var errDiv = document.createElement('div');
        errDiv.className = 'elf-chat-msg ai';
        errDiv.style.color = 'var(--error)';
        errDiv.textContent = t('prompt.ai_unavailable');
        if (msgs) { msgs.appendChild(errDiv); msgs.scrollTop = msgs.scrollHeight; }
      });
    }

    // SSE 流 — 逐步消费事件
    var reader = response.body.getReader();
    var decoder = new TextDecoder();
    var buffer = '';
    var msgs = document.getElementById('elf-chat-messages');

    function pump() {
      return reader.read().then(function (_a) {
        var done = _a.done, value = _a.value;
        if (done) return;

        buffer += decoder.decode(value, { stream: true });
        // 按双换行分割 SSE 事件
        var parts = buffer.split('\n\n');
        buffer = parts.pop() || ''; // 最后一个可能不完整

        parts.forEach(function (part) {
          if (!part.trim()) return;
          var lines = part.split('\n');
          var eventType = '';
          var dataStr = '';
          lines.forEach(function (line) {
            if (line.startsWith('event: ')) eventType = line.slice(7);
            if (line.startsWith('data: ')) dataStr = line.slice(6);
          });
          if (!dataStr) return;

          try {
            var data = JSON.parse(dataStr);

            if (eventType === 'step') {
              StoryElf.appendStep(data);
            } else if (eventType === 'done') {
              // 最终回复
              StoryElf.finishWorkingBlock();
              StoryElf.addMessage(data.reply, 'assistant');
              if (msgs) msgs.scrollTop = msgs.scrollHeight;
            } else if (eventType === 'error') {
              StoryElf.finishWorkingBlock();
              var errDiv = document.createElement('div');
              errDiv.className = 'elf-chat-msg ai';
              errDiv.style.color = 'var(--error)';
              errDiv.textContent = t('prompt.ai_unavailable');
              if (msgs) { msgs.appendChild(errDiv); msgs.scrollTop = msgs.scrollHeight; }
            }
          } catch (e) { /* JSON 解析失败，跳过 */ }
        });

        return pump(); // 继续读取
      }).catch(function (_err) {
        // 流中断
        StoryElf.finishWorkingBlock();
      });
    }

    return pump();
  }).catch(function () {
    StoryElf.finishWorkingBlock();
    StoryElf.addMessage(t('prompt.ai_unavailable'), 'assistant');
  });
};

// ============================================================
// 左栏垂直分割 — 通过共享工厂创建（createLeftPanelSplit 定义在 app.js）
// ============================================================
var _leftPanel = createLeftPanelSplit({
  getPct: function () { return state.leftPanelUpperPct; },
  setPct: function (v) { state.leftPanelUpperPct = v; },
  onSave: saveState,
});

function setLeftPanelMode(mode) { _leftPanel.setMode(mode); }
function applyLeftPanelSplit() { _leftPanel.applySplit(); }
function initLeftPanelHDrag() { _leftPanel.initDrag(); }

// ============================================================
// 初始化
// ============================================================
document.addEventListener('DOMContentLoaded', async function () {
  qs('#global-nav').innerHTML = renderNav();
  if (typeof CAU !== 'undefined') CAU.updateLoginButton();
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

  // 将 Story Elf 嵌入左栏下半部
  var lower = qs('#left-lower');
  if (lower) StoryElf.mount(lower);
  initLeftPanelHDrag();
  setLeftPanelMode('full'); // 初始默认（作品未选择时）

  if (typeof userToken !== 'undefined' && userToken) {
    await loadUserConfig();
    loadWorkspaces(true); // 初始加载时恢复上次作品
  }
});
