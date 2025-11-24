import { describe, it, expect } from 'vitest';

const ORIGIN = 'https://zhanglingxiao.com';

describe('Home centralized E2E checks', () => {
  it('health/jump returns ok=true', async () => {
    const res = await fetch(`${ORIGIN}/health/jump`);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toBeTypeOf('object');
    expect(data.ok).toBe(true);
    expect(data.status).toBe(200);
  });

  it('jump static page is reachable', async () => {
    const res = await fetch(`${ORIGIN}/games/jump/`);
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html.length).toBeGreaterThan(50);
    expect(html).toMatch(/<title>Jump<\/title>/i);
  });

  it('jump leaderboard API responds 200', async () => {
    const res = await fetch(`${ORIGIN}/games/jump/api/leaderboard`);
    expect(res.status).toBe(200);
    const text = await res.text();
    // may be [] or a list
    try {
      const json = JSON.parse(text);
      expect(Array.isArray(json)).toBe(true);
    } catch {
      // even if not JSON parsable, ensure body exists
      expect(text.length).toBeGreaterThan(0);
    }
  });
});