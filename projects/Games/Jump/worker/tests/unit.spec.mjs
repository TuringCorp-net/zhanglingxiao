import { describe, it, expect } from 'vitest';
import worker from '../src/index.js';

function createEnv(kv = {}) {
  // Minimal in-memory KV for tests
  const store = new Map(Object.entries(kv));
  const JUMP_KV = {
    async get(key) { return store.get(key) ?? null; },
    async put(key, val) { store.set(key, val); },
  };
  const ASSETS = { fetch: () => new Response('ASSET', { status: 200 }) };
  return { JUMP_KV, ASSETS, _store: store };
}

async function call(path, { method = 'GET', body, env } = {}) {
  const url = `https://example.com${path}`;
  const init = { method, headers: { 'Content-Type': 'application/json' } };
  if (body) init.body = JSON.stringify(body);
  const req = new Request(url, init);
  const res = await worker.fetch(req, env);
  const text = await res.text();
  return { res, text };
}

describe('Jump Worker unit', () => {
  it('serves assets under /games/jump/', async () => {
    const env = createEnv();
    const { res, text } = await call('/games/jump/', { env });
    expect(res.status).toBe(200);
    expect(text).toBe('ASSET');
  });

  it('leaderboard GET returns empty initially', async () => {
    const env = createEnv();
    const { res, text } = await call('/games/jump/api/leaderboard', { env });
    expect(res.status).toBe(200);
    expect(text).toBe('[]');
  });

  it('submit POST stores best score and updates leaderboard', async () => {
    const env = createEnv();
    const payload = { name: 'Alice', score: 10 };
    const { res } = await call('/games/jump/api/submit', { method: 'POST', body: payload, env });
    expect(res.status).toBe(200);

    const { text } = await call('/games/jump/api/leaderboard', { env });
    const lb = JSON.parse(text);
    expect(lb.length).toBe(1);
    expect(lb[0]).toEqual({ name: 'Alice', score: 10 });
  });

  it('percentile computes correctly', async () => {
    const env = createEnv({ leaderboard: JSON.stringify([{ name: 'A', score: 5 }, { name: 'B', score: 10 }]) });
    const { res, text } = await call('/games/jump/api/percentile?score=5', { env });
    expect(res.status).toBe(200);
    const data = JSON.parse(text);
    expect(data.percent).toBe(50);
  });
});