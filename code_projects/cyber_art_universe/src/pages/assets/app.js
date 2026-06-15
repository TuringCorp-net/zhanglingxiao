/* ============================================================
   Cyber Art Universe — 共享脚本
   API 封装 / Markdown 渲染 / UI 组件
   ============================================================ */

// — API 封装 —
const BASE = '';

async function api(path) {
  try {
    const res = await fetch(BASE + path);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (!data.ok) throw new Error(data.error?.message || 'Unknown error');
    return data;
  } catch (err) {
    console.error('API error:', path, err);
    return null;
  }
}

// — 全局语言（Read/Write 共享，write-api.js 按需覆盖值） —
var currentLang = (function() {
  try { return localStorage.getItem('sf_lang') || 'zh'; }
  catch (e) { return 'zh'; }
})();

// — URL 参数 —
function getParam(name) {
  return new URLSearchParams(window.location.search).get(name);
}

// — 日期格式化 —
function formatDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' });
}

// — 全局导航 —
function renderNav() {
  const isWrite = document.body && document.body.dataset.page === 'write';
  const lang = (typeof currentLang !== 'undefined') ? currentLang : 'zh';
  return `
  <nav class="top-nav">
    <div class="container">
      <a href="/" class="nav-brand">Cyber <span>Art</span> Universe</a>
      <div class="nav-tabs">
        <a href="/" class="nav-tab ${isWrite ? '' : 'active'}">Read</a>
        <a href="/write.html" class="nav-tab ${isWrite ? 'active' : ''}">Write</a>
      </div>
      <div class="nav-right">
        <div class="lang-pill" onclick="switchLang(currentLang === 'zh' ? 'en' : 'zh')" title="切换语言">
          <span class="lang-knob ${lang === 'en' ? 'right' : ''}"></span>
          <span class="lang-opt ${lang === 'zh' ? 'active' : ''}">CN</span>
          <span class="lang-opt ${lang === 'en' ? 'active' : ''}">EN</span>
        </div>
        <button class="login-btn" onclick="${isWrite ? `var tk=prompt(t('prompt.token_debug'),typeof userToken!=='undefined'?userToken:'');if(tk){localStorage.setItem('sf_user_token',tk);location.reload()}` : `alert(t('prompt.login_coming'))`}" data-i18n="nav.login">${t('nav.login')}</button>
      </div>
    </div>
  </nav>`;
}

// — 语言切换（共享版本，Write 页面会被 write-api.js 覆盖） —
function switchLang(lang) {
  if (typeof currentLang !== 'undefined' && lang === currentLang) return;
  localStorage.setItem('sf_lang', lang);
  location.reload();
}

// — Story Elf 共享函数（v2.7: 拖拽/切换统一由 story-elf.js 处理） —
// 以下为兼容旧代码的薄封装，新逻辑见 story-elf.js 的 bindEvents / _floatToggle
function toggleElf() {
  if (typeof StoryElf !== 'undefined' && StoryElf._floatToggle) {
    StoryElf._floatToggle();
  }
}
function startElfDrag(e) {
  // v2.7: 拖拽已由 story-elf.js 的 bindEvents 统一处理，此处为兼容占位
  // 不再重复实现，避免事件冲突
}

function initElfPosition() {
  var elf = document.getElementById('story-elf');
  if (!elf) return;
  var saved;
  try { saved = JSON.parse(localStorage.getItem('sf_elf_pos')); } catch (x) {}
  elf.style.left = (saved && saved.l) || (window.innerWidth - 250) + 'px';
  elf.style.top = (saved && saved.t) || (window.innerHeight - 300) + 'px';
}
document.addEventListener('DOMContentLoaded', function () { setTimeout(initElfPosition, 0); });

// ============================================================
// 左栏垂直分割 — 共享工厂（Write / Read 页面共用）
// ============================================================

