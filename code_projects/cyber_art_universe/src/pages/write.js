// Story Forger — 软木板 UI 脚本
const ADMIN_KEY_KEY = 'sf_admin_key';
let adminKey = localStorage.getItem(ADMIN_KEY_KEY) || '';

function hGet(path) {
  return fetch(path, { headers: { 'X-Admin-Key': adminKey } }).then(r => r.json());
}

function hPost(path, body) {
  return fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Admin-Key': adminKey },
    body: JSON.stringify(body),
  }).then(r => r.json());
}

function hPatch(path) {
  return fetch(path, {
    method: 'PATCH',
    headers: { 'X-Admin-Key': adminKey },
  }).then(r => r.json());
}

// — 页面初始化 —
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('global-nav').innerHTML = renderNav();
  document.getElementById('admin-key-input').value = adminKey;
  if (adminKey) loadWorkspaces();
});

function setAdminKey() {
  adminKey = document.getElementById('admin-key-input').value.trim();
  localStorage.setItem(ADMIN_KEY_KEY, adminKey);
  loadWorkspaces();
}

async function loadWorkspaces() {
  const sel = document.getElementById('workspace-selector');
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

  // 自动选择第一个
  if (works.length > 0) {
    sel.value = works[0].id;
    loadCorkboard(works[0].id);
  }
}

function onWorkspaceChange() {
  const id = document.getElementById('workspace-selector').value;
  if (id) loadCorkboard(id);
  else document.getElementById('corkboard').innerHTML = '';
}

// — 软木板 —
async function loadCorkboard(workId) {
  const board = document.getElementById('corkboard');
  board.innerHTML = '<div class="loading">加载中...</div>';

  const data = await hGet(`/api/write/outline/${workId}`);
  const sections = (data && data.ok) ? (data.data.sections || []) : [];

  if (sections.length === 0) {
    board.innerHTML = `<div class="empty">
      <p>暂无章节</p>
      <button class="btn btn-primary" onclick="generateOutline('${workId}')">🤖 AI 生成大纲</button>
      <p style="margin-top:0.5rem"><button class="btn btn-ghost" onclick="createChapter('${workId}')">+ 手动添加章节</button></p>
    </div>`;
    document.getElementById('work-actions').innerHTML = renderActions(workId);
    return;
  }

  let html = '<div class="corkboard-grid">';
  sections.forEach(s => {
    const icon = {0:'✍️',1:'📝'}[s.version] || '📝';
    html += `<div class="corkboard-card" onclick="openEditor('${workId}','${s.id}','${escHtml(s.title)}')">
      <div class="card-status">${icon}</div>
      <div class="card-title">${escHtml(s.title)}</div>
      <div class="card-meta">${s.word_count || 0} 字 · 第${s.order_index+1}章</div>
      ${s.section_summary ? `<div class="card-summary">${escHtml(s.section_summary)}</div>` : ''}
    </div>`;
  });
  html += '</div>';
  board.innerHTML = html;
  document.getElementById('work-actions').innerHTML = renderActions(workId);
}

function renderActions(workId) {
  return `<button class="btn btn-ghost" onclick="generateOutline('${workId}')">🤖 生成大纲</button>
    <button class="btn btn-ghost" onclick="createChapter('${workId}')">+ 新章节</button>
    <button class="btn btn-primary" onclick="publishWork('${workId}')">📢 发布</button>`;
}

// — 大纲生成 —
async function generateOutline(workId) {
  if (!confirm('AI 将为此作品生成大纲，确认？')) return;
  document.getElementById('corkboard').innerHTML = '<div class="loading">AI 正在生成大纲...</div>';
  const data = await hPost(`/api/write/outline/generate?overwrite=true`, { work_id: workId, num_chapters: 5 });
  if (data && data.ok) {
    loadCorkboard(workId);
  } else {
    alert('生成失败: ' + (data?.error?.message || '未知错误'));
    loadCorkboard(workId);
  }
}

// — 章节编辑器 —
function openEditor(workId, sectionId, title) {
  document.getElementById('editor-title').textContent = title;
  document.getElementById('editor-section-id').value = sectionId;
  document.getElementById('editor-work-id').value = workId;
  document.getElementById('editor-body').value = '';
  document.getElementById('editor-panel').style.display = 'block';
  document.getElementById('editor-body').focus();
  loadSectionContent(workId, sectionId);
}

async function loadSectionContent(workId, sectionId) {
  const data = await hGet(`/api/content/${workId}/sections/${sectionId}?mode=full`);
  if (data && data.ok && data.data.body) {
    document.getElementById('editor-body').value = data.data.body;
  }
}

function closeEditor() {
  document.getElementById('editor-panel').style.display = 'none';
}

async function saveChapter() {
  const sectionId = document.getElementById('editor-section-id').value;
  const workId = document.getElementById('editor-work-id').value;
  const body = document.getElementById('editor-body').value;
  const title = document.getElementById('editor-title').textContent;

  // 保存到 R2（通过 admin API）
  const resp = await fetch(`/api/admin/works/${workId}/sections/${sectionId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'X-Admin-Key': adminKey },
    body: JSON.stringify({ title, body }),
  }).then(r => r.json());

  if (resp && resp.ok) {
    alert('已保存');
  } else {
    alert('保存失败');
  }
}

async function aiGenerate(workId) {
  const sectionId = document.getElementById('editor-section-id').value;
  if (!confirm('AI 将为此章生成内容（可能覆盖当前内容），确认？')) return;
  document.getElementById('editor-body').value = 'AI 生成中...';

  const data = await hPost('/api/write/draft/generate', { work_id: workId, section_id: sectionId });
  if (data && data.ok) {
    document.getElementById('editor-body').value = data.data.body;
  } else {
    alert('AI 生成失败: ' + (data?.error?.message || '未知错误'));
  }
}

async function createChapter(workId) {
  const title = prompt('章节标题:');
  if (!title) return;
  const resp = await fetch(`/api/admin/works/${workId}/sections`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Admin-Key': adminKey },
    body: JSON.stringify({ title, section_summary: '', body: '' }),
  }).then(r => r.json());
  if (resp && resp.ok) {
    loadCorkboard(workId);
  } else {
    alert('创建失败');
  }
}

async function publishWork(workId) {
  if (!confirm('发布后作品将在 CAU 公开可见，确认发布？')) return;
  const data = await hPatch(`/api/write/works/${workId}/publish`);
  if (data && data.ok) {
    alert('已发布！');
    loadWorkspaces();
  } else {
    alert('发布失败: ' + (data?.error?.message || '未知错误'));
  }
}
