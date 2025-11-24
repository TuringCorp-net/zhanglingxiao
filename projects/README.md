# 项目原则与操作指南（Agent维护）

说明
- 本文件由 Agent 维护（DoC: Maintained by Agent）。若需更改原则或流程，请在此文件更新，确保一致性与可发现性。

目录结构
- 根目录：/Users/lizhang/ZhangLingXiao/projects
  - Home：站点首页与目录页入口
  - Games/：游戏项目集合（如 Jump）
  - Tools/：工具项目集合

域名与路径分配
- 顶级域名：zhanglingxiao.com（强制 HTTPS 与 apex 域名）
- 路由：
  - /home 与 /home/：Home 静态与逻辑入口
  - /games/<slug> 与 /games/<slug>/：Games 静态与逻辑入口
  - /tools/<slug> 与 /tools/<slug>/：Tools 静态与逻辑入口
- 说明：Home Worker 提供静态资源与逻辑路由；未命中静态资源的请求转发到 Worker 代码处理。

Cloudflare 技术选型与工具使用
- 优先使用 Cloudflare 平台能力：Workers、KV、D1、Durable Objects（确有必要时再引入，优先免费计划中的能力）。
- 内部互调优先使用 Service Bindings（同一一级域名下），避免 http fetch 带来的网络与延迟开销。
- 处理 Cloudflare 配置、部署、调试时，优先使用 MCP 工具（官方调试、绑定、Observability 等）。

Service Bindings 使用原则
- 绑定范围：仅在 Home 需要与某项目交互（数据展示、健康检查）时添加绑定，避免过度绑定。
- 命名规范：大写简短（示例：JUMP）。
- 配置示例：在 Home 的 wrangler.toml 添加 [[services]]，service 为目标 Worker 名称，binding 为服务名（例：JUMP）。
- 健康检查：Home 提供统一 /health/{service} 路由；
  - 当 service 为 jump 时，探测 /games/jump/api/leaderboard（兼容现状）。
  - 推荐各项目新增 /health 路由以统一探测接口（示例：返回 { ok: true, version: "..." }）。

测试策略（集中化与最小化）
- 单元测试（每项目）：
  - 保留最小必要的单元测试（Vitest）。
  - 约定脚本：test:unit（首选），或 test（退化）。
- 系统/E2E 测试（集中在 Home）：
  - 集中维护在 Home/tests/e2e，覆盖站点入口与绑定服务的健康检查。
  - 远程开发：使用边缘本地模式（remote），与 Service Bindings 联动，避免本地取不到数据。

统一部署流水线（集中、一键执行）
- 脚本位置：Home/scripts/deploy-all.mjs（集中依赖与流程）。
- 运行：npm run deploy:all
- 流程：
  1) 运行 Home 单元测试
  2) 遍历 Games 与 Tools 的子项目，按需运行其单元测试（优先 test:unit，退化到 test）
  3) 先部署 Games 与 Tools（确保 Home 绑定指向最新版）
  4) 再部署 Home
  5) 部署后运行 Home 的集中化 E2E 测试
- 行为：若子项目未提供某脚本（如 test:unit、deploy），自动跳过，不会中断整体流程。

配置与命名约定
- KV 命名：Cloudflare KV namespace 名（控制台中的名称）与 Worker 绑定名（在代码使用的 env 变量名）可以不同；只需在 wrangler.toml 中 id/preview_id 指向正确的 KV namespace 即可。
- 资产绑定：Home 使用 ASSETS 绑定提供 public 目录静态资源；未命中资源的请求进入 Worker 逻辑。
- 路由策略：Home 的 wrangler.toml 定义 apex 与 www 域名的自定义域以及 /home*、/games、/tools 的路径匹配。

GitHub 连接与安全
- 连接、推送 GitHub 使用 SSH 模式，443 端口，避免网络连接问题。
- 安全最佳实践：
  - 不在代码或配置中暴露 secrets/keys
  - 不将密钥提交到仓库

新项目接入步骤（Games/Tools）
- 目录：在 Games/ 或 Tools/ 下创建新项目目录。
- 脚本：在该项目的 package.json 中提供最小脚本：test:unit、deploy。
- 测试：编写最小 Vitest 单测；E2E 由 Home 集中维护。
- 健康：建议实现 /health 路由以统一探测。
- 绑定（按需）：若 Home 需要联动，则在 Home/wrangler.toml 添加 [[services]] 绑定并扩展 /health/{service} 与 E2E 测试用例。

维护流程
- 原则与流程更新由 Agent 维护此 README，保持集中与一致性。

## 补充的原则性设计（Review 后新增）

1) 环境与版本管理
- 建议按需使用 Wrangler Environments（dev/preview/prod）区分配置与发布，避免手工切换出错。
- 开发优先使用 remote 边缘模式，以便与 Service Bindings 联动验证真实链路。

2) 可观测性与日志
- 统一使用 Workers Observability，记录结构化日志（建议包含 service、trigger、status、elapsed 等）。
- 为健康检查与关键路径打点，便于快速定位线上问题与回归。

3) 错误处理与回滚策略
- 流水线失败（尤其是 E2E 失败）时停止发布；优先定位根因再重试。
- 遇到绑定依赖变更（例如下游 Worker 接口变化）时，先更新下游并部署，下游可用后再更新 Home，最后整体验证。

4) 性能与缓存策略
- 静态资源通过 ASSETS 绑定统一托管，使用指纹命名与合理 Cache-Control。
- 动态接口按需使用 Cloudflare Cache 或 KV 缓存，设置过期与失效策略以平衡实时性与成本。

5) 安全与合规
- 强制 HTTPS 与 apex 域名已在 Home 中实现；继续避免在仓库中存储任何 secrets/keys。
- 建议设置基础安全响应头（CSP、HSTS、X-Content-Type-Options 等）按需开启。

6) 配置与密钥管理
- 通过 Wrangler 的环境变量或 secrets 管理敏感配置；不要写入仓库。
- KV/D1 等资源的 id/preview_id 与绑定名可以不同，但需要在 wrangler.toml 中精确指向。

7) CI/CD 与自动化
- 本地统一脚本：Home/scripts/deploy-all.mjs（先单测、先部署依赖后部署 Home、最后跑 E2E）。
- 后续可按需迁移到 CI（例如 GitHub Actions），但当前规模以本地脚本足够，避免过度工程化。

8) 新项目脚手架与约定
- 在 Games/ 或 Tools/ 下创建目录，提供最小脚本：test:unit、deploy。
- 实现 /health 路由（返回 { ok: true, version }），便于 Home 的统一探测与 E2E 集成。
- 若 Home 需要联动，在 Home/wrangler.toml 添加 [[services]] 并扩展 /health/{service} 探测与 E2E 用例。

9) 命名与一致性
- Service Binding 命名规范：大写简短（例如 JUMP）；路由路径以 /games/<slug> 与 /tools/<slug> 为准。
- 提交信息、分支命名清晰，便于回滚与审计（按需引入）。

10) 变更流程（Debug 与确认）
- 遵循“先分析原因与给出修改方案，再实施代码变更”的流程；变更后运行单测与统一 E2E，确保不引入新问题。