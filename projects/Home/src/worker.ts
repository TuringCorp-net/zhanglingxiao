export default {
  async fetch(request: Request, env: any, ctx: any): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    // 1. 规范化域名与协议：强制 HTTPS 和 Apex 域名 (zhanglingxiao.com)
    if (url.protocol === "http:" || url.hostname === "www.zhanglingxiao.com") {
      const canonicalHost = url.hostname === "www.zhanglingxiao.com" ? "zhanglingxiao.com" : url.hostname;
      return Response.redirect(`https://${canonicalHost}${url.pathname}${url.search}`, 301);
    }

    // 2. 根路径重定向到 /home
    if (path === "/" || path === "") {
      return Response.redirect(url.origin + "/home", 302);
    }

    // 3. 确保目录路径带斜杠 (Trailing Slash)，以便 index.html 正确解析相对路径
    if (path === "/home") return Response.redirect(url.origin + "/home/", 302);
    if (path === "/games") return Response.redirect(url.origin + "/games/", 302);
    if (path === "/works") return Response.redirect(url.origin + "/works/", 302);

    // 4. 健康检查与 Service Binding 探测: /health/{service}
    // 用于 Home 页展示子服务的连通性
    if (path.startsWith("/health/")) {
      const headers = new Headers({ "content-type": "application/json; charset=utf-8" });
      const service = path.replace("/health/", "").trim();
      // 尝试获取 binding，支持大小写兼容
      const binding = (env as any)[service?.toUpperCase?.() === service ? service : service?.toUpperCase?.()] || (env as any)[service];

      if (!service || !binding || typeof binding.fetch !== "function") {
        return json({ ok: false, error: `Service binding not found: ${service}` }, headers, 404);
      }
      try {
        // 约定：每个服务应暴露 /health 接口。
        // 特例：Jump 早期设计没有 /health，探测 /games/jump/api/leaderboard 代替
        const probePath = service.toLowerCase() === "jump" ? "/games/jump/api/leaderboard" : `/health`;
        const req = new Request(url.origin + probePath, { method: "GET" });
        const res = await binding.fetch(req);

        // 解析响应以判断是否真的健康
        const text = await res.text();
        let data: any = null;
        try { data = JSON.parse(text); } catch { }
        const sampleCount = Array.isArray(data) ? data.length : (typeof data === 'object' && data ? 1 : null);

        return json({ ok: res.ok, status: res.status, sampleCount }, headers, res.ok ? 200 : 502);
      } catch (err: any) {
        return json({ ok: false, error: String(err) }, headers, 502);
      }
    }

    // 5. API: 获取作品列表 (读取 R2 Bucket)
    // GET /api/works - 返回 PDF 文件列表
    if (path === "/api/works" || path === "/api/works/") {
      const headers = new Headers({ "content-type": "application/json; charset=utf-8", "cache-control": "no-cache" });
      try {
        if (!env.WORKS_R2) {
          return json({ ok: false, error: "WORKS_R2 binding missing" }, headers, 500);
        }
        const items: any[] = [];
        let cursor: string | undefined = undefined;
        // 分页列出所有 PDF
        do {
          const res: any = await env.WORKS_R2.list({ prefix: "", limit: 100, cursor });
          for (const obj of res.objects || []) {
            if (obj.key && obj.key.toLowerCase().endsWith(".pdf")) {
              items.push({ key: obj.key, size: obj.size, uploaded: obj.uploaded });
            }
          }
          cursor = res.truncated ? res.cursor : undefined;
        } while (cursor);
        return json({ ok: true, count: items.length, items }, headers, 200);
      } catch (err: any) {
        return json({ ok: false, error: String(err) }, headers, 500);
      }
    }

    // 6. 文件流: 从 R2 下载作品
    // GET /works/file/{key}
    if (path.startsWith("/works/file/")) {
      try {
        const key = decodeURIComponent(path.replace("/works/file/", ""));
        if (!key) return new Response("Bad Request", { status: 400 });
        const obj = await env.WORKS_R2?.get(key);
        if (!obj) return new Response("Not Found", { status: 404 });
        const headers = new Headers({
          "content-type": "application/pdf",
          "content-disposition": `inline; filename*=UTF-8''${encodeURIComponent(key.split('/').pop() || 'work.pdf')}`,
          "cache-control": "no-store"
        });
        return new Response(obj.body as ReadableStream, { headers, status: 200 });
      } catch (err: any) {
        return new Response("Server Error", { status: 500 });
      }
    }

    // 7. 视图: PDF 在线查看器
    // GET /works/view?key={key}
    if (path.startsWith("/works/view")) {
      const u = new URL(request.url);
      const key = u.searchParams.get("key") || "";
      if (!key) {
        return Response.redirect(u.origin + "/works/", 302);
      }
      // 兼容无斜杠末尾，确保静态资源相对路径加载正确
      if (path === "/works/view") {
        return Response.redirect(u.origin + "/works/view/" + (u.search || ""), 302);
      }
      // 直接返回 ASSETS 中的静态 HTML (Vue/React SPA 或纯 HTML)
      return env.ASSETS.fetch(request);
    }

    // 8. 静态资源托管 (ASSETS Binding)
    // 负责 /home, /games, /works 以及其他 assets 目录的静态文件服务
    if (path.startsWith("/home") ||
      path.startsWith("/games") ||
      path.startsWith("/works") ||
      path.startsWith("/assets")) {
      return env.ASSETS.fetch(request);
    }

    // 默认回退
    return env.ASSETS.fetch(request);
  }
};

