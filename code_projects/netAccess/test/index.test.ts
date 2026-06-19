/**
 * NetAccess Worker 测试
 *
 * 测试覆盖：
 * - CORS 预检 (OPTIONS)
 * - API Key 鉴权
 * - target 参数解析与校验
 * - 请求转发（GET/POST）
 * - 错误处理
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// 待测 Worker
import worker from "../src/index";

const API_KEY = "TuringCorp-UncleLi-13572468";
const WORKER_URL = "https://netaccess.turingcorp.net";

/** 构造请求辅助函数 */
function makeReq(
  method: string,
  targetUrl: string | null,
  apiKey: string | null,
  options?: {
    body?: string;
    extraHeaders?: Record<string, string>;
    /** 将 key 放在 URL 查询参数而非 Header */
    keyInUrl?: boolean;
  }
): Request {
  const params = new URLSearchParams();
  if (targetUrl) {
    params.set("target", targetUrl);
  }
  // keyInUrl 模式：key 放在 URL 参数中
  if (options?.keyInUrl && apiKey !== null) {
    params.set("key", apiKey);
  }

  let url = WORKER_URL;
  const qs = params.toString();
  if (qs) url += `?${qs}`;

  const headers = new Headers(options?.extraHeaders);
  // 默认模式：key 放在 Header 中
  if (!options?.keyInUrl && apiKey !== null) {
    headers.set("X-API-Key", apiKey);
  }

  return new Request(url, {
    method,
    headers,
    body: options?.body ?? undefined,
  });
}

const TOKYO_PROXY_URL = "https://vm-name.tailnet.ts.net";
const TOKYO_PROXY_KEY = "TokyoVM-Internal-test-key";

/** Mock env（不含 Tokyo 配置） */
function makeEnv(): { API_KEY: string } {
  return { API_KEY };
}

/** Mock env（含 Tokyo 配置） */
function makeEnvWithTokyo(): {
  API_KEY: string;
  TOKYO_PROXY_URL: string;
  TOKYO_PROXY_KEY: string;
} {
  return { API_KEY, TOKYO_PROXY_URL, TOKYO_PROXY_KEY };
}

// ─── 测试套件 ─────────────────────────────────────────────

