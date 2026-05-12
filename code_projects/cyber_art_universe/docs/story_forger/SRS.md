# Story Forger — 系统需求规格（SRS）

---

## 文档说明

- **本文档是 Story Forger 的功能需求清单**。Story Forger 是 Cyber Art Universe 的写作侧引擎，与 CAU 平台（阅读侧）共享同一套 D1/R2 基础设施，是同一个项目的 Write 面。
- **与传统 SRS 的区别**：同 CAU SRS — 文档追踪需求，代码是 truth source。
- **何时更新**：业务需求变更 / 新模块实现 / Review 发现问题时。
- **关联文档**：[CAU Business Concept](../business_concept.md) → [Story Forger Original Concept](original_concept.md) → 本文档 → [Story Forger System Design](system_design.md) → [CAU SRS](../cau/SRS.md)

---

## 文档版本

| 版本 | 日期 | 说明 |
|------|------|------|
| v1.0.0 | 2026-05-07 | 初始版本，6 模块功能需求 + 作品状态生命周期 |
| v1.2.0 | 2026-05-08 | SF-060（软木板拖拽）、SF-061（写作桌三栏）、SF-062（活页夹）全部实现 |
| v1.4.0 | 2026-05-08 | SF-023~052 全部实现：伏笔账本、冲突地图、章节重写、营销辅助、MCP Write 工具。SF-025 合并入 SF-022 |
| v1.5.0 | 2026-05-09 | SF-015（世界观结构化模板）、SF-063（写作引导流程）|
| v1.6.0 | 2026-05-09 | SF-016（多语言支持：中英双语模板 + R2 语言路径 + 双语生成 + 前端语言切换）|
| v1.7.0 | 2026-05-09 | 全员模板化：M2 长篇框架模板、M3 人物卡模板、M5 意图卡模板、M6 营销卡模板全部固化（中英双语）。各模块读取时返回模板框架而非空。|
| v1.8.0 | 2026-05-11 | 经典作品案例分析驱动优化：M5 意图卡新增 emotional_goal / POV / 可选媒介字段；M3 人物卡新增 arc_type + 跨模块交叉引用（M1/M4）；M4 伏笔账本新增依赖的 M1 规则 |
| v1.9.0 | 2026-05-12 | M0 原始构想模块：作者自由记录灵感与原始构想，无模板。Story Elf 禁止修改，外部 AI/Agent 视为作者可读写。前端 Pipeline 引导条和左活页夹新增 M0 面板 |
| v2.0.0 | 2026-05-12 | Story Elf：横跨 Read/Write 的浮动 AI 伴侣（Context-Aware）。自包含组件 story-elf.js。位置跨页面保持 |

---

## 零、系统定位

### 产品形态

Story Forger 不是一个独立的应用，而是 CAU 的 **Write 面**。它与 CAU 的 Read 面共享：

| 共享资源 | 说明 |
|---------|------|
| D1 数据库 | 同一套 `works`/`sections`/`entities`/`reviews` 表 |
| R2 存储 | 同一套 `works/{id}/` 路径结构 |
| 用户体系 | 未来的用户认证同时服务于读写两侧 |
| 域名 | `CAU.turingcorp.net`，`/write.html` 为写作入口 |

### 双重消费者

Story Forger 的每项功能同时服务于两类消费者：

| 消费者 | 接口 | 场景 |
|--------|------|------|
| **人类创作者** | Web UI（`/write.html` 及子页面） | 在浏览器中使用写作工作台 |
| **AI Agent**（外部） | REST API + MCP Tools | 外部 AI 调用写作工具，按框架逐步产出长篇小说 |

两类消费者使用**完全相同的 API**，区别仅在前端或调用方式。

> **首要服务对象**：CAU 和 Story Forger 的首要服务对象是 AI/Agent，人类是附带服务对象。前端 UI 面向人类，但所有 API 端点为 AI 设计——外部 AI/Agent 被视为**作者或读者**，享有与人类用户同等的 API 访问权限。

