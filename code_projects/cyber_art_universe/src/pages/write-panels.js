// Story Forger — 面板渲染层
// 所有活页夹面板 + 右 Tab 的内容渲染函数
// 依赖：write-api.js (hGet/hPost/hPut), write.html 中的 <template>

// — 通用 HTML 片段 —

function loadingHTML() {
  return qs('#tmpl-loading').content.cloneNode(true);
}

function errorHTML(msg) {
  const el = qs('#tmpl-error').content.cloneNode(true);
  el.querySelector('.err-msg').textContent = msg || '未知错误';
  return el;
}

// — M0 原始构想 —

async function saveOriginalConcept() {
  const wid = state.currentWorkId;
  if (!wid) return;
  const editor = qs('#original-concept-editor');
  if (!editor) return;
  const content = editor.value;
  const resp = await hPut(`/api/write/original-concept/${wid}`, { content });
  if (resp?.ok) {
    const btn = qs('.oc-save-btn');
    if (btn) { btn.textContent = '已保存'; setTimeout(() => { btn.textContent = '保存'; }, 1500); }
    refreshPipelineGuide(wid);
  } else {
    alert('保存失败: ' + (resp?.error?.message || ''));
  }
}

// — 左活页夹：面板加载与渲染 —

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
  bodyEl.innerHTML = '';
  bodyEl.appendChild(loadingHTML());

  switch (sectionName) {
    case 'original_concept': {
      const oc = await hGet(`/api/write/original-concept/${wid}`);
      const content = (oc?.ok && oc.data?.content) ? oc.data.content : '';
      const tmpl = qs('#tmpl-m0-panel').content.cloneNode(true);
      tmpl.querySelector('.oc-editor').value = content;
      tmpl.querySelector('.oc-save-btn').onclick = saveOriginalConcept;
      bodyEl.innerHTML = '';
      bodyEl.appendChild(tmpl);
      break;
    }
    case 'synopsis': {
      const [work, outline] = await Promise.all([
        hGet(`/api/write/works/${wid}`),
        hGet(`/api/write/outline/${wid}`),
      ]);
      if (!work?.ok) { bodyEl.innerHTML = ''; bodyEl.appendChild(errorHTML('加载失败')); break; }
      const w = work.data;
      const tmpl = qs('#tmpl-synopsis-panel').content.cloneNode(true);
      tmpl.querySelector('.synopsis-title').textContent = w.title;
      tmpl.querySelector('.synopsis-summary').textContent = w.summary || '暂无简介';
      tmpl.querySelector('.synopsis-meta').textContent =
        `${w.category || '未分类'} · ${w.author || ''} · ${w.status === 'published' ? '已发布' : w.status === 'closed' ? '已关闭' : '草稿'}`;

      if (outline?.ok && outline.data.outline_md) {
        const isTemplate = outline.data.is_template;
        const outlineDiv = tmpl.querySelector('.synopsis-outline');
        outlineDiv.innerHTML = ''
          + (isTemplate ? '<div class="template-notice">以下为长篇框架模板。请填写或使用「AI 生成大纲」。</div>' : '')
          + '<div class="bible-content">' + renderBibleContent(outline.data.outline_md) + '</div>';
      }
      bodyEl.innerHTML = '';
      bodyEl.appendChild(tmpl);
      break;
    }
    case 'worldbuilding': {
      const wb = await hGet(`/api/write/worldbuilding/${wid}`);
      if (!wb?.ok || !wb.data.content) { bodyEl.innerHTML = ''; bodyEl.appendChild(errorHTML('加载失败')); break; }
      const isTemplate = wb.data.is_template;
      const content = wb.data.content;
      const tmpl = qs('#tmpl-worldbuilding-panel').content.cloneNode(true);
      const notice = tmpl.querySelector('.wb-notice');
      const editBtn = tmpl.querySelector('.wb-edit-btn');
      const genBtn = tmpl.querySelector('.wb-gen-btn');
      if (isTemplate) {
        notice.style.display = 'block';
        genBtn.textContent = 'AI 生成';
      } else {
        editBtn.style.display = '';
        genBtn.textContent = '重新生成';
      }
      genBtn.onclick = () => generateWorldbuilding(wid);
      editBtn.onclick = () => editWorldbuilding(wid);
      tmpl.querySelector('.wb-content').innerHTML = renderBibleContent(content);
      bodyEl.innerHTML = '';
      bodyEl.appendChild(tmpl);
      break;
    }
    case 'characters': {
      const entities = await hGet(`/api/content/${wid}/entities`);
      bodyEl.innerHTML = '';
      if (entities?.ok) {
        bodyEl.appendChild(renderCharacterTree(entities.data));
      } else {
        bodyEl.appendChild(errorHTML('加载失败'));
      }
      break;
    }
    case 'chapters': {
      const outline = await hGet(`/api/write/outline/${wid}`);
      bodyEl.innerHTML = '';
      if (outline?.ok) {
        bodyEl.appendChild(renderChapterTree(outline.data.sections));
        refreshChapterFilters();
        initChapterDragReorder();
      } else {
        bodyEl.appendChild(errorHTML('加载失败'));
      }
      break;
    }
    case 'foreshadowing': {
      const fh = await hGet(`/api/write/foreshadowing/${wid}`);
      if (!fh?.ok || !fh.data.content) { bodyEl.innerHTML = ''; bodyEl.appendChild(errorHTML('加载失败')); break; }
      const isTemplate = fh.data.is_template;
      const tmpl = qs('#tmpl-foreshadowing-panel').content.cloneNode(true);
      if (isTemplate) {
        tmpl.querySelector('.fh-notice').style.display = 'block';
        tmpl.querySelector('.fh-gen-btn').textContent = 'AI 规划';
      } else {
        tmpl.querySelector('.fh-gen-btn').textContent = '重新规划';
      }
      tmpl.querySelector('.fh-gen-btn').onclick = () => generateForeshadowing(wid);
      tmpl.querySelector('.fh-content').innerHTML = renderBibleContent(fh.data.content);
      bodyEl.innerHTML = '';
      bodyEl.appendChild(tmpl);
      break;
    }
  }
  bodyEl.dataset.loaded = 'true';
}

