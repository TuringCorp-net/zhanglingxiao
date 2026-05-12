// Story Forger — 写作桌主逻辑
// 依赖：write-api.js (HTTP 层) → write-panels.js (面板渲染) → 本文件

// ============================================================
// Layer 0: State
// ============================================================

const DEFAULT_STATE = {
  currentWorkId: null,
  currentSectionId: null,
  currentSectionTitle: '',
  leftBinderCollapsed: false,
  rightBinderCollapsed: false,
  rightTab: 'info',
  leftSectionStates: {
    original_concept: false,
    synopsis: true,
    worldbuilding: false,
    characters: false,
    chapters: true,
    foreshadowing: false,
  },
  chapterFilter: 'all',
  leftWidth: 250,
  rightWidth: 280,
};

let state = { ...DEFAULT_STATE };

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem('sf_desk_state') || '{}');
    if (saved.leftSectionStates) {
      saved.leftSectionStates = { ...DEFAULT_STATE.leftSectionStates, ...saved.leftSectionStates };
    }
    Object.assign(state, DEFAULT_STATE, saved);
  } catch (e) { /* ignore */ }
}

function saveState() {
  localStorage.setItem('sf_desk_state', JSON.stringify({
    leftBinderCollapsed: state.leftBinderCollapsed,
    rightBinderCollapsed: state.rightBinderCollapsed,
    rightTab: state.rightTab,
    leftSectionStates: state.leftSectionStates,
    chapterFilter: state.chapterFilter,
    leftWidth: state.leftWidth,
    rightWidth: state.rightWidth,
  }));
}

// ============================================================
// Layer 1: DOM helpers
// ============================================================

function qs(sel) { return document.querySelector(sel); }
function qsa(sel) { return document.querySelectorAll(sel); }

function applyClasses() {
  const desk = qs('#writing-desk');
  if (!desk) return;
  desk.classList.toggle('left-collapsed', state.leftBinderCollapsed && !state.rightBinderCollapsed);
  desk.classList.toggle('right-collapsed', !state.leftBinderCollapsed && state.rightBinderCollapsed);
  desk.classList.toggle('both-collapsed', state.leftBinderCollapsed && state.rightBinderCollapsed);
  desk.style.gridTemplateColumns = `${state.leftWidth}px 1fr ${state.rightWidth}px`;

  const leftBinder = qs('#left-binder');
  const rightBinder = qs('#right-binder');
  if (leftBinder) leftBinder.classList.toggle('collapsed', state.leftBinderCollapsed);
  if (rightBinder) rightBinder.classList.toggle('collapsed', state.rightBinderCollapsed);

  const leftBtn = leftBinder?.querySelector('.binder-collapse-btn');
  const rightBtn = rightBinder?.querySelector('.binder-collapse-btn');
  if (leftBtn) leftBtn.textContent = state.leftBinderCollapsed ? '>' : '<';
  if (rightBtn) rightBtn.textContent = state.rightBinderCollapsed ? '<' : '>';
}

// ============================================================
// Layer 2: 写作引导流程 (Pipeline Guide)
// ============================================================

const PIPELINE_STEPS = [
  { id: 'M0', label: '原始构想', module: 'original_concept' },
  { id: 'M1', label: '世界观', module: 'worldbuilding' },
  { id: 'M2', label: '主线剧情', module: 'outline' },
  { id: 'M3', label: '人物卡', module: 'characters' },
  { id: 'M4', label: '伏笔/冲突', module: 'foreshadowing' },
  { id: 'M5', label: '章节蓝图', module: 'chapters' },
  { id: 'M6', label: '逐章编写', module: 'writing' },
];

async function refreshPipelineGuide(workId) {
  const guide = qs('#pipeline-guide');
  const stepsEl = qs('#pipeline-steps');
  if (!guide || !stepsEl || !workId) return;

  guide.style.display = 'block';
  stepsEl.innerHTML = '<span style="font-size:0.75rem;color:var(--text-dim)">检查中...</span>';

  const [oc, wb, outline, entities, fh, sections] = await Promise.all([
    hGet(`/api/write/original-concept/${workId}`),
    hGet(`/api/write/worldbuilding/${workId}`),
    hGet(`/api/write/outline/${workId}`),
    hGet(`/api/content/${workId}/entities`),
    hGet(`/api/write/foreshadowing/${workId}`),
    hGet(`/api/write/outline/${workId}`),
  ]);

  const statuses = {
    M0: checkOriginalConceptStatus(oc),
    M1: checkBibleStatus(wb),
    M2: checkOutlineStatus(outline),
    M3: checkEntitiesStatus(entities),
    M4: checkForeshadowingStatus(fh),
    M5: checkChapterBlueprintStatus(sections),
    M6: checkChapterContentStatus(sections),
  };

  let html = '';
  PIPELINE_STEPS.forEach((step, i) => {
    const s = statuses[step.id];
    const statusClass = s === 'done' ? 'done' : s === 'in_progress' ? 'in-progress' : 'empty';
    const isLast = i === PIPELINE_STEPS.length - 1;
    const suggested = s === 'empty' && (i === 0 || statuses[PIPELINE_STEPS[i - 1].id] === 'done');
    const stepClass = `pipeline-step ${statusClass}${suggested ? ' suggested' : ''}`;

    html += `<div class="${stepClass}" data-module="${step.module}" data-step="${step.id}" onclick="goToPipelineStep('${step.module}', '${workId}')" title="${suggested ? '建议从这里开始' : ''}">
      <span class="pipeline-label">${step.label}</span>
      <span class="pipeline-id">${step.id}</span>
    </div>`;
    if (!isLast) html += '<span class="pipeline-arrow">&rsaquo;</span>';
  });

  stepsEl.innerHTML = html;
}