### Story Elf（故事精灵）—— 内部辅助 AI

为避免混淆，系统区分两种"AI"：

| 术语 | 定义 | 权限边界 |
|------|------|---------|
| **Story Elf（故事精灵）** | Story Forger 内置的辅助创作 AI，负责扩写、校验、建议。体现小精灵般灵动、有魔法、可爱的特质 | 可读写 M1-M6。**禁止修改 M0**（原始构想）。不替代作者决策 |
| **外部 AI / Agent** | 通过 REST API 或 MCP Tools 调用 Story Forger 的第三方 AI/Agent | 视为**作者或读者**。享有全部 API 权限，包括 M0 的读写 |

从此处开始，文档中"AI"如不加限定，泛指所有 AI（内部 + 外部）。涉及权限限制时，明确使用 **Story Elf** 指代内部辅助 AI。

---

## 一、作品状态生命周期

### 状态定义

Story Forger 与 CAU 共用 `works.status` 字段。状态流转定义了作品从创作到对外发布的完整生命周期：

```
          ┌──────────┐
          │  draft   │  创作中。仅作者可见。Story Forger 工作区。
          └────┬─────┘
               │ 作者完成创作，点击发布
               ▼
          ┌──────────┐
          │ published│  已发布。在 CAU 公开可见，可被搜索、浏览、阅读。
          └────┬─────┘
               │ 作者下架
               ▼
          ┌──────────┐
          │  closed  │  已下架。不再对外可见。作者可重新发布（回到 published）。
          └──────────┘
```

### 状态转换规则

| 从 | 到 | 谁可以执行 | 条件 |
|----|-----|----------|------|
| `draft` | `published` | 作者 | 作品至少有 1 个章节 |
| `published` | `closed` | 作者 | 任何时间 |
| `closed` | `published` | 作者 | 任何时间（重新上架） |
| `draft` | `closed` | 作者 | 直接废弃（不经过发布） |

### 不同状态下的可见性

| 状态 | 作者自己 | 其他用户 | CAU 目录/搜索 |
|------|---------|---------|-------------|
| `draft` | 可见（预览模式） | 不可见 | 不可见 |
| `published` | 可见 | 可见 | 可见 |
| `closed` | 可见（作者后台） | 不可见 | 不可见 |

> **关键**：同一部作品在不同状态下使用的是**同一张 works 表同一行**，只是 `status` 字段不同。CAU 的 `/api/catalog` 默认过滤 `status=published`，确保 draft/closed 作品不对外暴露。

---

## 二、功能需求

### 模块一：创作工作区管理

| ID | 需求 | 验收标准 | 状态 |
|----|------|---------|------|
| SF-001 | 创建作品 — 设定标题、题材分类（category）、内容形态（type=novel 默认）、创作属性 | `POST /api/write/works` 创建 `status=draft` 的作品 | ✅ 已实现 |
| SF-002 | 列出我的作品 — 按状态/分类/更新时间筛选 | `GET /api/write/works?status=draft` | ✅ 已实现 |
| SF-003 | 更新作品元信息 — 标题、题材、摘要、标签 | `PUT /api/write/works/{id}` | ✅ 已实现 |
| SF-004 | 删除作品 — 仅限 draft 或 closed 状态 | `DELETE /api/write/works/{id}` | ✅ 已实现 |
| SF-005 | 预览作品 — 按 published 态的渲染效果预览 draft 作品 | `GET /api/write/works/{id}/preview` 返回完整作品渲染数据 | ✅ 已实现 |

### 模块零：原始构想（M0）

> **设计原则**：M0 是创作者自己的原始构想与灵感记录空间，位于整个 AI 辅助流水线之前。与 M1-M6 不同，M0 不提供任何模板，不强制任何格式。这是属于创作者自己的私人创意空间。

**权限规则**：

