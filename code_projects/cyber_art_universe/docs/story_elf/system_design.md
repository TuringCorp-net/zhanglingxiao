# Story Elf 系统设计

> 版本: v0.4.0 | 状态: 草案 | 最后更新: 2026-05-26
> **关联文档**：[架构总览](../ARCHITECTURE.md) → [SRS](SRS.md) → 本文档 → [Story Elf 前端设计](frontend_design.md) → [AI Gateway 指南](cloudflare_ai_gateway_guide.md) → [模板分级探讨](original_concept_smart_guide_story_elf.md)

---

## 1. 概述

### 1.1 Story Elf 的定位

Story Elf 是 Cyber Art Universe (CAU) 的 **第三大独立模块**，与 CAU（内容呈现）、Story Forger（写作工具）并列。

| 模块 | 核心职责 | 服务对象 |
|------|---------|---------|
| **CAU** | 内容的呈现、浏览和消费 | 读者 |
| **Story Forger** | 写作模板、数据结构、创作工具链 | 作者 |
| **Story Elf** | AI 辅助、智能引导、创作陪伴 | 作者 + 读者（跨两端） |

Story Elf 跨了 CAU 和 Story Forger，它的职责不是"写作"也不是"展示"，而是 **"理解和辅助"**——理解作者在写什么、理解读者在读什么，然后提供有意义的辅助。

### 1.2 核心设计原则

1. **Elf 是向导，不是替代者**。AI 的建议是"建议"，人类始终拥有最终决策权。
2. **后台完整，前台渐进**。AI 始终能看到完整模板，人类根据 level 逐步解锁。
3. **自由写作优先于结构化填写**。人类应该先"吐出来"，再由 AI 帮助结构化。
4. **陪伴跨场景**。同一套 AI 能力同时服务于写作桌（write）和阅读页（read）。

---

## 2. 模板分级渐进引导系统

### 2.1 问题定义

Story Forger 的模板系统（M0-M6）虽然强大完整，但对新手作者形成了过高的认知负荷。一个普通作者进入写作桌，看到几十个需要填写的槽位，创作冲动瞬间被"填空题"的焦虑取代。

### 2.2 分层方案

模板的每个槽位（slot）赋予一个 level 属性，前端根据用户当前 level 决定是否展示该槽位。

| Level | 含义 | 范围 | 触发条件 |
|-------|------|------|---------|
| **L0** | 自由写作区 | 每个模块的自由编辑区域 | 始终可见，不可隐藏 |
| **L1** | 核心槽位 | 每个模块最关键的 1-3 个槽位，无理解难度 | 新作品默认 |
| **L2** | 完整模板 | 所有槽位 | 手动解锁，或 Story Elf 智能提示后解锁 |

> 设计决策：初始只设 3 级。跑顺后再根据用户反馈决定是否需要更细的分层（L3+）。

### 2.3 Level 的存储方式

Level 信息定义在 `SlotDef` TypeScript 常量中，是模板 JSON 结构的一部分：

```typescript
interface SlotDef {
  id: string;                    // 槽位唯一标识
  level: 1 | 2;                  // L1 核心 / L2 完整
  label: Record<Lang, string>;   // 槽位标签
  hint: Record<Lang, string>;    // 提示文字
}
```

API 返回 `{ template: { slots: { slotId: { level, label, hint, value } } } }`，前端渲染时根据 `currentUserLevel` 过滤：

```
if (slotLevel > currentUserLevel) → 跳过渲染
```

**选择理由**：
- 单一事实来源：`SlotDef.level` 是唯一维护点，改模板即改 level，不会不同步
- 无额外依赖：不需要 manifest 文件、编译步骤
- 前端直接消费 JSON：不再从 Markdown 注释中正则提取 level 信息

**历史说明**（v0.3.x）：旧版系统将 level 嵌入 Markdown `<!-- hint:L1:zh:... -->` 标记中，前端通过 `parseSlotTemplate` 正则解析提取。v0.4.0 改为 JSON 直接消费后，level 字段随 `SlotDef` 自然携带。

### 2.4 可见性规则

