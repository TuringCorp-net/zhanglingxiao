// Story Forger — 写作桌 UI（三栏统一界面）
// 左活页夹（五大面板）+ 中写作区 + 右活页夹（AI 辅助）
// ============================================================

// — Layer 0: 用户 Token + 语言 + HTTP 封装 —
const USER_TOKEN_KEY = 'sf_user_token';
const LANG_KEY = 'sf_lang';
const BILINGUAL_KEY = 'sf_bilingual';
let userToken = localStorage.getItem(USER_TOKEN_KEY) || '';
let currentLang = localStorage.getItem(LANG_KEY) || 'zh';
let bilingual = localStorage.getItem(BILINGUAL_KEY) !== 'false'; // 默认 true（中英双语生成）

function langParam() { return `lang=${currentLang}`; }

function hGet(path) {
  const sep = path.includes('?') ? '&' : '?';
  return fetch(`${path}${sep}${langParam()}`, { headers: { 'Authorization': `Bearer ${userToken}` } })
    .then(r => r.json())
    .catch(err => { console.error('hGet error:', path, err); return null; });
}
function hPost(path, body) {
  const sep = path.includes('?') ? '&' : '?';
  return fetch(`${path}${sep}${langParam()}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${userToken}` },
    body: JSON.stringify(body),
  }).then(r => r.json())
    .catch(err => { console.error('hPost error:', path, err); return null; });
}
function hPut(path, body) {
  const sep = path.includes('?') ? '&' : '?';
  return fetch(`${path}${sep}${langParam()}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${userToken}` },
    body: JSON.stringify(body),
  }).then(r => r.json())
    .catch(err => { console.error('hPut error:', path, err); return null; });
}
function hPatch(path, body) {
  const sep = path.includes('?') ? '&' : '?';
  const opts = {
    method: 'PATCH',
    headers: { 'Authorization': `Bearer ${userToken}` },
  };
  if (body) {
    opts.headers['Content-Type'] = 'application/json';
    opts.body = JSON.stringify(body);
  }
  return fetch(`${path}${sep}${langParam()}`, opts)
    .then(r => r.json())
    .catch(err => { console.error('hPatch error:', path, err); return null; });
}

// — Layer 1: State —
const DEFAULT_STATE = {
  currentWorkId: null,
  currentSectionId: null,
  currentSectionTitle: '',
  leftBinderCollapsed: false,
  rightBinderCollapsed: false,
  rightTab: 'info',
  leftSectionStates: {
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
    // 深度合并 leftSectionStates
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

// — Layer 2: DOM helpers —
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

  // 同步 binder 折叠按钮文字
  const leftBtn = leftBinder?.querySelector('.binder-collapse-btn');
  const rightBtn = rightBinder?.querySelector('.binder-collapse-btn');
  if (leftBtn) leftBtn.textContent = state.leftBinderCollapsed ? '▶' : '◀';
  if (rightBtn) rightBtn.textContent = state.rightBinderCollapsed ? '◀' : '▶';
}

// — Layer 3: 写作引导流程 —
const PIPELINE_STEPS = [
  { id: 'M1', label: '世界观', icon: '🌍', module: 'worldbuilding' },
  { id: 'M2', label: '主线剧情', icon: '📖', module: 'outline' },
  { id: 'M3', label: '人物卡', icon: '👤', module: 'characters' },
  { id: 'M4', label: '伏笔/冲突', icon: '🎯', module: 'foreshadowing' },
  { id: 'M5', label: '章节蓝图', icon: '📋', module: 'chapters' },
  { id: 'M6', label: '逐章编写', icon: '✍️', module: 'writing' },
];

// 判定每个步骤的状态（异步检查对应 R2 资产）
async function refreshPipelineGuide(workId) {
  const guide = qs('#pipeline-guide');
  const stepsEl = qs('#pipeline-steps');
  if (!guide || !stepsEl || !workId) return;

  guide.style.display = 'block';
  stepsEl.innerHTML = '<span style="font-size:0.75rem;color:var(--text-dim)">检查中...</span>';

  // 并行检查各模块状态
  const [wb, outline, entities, fh, sections] = await Promise.all([
    hGet(`/api/write/worldbuilding/${workId}`),
    hGet(`/api/write/outline/${workId}`),
    hGet(`/api/content/${workId}/entities`),
    hGet(`/api/write/foreshadowing/${workId}`),
    hGet(`/api/write/outline/${workId}`),  // 复用 outline 数据判断章节状态
  ]);

  const statuses = {
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
    const statusIcon = s === 'done' ? '✓' : s === 'in_progress' ? '●' : '○';
    const isFirst = i === 0;
    const isLast = i === PIPELINE_STEPS.length - 1;
    const suggested = s === 'empty' && (i === 0 || statuses[PIPELINE_STEPS[i - 1].id] === 'done');
    const stepClass = `pipeline-step ${statusClass}${suggested ? ' suggested' : ''}`;

    html += `<div class="${stepClass}" data-module="${step.module}" data-step="${step.id}" onclick="goToPipelineStep('${step.module}', '${workId}')" title="${suggested ? '建议从这里开始' : ''}">
      <span class="pipeline-status">${statusIcon}</span>
      <span class="pipeline-icon">${step.icon}</span>
      <span class="pipeline-label">${step.label}</span>
      <span class="pipeline-id">${step.id}</span>
    </div>`;
    if (!isLast) {
      html += `<span class="pipeline-arrow">→</span>`;
    }
  });

  stepsEl.innerHTML = html;
}

