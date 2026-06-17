# Cyber Art Universe — 架构总览

> 本文档是 CAU 项目的跨模块总览。说明三大模块（CAU / Story Forger / Story Elf）的定位、关系、数据流和关键交叉点。
> 阅读或修改任何模块文档前，建议先浏览本文档以理解全貌。

---

## 文档地图

```
docs/
├── ARCHITECTURE.md              ← 你在这里
│
├── general/                     # 跨模块通用文档
│   ├── business_concept.md      # 商业概念：产品愿景、用户价值、商业模式
│   ├── market_analysis.md       # 市场分析：竞品调研、市场机会
│   ├── system_design.md         # 全局系统设计：整体架构、技术选型
│   ├── L1_Category.md           # 一级分类设计：内容分类体系
│   ├── pricing.md               # 定价策略
│   ├── User-account-and-social-system-original-concept.md  # V4.5 原始构想：共生共和国（冻结）
│   └── user_account_system_design.md  # 用户账户系统设计：五阶段路线图 + Phase 0/1 详细设计
│
├── cau/                         # CAU 阅读端
│   └── original_concept.md      # 原始构想：项目的起源和愿景
│       （SRS/SDS/STR 已并入代码注释 → src/api/*.ts 头部 JSDoc）
│
├── story_forger/                # Story Forger 写作工具
│   ├── original_concept.md      # 原始构想：写作引擎的起源
│   ├── system_design.md         # 系统设计：模板系统、Pipeline、约束体系
│   ├── milestone_review_0520.md # 里程碑审查：2026-05-20 评审报告
│   │   （SRS/SDS/STR 已并入代码注释 → src/api/write/*.ts + src/pages/write.js 头部 JSDoc）
│
└── story_elf/                   # Story Elf AI 辅助层
    ├── original_concept.md  # 原始探讨：模板分级引导设计对话，L2 Agent 架构：session/memory/tool/prompt 层，L two Agent Memory架构。
    ├── system_design.md         # 系统设计：分级系统、多语言、自由编辑互动
    └── cloudflare_ai_gateway_guide.md  # AI Gateway 部署指南
        （SRS 已并入代码注释 → src/lib/l0/aiGateway.ts + src/lib/l1/context-package.ts + src/lib/telemetry.ts 头部 JSDoc）
```

---

## 三大模块总览

```
┌──────────────────────────────────────────────────────────┐
│                   Cyber Art Universe                      │
│                                                           │
│  ┌─────────────┐  ┌───────────────┐  ┌───────────────┐  │
│  │    CAU      │  │ Story Forger  │  │  Story Elf    │  │
│  │   阅读端    │  │   写作工具    │  │   AI 辅助层   │  │
│  │             │  │               │  │               │  │
│  │  - 目录浏览 │  │ - M0 原始构想 │  │ - 智能提示    │  │
│  │  - 作品详情 │  │ - M1 世界观   │  │ - 对话引导    │  │
│  │  - 章节阅读 │  │ - M2 大纲     │  │ - 内容提取    │  │
│  │  - 评论系统 │  │ - M3 人物卡   │  │ - 阅读陪伴    │  │
│  │  - 搜索发现 │  │ - M4 伏笔卡   │  │ - Level 引导  │  │
│  │             │  │ - M5 意图卡   │  │               │  │
│  │             │  │ - M6 章节写作 │  │               │  │
│  │  面向读者   │  │   面向作者    │  │  跨两端服务   │  │
│  └──────┬──────┘  └──────┬───────┘  └──────┬────────┘  │
│         │                │                  │            │
│         └────────────────┼──────────────────┘            │
│                          │                                │
│              D1 (元数据) + R2 (内容)                     │
└──────────────────────────────────────────────────────────┘
```

| 维度 | CAU | Story Forger | Story Elf |
|------|-----|-------------|-----------|
| **核心职责** | 内容的呈现、浏览和消费 | 写作模板、数据结构、创作工具链 | AI 辅助、智能引导、创作陪伴 |
| **服务对象** | 读者 | 作者 | 作者 + 读者（跨两端） |
| **API 前缀** | `/api/content/`、`/api/works/` | `/api/write/` | `/api/elf/`（规划中） |
| **前端页面** | `index.html`、`read.html`、`work.html` | `write.html` | `story-elf.js`（浮动组件，跨页面） |
| **代码目录** | `src/api/`（主路由） | `src/api/write/` | `src/api/elf/`（待建） |
| **文档目录** | `docs/cau/` | `docs/story_forger/` | `docs/story_elf/` |

### 模块间通信

- **CAU ← Story Forger**：发布/下架/预览操作通过 `works.status` 字段控制 CAU 侧可见性。Story Forger 写入的内容（章节、人物、伏笔）在 CAU 侧通过 `/api/content/` 端点读取呈现。
- **Story Elf → Story Forger**：Elf 调用 Story Forger 的 API 获取模板和内容，然后生成提示、建议、提取结构化信息。Elf 不替代 Story Forger 的功能——它是在 Story Forger 之上叠加的智能层。
- **Story Elf → CAU**：阅读陪伴模式下，Elf 通过 CAU 的内容 API 获取作品信息，给读者提供背景、分析和其他辅助。

---

## 跨模块交叉点

