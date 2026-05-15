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
  leftPct: 50,
};

function loadState() {
  try {
    var saved = JSON.parse(localStorage.getItem('sf_desk_v2') || '{}');
    Object.assign(state, { chapterFilter: 'all', leftPct: 50 }, saved);
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
  refreshPipelineGuide(id);
  await switchModule('original_concept');
  updateElfContext();
}

// ============================================================
// Module Switching
// ============================================================
async function switchModule(module) {
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
  qs('#writing-editor').value = '';

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

  var data = await hGet('/api/write/original-concept/' + state.currentWorkId);
  qs('#writing-editor').value = (data && data.ok && data.data.content) ? data.data.content : '';
  ;
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
  var content = (data && data.ok && data.data && data.data.content) ? data.data.content : '';
  if (content) {
    var div = document.createElement('div');
    div.className = 'bible-rendered';
    div.innerHTML = renderBibleContent(content);
    left.appendChild(div);
  } else {
    left.appendChild(errorHTML(t('label.load_failed')));
  }
  qs('#writing-editor').value = content;
  ;
}

// ============================================================
// M3: 人物卡
// ============================================================
async function loadM3() {
  qs('#writing-editor').value = '';

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
  var data = await hGet('/api/write/works/' + state.currentWorkId + '/entities/' + entityId + '/card');
  qs('#writing-editor').value = (data && data.ok && data.data.content) ? data.data.content : '';
renderEntityCardList();
  updateElfContext();
}

// ============================================================
// M4: 伏笔账本
// ============================================================
async function loadM4() {
  qs('#writing-editor').value = '';

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
  // 解析伏笔列表（按 ### 伏笔 或 ### Hook 分割）
  var md = data.data.content;
  var items = md.split(/\n###\s*(伏笔|Hook)\s*#\d+/).filter(function (s) { return s.trim().length > 20; });
  // 如果上面没匹配到，尝试按 ## 二、后面的 ### 分割
  if (items.length === 0) {
    var sectionMatch = md.match(/## 二、伏笔条目\s*([\s\S]*)/);
    if (sectionMatch) {
      items = sectionMatch[1].split(/\n###\s+/).filter(function (s) { return s.trim().length > 20; });
    }
  }
  if (!items.length) { left.innerHTML = '<div class="left-panel-empty">' + t('label.no_foreshadowing') + '</div>'; return; }

  var frag = document.createDocumentFragment();
  items.slice(0, 20).forEach(function (item, idx) {
    var lines = item.trim().split('\n');
    var rawTitle = lines[0] ? lines[0].replace(/^#+\s*/, '').replace(/[：:]\s*\{.*$/, '').replace(/[：:].*$/, '').trim() : ('#' + (idx + 1));
    var title = rawTitle.length > 30 ? rawTitle.substring(0, 30) + '...' : rawTitle;
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
  qs('#writing-editor').value = content || '';
renderFhCardList();
}

// ============================================================
// M5 / M6: 章节蓝图 / 逐章编写
// ============================================================
async function loadM5() {
  qs('#writing-editor').value = '';

  await loadChapterCardList();
}

async function loadM6() {
  qs('#writing-editor').value = '';

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

  if (state.currentModule === 'chapters') {
    // M5: 加载意图卡，格式化显示
    var data = await hGet('/api/write/draft/intent/' + state.currentWorkId + '/' + sectionId);
    if (data && data.ok && data.data.intent) {
      var i = data.data.intent;
      var lines = [];
      lines.push('# 意图卡：' + (i.chapter_index ? '第' + i.chapter_index + '章' : title));
      lines.push('');
      lines.push('## 写作目标');
      lines.push(i.goal || '');
      if (i.emotional_goal) lines.push('\n**情绪目标**：' + i.emotional_goal);
      if (i.pov_character) lines.push('**视角角色**：' + i.pov_character + (i.pov_strategy ? '（' + i.pov_strategy + '）' : ''));
      if (i.scene_type) lines.push('**场景类型**：' + i.scene_type);
      if (i.hooks && i.hooks.length) lines.push('**钩子**：' + i.hooks.join('；'));
      if (i.foreshadowing_ids && i.foreshadowing_ids.length) lines.push('**关联伏笔**：' + i.foreshadowing_ids.join(', '));
      if (i.style_notes) lines.push('**风格备注**：' + i.style_notes);
      if (i.structure) {
        lines.push('\n## 结构');
        if (i.structure.opening_hook) lines.push('**开篇钩子**：' + i.structure.opening_hook);
        if (i.structure.reversal_point) lines.push('**反转点**：' + i.structure.reversal_point);
        if (i.structure.cliffhanger) lines.push('**章末卡点**：' + i.structure.cliffhanger);
      }
      if (i.visual_keywords) lines.push('**视觉关键词**：' + i.visual_keywords.join(' / '));
      if (i.camera_notes) lines.push('**镜头备注**：' + i.camera_notes);
      qs('#writing-editor').value = lines.join('\n');
    } else {
      qs('#writing-editor').value = '';
    }
  } else {
    // M6: 章节正文
    var d = await hGet('/api/content/' + state.currentWorkId + '/sections/' + sectionId + '?mode=full');
    qs('#writing-editor').value = (d && d.ok && d.data.body) ? d.data.body : '';
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
      if (r && r.ok) loadChapterCardList();
    });
  });
}

// ============================================================
// 编辑器操作
// ============================================================
var _autoSaveTimer = null;
function autoSave() {
  clearTimeout(_autoSaveTimer);
  _autoSaveTimer = setTimeout(function () { saveModuleContent(true); }, 2000);
}

async function saveModuleContent(silent) {
  var wid = state.currentWorkId;
  var body = qs('#writing-editor').value;
  if (!wid) return;
  var mod = state.currentModule;
  if (mod === 'original_concept') {
    await hPut('/api/write/original-concept/' + wid, { content: body });
  } else if (mod === 'worldbuilding') {
    await hPut('/api/write/worldbuilding/' + wid, { content: body });
  } else if (mod === 'writing' && state.currentSectionId) {
    await hPut('/api/write/works/' + wid + '/sections/' + state.currentSectionId, { title: state.currentSectionTitle, body: body });
  } else if (mod === 'characters' && state.currentEntityId) {
    await hPut('/api/write/works/' + wid + '/entities/' + state.currentEntityId, { description: body });
  } else if (mod === 'foreshadowing') {
    await hPut('/api/write/foreshadowing/' + wid, { content: body });
  }
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

  qs('#writing-editor').addEventListener('input', autoSave);
  document.addEventListener('keydown', function (e) {
    if ((e.ctrlKey || e.metaKey) && e.key === 's') { e.preventDefault(); saveModuleContent(); }
  });

  if (typeof userToken !== 'undefined' && userToken) loadWorkspaces();
});