function checkBibleStatus(wb) {
  if (!wb?.ok || !wb.data?.content) return 'empty';
  if (wb.data.is_template) return 'empty';
  // 检查是否有实质性填充（不只是模板注释）
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
  // 有章节但还没有意图卡 → 检查是否有 summary
  const withSummary = secs.filter(s => s.section_summary);
  return withSummary.length > 0 ? 'done' : 'in_progress';
}

function checkChapterContentStatus(sections) {
  if (!sections?.ok) return 'empty';
  const secs = sections.data?.sections || [];
  if (secs.length === 0) return 'empty';
  // 有章节且至少有一章有正文内容（word_count > 0）
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

// — Layer 4: 工作区加载 —
function setUserToken() {
  userToken = qs('#user-token-input').value.trim();
  localStorage.setItem(USER_TOKEN_KEY, userToken);
  loadWorkspaces();
}

function onLangChange() {
  currentLang = qs('#lang-select').value;
  localStorage.setItem(LANG_KEY, currentLang);
  if (state.currentWorkId) {
    refreshPipelineGuide(state.currentWorkId);
    for (const [name, isOpen] of Object.entries(state.leftSectionStates)) {
      if (isOpen) {
        const body = qs(`.binder-section[data-section="${name}"] .binder-section-body`);
        if (body) body.dataset.loaded = 'false';
      }
    }
    initWritingDesk(state.currentWorkId, state.currentSectionId, state.currentSectionTitle);
  }
}

function onBilingualChange() {
  bilingual = qs('#bilingual-checkbox').checked;
  localStorage.setItem(BILINGUAL_KEY, bilingual.toString());
}

function setUserToken() {
  userToken = qs('#user-token-input').value.trim();
  localStorage.setItem(USER_TOKEN_KEY, userToken);
  loadWorkspaces();
}

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
  qs('#work-actions').innerHTML = renderActions(id);
}

// — Layer 4: 工具栏操作 —
function renderActions(workId) {
  return `<button class="btn btn-ghost btn-sm" onclick="generateOutline('${workId}')" style="padding:0.3rem 0.75rem;font-size:0.8rem">🤖 生成大纲</button>
    <button class="btn btn-ghost btn-sm" onclick="createChapter('${workId}')" style="padding:0.3rem 0.75rem;font-size:0.8rem">+ 新章节</button>
    <button class="btn btn-primary btn-sm" onclick="publishWork('${workId}')" style="padding:0.3rem 0.75rem;font-size:0.8rem">📢 发布</button>`;
}

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

async function publishWork(workId) {
  if (!confirm('发布后作品将在 CAU 公开可见，确认发布？')) return;
  const data = await hPatch(`/api/write/works/${workId}/publish`);
  if (data?.ok) {
    alert('已发布！');
    loadWorkspaces();
  } else {
    alert('发布失败: ' + (data?.error?.message || '未知错误'));
  }
}

