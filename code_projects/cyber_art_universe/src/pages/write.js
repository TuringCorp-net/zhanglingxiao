// Story Forger — 写作桌 UI（软木板 + 三栏写作桌双模式）
// ============================================================

// — Layer 0: Admin Key + HTTP 封装 —
const ADMIN_KEY_KEY = 'sf_admin_key';
let adminKey = localStorage.getItem(ADMIN_KEY_KEY) || '';

// HTML 属性值转义（比 escHtml 多处理单引号，用于 onclick 等属性）
function escAttr(str) {
  if (!str) return '';
  return escHtml(str).replace(/'/g, '&#39;').replace(/\\/g, '&#92;');
}

function hGet(path) {
  return fetch(path, { headers: { 'X-Admin-Key': adminKey } })
    .then(r => r.json())
    .catch(err => { console.error('hGet error:', path, err); return null; });
}
function hPost(path, body) {
  return fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Admin-Key': adminKey },
    body: JSON.stringify(body),
  }).then(r => r.json())
    .catch(err => { console.error('hPost error:', path, err); return null; });
}
function hPut(path, body) {
  return fetch(path, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'X-Admin-Key': adminKey },
    body: JSON.stringify(body),
  }).then(r => r.json())
    .catch(err => { console.error('hPut error:', path, err); return null; });
}
function hPatch(path, body) {
  const opts = {
    method: 'PATCH',
    headers: { 'X-Admin-Key': adminKey },
  };
  if (body) {
    opts.headers['Content-Type'] = 'application/json';
    opts.body = JSON.stringify(body);
  }
  return fetch(path, opts)
    .then(r => r.json())
    .catch(err => { console.error('hPatch error:', path, err); return null; });
}