| 观察者 | 看到的模板 |
|--------|-----------|
| 人类作者 (L1) | 仅 L0 + L1 槽位 |
| 人类作者 (L2) | 全部槽位 |
| Story Elf / AI Agent | 始终完整模板（不经过前端过滤） |
| 外部 MCP / API 调用 | 始终完整模板 |

关键：**level 过滤只发生在人类作者的前端渲染层**。后端存储和 AI 访问始终使用完整模板。

### 2.5 用户 Level 设置

- **粒度**：每个作品独立设置（作品 A 可以 L1，作品 B 可以 L2）
- **默认值**：新作品默认 L1
- **存储**：作品级配置字段，存在 R2 `works/{work_id}/config.json` 或 D1 works 表
- **切换方式**：前端提供入口（手动解锁），Story Elf 也可在检测到合适时机时主动建议升级

---

## 3. 多语言架构

### 3.1 现状

- R2 内容按语言分目录存储：`works/{work_id}/{lang}/...`
- 模板定义在 TS 代码中为两套独立常量（`_ZH` / `_EN`）
- 当前支持 zh、en 两种语言

### 3.2 改进方案（已实现）

**R2 存储路径**：`works/{work_id}/{lang}/...` 的分语言目录结构保持不变。增加 `.json` 文件作为结构化数据存储，与 `.md` clean Markdown 文件配对。

**模板定义统一化**（v2.4 实现，v2.5 扩展）：模板定义为一套结构化 `SlotDef[]` / `TemplateDef` 常量，每个槽位自带多语言 label 和 hint。v2.5 中模板 JSON 直接通过 API 返回给前端消费：

```typescript
interface SlotDef {
  id: string;                    // 槽位唯一标识
  level: 1 | 2;                  // 所属分级
  label: Record<Lang, string>;   // 多语言标签
  hint: Record<Lang, string>;    // 多语言提示（Story Elf 对话泡数据来源）
}
```

**API 响应格式**（v2.5 新增）：

```typescript
// GET /api/write/{module}/{work_id}?lang=zh
{
  template: {
    sections: [{ heading: "一、世界规则与边界", slotIds: ["world_power_system", "world_taboos"] }],
    slots: {
      "world_power_system": { level: 1, label: "力量/技术体系", hint: "描述这个世界的力量来源...", value: "..." },
      "world_taboos": { level: 1, label: "禁忌与代价", hint: "世界中不可触碰的禁忌...", value: "" }
    }
  },
  rendered_md: "# 世界观设定圣经\n\n> 本文件是作品的最高约束文档..."
}
```

未来添加新语言（如 ja、ko）时，只需在 `label`/`hint` 对象中增加对应翻译字段，无需复制整套模板。

### 3.3 模板渲染与数据流（v2.5 JSON 化）

**服务端渲染**（`renderTemplate` / `renderTemplateAsJson`）：

```
TemplateDef / SlotDef[]
  ├─ renderTemplateAsJson(tmpl, lang) → JSON schema 发送给 LLM
  │    LLM 输出 {"slots":{...}} JSON
  │    → extractTemplateJson() 校验
  │    → renderTemplate(tmpl, lang, prefills, cleanOutput:true) → clean .md
  │    → R2 双文件存储（.json + .md）
  │
  └─ GET API → renderTemplate(tmpl, lang, prefills) 
       → 返回 { template: { sections, slots }, rendered_md }
```

**前端消费**：

```
API Response { template, rendered_md }
  → 按当前 userLevel 过滤 template.slots（跳过 level > currentUserLevel 的槽位）
  → 遍历 template.sections 渲染框架（heading + slot textareas）
  → 每个 slot textarea 携带 data-hint（来自 SlotDef.hint）、data-level
  → 保存时收集 slots 值 → PUT JSON → 服务端重渲染 .md
```

与 v2.4 的关键区别：前端不再通过正则解析 Markdown 提取槽位信息，而是直接遍历 JSON 的 `sections` / `slots` 结构渲染 UI。

---

## 4. 自由编辑区与模板的互动

### 4.1 核心思路

自由编辑区（L0）不再仅仅是"模板之外的备忘区"，而是 **模板槽位的输入前导**。

