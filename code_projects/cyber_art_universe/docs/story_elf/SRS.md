# Story Elf — 系统需求规格（SRS）

---

## 文档说明

- **本文档是 Story Elf 的功能需求清单**。Story Elf 是 Cyber Art Universe 的第三大独立模块，跨 CAU（阅读侧）和 Story Forger（写作侧）两端服务，定位为 AI 辅助、智能引导、创作陪伴。
- **与 Story Forger SRS 的关系**：Story Forger SRS 覆盖写作工具功能（M0-M6 模板、Pipeline、稿段流水线）。本文档覆盖 Story Elf 的 AI 层——对话、引导、提示、记忆。两者互补，部分需求 ID 可能交叉引用。
- **何时更新**：新增 AI 能力、新工作流、新记忆维度时。
- **关联文档**：[架构总览](../ARCHITECTURE.md) → [Story Forger SRS](../story_forger/SRS.md) → [Story Elf 系统设计](system_design.md) → [Story Elf 前端设计](frontend_design.md) → [AI Gateway 指南](cloudflare_ai_gateway_guide.md)

---

## 文档版本

| 版本 | 日期 | 说明 |
|------|------|------|
| v0.1.0 | 2026-05-22 | 初始版本：覆盖 Hint 对话泡、AI 两层架构、四阶段实施路径 |
| v0.2.0 | 2026-05-22 | Phase 1 完成：AI Gateway 客户端（SE-020~027）实测验证通过 |
| v0.3.0 | 2026-05-25 | Phase 2 完成：上下文包组装（SE-030~032）+ 系统指令（SE-040, SE-042）。L0/L1 分层架构落地 |
| v0.3.1 | 2026-05-25 | 系统遥测模块：AI 调用用量统计（SE-080~081），D1 ai_usage_log 表 |

---

## 一、系统定位

### 1.1 Story Elf 的角色

Story Elf 不是"写作工具"，也不是"内容展示"，而是 **"理解和辅助"** —— 理解作者在写什么、理解读者在读什么，然后提供有意义的辅助。

| 侧 | 角色 | 核心场景 |
|----|------|---------|
| **Write（写作侧）** | 写作精灵 | 槽位提示、AI 对话、一致性检查、写作建议、内容提取、level 升级引导 |
| **Read（阅读侧）** | 伴读精灵 | 阅读位置感知、内容分析、推荐、问答（Phase 4+） |

### 1.2 与其他模块的边界

| 模块 | 职责 | Story Elf 与它的关系 |
|------|------|---------------------|
| **Story Forger** | 写作工具（模板、Pipeline、稿段流水线） | Story Elf 调用 Story Forger API 读取上下文；Story Elf 的对话、建议、检查结果写入对应模块 |
| **CAU** | 内容呈现、浏览、消费 | Story Elf 在 Read 页面提供伴读能力 |

---

## 二、功能需求

### 模块一：浮动组件与上下文感知

> 所有 AI 能力的基础——Story Elf 必须知道用户在哪里、在做什么。

| ID | 需求 | 验收标准 | 状态 |
|----|------|---------|------|
| SE-001 | 浮动组件 — 自包含 JS 文件，可拖拽，位置跨页面保持（localStorage） | `<script src="/story-elf.js">` 即可使用。`window.StoryElf` API。CSS/HTML/拖动全部封装 | ✅ 已实现 |
| SE-002 | 上下文感知 — 页面自动传入当前阅读/写作位置 | `StoryElf.setContext({ page, work_id, module, section_id, ... })` 在页面关键节点调用 | ✅ 已实现 |
| SE-003 | 操作按钮 — Write 页面注入「检」「议」等快捷按钮 | `StoryElf.setActions([...])` 动态渲染按钮 | ✅ 已实现 |

### 模块二：Hint 对话泡

> 将模板槽位的 hint 从 textarea placeholder 移出，改为 Story Elf 以打字机效果呈现。