| 角色 | 读 | 写 | 说明 |
|------|----|----|------|
| 人类作者 | ✅ | ✅ | 自由记录，随时修改 |
| 外部 AI/Agent | ✅ | ✅ | 视为作者，享有完整权限 |
| Story Elf（内部辅助AI） | ✅ | ❌ **禁止** | 可读取作为 M1-M6 的参考上下文，但**绝不修改** |

| ID | 需求 | 验收标准 | 状态 |
|----|------|---------|------|
| SF-006 | 原始构想读写 — 作者可自由记录创意灵感，无模板、无格式约束。存储为 Markdown 文件，同步到 R2 | `GET /api/write/original-concept/{work_id}` 返回原始构想内容（首次为空）；`PUT /api/write/original-concept/{work_id}` 保存内容到 R2 `works/{id}/{lang}/original_concept.md` | ✅ 已实现 |
| SF-007 | Story Elf 禁止修改原始构想 — Story Elf 不得以任何方式修改 M0 内容。外部 AI/Agent 视为作者，可正常读写 | 系统设计明确记录此规则。前端面板标注"仅作者可编辑 · Story Elf 不可修改" | ✅ 已实现 |

### 模块二：世界观/设定引擎

| ID | 需求 | 验收标准 | 状态 |
|----|------|---------|------|
| SF-010 | 生成设定圣经（Setting Bible）— 根据作品标题/题材/一句话描述，AI 生成结构化的世界观设定 | `POST /api/write/worldbuilding/generate` 接受 `{work_id, prompt}`，输出写入 R2 `works/{id}/world_bible.md` | ✅ 已实现 |
| SF-011 | 读取设定圣经 — 返回当前版本的完整设定 | `GET /api/write/worldbuilding/{work_id}` 返回 world_bible.md 内容 | ✅ 已实现 |
| SF-012 | 更新设定圣经 — 手动编辑或 AI 增量修改 | `PUT /api/write/worldbuilding/{work_id}` | ✅ 已实现 |
| SF-013 | 设定约束清单 — 从圣经中提取可用于一致性校验的关键约束 | `GET /api/write/worldbuilding/{work_id}/constraints` 返回结构化约束列表 | ✅ 已实现 |
| SF-014 | 角色/实体管理 — 创建、编辑、删除角色卡、地点卡、道具卡 | `POST/PUT/DELETE /api/write/works/{id}/entities`（独立端点，不再复用 CAU admin）| ✅ 已实现 |
| SF-015 | 世界观结构化模板 — 创建作品时自动初始化带有完整框架的 world_bible.md（6 大章节框架，中英双语）。首次打开世界观面板时，展示结构化空模板而非空白文档，引导作者按框架填写 | `GET /api/write/worldbuilding/{work_id}` 当 R2 无内容时，返回对应语言的 BIBLE_TEMPLATE。模板作为 AI 生成的 prompt 约束 | ✅ 已实现 |
| SF-016 | 多语言支持 — R2 存储按语言前缀分目录。所有 Write API 支持 `?lang=` 参数。生成端点支持 `bilingual: true` 双语并行生成（默认 zh+en）。前端提供语言切换器和双语生成复选框 | 首批支持 zh/en。扩展新语种只需添加语言代码和对应模板 | ✅ 已实现 |
| SF-017 | 长篇框架模板 — M2 产出结构化 outline.md 模板（故事概览→主线阶段→支线→节奏→转折点→伏笔规划）。首次打开总纲面板时展示模板框架，引导作者填写 | `GET /api/write/outline/{work_id}` 无内容时返回双语长篇框架模板。AI 生成时在模板框架内填充。前端总纲面板展示完整框架 | ✅ 已实现 |
| SF-018 | 人物卡模板 — M3 创建角色时自动写入 R2 人物卡文件（6 章框架：基本信息→性格动机→能力限制（含 M1/M4 交叉引用）→关系网络→成长弧线（含 arc_type）→语言行为）。`GET .../{eid}/card` 返回人物卡，无内容时返回模板 | 创建 character 类型实体时自动生成模板。人物树点击角色→在写作区展示人物卡。中英双语模板。v1.8.0：新增 arc_type（弧线类型）、关联的 M1 世界规则、关联的 M4 伏笔 | ✅ 已实现 |

