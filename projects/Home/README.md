# zhanglingxiao-home（Agent维护）

本仓库为 Cloudflare Workers 项目，提供 `zhanglingxiao.com/home` 的页面与逻辑。本文档由 Agent 维护，说明符合 Cloudflare 最佳实践的架构与开发流程。

## 架构总览（最佳实践）

- 单一 Worker 负责路由与域名规范化（强制 HTTPS、将 `www` 统一到顶级域）。
- 使用 Cloudflare Workers Static Assets 提供前端静态页面与资源，通过 Wrangler 的 `[assets]` 配置将 `./public` 目录的资源一并部署，并在 Worker 中通过 `env.ASSETS.fetch(request)` 动态读取与响应。
- 目录结构：
  - `src/worker.ts`：仅处理路由与重定向；静态资源由 ASSETS 绑定统一提供。
  - `public/`：前端资源目录（HTML/CSS/JS）。其中 `public/home/index.html` 对应 `/home/` 路由。
  - `wrangler.toml`：配置主入口与 `[assets]`，绑定名为 `ASSETS`。

### 为什么选择 Static Assets + ASSETS 绑定

- 更容易维护与协作：HTML/CSS/JS 分离，IDE 可直接高亮、预览结构，不再在 Worker 代码里拼接字符串。
- 云边一体的部署体验：Wrangler 自动打包并上传静态资源，和 Worker 代码一起部署到 Cloudflare 网络。
- 性能与缓存：Cloudflare 在边缘缓存静态资源，命中率更高、延迟更低。

### 关键配置（已在项目中生效）

- `wrangler.toml`：
  ```toml
  name = "zhanglingxiao-home"
  main = "src/worker.ts"
  compatibility_date = "2024-09-10"

  routes = [
    { pattern = "zhanglingxiao.com", custom_domain = true },
    { pattern = "www.zhanglingxiao.com", custom_domain = true }
  ]

  [observability]
  enabled = true

  [assets]
  directory = "./public"
  binding = "ASSETS"
  ```

- `src/worker.ts`（简要说明）：
  - 统一 `http` 到 `https`，`www` 到顶级域。
  - `/` 重定向到 `/home`。
  - `/home` 统一加尾斜杠 `/home/`，以便解析到 `public/home/index.html`。
  - 其余路径交给 `env.ASSETS.fetch(request)` 处理，直接响应静态资源。

## 开发与调试（推荐 remote 边缘本地模式）

- 开发命令：
  ```bash
  npm run dev
  ```
  说明：脚本使用 `wrangler dev --remote`，优先走边缘远程执行路径，方便联动 Service Bindings 与真实边缘环境，避免本地模拟取不到数据的问题。

- 访问地址：在终端输出中会看到本地预览 URL（例如 `http://localhost:8787`），直接访问 `/home` 即可（首次会 302 到 `/home/`）。

- 部署：
  ```bash
  npm run deploy
  ```

## 目录结构

- `src/worker.ts`：Worker 入口。
- `public/home/index.html`：主页内容（可直接在 IDE 中维护）。
- `public/assets/style.css`：样式。
- `public/assets/main.js`：脚本。
- `wrangler.toml`：Wrangler 配置。

## 后续扩展建议

- 如果有多个页面，例如 `/about/`、`/projects/`，建议在 `public/about/index.html` 等新增对应目录与文件，Worker 仍使用 `env.ASSETS.fetch` 统一处理。
- 如需后端逻辑或数据存储，可优先考虑 Cloudflare 的 KV、D1、Workers AI 等免费或低成本能力，保持系统简单；确有需要时再引入 DO、Queues 等付费能力。
- 如果多个 Worker 之间需要互相调用，且在同一个一级域名下，优先使用 Service Bindings（而不是 HTTP fetch）以提升性能。

## 注意事项

- 生产环境保持强制 HTTPS 与域名规范化，以避免重复内容与 SEO 问题。
- 避免在 Worker 中直接拼接 HTML 字符串；统一交由 Static Assets 提供静态内容。
- 本 README 为 Agent 维护文件；请不要修改由人类维护的 `.md` 文件（若有标注）。

## 构建 Worker 与静态网页的方式（避免长字符串拼接）

为防止未来再次出现“用长字符串拼接整页 HTML 导致编码或哈希校验错误”的问题，统一采用如下方式：

- 页面与资源的组织
  - 每个页面一个目录：`public/<page>/index.html`，配套脚本与样式放在 `public/assets/`（或该页面子目录）中。
  - 禁止在 Worker 代码中构造整页 HTML 字符串（例如 `renderXxxHtml(...)`），Worker 仅负责路由与重定向，静态内容由 ASSETS 绑定提供。
  - 小片段的动态文案或提示，优先使用 DOM API（`document.createElement`、`textContent` 等）构造节点；确需字符串时，使用简洁的模板字符串，避免跨多行、复杂拼接。

- 第三方库的使用（推荐自托管）
  - 优先将第三方前端库自托管到 `public/assets/libs/`，例如 `pdf.js`：
    - `public/assets/libs/pdfjs/pdf.min.js`
    - `public/assets/libs/pdfjs/pdf.worker.min.js`
  - 在前端脚本中按库的官方方式指向本地资源（例如设置 `pdfjsLib.GlobalWorkerOptions.workerSrc = "/assets/libs/pdfjs/pdf.worker.min.js"`）。
  - 如必须使用 CDN，请谨慎维护 SRI；一旦出现哈希或长度不匹配，第一时间改用自托管以消除外部不确定性。

- Worker 路由规范
  - 目录页统一加尾斜杠：如 `/home` → `/home/`、`/works/view` → `/works/view/`，确保 Static Assets 能正确解析到 `index.html`。
  - 其余请求统一交由 `env.ASSETS.fetch(request)` 响应静态内容。

- 开发与部署
  - 本地（远程边缘）开发：`npm run dev`（`wrangler dev --remote`），便于与 Service Bindings、真实边缘联动。
  - 部署：`npm run deploy`。

- 最小必要测试
  - 单元测试覆盖路由与尾斜杠重定向、ASSETS 响应是否命中。
  - 关键页面可选 e2e 验证（例如 `/works/view/` ）。

- 自检清单（避免反模式）
  - Worker 中不得出现构建整页 HTML 的函数或大段模板字符串。
  - 前端页面中不应通过长字符串拼接生成整页结构；错误提示或少量元素建议使用 DOM API 构建，并通过 `textContent` 填充文本，避免编码问题。
  - 资源路径统一相对或从根路径 `/assets/...` 引用，不在 Worker 中内联注入库文件。

- 常见问题与解决
  - SRI 校验失败或 CDN 响应异常：改为自托管到 `public/assets/libs/` 并移除 `integrity/crossorigin`。
  - 资源无法解析 `index.html`：检查是否缺少尾斜杠重定向或路径不在 `public/` 下。

以上规范已在本项目落地：PDF 预览使用自托管 `pdf.js`，`/works/view` 提供尾斜杠重定向，Worker 不再拼接整页 HTML。