| ID | 需求 | 验收标准 | 状态 |
|----|------|---------|------|
| SE-010 | Hint 对话泡 UI — 独立于左侧聊天窗口的气泡，定位在 Story Elf 上方 | 气泡跟随 Story Elf 位置，300px 宽，半透明深色背景，圆角卡片。与左侧 `#elf-dialog` 同时存在互不干扰 | ✅ 已实现 |
| SE-011 | 打字机效果 — 逐字显示 hint（markdown 渲染），~40ms/字，标点智能停顿 | 句号/问号/感叹号 +200ms，逗号/分号 +100ms。`requestAnimationFrame` 级别流畅度 | ✅ 已实现 |
| SE-012 | 槽位聚焦触发 — 用户点击/聚焦槽位 textarea 时显示 hint | `focusin` 事件冒泡到 `#slot-editor`，读取 `data-hint` 属性。无 hint 的槽位不弹出 | ✅ 已实现 |
| SE-013 | 切换槽位 — 中断当前打字机，立即开始新 hint | 切换 textarea 时旧动画取消，新 hint 从头开始逐字渲染 | ✅ 已实现 |
| SE-014 | Markdown 渐进渲染 — hint 文本支持轻量 Markdown（粗体/斜体/代码/链接） | `marked.parse()` 逐字累积渲染。不支持图片、表格、代码块 | ✅ 已实现 |
| SE-015 | 手动关闭 — 关闭按钮，关闭后可再次聚焦重新展示 | 点击 × 关闭气泡，不阻止后续聚焦 | ✅ 已实现 |

### 模块三：AI 底层调用（Layer 1 — AI Gateway 客户端）

> 通过 Cloudflare AI Gateway 统一调用大模型，隐藏真实 API key。

| ID | 需求 | 验收标准 | 状态 |
|----|------|---------|------|
| SE-020 | AI Gateway 统一入口 — 所有 LLM 调用通过 Cloudflare AI Gateway | `lib/ai.ts` 中 `callAI()` 函数，URL 格式 `gateway.ai.cloudflare.com/v1/{account}/{gateway}/{provider}/chat/completions`。已通过 `elf/chat` 端点实测验证，Cloudflare 后台可见调用日志 | ✅ 已实现 |
| SE-021 | BYOK 认证 — 真实模型 API key 在 CF Dashboard 配置，Worker 仅持有 Gateway token | `CF_AIG_TOKEN` 以 Secret 注入 Worker。请求头 `cf-aig-authorization: Bearer $CF_AIG_TOKEN`。原 `AI_PROVIDER`/`AI_API_KEY` Secret 已标记 deprecated | ✅ 已实现 |
| SE-022 | 默认模型 — deepseek-v4-flash（1M 上下文窗口） | 不传 `model` 参数时默认使用。`MODEL_PROVIDER` 映射支持 deepseek-v4-flash/pro、gpt-4o/mini | ✅ 已实现 |
| SE-023 | 消息格式 — 支持 system / user / assistant 多角色消息 | `callAI(env, [{role:'system',content}, {role:'user',content}])`。`generateWithAI` 兼容包装将旧接口的单一 prompt 转为单条 user message | ✅ 已实现 |
| SE-024 | 重试机制 — 指数退避重试，默认 2 次重试（共 3 次尝试） | 500ms → 1000ms → 2000ms。仅对 5xx / 429 / 网络错误重试，4xx 不重试 | ✅ 已实现 |
| SE-025 | 超时控制 — AbortController 30s 默认超时 | 超时后抛出 `AIError('TIMEOUT', ...)`。调用方可自定义 `options.timeout` | ✅ 已实现 |
| SE-026 | JSON 模式 — 支持要求模型返回结构化 JSON | `options.responseFormat: 'json'` → 追加 JSON 格式 system 指令 + 自动去除 markdown fence | ✅ 已实现 |
| SE-027 | 统一错误类型 — 超时、限流、认证失败、模型不可用等标准错误 | `AIError` 类包含 `code`（TIMEOUT/RATE_LIMITED/AUTH_FAILED/MODEL_UNAVAILABLE/INVALID_RESPONSE/UNKNOWN）+ `statusCode` | ✅ 已实现 |