### 模块三：目录与长篇框架引擎

| ID | 需求 | 验收标准 | 状态 |
|----|------|---------|------|
| SF-020 | 生成大纲 — AI 根据设定圣经生成分阶段/分幕的目录结构 | `POST /api/write/outline/generate` 输出写入 R2 `works/{id}/outline.md` 和 D1 sections 表 | ✅ 已实现 |
| SF-021 | 读取大纲 — 返回当前目录结构（含章节摘要） | `GET /api/write/outline/{work_id}` 返回完整大纲 | ✅ 已实现 |
| SF-022 | 编辑大纲 — 手动调整章节顺序、增删章节、修改标题和摘要 | `PUT /api/write/outline/{work_id}` | ✅ 已实现 |
| SF-023 | 伏笔账本 — 规划导向：AI 基于大纲/世界观帮助作者主动设计伏笔网络（6 种类型 + 5 阶段生命周期 + 3 级强度）。每条伏笔含"依赖的 M1 规则"交叉引用。存储为结构化 Markdown 模板。M6 一致性校验正向检查伏笔执行情况 | `POST /api/write/foreshadowing/generate`（规划），`GET /api/write/foreshadowing/{work_id}`（读取，无内容时返回双语模板）。存储 R2 `works/{id}/{lang}/foreshadowing.md`。不做全盘扫描已有章节。v1.8.0：新增依赖的 M1 规则字段 | ✅ 已实现 |
| SF-024 | ~~冲突地图~~ | **已删除**。冲突的本质已融入 M2 长篇框架（核心冲突、阶段划分、转折点），不需要独立模块 | ❌ 已移除 |
| SF-025 | 章节拖拽重排 — 支持软木板视图下拖拽调整章节顺序，批量更新 order_index | **已合并入 SF-022**。frontend 拖拽 → `PUT /api/write/outline/{work_id}`（含完整 order_index）→ 重排即保存。不另建专用端点 | ✅ 由 SF-022 覆盖 |

### 模块四：章节生产流水线

这是 Story Forger 的核心引擎。每章生产走固定流程：

```
Intent Card → Draft v0 → Consistency Check → Polish → Draft v1 (中稿)
```

| ID | 需求 | 验收标准 | 状态 |
|----|------|---------|------|
| SF-030 | 意图卡（Intent Card）— 每次写章节前，定义本章目标、情绪目标、POV 策略、结构要求、伏笔回收点，支持可选媒介特定字段（视觉关键词、镜头备注、游戏目标、分支等） | `POST /api/write/draft/intent` 接受 `{work_id, chapter_index, goal, emotional_goal?, pov_character?, pov_strategy?, visual_keywords?, camera_notes?, gameplay_goal?, player_learning_goal?, branching?, scene_type?, hooks, foreshadowing_ids, style_notes?}` | ✅ 已实现 |
| SF-031 | 初稿生成（Draft v0）— AI 根据意图卡 + 设定圣经约束 + 大纲上下文，生成章节正文 | `POST /api/write/draft/generate` 输出写入 R2 `works/{id}/chapters/ch_{idx}.md`，并写入 D1 sections 表 | ✅ 已实现 |
| SF-032 | 一致性校验（Consistency Check）— 对照设定圣经、大纲、伏笔账本、历史章节，检测矛盾。每条问题标注严重等级（⚠ warning / 🔴 error） | `POST /api/write/draft/check/{work_id}/{section_id}` 返回 `[{severity: 'warning'|'error', type, description, location, suggestion}]` | ✅ 已实现 |
| SF-033 | 润色优化（Polish）— AI 根据一致性校验结果和风格要求，优化章节 | `POST /api/write/draft/polish` 接受 `{section_id, fix_issues: [...], style_notes}` | ✅ 已实现 |
| SF-034 | 中稿输出（Draft v1）— 输出最终版本，附带审校报告和设定更新建议 | `GET /api/write/draft/output/{section_id}` 返回正文 + 审校报告 | ✅ 已实现 |
| SF-035 | 章节重写 — 对已有章节进行重写，保留意图卡约束 | `POST /api/write/draft/rewrite/{section_id}`，接受 `{work_id, instructions?, style_notes?}`。保留原意图卡 goal/hooks/foreshadowing_ids | ✅ 已实现 |