function checkOriginalConceptStatus(oc) {
  if (!oc?.ok || oc.data?.is_empty) return 'empty';
  const content = oc.data?.content || '';
  return content.trim().length > 50 ? 'done' : 'in_progress';
}

function checkBibleStatus(wb) {
  if (!wb?.ok || !wb.data?.content) return 'empty';
  if (wb.data.is_template) return 'empty';
  const content = wb.data.content || '';
  const filled = content.replace(/#.*\n|>.*\n|<!--.*-->|\s/g, '').length;
  return filled > 200 ? 'done' : 'in_progress';
}

function checkOutlineStatus(outline) {
  if (!outline?.ok) return 'empty';
  const sections = outline.data?.sections || [];
  return sections.length > 0 ? 'done' : 'empty';
}

function checkEntitiesStatus(entities) {
  if (!entities?.ok) return 'empty';
  const chars = (entities.data || []).filter(e => e.type === 'character' || !e.type);
  if (chars.length === 0) return 'empty';
  return chars.length >= 3 ? 'done' : 'in_progress';
}

function checkForeshadowingStatus(fh) {
  if (!fh?.ok) return 'empty';
  if (fh.data?.is_template) return 'empty';
  return fh.data?.content ? 'done' : 'empty';
}

function checkChapterBlueprintStatus(sections) {
  if (!sections?.ok) return 'empty';
  const secs = sections.data?.sections || [];
  if (secs.length === 0) return 'empty';
  const withSummary = secs.filter(s => s.section_summary);
  return withSummary.length > 0 ? 'done' : 'in_progress';
}

function checkChapterContentStatus(sections) {
  if (!sections?.ok) return 'empty';
  const secs = sections.data?.sections || [];
  if (secs.length === 0) return 'empty';
  const withContent = secs.filter(s => s.word_count > 0);
  return withContent.length > 0 ? 'done' : 'in_progress';
}

function goToPipelineStep(module, workId) {
  if (!workId) return;

  if (state.leftBinderCollapsed) {
    state.leftBinderCollapsed = false;
    applyClasses();
  }

  const sectionMap = {
    original_concept: 'original_concept',
    worldbuilding: 'worldbuilding',
    outline: 'synopsis',
    characters: 'characters',
    foreshadowing: 'foreshadowing',
    chapters: 'chapters',
    writing: 'chapters',
  };
  const sectionName = sectionMap[module];
  if (sectionName && !state.leftSectionStates[sectionName]) {
    toggleBinderSection(sectionName);
  } else if (sectionName) {
    loadBinderContent(sectionName);
  }

  if (module === 'writing') {
    if (!state.leftSectionStates.chapters) toggleBinderSection('chapters');
  }

  saveState();
}

// ============================================================
// Layer 3: 工作区加载
// ============================================================

async function loadWorkspaces() {
  const sel = qs('#workspace-selector');
  sel.innerHTML = '<option value="">加载中...</option>';

  const data = await hGet('/api/write/works');
  if (!data || !data.ok) {
    sel.innerHTML = '<option value="">加载失败，请检查 用户 Token</option>';
    return;
  }

  const works = data.data || [];
  sel.innerHTML = '<option value="">选择作品...</option>';
  works.forEach(w => {
    sel.innerHTML += `<option value="${w.id}">${escHtml(w.title)} (${w.status})</option>`;
  });

  if (works.length > 0) {
    sel.value = works[0].id;
    onWorkspaceChange();
  }
}

function onWorkspaceChange() {
  const id = qs('#workspace-selector').value;
  if (!id) {
    qs('#writing-section-title').textContent = '选择左侧章节开始写作';
    qs('#writing-editor').value = '';
    qs('#writing-preview').innerHTML = '<div class="empty">选择作品后开始</div>';
    qs('#pipeline-guide').style.display = 'none';
    return;
  }
  state.currentWorkId = id;
  saveState();
  refreshPipelineGuide(id);
  initWritingDesk(id);
}

// ============================================================
// Layer 4: 作品级操作（被面板调用）
// ============================================================

async function generateOutline(workId) {
  if (!confirm('AI 将为此作品生成大纲，确认？')) return;
  const bodyEl = qs('.binder-section[data-section="chapters"] .binder-section-body');
  bodyEl.innerHTML = '<div class="loading" style="padding:1rem;font-size:0.8rem">AI 正在生成大纲...</div>';
  bodyEl.dataset.loaded = 'false';
  const data = await hPost(`/api/write/outline/generate?overwrite=true`, { work_id: workId, num_chapters: 5 });
  if (data?.ok) {
    loadBinderContent('chapters');
    loadBinderContent('synopsis');
    refreshPipelineGuide(workId);
  } else {
    bodyEl.innerHTML = `<div class="error" style="padding:1rem;font-size:0.8rem">生成失败: ${escHtml(data?.error?.message || '未知错误')}</div>`;
  }
}

async function createChapter(workId) {
  const title = prompt('章节标题:');
  if (!title) return;
  const resp = await hPost(`/api/write/works/${workId}/sections`, { title, section_summary: '', body: '' });
  if (resp?.ok) {
    loadBinderContent('chapters');
  } else {
    alert('创建失败: ' + (resp?.error?.message || ''));
  }
}

// ============================================================
// Layer 5: 写作区
// ============================================================

async function initWritingDesk(workId, sectionId, sectionTitle) {
  state.currentWorkId = workId;
  applyClasses();

  for (const [name, isOpen] of Object.entries(state.leftSectionStates)) {
    const body = qs(`.binder-section[data-section="${name}"] .binder-section-body`);
    const header = qs(`.binder-section[data-section="${name}"] .binder-section-header`);
    if (body) body.classList.toggle('open', isOpen);
    if (header) header.classList.toggle('open', isOpen);
  }

  const chapterBody = qs('.binder-section[data-section="chapters"] .binder-section-body');
  if (!chapterBody.dataset.loaded || state.leftSectionStates.chapters) {
    loadBinderContent('chapters');
  }

  switchRightTab(state.rightTab, true);

  if (sectionId) {
    state.currentSectionId = sectionId;
    state.currentSectionTitle = sectionTitle || '';
    qs('#writing-section-title').textContent = sectionTitle || '选择章节';
    await loadSectionIntoEditor(workId, sectionId);
    loadSectionInfo(workId, sectionId);
  } else {
    qs('#writing-section-title').textContent = '选择左侧章节开始写作';
    qs('#writing-editor').value = '';
    qs('#writing-preview').innerHTML = '<div class="empty">预览将在此显示</div>';
  }
}

async function loadSectionIntoEditor(workId, sectionId) {
  const data = await hGet(`/api/content/${workId}/sections/${sectionId}?mode=full`);
  qs('#writing-editor').value = (data?.ok && data.data.body) ? data.data.body : '';
  refreshPreview();
}

function selectSectionInDesk(sectionId, title) {
  state.currentSectionId = sectionId;
  state.currentSectionTitle = title;
  qs('#writing-section-title').textContent = title;
  loadSectionIntoEditor(state.currentWorkId, sectionId);
  loadSectionInfo(state.currentWorkId, sectionId);
  loadBinderContent('chapters');
  switchRightTab('info', true);
}

// — Markdown 预览 —

let previewTimer = null;
function refreshPreview() {
  clearTimeout(previewTimer);
  previewTimer = setTimeout(() => {
    const md = qs('#writing-editor').value;
    const preview = qs('#writing-preview');
    if (md && typeof marked !== 'undefined') {
      preview.innerHTML = marked.parse(md);
    } else if (md) {
      preview.innerHTML = `<pre>${escHtml(md)}</pre>`;
    } else {
      preview.innerHTML = '<div class="empty">预览将在此显示</div>';
    }
  }, 300);
}

// — 保存 —

async function saveCurrentSection() {
  const sectionId = state.currentSectionId;
  const workId = state.currentWorkId;
  if (!sectionId || !workId) { alert('请先选择章节'); return; }
  const body = qs('#writing-editor').value;
  const title = state.currentSectionTitle;

  const resp = await hPut(`/api/write/works/${workId}/sections/${sectionId}`, { title, body });
  if (resp?.ok) {
    const btn = qs('.writing-header-actions .btn-primary');
    btn.textContent = '已保存';
    setTimeout(() => { btn.textContent = '保存'; }, 1500);
  } else {
    alert('保存失败: ' + (resp?.error?.message || ''));
  }
}

// — AI 生成/润色 —

async function aiGenerateForSection() {
  const wid = state.currentWorkId, sid = state.currentSectionId;
  if (!wid || !sid) { alert('请先选择章节'); return; }
  if (!confirm('AI 将为此章生成内容（可能覆盖当前内容），确认？')) return;
  qs('#writing-editor').value = 'AI 生成中...';
  refreshPreview();
  const data = await hPost('/api/write/draft/generate', { work_id: wid, section_id: sid });
  if (data?.ok) {
    qs('#writing-editor').value = data.data.body || '';
    refreshPreview();
  } else {
    qs('#writing-editor').value = '';
    alert('AI 生成失败: ' + (data?.error?.message || 'AI 服务不可用'));
  }
}

async function aiPolishSection() {
  const wid = state.currentWorkId, sid = state.currentSectionId;
  if (!wid || !sid) { alert('请先选择章节'); return; }
  if (!confirm('AI 将润色当前章节，确认？')) return;
  qs('#writing-editor').value = 'AI 润色中...';
  refreshPreview();
  const data = await hPost('/api/write/draft/polish', { work_id: wid, section_id: sid });
  if (data?.ok) {
    qs('#writing-editor').value = data.data.body || '';
    refreshPreview();
  } else {
    alert('润色失败: ' + (data?.error?.message || 'AI 服务不可用'));
  }
}

// ============================================================
// Layer 6: 右活页夹
// ============================================================

function switchRightTab(tab, silent) {
  state.rightTab = tab;
  qsa('.binder-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === tab));
  qsa('.binder-tab-content').forEach(c => c.style.display = c.id === `tab-${tab}` ? 'block' : 'none');

  if (tab === 'lint' && state.currentSectionId && !silent) loadLintResults();
  if (tab === 'info' && state.currentSectionId && !silent) loadSectionInfo(state.currentWorkId, state.currentSectionId);
  if (!silent) saveState();
}

// ============================================================
// Layer 7: 活页夹折叠与宽度调整
// ============================================================

function toggleBinder(side) {
  if (side === 'left') {
    state.leftBinderCollapsed = !state.leftBinderCollapsed;
  } else {
    state.rightBinderCollapsed = !state.rightBinderCollapsed;
  }
  applyClasses();
  saveState();
}

function initBinderResize() {
  const leftHandle = qs('#left-binder .binder-resize-handle');
  const rightHandle = qs('#right-binder .binder-resize-handle');

  if (leftHandle) leftHandle.addEventListener('mousedown', (e) => startResize(e, 'left'));
  if (rightHandle) rightHandle.addEventListener('mousedown', (e) => startResize(e, 'right'));
}

function startResize(e, side) {
  e.preventDefault();
  const handle = e.target;
  handle.classList.add('active');
  const startX = e.clientX;
  const startWidth = side === 'left' ? state.leftWidth : state.rightWidth;

  function onMove(ev) {
    const delta = side === 'left' ? ev.clientX - startX : startX - ev.clientX;
    const newWidth = Math.max(180, Math.min(500, startWidth + delta));
    if (side === 'left') state.leftWidth = newWidth;
    else state.rightWidth = newWidth;
    applyClasses();
  }

  function onUp() {
    handle.classList.remove('active');
    document.removeEventListener('mousemove', onMove);
    document.removeEventListener('mouseup', onUp);
    saveState();
  }

  document.addEventListener('mousemove', onMove);
  document.addEventListener('mouseup', onUp);
}

// ============================================================
// Layer 8: 响应式辅助
// ============================================================

function togglePreview() {
  const split = qs('#writing-split');
  split.classList.toggle('preview-on');
  const btn = qs('.preview-toggle-btn');
  if (split.classList.contains('preview-on')) {
    btn.textContent = '编辑';
    refreshPreview();
  } else {
    btn.textContent = '预览';
  }
}

// ============================================================
// 初始化
// ============================================================

document.addEventListener('DOMContentLoaded', () => {
  qs('#global-nav').innerHTML = renderNav();
  const tokenInput = qs('#nav-token-input');
  if (tokenInput) tokenInput.value = userToken;
  loadState();
  applyClasses();

  qs('#writing-editor').addEventListener('input', refreshPreview);

  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
      e.preventDefault();
      const ocEditor = qs('#original-concept-editor');
      if (ocEditor && ocEditor === document.activeElement) {
        saveOriginalConcept();
      } else {
        saveCurrentSection();
      }
    }
  });

  initBinderResize();

  for (const [name, isOpen] of Object.entries(state.leftSectionStates)) {
    const body = qs(`.binder-section[data-section="${name}"] .binder-section-body`);
    const header = qs(`.binder-section[data-section="${name}"] .binder-section-header`);
    if (body) body.classList.toggle('open', isOpen);
    if (header) header.classList.toggle('open', isOpen);
  }

  if (userToken) loadWorkspaces();
});