### 1. 数据层共享

所有三个模块共享 D1（元数据）和 R2（内容文件），主要交叉：

| 资源 | CAU 使用 | Story Forger 使用 | Story Elf 使用 |
|------|---------|------------------|---------------|
| `works` 表 | 目录展示、搜索、筛选 | 工作区管理、状态流转 | 读取作品信息 |
| `sections` 表 | 章节阅读、目录 | 章节管理、流水线 | 读取章节上下文 |
| `entities` 表 | 角色/伏笔展示 | M3 人物卡 + M4 伏笔卡 CRUD | 读取实体信息 |
| R2 `works/{id}/{lang}/*.md` | 阅读渲染 | 槽位编辑器读写 | AI 上下文收集 |

### 2. 发布流程

```
作者在 Story Forger 点击"发布"
  → PATCH /api/write/works/{id}/publish
    → works.status = 'published'
      → CAU 目录首页 / 分类页 立即出现该作品
```

下架流程对称：`close` → `status = 'closed'` → CAU 隐藏。

### 3. Story Elf 的跨端角色

Story Elf 是唯一同时服务于 CAU 和 Story Forger 的模块：

- **Write 侧**：帮助作者理解模板、填充槽位、提取结构化信息、建议升级 level
- **Read 侧**（规划中）：陪伴读者阅读，提供背景知识、伏笔追踪、角色关系分析
- **组件层面**：`story-elf.js` 是一个自包含浮动组件，通过 `window.StoryElf` API 暴露接口，在 Read/Write 页面间保持位置和状态

### 4. 模板 Level 系统

模板分级引导（SF-068）是 Story Elf 的核心设计前提：

- **定义层**：每个模板槽位在 `SlotDef` 中声明 `level: 1 | 2`
- **渲染层**：`renderTemplate()` 生成带 `<!-- hint:L{n}:... -->` 标记的 markdown
- **前端过滤层**：`write.js` 按用户 `_currentLevel` 显示/隐藏 L2 槽位（CSS `slot-hidden`）
- **AI 层**：AI 始终读取完整模板（level=2 渲染），不受前端过滤影响

---

## 文档阅读路径

### 想了解项目全貌
`ARCHITECTURE.md` → `general/business_concept.md` → `general/system_design.md`

### 想了解用户账户与社交系统
`general/User-account-and-social-system-original-concept.md`（V4.5 愿景） → `general/user_account_system_design.md`（五阶段路线图与详细设计）

### 想开发 CAU 阅读端
`cau/original_concept.md`（SRS 需求 ID 见 `src/api/index.ts` + `src/api/works.ts` 等文件头部注释）

### 想开发 Story Forger 写作端
`story_forger/original_concept.md` → `story_forger/system_design.md`（SRS 需求 ID 见 `src/api/write/index.ts` 头部注释 + 各模块文件头部 JSDoc）

### 想开发 Story Elf AI 辅助
`story_elf/original_concept_smart_guide_story_elf.md` → `story_elf/system_design.md` → `story_elf/L2_agent_design.md`（SRS 需求 ID 见 `src/lib/l0/aiGateway.ts` / `src/lib/l1/context-package.ts` / `src/lib/telemetry.ts` 头部注释）

### 想做代码审查或测试
直接阅读对应模块的 `.ts` 源代码文件——功能需求 ID 已标注在函数/文件头部的 JSDoc 注释中。测试用例见 `tests/` 目录。

---

## 文档规范

### 命名约定

| 文档类型 | 文件名 | 说明 |
|---------|--------|------|
| 原始构想 | `original_concept*.md` | 项目/模块的起源和愿景，一旦定稿原则上不修改 |
| 系统设计 | `system_design.md` | 该模块的技术架构和设计决策 |
| 功能需求/实现/审核 | 已并入代码 | SRS/SDS/STR 内容已逐条迁移到对应 `.ts` 文件的 JSDoc 头部注释中（2026-06-04） |

### 关联文档节

每个文档应在头部包含 `## 文档说明` 节，其中有一行 `**关联文档**`，用 `→` 箭头连接推荐阅读顺序。所有链接使用相对路径。示例：

```markdown
- **关联文档**：[架构总览](../ARCHITECTURE.md) → system_design 文档（功能需求已并入代码文件头部注释，直接阅读对应 `.ts` 源文件即可）
```

### 跨模块修改检查清单

修改以下内容时，请检查关联模块是否需要同步：

| 修改内容 | 需检查的关联模块 |
|---------|----------------|
| `works` 表结构 | CAU + Story Forger |
| `modules` 表结构（v3.0 新增，统一管理 M0-M8） | Story Forger + Story Elf |
| `entities` 表结构 | CAU + Story Forger + Story Elf |
| `users` 表结构 | CAU + Story Forger + Story Elf（用户系统是跨模块基础设施） |
| `reviews` 表结构 | CAU + Story Forger |
| 模板结构（SlotDef） | Story Forger + Story Elf |
| API 路径 | Story Forger + Story Elf + 前端 |
| 统一 Module API（`/api/write/module/{id}` 等，v3.0） | Story Forger + Story Elf + 前端 |
| R2 路径结构 | 全部三个模块 |
| `story-elf.js` 组件 | CAU + Story Forger（跨页面） |
