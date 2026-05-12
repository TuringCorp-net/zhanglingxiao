// Story Forger — HTTP 通信层
// 依赖全局变量：userToken, currentLang（在 write.js 中定义）

const USER_TOKEN_KEY = 'sf_user_token';
const LANG_KEY = 'sf_lang';
const BILINGUAL_KEY = 'sf_bilingual';
let userToken = localStorage.getItem(USER_TOKEN_KEY) || '';
let currentLang = localStorage.getItem(LANG_KEY) || 'zh';
let bilingual = localStorage.getItem(BILINGUAL_KEY) !== 'false';

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

// — 语言/双语偏好持久化 —

function setUserToken() {
  const input = qs('#nav-token-input');
  if (!input) return;
  userToken = input.value.trim();
  localStorage.setItem(USER_TOKEN_KEY, userToken);
  loadWorkspaces();
}

function switchLang(lang) {
  if (lang === currentLang) return;
  currentLang = lang;
  localStorage.setItem(LANG_KEY, currentLang);
  // 更新导航按钮状态
  qsa('.nav-lang-btn').forEach(b => b.classList.toggle('active', b.textContent.trim() === (lang === 'zh' ? 'CN' : 'EN')));
  if (typeof state !== 'undefined' && state.currentWorkId) {
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
  bilingual = qs('#nav-bilingual-checkbox').checked;
  localStorage.setItem(BILINGUAL_KEY, bilingual.toString());
}
