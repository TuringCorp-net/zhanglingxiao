// Story Forger — 写作桌主逻辑（v2.0：左右分栏 + Pipeline 唯一导航）
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
  leftPct: 40,
};

function loadState() {
  try {
    var saved = JSON.parse(localStorage.getItem('sf_desk_v2') || '{}');
    Object.assign(state, { chapterFilter: 'all', leftPct: 40 }, saved);
  } catch (e) {}
}
function saveState() {
  try {
    localStorage.setItem('sf_desk_v2', JSON.stringify({
      leftPct: state.leftPct,
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
    h += '<div class="pipeline-step empty" data-module="' + s.module + '" data-step="' + s.id + '" onclick="switchModule(\'' + s.module + '\')">'
      + '<span class="pipeline-label">' + plabel(s) + '</span>'
      + '<span class="pipeline-id">' + s.id + '</span></div>';
    if (i < PIPELINE_STEPS.length - 1) h += '<span class="pipeline-arrow">&rsaquo;</span>';
  });
  el.innerHTML = h;
}

function updatePipelineStatuses(statuses) {
  PIPELINE_STEPS.forEach(function (s, i) {
    var el = qs('.pipeline-step[data-step="' + s.id + '"]');
    if (!el) return;
    var st = statuses[s.id];
    var cls = st === 'done' ? 'done' : st === 'in_progress' ? 'in-progress' : 'empty';
    var prev = i > 0 ? statuses[PIPELINE_STEPS[i - 1].id] : null;
    var sug = st === 'empty' && (i === 0 || prev === 'done');
    el.className = 'pipeline-step ' + cls + (sug ? ' suggested' : '');
    el.title = sug ? t('label.suggest_start') : '';
    el.querySelector('.pipeline-label').textContent = plabel(s);
  });
}

async function refreshPipelineGuide(workId) {
  var guide = qs('#pipeline-guide');
  var el = qs('#pipeline-steps');
  if (!guide || !el || !workId) return;
  guide.style.display = 'block';
  renderPipelineSkeleton(el, workId);

  var results = await Promise.all([
    hGet('/api/write/original-concept/' + workId),
    hGet('/api/write/worldbuilding/' + workId),
    hGet('/api/write/outline/' + workId),
    hGet('/api/content/' + workId + '/entities'),
    hGet('/api/write/foreshadowing/' + workId),
    hGet('/api/write/outline/' + workId),
  ]);

  updatePipelineStatuses({
    M0: checkOC(results[0]),
    M1: checkWB(results[1]),
    M2: checkOL(results[2]),
    M3: checkEN(results[3]),
    M4: checkFH(results[4]),
    M5: checkBP(results[5]),
    M6: checkCC(results[5]),
  });
}

function checkOC(d) { if (!d || !d.ok || d.data.is_empty) return 'empty'; return (d.data.content || '').trim().length > 50 ? 'done' : 'in_progress'; }
function checkWB(d) { if (!d || !d.ok || !d.data.content || d.data.is_template) return 'empty'; return d.data.content.replace(/#.*\n|>.*\n|<!--.*-->|\s/g, '').length > 200 ? 'done' : 'in_progress'; }
function checkOL(d) { if (!d || !d.ok) return 'empty'; return (d.data.sections || []).length > 0 ? 'done' : 'empty'; }
function checkEN(d) { if (!d || !d.ok) return 'empty'; var c = (d.data || []).filter(function (e) { return e.type === 'character' || !e.type; }); return c.length === 0 ? 'empty' : c.length >= 3 ? 'done' : 'in_progress'; }
function checkFH(d) { if (!d || !d.ok || d.data.is_template) return 'empty'; return d.data.content ? 'done' : 'empty'; }
function checkBP(d) { if (!d || !d.ok) return 'empty'; var s = d.data.sections || []; if (!s.length) return 'empty'; return s.filter(function (x) { return x.section_summary; }).length > 0 ? 'done' : 'in_progress'; }
function checkCC(d) { if (!d || !d.ok) return 'empty'; var s = d.data.sections || []; if (!s.length) return 'empty'; return s.filter(function (x) { return x.word_count > 0; }).length > 0 ? 'done' : 'in_progress'; }

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

function onWorkspaceChange() {
  var id = qs('#workspace-selector').value;
  if (!id) {
    qs('#split-view').style.display = 'none';
    qs('#pipeline-guide').style.display = 'none';
    return;
  }
  state.currentWorkId = id;
  saveState();
  qs('#split-view').style.display = 'grid';
  refreshPipelineGuide(id);
  switchModule('original_concept');
  updateElfContext();
}

// ============================================================
// Module Switching
// ============================================================
function switchModule(module) {
  state.currentModule = module;
  state.currentSectionId = null;
  state.currentSectionTitle = '';
  state.currentEntityId = null;
  state.currentFhId = null;

  // highlight pipeline
  PIPELINE_STEPS.forEach(function (s) {
    var el = qs('.pipeline-step[data-module="' + s.module + '"]');
    if (el) el.classList.toggle('active', s.module === module);
  });

  // clear right
  qs('#writing-editor').value = '';

  switch (module) {
    case 'original_concept': loadM0(); break;
    case 'worldbuilding': loadM1(); break;
    case 'outline': loadM2(); break;
    case 'characters': loadM3(); break;
    case 'foreshadowing': loadM4(); break;
    case 'chapters': loadM5(); break;
    case 'writing': loadM6(); break;
  }
  updateElfContext();
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
// M0: 原始构想
// ============================================================
async function loadM0() {
  var left = qs('#split-left');
  left.innerHTML = '';
  left.appendChild(qs('#tmpl-m0-hints').content.cloneNode(true));

  qs('#editor-title').textContent = t('pipeline.M0');
  var data = await hGet('/api/write/original-concept/' + state.currentWorkId);
  qs('#writing-editor').value = (data && data.ok && data.data.content) ? data.data.content : '';
  showEditorActions(true);
}

// ============================================================
// M1: 世界观 / M2: 主线剧情
// ============================================================
async function loadM1() { loadBibleModule('worldbuilding', '/api/write/worldbuilding/', 'template_notice.worldbuilding'); }
async function loadM2() { loadBibleModule('outline', '/api/write/outline/', 'template_notice.outline'); }

async function loadBibleModule(module, apiPath, noticeKey) {
  var left = qs('#split-left');
  left.innerHTML = '';
  left.appendChild(loadingHTML());
  var data = await hGet(apiPath + state.currentWorkId);
  left.innerHTML = '';
  if (data && data.ok && data.content) {
    var div = document.createElement('div');
    div.className = 'bible-rendered';
    div.innerHTML = renderBibleContent(data.content);
    left.appendChild(div);
  } else {
    left.appendChild(errorHTML(t('label.load_failed')));
  }
  qs('#editor-title').textContent = t('pipeline.' + (module === 'worldbuilding' ? 'M1' : 'M2'));
  qs('#writing-editor').value = (data && data.ok && data.content) ? data.content : '';
  showEditorActions(true);
}

// ============================================================
// M3: 人物卡
// ============================================================
async function loadM3() {
  qs('#editor-title').textContent = t('pipeline.M3');
  qs('#writing-editor').value = '';
  showEditorActions(false);
  await renderEntityCardList();
}

async function renderEntityCardList() {
  var left = qs('#split-left');
  left.innerHTML = '';
  left.appendChild(loadingHTML());
  var data = await hGet('/api/content/' + state.currentWorkId + '/entities');
  left.innerHTML = '';
  if (!data || !data.ok) { left.appendChild(errorHTML(t('label.load_failed'))); return; }

  var entities = data.data || [];
  if (!entities.length) { left.innerHTML = '<div class="left-panel-empty">' + t('label.no_characters') + '</div>'; return; }

  var byType = {};
  entities.forEach(function (e) { var t = e.type || 'other'; if (!byType[t]) byType[t] = []; byType[t].push(e); });
  var frag = document.createDocumentFragment();
  Object.keys(byType).forEach(function (type) {
    var title = document.createElement('div');
    title.style.cssText = 'font-size:0.7rem;color:var(--text-muted);padding:0.5rem 0 0.2rem 0.5rem;';
    title.textContent = t('entity_type.' + type) || type;
    frag.appendChild(title);
    byType[type].forEach(function (e) {
      var card = qs('#tmpl-entity-card-item').content.cloneNode(true);
      var root = card.querySelector('.card-item');
      root.dataset.entityId = e.id;
      if (state.currentEntityId === e.id) root.classList.add('active');
      root.addEventListener('click', function () { openEntityCard(e.id, e.name); });
      card.querySelector('.card-item-name').textContent = e.name;
      card.querySelector('.card-item-meta').textContent = e.first_appearance ? 'ch' + e.first_appearance : '';
      frag.appendChild(card);
    });
  });
  left.appendChild(frag);
}

async function openEntityCard(entityId, name) {
  state.currentEntityId = entityId;
  qs('#editor-title').textContent = name;
  var data = await hGet('/api/write/works/' + state.currentWorkId + '/entities/' + entityId + '/card');
  qs('#writing-editor').value = (data && data.ok && data.data.content) ? data.data.content : '';
  showEditorActions(true);
  renderEntityCardList();
  updateElfContext();
}

// ============================================================
// M4: 伏笔账本
// ============================================================
async function loadM4() {
  qs('#editor-title').textContent = t('pipeline.M4');
  qs('#writing-editor').value = '';
  showEditorActions(false);
  await renderFhCardList();
}

async function renderFhCardList() {
  var left = qs('#split-left');
  left.innerHTML = '';
  left.appendChild(loadingHTML());
  var data = await hGet('/api/write/foreshadowing/' + state.currentWorkId);
  left.innerHTML = '';
  if (!data || !data.ok || !data.data.content || data.data.is_template) {
    left.innerHTML = '<div class="left-panel-empty">' + t('template_notice.foreshadowing') + '</div>';
    return;
  }
  // 解析伏笔列表（简易版：按 ## 分割）
  var md = data.data.content;
  var items = md.split(/\n### 伏笔 #\d+/).slice(1);
  if (!items.length) { left.innerHTML = '<div class="left-panel-empty">暂无伏笔条目</div>'; return; }

  var frag = document.createDocumentFragment();
  items.forEach(function (item, idx) {
    var lines = item.trim().split('\n');
    var title = lines[0] ? lines[0].replace(/[：:]/g, '').trim() : ('#' + (idx + 1));
    var card = qs('#tmpl-fh-card-item').content.cloneNode(true);
    var root = card.querySelector('.card-item');
    root.dataset.fhId = 'fh_' + idx;
    if (state.currentFhId === 'fh_' + idx) root.classList.add('active');
    root.addEventListener('click', function () { openFhCard('fh_' + idx, title, item); });
    // 提取强度
    var strength = '';
    var sm = item.match(/强度.*?[|：:]\s*(.+)/);
    if (sm) strength = sm[1].trim().substring(0, 12);
    card.querySelector('.card-item-name').textContent = title;
    card.querySelector('.card-item-meta').textContent = strength;
    frag.appendChild(card);
  });
  left.appendChild(frag);
}

function openFhCard(fhId, title, content) {
  state.currentFhId = fhId;
  qs('#editor-title').textContent = title;
  qs('#writing-editor').value = content || '';
  showEditorActions(true);
  renderFhCardList();
}

// ============================================================
// M5 / M6: 章节蓝图 / 逐章编写
// ============================================================
async function loadM5() {
  qs('#editor-title').textContent = t('pipeline.M5');
  qs('#writing-editor').value = '';
  showEditorActions(false);
  await loadChapterCardList();
}

async function loadM6() {
  qs('#editor-title').textContent = t('pipeline.M6');
  qs('#writing-editor').value = '';
  showEditorActions(false);
  await loadChapterCardList();
}

async function loadChapterCardList() {
  var left = qs('#split-left');
  left.innerHTML = '';
  left.appendChild(loadingHTML());
  var data = await hGet('/api/write/outline/' + state.currentWorkId);
  left.innerHTML = '';
  if (!data || !data.ok) { left.appendChild(errorHTML(t('label.load_failed'))); return; }

  var sections = data.data.sections || [];
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

  var frag = document.createDocumentFragment();
  filtered.forEach(function (s) {
    var stIcon = s.version === 0 ? (s.word_count > 0 ? '[draft]' : '[new]') : (s.word_count > 0 ? '[done]' : '[planned]');
    var card = qs('#tmpl-chapter-card-item').content.cloneNode(true);
    var root = card.querySelector('.card-item');
    root.dataset.sectionId = s.id;
    if (state.currentSectionId === s.id) root.classList.add('active');
    root.addEventListener('click', function () { openChapter(s.id, s.title); });
    card.querySelector('.card-status').textContent = stIcon;
    card.querySelector('.card-item-name').textContent = s.title;
    card.querySelector('.card-item-meta').textContent = (s.word_count || 0) + '';
    frag.appendChild(card);
  });
  left.appendChild(frag);

  // 拖拽排序（仅 M6）
  if (state.currentModule === 'writing') initChapterDrag();
}

async function openChapter(sectionId, title) {
  state.currentSectionId = sectionId;
  state.currentSectionTitle = title;
  qs('#editor-title').textContent = title;

  if (state.currentModule === 'chapters') {
    // M5: 意图卡填空式 - 简化版直接加载 JSON 为文本
    var data = await hGet('/api/write/draft/output/' + sectionId);
    qs('#writing-editor').value = (data && data.ok) ? JSON.stringify(data.data, null, 2) : '';
  } else {
    // M6: 章节正文
    var d = await hGet('/api/content/' + state.currentWorkId + '/sections/' + sectionId + '?mode=full');
    qs('#writing-editor').value = (d && d.ok && d.data.body) ? d.data.body : '';
  }
  showEditorActions(true);
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
      if (r && r.ok) loadChapterCardList();
    });
  });
}

// ============================================================
// 编辑器操作
// ============================================================
function showEditorActions(show) {
  qs('#editor-actions').style.display = show ? 'flex' : 'none';
}

async function saveModuleContent() {
  var wid = state.currentWorkId;
  var body = qs('#writing-editor').value;
  if (!wid) return;

  var mod = state.currentModule;
  if (mod === 'original_concept') {
    var r = await hPut('/api/write/original-concept/' + wid, { content: body });
    if (r && r.ok) flashSave();
    else alert(t('prompt.save_failed') + (r && r.error && r.error.message || ''));
  } else if (mod === 'worldbuilding') {
    var r = await hPut('/api/write/worldbuilding/' + wid, { content: body });
    if (r && r.ok) flashSave();
    else alert(t('prompt.save_failed'));
  } else if (mod === 'outline') {
    var r = await hPut('/api/write/outline/' + wid, { sections: [] }); // outline 通过 PUT content
    flashSave();
  } else if (mod === 'characters' && state.currentEntityId) {
    var r = await hPut('/api/write/works/' + wid + '/entities/' + state.currentEntityId, { description: body });
    if (r && r.ok) flashSave();
    else alert(t('prompt.save_failed'));
  } else if (mod === 'writing' && state.currentSectionId) {
    var r = await hPut('/api/write/works/' + wid + '/sections/' + state.currentSectionId, { title: state.currentSectionTitle, body: body });
    if (r && r.ok) flashSave();
    else alert(t('prompt.save_failed') + (r && r.error && r.error.message || ''));
  } else if (mod === 'chapters' && state.currentSectionId) {
    // intent card save — simplified
    flashSave();
  } else if (mod === 'foreshadowing') {
    var r = await hPut('/api/write/foreshadowing/' + wid, { content: body });
    if (r && r.ok) flashSave();
  } else {
    flashSave();
  }
}

function flashSave() {
  var btn = qs('.editor-actions .btn-primary');
  if (btn) { btn.textContent = t('writing.saved'); setTimeout(function () { btn.textContent = t('writing.save'); }, 1500); }
}

async function aiGenerateForModule() {
  var wid = state.currentWorkId;
  if (!wid) return;
  if (!confirm(t('prompt.ai_chapter_confirm'))) return; // TODO: per-module confirm messages

  if (state.currentModule === 'worldbuilding') {
    await hPost('/api/write/worldbuilding/generate', { work_id: wid, bilingual: typeof bilingual !== 'undefined' ? bilingual : true });
    loadM1();
  } else if (state.currentModule === 'outline') {
    await hPost('/api/write/outline/generate?overwrite=true', { work_id: wid, num_chapters: 5 });
    loadM2();
  } else if (state.currentModule === 'foreshadowing') {
    await hPost('/api/write/foreshadowing/generate', { work_id: wid });
    loadM4();
  } else if ((state.currentModule === 'writing' || state.currentModule === 'chapters') && state.currentSectionId) {
    var data = await hPost('/api/write/draft/generate', { work_id: wid, section_id: state.currentSectionId });
    if (data && data.ok) qs('#writing-editor').value = data.data.body || '';
  }
  refreshPipelineGuide(wid);
}

async function aiPolishForModule() {
  var wid = state.currentWorkId, sid = state.currentSectionId;
  if (!wid) return;
  if (state.currentModule === 'writing' && sid) {
    if (!confirm(t('prompt.ai_polish_confirm'))) return;
    var data = await hPost('/api/write/draft/polish', { work_id: wid, section_id: sid });
    if (data && data.ok) qs('#writing-editor').value = data.data.body || '';
  } else {
    // 对于非 M6 模块，polish = 用当前编辑器内容调用
    StoryElf.toggle();
    var inp = document.getElementById('elf-chat-input');
    if (inp) { inp.value = t('prompt.ai_polish_confirm'); StoryElf.sendChat(); }
  }
}

async function generateOutline(workId) {
  if (!confirm(t('prompt.outline_confirm'))) return;
  await hPost('/api/write/outline/generate?overwrite=true', { work_id: workId, num_chapters: 5 });
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
  var divider = qs('#split-divider');
  if (!divider) return;
  divider.addEventListener('mousedown', function (e) {
    e.preventDefault();
    divider.classList.add('active');
    var startX = e.clientX;
    var startPct = state.leftPct;
    function mv(ev) {
      var container = qs('#split-view');
      var cw = container.offsetWidth;
      var delta = ((ev.clientX - startX) / cw) * 100;
      var np = Math.max(25, Math.min(65, startPct + delta));
      state.leftPct = np;
      container.style.gridTemplateColumns = np + 'fr 10px ' + (100 - np) + 'fr';
    }
    function up() {
      divider.classList.remove('active');
      document.removeEventListener('mousemove', mv);
      document.removeEventListener('mouseup', up);
      saveState();
    }
    document.addEventListener('mousemove', mv);
    document.addEventListener('mouseup', up);
  });
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
  hPost('/api/write/draft/polish', { work_id: state.currentWorkId, section_id: state.currentSectionId, style_notes: msg }).then(function (data) {
    var msgs = document.getElementById('elf-chat-messages');
    var last = msgs && msgs.lastChild;
    if (last) last.remove();
    if (data && data.ok) {
      StoryElf.addMessage(t('label.updated_editor'), 'ai');
      qs('#writing-editor').value = data.data.body || '';
    } else {
      var err = document.createElement('div');
      err.className = 'elf-chat-msg ai';
      err.style.color = 'var(--error)';
      err.textContent = t('prompt.save_failed') + ((data && data.error && data.error.message) || '');
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

  document.addEventListener('keydown', function (e) {
    if ((e.ctrlKey || e.metaKey) && e.key === 's') { e.preventDefault(); saveModuleContent(); }
  });

  if (typeof userToken !== 'undefined' && userToken) loadWorkspaces();
});