```
人类 → 自由写作（低负担，随意表达）
         ↓
  Story Elf + AI（提取结构、映射到槽位）
         ↓
  模板槽位（AI 直接填入，无需人类逐条确认）
         ↓
  人类不满意 → 回到自由编辑区修改 → AI 重新提取更新
```

**设计原则**：AI 填入的内容直接写入槽位，不需要人类逐条确认。人类如果想调整，在自由编辑区修改后让 AI 重新提取即可。未来引入 diff 视图来展示 AI 修改前后的变化。

### 4.2 数据流

```
自由编辑区内容（Markdown）
  → POST /api/elf/extract
    → LLM 分析自由文本 + 当前模块完整模板定义（TemplateDef，含所有 level 的 SlotDef）
      → 返回 { slots: { slotId: "AI 提取的内容", ... } } JSON
        → 写入对应槽位（更新 R2 .json → 服务端重渲染 .md）
```

### 4.3 交互约束

- AI 只对 **当前 level 可见的槽位** 生成建议（不暴露更高 level 的槽位给人类）
- 当用户升级 level 后，AI 可针对新解锁的槽位重新生成建议
- 自由写作区的内容是 AI 提取的输入源，AI 也可结合该模块已有的已填槽位作为上下文
- 人类修改自由编辑区后，可触发 AI 重新提取更新槽位

---

## 5. 系统架构

### 5.1 三大模块关系

```
┌─────────────────────────────────────────────────┐
│                  Cyber Art Universe              │
│                                                   │
│  ┌──────────┐  ┌──────────────┐  ┌────────────┐ │
│  │   CAU    │  │ Story Forger │  │ Story Elf   │ │
│  │  阅读端  │  │   写作工具   │  │  AI 辅助层  │ │
│  │          │  │              │  │             │ │
│  │ 目录浏览 │  │ M0-M6 模板   │  │ 智能提示    │ │
│  │ 作品详情 │  │ Pipeline     │  │ 对话引导    │ │
│  │ 章节阅读 │  │ 槽位编辑器   │  │ 内容提取    │ │
│  │ 评论系统 │  │ 约束管理     │  │ 阅读陪伴    │ │
│  │          │  │              │  │             │ │
│  │ 面向读者 │  │ 面向作者     │  │ 跨两端服务  │ │
│  └──────────┘  └──────────────┘  └────────────┘ │
│        │               │               │          │
│        └───────────────┴───────────────┘          │
│                        │                           │
│               D1(元数据) + R2(内容)               │
└─────────────────────────────────────────────────┘
```

### 5.2 目录结构

```
src/
├── api/
│   ├── index.ts              # 主路由（CAU 侧 + 公共）
│   ├── write/                # Story Forger 模块
│   │   ├── index.ts          # Write 子路由
│   │   ├── workspace.ts
│   │   ├── original_concept.ts   # M0
│   │   ├── worldbuilding.ts      # M1
│   │   ├── outline.ts            # M2
│   │   ├── entities.ts           # M3 + M4
│   │   ├── foreshadowing.ts      # M4
│   │   ├── draft.ts              # M5 + M6
│   │   └── marketing.ts
│   └── elf/                  # Story Elf 模块（独立）
│       ├── index.ts          # /api/elf/... 路由
│       ├── chat.ts           # AI 对话
│       ├── hints.ts          # 智能提示系统（静态 + 动态）
│       └── extract.ts        # 从自由写作提取结构化信息
├── lib/
│   ├── ai.ts                 # AI Provider 抽象（OpenAI / Anthropic）
│   ├── work_content.ts       # R2 读写 + 多语言路径
│   ├── constants.ts
│   ├── errors.ts
│   └── response.ts
├── pages/                    # 前端
│   ├── write.html            # 写作桌
│   ├── write.js              # 写作桌主逻辑
│   ├── write-api.js          # HTTP 通信层
│   ├── story-elf.js          # Story Elf 浮动组件
│   └── i18n-data.js          # 全站双语数据
└── db/
    └── schema.ts             # D1 表结构
```

### 5.3 Story Elf API 设计（概要）