// — 人物树渲染 —

function renderCharacterTree(entities) {
  if (!entities?.length) {
    const div = document.createElement('div');
    div.className = 'empty';
    div.style.cssText = 'padding:1rem;font-size:0.8rem';
    div.innerHTML = '暂无角色<div style="margin-top:0.4rem;font-size:0.7rem;color:var(--text-muted)">在软木板视图中点击「+ 新章节」创建大纲后，可添加角色</div>';
    return div;
  }
  const byType = {};
  entities.forEach(e => {
    const t = e.type || 'other';
    if (!byType[t]) byType[t] = [];
    byType[t].push(e);
  });
  const labels = { character: '角色', location: '地点', organization: '组织', concept: '概念', item: '物品', term: '术语', event: '事件' };
  const frag = document.createDocumentFragment();
  for (const [t, items] of Object.entries(byType)) {
    const grp = qs('#tmpl-entity-group').content.cloneNode(true);
    grp.querySelector('.entity-group-title').textContent = labels[t] || t;
    items.forEach(e => {
      const ei = qs('#tmpl-entity-item').content.cloneNode(true);
      ei.querySelector('.entity-name').textContent = e.name;
      const tag = ei.querySelector('.entity-type-tag');
      if (e.first_appearance) tag.textContent = 'ch' + e.first_appearance;
      else tag.remove();
      const itemEl = ei.querySelector('.entity-item');
      itemEl.dataset.entityId = e.id;
      itemEl.onclick = () => viewCharacterCard(e.id, e.name);
      grp.querySelector('.entity-group').appendChild(ei);
    });
    frag.appendChild(grp);
  }
  return frag;
}

async function viewCharacterCard(entityId, name) {
  const wid = state.currentWorkId;
  if (!wid) return;
  const data = await hGet(`/api/write/works/${wid}/entities/${entityId}/card`);
  if (data?.ok) {
    qs('#writing-editor').value = data.data.content || '';
    qs('#writing-section-title').textContent = name;
    refreshPreview();
  }
}

// — 章节树渲染 —