### 模块五：营销与分发辅助

| ID | 需求 | 验收标准 | 状态 |
|----|------|---------|------|
| SF-040 | 爆点提炼 — 从章节中提取可作为营销素材的金句/冲突点/钩子 | `POST /api/write/marketing/extract/{section_id}` 接受 `{work_id}`，返回 golden_lines/hooks/conflict_points/suggested_hashtags | ✅ 已实现 |
| SF-041 | 标题/简介生成 — 为作品生成多个标题和简介版本 | `POST /api/write/marketing/titles/{work_id}` 接受 `{num_variants, style_notes}`，返回多版本 title/subtitle/hook | ✅ 已实现 |
| SF-042 | 分发改写 — 将章节改写为短视频口播 / X / LinkedIn 等多种格式 | `POST /api/write/marketing/repurpose/{section_id}?format=short_video|x|linkedin` | ✅ 已实现 |

### 模块六：MCP 工具暴露

| ID | 需求 | 验收标准 | 状态 |
|----|------|---------|------|
| SF-050 | MCP Resources — 暴露世界观、大纲、章节等资源 | MCP `resources/list` 包含 `sf://workspace/{id}`, `sf://worldbuilding/{id}`, `sf://foreshadowing/{id}`, `sf://conflicts/{id}` | ✅ 已实现 |
| SF-051 | MCP Tools — 暴露 AI 可调用的写作工具 | 5 个 Write 工具：`generate_worldbuilding`, `generate_outline`, `generate_chapter`, `check_consistency`, `polish_chapter` | ✅ 已实现 |
| SF-052 | MCP 与 REST 共底 — MCP 工具和 REST API 调用同一套处理函数 | 每个 MCP tool 内部构造 mock Request，调用 Write handler（与现有 Read 工具相同模式）| ✅ 已实现 |

### 模块七：Story Elf — 浮动 AI 伴侣

> **设计原则**：Story Elf 是横跨 Read / Write 两侧的浮动 AI 伴侣。以 IP 形象（小精灵）呈现，可拖拽至屏幕任意位置，位置跨页面保持。Read 侧为"伴读精灵"，Write 侧为"写作精灵"。核心差异化能力：**上下文感知**——用户无需复制粘贴，Elf 天然知道用户当前在读哪个作品的哪一章、在写哪个模块。

| ID | 需求 | 验收标准 | 状态 |
|----|------|---------|------|
| SF-053 | Story Elf 浮动组件 — 自包含 JS 文件，任何页面引用即可出现。可拖拽、位置跨页面保持（localStorage） | `<script src="/story-elf.js">` 即可使用。`window.StoryElf` API 暴露。CSS/HTML/拖动逻辑全部封装 | ✅ 已实现 |
| SF-054 | Context-Aware 上下文感知 — 页面自动将当前阅读/写作位置传给 Elf。用户无需复制粘贴 | `StoryElf.setContext({ page, work_id, section_id, ... })` 在页面关键节点调用。Elf 对话时可读取上下文 | ✅ 已实现 |
| SF-055 | Write 侧写作精灵 — 一致性检查、建议、对话式润色 | 右下角浮动按钮「检」「议」+ 对话框。Elf 知道当前章节/面板上下文 | ✅ 已实现 |
| SF-056 | Read 侧伴读精灵 — 浮动形象 + 对话框，未来支持根据阅读位置提供分析、推荐 | Story Elf 在所有 Read 页面出现。上下文感知已接入（work_id/section_id），AI 后端待实现 | ✅ 组件已部署，AI 功能待实现 |

### 模块八：双模式 UI（前端）