// — Layer 1: State —
const DEFAULT_STATE = {
  currentWorkId: null,
  currentSectionId: null,
  currentSectionTitle: '',
  viewMode: 'corkboard',
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
  corkboardFilter: 'all',
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
    viewMode: state.viewMode,
    leftBinderCollapsed: state.leftBinderCollapsed,
    rightBinderCollapsed: state.rightBinderCollapsed,
    rightTab: state.rightTab,
    leftSectionStates: state.leftSectionStates,
    corkboardFilter: state.corkboardFilter,
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

// — Layer 3: 工作区加载 —
function setAdminKey() {
  adminKey = qs('#admin-key-input').value.trim();
  localStorage.setItem(ADMIN_KEY_KEY, adminKey);
  loadWorkspaces();
}

async function loadWorkspaces() {
  const sel = qs('#workspace-selector');
  sel.innerHTML = '<option value="">加载中...</option>';

  const data = await hGet('/api/write/works');
  if (!data || !data.ok) {
    sel.innerHTML = '<option value="">加载失败，请检查 Admin Key</option>';
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
    qs('#corkboard').innerHTML = '<div class="loading">请选择作品...</div>';
    return;
  }
  state.currentWorkId = id;
  saveState();
  if (state.viewMode === 'writing-desk') {
    initWritingDesk(id);
  } else {
    loadCorkboard(id);
  }
  qs('#work-actions').innerHTML = renderActions(id);
}

// — Layer 4: 软木板 —
async function loadCorkboard(workId) {
  const board = qs('#corkboard');
  board.innerHTML = '<div class="loading">加载中...</div>';

  const data = await hGet(`/api/write/outline/${workId}`);
  const sections = (data && data.ok) ? (data.data.sections || []) : [];

  if (sections.length === 0) {
    board.innerHTML = `<div class="empty">
      <p>暂无章节</p>
      <button class="btn btn-primary" onclick="generateOutline('${workId}')">🤖 AI 生成大纲</button>
      <p style="margin-top:0.5rem"><button class="btn btn-ghost" onclick="createChapter('${workId}')">+ 手动添加章节</button></p>
    </div>`;
    return;
  }

  // 状态筛选
  let filtered = sections;
  if (state.corkboardFilter === 'draft') {
    filtered = sections.filter(s => s.version < 2);
  } else if (state.corkboardFilter === 'done') {
    filtered = sections.filter(s => s.version >= 2);
  }

  if (filtered.length === 0) {
    board.innerHTML = '<div class="empty">没有匹配的章节</div>';
    return;
  }

  let html = '<div class="corkboard-grid">';
  filtered.forEach(s => {
    const icon = { 0: '✍️', 1: '📝' }[s.version] || '✅';
    html += `<div class="corkboard-card" draggable="true" data-section-id="${s.id}"
      onclick="switchToDesk('${workId}','${s.id}','${escAttr(s.title)}')">
      <div class="card-status">${icon}</div>
      <div class="card-title">${escHtml(s.title)}</div>
      <div class="card-meta">${s.word_count || 0} 字 · 第${s.order_index + 1}章</div>
      ${s.section_summary ? `<div class="card-summary">${escHtml(s.section_summary)}</div>` : ''}
    </div>`;
  });
  html += '</div>';
  board.innerHTML = html;

  initDragReorder();
}

function renderActions(workId) {
  return `<button class="btn btn-ghost btn-sm" onclick="generateOutline('${workId}')" style="padding:0.3rem 0.75rem;font-size:0.8rem">🤖 生成大纲</button>
    <button class="btn btn-ghost btn-sm" onclick="createChapter('${workId}')" style="padding:0.3rem 0.75rem;font-size:0.8rem">+ 新章节</button>
    <button class="btn btn-primary btn-sm" onclick="publishWork('${workId}')" style="padding:0.3rem 0.75rem;font-size:0.8rem">📢 发布</button>`;
}

function setCorkboardFilter(filter) {
  state.corkboardFilter = filter;
  qsa('.corkboard-filter-btn').forEach(b => b.classList.toggle('active', b.dataset.filter === filter));
  if (state.currentWorkId) loadCorkboard(state.currentWorkId);
  saveState();
}

// — 拖拽排序 —
let dragSourceId = null;

function initDragReorder() {
  const cards = qsa('.corkboard-card');
  cards.forEach(card => {
    card.addEventListener('dragstart', (e) => {
      dragSourceId = card.dataset.sectionId;
      card.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
    });
    card.addEventListener('dragend', () => {
      card.classList.remove('dragging');
      qsa('.corkboard-card').forEach(c => c.classList.remove('drag-over'));
    });
    card.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      if (card.dataset.sectionId !== dragSourceId) card.classList.add('drag-over');
    });
    card.addEventListener('dragleave', () => card.classList.remove('drag-over'));
    card.addEventListener('drop', async (e) => {
      e.preventDefault();
      card.classList.remove('drag-over');
      const targetId = card.dataset.sectionId;
      if (dragSourceId === targetId) return;
      await reorderSections(dragSourceId, targetId);
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
  if (resp?.ok) loadCorkboard(state.currentWorkId);
}

// — 大纲生成 —
async function generateOutline(workId) {
  if (!confirm('AI 将为此作品生成大纲，确认？')) return;
  qs('#corkboard').innerHTML = '<div class="loading">AI 正在生成大纲...</div>';
  const data = await hPost(`/api/write/outline/generate?overwrite=true`, { work_id: workId, num_chapters: 5 });
  if (data?.ok) {
    loadCorkboard(workId);
  } else {
    alert('生成失败: ' + (data?.error?.message || '未知错误'));
    loadCorkboard(workId);
  }
}

async function createChapter(workId) {
  const title = prompt('章节标题:');
  if (!title) return;
  const resp = await hPost(`/api/write/works/${workId}/sections`, { title, section_summary: '', body: '' });
  if (resp?.ok) {
    loadCorkboard(workId);
    // 如果章节树已加载，刷新它
    const chapterBody = qs('.binder-section[data-section="chapters"] .binder-section-body');
    if (chapterBody?.dataset?.loaded) loadBinderContent('chapters');
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

// — Layer 5: 双模式切换 —
function toggleMode() {
  if (state.viewMode === 'corkboard') {
    state.viewMode = 'writing-desk';
    qs('#corkboard-mode').classList.remove('active');
    qs('#writing-desk-mode').classList.add('active');
    qs('#mode-toggle').textContent = '🗂 软木板';
    if (state.currentWorkId) initWritingDesk(state.currentWorkId);
  } else {
    state.viewMode = 'corkboard';
    qs('#writing-desk-mode').classList.remove('active');
    qs('#corkboard-mode').classList.add('active');
    qs('#mode-toggle').textContent = '🖊 写作桌';
    if (state.currentWorkId) loadCorkboard(state.currentWorkId);
  }
  saveState();
}

function switchToDesk(workId, sectionId, title) {
  state.currentWorkId = workId;
  state.currentSectionId = sectionId;
  state.currentSectionTitle = title;
  state.viewMode = 'writing-desk';
  qs('#corkboard-mode').classList.remove('active');
  qs('#writing-desk-mode').classList.add('active');
  qs('#mode-toggle').textContent = '🗂 软木板';
  initWritingDesk(workId, sectionId, title);
  saveState();
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
      const work = await hGet(`/api/write/works/${wid}`);
      if (work?.ok) {
        const w = work.data;
        bodyEl.innerHTML = `<div style="padding:0.5rem 0.75rem;font-size:0.82rem">
          <strong>${escHtml(w.title)}</strong>
          <div class="text-dim" style="margin-top:0.3rem">${escHtml(w.summary || '暂无简介')}</div>
          <div class="text-muted" style="margin-top:0.4rem;font-size:0.72rem">
            ${escHtml(w.category || '未分类')} · ${escHtml(w.author || '')} · ${w.status === 'published' ? '已发布' : w.status === 'closed' ? '已关闭' : '草稿'}
          </div>
        </div>`;
      } else {
        bodyEl.innerHTML = '<div class="error" style="padding:1rem;font-size:0.8rem">加载失败</div>';
      }
      break;
    }
    case 'worldbuilding': {
      const wb = await hGet(`/api/write/worldbuilding/${wid}`);
      if (wb?.ok && wb.data.content) {
        const preview = wb.data.content.substring(0, 600);
        bodyEl.innerHTML = `<div class="binder-text-preview">${escHtml(preview)}${wb.data.content.length > 600 ? '...' : ''}</div>
          <div style="padding:0 0.75rem 0.5rem">
            <button class="btn btn-ghost" style="padding:0.2rem 0.5rem;font-size:0.7rem" onclick="generateWorldbuilding('${wid}')">🤖 重新生成</button>
          </div>`;
      } else {
        bodyEl.innerHTML = `<div class="empty" style="padding:1rem;font-size:0.8rem">
          尚未生成世界观
          <div style="margin-top:0.5rem"><button class="btn btn-ghost" style="padding:0.2rem 0.5rem;font-size:0.7rem" onclick="generateWorldbuilding('${wid}')">🤖 AI 生成</button></div>
        </div>`;
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
      } else {
        bodyEl.innerHTML = '<div class="error" style="padding:1rem;font-size:0.8rem">加载失败</div>';
      }
      break;
    }
    case 'foreshadowing': {
      const fh = await hGet(`/api/write/foreshadowing/${wid}`);
      if (fh?.ok && fh.data.hooks?.length > 0) {
        const d = fh.data;
        const statusIcon = { planted: '🌱', developing: '🌿', resolved: '✅' };
        bodyEl.innerHTML = `<div style="padding:0.25rem 0.75rem;font-size:0.72rem;color:var(--text-muted)">
            🌱 ${d.summary.planted} · 🌿 ${d.summary.developing} · ✅ ${d.summary.resolved}
          </div>
          ${d.hooks.map((h, i) => `<div class="lint-item" style="margin:0.25rem 0.5rem;padding:0.4rem 0.5rem;font-size:0.75rem">
            <div style="display:flex;justify-content:space-between;align-items:center">
              <strong>${statusIcon[h.status] || '📌'} ${escHtml(h.description || '')}</strong>
            </div>
            <div class="text-muted" style="font-size:0.68rem;margin-top:0.1rem">${escHtml(h.planted_in || '')} → ${escHtml(h.expected_payoff_in || '?')}</div>
          </div>`).join('')}
          <div style="padding:0.25rem 0.75rem 0.5rem">
            <button class="btn btn-ghost" style="padding:0.2rem 0.5rem;font-size:0.7rem" onclick="generateForeshadowing('${wid}')">🤖 重新提取</button>
          </div>`;
      } else {
        bodyEl.innerHTML = `<div class="empty" style="padding:1rem;font-size:0.8rem">
          尚未提取伏笔
          <div style="margin-top:0.5rem"><button class="btn btn-ghost" style="padding:0.2rem 0.5rem;font-size:0.7rem" onclick="generateForeshadowing('${wid}')">🤖 AI 提取伏笔</button></div>
        </div>`;
      }
      break;
    }
  }
  bodyEl.dataset.loaded = 'true';
}

function renderCharacterTree(entities) {
  if (!entities?.length) return '<div class="empty" style="padding:1rem;font-size:0.8rem">暂无角色</div>';
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
      ${items.map(e => `<div class="entity-item" data-entity-id="${e.id}" onclick="event.stopPropagation()">
        <span class="entity-name">${escHtml(e.name)}</span>
        ${e.first_appearance ? `<span class="entity-type-tag">ch${e.first_appearance}</span>` : ''}
      </div>`).join('')}
    </div>`;
  }
  return html;
}

function renderChapterTree(sections) {
  if (!sections?.length) return '<div class="empty" style="padding:1rem;font-size:0.8rem">暂无章节</div>';
  return sections.map(s => {
    const statusIcon = { 0: '✍️', 1: '📝' }[s.version] || (s.word_count > 0 ? '✅' : '⏳');
    const isActive = s.id === state.currentSectionId;
    return `<div class="chapter-tree-item ${isActive ? 'active' : ''}"
      onclick="selectSectionInDesk('${s.id}','${escAttr(s.title)}')" data-section-id="${s.id}">
      <span>${statusIcon}</span>
      <span style="flex:1">${escHtml(s.title)}</span>
      <span class="text-muted" style="font-size:0.7rem">${s.word_count || 0}字</span>
    </div>`;
  }).join('');
}

// — AI 伏笔提取 —
async function generateForeshadowing(workId) {
  if (!confirm('AI 将扫描所有章节提取伏笔线索，确认？')) return;
  const bodyEl = qs('.binder-section[data-section="foreshadowing"] .binder-section-body');
  bodyEl.innerHTML = '<div class="loading" style="padding:1rem;font-size:0.8rem">AI 提取中...</div>';
  bodyEl.dataset.loaded = 'false';
  const data = await hPost('/api/write/foreshadowing/generate?overwrite=true', { work_id: workId });
  if (data?.ok) {
    bodyEl.dataset.loaded = 'false';
    loadBinderContent('foreshadowing');
  } else {
    bodyEl.innerHTML = `<div class="error" style="padding:1rem;font-size:0.8rem">提取失败: ${escHtml(data?.error?.message || 'AI 服务不可用')}</div>`;
  }
}

// — AI 世界观生成 —
async function generateWorldbuilding(workId) {
  if (!confirm('AI 将为此作品生成世界观设定，确认？')) return;
  const bodyEl = qs('.binder-section[data-section="worldbuilding"] .binder-section-body');
  bodyEl.innerHTML = '<div class="loading" style="padding:1rem;font-size:0.8rem">AI 生成中...</div>';
  bodyEl.dataset.loaded = 'false';
  const data = await hPost('/api/write/worldbuilding/generate', { work_id: workId });
  if (data?.ok) {
    bodyEl.dataset.loaded = 'false';
    loadBinderContent('worldbuilding');
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
  qs('#admin-key-input').value = adminKey;
  loadState();
  applyClasses();

  // 编辑器输入 → 预览
  qs('#writing-editor').addEventListener('input', refreshPreview);

  // Ctrl+S 保存
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
      e.preventDefault();
      saveCurrentSection();
    }
  });

  // 活页夹拖拽调整宽度
  initBinderResize();

  // 恢复上次模式
  if (state.viewMode === 'writing-desk') {
    qs('#corkboard-mode').classList.remove('active');
    qs('#writing-desk-mode').classList.add('active');
    qs('#mode-toggle').textContent = '🗂 软木板';
  }

  // 恢复左活页夹折叠状态
  for (const [name, isOpen] of Object.entries(state.leftSectionStates)) {
    const body = qs(`.binder-section[data-section="${name}"] .binder-section-body`);
    const header = qs(`.binder-section[data-section="${name}"] .binder-section-header`);
    if (body) body.classList.toggle('open', isOpen);
    if (header) header.classList.toggle('open', isOpen);
  }

  if (adminKey) loadWorkspaces();
});