| 端点 | 方法 | 说明 |
|------|------|------|
| `/api/elf/chat` | POST | AI 对话（流式/非流式） |
| `/api/elf/hints/{module}` | GET | 获取模块的静态 + 动态提示 |
| `/api/elf/hints/{module}` | POST | Story Elf 内部写入动态提示 |
| `/api/elf/extract` | POST | 从自由文本提取结构化槽位建议 |
| `/api/elf/suggest-level` | POST | 根据完成度建议是否升级 level |

### 5.4 Story Forger 中的 AI 生成端点

现有的 `POST .../generate` 类端点保留在 `write/` 下，它们是 **Story Forger 的写作工具功能**，内部调用 `lib/ai.ts` 完成 LLM 调用，但不属于 Story Elf 的"引导和陪伴"职责。

区分标准：
- **Story Forger 调用 AI** → "帮我生成一章大纲"（工具功能）
- **Story Elf 调用 AI** → "你卡在这里了，要不要试试从另一个角度想？"（引导陪伴）

---

## 6. Level 系统的实现路径

### 6.1 第一阶段：模板定义改造

1. 定义 `SlotDefinition` 接口（id, level, labels, hints）
2. 将现有 M1-M4 的模板常量从"纯 markdown 字符串"改为 `SlotDefinition[]` + 渲染函数
3. 渲染函数输入 `(slots, lang, userLevel)` → 输出过滤后的 markdown

### 6.2 第二阶段：槽位解析 + 前端过滤（v2.4 实现，v2.5 改为 JSON）

v2.4 中通过 `parseSlotTemplate()` 从 Markdown `<!-- -->` 标记提取槽位信息。v2.5 改为直接消费 API 返回的 JSON 结构：

1. API 返回 `template.slots` 携带每个槽位的 `level`、`label`、`hint`
2. `renderSlotEditor()` 接收 `template` JSON，跳过 `level > currentUserLevel` 的槽位
3. 前端 level 显示和切换入口保持不变

### 6.3 第三阶段：Story Elf 引导

1. 固定提示（hints）支持 level 标签，不同 level 显示不同提示词
2. Story Elf 可检测完成度并建议升级
3. 实现自由写作区 → 槽位提取（extract API）

---

## 7. 设计决策记录

| 决策 | 选择 | 理由 |
|------|------|------|
| Level 存储 | SlotDef.level 字段（JSON 直接携带） | 单一事实来源，前端直接读取 JSON，无需 Markdown 正则解析。v2.4 旧方案为嵌入 `<!-- hint:L1:... -->` 注释 |
| 初始层级数 | 3 级 (L0/L1/L2) | 够用，跑顺再考虑细分 |
| 多语言存储 | 保持 R2 分目录 | 不同语言是独立内容，分目录合理 |
| 模板定义 | 统一结构化 SlotDef[] | 加语言只需加翻译字段。v2.5 通过 API 返回 JSON 给前端直接消费 |
| 用户 Level | 每作品独立 | 不同作品有不同复杂度需求 |
| 默认 Level | L1 | 展示核心引导价值，L0 太"空" |
| Level 过滤位置 | 前端渲染层 | AI 和后端始终访问完整模板 |
| AI 建议写入 | AI 直接填入槽位，无需确认 | 减少交互摩擦，人类不满意可在自由编辑区修改后让 AI 重新提取 |
| Story Elf 独立 | 是 | 跨 CAU 和 Story Forger 两端 |

---

## 8. 待讨论事项

- [ ] Level 升级的触发条件：手动为主 or 自动检测？具体检测规则？
- [ ] Story Elf 在 CAU 阅读侧的陪伴功能具体形态
- [ ] 多语言模板的结构化定义从哪些模块开始迁移

---

## 9. AI 大模型调用架构

### 9.1 设计目标

Story Elf 的 AI 能力基于两层架构：

- **Layer 1（AI Gateway 客户端）**：通过 Cloudflare AI Gateway 统一调用大模型，隐藏真实 API key，支持多模型切换。
- **Layer 2（Agent 层）**：在裸大模型之上叠加工作流编排、上下文组装、系统指令和用户记忆，使 Story Elf 成为一个有"人格"的创作伙伴。

