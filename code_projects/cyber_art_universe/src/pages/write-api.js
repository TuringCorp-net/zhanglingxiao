// Story Forger — HTTP 通信层
// 依赖全局变量：userToken, currentLang（在 write.js 中定义）

const USER_TOKEN_KEY = 'sf_user_token';
const LANG_KEY = 'sf_lang';
const BILINGUAL_KEY = 'sf_bilingual';
let userToken = localStorage.getItem(USER_TOKEN_KEY) || '';
let bilingual = localStorage.getItem(BILINGUAL_KEY) !== 'false';
// currentLang 已在 app.js 中声明为全局 var，此处仅同步初始值
currentLang = localStorage.getItem(LANG_KEY) || currentLang;

function langParam() { return `lang=${currentLang}`; }

// 带重试的 fetch 封装：最多尝试 maxRetries+1 次，每次间隔 delayMs
async function fetchWithRetry(url, options, maxRetries, delayMs) {
  maxRetries = maxRetries || 2; // 默认共 3 次尝试
  delayMs = delayMs || 500;
  for (var attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fetch(url, options);
    } catch (err) {
      if (attempt < maxRetries) {
        console.warn('fetch attempt ' + (attempt + 1) + '/' + (maxRetries + 1) + ' failed for ' + url + ', retrying in ' + delayMs + 'ms: ' + err.message);
        await new Promise(function (resolve) { setTimeout(resolve, delayMs); });
      } else {
        throw err; // 最后一次失败，向上抛出
      }
    }
  }
}

function hGet(path) {
  const sep = path.includes('?') ? '&' : '?';
  return fetchWithRetry(`${path}${sep}${langParam()}`, { headers: { 'Authorization': `Bearer ${userToken}` } })
    .then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
    .catch(err => { console.error('hGet error:', path, err.message || err); return null; });
}

function hPost(path, body) {
  const sep = path.includes('?') ? '&' : '?';
  return fetchWithRetry(`${path}${sep}${langParam()}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${userToken}` },
    body: JSON.stringify(body),
  }).then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
    .catch(err => { console.error('hPost error:', path, err.message || err); return null; });
}

function hPut(path, body) {
  const sep = path.includes('?') ? '&' : '?';
  return fetchWithRetry(`${path}${sep}${langParam()}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${userToken}` },
    body: JSON.stringify(body),
  }).then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
    .catch(err => { console.error('hPut error:', path, err.message || err); return null; });
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
  return fetchWithRetry(`${path}${sep}${langParam()}`, opts)
    .then(r => r.json())
    .catch(err => { console.error('hPatch error:', path, err); return null; });
}

// — 语言切换 —

function switchLang(lang) {
  if (lang === currentLang) return;
  currentLang = lang;
  localStorage.setItem(LANG_KEY, currentLang);
  // 更新 pill toggle 状态
  const knob = qs('.lang-knob');
  if (knob) knob.classList.toggle('right', lang === 'en');
  qsa('.lang-opt').forEach(opt => {
    opt.classList.toggle('active', opt.textContent.trim() === (lang === 'zh' ? 'CN' : 'EN'));
  });
  if (typeof state !== 'undefined' && state.currentWorkId) {
    refreshPipelineGuide(state.currentWorkId);
    // refresh rotating hint for current module
    if (typeof loadRotatingHint === 'function') {
      var m = state.currentModule;
      if (m === 'original_concept') loadRotatingHint('m0');
      else if (m === 'worldbuilding') loadRotatingHint('m1');
      else if (m === 'outline') loadRotatingHint('m2');
    }
    if (typeof switchModule === 'function') switchModule(state.currentModule);
  }
}
