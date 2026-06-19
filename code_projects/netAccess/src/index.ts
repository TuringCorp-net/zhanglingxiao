/**
 * NetAccess — Web Fetch 网页访问中转 Worker
 *
 * 为云端"龙虾"提供 HTTP 代理中转服务。
 * 龙虾通过 Web Fetch 访问本 Worker，带上 ?target=<真实URL> 参数，
 * Worker 代为请求目标 URL 并返回内容，从而绕过出口 IP 限制。
 *
 * 鉴权：请求需携带 X-API-Key 头，值与 API_KEY 环境变量匹配。
 */

export interface Env {
  API_KEY: string;
  /** Tokyo VM Funnel 地址，如 https://vm-name.tailnet.ts.net。未配置则直连 */
  TOKYO_PROXY_URL?: string;
  /** Worker ↔ Tokyo VM 内部密钥 */
  TOKYO_PROXY_KEY?: string;
}

/** Tokyo 代理超时（毫秒），超时后降级直连 */
const TOKYO_TIMEOUT_MS = 8000;

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    // --- CORS 预检 ---
    if (request.method === "OPTIONS") {
      return corsHeaders(new Response(null, { status: 204 }));
    }

    // --- 解析 URL（鉴权和 target 都需要） ---
    const url = new URL(request.url);

    // --- 鉴权（支持 Header 和 URL 参数两种方式） ---
    const authError = checkAuth(request, url, env.API_KEY);
    if (authError) return authError;
    const targetUrl = url.searchParams.get("target");

    if (!targetUrl) {
      return corsHeaders(
        new Response("请提供目标 URL 参数: ?target=<url>", { status: 400 })
      );
    }

    // --- 校验 target 协议（仅允许 http/https） ---
    let target: URL;
    try {
      target = new URL(targetUrl);
    } catch {
      return corsHeaders(
        new Response("目标 URL 格式无效", { status: 400 })
      );
    }

    if (target.protocol !== "http:" && target.protocol !== "https:") {
      return corsHeaders(
        new Response("仅支持 http/https 协议", { status: 400 })
      );
    }

    // --- 转发请求（优先 Tokyo VM，超时/失败降级直连） ---
    if (env.TOKYO_PROXY_URL && env.TOKYO_PROXY_KEY) {
      try {
        const result = await fetchViaTokyo(
          targetUrl, request, env.TOKYO_PROXY_URL, env.TOKYO_PROXY_KEY
        );
        return corsHeaders(result);
      } catch {
        // Tokyo 不可达 → 降级直连
      }
    }

    try {
      const result = await fetchDirect(targetUrl, request);
      return corsHeaders(result);
    } catch (error) {
      const message = error instanceof Error ? error.message : "未知错误";
      return corsHeaders(
        new Response(`请求失败: ${message}`, { status: 502 })
      );
    }
  },
};

/**
 * 校验 API Key，支持两种方式（Header 优先）：
 *   1. X-API-Key 请求头
 *   2. ?key=  URL 查询参数（方便 web_fetch 等不支持自定义头的工具）
 * 失败返回 401 Response，通过返回 null
 */
function checkAuth(request: Request, url: URL, apiKey: string): Response | null {
  // 优先从 Header 获取，其次从 URL 查询参数获取
  const providedKey =
    request.headers.get("X-API-Key") ?? url.searchParams.get("key");

  if (!providedKey || providedKey !== apiKey) {
    return corsHeaders(
      new Response("未授权: 缺少或无效的 API Key（可通过 X-API-Key 头或 ?key= 参数传递）", { status: 401 })
    );
  }
  return null;
}

/** 加上 CORS 响应头 */
function corsHeaders(response: Response): Response {
  const headers = new Headers(response.headers);
  headers.set("Access-Control-Allow-Origin", "*");
  headers.set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, PATCH, OPTIONS");
  headers.set("Access-Control-Allow-Headers", "X-API-Key, Content-Type, Authorization");
  headers.set("Access-Control-Max-Age", "86400");
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

/**
 * 走 Tokyo VM 代理转发。
 * Worker → Tokyo VM Funnel → 目标（东京真实出口 IP）
 */
async function fetchViaTokyo(
  targetUrl: string,
  request: Request,
  proxyUrl: string,
  proxyKey: string,
): Promise<Response> {
  const proxyTarget = `${proxyUrl}/?target=${encodeURIComponent(targetUrl)}`;
  const headers = forwardHeaders(request.headers);
  headers.set("X-Internal-Key", proxyKey);

  const resp = await fetch(proxyTarget, {
    method: request.method,
    headers,
    body:
      request.method !== "GET" && request.method !== "HEAD"
        ? request.body
        : undefined,
    redirect: "follow",
    signal: AbortSignal.timeout(TOKYO_TIMEOUT_MS),
  });

  if (!resp.ok && resp.status >= 500) {
    throw new Error(`Tokyo proxy returned ${resp.status}`);
  }
  return resp;
}

/** 直连目标（Cloudflare IP 出口），已有的降级路径 */
async function fetchDirect(
  targetUrl: string,
  request: Request,
): Promise<Response> {
  return fetch(targetUrl, {
    method: request.method,
    headers: forwardHeaders(request.headers),
    body:
      request.method !== "GET" && request.method !== "HEAD"
        ? request.body
        : undefined,
    redirect: "follow",
  });
}

/** 需要剥离的请求头（不转发到目标） */
const STRIP_HEADERS = new Set([
  "host",
  "x-api-key",        // 鉴权密钥，不泄露给目标
  "cf-connecting-ip", // Cloudflare 自动添加，转发时无意义
]);

/**
 * 浏览器伪装头（Chrome 138 / macOS 默认值）。
 * 先写入这些头，再用原始请求的头覆盖，保证调用方的意图不被篡改，
 * 同时填补 web_fetch 缺失的浏览器特征。
 */
const BROWSER_DEFAULTS: Record<string, string> = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36",
  Accept:
    "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
  "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
  "Accept-Encoding": "gzip, deflate, br",
  "Cache-Control": "no-cache",
};

/** 构造转发用的请求头：浏览器伪装 + 剥离不应透传的头 */
function forwardHeaders(original: Headers): Headers {
  // 1. 先写入浏览器伪装默认头
  const headers = new Headers(BROWSER_DEFAULTS);

  // 2. 再用原始请求头覆盖（调用方明确设置的优先）
  for (const [key, value] of original.entries()) {
    if (STRIP_HEADERS.has(key.toLowerCase())) continue;
    headers.set(key, value);
  }

  return headers;
}
