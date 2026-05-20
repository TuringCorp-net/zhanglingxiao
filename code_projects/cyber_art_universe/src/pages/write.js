// Story Forger — 写作桌主逻辑（v2.0：左右分栏 + Pipeline 唯一导航 + 槽位编辑器）
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
  ]);

  // 缓存结果，后续切模块直接复用，避免重复请求
  cacheSet('original_concept', results[0]);
  cacheSet('worldbuilding', results[1]);
  cacheSet('outline', results[2]);
  cacheSet('entities', results[3]);
  cacheSet('foreshadowing', results[4]);

  updatePipelineStatuses({
    M0: checkOC(results[0]),
    M1: checkWB(results[1]),
    M2: checkOL(results[2]),
    M3: checkEN(results[3]),
    M4: checkFH(results[4]),
    M5: checkBP(results[2]),
    M6: checkCC(results[2]),
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
  cacheClear(); // 切换作品，清空模块缓存
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
// 模块数据缓存 —— 首次 pipeline 加载后复用，避免切模块时重复请求
// ============================================================
var _moduleCache = {};

function cacheGet(key) {
  return _moduleCache[key] || null;
}
function cacheSet(key, data) {
  if (data) _moduleCache[key] = data;
}
function cacheClear(keys) {
  if (!keys) { _moduleCache = {}; return; }
  (keys || []).forEach(function (k) { delete _moduleCache[k]; });
}

// ============================================================
// Rotating Hint Engine
// ============================================================
var _hintTimer = null;
var _hintIndex = {};  // {module: current index} — 跨语言切换保持不变
var _hintShown = {};  // {module: [shown indices]} — 避免短期重复
var _hintCache = {};  // {module: hints[]}

async function loadRotatingHint(module) {
  var left = qs('#split-left');
  // 移除旧提示
  var old = left.querySelector('.rotating-hint');
  if (old) old.remove();

  // 添加占位
  var el = qs('#tmpl-rotating-hint').content.cloneNode(true);
  left.appendChild(el);

  var textEl = left.querySelector('.hint-text');

  var hints = [];
  try {
    var data = await hGet('/api/write/hints/' + module + '?work_id=' + (state.currentWorkId || '') + '&_t=' + Date.now());
    if (data && data.ok) {
      hints = data.data.all || [];
    }
  } catch (e) {}

  if (hints.length === 0) return;

  // 缓存
  _hintCache[module] = hints;

  // 选一条：如果已有记录（如切语言），用同一条；否则随机
  if (_hintIndex[module] != null && _hintIndex[module] < hints.length) {
    var pick = _hintIndex[module];
  } else {
    if (!_hintShown[module]) _hintShown[module] = [];
    var shown = _hintShown[module];
    var available = [];
    for (var j = 0; j < hints.length; j++) {
      if (shown.indexOf(j) < 0) available.push(j);
    }
    if (available.length === 0) {
      _hintShown[module] = [];
      available = hints.map(function (_, k) { return k; });
    }
    var pick = available[Math.floor(Math.random() * available.length)];
  }
  _hintIndex[module] = pick;
  _hintShown[module].push(pick);

  textEl.innerHTML = marked.parse(hints[pick]);

  // 设置下一次轮换（60-120 分钟随机）
  clearTimeout(_hintTimer);
  _hintTimer = setTimeout(function () {
    rotateHint(module);
  }, 3600000); // 1 小时
}

function rotateHint(module) {
  if (!_hintCache[module]) { loadRotatingHint(module); return; }

  var hints = _hintCache[module];
  var textEl = qs('#split-left .hint-text');
  if (!textEl) return;

  var shown = _hintShown[module] || [];
  var available = [];
  for (var i = 0; i < hints.length; i++) {
    if (shown.indexOf(i) < 0) available.push(i);
  }
  if (available.length === 0) {
    _hintShown[module] = [];
    available = hints.map(function (_, k) { return k; });
  }
  var pick = available[Math.floor(Math.random() * available.length)];
  _hintIndex[module] = pick;
  _hintShown[module].push(pick);

  // 动画：淡出再淡入
  var container = textEl.closest('.rotating-hint');
  if (container) {
    container.style.opacity = '0';
    container.style.transition = 'opacity 0.3s';
    setTimeout(function () {
      textEl.innerHTML = marked.parse(hints[pick]);
      container.style.opacity = '1';
    }, 350);
  } else {
    textEl.innerHTML = marked.parse(hints[pick]);
  }

  // 下次轮换
  clearTimeout(_hintTimer);
  _hintTimer = setTimeout(function () {
    rotateHint(module);
  }, 3600000); // 1 小时
}

// ============================================================
// Slot Editor Engine
// ============================================================
var _slotData = null; // 缓存的 parse 结果，用于序列化

function escSlot(s) {
  return s.replace(/<!--/g, '<\\!--');
}
function unescSlot(s) {
  return s.replace(/<\\!--/g, '<!--');
}

// 解析模板 markdown → { groups: [{title, segments}], freeContent }
function parseSlotTemplate(md) {
  if (!md) return { groups: [{ title: '', segments: [] }], freeContent: '' };

  var sepRe = /\n---\n/g;
  var sepPositions = [];
  var m;
  while ((m = sepRe.exec(md)) !== null) {
    sepPositions.push(m.index);
  }

  var templateArea = md;
  var freeContent = '';

  if (sepPositions.length > 0) {
    var lastIdx = sepPositions[sepPositions.length - 1];
    templateArea = md.substring(0, lastIdx);
    freeContent = md.substring(lastIdx + 5).trim();
  }

  var groupParts = templateArea.split(/\n---\n/);
  var groups = [];
  for (var g = 0; g < groupParts.length; g++) {
    var gm = groupParts[g].trim();
    if (!gm) continue;
    console.log('[slot] parseGroup[' + g + '] gm len=' + gm.length);
    var segments = parseSegments(gm);
    console.log('[slot] parseGroup[' + g + '] result=' + segments.length);
    var title = '';
    var tm = gm.match(/^###\s+(.+)$/m);
    if (tm) title = tm[1].trim();
    groups.push({ title: title, segments: segments });
  }

  if (groups.length === 0) {
    groups.push({ title: '', segments: [] });
  }

  return { groups: groups, freeContent: freeContent };
}

// 三标记分离格式：<!-- hint:text --> <!-- slot --> ... <!-- /slot -->
// 解析前预归一化：多行 hint 压成单行，彻底消除死循环风险
function parseSegments(md) {
  // 预归一化：<!-- hint:...\n...\n...--> → <!-- hint:... -->
  md = md.replace(/<!--\s*hint:([\s\S]*?)-->/g, function(_, body) {
    return '<!-- hint:' + body.replace(/\n/g, ' ').trim() + ' -->';
  });

  var segments = [];
  var lines = md.split('\n');
  var i = 0;
  var pendingHint = '';

  while (i < lines.length) {
    var line = lines[i];

    // <!-- hint:text --> — 单行（已归一化，必然有 -->）
    var hm = line.match(/^\s*<!--\s*hint:\s*(.+?)\s*-->\s*$/);
    if (hm) {
      pendingHint = hm[1].trim();
      i++;
      continue;
    }

    // <!-- slot -->
    if (/^\s*<!--\s*slot\s*-->\s*$/.test(line)) {
      var content = '';
      i++;
      while (i < lines.length) {
        var nl = lines[i];
        if (/^\s*<!--\s*\/slot\s*-->\s*$/.test(nl)) { i++; break; }
        content += (content ? '\n' : '') + nl;
        i++;
      }
      segments.push({ type: 'slot', label: pendingHint, content: unescSlot(content.trim()) });
      pendingHint = '';
      continue;
    }

    // Framework
    if (line.trim()) {
      var fw = '';
      while (i < lines.length) {
        var fl = lines[i];
        if (/^\s*<!--\s*(?:hint:|slot\s*-->|\/slot\s*-->)/.test(fl)) break;
        fw += (fw ? '\n' : '') + fl;
        i++;
      }
      if (fw.trim()) {
        var html;
        try { html = marked.parse(fw.trim()); }
        catch (e) { html = renderBibleContent(fw.trim()); }
        segments.push({ type: 'framework', html: html, _md: fw.trim() });
      }
    } else {
      i++;
    }
  }

  return segments;
}



// 渲染槽位编辑器到 DOM
function renderSlotEditor(data) {
  _slotData = data;
  var groupsEl = document.getElementById('slot-groups');
  if (!groupsEl) return;
  groupsEl.innerHTML = '';

  // 检测是否有可编辑槽位
  var hasSlots = false;
  (data.groups || []).forEach(function (g) {
    (g.segments || []).forEach(function (s) {
      if (s.type === 'slot') hasSlots = true;
    });
  });

  if (!hasSlots) {
    // 无槽位：整个内容放入自由编辑区
    var freeArea = document.getElementById('slot-free-area');
    if (freeArea) {
      var raw = '';
      (data.groups || []).forEach(function (g) {
        (g.segments || []).forEach(function (s) {
          if (s._md) raw += (raw ? '\n' : '') + s._md;
        });
      });
      if (data.freeContent) raw += (raw ? '\n\n---\n\n' : '') + data.freeContent;
      freeArea.value = raw || data.freeContent || '';
    }
    return;
  }

  var multiGroup = data.groups.length > 1;

  (data.groups || []).forEach(function (group, gi) {
    if (multiGroup) {
      // 多 group（M4）：卡片式
      var gEl = document.createElement('div');
      gEl.className = 'slot-group';

      if (group.title) {
        var hdr = document.createElement('div');
        hdr.className = 'slot-group-header';
        var ttl = document.createElement('span');
        ttl.className = 'slot-group-title';
        ttl.textContent = group.title;
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
      }

      var body = document.createElement('div');
      body.className = 'slot-group-body';

      (group.segments || []).forEach(function (seg) {
        appendSegment(body, seg);
      });

      gEl.appendChild(body);
      groupsEl.appendChild(gEl);
    } else {
      // 单 group（M1/M2/M3）：平铺，无卡片包裹
      (group.segments || []).forEach(function (seg) {
        appendSegment(groupsEl, seg);
      });
    }
  });

  // [+] 仅多 group 时显示
  if (multiGroup) {
    var addBtn = document.createElement('button');
    addBtn.className = 'slot-group-add';
    addBtn.textContent = '+ 添加条目';
    addBtn.addEventListener('click', addSlotGroup);
    groupsEl.appendChild(addBtn);
  }

  function appendSegment(parent, seg) {
    if (seg.type === 'framework') {
      var fwDiv = document.createElement('div');
      fwDiv.className = 'slot-framework';
      fwDiv.innerHTML = seg.html;
      parent.appendChild(fwDiv);
    } else if (seg.type === 'slot') {
      var item = document.createElement('div');
      item.className = 'slot-item';
      var ta = document.createElement('textarea');
      ta.className = 'slot-textarea';
      ta.rows = Math.max(2, Math.min(6, (seg.content || '').split('\n').length));
      ta.value = seg.content || '';
      ta.placeholder = seg.label;
      item.appendChild(ta);
      parent.appendChild(item);
    }
  }

  // 自由编辑区
  var freeArea = document.getElementById('slot-free-area');
  if (freeArea) {
    freeArea.value = data.freeContent || '';
  }
}

// 序列化槽位内容 → 完整 markdown
function serializeSlotContent() {
  if (!_slotData) return '';
  var groupsEl = document.getElementById('slot-groups');
  if (!groupsEl) return '';

  // 无槽位：直接返回自由编辑区内容
  var textareas = groupsEl.querySelectorAll('.slot-textarea');
  if (textareas.length === 0) {
    var freeArea = document.getElementById('slot-free-area');
    return freeArea ? freeArea.value : '';
  }

  var result = '';
  var taIdx = 0;

  _slotData.groups.forEach(function (group, gi) {
    if (gi > 0) result += '\n---\n\n';

    group.segments.forEach(function (seg) {
      if (seg.type === 'framework') {
        result += (result ? '\n' : '') + (seg._md || '');
      } else if (seg.type === 'slot') {
        result += (result && !result.endsWith('\n') ? '\n' : '') + '<!-- hint:' + seg.label + ' -->\n<!-- slot -->\n';
        var val = '';
        if (taIdx < textareas.length) {
          val = textareas[taIdx].value.trim();
          taIdx++;
        }
        result += escSlot(val) + '\n<!-- /slot -->\n';
      }
    });
    if (result && !result.endsWith('\n\n')) result += '\n';
  });

  var freeArea = document.getElementById('slot-free-area');
  var freeContent = freeArea ? freeArea.value.trim() : '';
  if (freeContent) {
    result += '\n---\n\n' + freeContent + '\n';
  }

  return result.trim() + '\n';
}

// 添加/删除 group
function addSlotGroup() {
  if (!_slotData || !_slotData.groups || _slotData.groups.length === 0) return;
  var lastGroup = _slotData.groups[_slotData.groups.length - 1];
  var newNum = _slotData.groups.length + 1;
  var newTitle = lastGroup.title ? lastGroup.title.replace(/#\d+/, '#' + newNum) : '';
  var newSegments = lastGroup.segments.map(function (seg) {
    if (seg.type === 'slot') return { type: 'slot', label: seg.label, content: '' };
    return { type: 'framework', html: seg.html, _md: seg._md };
  });
  _slotData.groups.push({ title: newTitle, segments: newSegments });
  renderSlotEditor(_slotData);
}

function removeSlotGroup(btn) {
  var groupEl = btn.closest('.slot-group');
  if (!groupEl || !_slotData) return;
  var groupsEl = document.getElementById('slot-groups');
  var allGroups = groupsEl.querySelectorAll('.slot-group');
  var idx = Array.prototype.indexOf.call(allGroups, groupEl);
  if (idx >= 0 && _slotData.groups.length > 1) {
    _slotData.groups.splice(idx, 1);
    renderSlotEditor(_slotData);
  }
}

// 显示/切换编辑器类型
function showSlotEditor(md) {
  var te = qs('#writing-editor');
  var se = qs('#slot-editor');
  var fe = qs('#form-editor');
  if (te) te.style.display = 'none';
  if (fe) fe.style.display = 'none';
  if (se) {
    se.style.display = 'flex';
    se.style.flexDirection = 'column';
    se.style.overflowY = 'auto';
    se.style.flex = '1';
    console.log('[slot] showSlotEditor start, md len=' + (md||'').length);
    var parsed = parseSlotTemplate(md);
    console.log('[slot] parseSlotTemplate done, groups=' + (parsed.groups||[]).length);
    renderSlotEditor(parsed);
    console.log('[slot] renderSlotEditor done');
  }
}

function showTextEditor(val) {
  var te = qs('#writing-editor');
  var se = qs('#slot-editor');
  var fe = qs('#form-editor');
  if (se) se.style.display = 'none';
  if (fe) fe.style.display = 'none';
  if (te) {
    te.style.display = 'block';
    te.value = val || '';
  }
}

function showFormEditor(intentData) {
  var te = qs('#writing-editor');
  var se = qs('#slot-editor');
  var fe = qs('#form-editor');
  if (te) te.style.display = 'none';
  if (se) se.style.display = 'none';
  if (!fe) return;
  fe.style.display = 'block';

  var fields = [
    { key: 'goal', label: '写作目标', type: 'textarea', hint: '本章的核心写作目标是什么？' },
    { key: 'emotional_goal', label: '情绪目标', type: 'input', hint: '希望读者产生什么情绪？' },
    { key: 'pov_character', label: '视角角色', type: 'input', hint: '本章以谁的视角展开？' },
    { key: 'pov_strategy', label: '视角策略', type: 'input', hint: '第一人称/第三人称限制/第三人称全知？' },
    { key: 'scene_type', label: '场景类型', type: 'input', hint: '对话/动作/内心/描写/混合？' },
    { key: 'opening_hook', label: '开篇钩子', type: 'textarea', hint: '如何抓住读者的注意力？' },
    { key: 'reversal_point', label: '反转点', type: 'textarea', hint: '本章的转折或意外？' },
    { key: 'cliffhanger', label: '章末卡点', type: 'textarea', hint: '如何让读者迫不及待翻下一章？' },
    { key: 'hooks', label: '钩子', type: 'input', hint: '逗号分隔' },
    { key: 'foreshadowing_ids', label: '关联伏笔', type: 'input', hint: '逗号分隔的伏笔 ID' },
    { key: 'style_notes', label: '风格备注', type: 'textarea', hint: '本章的风格提示' },
    { key: 'visual_keywords', label: '视觉关键词', type: 'input', hint: '逗号分隔' },
    { key: 'camera_notes', label: '镜头备注', type: 'textarea', hint: '如果有镜头/分镜想法' },
  ];

  var container = document.getElementById('form-fields');
  if (!container) return;
  container.innerHTML = '';

  fields.forEach(function (f) {
    var div = document.createElement('div');
    div.className = 'form-field';
    var lbl = document.createElement('div');
    lbl.className = 'form-field-label';
    lbl.textContent = f.label;
    div.appendChild(lbl);

    var val = '';
    if (f.key === 'opening_hook' || f.key === 'reversal_point' || f.key === 'cliffhanger') {
      val = (intentData && intentData.structure && intentData.structure[f.key]) || '';
    } else if (f.key === 'hooks' || f.key === 'foreshadowing_ids' || f.key === 'visual_keywords') {
      var arr = (intentData && intentData[f.key]) || [];
      val = Array.isArray(arr) ? arr.join(', ') : '';
    } else {
      val = (intentData && intentData[f.key]) || '';
    }

    if (f.type === 'textarea') {
      var ta = document.createElement('textarea');
      ta.className = 'form-field-textarea';
      ta.dataset.fieldKey = f.key;
      ta.value = val;
      ta.rows = f.key === 'goal' ? 3 : 2;
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
    if (key === 'hooks' || key === 'foreshadowing_ids' || key === 'visual_keywords') {
      result[key] = val ? val.split(/[,;，；]/).map(function (s) { return s.trim(); }).filter(Boolean) : [];
    } else if (key === 'opening_hook' || key === 'reversal_point' || key === 'cliffhanger') {
      if (!result.structure) result.structure = {};
      result.structure[key] = val;
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
  console.log('[SF:M0] load start, workId=' + state.currentWorkId);
  var left = qs('#split-left');
  left.innerHTML = '';
  loadRotatingHint('m0');

  var data = cacheGet('original_concept') || await hGet('/api/write/original-concept/' + state.currentWorkId);
  if (data) cacheSet('original_concept', data);
  console.log('[SF:M0] API response:', data ? 'ok=' + data.ok : 'NULL', data && data.data ? 'hasData' : 'noData');
  var content = (data && data.ok && data.data && data.data.content) ? data.data.content : '';
  console.log('[SF:M0] content len=' + content.length + ', is_empty=' + (data && data.data && data.data.is_empty));
  showTextEditor(content);
}

// ============================================================
// M1: 世界观
// ============================================================
async function loadM1() { loadBibleModule('worldbuilding', '/api/write/worldbuilding/'); }

// ============================================================
// M2: 主线剧情（独立实现——API 返回 outline_md 而非 content）
// ============================================================
async function loadM2() {
  console.log('[SF:M2] load start, workId=' + state.currentWorkId);
  var left = qs('#split-left');
  left.innerHTML = '';
  // 优先从缓存读取
  var cached = cacheGet('outline');
  if (!cached) left.appendChild(loadingHTML());
  var data = cached || await hGet('/api/write/outline/' + state.currentWorkId);
  if (data && !cached) cacheSet('outline', data);
  console.log('[SF:M2] API response:', data ? 'ok=' + data.ok : 'NULL', data && data.data ? 'keys=' + Object.keys(data.data).join(',') : 'noData');
  left.innerHTML = '';
  var outlineMd = (data && data.ok && data.data && data.data.outline_md) ? data.data.outline_md : '';
  console.log('[SF:M2] outline_md len=' + outlineMd.length + ', sections=' + (data && data.data && data.data.sections ? data.data.sections.length : 0));
  // 左面板：轮换提示
  loadRotatingHint('m2');

  if (outlineMd) {
    showSlotEditor(outlineMd);
  } else {
    console.log('[SF:M2] FAILED: no outline_md');
    showTextEditor('');
  }
}

async function loadBibleModule(module, apiPath) {
  console.log('[SF:M1] loadBibleModule start, module=' + module + ' path=' + apiPath);
  var left = qs('#split-left');
  left.innerHTML = '';
  // 优先从缓存读取，命中则无需 loading
  var cached = cacheGet('worldbuilding');
  if (!cached) left.appendChild(loadingHTML());
  var data = cached || await hGet(apiPath + state.currentWorkId);
  if (data && !cached) cacheSet('worldbuilding', data);
  console.log('[SF:M1] API response:', data ? 'ok=' + data.ok : 'NULL', data && data.data ? 'keys=' + Object.keys(data.data).join(',') : 'noData');
  left.innerHTML = '';
  var content = (data && data.ok && data.data && data.data.content) ? data.data.content : '';
  console.log('[SF:M1] content len=' + content.length + ', is_template=' + (data && data.data && data.data.is_template));
  // 左面板：轮换提示
  loadRotatingHint('m1');

  if (content) {
    showSlotEditor(content);
  } else {
    console.log('[SF:M1] FAILED: no content');
    showTextEditor('');
  }
}

// ============================================================
// M3: 人物卡
// ============================================================
async function loadM3() {
  showTextEditor('');

  await renderEntityCardList();
}

async function renderEntityCardList() {
  console.log('[SF:M3] renderEntityCardList start');
  var left = qs('#split-left');
  left.innerHTML = '';
  // 优先从缓存读取
  var cached = cacheGet('entities');
  if (!cached) left.appendChild(loadingHTML());
  var data = cached || await hGet('/api/content/' + state.currentWorkId + '/entities');
  if (data && !cached) cacheSet('entities', data);
  console.log('[SF:M3] API response:', data ? 'ok=' + data.ok : 'NULL', 'entities=' + (data && data.data ? data.data.length : 0));
  left.innerHTML = '';
  if (!data || !data.ok) { left.appendChild(errorHTML(t('label.load_failed'))); return; }

  var entities = data.data || [];
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
  console.log('[SF:M3] rendered ' + entities.length + ' entities in ' + Object.keys(byType).length + ' type groups');
}

async function openEntityCard(entityId, name) {
  state.currentEntityId = entityId;
  var data = await hGet('/api/write/works/' + state.currentWorkId + '/entities/' + entityId + '/card');
  var content = (data && data.ok && data.data.content) ? data.data.content : '';
  showSlotEditor(content);
renderEntityCardList();
  updateElfContext();
}

// ============================================================
// M4: 伏笔账本 — 与 M3 统一：左侧 entity 列表，右侧单文件编辑
// ============================================================
async function loadM4() {
  showTextEditor('');

  // 加载策略总览（foreshadowing.md）到右侧
  var data = await hGet('/api/write/foreshadowing/' + state.currentWorkId);
  var content = (data && data.ok && data.data && data.data.content) ? data.data.content : '';
  if (content) {
    showSlotEditor(content);
  } else {
    showTextEditor('');
  }

  await renderFhCardList();
}

async function renderFhCardList() {
  console.log('[SF:M4] renderFhCardList start');
  var left = qs('#split-left');
  left.innerHTML = '';
  left.appendChild(loadingHTML());
  var cached = cacheGet('entities');
  var data = cached || await hGet('/api/content/' + state.currentWorkId + '/entities');
  if (!cached && data) cacheSet('entities', data);
  left.innerHTML = '';
  if (!data || !data.ok) { left.appendChild(errorHTML(t('label.load_failed'))); return; }

  var entities = (data.data || []).filter(function (e) { return e.type === 'foreshadowing'; });

  // 策略总览入口（始终在顶部）
  var frag = document.createDocumentFragment();
  var overviewCard = document.createElement('div');
  overviewCard.style.cssText = 'padding:0.35rem 0.75rem;margin-bottom:0.4rem;font-size:0.78rem;cursor:pointer;border-radius:6px;border:1px solid var(--border);color:var(--cyan);';
  overviewCard.textContent = '📋 ' + (t('label.fh_strategy') || '伏笔策略总览');
  overviewCard.addEventListener('click', async function () {
    state.currentFhId = null;
    var d = await hGet('/api/write/foreshadowing/' + state.currentWorkId);
    var c = (d && d.ok && d.data && d.data.content) ? d.data.content : '';
    showSlotEditor(c);
    renderFhCardList();
  });
  frag.appendChild(overviewCard);

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
  console.log('[SF:M4] rendered ' + entities.length + ' foreshadowing entities');
}

async function openFhCard(entityId, name) {
  state.currentFhId = entityId;
  var data = await hGet('/api/write/works/' + state.currentWorkId + '/entities/' + entityId + '/card');
  var content = (data && data.ok && data.data.content) ? data.data.content : '';
  showSlotEditor(content);
  renderFhCardList();
  updateElfContext();
}

// ============================================================
// M5 / M6: 章节蓝图 / 逐章编写
// ============================================================
async function loadM5() {
  showTextEditor('');

  await loadChapterCardList();
}

async function loadM6() {
  showTextEditor('');

  await loadChapterCardList();
}

async function loadChapterCardList() {
  console.log('[SF:M5/M6] loadChapterCardList start, module=' + state.currentModule);
  var left = qs('#split-left');
  left.innerHTML = '';
  // 优先从缓存读取
  var cached = cacheGet('outline');
  if (!cached) left.appendChild(loadingHTML());
  var data = cached || await hGet('/api/write/outline/' + state.currentWorkId);
  if (data && !cached) cacheSet('outline', data);
  console.log('[SF:M5/M6] API response:', data ? 'ok=' + data.ok : 'NULL', 'sections=' + (data && data.data && data.data.sections ? data.data.sections.length : 0));
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
  console.log('[SF:openChapter] start, module=' + state.currentModule + ' sectionId=' + (sectionId||'').substring(0,8) + ' title=' + title);
  state.currentSectionId = sectionId;
  state.currentSectionTitle = title;

  if (state.currentModule === 'chapters') {
    // M5: 加载意图卡，格式化显示
    var url = '/api/write/draft/intent/' + state.currentWorkId + '/' + sectionId;
    console.log('[SF:openChapter:M5] fetching intent: ' + url);
    var data = await hGet(url);
    console.log('[SF:openChapter:M5] intent response:', data ? 'ok=' + data.ok : 'NULL', data && data.data ? 'hasIntent=' + !!data.data.intent : 'noData');
    if (data && data.ok && data.data.intent) {
      showFormEditor(data.data.intent);
    } else {
      showFormEditor({ goal: '', chapter_index: (title.match(/(\d+)/) || [])[1] });
    }
  } else {
    // M6: 章节正文 — 自由编辑
    var url2 = '/api/content/' + state.currentWorkId + '/sections/' + sectionId + '?mode=full';
    console.log('[SF:openChapter:M6] fetching section: ' + url2);
    var d = await hGet(url2);
    console.log('[SF:openChapter:M6] section response:', d ? 'ok=' + d.ok : 'NULL', 'bodyLen=' + (d && d.ok && d.data && d.data.body ? d.data.body.length : 0));
    showTextEditor((d && d.ok && d.data.body) ? d.data.body : '');
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
  if (!wid) return;
  var mod = state.currentModule;

  if (mod === 'original_concept') {
    var body = qs('#writing-editor').value;
    await hPut('/api/write/original-concept/' + wid, { content: body });
  } else if (mod === 'worldbuilding') {
    await hPut('/api/write/worldbuilding/' + wid, { content: serializeSlotContent() });
  } else if (mod === 'outline') {
    await hPut('/api/write/outline/' + wid, { outline_md: serializeSlotContent() });
  } else if (mod === 'writing' && state.currentSectionId) {
    var body = qs('#writing-editor').value;
    await hPut('/api/write/works/' + wid + '/sections/' + state.currentSectionId, { title: state.currentSectionTitle, body: body });
  } else if (mod === 'characters' && state.currentEntityId) {
    await hPut('/api/write/works/' + wid + '/entities/' + state.currentEntityId + '/card', { content: serializeSlotContent() });
  } else if (mod === 'foreshadowing' && state.currentFhId) {
    // 单条伏笔卡 → entities card API
    await hPut('/api/write/works/' + wid + '/entities/' + state.currentFhId + '/card', { content: serializeSlotContent() });
  } else if (mod === 'foreshadowing' && !state.currentFhId) {
    // 策略总览 → foreshadowing.md
    await hPut('/api/write/foreshadowing/' + wid, { content: serializeSlotContent() });
  } else if (mod === 'chapters' && state.currentSectionId) {
    // M5: 表单编辑 → 通过 POST intent 保存
    try {
      var intentObj = JSON.parse(serializeFormContent());
      intentObj.work_id = wid;
      intentObj.section_id = state.currentSectionId;
      intentObj.chapter_index = intentObj.chapter_index || (state.currentSectionTitle.match(/(\d+)/) || [])[1];
      await hPost('/api/write/draft/intent', intentObj);
    } catch (e) {
      console.error('[SF:save] M5 serialize failed:', e);
    }
  }
  refreshPipelineGuide(wid);
}

async function aiGenerateForModule() {
  var wid = state.currentWorkId;
  if (!wid) return;
  if (!confirm(t('prompt.ai_chapter_confirm'))) return; // TODO: per-module confirm messages

  if (state.currentModule === 'worldbuilding') {
    cacheClear(['worldbuilding']);
    await hPost('/api/write/worldbuilding/generate', { work_id: wid, bilingual: typeof bilingual !== 'undefined' ? bilingual : true });
    loadM1();
  } else if (state.currentModule === 'outline') {
    cacheClear(['outline']);
    await hPost('/api/write/outline/generate?overwrite=true', { work_id: wid, num_chapters: 5 });
    loadM2();
  } else if (state.currentModule === 'foreshadowing') {
    cacheClear(['foreshadowing']);
    await hPost('/api/write/foreshadowing/generate', { work_id: wid });
    loadM4();
  } else if ((state.currentModule === 'writing' || state.currentModule === 'chapters') && state.currentSectionId) {
    var data = await hPost('/api/write/draft/generate', { work_id: wid, section_id: state.currentSectionId });
    if (data && data.ok) showTextEditor(data.data.body || '');
  }
  refreshPipelineGuide(wid);
}

async function aiPolishForModule() {
  var wid = state.currentWorkId, sid = state.currentSectionId;
  if (!wid) return;
  if (state.currentModule === 'writing' && sid) {
    if (!confirm(t('prompt.ai_polish_confirm'))) return;
    var data = await hPost('/api/write/draft/polish', { work_id: wid, section_id: sid });
    if (data && data.ok) showTextEditor(data.data.body || '');
  } else {
    // 对于非 M6 模块，polish = 用当前编辑器内容调用
    StoryElf.toggle();
    var inp = document.getElementById('elf-chat-input');
    if (inp) { inp.value = t('prompt.ai_polish_confirm'); StoryElf.sendChat(); }
  }
}

async function generateOutline(workId) {
  if (!confirm(t('prompt.outline_confirm'))) return;
  cacheClear(['outline']);
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

  // slot editor / writing editor / form editor 输入时自动保存
  // textarea 高度自适应由 CSS field-sizing: content 处理，无需 JS
  qs('#writing-editor').addEventListener('input', autoSave);
  qs('#slot-editor').addEventListener('input', function (e) {
    if (e.target.tagName === 'TEXTAREA') autoSave();
  });
  document.addEventListener('keydown', function (e) {
    if ((e.ctrlKey || e.metaKey) && e.key === 's') { e.preventDefault(); saveModuleContent(); }
  });

  if (typeof userToken !== 'undefined' && userToken) loadWorkspaces();
});