/**
 * 创建左栏垂直分割管理器。
 * 返回 { setMode, applySplit, initDrag } 三个方法。
 *
 * @param {object} opts
 * @param {function} opts.getPct  - () => number  获取 upper 百分比
 * @param {function} opts.setPct  - (v) => void   设置 upper 百分比
 * @param {function} opts.onSave  - () => void    拖拽结束回调（持久化）
 */
function createLeftPanelSplit(opts) {
  function setMode(mode) {
    var upper = document.getElementById('left-upper');
    var divider = document.getElementById('left-hdivider');
    var lower = document.getElementById('left-lower');

    if (mode === 'full') {
      if (upper) { upper.innerHTML = ''; upper.style.display = 'none'; }
      if (divider) divider.style.display = 'none';
      if (lower) lower.style.flex = '1';
    } else {
      if (upper) upper.style.display = '';
      if (divider) divider.style.display = '';
      if (lower) lower.style.flex = '1';
      applySplit();
    }
  }

  function applySplit() {
    var upper = document.getElementById('left-upper');
    var divider = document.getElementById('left-hdivider');
    var container = document.getElementById('split-left');
    if (!upper || !divider || !container) return;
    var upperPct = opts.getPct() || 40;
    var totalH = container.offsetHeight;
    var dividerH = 8;
    var availH = Math.max(totalH - dividerH, 100);
    upper.style.height = (availH * upperPct / 100) + 'px';
    upper.style.flex = 'none';
  }

  function initDrag() {
    var container = document.getElementById('split-left');
    var divider = document.getElementById('left-hdivider');
    if (!container || !divider) return;

    divider.addEventListener('mousedown', function (e) {
      e.preventDefault();
      divider.classList.add('active');
      var startY = e.clientY;
      var startPct = opts.getPct() || 40;

      function mv(ev) {
        var ch = container.offsetHeight;
        var delta = ((ev.clientY - startY) / ch) * 100;
        var newPct = Math.max(15, Math.min(85, startPct + delta));
        opts.setPct(newPct);
        applySplit();
      }

      function up() {
        divider.classList.remove('active');
        document.removeEventListener('mousemove', mv);
        document.removeEventListener('mouseup', up);
        if (opts.onSave) opts.onSave();
      }

      document.addEventListener('mousemove', mv);
      document.addEventListener('mouseup', up);
    });
  }

  return { setMode: setMode, applySplit: applySplit, initDrag: initDrag };
}

// ============================================================
// Reader Split-View 布局（index / work / read 页面共用）
// ============================================================
var _readerLayoutState = {
  leftPanelUpperPct: 40,
};

function loadReaderLayoutState() {
  try {
    var saved = JSON.parse(localStorage.getItem('sf_reader_v1') || '{}');
    Object.assign(_readerLayoutState, { leftPanelUpperPct: 40 }, saved);
  } catch (e) {}
}

function saveReaderLayoutState() {
  try {
    localStorage.setItem('sf_reader_v1', JSON.stringify(_readerLayoutState));
  } catch (e) {}
}

var _readerLeftPanel = createLeftPanelSplit({
  getPct: function () { return _readerLayoutState.leftPanelUpperPct; },
  setPct: function (v) { _readerLayoutState.leftPanelUpperPct = v; },
  onSave: saveReaderLayoutState,
});

function setReaderLeftPanelMode(mode) { _readerLeftPanel.setMode(mode); }
function applyReaderLeftPanelSplit() { _readerLeftPanel.applySplit(); }
function initReaderLeftPanelHDrag() { _readerLeftPanel.initDrag(); }

/** 初始化 Reader 分栏布局 + Elf 嵌入 */
function initReaderSplitView(mode) {
  loadReaderLayoutState();
  _readerLeftPanel.setMode(mode);
  _readerLeftPanel.initDrag();

  var lower = document.getElementById('left-lower');
  if (lower && typeof StoryElf !== 'undefined') {
    StoryElf.mount(lower);
  }

  // 隐藏右栏和第二条分隔线（Reader 页面都是两栏模式）
  var d2 = document.getElementById('split-divider-2');
  var right = document.querySelector('.split-right');
  if (d2) d2.style.display = 'none';
  if (right) right.style.display = 'none';
  applyReaderGridColumns();
}