```
┌─────────────────────────────────────────────────────────────┐
│                    Layer 2: Agent 层                          │
│                    lib/agent/                                 │
│                                                               │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐   │
│  │ instructions │  │   context    │  │     memory       │   │
│  │ System Prompt│  │ 上下文组装    │  │ 对话历史/偏好     │   │
│  │ 按角色/模块   │  │ R2 + DB 拉取 │  │ 持久化存储        │   │
│  └──────────────┘  └──────────────┘  └──────────────────┘   │
│                                                               │
│  调用方：elf_chat.ts（Story Elf 对话）                         │
│         hints.ts（动态提示生成）                               │
└──────────────────────────┬──────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────┐
│                 Layer 1: AI Gateway 客户端                    │
│                    lib/ai.ts                                  │
│                                                               │
│  callAI(env, messages, options) → { content, usage }         │
│                                                               │
│  - Cloudflare AI Gateway 统一入口（BYOK）                     │
│  - 默认模型 deepseek-v4-flash（1M 上下文窗口）                │
│  - 支持 system/user/assistant 多轮消息格式                    │
│  - 内置指数退避重试 + AbortController 超时                    │
│  - JSON 结构化输出支持                                        │
└──────────────────────────┬──────────────────────────────────┘
                           │ cf-aig-authorization: Bearer $CF_AIG_TOKEN
                           ▼
┌─────────────────────────────────────────────────────────────┐
│              Cloudflare AI Gateway (BYOK)                     │
│  gateway.ai.cloudflare.com/v1/{account}/{gateway}/...        │
│                                                               │
│  deepseek-v4-flash (默认)  |  gpt-4o  |  claude  |  ...      │
│  真实 API key 在 CF Dashboard 配置，Worker 不接触             │
└─────────────────────────────────────────────────────────────┘
```

### 9.2 文件结构

```
src/lib/
├── ai.ts              → AI Gateway 客户端（Layer 1）
├── agent/
│   ├── types.ts       → Agent 类型定义
│   ├── context.ts     → 上下文组装器（从 R2/DB 拉取作品上下文）
│   ├── instructions.ts→ System prompt 模板（按角色/模块）
│   └── memory.ts      → 对话记忆存取
└── (现有文件不动)
```

### 9.3 Layer 1：AI Gateway 客户端（lib/ai.ts）

**唯一对外接口**：

```typescript
interface Message {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface AICallOptions {
  model?: string;           // 默认 'deepseek-v4-flash'
  maxTokens?: number;       // 默认 1024
  temperature?: number;     // 默认 0.7
  timeout?: number;         // 默认 30000ms
  retries?: number;         // 默认 2（共 3 次尝试）
  responseFormat?: 'text' | 'json';
}

interface AICallResult {
  content: string;
  model: string;
  usage?: { input: number; output: number };
}

function callAI(env: Env, messages: Message[], options?: AICallOptions): Promise<AICallResult>
```

**关键设计决策**：

| 决策 | 选择 | 理由 |
|------|------|------|
| 认证方式 | `cf-aig-authorization` header + `CF_AIG_TOKEN` Secret | AI Gateway 统一认证，Worker 不接触真实模型 API key |
| 默认模型 | deepseek-v4-flash | 1M 上下文窗口，成本低，适合长篇创作场景 |
| 端点格式 | `/v1/{account}/{gateway}/{provider}/chat/completions` | OpenAI 兼容格式，多 provider 通用 |
| 重试策略 | 指数退避（500ms → 1000ms → 2000ms） | 处理网关临时故障和模型限流 |
| 超时 | AbortController 30s 默认 | 避免 Worker 长时间挂起 |

#### 9.3.1 消息三角色分离

对 LLM 的每次调用传递三种角色的消息，各自有明确的语义：

| 角色 | 语义 | 用途 | 缓存行为 |
|------|------|------|---------|
| `system` | **指令/宪法** — 模型的最高行为准则 | 角色定义、作品上下文、回复格式要求 | 固定前缀，多次请求共享，**可被硬盘缓存命中** |
| `user` | **提问/输入** — 用户的具体请求 | 用户的消息、多轮对话中新的提问 | 每轮不同，不可缓存 |
| `assistant` | **模型回复** — 历史对话中的模型输出 | 多轮对话的历史回复（前端传回） | 对话历史的一部分 |

