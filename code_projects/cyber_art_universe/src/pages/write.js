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
  aiDrawerOpen: true,       // AI Drawer 默认展开
  kbActiveL1: null,         // 当前选中的一级标签索引
  kbActiveL2: null,         // 当前选中的二级标签索引
};

function loadState() {
  try {
    var saved = JSON.parse(localStorage.getItem('sf_desk_v3') || '{}');
    Object.assign(state, { chapterFilter: 'all', aiDrawerOpen: true, kbActiveL1: null, kbActiveL2: null }, saved);
  } catch (e) {}
}
function saveState() {
  try {
    localStorage.setItem('sf_desk_v3', JSON.stringify({
      chapterFilter: state.chapterFilter,
      aiDrawerOpen: state.aiDrawerOpen,
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
      qs('#main-canvas').style.display = 'none';
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
    qs('#main-canvas').style.display = 'none';
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
  saveUserConfig();
  StoryElf.loadConversation(workId, 'write');
  qs('#main-canvas').style.display = 'flex';
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

  // 切换前保存当前模块（异步发，不阻塞 UI；saveModule 做 slot 级 diff 判断是否真的变更）
  clearTimeout(_autoSaveTimer);
  var p = capturePayload();
  if (p) {
    _pendingPayload = p;
    flushPendingPayload();  // 异步发送，不 await
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
  generateKBTabs();  // 生成知识库标签
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
  // 2. localStorage 恢复（带 24h TTL 过期检查）
  try {
    var stored = JSON.parse(localStorage.getItem(_lsKey()) || '{}');
    if (stored.d && stored.d[key]) {
      // 超过 24 小时则视为过期，清理并返回 null
      if (stored.ts && (Date.now() - stored.ts > 86400000)) {
        delete stored.d[key];
        localStorage.setItem(_lsKey(), JSON.stringify(stored));
        return null;
      }
      _moduleCache[key] = stored.d[key];
      return stored.d[key];
    }
  } catch (_) {}
  return null;
}

// 缓存写入：
//   cacheSet(moduleId, fullData)         — 完整模块数据
//   cacheSet(moduleId, slotId, content)   — 只更新一个 slot 的内容
//   cacheSet(moduleId, slotId, content, timestamp) — 同时更新 slot 内容 + 时间戳
function cacheSet(moduleId, data, slotId, timestamp) {
  if (slotId !== undefined) {
    // Slot 级写入：原地更新缓存中该 slot 的内容（和时间戳，如果给了）
    var existing = _moduleCache[moduleId];
    if (!existing || !existing.data) return;
    if (!existing.data.slots) existing.data.slots = {};
    existing.data.slots[slotId] = data;
    if (timestamp !== undefined) {
      if (!existing.data.slot_timestamps) existing.data.slot_timestamps = {};
      existing.data.slot_timestamps[slotId] = timestamp;
    }
    // 同步 localStorage
    try {
      var ck = _lsKey();
      if (!ck) return;
      var stored = JSON.parse(localStorage.getItem(ck) || '{}');
      if (stored.d && stored.d[moduleId] && stored.d[moduleId].data) {
        var sd = stored.d[moduleId].data;
        if (!sd.slots) sd.slots = {};
        sd.slots[slotId] = data;
        if (timestamp !== undefined) {
          if (!sd.slot_timestamps) sd.slot_timestamps = {};
          sd.slot_timestamps[slotId] = timestamp;
        }
        stored.ts = Date.now();
        localStorage.setItem(ck, JSON.stringify(stored));
      }
    } catch (_) {}
    return;
  }

  // 完整模块数据写入
  if (!data) return;
  _moduleCache[moduleId] = data;
  try {
    var ck2 = _lsKey();
    if (!ck2) return;
    var s = JSON.parse(localStorage.getItem(ck2) || '{}');
    s.d = s.d || {};
    s.d[moduleId] = data;
    s.ts = Date.now();
    localStorage.setItem(ck2, JSON.stringify(s));
  } catch (_) {}
}

// 缓存失效：
//   cacheClear()                  — 清整个作品所有模块
//   cacheClear([k1, k2])          — 清指定模块（数组，兼容旧调用）
//   cacheClear(moduleId)           — 清一个模块
//   cacheClear(moduleId, slotId)   — 只清一个模块中一个 slot
function cacheClear(moduleId, slotId) {
  // cacheClear() — 无参数，清全部
  if (!moduleId) {
    _moduleCache = {};
    try { if (state.currentWorkId) localStorage.removeItem(_lsKey()); } catch (_) {}
    return;
  }

  // cacheClear([k1, k2]) — 数组，清指定模块（兼容旧调用方）
  if (Array.isArray(moduleId)) {
    moduleId.forEach(function (k) {
      delete _moduleCache[k];
      try {
        var ck = _lsKey();
        if (!ck) return;
        var stored = JSON.parse(localStorage.getItem(ck) || '{}');
        if (stored.d) { delete stored.d[k]; localStorage.setItem(ck, JSON.stringify(stored)); }
      } catch (_) {}
    });
    return;
  }

  // cacheClear(moduleId) 或 cacheClear(moduleId, slotId)
  if (typeof moduleId === 'string') {
    if (slotId) {
      // Slot 级清除
      var cached = _moduleCache[moduleId];
      if (cached && cached.data) {
        if (cached.data.slots) delete cached.data.slots[slotId];
        if (cached.data.slot_timestamps) delete cached.data.slot_timestamps[slotId];
      }
      try {
        var ck = _lsKey();
        if (!ck) return;
        var stored = JSON.parse(localStorage.getItem(ck) || '{}');
        if (stored.d && stored.d[moduleId] && stored.d[moduleId].data) {
          var sd = stored.d[moduleId].data;
          if (sd.slots) delete sd.slots[slotId];
          if (sd.slot_timestamps) delete sd.slot_timestamps[slotId];
          localStorage.setItem(ck, JSON.stringify(stored));
        }
      } catch (_) {}
    } else {
      // 模块级清除
      delete _moduleCache[moduleId];
      try {
        var ck = _lsKey();
        if (!ck) return;
        var stored = JSON.parse(localStorage.getItem(ck) || '{}');
        if (stored.d) { delete stored.d[moduleId]; localStorage.setItem(ck, JSON.stringify(stored)); }
      } catch (_) {}
    }
  }
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
// 保存 Module — 只发内容实际变化的 slot（slot 级 diff）
async function saveModule(moduleId, slots, freeContent) {
  var cached = cacheGet(moduleId);
  var body = { slots: {}, free_content: freeContent || '' };

  // Slot 级 diff：只发与缓存内容不同的 slot
  var cachedSlots = (cached && cached.data && cached.data.slots) ? cached.data.slots : {};
  var changedSlots = {};
  var changedTimestamps = {};
  Object.keys(slots).forEach(function (sid) {
    if (slots[sid] !== (cachedSlots[sid] || '')) {
      changedSlots[sid] = slots[sid];
    }
  });
  body.slots = changedSlots;
  if (Object.keys(changedSlots).length === 0 && (freeContent || '') === (cached && cached.data ? (cached.data.free_content || '') : '')) {
    // 没有任何变化 → 不发请求
    console.log('[saveModule] 无变更，跳过保存');
    return { ok: true, skipped: true };
  }

  console.log('[saveModule] 检测到变更 slots: ' + Object.keys(changedSlots).join(', '));

  // 只发变更 slot 的快照和时间戳基线
  if (cached && cached.data) {
    var prevChanged = {};
    Object.keys(changedSlots).forEach(function (sid) {
      if (cachedSlots[sid] !== undefined) prevChanged[sid] = cachedSlots[sid];
    });
    if (Object.keys(prevChanged).length > 0) body._prev_slots = prevChanged;

    if (cached.data.slot_timestamps) {
      Object.keys(changedSlots).forEach(function (sid) {
        if (cached.data.slot_timestamps[sid] !== undefined) {
          changedTimestamps[sid] = cached.data.slot_timestamps[sid];
        }
      });
      if (Object.keys(changedTimestamps).length > 0) body._prev_slot_timestamps = changedTimestamps;
    }
    if (cached.data.free_content !== undefined && freeContent !== undefined && freeContent !== cached.data.free_content) {
      body._prev_free_content = cached.data.free_content;
    }
  }

  var resp = await hPut('/api/write/module/' + moduleId, body);
  if (resp && resp.ok) {
    cacheSet(moduleId, resp);
  } else if (resp && resp.status === 409) {
    // 冲突：内容被 Story Elf 或其他端修改
    var errMsg = (resp.error && resp.error.message) || '内容已被更新，请刷新页面获取最新内容。';
    showSaveConflictToast(errMsg);
  } else if (resp && resp.status === 400 && resp.error && resp.error.code === 'MISSING_TIMESTAMPS') {
    // 缓存来自旧版前端（无时间戳）→ 清缓存后重载
    cacheClear(moduleId);
    reloadCurrentModule();
  } else {
    cacheClear(moduleId);
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

// 显示/切换编辑器类型（v3.3: 主画布 + 知识库 Drawer 模式）
function showSlotEditor(templateData) {
  var te = qs('#writing-editor');
  var fz = qs('#slot-free-zone');
  if (te) te.style.display = 'none';
  if (fz) fz.style.display = '';
  renderSlotEditor(templateData);
}

function showTextEditor(val) {
  _textareaList = [];  // 清空槽位引用，防止残留数据污染其他模块保存
  _templateData = null;
  var te = qs('#writing-editor');
  var fz = qs('#slot-free-zone');
  if (fz) fz.style.display = 'none';
  if (te) {
    te.style.display = 'block';
    te.value = val || '';
  }
}

function showFormEditor(intentData) {
  var te = qs('#writing-editor');
  var fz = qs('#slot-free-zone');
  var fe = qs('#form-editor');
  if (te) te.style.display = 'none';
  if (fz) fz.style.display = '';
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
  var moduleId = 'm0_' + state.currentWorkId;
  var data = await loadModule(moduleId);
  // M0 单槽位 → 纯文本编辑
  var content = (data && data.data && data.data.slots && data.data.slots.content) ? data.data.slots.content : '';
  showTextEditor(content);
}

// ============================================================
// M1: 世界观
// ============================================================
async function loadM1() {
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
  showTextEditor('');
  await renderEntityCardList();
  // 默认选中第一个角色
  var first = qs('#kb-card-list-view .card-item[data-entity-id]');
  if (first) first.click();
}

async function renderEntityCardList() {
  var data = await loadModuleList(state.currentWorkId, 'm3_card');
  var entities = (data && data.ok && data.data.modules || []).map(function (m) { return { id: m.id.replace('m3_card_', ''), name: m.name, type: 'character' }; });
  if (_kbCardListData) _kbCardListData['m3_card'] = entities;
  // 不再直接渲染到 DOM，由 generateKBTabs + Drawer 管理
}

async function openEntityCard(entityId, name) {
  // 切换前保存当前卡片（saveModule 做 slot 级 diff 判断是否真的变更）
  var p = capturePayload();
  if (p) { _pendingPayload = p; flushPendingPayload(); }

  state.currentEntityId = entityId;
  var data = await loadModule('m3_card_' + entityId);
  var template = (data && data.data && data.data.template) ? data.data.template : null;
  if (template) {
    template.free_content = (data && data.data) ? (data.data.free_content || '') : '';
    showSlotEditor(template);
  }

  // 更新 Drawer 内卡片列表高亮
  qsa('#kb-card-list-view .card-item[data-entity-id]').forEach(function (el) {
    el.classList.toggle('active', el.dataset.entityId === entityId);
  });
  updateElfContext();
  generateKBTabs();  // 刷新知识库标签（模板 section 标签现在可用）
}

// ============================================================
// M4: 伏笔卡 — 纯卡片模块（策略总览已合并到 M2 第六节）
// ============================================================
async function loadM4() {
  showTextEditor('');
  await renderFhCardList();
  var first = qs('#kb-card-list-view .card-item[data-entity-id]');
  if (first) first.click();
}

async function renderFhCardList() {
  var data = await loadModuleList(state.currentWorkId, 'm4_card');
  var entities = (data && data.ok && data.data.modules || []).map(function (m) { return { id: m.id.replace('m4_card_', ''), name: m.name, type: 'foreshadowing' }; });
  if (_kbCardListData) _kbCardListData['m4_card'] = entities;
  // 不再直接渲染到 DOM，由 generateKBTabs + Drawer 管理
}

async function openFhCard(entityId, name) {
  // 切换前保存当前卡片（saveModule 做 slot 级 diff 判断是否真的变更）
  var p = capturePayload();
  if (p) { _pendingPayload = p; flushPendingPayload(); }

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

  // 更新 Drawer 内卡片列表高亮
  qsa('#kb-card-list-view .card-item[data-entity-id]').forEach(function (el) {
    el.classList.toggle('active', el.dataset.entityId === entityId);
  });
  updateElfContext();
  generateKBTabs();  // 刷新知识库标签（模板 section 标签现在可用）
}

// ============================================================
// M5 / M6: 章节蓝图 / 逐章编写
// ============================================================
async function loadM5() {
  // 显示自由编辑区
  var te = qs('#writing-editor');
  var fz = qs('#slot-free-zone');
  if (te) te.style.display = 'none';
  if (fz) fz.style.display = '';

  await loadChapterCardList();
  // 默认选中第一章
  var first = qs('#kb-card-list-view .chapter-card[data-section-id]');
  if (first) first.click();
}

async function loadM6() {
  showTextEditor(''); // 占位，openChapter 会填入内容
  await loadChapterCardList();
  var first = qs('#kb-card-list-view .chapter-card[data-section-id]');
  if (first) first.click();
}

async function loadChapterCardList() {
  // 从 modules 表获取章节列表（已缓存）
  var modList = await loadModuleList(state.currentWorkId, state.currentModule === 'chapters' ? 'm5_intent' : 'm6_chapter');

  if (!modList || !modList.ok) {
    if (_kbCardListData) _kbCardListData[state.currentModule === 'chapters' ? 'm5_intent' : 'm6_chapter'] = [];
    return;
  }

  var sections = (modList.data.modules || []).map(function (m) {
    var sid = m.id.replace(/^m[56]_(intent|chapter)_/, '');
    return { id: sid, title: m.name, order_index: m.order_index,
      section_summary: null, word_count: 0, version: m.status === 'done' ? 2 : (m.status === 'in_progress' ? 1 : 0) };
  });
  if (_kbCardListData) _kbCardListData[state.currentModule === 'chapters' ? 'm5_intent' : 'm6_chapter'] = sections;
  // 不再直接渲染到 DOM，由 generateKBTabs + Drawer 管理
  // 拖拽排序状态保留，在 Drawer 渲染时由 initChapterDrag 处理
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
    // M6: 章节正文 — 单槽位，纯文本编辑
    var moduleId6 = 'm6_chapter_' + sectionId;
    var data6 = await loadModule(moduleId6);
    var chapterContent = (data6 && data6.data && data6.data.slots && data6.data.slots.content) ? data6.data.slots.content : '';
    showTextEditor(chapterContent);
  }

  // 刷新 KB Drawer 内卡片列表高亮
  if (state.currentModule === 'chapters' || state.currentModule === 'writing') {
    loadChapterCardList();
  }
  updateElfContext();
  generateKBTabs();  // 刷新知识库标签（M5 意图卡模板 section 现在可用）
}

// 章节拖拽（在 Drawer 的卡片列表视图中激活）
var _dragSrc = null;
function initChapterDrag() {
  qsa('#kb-card-list-view .card-item').forEach(function (item) {
    item.addEventListener('dragstart', function (e) { _dragSrc = item.dataset.sectionId; item.classList.add('dragging'); e.dataTransfer.effectAllowed = 'move'; });
    item.addEventListener('dragend', function () { item.classList.remove('dragging'); qsa('#kb-card-list-view .card-item').forEach(function (i) { i.classList.remove('drag-over'); }); });
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

// 输入时防抖保存（5 秒无输入后触发；saveModule 做 slot 级 diff，无变更则跳过）
// 冲突检测由服务端 _prev_slot_timestamps 比对保证安全
function autoSave() {
  clearTimeout(_autoSaveTimer);
  _autoSaveTimer = setTimeout(function () {
    var p = capturePayload();
    if (!p) return;
    _pendingPayload = p;
    flushPendingPayload();
  }, 5000);
}

// 失焦时同步捕获数据，异步发送（不阻塞 click 导航）
// 冲突检测由服务端 _prev_slot_timestamps 比对保证安全
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
  if (_saving) { console.log('[sendPayload] 正在保存中，排队'); _pendingPayload = p; return; }
  console.log('[sendPayload] 开始保存 mod=' + (p.mod || '?'));
  _saving = true;
  try {
    var resp = await saveModule(p.moduleId, p.slots, p.free_content);
    if (!resp || !resp.ok) {
      console.error('[sendPayload] FAILED mod=' + p.mod + (resp ? ' HTTP ' + (resp.status || '') : ' network'));
    }
  } catch (e) {
    console.error('[sendPayload] FAILED mod=' + p.mod, e);
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
  }
}

// 保存冲突提示 toast（内容被 Story Elf 或其他端修改）
function showSaveConflictToast(msg) {
  var toast = document.createElement('div');
  toast.className = 'save-conflict-toast';
  toast.textContent = msg || '内容已被更新，请刷新页面获取最新内容。注意：刷新将丢失当前未保存的编辑。';
  toast.style.cssText = 'position:fixed;top:16px;left:50%;transform:translateX(-50%);background:#b91c1c;color:#fff;padding:12px 24px;border-radius:8px;z-index:99999;font-size:14px;max-width:480px;text-align:center;box-shadow:0 4px 20px rgba(0,0,0,0.4);cursor:pointer;';
  toast.addEventListener('click', function () { toast.remove(); });
  document.body.appendChild(toast);
  setTimeout(function () { if (toast.parentNode) toast.remove(); }, 12000);
}

// 原地刷新单个 slot：绕过缓存拉 API，用 cacheSet(moduleId, content, slotId, ts) 更新缓存
function refreshSlot(slotId) {
  var moduleId = getModuleId();
  console.log('[refreshSlot] 开始 slotId=' + slotId + ' moduleId=' + moduleId);
  if (!moduleId || !slotId) { console.log('[refreshSlot] 缺少 moduleId 或 slotId，跳过'); return Promise.resolve(); }

  return hGet('/api/write/module/' + moduleId).then(function (data) {
    console.log('[refreshSlot] API 返回 ok=' + (data && data.ok) + ' slots数=' + (data && data.data && data.data.slots ? Object.keys(data.data.slots).length : 0));
    if (!data || !data.ok || !data.data || !data.data.slots) { console.log('[refreshSlot] API 数据无效，跳过'); return; }
    var newContent = data.data.slots[slotId];
    if (newContent === undefined) { console.log('[refreshSlot] slot ' + slotId + ' 在 API 响应中不存在'); return; }
    console.log('[refreshSlot] 得到新内容，长度=' + newContent.length);

    // Slot 级缓存写入
    var ts = data.data.slot_timestamps ? data.data.slot_timestamps[slotId] : undefined;
    cacheSet(moduleId, newContent, slotId, ts);
    console.log('[refreshSlot] cacheSet 完成 ts=' + ts);

    // 更新 DOM
    var found = false;
    for (var i = 0; i < _textareaList.length; i++) {
      var ta = _textareaList[i];
      if (ta.dataset.slotId === slotId) {
        ta.value = newContent;
        var preview = ta.previousElementSibling;
        if (preview && preview.classList.contains('slot-preview')) {
          try {
            preview.innerHTML = newContent ? marked.parse(newContent) : '<span class="slot-preview-empty"></span>';
          } catch (e) { preview.textContent = newContent; }
        }
        found = true;
        console.log('[refreshSlot] DOM 更新完成，preview 可见=' + (preview && preview.style.display !== 'none'));
        break;
      }
    }
    if (!found) console.log('[refreshSlot] ⚠️ 未找到 data-slot-id=' + slotId + ' 的 textarea！_textareaList 长度=' + _textareaList.length);
  });
}

// 时间戳缺失时重新加载当前模块
function reloadCurrentModule() {
  var loadFn = {
    original_concept: loadM0, worldbuilding: loadM1, outline: loadM2,
    characters: loadM3, foreshadowing: loadM4, chapters: loadM5, writing: loadM6
  }[state.currentModule];
  if (loadFn) loadFn();
}

async function generateOutline(workId) {
  if (!confirm(t('prompt.outline_confirm'))) return;
  cacheClear('m2_' + workId); // 大纲 regenerate 后缓存失效
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
// Drawer 边界计算 — 夹在 Pipeline 下边界 与 Footer 上边界之间
// ============================================================
function updateDrawerBounds() {
  var pipelineBar = qs('#pipeline-bar');
  var footer = qs('.footer');
  var aiDrawer = qs('#ai-drawer');
  var kbDrawer = qs('#kb-content-drawer');

  var topBound = pipelineBar ? pipelineBar.getBoundingClientRect().bottom : 80;
  var botBound = footer ? footer.getBoundingClientRect().top : window.innerHeight;

  if (aiDrawer) {
    aiDrawer.style.top = topBound + 'px';
    aiDrawer.style.bottom = (window.innerHeight - botBound) + 'px';
  }
  if (kbDrawer) {
    kbDrawer.style.top = topBound + 'px';
    kbDrawer.style.bottom = (window.innerHeight - botBound) + 'px';
  }
}

// ============================================================
// AI Drawer 管理
// ============================================================
function initAIDrawer() {
  var toggle = qs('#ai-drawer-toggle');
  if (toggle) {
    toggle.addEventListener('click', function () {
      state.aiDrawerOpen = !state.aiDrawerOpen;
      applyAIDrawerState();
      saveState();
    });
  }
  applyAIDrawerState();
}

function applyAIDrawerState() {
  var drawer = qs('#ai-drawer');
  if (!drawer) return;
  updateDrawerBounds();  // 展开时刷新边界
  if (state.aiDrawerOpen) {
    drawer.classList.add('open');
  } else {
    drawer.classList.remove('open');
  }
}

// ============================================================
// 知识库标签系统（Layer 2 — 右侧浮动标签 + 二级面板 + 内容 Drawer）
// ============================================================
var _kbTabs = [];          // [{ type, label, cardType?, sectionIndex?, l2: [...] }]
var _kbCardListData = {};  // { 'm3_card': [...], 'm4_card': [...], ... }

// 当前模块的知识库标签数据
function generateKBTabs() {
  _kbTabs = [];
  var mod = state.currentModule;
  var wid = state.currentWorkId;
  if (!mod || !wid) { renderKBTabBar(); return; }

  // 一、卡片标签
  var cardDefs = [];
  switch (mod) {
    case 'characters':    cardDefs.push({ type: 'm3_card', label: t('kb.characters') || '人物卡片' }); break;
    case 'foreshadowing': cardDefs.push({ type: 'm4_card', label: t('kb.foreshadowing') || '伏笔卡片' }); break;
    case 'chapters':      cardDefs.push({ type: 'm5_intent', label: t('kb.chapter_intents') || '章节蓝图' }); break;
    case 'writing':       cardDefs.push({ type: 'm6_chapter', label: t('kb.chapter_cards') || '章节卡片' }); break;
  }
  cardDefs.forEach(function (d) {
    _kbTabs.push({ type: 'card_list', label: d.label, cardType: d.type, l2: null });
  });

  // 二、模板 section 标签（从缓存中读取）
  var templateModuleId = null;
  switch (mod) {
    case 'worldbuilding': templateModuleId = 'm1_' + wid; break;
    case 'outline':       templateModuleId = 'm2_' + wid; break;
    case 'characters':    templateModuleId = state.currentEntityId ? 'm3_card_' + state.currentEntityId : null; break;
    case 'foreshadowing': templateModuleId = state.currentFhId ? 'm4_card_' + state.currentFhId : null; break;
    case 'chapters':      templateModuleId = state.currentSectionId ? 'm5_intent_' + state.currentSectionId : null; break;
  }

  if (templateModuleId) {
    var cached = cacheGet(templateModuleId);
    var sections = (cached && cached.data && cached.data.template && cached.data.template.sections) || [];
    sections.forEach(function (section, si) {
      var slotCount = (section.slots || []).length;
      if (slotCount <= 1) {
        // 单 slot section：不需要二级标签，点击一级直接展开内容 Drawer
        _kbTabs.push({ type: 'template_section', label: section.heading || 'Section ' + (si + 1), sectionIndex: si, l2: null });
      } else {
        // 多 slot section：生成二级标签
        var l2List = (section.slots || []).map(function (s) {
          return { type: 'slot', id: s.id, label: s.label, hint: s.hint, content: s.content };
        });
        _kbTabs.push({ type: 'template_section', label: section.heading || 'Section ' + (si + 1), sectionIndex: si, l2: l2List });
      }
    });
  }

  // 关闭知识库状态（切换模块时默认不自动打开）
  closeKBContentDrawer();
  closeKBSecondaryPanel();
  state.kbActiveL1 = null;
  state.kbActiveL2 = null;
  renderKBTabBar();
}

function renderKBTabBar() {
  var bar = qs('#kb-tab-bar');
  if (!bar) return;
  bar.innerHTML = '';

  if (_kbTabs.length === 0) {
    bar.style.display = 'none';
    return;
  }
  bar.style.display = 'flex';

  _kbTabs.forEach(function (tab, i) {
    var badge = document.createElement('div');
    badge.className = 'kb-tab-badge';
    if (state.kbActiveL1 === i) badge.classList.add('active');
    badge.textContent = tab.label;
    badge.addEventListener('click', function () { onKBTabClick(i); });
    bar.appendChild(badge);
  });
}

function onKBTabClick(tabIndex) {
  state.kbActiveL1 = tabIndex;
  state.kbActiveL2 = null;
  var tab = _kbTabs[tabIndex];
  if (!tab) return;

  renderKBTabBar();

  if (tab.l2 && tab.l2.length > 0) {
    // 有二级标签 → 展开窄面板
    openKBSecondaryPanel(tabIndex);
  } else {
    // 无二级标签（如卡片列表）→ 直接展开内容 Drawer
    closeKBSecondaryPanel();
    openKBContentDrawer(tabIndex, null);
  }
}

function openKBSecondaryPanel(tabIndex) {
  var bar = qs('#kb-l2-tab-bar');
  if (!bar) return;
  var tab = _kbTabs[tabIndex];
  if (!tab || !tab.l2) return;

  // 计算 L2 标签栏偏移量（排在 L1 标签左侧）
  var l1Bar = qs('#kb-tab-bar');
  var l1Badges = l1Bar ? l1Bar.querySelectorAll('.kb-tab-badge') : [];
  var maxL1Width = 0;
  l1Badges.forEach(function (b) { maxL1Width = Math.max(maxL1Width, b.offsetWidth); });
  bar.style.right = (maxL1Width + 8) + 'px';

  bar.innerHTML = '';
  tab.l2.forEach(function (l2Item, li) {
    var badge = document.createElement('div');
    badge.className = 'kb-l2-tab-badge';
    if (state.kbActiveL2 === li) badge.classList.add('active');
    badge.textContent = l2Item.label || l2Item.id;
    badge.addEventListener('click', function () {
      state.kbActiveL2 = li;
      // 更新高亮
      qsa('#kb-l2-tab-bar .kb-l2-tab-badge').forEach(function (b) { b.classList.remove('active'); });
      badge.classList.add('active');
      openKBContentDrawer(tabIndex, li);
    });
    bar.appendChild(badge);
  });

  bar.style.display = 'flex';
}

function closeKBSecondaryPanel() {
  var bar = qs('#kb-l2-tab-bar');
  if (!bar) return;
  bar.style.display = 'none';
  state.kbActiveL2 = null;
}

function openKBContentDrawer(tabIndex, l2Index) {
  // 保存当前编辑内容
  clearTimeout(_autoSaveTimer);
  var p = capturePayload();
  if (p) { _pendingPayload = p; flushPendingPayload(); }

  var drawer = qs('#kb-content-drawer');
  if (!drawer) return;

  var tab = _kbTabs[tabIndex];
  if (!tab) return;

  // 标题
  var titleEl = qs('#kb-drawer-title');
  var title = tab.label;
  if (l2Index !== null && tab.l2 && tab.l2[l2Index]) {
    title += ' › ' + (tab.l2[l2Index].label || tab.l2[l2Index].id);
  }
  if (titleEl) titleEl.textContent = title;

  // 清空之前的内容
  var se = qs('#slot-editor');
  var cl = qs('#kb-card-list-view');
  var fe = qs('#form-editor');
  if (se) se.style.display = 'none';
  if (cl) cl.style.display = 'none';
  if (fe) fe.style.display = 'none';

  if (tab.type === 'card_list') {
    renderCardListInDrawer(tab.cardType);
    if (cl) cl.style.display = 'flex';
  } else if (tab.type === 'template_section') {
    if (l2Index !== null && tab.l2 && tab.l2[l2Index]) {
      renderSingleSlotInDrawer(tab, l2Index);
    } else {
      renderSectionSlotsInDrawer(tab);
    }
    if (se) se.style.display = 'block';
  }

  // 显示 Preview/Edit 胶囊（仅模板内容，卡片列表不需要）
  var modePill = qs('#kb-mode-pill');
  if (modePill) modePill.style.display = (tab.type === 'card_list') ? 'none' : '';
  // 默认预览模式
  _kbEditMode = false;
  applyKBEditMode();

  updateDrawerBounds();  // 打开前刷新边界
  drawer.style.display = 'flex';
  requestAnimationFrame(function () { drawer.classList.add('open'); });
}

function closeKBContentDrawer() {
  var drawer = qs('#kb-content-drawer');
  if (!drawer) return;
  drawer.classList.remove('open');
  setTimeout(function () {
    if (!drawer.classList.contains('open')) drawer.style.display = 'none';
  }, 300);
  closeKBSecondaryPanel();  // 同时关闭 L2 标签栏
  state.kbActiveL1 = null;
  state.kbActiveL2 = null;
  renderKBTabBar();
}

// 在 Drawer 内渲染卡片列表
function renderCardListInDrawer(cardType) {
  var mods = _kbCardListData[cardType] || [];
  var target = qs('#kb-card-list-view');
  if (!target) return;
  target.innerHTML = '';

  if (mods.length === 0) {
    target.innerHTML = '<div style="color:var(--text-muted);padding:2rem;text-align:center">' + (t('label.no_items') || '暂无条目') + '</div>';
    return;
  }

  // 章节筛选按钮（仅 M5/M6）
  if (cardType === 'm5_intent' || cardType === 'm6_chapter') {
    var filterDiv = document.createElement('div');
    filterDiv.className = 'chapter-filters';
    ['all', 'draft', 'done'].forEach(function (f) {
      var btn = document.createElement('button');
      btn.className = 'chapter-filter-btn' + (state.chapterFilter === f ? ' active' : '');
      btn.textContent = t('chapter_filter.' + f);
      btn.addEventListener('click', function () {
        state.chapterFilter = f; saveState();
        renderCardListInDrawer(cardType);
      });
      filterDiv.appendChild(btn);
    });
    target.appendChild(filterDiv);

    // 筛选
    if (state.chapterFilter === 'draft') mods = mods.filter(function (s) { return s.version < 2; });
    else if (state.chapterFilter === 'done') mods = mods.filter(function (s) { return s.version >= 2 && s.word_count > 0; });
  }

  mods.forEach(function (m) {
    var entityId;
    if (cardType === 'm5_intent' || cardType === 'm6_chapter') {
      entityId = m.id.replace(/^m[56]_(intent|chapter)_/, '');
    } else {
      entityId = m.id.replace(/^m[34]_card_/, '');
    }

    var card = document.createElement('div');
    if (cardType === 'm5_intent' || cardType === 'm6_chapter') {
      card.className = 'card-item chapter-card';
      card.dataset.sectionId = entityId;
    } else {
      card.className = 'card-item';
      card.dataset.entityId = entityId;
    }

    var stIcon = '';
    if (cardType === 'm5_intent' || cardType === 'm6_chapter') {
      stIcon = '<span class="card-status">' + (m.version === 0 ? (m.word_count > 0 ? '[draft]' : '[new]') : (m.word_count > 0 ? '[done]' : '[planned]')) + '</span>';
    }

    card.innerHTML = stIcon + '<span class="card-item-name">' + escHtml(m.name) + '</span><span class="card-item-meta">' + ((cardType === 'm5_intent' || cardType === 'm6_chapter') ? (m.word_count || 0) + '字' : (m.description || '').substring(0, 30)) + '</span>';

    card.addEventListener('click', function () {
      switch (cardType) {
        case 'm3_card': openEntityCard(entityId, m.name); break;
        case 'm4_card': openFhCard(entityId, m.name); break;
        case 'm5_intent':
        case 'm6_chapter': openChapter(entityId, m.name); break;
      }
    });
    target.appendChild(card);
  });
}

// 在 Drawer 内渲染模板 section 的所有 slot
function renderSectionSlotsInDrawer(tab) {
  _textareaList = [];
  var target = qs('#slot-groups');
  if (!target) return;
  target.innerHTML = '';

  var templateModuleId = null;
  var mod = state.currentModule;
  var wid = state.currentWorkId;
  switch (mod) {
    case 'worldbuilding': templateModuleId = 'm1_' + wid; break;
    case 'outline':       templateModuleId = 'm2_' + wid; break;
    case 'characters':    templateModuleId = state.currentEntityId ? 'm3_card_' + state.currentEntityId : null; break;
    case 'foreshadowing': templateModuleId = state.currentFhId ? 'm4_card_' + state.currentFhId : null; break;
    case 'chapters':      templateModuleId = state.currentSectionId ? 'm5_intent_' + state.currentSectionId : null; break;
  }

  var cached = templateModuleId ? cacheGet(templateModuleId) : null;
  var sections = cached && cached.data && cached.data.template ? cached.data.template.sections : null;
  if (!sections || !sections[tab.sectionIndex]) return;

  var section = sections[tab.sectionIndex];
  var slotCount = (section.slots || []).length;

  // 多 slot 时保留 section heading（用于分隔不同 slot）；单 slot 时去掉（Header 已显示）
  if (slotCount > 1 && section.heading) {
    var hDiv = document.createElement('div');
    hDiv.className = 'slot-framework';
    try { hDiv.innerHTML = marked.parse('## ' + section.heading); } catch (e) { hDiv.textContent = section.heading; }
    target.appendChild(hDiv);
  }

  // 渲染所有 slot（复用 renderSlotItem）
  (section.slots || []).forEach(function (slot) {
    // 单 slot 时不显示其 label（与 section heading 重复）
    if (slotCount <= 1) slot = { id: slot.id, label: '', hint: slot.hint, content: slot.content };
    renderSlotItem(target, slot);
  });
}

// KB Drawer Preview / Edit 模式切换
var _kbEditMode = false;  // false=预览, true=编辑

function toggleKBEditMode() {
  // 切换前保存当前编辑内容（双保险：blur 也会触发，但 mousedown 先于 blur）
  clearTimeout(_autoSaveTimer);
  var p = capturePayload();
  if (p) { _pendingPayload = p; flushPendingPayload(); }

  _kbEditMode = !_kbEditMode;
  applyKBEditMode();
}

function applyKBEditMode() {
  var drawer = qs('#kb-content-drawer');
  var pill = qs('#kb-mode-pill');
  var knob = qs('#kb-mode-knob');
  if (!drawer) return;

  // 设置多语言文本
  if (pill) {
    var prevOpt = pill.querySelector('[data-mode="preview"]');
    var editOpt = pill.querySelector('[data-mode="edit"]');
    if (prevOpt) prevOpt.textContent = t('writing.preview');
    if (editOpt) editOpt.textContent = t('writing.edit');
  }

  if (_kbEditMode) {
    drawer.classList.add('edit-mode');
    if (pill) { pill.querySelector('[data-mode="preview"]').classList.remove('active'); pill.querySelector('[data-mode="edit"]').classList.add('active'); }
    if (knob) knob.classList.add('right');
  } else {
    drawer.classList.remove('edit-mode');
    if (pill) { pill.querySelector('[data-mode="edit"]').classList.remove('active'); pill.querySelector('[data-mode="preview"]').classList.add('active'); }
    if (knob) knob.classList.remove('right');
  }
}

// 在 Drawer 内渲染单个 slot（去掉冗余的二级标题，Header 已显示）
function renderSingleSlotInDrawer(tab, l2Index) {
  _textareaList = [];
  var target = qs('#slot-groups');
  if (!target) return;
  target.innerHTML = '';

  var l2Item = tab.l2[l2Index];
  if (!l2Item) return;

  // 不再渲染 label heading（Drawer Header 已显示路径）
  var slot = { id: l2Item.id, label: '', hint: l2Item.hint, content: l2Item.content };
  renderSlotItem(target, slot);
}

// ============================================================
// Story Elf 行为覆盖
// ============================================================

// SSE write_to_slot 回调 — 精确清目标模块缓存 + 原地刷新被修改的槽位
window._onWriteToSlot = function (params) {
  var mt = params.module_type;
  var sid = params.slot_id;
  console.log('[onWriteToSlot] 收到 SSE 事件', JSON.stringify({ module_type: mt, slot_id: sid, currentModule: state.currentModule, currentWorkId: state.currentWorkId }));

  if (!mt) { console.log('[onWriteToSlot] 缺少 module_type，跳过'); return; }

  var modMap = {
    m0: 'original_concept', m1: 'worldbuilding', m2: 'outline',
    m3_card: 'characters', m4_card: 'foreshadowing',
    m5_intent: 'chapters', m6_chapter: 'writing'
  };
  var frontMod = modMap[mt];
  if (!frontMod) { console.log('[onWriteToSlot] 未知 module_type:', mt); return; }

  var targetModuleId = params.module_id || (mt + '_' + (state.currentWorkId || ''));
  console.log('[onWriteToSlot] frontMod=' + frontMod + ' targetModuleId=' + targetModuleId);

  // 当前不在该模块 → 清该模块缓存，下次切过来自然取最新
  if (state.currentModule !== frontMod) {
    console.log('[onWriteToSlot] 用户不在该模块 (current=' + state.currentModule + ')，清缓存后返回');
    if (targetModuleId) cacheClear(targetModuleId);
    return;
  }

  // 用户在该模块 → 不清缓存，refreshSlot 内部做原地 slot 级更新
  if (sid) {
    var curModuleId = getModuleId();
    console.log('[onWriteToSlot] 用户在该模块 curModuleId=' + curModuleId);
    var cached = curModuleId ? cacheGet(curModuleId) : null;
    console.log('[onWriteToSlot] 缓存命中:', !!cached, cached ? 'slots数=' + Object.keys(cached.data?.slots || {}).length : '');
    var cachedSlots = (cached && cached.data && cached.data.slots) || {};
    var currentVal = '';
    for (var i = 0; i < _textareaList.length; i++) {
      if (_textareaList[i].dataset.slotId === sid) {
        currentVal = _textareaList[i].value;
        break;
      }
    }
    var cachedVal = cachedSlots[sid] || '';
    console.log('[onWriteToSlot] slot=' + sid + ' cachedLen=' + cachedVal.length + ' currentLen=' + currentVal.length + ' same=' + (currentVal === cachedVal));
    if (currentVal !== cachedVal) {
      console.log('[onWriteToSlot] 用户动过该槽位，不刷新');
      return;
    }
  }

  // 用户没动过 → 原地刷新该槽位
  console.log('[onWriteToSlot] 调用 refreshSlot(' + sid + ')');
  refreshSlot(sid);
};

StoryElf.setPage('write');

// 注入 Write 页差异配置，不再覆盖 sendChat
StoryElf.init({
  getWorkId: function () { return state.currentWorkId; },
  beforeSend: function () { clearTimeout(_autoSaveTimer); },
  contextModule: function () { return state.currentModule; },
  onToolResult: function (step) {
    if (step.tool === 'write_to_slot' && step.params && typeof _onWriteToSlot === 'function') {
      _onWriteToSlot(step.params);
    }
  },
});

// ============================================================
// 左栏垂直分割 — v3.3 已移除（三层覆盖式布局不再需要）
// createLeftPanelSplit 工厂函数仍然在 app.js 中供其他页面使用
// ============================================================

// ============================================================
// 初始化
// ============================================================
document.addEventListener('DOMContentLoaded', async function () {
  qs('#global-nav').innerHTML = renderNav();
  if (typeof CAU !== 'undefined') CAU.updateLoginButton();

  // 清除所有 localStorage 模块缓存（确保每次打开页面都是最新数据）
  (function clearAllModuleCaches() {
    var toRemove = [];
    for (var i = localStorage.length - 1; i >= 0; i--) {
      var key = localStorage.key(i);
      if (key && key.indexOf('sf_pipe_') === 0) toRemove.push(key);
    }
    for (var j = 0; j < toRemove.length; j++) {
      localStorage.removeItem(toRemove[j]);
    }
  })();

  loadState();

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

  // 将 Story Elf 嵌入 AI Drawer（Drawer 模式）
  var aiPanel = qs('#ai-drawer-panel');
  if (aiPanel) StoryElf.mount(aiPanel, 'drawer');
  initAIDrawer();

  // 动态计算 Drawer 边界（Pipeline 下 ↔ Footer 上）
  // 双 rAF 确保 renderNav() 和 Story Elf mount 完成后布局已稳定
  requestAnimationFrame(function () {
    requestAnimationFrame(function () {
      updateDrawerBounds();
    });
  });
  window.addEventListener('resize', updateDrawerBounds);

  if (typeof userToken !== 'undefined' && userToken) {
    await loadUserConfig();
    loadWorkspaces(true); // 初始加载时恢复上次作品
  }
});