> 此模块的需求源自 [UI 设计讨论](frontend_design.md)。Story Forger 采用 Scrivener 活页夹 + 软木板的融合范式，提供软木板视图（规划）和写作桌视图（写作），一键切换。

| ID | 需求 | 验收标准 | 状态 |
|----|------|---------|------|
| SF-060 | ~~软木板视图~~ | **已删除**。软木板功能已合并入 SF-061 写作桌：章节卡片→章节树，拖拽排序→章节树拖拽，状态筛选→章节树筛选按钮 | ❌ 已合并 |
| SF-061 | 写作桌统一界面 — 左活页夹（五大面板）+ 中写作区（编辑所有内容）+ 右活页夹（AI 辅助）。不再区分规划/写作模式 | 左：总纲/世界观/人物树/章节树(可拖拽+筛选)/伏笔。中：Markdown 编辑+预览。右：Info/Lint/Suggest/Chat 四 Tab | ✅ 已实现 |
| SF-062 | 活页夹面板系统 — 左右活页夹可独立折叠/展开，拖拽边缘调整宽度 | 折叠时仅显示图标列（60px）。宽度调整保存到 localStorage | ✅ 已实现 |
| SF-063 | 写作引导流程 — 页面顶部始终显示 M1→M6 流水线引导条，显示模块状态，点击跳转 | 引导条在工具栏下方始终可见。每一步根据 R2 资产判定状态 | ⏳ 待实现 |

---

## 三、数据模型（新增）

Story Forger 尽量复用 CAU 的已有表结构。以下为需要新增的部分：

### 复用已有表

| 表 | 用途 | 关键字段 |
|----|------|---------|
| `works` | 作品主表 | `status`（draft/published/closed）、`category`、`type`、`creation_attribution` |
| `sections` | 章节 | `work_id`、`order_index`、`section_summary`、`word_count`、`version` |
| `entities` | 角色/地点/道具 | `work_id`、`type`（character/location/item/event）、`description` |
| `events` | 事件日志 | `event_type`（chapter.created / draft.polished 等） |

### R2 路径扩展

```
works/{work_id}/
├── original_concept.md     # 原始构想（M0，Story Elf 禁止修改，外部 AI/Agent 视为作者可读写）
├── world_bible.md          # 设定圣经（SF 写入，CAU 可读）
├── story_bible.md          # 项目圣经（风格/口吻/禁区）
├── outline.md              # 大纲（已有）
├── foreshadowing.md        # 伏笔账本（SF 新增）
├── chapters/               # 章节正文（已有）
├── summaries/              # 章节摘要（已有）
├── characters/             # 角色卡（已有）
├── events/                 # 事件卡（已有）
└── outlines/               # 分幕大纲（已有）
```

> **设计原则**：Story Forger 产出和 CAU 消费的是**同一份 R2 文件**。作者写完章节 → 写入 R2 → 发布后 CAU 直接读取同一路径。

---

## 四、API 端点设计

### 读写分离的端点前缀

| 前缀 | 用途 | 认证 |
|------|------|------|
| `/api/write/` | Story Forger 写作 API | 用户 Token（`Authorization: Bearer xxx`） |
| `/api/read/` | CAU 阅读 API（别名，兼容现有 `/api/`） | 公开 |

> `/api/read/` 作为现有 `/api/catalog`、`/api/content/{id}` 等的别名，保持向后兼容。

### Write API 总览