// — Layer 6: 左活页夹 —
function toggleBinderSection(sectionName) {
  state.leftSectionStates[sectionName] = !state.leftSectionStates[sectionName];
  const body = qs(`.binder-section[data-section="${sectionName}"] .binder-section-body`);
  const header = qs(`.binder-section[data-section="${sectionName}"] .binder-section-header`);
  const isOpen = state.leftSectionStates[sectionName];
  body.classList.toggle('open', isOpen);
  header.classList.toggle('open', isOpen);

  if (isOpen && !body.dataset.loaded) {
    loadBinderContent(sectionName);
  }
  saveState();
}

async function loadBinderContent(sectionName) {
  const wid = state.currentWorkId;
  if (!wid) return;
  const bodyEl = qs(`.binder-section[data-section="${sectionName}"] .binder-section-body`);
  bodyEl.innerHTML = '<div class="loading" style="padding:1rem;font-size:0.8rem">加载中...</div>';

  switch (sectionName) {
    case 'synopsis': {
      const [work, outline] = await Promise.all([
        hGet(`/api/write/works/${wid}`),
        hGet(`/api/write/outline/${wid}`),
      ]);
      if (work?.ok) {
        const w = work.data;
        let outlineHtml = '';
        if (outline?.ok && outline.data.outline_md) {
          const isTemplate = outline.data.is_template;
          outlineHtml = `<div class="binder-text-preview" style="max-height:40vh;overflow-y:auto;margin-top:0.4rem">
            ${isTemplate ? '<div class="template-notice">📋 以下为长篇框架模板。请填写或使用「🤖 生成大纲」。</div>' : ''}
            <div class="bible-content">${renderBibleContent(outline.data.outline_md)}</div>
          </div>`;
        }
        bodyEl.innerHTML = `<div style="padding:0.5rem 0.75rem;font-size:0.82rem">
          <strong>${escHtml(w.title)}</strong>
          <div class="text-dim" style="margin-top:0.3rem">${escHtml(w.summary || '暂无简介')}</div>
          <div class="text-muted" style="margin-top:0.4rem;font-size:0.72rem">
            ${escHtml(w.category || '未分类')} · ${escHtml(w.author || '')} · ${w.status === 'published' ? '已发布' : w.status === 'closed' ? '已关闭' : '草稿'}
          </div>
          ${outlineHtml}
        </div>`;
      } else {
        bodyEl.innerHTML = '<div class="error" style="padding:1rem;font-size:0.8rem">加载失败</div>';
      }
      break;
    }
    case 'worldbuilding': {
      const wb = await hGet(`/api/write/worldbuilding/${wid}`);
      if (wb?.ok && wb.data.content) {
        const isTemplate = wb.data.is_template;
        const content = wb.data.content;
        bodyEl.innerHTML = `<div class="binder-text-preview" style="max-height:55vh;overflow-y:auto">
          ${isTemplate ? '<div class="template-notice">📋 以下为设定框架。请按章节标题逐步填写，或点击下方「🤖 AI 生成」。</div>' : ''}
          <div class="bible-content">${renderBibleContent(content)}</div>
        </div>
        <div style="padding:0.25rem 0.75rem 0.5rem;display:flex;gap:0.35rem;flex-wrap:wrap">
          <button class="btn btn-ghost" style="padding:0.2rem 0.5rem;font-size:0.7rem" onclick="generateWorldbuilding('${wid}')">🤖 ${isTemplate ? 'AI 生成' : '重新生成'}</button>
          ${isTemplate ? '' : `<button class="btn btn-ghost" style="padding:0.2rem 0.5rem;font-size:0.7rem" onclick="editWorldbuilding('${wid}')">✏️ 编辑</button>`}
        </div>`;
      } else {
        bodyEl.innerHTML = `<div class="error" style="padding:1rem;font-size:0.8rem">加载失败</div>`;
      }
      break;
    }
    case 'characters': {
      const entities = await hGet(`/api/content/${wid}/entities`);
      if (entities?.ok) {
        bodyEl.innerHTML = renderCharacterTree(entities.data);
      } else {
        bodyEl.innerHTML = '<div class="error" style="padding:1rem;font-size:0.8rem">加载失败</div>';
      }
      break;
    }
    case 'chapters': {
      const outline = await hGet(`/api/write/outline/${wid}`);
      if (outline?.ok) {
        bodyEl.innerHTML = renderChapterTree(outline.data.sections);
        refreshChapterFilters();
        initChapterDragReorder();
      } else {
        bodyEl.innerHTML = '<div class="error" style="padding:1rem;font-size:0.8rem">加载失败</div>';
      }
      break;
    }
    case 'foreshadowing': {
      const fh = await hGet(`/api/write/foreshadowing/${wid}`);
      if (fh?.ok && fh.data.content) {
        const isTemplate = fh.data.is_template;
        bodyEl.innerHTML = `<div class="binder-text-preview" style="max-height:50vh;overflow-y:auto">
          ${isTemplate ? '<div class="template-notice">📋 以下为伏笔规划模板。请逐条填写你的伏笔设计，或点击下方「🤖 AI 规划」。</div>' : ''}
          <div class="bible-content">${renderBibleContent(fh.data.content)}</div>
        </div>
        <div style="padding:0.25rem 0.75rem 0.5rem">
          <button class="btn btn-ghost" style="padding:0.2rem 0.5rem;font-size:0.7rem" onclick="generateForeshadowing('${wid}')">🤖 ${isTemplate ? 'AI 规划' : '重新规划'}</button>
        </div>`;
      } else {
        bodyEl.innerHTML = `<div class="error" style="padding:1rem;font-size:0.8rem">加载失败</div>`;
      }
      break;
    }
  }
  bodyEl.dataset.loaded = 'true';
}

