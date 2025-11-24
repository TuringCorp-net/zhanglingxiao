export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;

    // If path under /games/jump and not /api/*, serve static assets
    if (!path.startsWith('/games/jump/api') && (path === '/games/jump' || path.startsWith('/games/jump/'))) {
      // map /games/jump -> /games/jump/index.html
      const assetPath = path === '/games/jump' ? '/games/jump/index.html' : path;
      const r = new Request(new URL(assetPath, url.origin), request);
      return env.ASSETS.fetch(r);
    }

    // CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: cors() });
    }

    // Legacy: support bare /api/* when running under the routes
    if (path === '/games/jump/api/leaderboard' || path === '/api/leaderboard') {
      if (request.method !== 'GET') return json({ error: 'method_not_allowed' }, cors(), 405);
      const list = await getLeaderboard(env);
      return json(list, cors());
    }
    if (path === '/games/jump/api/submit' || path === '/api/submit') {
      if (request.method !== 'POST') return json({ error: 'method_not_allowed' }, cors(), 405);
      const payload = await request.json();
      const name = (payload.name || '').trim().slice(0, 20);
      const score = Number(payload.score || 0);
      if (!name) return json({ error: 'invalid_name' }, cors(), 400);
      const result = await submitScore(env, name, score);
      return json({ ok: true, result }, cors());
    }
    if (path.startsWith('/games/jump/api/percentile') || path.startsWith('/api/percentile')) {
      if (request.method !== 'GET') return json({ error: 'method_not_allowed' }, cors(), 405);
      const score = Number(url.searchParams.get('score') || 0);
      const percent = await getPercentile(env, score);
      return json({ percent }, cors());
    }

    return json({ error: 'not_found' }, cors(), 404);
  }
};

function cors() {
  return new Headers({
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  });
}

function json(data, headers, status = 200) {
  return new Response(JSON.stringify(data), { headers, status });
}

async function getLeaderboard(env) {
  const raw = await env.JUMP_KV.get('leaderboard');
  const list = raw ? JSON.parse(raw) : [];
  list.sort((a, b) => b.score - a.score);
  return list.slice(0, 50);
}

async function submitScore(env, name, score) {
  const raw = await env.JUMP_KV.get(`user:${name}`);
  const prev = raw ? JSON.parse(raw) : { name, score: 0 };
  const best = { name, score: Math.max(Number(prev.score || 0), Number(score || 0)) };
  await env.JUMP_KV.put(`user:${name}`, JSON.stringify(best));
  const rawLb = await env.JUMP_KV.get('leaderboard');
  let lb = rawLb ? JSON.parse(rawLb) : [];
  const idx = lb.findIndex(e => e.name === name);
  if (idx >= 0) lb[idx] = best; else lb.push(best);
  lb.sort((a,b) => b.score - a.score);
  lb = lb.slice(0, 200);
  await env.JUMP_KV.put('leaderboard', JSON.stringify(lb));
  await bumpPlayerCount(env, name);
  return best;
}

async function bumpPlayerCount(env, name) {
  const raw = await env.JUMP_KV.get('players');
  let players = raw ? JSON.parse(raw) : { count: 0, names: {} };
  if (!players.names[name]) { players.names[name] = true; players.count++; }
  await env.JUMP_KV.put('players', JSON.stringify(players));
}

async function getPercentile(env, score) {
  const rawLb = await env.JUMP_KV.get('leaderboard');
  const lb = rawLb ? JSON.parse(rawLb) : [];
  if (lb.length === 0) return 0;
  const belowOrEqual = lb.filter(e => score >= Number(e.score || 0)).length;
  const percent = (belowOrEqual / lb.length) * 100;
  return Math.round(percent);
}