| 方法 | 路径 | 模块 | SRS ID |
|------|------|------|--------|
| POST | `/api/write/works` | 工作区 | SF-001 |
| GET | `/api/write/works` | 工作区 | SF-002 |
| PUT | `/api/write/works/{id}` | 工作区 | SF-003 |
| DELETE | `/api/write/works/{id}` | 工作区 | SF-004 |
| GET | `/api/write/works/{id}/preview` | 工作区 | SF-005 |
| GET | `/api/write/original-concept/{work_id}` | 原始构想 | SF-006 |
| PUT | `/api/write/original-concept/{work_id}` | 原始构想 | SF-006 |
| POST | `/api/write/worldbuilding/generate` | 世界观 | SF-010 |
| GET | `/api/write/worldbuilding/{work_id}` | 世界观 | SF-011 |
| PUT | `/api/write/worldbuilding/{work_id}` | 世界观 | SF-012 |
| GET | `/api/write/worldbuilding/{work_id}/constraints` | 世界观 | SF-013 |
| POST | `/api/write/outline/generate` | 大纲 | SF-020 |
| GET | `/api/write/outline/{work_id}` | 大纲 | SF-021 |
| PUT | `/api/write/outline/{work_id}` | 大纲 | SF-022 |
| POST | `/api/write/outline/{work_id}/foreshadowing` | 大纲 | SF-023 |
| POST | `/api/write/outline/{work_id}/conflicts` | 大纲 | SF-024 |
| POST | `/api/write/draft/intent` | 写作 | SF-030 |
| POST | `/api/write/draft/generate` | 写作 | SF-031 |
| POST | `/api/write/draft/check/{work_id}/{section_id}` | 写作 | SF-032 |
| POST | `/api/write/draft/polish` | 写作 | SF-033 |
| GET | `/api/write/draft/output/{section_id}` | 写作 | SF-034 |
| POST | `/api/write/draft/rewrite/{section_id}` | 写作 | SF-035 |
| POST | `/api/write/marketing/extract/{section_id}` | 营销 | SF-040 |
| POST | `/api/write/marketing/titles/{work_id}` | 营销 | SF-041 |
| POST | `/api/write/marketing/repurpose/{section_id}` | 营销 | SF-042 |

---

## 五、与 CAU 的集成点

| 集成点 | 方式 |
|--------|------|
| 作品发布 | 作者点击"发布"→ `PATCH /api/write/works/{id}/publish` → 将 status 从 draft 改为 published → CAU 的 catalog 立即可见 |
| 作品下架 | 作者点击"下架"→ `PATCH /api/write/works/{id}/close` → status 改为 closed → CAU 隐藏 |
| 预览 | `GET /api/write/works/{id}/preview` → 用与 CAU `/api/content/{id}` 相同的渲染逻辑，但无视 status 限制 |
| 角色跨侧复用 | entities 表同一行 → CAU work.html 展示角色 → Story Forger 角色编辑页修改同一行 |
| 标签共享 | works.tags 同一字段 → Story Forger 写标签 → CAU 按标签筛选浏览 |

---

## 六、状态统计

| 状态 | 数量 |
|------|------|
| ✅ done | 39 |
| ⏳ 待实现 | 2 |
| ❌ 已移除 | 1 |
| 🔴 阻塞 | 0 |

**总计**：42 项需求（39 已实现 + 2 待实现 + 1 已移除）。待实现：SF-056（Read 侧 AI 伴读后端）、SF-063（写作引导流程）。已移除：SF-024（冲突地图）。

### 实现清单

| 模块 | 需求 ID | 状态 |
|------|--------|------|
| 工作区管理 | SF-001~005 | ✅ |
| 原始构想 M0 | SF-006~007 | ✅ |
| Story Elf | SF-053~055 | ✅ 组件已部署；SF-056 ⏳ Read 侧 AI 后端待实现 |
| 世界观引擎 | SF-010~018 | ✅ 全部实现 |
| 大纲引擎 | SF-020~022 | ✅（SF-025 合并入 SF-022）+ SF-017 长篇框架模板 |
| 伏笔账本 | SF-023 | ✅ 规划导向模板（Markdown）+ 正向校验 |
| 章节生产流水线 | SF-030~035 | ✅（含章节重写）|
| 营销辅助 | SF-040~042 | ✅ 金句提炼 + 标题生成 + 分发改写 |
| MCP Write | SF-050~052 | ✅ Resources + Tools + 共底 |
| 写作桌 UI | SF-060~063 | ❌ SF-060（已合并）, ✅ SF-061~062, ⏳ SF-063 |
