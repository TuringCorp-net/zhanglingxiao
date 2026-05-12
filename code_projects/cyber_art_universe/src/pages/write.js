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
  desk.classList.toggle('left-collapsed', state.leftBinderCollapsed);
  desk.style.gridTemplateColumns = state.leftBinderCollapsed ? '60px 1fr' : `${state.leftWidth}px 1fr`;

  const leftBinder = qs('#left-binder');
  if (leftBinder) leftBinder.classList.toggle('collapsed', state.leftBinderCollapsed);

  const leftBtn = leftBinder?.querySelector('.binder-collapse-btn');
  if (leftBtn) leftBtn.textContent = state.leftBinderCollapsed ? '>' : '<';
}

// ============================================================
// Layer 2: 写作引导流程 (Pipeline Guide)
// ============================================================

const PIPELINE_STEPS = [
  { id: 'M0', module: 'original_concept' },
  { id: 'M1', module: 'worldbuilding' },
  { id: 'M2', module: 'outline' },
  { id: 'M3', module: 'characters' },
  { id: 'M4', module: 'foreshadowing' },
  { id: 'M5', module: 'chapters' },
  { id: 'M6', module: 'writing' },
];

function plabel(step) { return t('pipeline.' + step.id); }

function renderPipelineSkeleton(stepsEl, workId) {
  let html = '';
  PIPELINE_STEPS.forEach((step, i) => {
    html += `<div class="pipeline-step empty" data-module="${step.module}" data-step="${step.id}" onclick="goToPipelineStep('${step.module}', '${workId}')">
      <span class="pipeline-label">${plabel(step)}</span>
      <span class="pipeline-id">${step.id}</span>
    </div>`;
    if (i < PIPELINE_STEPS.length - 1) html += '<span class="pipeline-arrow">&rsaquo;</span>';
  });
  stepsEl.innerHTML = html;
}

function updatePipelineStatuses(statuses) {
  PIPELINE_STEPS.forEach((step, i) => {
    const el = qs(`.pipeline-step[data-step="${step.id}"]`);
    if (!el) return;
    const s = statuses[step.id];
    const cls = s === 'done' ? 'done' : s === 'in_progress' ? 'in-progress' : 'empty';
    const prev = i > 0 ? statuses[PIPELINE_STEPS[i - 1].id] : null;
    const suggested = s === 'empty' && (i === 0 || prev === 'done');
    el.className = `pipeline-step ${cls}${suggested ? ' suggested' : ''}`;
    el.title = suggested ? '建议从这里开始' : '';
    el.querySelector('.pipeline-label').textContent = plabel(step);
  });
}

async function refreshPipelineGuide(workId) {
  const guide = qs('#pipeline-guide');
  const stepsEl = qs('#pipeline-steps');
  if (!guide || !stepsEl || !workId) return;
  guide.style.display = 'block';

  renderPipelineSkeleton(stepsEl, workId);

  const [oc, wb, outline, entities, fh, sections] = await Promise.all([
    hGet(`/api/write/original-concept/${workId}`),
    hGet(`/api/write/worldbuilding/${workId}`),
    hGet(`/api/write/outline/${workId}`),
    hGet(`/api/content/${workId}/entities`),
    hGet(`/api/write/foreshadowing/${workId}`),
    hGet(`/api/write/outline/${workId}`),
  ]);

  updatePipelineStatuses({
    M0: checkOriginalConceptStatus(oc),
    M1: checkBibleStatus(wb),
    M2: checkOutlineStatus(outline),
    M3: checkEntitiesStatus(entities),
    M4: checkForeshadowingStatus(fh),
    M5: checkChapterBlueprintStatus(sections),
    M6: checkChapterContentStatus(sections),
  });
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
  updateElfContext();
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

  if (sectionId) {
    state.currentSectionId = sectionId;
    state.currentSectionTitle = sectionTitle || '';
    qs('#writing-section-title').textContent = sectionTitle || t('writing.select_title');
    await loadSectionIntoEditor(workId, sectionId);
  } else {
    qs('#writing-section-title').textContent = t('writing.select_title');
    qs('#writing-editor').value = '';
    qs('#writing-preview').innerHTML = '<div class="empty">' + t('label.preview_holder') + '</div>';
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
  loadBinderContent('chapters');
  updateElfContext();
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
// Layer 6: Story Elf — Write 侧行为覆盖
// ============================================================

StoryElf.setPage('write');

// 更新上下文：告诉 Elf 用户正在写什么
function updateElfContext() {
  StoryElf.setContext({
    page: 'write',
    work_id: state.currentWorkId,
    section_id: state.currentSectionId,
    section_title: state.currentSectionTitle,
  });
}

// 设置 Write 侧操作按钮
StoryElf.setActions([
  { label: '检', title: '检查', onClick: function () { StoryElf.toggle(); if (state.currentSectionId) loadLintResults(); } },
  { label: '议', title: '建议', onClick: function () { StoryElf.toggle(); var inp = document.getElementById('elf-chat-input'); if (inp) { inp.value = t('prompt.ai_polish_confirm'); StoryElf.sendChat(); } } },
]);

// 覆盖 sendChat：Write 侧调用 AI polish
StoryElf.sendChat = function () {
  var msg = StoryElf.getInput();
  if (!msg || !state.currentSectionId) return;
  StoryElf.addMessage(msg, 'user');
  StoryElf.clearInput();
  StoryElf.addMessage(t('label.ai_thinking'), 'ai');
  var loadingEl = document.querySelector('#elf-chat-messages .elf-chat-msg:last-child');

  hPost('/api/write/draft/polish', {
    work_id: state.currentWorkId,
    section_id: state.currentSectionId,
    style_notes: msg,
  }).then(function (data) {
    if (loadingEl) loadingEl.remove();
    if (data && data.ok) {
      StoryElf.addMessage(t('label.updated_editor'), 'ai');
      qs('#writing-editor').value = data.data.body || '';
      refreshPreview();
    } else {
      var errEl = document.createElement('div');
      errEl.className = 'elf-chat-msg ai';
      errEl.style.color = 'var(--error)';
      errEl.textContent = t('prompt.save_failed') + ((data && data.error && data.error.message) || '');
      var msgs = document.getElementById('elf-chat-messages');
      if (msgs) { msgs.appendChild(errEl); msgs.scrollTop = msgs.scrollHeight; }
    }
  });
};

// ============================================================
// Layer 7: 活页夹折叠与宽度调整
// ============================================================

function toggleBinder(side) {
  if (side === 'left') {
    state.leftBinderCollapsed = !state.leftBinderCollapsed;
  }
  applyClasses();
  saveState();
}

function initBinderResize() {
  const leftHandle = qs('#left-binder .binder-resize-handle');
  if (leftHandle) leftHandle.addEventListener('mousedown', (e) => startResize(e, 'left'));
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