function renderCharacterTree(entities) {
  if (!entities?.length) return `<div class="empty" style="padding:1rem;font-size:0.8rem">
    暂无角色
    <div style="margin-top:0.4rem;font-size:0.7rem;color:var(--text-muted)">在软木板视图中点击「+ 新章节」创建大纲后，可添加角色</div>
  </div>`;
  let html = '';
  const byType = {};
  entities.forEach(e => {
    const t = e.type || 'other';
    if (!byType[t]) byType[t] = [];
    byType[t].push(e);
  });
  const labels = { character: '👤 角色', location: '📍 地点', organization: '🏛 组织', concept: '💭 概念', item: '📦 物品', term: '📖 术语', event: '📅 事件' };
  for (const [t, items] of Object.entries(byType)) {
    html += `<div class="entity-group">
      <div class="entity-group-title">${labels[t] || t}</div>
      ${items.map(e => `<div class="entity-item" data-entity-id="${e.id}" onclick="viewCharacterCard('${e.id}','${escAttr(e.name)}')">
        <span class="entity-name">${escHtml(e.name)}</span>
        ${e.first_appearance ? `<span class="entity-type-tag">ch${e.first_appearance}</span>` : ''}
      </div>`).join('')}
    </div>`;
  }
  return html;
}

async function viewCharacterCard(entityId, name) {
  const wid = state.currentWorkId;
  if (!wid) return;
  const data = await hGet(`/api/write/works/${wid}/entities/${entityId}/card`);
  if (data?.ok) {
    qs('#writing-editor').value = data.data.content || '';
    qs('#writing-section-title').textContent = `👤 ${name}`;
    refreshPreview();
  }
}

function renderChapterTree(sections) {
  if (!sections?.length) {
    const wid = state.currentWorkId;
    return `<div class="empty" style="padding:1rem;font-size:0.8rem">
      暂无章节
      <div style="margin-top:0.4rem">
        <button class="btn btn-ghost" style="padding:0.2rem 0.5rem;font-size:0.7rem" onclick="generateOutline('${wid}')">🤖 AI 生成大纲</button>
      </div>
    </div>`;
  }

  // 章节筛选
  let filtered = sections;
  if (state.chapterFilter === 'draft') {
    filtered = sections.filter(s => s.version < 2);
  } else if (state.chapterFilter === 'done') {
    filtered = sections.filter(s => s.version >= 2 && s.word_count > 0);
  }

  // 显示筛选按钮
  const filtersEl = qs('#chapter-filters');
  if (filtersEl) {
    filtersEl.style.display = sections.length > 3 ? 'flex' : 'none';
    filtersEl.querySelectorAll('.chapter-filter-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.filter === state.chapterFilter);
    });
  }

  if (filtered.length === 0) {
    return '<div class="empty" style="padding:1rem;font-size:0.8rem">没有匹配的章节</div>';
  }

  return filtered.map(s => {
    const statusIcon = s.version === 0 ? (s.word_count > 0 ? '📝' : '✍️') : (s.word_count > 0 ? '✅' : '⏳');
    const isActive = s.id === state.currentSectionId;
    return `<div class="chapter-tree-item ${isActive ? 'active' : ''}"
      draggable="true"
      onclick="selectSectionInDesk('${s.id}','${escAttr(s.title)}')" data-section-id="${s.id}">
      <span>${statusIcon}</span>
      <span style="flex:1">${escHtml(s.title)}</span>
      <span class="text-muted" style="font-size:0.7rem">${s.word_count || 0}字</span>
    </div>`;
  }).join('');
}