**消息顺序规范**：

```
[system]  ← 始终在最前面（固定前缀，最大化缓存命中）
[user]    ← 第一轮提问
[assistant] ← 模型第一轮回复
[user]    ← 第二轮提问
[assistant] ← 模型第二轮回复
...       ← 交替延续
```

**反模式（禁止）**：将所有消息拼成一段文本，塞入单条 user message：

```
❌ [{ role: "user", content: "【系统指令】...\n【用户】...\n【Story Elf】..." }]
```

这会导致三个问题：
1. **语义混淆**：模型分不清指令和对话，system prompt 的约束力被稀释
2. **缓存失效**：DeepSeek 缓存基于完整前缀匹配。system prompt 被包在 user message 里，且 user message 每轮变化 → 每次都是全新的前缀 → 缓存命中率为 0
3. **多轮对话结构破坏**：模型看不到 alternating user/assistant 结构，无法正确理解对话历史

#### 9.3.2 DeepSeek 上下文硬盘缓存

DeepSeek 默认对所有请求启用硬盘缓存。缓存机制：

| 机制 | 说明 |
|------|------|
| **落盘条件** | 请求结束位置（输入结束 + 输出结束）自动落盘；公共前缀检测落盘；固定 token 间隔落盘 |
| **命中条件** | 后续请求的 messages 数组**完整匹配**已落盘的缓存前缀单元 |
| **缓存时效** | 几小时到几天，不使用自动清空 |

**我们的优化策略**：

```
请求 1：
  [system: Story Elf 角色指令 + 作品《星港沉默》的上下文]  ← 固定
  [user: 帮我分析一下主角的性格]                              ← 变化

请求 2：
  [system: Story Elf 角色指令 + 作品《星港沉默》的上下文]  ← 与请求 1 完全相同 → 缓存命中！
  [assistant: 主角性格分析结果...]                             ← 请求 1 的回复
  [user: 那他的成长弧线是怎样的？]                              ← 新提问

请求 3：
  [system: Story Elf 角色指令 + 作品《星港沉默》的上下文]  ← 与请求 1/2 完全相同 → 缓存命中！
  [assistant: ...]
  [user: ...]
  ...
```

因为 `system` 消息在同一作品 + 同一角色的多次对话中保持不变，它作为 messages 数组的**固定前缀**，会在第一次请求后落盘。之后所有请求都会命中这个缓存，大幅降低延迟和 token 成本。

**关键约束**：
- system 消息必须始终放在 `messages[0]` 位置
- 同一作品 + 同一语言的 system prompt 内容必须完全相同，不能有动态可变部分（如时间戳）
- 对话历史（user/assistant）追加在 system 后面，不影响前缀缓存命中

#### 9.3.3 调用方消息构建规范

| 调用场景 | 消息结构 | 说明 |
|---------|---------|------|
| **Story Elf 对话**（elf_chat.ts） | `[system, ...user/assistant历史]` | system 包含角色 + 作品上下文。后续前端传回对话历史（user/assistant 交替） |
| **工具类生成**（draft / outline 等）* | `[{role:'user', content: taskPrompt}]` | 一次性任务指令。未来迁移到 `[system, user]` 以分离指令和任务 |
| **动态提示生成**（hints.ts） | `[system, user]` | system 定义输出格式，user 描述模块和需求 |

> *工具类端点当前使用 `generateWithAI()` 兼容包装，单一 user message。此用法对一次性任务可接受，但未来应迁移到 `[system, user]` 以分离系统指令和任务描述，同时受益于缓存。

#### 9.3.4 缓存稳定性规则

为了最大化 DeepSeek 硬盘缓存命中率，system message 必须遵循**严格确定性**原则。参考 deepseek-reasonix 的 `ImmutablePrefix` 设计模式。

**核心规则**：

