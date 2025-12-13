import { describe, it, expect } from 'vitest';

// E2E 测试直接访问线上环境 (Smoke Test)
const BASE = 'https://zhanglingxiao.com';

describe('E2E: /home page', () => {
  it('serves /home/ with expected content', async () => {
    // / 会重定向到 /home
    const resRoot = await fetch(`${BASE}/`, { redirect: 'manual' });
    expect(resRoot.status).toBe(302);
    expect(resRoot.headers.get('location')).toContain('/home');

    // /home 会重定向到 /home/
    const resHome = await fetch(`${BASE}/home`, { redirect: 'manual' });
    expect([301, 302, 307, 308]).toContain(resHome.status);
    expect(resHome.headers.get('location')).toContain('/home/');

    // 访问 /home/ 获取页面内容
    const res = await fetch(`${BASE}/home/`);
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain('你好,世界！ 我是张凌霄。');
    expect(html).toContain('<main class="card"');
  });
});