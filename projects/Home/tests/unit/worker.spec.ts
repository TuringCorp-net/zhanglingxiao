import { describe, it, expect } from 'vitest';
import workerModule from '../../src/worker';

// Minimal mock for ASSETS binding
const mockAssets = {
  fetch: async (req: Request) => new Response('OK', { status: 200 })
};

// Mock R2
const mockR2 = {
  async list(opts: any) {
    return {
      truncated: false,
      objects: [
        { key: '2025/comic-episode-1.pdf', size: 20971520, uploaded: new Date().toISOString() },
        { key: '2025/notes.txt', size: 1024, uploaded: new Date().toISOString() }
      ]
    };
  },
  async get(key: string) {
    if (key.endsWith('.pdf')) {
      return { body: new ReadableStream() } as any;
    }
    return null;
  }
};

// Helper to run fetch
async function run(url: string) {
  const req = new Request(url);
  // @ts-ignore
  return workerModule.fetch(req, { ASSETS: mockAssets, WORKS_R2: mockR2 }, {});
}

// Optional system tests: run only when explicitly enabled to avoid flakiness in local/CI
const RUN_SYSTEM = (globalThis as any).process?.env?.RUN_SYSTEM_TESTS === 'true';

describe('Worker routing & redirects', () => {
  it('redirects / to /home', async () => {
    const res = await run('https://zhanglingxiao.com/');
    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toBe('https://zhanglingxiao.com/home');
  });

  it('adds trailing slash for /home', async () => {
    const res = await run('https://zhanglingxiao.com/home');
    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toBe('https://zhanglingxiao.com/home/');
  });

  it('adds trailing slash for /games', async () => {
    const res = await run('https://zhanglingxiao.com/games');
    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toBe('https://zhanglingxiao.com/games/');
  });

  it('canonicalizes http and www to https apex', async () => {
    const res1 = await run('http://zhanglingxiao.com/home');
    expect(res1.status).toBe(301);
    expect(res1.headers.get('location')).toBe('https://zhanglingxiao.com/home');

    const res2 = await run('https://www.zhanglingxiao.com/home');
    expect(res2.status).toBe(301);
    expect(res2.headers.get('location')).toBe('https://zhanglingxiao.com/home');
  });

  it('serves /home/ via assets', async () => {
    const res = await run('https://zhanglingxiao.com/home/');
    expect(res.status).toBe(200);
  });

  it('serves /games/ via assets', async () => {
    const res = await run('https://zhanglingxiao.com/games/');
    expect(res.status).toBe(200);
  });

  // New tests for works
  it('adds trailing slash for /works', async () => {
    const res = await run('https://zhanglingxiao.com/works');
    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toBe('https://zhanglingxiao.com/works/');
  });

  it('serves /works/ via assets', async () => {
    const res = await run('https://zhanglingxiao.com/works/');
    expect(res.status).toBe(200);
  });

  it('lists works via /api/works (filters PDFs only)', async () => {
    const res = await run('https://zhanglingxiao.com/api/works');
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.ok).toBe(true);
    // Assert filtered items are PDFs without relying on exact count
    expect(Array.isArray(data.items)).toBe(true);
    expect(data.items.length).toBeGreaterThanOrEqual(1);
    expect(data.items.every((i: any) => typeof i.key === 'string' && i.key.endsWith('.pdf'))).toBe(true);
  });
});

// Optional production system test: guarded by RUN_SYSTEM to avoid always hitting network
(RUN_SYSTEM ? it : it.skip)('system: production /api/works should respond ok', async () => {
  const res = await fetch('https://zhanglingxiao.com/api/works');
  expect(res.status).toBe(200);
  const data = await res.json();
  expect(data && data.ok === true).toBe(true);
});