function json(data: any, headers: Headers, status = 200) {
  return new Response(JSON.stringify(data), { headers, status });
}

async function getLeaderboard(env: any) {
  const raw = await env.JUMP_KV.get('leaderboard');
  const list = raw ? JSON.parse(raw) : [];
  list.sort((a: any, b: any) => b.score - a.score);
  return list.slice(0, 50);
}

async function submitScore(env: any, name: string, score: number) {
  const raw = await env.JUMP_KV.get(`user:${name}`);
  const prev = raw ? JSON.parse(raw) : { name, score: 0 };
  const best = { name, score: Math.max(Number(prev.score || 0), Number(score || 0)) };
  await env.JUMP_KV.put(`user:${name}`, JSON.stringify(best));
  const rawLb = await env.JUMP_KV.get('leaderboard');
  let lb = rawLb ? JSON.parse(rawLb) : [];
  const idx = lb.findIndex((e: any) => e.name === name);
  if (idx >= 0) lb[idx] = best; else lb.push(best);
  lb.sort((a: any, b: any) => b.score - a.score);
  lb = lb.slice(0, 200);
  await env.JUMP_KV.put('leaderboard', JSON.stringify(lb));
  await bumpPlayerCount(env, name);
  return best;
}

async function bumpPlayerCount(env: any, name: string) {
  const raw = await env.JUMP_KV.get('players');
  let players = raw ? JSON.parse(raw) : { count: 0, names: {} as Record<string, boolean> };
  if (!players.names[name]) { players.names[name] = true; players.count++; }
  await env.JUMP_KV.put('players', JSON.stringify(players));
}

async function getPercentile(env: any, score: number) {
  const rawLb = await env.JUMP_KV.get('leaderboard');
  const lb = rawLb ? JSON.parse(rawLb) : [];
  if (lb.length === 0) return 0;
  const belowOrEqual = lb.filter((e: any) => score >= Number(e.score || 0)).length;
  const percent = (belowOrEqual / lb.length) * 100;
  return Math.round(percent);
}

// Removed server-side HTML string rendering helpers in favor of static assets
// function renderWorksViewHtml(title: string, key: string) { /* removed */ }
// function renderMobileOpenInNewWindowHtml(title: string, fileUrl: string) { /* removed */ }
// function renderPdfJsViewerHtml(title: string, key: string) { /* removed */ }

// Inline HTML viewer functions removed; now using static assets in public/works/view/