describe("NetAccess Worker", () => {
  // 保存原生 fetch，用于恢复
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    // 每个测试前重置 mock
    vi.restoreAllMocks();
  });

  // ─── OPTIONS 预检 ──────────────────────────────────────

  describe("CORS 预检 (OPTIONS)", () => {
    it("应返回 204 并带 CORS 头", async () => {
      const req = new Request(WORKER_URL, { method: "OPTIONS" });
      const res = await worker.fetch(req, makeEnv());

      expect(res.status).toBe(204);
      expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
      expect(res.headers.get("Access-Control-Allow-Methods")).toContain("GET");
    });

    it("OPTIONS 请求不需要 API Key", async () => {
      const req = new Request(WORKER_URL, { method: "OPTIONS" });
      const res = await worker.fetch(req, makeEnv());

      expect(res.status).toBe(204);
    });
  });

  // ─── 鉴权 ──────────────────────────────────────────────

  describe("鉴权 (X-API-Key)", () => {
    it("缺少 X-API-Key 应返回 401", async () => {
      const req = makeReq("GET", "https://example.com", null);
      const res = await worker.fetch(req, makeEnv());

      expect(res.status).toBe(401);
      const text = await res.text();
      expect(text).toContain("未授权");
    });

    it("错误的 X-API-Key 应返回 401", async () => {
      const req = makeReq("GET", "https://example.com", "wrong-key");
      const res = await worker.fetch(req, makeEnv());

      expect(res.status).toBe(401);
    });

    it("正确的 X-API-Key 应通过鉴权（结合 target 校验）", async () => {
      // 这里 target 为空，会走到 400 而非 401，说明鉴权通过
      const req = makeReq("GET", null, API_KEY);
      const res = await worker.fetch(req, makeEnv());

      expect(res.status).toBe(400); // 不是 401
    });

    it("401 响应应带 CORS 头", async () => {
      const req = makeReq("GET", "https://example.com", null);
      const res = await worker.fetch(req, makeEnv());

      expect(res.status).toBe(401);
      expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
    });
  });

  // ─── 鉴权 (URL 参数 ?key=) ────────────────────────────

  describe("鉴权 (?key= URL 参数)", () => {
    it("通过 ?key= 参数鉴权成功（无 Header）", async () => {
      const req = makeReq("GET", null, API_KEY, { keyInUrl: true });
      const res = await worker.fetch(req, makeEnv());

      // 鉴权通过 → 走到 400（缺少 target），不是 401
      expect(res.status).toBe(400);
    });

    it("?key= 参数错误应返回 401", async () => {
      const req = makeReq("GET", "https://example.com", "wrong-key", { keyInUrl: true });
      const res = await worker.fetch(req, makeEnv());

      expect(res.status).toBe(401);
    });

    it("?key= 参数缺失且无 Header → 401", async () => {
      const req = makeReq("GET", "https://example.com", null);
      const res = await worker.fetch(req, makeEnv());

      expect(res.status).toBe(401);
    });

    it("Header 优先：Header 正确时忽略 ?key= 参数", async () => {
      // Header 正确，但 URL 参数是错的 → 应通过
      const params = new URLSearchParams({ target: "https://example.com", key: "wrong-key" });
      const req = new Request(`${WORKER_URL}?${params}`, {
        headers: { "X-API-Key": API_KEY },
      });
      const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("ok"));
      const res = await worker.fetch(req, makeEnv());

      expect(res.status).toBe(200);
    });

    it("?key= 鉴权通过后能正常代理请求", async () => {
      const mockResponse = new Response("proxied via key param", { status: 200 });
      vi.spyOn(globalThis, "fetch").mockResolvedValue(mockResponse);

      const req = makeReq("GET", "https://api.example.com/data", API_KEY, { keyInUrl: true });
      const res = await worker.fetch(req, makeEnv());

      expect(res.status).toBe(200);
      const text = await res.text();
      expect(text).toBe("proxied via key param");
    });

    it("?key= 参数中的密钥不会被转发到目标", async () => {
      const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("ok"));

      const req = makeReq("GET", "https://example.com", API_KEY, { keyInUrl: true });
      await worker.fetch(req, makeEnv());

      // 验证转发的 target URL 不包含 key 参数
      const fetchArgs = fetchSpy.mock.calls[0] as [RequestInfo, RequestInit?];
      const forwardedUrl = fetchArgs[0] as string;
      expect(forwardedUrl).not.toContain("key=");
    });
  });

  // ─── target 参数 ───────────────────────────────────────

  describe("target 参数校验", () => {
    it("缺少 target 参数应返回 400", async () => {
      const req = makeReq("GET", null, API_KEY);
      const res = await worker.fetch(req, makeEnv());

      expect(res.status).toBe(400);
      const text = await res.text();
      expect(text).toContain("target");
    });

    it("target 格式无效应返回 400", async () => {
      const req = makeReq("GET", "not-a-valid-url!!!", API_KEY);
      const res = await worker.fetch(req, makeEnv());

      expect(res.status).toBe(400);
      const text = await res.text();
      expect(text).toContain("格式无效");
    });

    it("target 非 http/https 协议应返回 400", async () => {
      const req = makeReq("GET", "ftp://files.example.com/data", API_KEY);
      const res = await worker.fetch(req, makeEnv());

      expect(res.status).toBe(400);
      const text = await res.text();
      expect(text).toContain("仅支持 http/https");
    });

    it("javascript: 协议应被拒绝", async () => {
      const req = makeReq("GET", "javascript:alert(1)", API_KEY);
      const res = await worker.fetch(req, makeEnv());

      expect(res.status).toBe(400);
      expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
    });
  });

  // ─── 代理转发 ──────────────────────────────────────────

  describe("代理转发", () => {
    it("GET 请求应正确转发并返回目标内容", async () => {
      // Mock 出站 fetch
      const mockResponse = new Response("Hello from target!", {
        status: 200,
        headers: { "Content-Type": "text/plain" },
      });
      vi.spyOn(globalThis, "fetch").mockResolvedValue(mockResponse);

      const req = makeReq("GET", "https://api.example.com/data", API_KEY);
      const res = await worker.fetch(req, makeEnv());

      expect(res.status).toBe(200);
      const text = await res.text();
      expect(text).toBe("Hello from target!");
      expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
    });

    it("POST 请求应转发 body", async () => {
      const mockResponse = new Response('{"ok":true}', {
        status: 201,
        headers: { "Content-Type": "application/json" },
      });
      const fetchSpy = vi
        .spyOn(globalThis, "fetch")
        .mockResolvedValue(mockResponse);

      const req = makeReq("POST", "https://api.example.com/create", API_KEY, {
        body: '{"name":"test"}',
      });
      const res = await worker.fetch(req, makeEnv());

      expect(res.status).toBe(201);

      // 验证 fetch 被调用时传了 body（body 为 ReadableStream）
      const fetchArgs = fetchSpy.mock.calls[0] as [RequestInfo, RequestInit?];
      expect(fetchArgs[0]).toBe("https://api.example.com/create");
      expect(fetchArgs[1]?.method).toBe("POST");
      expect(fetchArgs[1]?.body).toBeDefined();
      expect(fetchArgs[1]?.body).not.toBeNull();
    });

    it("应保留目标响应的状态码和头", async () => {
      const mockResponse = new Response("Not Found", {
        status: 404,
        headers: {
          "Content-Type": "text/html",
          "X-Custom": "value",
        },
      });
      vi.spyOn(globalThis, "fetch").mockResolvedValue(mockResponse);

      const req = makeReq("GET", "https://example.com/404", API_KEY);
      const res = await worker.fetch(req, makeEnv());

      expect(res.status).toBe(404);
      expect(res.headers.get("X-Custom")).toBe("value");
    });

    it("HEAD 请求不应转发 body", async () => {
      const mockResponse = new Response(null, { status: 200 });
      const fetchSpy = vi
        .spyOn(globalThis, "fetch")
        .mockResolvedValue(mockResponse);

      const req = makeReq("HEAD", "https://example.com", API_KEY);
      await worker.fetch(req, makeEnv());

      const fetchArgs = fetchSpy.mock.calls[0] as [RequestInfo, RequestInit?];
      expect(fetchArgs[1]?.body).toBeUndefined();
    });

    it("应跳过原始请求的 Host 头", async () => {
      const fetchSpy = vi
        .spyOn(globalThis, "fetch")
        .mockResolvedValue(new Response("ok"));

      const req = makeReq("GET", "https://example.com", API_KEY, {
        extraHeaders: { Host: "netaccess.turingcorp.net" },
      });
      await worker.fetch(req, makeEnv());

      const fetchArgs = fetchSpy.mock.calls[0] as [RequestInfo, RequestInit?];
      const fwdHeaders = fetchArgs[1]?.headers as Headers;
      expect(fwdHeaders.get("Host")).toBeNull();
    });

    it("不应转发 X-API-Key 到目标（防泄露）", async () => {
      const fetchSpy = vi
        .spyOn(globalThis, "fetch")
        .mockResolvedValue(new Response("ok"));

      const req = makeReq("GET", "https://example.com", API_KEY);
      await worker.fetch(req, makeEnv());

      const fetchArgs = fetchSpy.mock.calls[0] as [RequestInfo, RequestInit?];
      const fwdHeaders = fetchArgs[1]?.headers as Headers;
      expect(fwdHeaders.get("X-API-Key")).toBeNull();
    });
  });

  // ─── 浏览器伪装头 ──────────────────────────────────────

  describe("浏览器伪装头", () => {
    it("应自动补齐 Chrome UA", async () => {
      const fetchSpy = vi
        .spyOn(globalThis, "fetch")
        .mockResolvedValue(new Response("ok"));

      // 不传任何自定义头
      const req = makeReq("GET", "https://example.com", API_KEY);
      await worker.fetch(req, makeEnv());

      const fetchArgs = fetchSpy.mock.calls[0] as [RequestInfo, RequestInit?];
      const fwdHeaders = fetchArgs[1]?.headers as Headers;
      expect(fwdHeaders.get("User-Agent")).toContain("Chrome/138");
    });

    it("应自动补齐 Accept / Accept-Language", async () => {
      const fetchSpy = vi
        .spyOn(globalThis, "fetch")
        .mockResolvedValue(new Response("ok"));

      const req = makeReq("GET", "https://example.com", API_KEY);
      await worker.fetch(req, makeEnv());

      const fetchArgs = fetchSpy.mock.calls[0] as [RequestInfo, RequestInit?];
      const fwdHeaders = fetchArgs[1]?.headers as Headers;
      expect(fwdHeaders.get("Accept")).toContain("text/html");
      expect(fwdHeaders.get("Accept-Language")).toContain("zh-CN");
    });

    it("调用方显式设置的头应覆盖默认伪装值", async () => {
      const fetchSpy = vi
        .spyOn(globalThis, "fetch")
        .mockResolvedValue(new Response("ok"));

      const req = makeReq("GET", "https://example.com", API_KEY, {
        extraHeaders: { "User-Agent": "MyLobster/1.0" },
      });
      await worker.fetch(req, makeEnv());

      const fetchArgs = fetchSpy.mock.calls[0] as [RequestInfo, RequestInit?];
      const fwdHeaders = fetchArgs[1]?.headers as Headers;
      expect(fwdHeaders.get("User-Agent")).toBe("MyLobster/1.0");
    });

    it("伪装头不应包含 X-API-Key", async () => {
      const fetchSpy = vi
        .spyOn(globalThis, "fetch")
        .mockResolvedValue(new Response("ok"));

      const req = makeReq("GET", "https://example.com", API_KEY);
      await worker.fetch(req, makeEnv());

      const fetchArgs = fetchSpy.mock.calls[0] as [RequestInfo, RequestInit?];
      const fwdHeaders = fetchArgs[1]?.headers as Headers;
      expect(fwdHeaders.get("X-API-Key")).toBeNull();
    });
  });

  // ─── Tokyo VM 代理 ────────────────────────────────────

  describe("Tokyo VM 代理", () => {
    it("配置 Tokyo 时优先走 VM 代理", async () => {
      const fetchSpy = vi
        .spyOn(globalThis, "fetch")
        .mockResolvedValue(new Response("via tokyo", { status: 200 }));

      const req = makeReq("GET", "https://api.example.com/data", API_KEY);
      const res = await worker.fetch(req, makeEnvWithTokyo());

      expect(res.status).toBe(200);
      const text = await res.text();
      expect(text).toBe("via tokyo");

      // 验证 fetch 走了 Tokyo URL
      const fetchArgs = fetchSpy.mock.calls[0] as [RequestInfo, RequestInit?];
      const calledUrl = fetchArgs[0] as string;
      expect(calledUrl).toContain(TOKYO_PROXY_URL);
      expect(calledUrl).toContain("target=");
    });

    it("Tokyo 代理请求应携带 X-Internal-Key", async () => {
      const fetchSpy = vi
        .spyOn(globalThis, "fetch")
        .mockResolvedValue(new Response("ok"));

      const req = makeReq("GET", "https://example.com", API_KEY);
      await worker.fetch(req, makeEnvWithTokyo());

      const fetchArgs = fetchSpy.mock.calls[0] as [RequestInfo, RequestInit?];
      const fwdHeaders = fetchArgs[1]?.headers as Headers;
      expect(fwdHeaders.get("X-Internal-Key")).toBe(TOKYO_PROXY_KEY);
    });

    it("Tokyo 超时/失败 → 降级直连", async () => {
      // 第一次 fetch (Tokyo) 失败，第二次 (直连) 成功
      const fetchSpy = vi
        .spyOn(globalThis, "fetch")
        .mockRejectedValueOnce(new Error("timeout"))
        .mockResolvedValueOnce(new Response("fallback direct", { status: 200 }));

      const req = makeReq("GET", "https://api.example.com/data", API_KEY);
      const res = await worker.fetch(req, makeEnvWithTokyo());

      expect(res.status).toBe(200);
      const text = await res.text();
      expect(text).toBe("fallback direct");

      // 验证调用了两次 fetch
      expect(fetchSpy).toHaveBeenCalledTimes(2);
    });

    it("Tokyo 返回 500+ → 降级直连", async () => {
      const fetchSpy = vi
        .spyOn(globalThis, "fetch")
        .mockResolvedValueOnce(new Response("internal error", { status: 502 }))
        .mockResolvedValueOnce(new Response("fallback direct", { status: 200 }));

      const req = makeReq("GET", "https://example.com", API_KEY);
      const res = await worker.fetch(req, makeEnvWithTokyo());

      expect(res.status).toBe(200);
      const text = await res.text();
      expect(text).toBe("fallback direct");
    });

    it("未配置 Tokyo → 直连（不尝试 VM）", async () => {
      const fetchSpy = vi
        .spyOn(globalThis, "fetch")
        .mockResolvedValue(new Response("direct", { status: 200 }));

      const req = makeReq("GET", "https://example.com", API_KEY);
      const res = await worker.fetch(req, makeEnv());  // 无 Tokyo 配置

      expect(res.status).toBe(200);
      const text = await res.text();
      expect(text).toBe("direct");

      // 只调了一次 fetch（直连），没有 Tokyo 尝试
      expect(fetchSpy).toHaveBeenCalledTimes(1);
    });

    it("Tokyo VM 代理也应有浏览器伪装头", async () => {
      const fetchSpy = vi
        .spyOn(globalThis, "fetch")
        .mockResolvedValue(new Response("ok"));

      const req = makeReq("GET", "https://example.com", API_KEY);
      await worker.fetch(req, makeEnvWithTokyo());

      const fetchArgs = fetchSpy.mock.calls[0] as [RequestInfo, RequestInit?];
      const fwdHeaders = fetchArgs[1]?.headers as Headers;
      expect(fwdHeaders.get("User-Agent")).toContain("Chrome");
      expect(fwdHeaders.get("X-API-Key")).toBeNull();
    });
  });

  // ─── 错误处理 ──────────────────────────────────────────

  describe("错误处理", () => {
    it("目标请求网络失败应返回 502", async () => {
      vi.spyOn(globalThis, "fetch").mockRejectedValue(
        new Error("Connection refused")
      );

      const req = makeReq("GET", "https://down.example.com", API_KEY);
      const res = await worker.fetch(req, makeEnv());

      expect(res.status).toBe(502);
      const text = await res.text();
      expect(text).toContain("请求失败");
      expect(text).toContain("Connection refused");
      expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
    });

    it("非 Error 类型的异常也应返回 502", async () => {
      vi.spyOn(globalThis, "fetch").mockRejectedValue("some string error");

      const req = makeReq("GET", "https://example.com", API_KEY);
      const res = await worker.fetch(req, makeEnv());

      expect(res.status).toBe(502);
      const text = await res.text();
      expect(text).toContain("未知错误");
    });
  });

  // ─── 带特殊字符的 URL ─────────────────────────────────

  describe("URL 编码", () => {
    it("带查询参数的 target 应正确传递", async () => {
      const fetchSpy = vi
        .spyOn(globalThis, "fetch")
        .mockResolvedValue(new Response("ok"));

      const target = "https://api.example.com/search?q=hello&page=1";
      const req = makeReq("GET", target, API_KEY);
      await worker.fetch(req, makeEnv());

      const fetchArgs = fetchSpy.mock.calls[0] as [RequestInfo, RequestInit?];
      expect(fetchArgs[0]).toBe(target);
    });
  });
});