### 模块四：Agent 层（Layer 2 — 上下文 + 指令 + 记忆 + 工作流）

#### 4.1 上下文组装

| ID | 需求 | 验收标准 | 状态 |
|----|------|---------|------|
| SE-030 | 作品上下文拉取 — 根据 workId 和 lang 从 R2/DB 拉取完整上下文 | `getOrBuildContextPackage(env, workId, lang)` → M0-M5 结构化 MD，R2 缓存。`assembleContext()` 组装为 AgentVars | ✅ 已实现 |
| SE-031 | 上下文截断策略 — 各上下文源有独立的字符截断上限，防止超出模型上下文窗口 | 当前阶段 M0-M5 全量纳入（实测最多占 1M 窗口 ~16%）。超大规模时可关闭 M5 意图卡（`includeM5: false`） | ✅ 已实现 |
| SE-032 | 上下文缓存 — 同一 workId + lang 的上下文在单次请求内复用 | 上下文包写入 R2 `elf_context_package.md`，后续请求直接读取（单次 R2 GET，延迟 <20ms） | ✅ 已实现 |

#### 4.2 系统指令

| ID | 需求 | 验收标准 | 状态 |
|----|------|---------|------|
| SE-040 | 角色化 System Prompt — Write 侧为"辅助创作的 AI 伴侣"，Read 侧为"陪伴阅读的 AI 伴侣" | `l1/prompts/{scenario}/system.md` 人类维护的模板，`buildSystemPrompt()` 渲染。Write 侧：鼓励、建设性、尊重作者决定。Read 侧：灵动、温暖、不剧透 | ✅ 已实现 |
| SE-041 | 模块感知指令 — 根据当前模块（M0-M6）调整 system prompt 的侧重点 | M0 时强调"无模板，自由灵感"；M5 时强调"意图卡驱动，本章具体约束" | ⏳ Phase 3 |
| SE-042 | 可扩展指令模板 — 新增场景时只需添加配置 + prompt，不改核心逻辑 | `scenarios.ts` 注册场景，`prompts/{scenario}/system.md` 独立维护。新增场景只需 3 步：创建 .md → import → 注册 | ✅ 已实现 |

#### 4.3 工作流编排

| ID | 需求 | 验收标准 | 状态 |
|----|------|---------|------|
| SE-050 | 主动提示 — Story Elf 在检测到合适时机时主动弹出提示（不等待用户提问） | 例如：用户完成 M1 自由写作后，Elf 提示"要不要试试让 AI 帮你整理世界观？" | ⏳ Phase 3 |
| SE-051 | Level 升级建议 — 检测当前作品完成度，建议作者升级模板 level | `POST /api/elf/suggest-level` → 返回 `{ should_upgrade: bool, reason: string }` | ⏳ Phase 3 |
| SE-052 | 自由写作内容提取 — 从 L0 自由编辑区提取结构化信息，映射到模板槽位 | `POST /api/elf/extract` → `{ suggestions: [{ slotId, content, confidence }] }` | ⏳ Phase 3 |
| SE-053 | 动态提示生成 — Story Elf 根据作者当前模块和进度，生成个性化双语提示 | `appendDynamicHint(env, workId, module, lang)` → 生成 `{zh, en}` 提示，追加到 R2 `works/{id}/hints/{module}.json` | ⏳ Phase 3 |

#### 4.4 记忆系统