// 章节筛选
function setChapterFilter(filter) {
  state.chapterFilter = filter;
  loadBinderContent('chapters');
  saveState();
}

function refreshChapterFilters() {
  qsa('.chapter-filter-btn').forEach(b => {
    b.onclick = () => setChapterFilter(b.dataset.filter);
  });
}

// 章节树拖拽排序
let chapterDragSource = null;

function initChapterDragReorder() {
  const items = qsa('.chapter-tree-item');
  items.forEach(item => {
    item.addEventListener('dragstart', (e) => {
      chapterDragSource = item.dataset.sectionId;
      item.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
    });
    item.addEventListener('dragend', () => {
      item.classList.remove('dragging');
      qsa('.chapter-tree-item').forEach(i => i.classList.remove('drag-over'));
    });
    item.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      if (item.dataset.sectionId !== chapterDragSource) item.classList.add('drag-over');
    });
    item.addEventListener('dragleave', () => item.classList.remove('drag-over'));
    item.addEventListener('drop', async (e) => {
      e.preventDefault();
      item.classList.remove('drag-over');
      const targetId = item.dataset.sectionId;
      if (chapterDragSource === targetId) return;
      await reorderSections(chapterDragSource, targetId);
    });
  });
}

async function reorderSections(fromId, toId) {
  const data = await hGet(`/api/write/outline/${state.currentWorkId}`);
  if (!data?.ok) return;
  const sections = [...data.data.sections];
  const fromIdx = sections.findIndex(s => s.id === fromId);
  const toIdx = sections.findIndex(s => s.id === toId);
  if (fromIdx < 0 || toIdx < 0) return;

  const [moved] = sections.splice(fromIdx, 1);
  sections.splice(toIdx, 0, moved);
  const payload = { sections: sections.map((s, i) => ({ id: s.id, title: s.title, order_index: i })) };
  const resp = await hPut(`/api/write/outline/${state.currentWorkId}`, payload);
  if (resp?.ok) loadBinderContent('chapters');
}

// — AI 伏笔提取 —
async function generateForeshadowing(workId) {
  if (!confirm('AI 将基于大纲和世界观帮你规划伏笔网络，确认？')) return;
  const bodyEl = qs('.binder-section[data-section="foreshadowing"] .binder-section-body');
  bodyEl.innerHTML = '<div class="loading" style="padding:1rem;font-size:0.8rem">AI 规划中...</div>';
  bodyEl.dataset.loaded = 'false';
  const data = await hPost('/api/write/foreshadowing/generate', { work_id: workId });
  if (data?.ok) {
    bodyEl.dataset.loaded = 'false';
    loadBinderContent('foreshadowing');
    refreshPipelineGuide(workId);
  } else {
    bodyEl.innerHTML = `<div class="error" style="padding:1rem;font-size:0.8rem">规划失败: ${escHtml(data?.error?.message || 'AI 服务不可用')}</div>`;
  }
}