| 规则 | 说明 | 反例 |
|------|------|------|
| **禁止时间戳** | system prompt 绝不包含 `new Date()`、`Date.now()` 等 | `现在时间是 {{current_time}}` |
| **禁止随机值** | 绝不包含 UUID、随机 ID | `会话 ID: {{random_uuid}}` |
| **禁止动态上下文** | 模块名、章节标题等随用户操作变化的字段**不放在 system 层** | `当前模块: {{module}}` |
| **只放 session 级不变量** | 作品基本信息、世界观、大纲、角色——这些在同一次写作会话中不变 | `作品：《{{work_title}}》` |

**三层消息模型**（借鉴 deepseek-reasonix）：

```
┌─ system message（ImmutablePrefix）─────────────────────┐
│  M0-M5 写作上下文包 + 角色 persona                       │
│  同作品 + 同语言 = 完全固定 → 100% 缓存命中               │
├─ user/assistant messages（AppendOnlyLog）───────────────┤
│  对话历史 + 动态前缀（如 "[当前模块: 世界观]"）             │
│  只追加不修改 → 前缀部分缓存命中，尾部新增部分 miss         │
└────────────────────────────────────────────────────────┘
```

**实施方式**：

- 动态变量（`module`、`section_title`）从 `system.md` 模板中移除
- 在 `elf_chat.ts` 构建消息时，将它们注入**第一条 user message 的前缀**（而非 system message）
- 例如：`[当前模块: 世界观]\n\n帮我分析一下主角的性格`

**效果**：同一作品的多次对话，无论用户在哪个模块间跳转，system message 的字节前缀完全一致 → 缓存命中率接近 100%。

### 9.4 Layer 2：Agent 层

Agent 层当前由 L1 的 `context-package` + `instructions` + `prompts/` 组成。未来 Phase 3/4 将扩展为独立的 `lib/agent/` 目录。

**核心设计决策：统一 Prompt，而非场景化 Prompt**

经过对 Story Elf 对话模式的系统性推演，我们决定 **Write 侧只使用一套 system prompt**（`writer_companion/system.md`），不在 L1 层做任务级场景区分。理由：

| 方案 | 场景化 Prompt（7 套） | 统一 Prompt（1 套） |
|------|---------------------|-------------------|
| prompt 文件数 | 7 个，需维护 | 1 个 |
| 作者跳模块时 | 需切换 system prompt → 缓存失效 | system prompt 不变 → 缓存命中 |
| 开放式询问 | 场景 prompt 可能限制 AI 提议范围 | AI 根据完整上下文包自由建议，模糊时主动确认 |
| 任务约束 | 靠 prompt 文字约束（不可靠） | 靠 L2 工作流约束（可靠、可控） |

**设计逻辑**：

上下文包已经包含了 M0-M5 的全部信息——AI 天然知道作品的结构、角色、伏笔、章节。它唯一需要的是一个清晰的 persona（行为边界），而不是 7 个不同的"任务说明书"。任务说明书放在哪里？放在 user message 里、放在 L2 工作流里。

**统一 prompt 的 4 条核心规则**（写入 `writer_companion/system.md`）：

1. **可修改范围**：M1-M6 均可建议，M0 仅供理解意图
2. **模糊时确认**：作者要求不具体时，先提 2-3 个方向让作者选择
3. **遵循模板格式**：修改建议应遵循上下文包中的模块模板结构
4. **修改前说明意图**：先一句话说明改什么、为什么，再给出具体内容

这 4 条规则让 AI 在任何模块、任何对话场景下都能得体地辅助作者——不管是"帮我写第 4 章"这样的闭合指令，还是"接下来怎么办"这样的开放询问。

**L1 vs L2 的分工**：

| | L1（当前） | L2（Phase 3+） |
|------|------|------|
| 做什么 | 提供 persona + 上下文 | 约束任务范围 |
| 怎么写 | 遵循模板格式（指南性） | 强制输出格式 + 校验 |
| 写到哪 | 对话中建议 | 自动写入指定 R2 路径 |
| 怎么实现 | system prompt 中的自然语言 | 工作流编排 + API 调用 |

**当前四模块**：