| ID | 需求 | 验收标准 | 状态 |
|----|------|---------|------|
| SE-060 | 对话历史持久化 — 每次对话追加到 R2，下次对话时加载 | R2 `works/{id}/elf_memory.json` → `{ messages: [{role, content, timestamp}] }`。保留最近 50 轮对话 | ⏳ Phase 4 |
| SE-061 | 用户偏好学习 — 从对话和写作行为中提取用户偏好（风格、节奏、关注点） | 偏好存储在 R2 `works/{id}/elf_prefs.json` → `{ style, pace, focus_areas, ... }`。注入 system prompt 作为个性化上下文 | ⏳ Phase 4 |
| SE-062 | 跨会话记忆 — 同一作品的不同写作会话之间记忆延续 | 重新打开写作桌时，Story Elf 回顾上次对话摘要，恢复上下文 | ⏳ Phase 4 |

### 模块五：Read 侧伴读

| ID | 需求 | 验收标准 | 状态 |
|----|------|---------|------|
| SE-070 | Read 侧 AI 对话 — 读者在阅读页面向 Story Elf 提问 | 复用 SE-020~027（AI Gateway 客户端）+ SE-040（伴读 system prompt）。上下文自动包含当前章节内容 | ⏳ Phase 4+ |

### 模块六：系统遥测

> AI 调用用量统计，用于系统健康度监控、成本分析、异常告警。数据同时写入 console.log 和 D1。

| ID | 需求 | 验收标准 | 状态 |
|----|------|---------|------|
| SE-080 | AI 用量记录 — 每次大模型调用后记录 token 使用量和缓存命中率 | `lib/telemetry.ts` 的 `recordAIUsage()`：写入 D1 `ai_usage_log` 表 + `console.log` 结构化日志 | ✅ 已实现 |
| SE-081 | 用户级用量统计 — 区分用户统计 token 使用量和频次 | `user_token` 字段从 Authorization header 提取（脱敏前 8 位）。后续可映射到真实 user_id | ✅ 已实现 |

---

## 三、API 端点

| 方法 | 路径 | 说明 | SRS ID |
|------|------|------|--------|
| POST | `/api/write/elf/chat` | Story Elf AI 对话（Write + Read 共用） | SE-020~027, SE-030~032, SE-040~042 |
| GET | `/api/elf/hints/{module}` | 获取模块静态 + 动态提示 | SE-053 |
| POST | `/api/elf/hints/{module}` | Story Elf 内部写入动态提示 | SE-053 |
| POST | `/api/elf/extract` | 从自由文本提取结构化槽位建议 | SE-052 |
| POST | `/api/elf/suggest-level` | 根据完成度建议是否升级 level | SE-051 |

> 注：`/api/elf/` 目录当前未创建（SE-053、SE-052、SE-051 的端点待实现）。现有 `/api/write/elf/chat` 已实现但需迁移到新 AI Gateway 架构。

---

## 四、实施阶段总览

| 阶段 | 覆盖 SRS ID | 状态 |
|------|------------|------|
| **已完成** | SE-001~003, SE-010~015 | ✅ |
| **Phase 1** | SE-020~027（AI Gateway 客户端） | ✅ 已完成（2026-05-22 实测验证通过） |
| **Phase 2** | SE-030~032, SE-040, SE-042（上下文 + 指令） | ✅ 已完成（2026-05-25） |
| **Phase 3** | SE-041, SE-050~053（工作流编排） | ⏳ 待开始 |
| **Phase 4** | SE-060~062（记忆系统） | ⏳ 待开始 |
| **远期** | SE-070（Read 侧伴读） | ⏳ 未排期 |

---

## 五、设计原则

1. **Elf 是向导，不是替代者**。AI 的建议是"建议"，人类始终拥有最终决策权。
2. **后台完整，前台渐进**。AI 始终能看到完整模板，人类根据 level 逐步解锁。
3. **自由写作优先于结构化填写**。人类应该先"吐出来"，再由 AI 帮助结构化。
4. **陪伴跨场景**。同一套 AI 能力同时服务于写作桌和阅读页。
5. **两层分离**。Layer 1（AI Gateway 客户端）与 Layer 2（Agent 层）职责清晰，工具类端点可跳过 Agent 层直接调用 Layer 1。