function renderChapterTree(sections) {
  if (!sections?.length) {
    const wid = state.currentWorkId;
    const div = document.createElement('div');
    div.className = 'empty';
    div.style.cssText = 'padding:1rem;font-size:0.8rem';
    div.innerHTML = '暂无章节<div style="margin-top:0.4rem"><button class="btn btn-ghost" style="padding:0.2rem 0.5rem;font-size:0.7rem" onclick="generateOutline(\'' + wid + '\')">AI 生成大纲</button></div>';
    return div;
  }

  let filtered = sections;
  if (state.chapterFilter === 'draft') {
    filtered = sections.filter(s => s.version < 2);
  } else if (state.chapterFilter === 'done') {
    filtered = sections.filter(s => s.version >= 2 && s.word_count > 0);
  }

  const filtersEl = qs('#chapter-filters');
  if (filtersEl) {
    filtersEl.style.display = sections.length > 3 ? 'flex' : 'none';
    filtersEl.querySelectorAll('.chapter-filter-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.filter === state.chapterFilter);
    });
  }

  if (filtered.length === 0) {
    const div = document.createElement('div');
    div.className = 'empty';
    div.style.cssText = 'padding:1rem;font-size:0.8rem';
    div.textContent = '没有匹配的章节';
    return div;
  }

  const frag = document.createDocumentFragment();
  filtered.forEach(s => {
    const statusIcon = s.version === 0 ? (s.word_count > 0 ? '[draft]' : '[new]') : (s.word_count > 0 ? '[done]' : '[planned]');
    const isActive = s.id === state.currentSectionId;
    const item = qs('#tmpl-chapter-item').content.cloneNode(true);
    const root = item.querySelector('.chapter-tree-item');
    root.classList.toggle('active', isActive);
    root.dataset.sectionId = s.id;
    root.onclick = () => selectSectionInDesk(s.id, s.title);
    item.querySelector('.chapter-status-icon').textContent = statusIcon;
    item.querySelector('.chapter-title').textContent = s.title;
    item.querySelector('.chapter-wordcount').textContent = (s.word_count || 0) + '字';
    frag.appendChild(item);
  });
  return frag;
}

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

// — 章节拖拽排序 —

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

// — AI 生成 —

async function generateForeshadowing(workId) {
  if (!confirm('AI 将基于大纲和世界观帮你规划伏笔网络，确认？')) return;
  const bodyEl = qs('.binder-section[data-section="foreshadowing"] .binder-section-body');
  bodyEl.innerHTML = '';
  bodyEl.appendChild(loadingHTML());
  bodyEl.dataset.loaded = 'false';
  const data = await hPost('/api/write/foreshadowing/generate', { work_id: workId });
  if (data?.ok) {
    bodyEl.dataset.loaded = 'false';
    loadBinderContent('foreshadowing');
    refreshPipelineGuide(workId);
  } else {
    bodyEl.innerHTML = '';
    bodyEl.appendChild(errorHTML(data?.error?.message || 'AI 服务不可用'));
  }
}

