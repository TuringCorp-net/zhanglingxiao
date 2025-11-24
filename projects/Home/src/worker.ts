export default {
  async fetch(request: Request, env: any, ctx: any): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    // Canonicalize scheme/domain: enforce HTTPS and apex domain
    if (url.protocol === "http:" || url.hostname === "www.zhanglingxiao.com") {
      const canonicalHost = url.hostname === "www.zhanglingxiao.com" ? "zhanglingxiao.com" : url.hostname;
      return Response.redirect(`https://${canonicalHost}${url.pathname}${url.search}`, 301);
    }

    if (path === "/" || path === "") {
      return Response.redirect(url.origin + "/home", 302);
    }

    // Ensure /home uses trailing slash so that /home/index.html resolves
    if (path === "/home") {
      return Response.redirect(url.origin + "/home/", 302);
    }

    // Ensure /games uses trailing slash so that /games/index.html resolves
    if (path === "/games") {
      return Response.redirect(url.origin + "/games/", 302);
    }

    // Health check for any bound service via Service Binding: /health/{service}
    if (path.startsWith("/health/")) {
      const headers = new Headers({ "content-type": "application/json; charset=utf-8" });
      const service = path.replace("/health/", "").trim();
      const binding = (env as any)[service?.toUpperCase?.() === service ? service : service?.toUpperCase?.()] || (env as any)[service];
      if (!service || !binding || typeof binding.fetch !== "function") {
        return json({ ok: false, error: `Service binding not found: ${service}` }, headers, 404);
      }
      try {
        // Convention: each service should expose /health or a cheap endpoint.
        // For Jump we probe its leaderboard; for others, probe /health by default.
        const probePath = service.toLowerCase() === "jump" ? "/games/jump/api/leaderboard" : `/health`;
        const req = new Request(url.origin + probePath, { method: "GET" });
        const res = await binding.fetch(req);
        const text = await res.text();
        let data: any = null;
        try { data = JSON.parse(text); } catch {}
        const sampleCount = Array.isArray(data) ? data.length : (typeof data === 'object' && data ? 1 : null);
        return json({ ok: res.ok, status: res.status, sampleCount }, headers, res.ok ? 200 : 502);
      } catch (err: any) {
        return json({ ok: false, error: String(err) }, headers, 502);
      }
    }

    // Ensure /works uses trailing slash so that /works/index.html resolves
    if (path === "/works") {
      return Response.redirect(url.origin + "/works/", 302);
    }

    // API: list works from R2 bucket (PDFs)
    if (path === "/api/works" || path === "/api/works/") {
      const headers = new Headers({ "content-type": "application/json; charset=utf-8", "cache-control": "no-cache" });
      try {
        if (!env.WORKS_R2) {
          return json({ ok: false, error: "WORKS_R2 binding missing" }, headers, 500);
        }
        const items: any[] = [];
        let cursor: string | undefined = undefined;
        do {
          const res = await env.WORKS_R2.list({ prefix: "", limit: 100, cursor });
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

    // File: stream a specific work PDF from R2
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

    // View: PDF.js viewer page (desktop + mobile unified)
    if (path.startsWith("/works/view")) {
      const u = new URL(request.url);
      const key = u.searchParams.get("key") || "";
      if (!key) {
        return Response.redirect(u.origin + "/works/", 302);
      }
      // 兼容无斜杠路径，确保目录索引页正常加载
      if (path === "/works/view") {
        return Response.redirect(u.origin + "/works/view/" + (u.search || ""), 302);
      }
      // Serve static viewer page; front-end JS will read ?key and render
      return env.ASSETS.fetch(request);
    }


    // Serve /home via static assets binding
    if (path.startsWith("/home")) {
      return env.ASSETS.fetch(request);
    }

    // Serve /games directory page via static assets binding
    if (path === "/games/" || path === "/games" || path === "/games/index.html") {
      return env.ASSETS.fetch(request);
    }

    // Serve /works directory page via static assets binding
    if (path === "/works/" || path === "/works" || path === "/works/index.html") {
      return env.ASSETS.fetch(request);
    }

    // Attempt to serve other static assets (e.g., /assets/*)
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