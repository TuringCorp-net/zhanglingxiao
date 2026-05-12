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
        <button class="login-btn" onclick="${isWrite ? `var t=prompt('输入用户 Token（调试功能，未来由登录替代）',typeof userToken!=='undefined'?userToken:'');if(t){localStorage.setItem('sf_user_token',t);location.reload()}` : `alert('登录功能即将上线')`}">登录</button>
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

// — 分类标签映射 —
function categoryLabel(c) {
  const map = {
    'fantasy': '奇幻·玄幻', 'science-fiction': '科幻', 'romance': '言情·恋爱',
    'contemporary': '都市·现实', 'adventure': '动作·冒险', 'mystery-thriller': '悬疑·惊悚',
    'historical': '历史·架空', 'young-adult': '青春·成长'
  };
  return map[c] || '';
}

// — 作品卡片 —
function renderWorkCard(w) {
  const tags = (w.tags || []).slice(0, 3).map(t => `<span class="tag">#${t}</span>`).join('');
  const initial = (w.title || '?')[0];
  const cat = categoryLabel(w.category);
  return `
  <a href="/work.html?id=${w.id}" class="work-card">
    <div class="work-card-left"><div class="work-cover">${initial}</div></div>
    <div class="work-card-body">
      <h3>${escHtml(w.title)}</h3>
      <div class="meta">${escHtml(w.author)}${cat ? ` · ${cat}` : ''}</div>
      <div class="summary">${escHtml(w.summary || '暂无简介')}</div>
      <div class="tag-list">${tags}</div>
    </div>
  </a>`;
}

// — 章节列表 —
function renderChapterList(sections, workId) {
  if (!sections || sections.length === 0) return '<div class="empty">暂无章节</div>';
  return sections.map(s => `
  <a href="/read.html?work=${workId}&section=${s.id}" class="chapter-item">
    <div>
      <div class="ch-title">${escHtml(s.title)}</div>
      ${s.section_summary ? `<div class="ch-summary">${escHtml(s.section_summary)}</div>` : ''}
    </div>
    <div class="ch-wordcount">${s.word_count ? s.word_count + ' 字' : ''}</div>
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