// 将 Markdown 圣经内容渲染为格式化 HTML（保留标题层级和注释）
function renderBibleContent(md) {
  if (!md) return '';
  // 简易 Markdown→HTML，保留标题层级便于活页夹展示
  let html = md
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/^# (.+)$/gm, '<h2 class="bible-h1">$1</h2>')
    .replace(/^## (.+)$/gm, '<h3 class="bible-h2">$1</h3>')
    .replace(/^### (.+)$/gm, '<h4 class="bible-h3">$1</h4>')
    .replace(/^&gt; (.+)$/gm, '<blockquote class="bible-quote">$1</blockquote>')
    .replace(/<!-- (.+?) -->/g, '<span class="bible-comment">💬 $1</span>')
    .replace(/^- \[([ x])\] (.+)$/gm, '<div class="bible-checklist"><input type="checkbox" $1disabled> $2</div>')
    .replace(/\n\n/g, '<br><br>')
    .replace(/\n/g, '<br>');
  return html;
}

function editWorldbuilding(workId) {
  // 在提示框中编辑
  hGet(`/api/write/worldbuilding/${workId}`).then(wb => {
    if (!wb?.ok || !wb.data?.content) return;
    const newContent = prompt('编辑世界观设定圣经（Markdown 格式）：', wb.data.content);
    if (newContent === null) return; // 用户取消
    hPut(`/api/write/worldbuilding/${workId}`, { content: newContent }).then(resp => {
      if (resp?.ok) {
        loadBinderContent('worldbuilding');
        refreshPipelineGuide(workId);
      } else {
        alert('保存失败: ' + (resp?.error?.message || ''));
      }
    });
  });
}

// — AI 世界观生成 —
async function generateWorldbuilding(workId) {
  const langLabel = currentLang === 'en' ? 'English' : '中文';
  const bilingualNote = bilingual ? ' + English 双语' : '';
  if (!confirm(`AI 将为此作品生成世界观设定（${langLabel}${bilingualNote}），确认？`)) return;
  const bodyEl = qs('.binder-section[data-section="worldbuilding"] .binder-section-body');
  bodyEl.innerHTML = '<div class="loading" style="padding:1rem;font-size:0.8rem">AI 生成中...</div>';
  bodyEl.dataset.loaded = 'false';
  const data = await hPost('/api/write/worldbuilding/generate', {
    work_id: workId,
    bilingual: bilingual,
  });
  if (data?.ok) {
    bodyEl.dataset.loaded = 'false';
    loadBinderContent('worldbuilding');
    refreshPipelineGuide(workId);
  } else {
    bodyEl.innerHTML = `<div class="error" style="padding:1rem;font-size:0.8rem">生成失败: ${escHtml(data?.error?.message || '未知错误')}</div>`;
  }
}

// — Layer 7: 写作区 —
async function initWritingDesk(workId, sectionId, sectionTitle) {
  state.currentWorkId = workId;
  applyClasses();

  // 恢复左活页夹折叠状态
  for (const [name, isOpen] of Object.entries(state.leftSectionStates)) {
    const body = qs(`.binder-section[data-section="${name}"] .binder-section-body`);
    const header = qs(`.binder-section[data-section="${name}"] .binder-section-header`);
    if (body) body.classList.toggle('open', isOpen);
    if (header) header.classList.toggle('open', isOpen);
  }

  // Eager load 章节树
  const chapterBody = qs('.binder-section[data-section="chapters"] .binder-section-body');
  if (!chapterBody.dataset.loaded || state.leftSectionStates.chapters) {
    loadBinderContent('chapters');
  }

  // 恢复右 Tab
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
  // 刷新章节树高亮
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
    // 短暂闪烁提示
    const btn = qs('.writing-header-actions .btn-primary');
    btn.textContent = '✅ 已保存';
    setTimeout(() => { btn.textContent = '💾 保存'; }, 1500);
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

// — Layer 8: 右活页夹 —
function switchRightTab(tab, silent) {
  state.rightTab = tab;
  qsa('.binder-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === tab));
  qsa('.binder-tab-content').forEach(c => c.style.display = c.id === `tab-${tab}` ? 'block' : 'none');

  if (tab === 'lint' && state.currentSectionId && !silent) loadLintResults();
  if (tab === 'info' && state.currentSectionId && !silent) loadSectionInfo(state.currentWorkId, state.currentSectionId);
  if (!silent) saveState();
}

async function loadSectionInfo(workId, sectionId) {
  const el = qs('#tab-info');
  el.innerHTML = '<div class="loading" style="padding:1rem;font-size:0.8rem">加载中...</div>';
  const data = await hGet(`/api/write/draft/output/${sectionId}`);
  if (data?.ok) {
    const d = data.data;
    el.innerHTML = `
      <div class="info-row"><strong>字数:</strong> ${d.word_count || 0}</div>
      <div class="info-row"><strong>版本:</strong> v${d.version || 0}</div>
      <div class="info-row">${d.audit_report?.ai_generated ? '🤖 AI 生成' : '✍️ 人工撰写'}</div>
      ${d.audit_report?.ai_polished ? '<div class="info-row">✨ 已 AI 润色</div>' : ''}
      ${d.audit_report?.unresolved_issues ? `<div class="info-row warn">⚠ 未解决问题: ${d.audit_report.unresolved_issues}</div>` : ''}
      <div class="text-muted" style="margin-top:0.5rem;font-size:0.7rem">${escHtml(d.audit_report?.disclaimer || '')}</div>
    `;
  } else {
    el.innerHTML = '<div class="error" style="padding:1rem;font-size:0.8rem">加载失败</div>';
  }
}

async function loadLintResults() {
  const wid = state.currentWorkId, sid = state.currentSectionId;
  if (!wid || !sid) return;
  const el = qs('#tab-lint');
  el.innerHTML = '<div class="loading" style="padding:1rem;font-size:0.8rem">AI 检查中...</div>';
  const data = await hPost(`/api/write/draft/check/${wid}/${sid}`, {});
  if (data?.ok) {
    const issues = data.data.issues || [];
    if (issues.length === 0) {
      el.innerHTML = '<div class="empty" style="padding:1rem;font-size:0.8rem">✅ 未发现问题</div>';
    } else {
      el.innerHTML = issues.map(i => `<div class="lint-item lint-${i.severity === 'error' ? 'error' : 'warning'}">
        <div class="lint-severity">${i.severity === 'error' ? '🔴 严重' : '⚠️ 警告'}</div>
        <div style="font-size:0.75rem"><strong>${escHtml(i.type || '')}</strong></div>
        <div class="text-dim" style="font-size:0.75rem;margin-top:0.15rem">${escHtml(i.description || '')}</div>
        ${i.suggestion ? `<div style="font-size:0.7rem;color:var(--cyan);margin-top:0.15rem">💡 ${escHtml(i.suggestion)}</div>` : ''}
      </div>`).join('');
    }
  } else {
    el.innerHTML = `<div class="error" style="padding:1rem;font-size:0.8rem">检查失败: ${escHtml(data?.error?.message || 'AI 服务不可用')}</div>`;
  }
}

async function sendChat() {
  const input = qs('#chat-input');
  const msg = input.value.trim();
  if (!msg || !state.currentSectionId) return;
  const msgsEl = qs('#chat-messages');
  msgsEl.innerHTML += `<div class="chat-msg chat-user">${escHtml(msg)}</div>`;
  input.value = '';
  msgsEl.innerHTML += '<div class="chat-msg chat-ai" id="chat-loading">AI 思考中...</div>';
  msgsEl.scrollTop = msgsEl.scrollHeight;

  const data = await hPost('/api/write/draft/polish', {
    work_id: state.currentWorkId,
    section_id: state.currentSectionId,
    style_notes: msg,
  });

  const loadingEl = qs('#chat-loading');
  if (loadingEl) loadingEl.remove();

  if (data?.ok) {
    msgsEl.innerHTML += `<div class="chat-msg chat-ai">已在写作区更新结果</div>`;
    qs('#writing-editor').value = data.data.body || '';
    refreshPreview();
  } else {
    msgsEl.innerHTML += `<div class="chat-msg chat-ai" style="color:#ef4444">出错了: ${escHtml(data?.error?.message || '')}</div>`;
  }
  msgsEl.scrollTop = msgsEl.scrollHeight;
}

// — Layer 9: 活页夹折叠与调整宽度 —
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

// — Layer 10: 响应式辅助 —
function togglePreview() {
  const split = qs('#writing-split');
  split.classList.toggle('preview-on');
  const btn = qs('.preview-toggle-btn');
  if (split.classList.contains('preview-on')) {
    btn.textContent = '✍️ 编辑';
    refreshPreview();
  } else {
    btn.textContent = '👁 预览';
  }
}

// — 初始化 —
document.addEventListener('DOMContentLoaded', () => {
  qs('#global-nav').innerHTML = renderNav();
  qs('#user-token-input').value = userToken;
  qs('#lang-select').value = currentLang;
  qs('#bilingual-checkbox').checked = bilingual;
  loadState();
  applyClasses();

  qs('#writing-editor').addEventListener('input', refreshPreview);

  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
      e.preventDefault();
      saveCurrentSection();
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