function renderBibleContent(md) {
  if (!md) return '';
  let html = md
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/^# (.+)$/gm, '<h2 class="bible-h1">$1</h2>')
    .replace(/^## (.+)$/gm, '<h3 class="bible-h2">$1</h3>')
    .replace(/^### (.+)$/gm, '<h4 class="bible-h3">$1</h4>')
    .replace(/^&gt; (.+)$/gm, '<blockquote class="bible-quote">$1</blockquote>')
    .replace(/<!-- (.+?) -->/g, '<span class="bible-comment">$1</span>')
    .replace(/^- \[([ x])\] (.+)$/gm, '<div class="bible-checklist"><input type="checkbox" $1disabled> $2</div>')
    .replace(/\n\n/g, '<br><br>')
    .replace(/\n/g, '<br>');
  return html;
}

function editWorldbuilding(workId) {
  hGet(`/api/write/worldbuilding/${workId}`).then(wb => {
    if (!wb?.ok || !wb.data?.content) return;
    const newContent = prompt('编辑世界观设定圣经（Markdown 格式）：', wb.data.content);
    if (newContent === null) return;
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

async function generateWorldbuilding(workId) {
  const langLabel = currentLang === 'en' ? 'English' : '中文';
  const bilingualNote = bilingual ? ' + English 双语' : '';
  if (!confirm(`AI 将为此作品生成世界观设定（${langLabel}${bilingualNote}），确认？`)) return;
  const bodyEl = qs('.binder-section[data-section="worldbuilding"] .binder-section-body');
  bodyEl.innerHTML = '';
  bodyEl.appendChild(loadingHTML());
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
    bodyEl.innerHTML = '';
    bodyEl.appendChild(errorHTML(data?.error?.message || '未知错误'));
  }
}

// — 右活页夹：Tab 内容 —

async function loadSectionInfo(workId, sectionId) {
  const el = qs('#tab-info');
  el.innerHTML = '';
  el.appendChild(loadingHTML());
  const data = await hGet(`/api/write/draft/output/${sectionId}`);
  if (data?.ok) {
    const d = data.data;
    const tmpl = qs('#tmpl-section-info').content.cloneNode(true);
    tmpl.querySelector('.info-wordcount').textContent = d.word_count || 0;
    tmpl.querySelector('.info-version').textContent = d.version || 0;
    tmpl.querySelector('.info-ai-badge').textContent = d.audit_report?.ai_generated ? 'AI 生成' : '人工撰写';
    if (d.audit_report?.ai_polished) tmpl.querySelector('.info-polish-badge').style.display = '';
    if (d.audit_report?.unresolved_issues) {
      const issuesEl = tmpl.querySelector('.info-issues');
      issuesEl.style.display = '';
      issuesEl.textContent = '未解决问题: ' + d.audit_report.unresolved_issues;
    }
    tmpl.querySelector('.info-disclaimer').textContent = d.audit_report?.disclaimer || '';
    el.innerHTML = '';
    el.appendChild(tmpl);
  } else {
    el.innerHTML = '';
    el.appendChild(errorHTML('加载失败'));
  }
}

async function loadLintResults() {
  const wid = state.currentWorkId, sid = state.currentSectionId;
  if (!wid || !sid) return;
  const el = qs('#tab-lint');
  el.innerHTML = '';
  el.appendChild(loadingHTML());
  const data = await hPost(`/api/write/draft/check/${wid}/${sid}`, {});
  if (data?.ok) {
    const issues = data.data.issues || [];
    el.innerHTML = '';
    if (issues.length === 0) {
      const div = document.createElement('div');
      div.className = 'empty';
      div.style.cssText = 'padding:1rem;font-size:0.8rem';
      div.textContent = '未发现问题';
      el.appendChild(div);
    } else {
      issues.forEach(i => {
        const item = qs('#tmpl-lint-item').content.cloneNode(true);
        const root = item.querySelector('.lint-item');
        root.className = 'lint-item lint-' + (i.severity === 'error' ? 'error' : 'warning');
        item.querySelector('.lint-severity').textContent = i.severity === 'error' ? '严重' : '警告';
        const typeEl = item.querySelector('.lint-type');
        if (i.type) typeEl.innerHTML = '<strong>' + escHtml(i.type) + '</strong>';
        else typeEl.remove();
        item.querySelector('.lint-desc').textContent = i.description || '';
        const sugEl = item.querySelector('.lint-suggestion');
        if (i.suggestion) sugEl.textContent = i.suggestion;
        else sugEl.remove();
        el.appendChild(item);
      });
    }
  } else {
    el.innerHTML = '';
    el.appendChild(errorHTML(data?.error?.message || 'AI 服务不可用'));
  }
}

async function sendChat() {
  const input = qs('#chat-input');
  const msg = input.value.trim();
  if (!msg || !state.currentSectionId) return;
  const msgsEl = qs('#chat-messages');

  const userMsg = qs('#tmpl-chat-msg-user').content.cloneNode(true);
  userMsg.querySelector('.chat-msg').textContent = msg;
  msgsEl.appendChild(userMsg);
  input.value = '';

  const thinkingMsg = qs('#tmpl-chat-msg-ai').content.cloneNode(true);
  const thinkEl = thinkingMsg.querySelector('.chat-msg');
  thinkEl.id = 'chat-loading';
  thinkEl.textContent = 'AI 思考中...';
  msgsEl.appendChild(thinkingMsg);
  msgsEl.scrollTop = msgsEl.scrollHeight;

  const data = await hPost('/api/write/draft/polish', {
    work_id: state.currentWorkId,
    section_id: state.currentSectionId,
    style_notes: msg,
  });

  const loadingEl = qs('#chat-loading');
  if (loadingEl) loadingEl.remove();

  const aiMsg = qs('#tmpl-chat-msg-ai').content.cloneNode(true);
  const aiEl = aiMsg.querySelector('.chat-msg');
  if (data?.ok) {
    aiEl.textContent = '已在写作区更新结果';
    qs('#writing-editor').value = data.data.body || '';
    refreshPreview();
  } else {
    aiEl.style.setProperty('color', 'var(--error)');
    aiEl.textContent = '出错了: ' + (data?.error?.message || '');
  }
  msgsEl.appendChild(aiMsg);
  msgsEl.scrollTop = msgsEl.scrollHeight;
}