| 模块 | 文件 | 职责 | 输入 | 输出 |
|------|------|------|------|------|
| 上下文组装 | `context.ts` | 从 R2/DB 拉取作品的完整上下文 | `workId`, `lang` | `AgentContext` |
| 系统指令 | `instructions.ts` | 按角色和场景提供 system prompt | `role`, `module?` | `string` |
| 记忆管理 | `memory.ts` | 对话历史的存取、截断 | `workId`, `newMessage?` | `Message[]` |
| 类型定义 | `types.ts` | 共享类型 | — | `AgentContext` 等 |

**调用关系**：

```
elf_chat.ts（Story Elf 对话）
  ├─ agent/context.ts      → 拉取作品上下文
  ├─ agent/instructions.ts → 获取 system prompt
  ├─ agent/memory.ts       → 读取/追加对话历史
  └─ lib/ai.ts :: callAI() → 调用大模型

draft.ts / outline.ts / worldbuilding.ts / ...（工具类生成）
  └─ lib/ai.ts :: callAI() → 直接调用 AI Gateway
```

区分原则：Story Elf 对话需要 Agent 层完整能力（上下文感知 + 角色人格 + 对话记忆）；工具类生成是一次性任务指令，直接用 Layer 1。

### 9.5 实施阶段

| 阶段 | 内容 | 产出 |
|------|------|------|
| **Phase 1** | AI Gateway 客户端 | `lib/ai.ts` 重写：Cloudflare AI Gateway 统一入口 + 消息格式 + 重试 + 超时 |
| **Phase 2** | 上下文组装 | `lib/agent/`：context.ts + instructions.ts + types.ts；elf_chat.ts 迁移 |
| **Phase 3** | 工作流编排 | M0-M6 各模块的 Story Elf 行为定义：主动提示、level 建议、内容提取 |
| **Phase 4** | 记忆系统 | `lib/agent/memory.ts`：对话历史持久化 + 用户偏好 + 跨会话记忆 |

### 9.6 与 Story Forger 的边界

- **Story Forger 的 `POST .../generate` 端点**使用 Layer 1（AI Gateway 客户端）直接调用，不需要 Agent 层。
- **Story Elf 的 `/api/write/elf/chat`** 使用 Layer 1 + Layer 2 完整链路。
- 两层共享同一个 AI Gateway 客户端（`lib/ai.ts`），Agent 层是可选的上层封装。

---

## 10. 系统遥测

### 设计意图

AI 调用产生大量运行时指标（token 使用量、缓存命中率、用户活跃度），这些数据是系统健康度监控的基础。遥测模块以最小侵入的方式采集这些指标，同时写入结构化日志（供实时查看）和 D1（供长期统计）。

### 架构

```
elf_chat.ts
  └─ callAI() 返回 → { content, usage: { input, output, cacheHit, cacheMiss } }
  └─ recordAIUsage(env, record)  →  lib/telemetry.ts
       ├─ console.log({_type:'ai_usage', ...})  → Cloudflare Logs（实时）
       └─ D1 INSERT ai_usage_log                 → D1（长期统计/仪表盘）
```

### 数据模型

```sql
ai_usage_log (
  id, work_id, user_token, page, model,
  tokens_in, tokens_out, cache_hit, cache_miss, created_at
)
```

`user_token` 从 Authorization header 提取前 8 位，实现脱敏的用户级统计。后续可映射到真实 user_id。

### 使用场景

| 场景 | 数据来源 | 实现方式 |
|------|---------|---------|
| 实时调试 | `console.log` → Cloudflare Logs | 按 `_type=ai_usage` 过滤 |
| 单作品用量 | D1 `WHERE work_id=?` | SQL 聚合 |
| 用户活跃度 | D1 `GROUP BY user_token` | 日均 token/调用次数 |
| 缓存效率 | D1 `cache_hit/(cache_hit+cache_miss)` | 按时间/模型/作品维度 |
| 异常告警（未来） | D1 定时查询 | token 突增 / 缓存命中率骤降 → 通知 |

### 设计原则

- **不透传给用户**。usage 数据是系统内部指标，不暴露在 API 响应中
- **不阻塞主请求**。D1 写入 <5ms，当前同步写入即可。未来高并发时改为 `ctx.waitUntil`
- **渐进扩展**。当前只采集 AI 用量，后续可扩展 R2 延迟、DB 查询耗时等指标