/** Reader 两栏 Grid: 左栏 + 分隔线 + 中栏撑满 */
function applyReaderGridColumns() {
  var container = document.getElementById('split-view');
  if (!container) return;
  var leftPct = _readerLayoutState.leftPct || 30;
  container.style.gridTemplateColumns = leftPct + '% 8px ' + (100 - leftPct) + '% 0px 0%';
}

// — 分类标签映射 —
function categoryLabel(c) {
  return t('category.' + c, '');
}

// — 作品卡片点击：直接解析目标章节，避免中间跳转 —
function openWork(workId) {
  // 1) 检查 localStorage 上次阅读位置（同步，立即跳转）
  var sectionId = null;
  try {
    var data = JSON.parse(localStorage.getItem('sf_last_read') || '{}');
    sectionId = data[workId] || null;
  } catch (e) {}

  if (sectionId) {
    window.location.href = '/read.html?work=' + workId + '&section=' + sectionId;
    return false;
  }

  // 2) 没有记录 → 异步获取第一章
  fetch('/api/content/' + workId + '/outline')
    .then(function (r) { return r.json(); })
    .then(function (outlineData) {
      var sections = (outlineData && outlineData.data && outlineData.data.sections) || [];
      var firstId = sections.length > 0 ? sections[0].id : '';
      window.location.href = '/read.html?work=' + workId + (firstId ? '&section=' + firstId : '');
    })
    .catch(function () {
      window.location.href = '/read.html?work=' + workId;
    });

  return false; // 阻止 <a> 默认跳转
}

// — 作品卡片 —
function renderWorkCard(w) {
  const tags = (w.tags || []).slice(0, 3).map(t => `<span class="tag">#${t}</span>`).join('');
  const initial = (w.title || '?')[0];
  const cat = categoryLabel(w.category);
  return `
  <a href="/read.html?work=${w.id}" class="work-card" onclick="return openWork('${w.id}')">
    <div class="work-card-left"><div class="work-cover">${initial}</div></div>
    <div class="work-card-body">
      <h3>${escHtml(w.title)}</h3>
      <div class="meta">${escHtml(w.author)}${cat ? ` · ${cat}` : ''}</div>
      <div class="summary">${escHtml(w.summary || t('label.no_summary'))}</div>
      <div class="tag-list">${tags}</div>
    </div>
  </a>`;
}

// — 章节列表 —
function renderChapterList(sections, workId) {
  if (!sections || sections.length === 0) return '<div class="empty">' + t('label.no_chapters') + '</div>';
  return sections.map(s => `
  <a href="/read.html?work=${workId}&section=${s.id}" class="chapter-item">
    <div>
      <div class="ch-title">${escHtml(s.title)}</div>
      ${s.section_summary ? `<div class="ch-summary">${escHtml(s.section_summary)}</div>` : ''}
    </div>
    <div class="ch-wordcount">${s.word_count ? s.word_count + t('label.word_count') : ''}</div>
  </a>`).join('');
}

// — 类型/状态标签 —
function typeLabel(t) {
  const map = { novel: '小说', series: '系列', setting: '设定集', character: '角色卡', outline: '大纲', article: '文章' };
  return map[t] || t;
}

function statusLabel(s) {
  const map = { ongoing: '连载中', completed: '已完结', draft: '草稿' };
  return map[s] || s;
}

// — HTML 转义 —
function escHtml(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// — 页面初始化 —
function initPage(title) {
  document.title = title ? `${title} — Cyber Art Universe` : 'Cyber Art Universe';
  document.addEventListener('DOMContentLoaded', () => {
    const navEl = document.getElementById('global-nav');
    if (navEl) navEl.innerHTML = renderNav();
  });
}
