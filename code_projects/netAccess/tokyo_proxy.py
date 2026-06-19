#!/usr/bin/env python3
"""
Tokyo Proxy — NetAccess 二级代理（部署在东京 VM 上）

由 Cloudflare Worker 调用，Worker 做鉴权，本代理只做三件事：
  1. 校验内部密钥  (X-Internal-Key)
  2. 限流          (30/min, 100/hr)
  3. 浏览器伪装     → 转发到目标网站

零外部依赖，仅用 Python 标准库。
启动：python3 tokyo_proxy.py          （前台，测试用）
      python3 tokyo_proxy.py &        （后台）
      systemctl start tokyo-proxy     （systemd，推荐）

端口：8080
"""

import time
import json
import urllib.request
import urllib.error
from http.server import HTTPServer, BaseHTTPRequestHandler
from collections import defaultdict
from urllib.parse import urlparse, parse_qs

# ─── 配置 ─────────────────────────────────────────────────

PORT = 8080
INTERNAL_KEY = "TokyoVM-Internal-X2k9mP7vQ4wL1nR8"   # 改掉！生成一个随机串

# 限流参数
RATE_LIMIT_MIN = 30      # 每分钟最多 30 次
RATE_LIMIT_HOUR = 100    # 每小时最多 100 次

# 浏览器伪装头
BROWSER_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/138.0.0.0 Safari/537.36"
    ),
    "Accept": (
        "text/html,application/xhtml+xml,application/xml;"
        "q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8"
    ),
    "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
    "Accept-Encoding": "gzip, deflate, br",
    "Cache-Control": "no-cache",
}

# 不应转发到目标的头
STRIP_HEADERS = {
    "host", "x-internal-key", "x-api-key",
}


# ─── 限流器 ───────────────────────────────────────────────

class RateLimiter:
    """内存限流：每分钟 N 次 + 每小时 M 次"""

    def __init__(self):
        self._minute: dict[str, list[float]] = defaultdict(list)
        self._hour: dict[str, list[float]] = defaultdict(list)

    def allow(self, ip: str) -> bool:
        now = time.time()
        minute_ago = now - 60
        hour_ago = now - 3600

        # 清理过期记录
        self._minute[ip] = [t for t in self._minute[ip] if t > minute_ago]
        self._hour[ip] = [t for t in self._hour[ip] if t > hour_ago]

        if len(self._minute[ip]) >= RATE_LIMIT_MIN:
            return False
        if len(self._hour[ip]) >= RATE_LIMIT_HOUR:
            return False

        self._minute[ip].append(now)
        self._hour[ip].append(now)
        return True


limiter = RateLimiter()


# ─── HTTP 处理器 ──────────────────────────────────────────

class ProxyHandler(BaseHTTPRequestHandler):

    def log_message(self, fmt, *args):
        """简化日志（flush=True 确保 systemd journal 实时可见）"""
        print(f"[{time.strftime('%H:%M:%S')}] {self.client_address[0]} {args[0]}", flush=True)

    # ── 鉴权 ──

    def _check_auth(self) -> bool:
        provided = self.headers.get("X-Internal-Key", "")
        return provided == INTERNAL_KEY

    # ── 限流 ──

    def _check_rate_limit(self) -> bool:
        ip = self.client_address[0]
        return limiter.allow(ip)

    # ── 主入口 ──

    def do_GET(self):
        self._handle()

    def do_POST(self):
        self._handle()

    def do_PUT(self):
        self._handle()

    def do_DELETE(self):
        self._handle()

    def do_PATCH(self):
        self._handle()

    def do_HEAD(self):
        self._handle()

    def _handle(self):
        # 1. 鉴权
        if not self._check_auth():
            self._send_json(401, {"error": "unauthorized"})
            return

        # 2. 限流
        if not self._check_rate_limit():
            self._send_json(429, {"error": "rate limited"})
            return

        # 3. 解析 target
        parsed = urlparse(self.path)
        params = parse_qs(parsed.query)
        target_list = params.get("target", [])
        if not target_list:
            self._send_json(400, {"error": "missing ?target="})
            return

        target_url = target_list[0]

        # 4. 校验协议
        target_parsed = urlparse(target_url)
        if target_parsed.scheme not in ("http", "https"):
            self._send_json(400, {"error": "only http/https allowed"})
            return

        # 5. 构造请求头（浏览器伪装）
        req_headers = dict(BROWSER_HEADERS)
        for key, value in self.headers.items():
            if key.lower() in STRIP_HEADERS:
                continue
            req_headers[key] = value

        # 6. 读取 body
        content_length = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(content_length) if content_length > 0 else None

        # 7. 转发
        try:
            req = urllib.request.Request(
                target_url,
                data=body,
                headers=req_headers,
                method=self.command,
            )
            with urllib.request.urlopen(req, timeout=30) as resp:
                resp_body = resp.read()
                self.send_response(resp.status)

                # 带回目标响应头（跳过不应透传的）
                for key, value in resp.headers.items():
                    if key.lower() in ("transfer-encoding", "connection"):
                        continue
                    self.send_header(key, value)

                # CORS
                self.send_header("Access-Control-Allow-Origin", "*")
                self.end_headers()
                self.wfile.write(resp_body)

        except urllib.error.HTTPError as e:
            self._send_text(e.code, e.read() or b"")

        except Exception as e:
            self._send_json(502, {"error": f"fetch failed: {e}"})

    # ── 响应辅助 ──

    def _send_json(self, status: int, data: dict):
        body = json.dumps(data, ensure_ascii=False).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(body)

    def _send_text(self, status: int, body: bytes):
        self.send_response(status)
        self.send_header("Content-Type", "text/plain; charset=utf-8")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(body)


# ─── 启动 ─────────────────────────────────────────────────

if __name__ == "__main__":
    print(f"Tokyo Proxy starting on :{PORT}")
    print(f"Rate limit: {RATE_LIMIT_MIN}/min, {RATE_LIMIT_HOUR}/hour")
    server = HTTPServer(("0.0.0.0", PORT), ProxyHandler)
    try:
        import sys
        sys.stdout.reconfigure(line_buffering=True)
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nShutting down...")
        server.server_close()
