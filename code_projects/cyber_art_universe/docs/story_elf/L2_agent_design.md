# Story Elf L2 — Agent 架构设计

> 版本: v1.5.0 | 状态: 设计定稿 | 最后更新: 2026-05-29
>
> 本文档是 Story Elf L2（Agent 场景层）的权威架构设计，融合了 CodeWhale 参考分析、DeepSeek API 能力评估和 Story Forger 现有代码的实地审查。
>
> **关联文档**：[Story Elf 系统设计](system_design.md) → 本文档 → [AI Gateway 指南](cloudflare_ai_gateway_guide.md)（功能需求已并入代码 → 见 `src/lib/l0/aiGateway.ts` / `src/lib/l1/context-package.ts` / `src/api/write/elf_chat.ts` 头部注释）

---

## 一、设计哲学

### 1.1 Story Elf L2 是什么

Story Elf 是 Cyber Art Universe 的 AI Agent 层。它跨 Story Forger（写作工具）和 CAU（阅读平台）两端服务。

**L0/L1/L2 三层分工**：

| 层 | 职责 | 现状 |
|----|------|------|
| L0 | AI 调用 — `callAI()` 通过 CF AI Gateway 调 DeepSeek | ✅ 已完成 |
| L1 | 内容操作总线 — R2/D1 读写、模板渲染、上下文包、版本历史、diff | ✅ 已完成 |
| L2 | **Agent 场景层** — 多步工具调用、对话记忆、参考检索、内容生成 | ⚡ 本文档设计 |

**L2 的本质**：从"一问一答"升级为"能多步思考、能查资料、能记住上下文、能生成内容的 Agent 式对话"。

### 1.2 核心设计原则

1. **建议，而非约束**。System prompt 告诉 LLM 有什么工具可用、什么时候可能用到。LLM 自己决定用不用、用什么顺序。
2. **吸收，而非绕过**。当前 Story Forger 中临时的 generate 端点，应被吸收为 Agent 工具——用 Agent 的上下文包 + system/user 分离方式重写调用逻辑。
3. **委托，而非重复**。所有 R2 读写委托给 L1 的 `getModule()`/`updateModule()`。L2 不做存储操作。
4. **现在少即是多**。L2.0 写 ~300 行能跑通的 Agent 循环 + 3 个工具，比 3000 行"完备框架"有价值得多。

### 1.3 与 Story Forger 的边界

| 能力 | 属于谁 | 说明 |
|------|--------|------|
| 模板定义 + 渲染 | Story Forger (L1) | `BIBLE_TEMPLATE` 等常量，`renderTemplate()` |
| R2/D1 读写 | Story Forger (L1) | `getModule()`, `updateModule()` |
| 版本历史 + diff | Story Forger (L1) | `createSnapshot()`, `diffVersions()` |
| 上下文包组装 | Story Forger (L1) | `getOrBuildContextPackage()` |
| **内容生成** | **Story Elf (L2)** | 吸收当前临时 generate 端点，用 Agent 方式调用 |
| **多步工具调用** | **Story Elf (L2)** | Agent 循环：LLM 自主决定调用哪些工具 |
| **参考案例库** | **Story Elf (L2)** | 预加载到 system prompt，LLM 始终可见 |
| **对话记忆** | **Story Elf (L2)** | 项目记忆 + 用户偏好 |

**Story Forger 是一个工作台（模板 + 编辑器 + 存储），它不内置 AI 核心。内容生成的 AI 能力属于 Story Elf。**

---

## 二、参考分析

### 2.1 CodeWhale — 核心借鉴

> 开源地址：https://github.com/Hmbown/CodeWhale | 本地：`code_projects/CodeWhale/`
>
> CodeWhale 是一个基于 DeepSeek 的开源编码 IDE（Rust）。Story Forger + Story Elf 之于文学创作，正如 CodeWhale 之于编码——底层 Agent 架构镜像度极高。

#### 2.1.1 总体架构

CodeWhale 分 12 个 crate，三层：

```
Layer 3: 应用层     tui / tui-core / app-server / cli          ← ❌ IDE 专用，全部跳过
Layer 2: 核心引擎   core（Runtime 总调度器） / state（SQLite）  ← ✅ 核心参考
Layer 1: 基础能力   protocol / tools / agent / config /          ← 🔄 部分借鉴
                    execpolicy / hooks / mcp / secrets
```

#### 2.1.2 对 Story Elf L2 真正有用的 4 个模式

| # | 来自 | 模式 | CodeWhale 规模 | L2.0 规模 | 精简策略 |
|---|------|------|---------------|----------|---------|
| 1 | `turn_loop.rs` | **Agent 执行循环** | 2387 行 | ~100 行 | 去流式重试/子代理/REPL/auto-compaction。核心就是 `while tool_calls: execute → append → continue` |
| 2 | `tools/` | **工具注册表** | 40+ 工具 | 3 个工具 | 去 MCP dispatch/并行安全锁/超时。工具定义 = `{name, description, parameters JSON Schema, execute()}`, 注册表 = `Map<string, ToolDef>` |
| 3 | `prompts/` | **System Prompt 层次** | 9 Tier 宪法 | 3 层 | 去模式切换/审批策略/子代理角色。保留：Persona + 工具说明 + 上下文包 + 行为建议。最关键的设计——指令(Tier 2) > 记忆(Tier 7)，旧记忆不能覆盖用户新指令 |
| 4 | `memory.rs` | **项目记忆文件** | 284 行 | ~50 行 | Markdown 文件存 R2。声明式事实（"作者偏好短句"），禁止命令式（"永远用短句"）。XML 块注入 system prompt |

#### 2.1.3 不需要借鉴的（及原因）

| CodeWhale | 跳过原因 |
|-----------|---------|
| 上下文压缩 (compaction.rs) | DeepSeek 1M 窗口 = 250K 字，是《三体》的 3 倍。中短期内不需要 |
| 子代理 (subagent/) | Phase 4+ 的事 |
| 执行策略 (execpolicy/) | Shell 命令 allowlisting，Story Elf 不执行 shell |
| 沙箱 (sandbox/) | Cloudflare Workers 天然沙箱 |
| MCP (mcp/) | 没有外部工具需要接入 |
| 密钥存储 (secrets/) | Workers Secret 已解决 |
| TUI 全部 (~100 文件) | 前端在浏览器 |

### 2.2 DeepSeek API — 关键能力

> 详见 [Cloudflare AI Gateway 指南](cloudflare_ai_gateway_guide.md)

| 能力 | 支持情况 | 对 L2 的意义 |
|------|---------|------------|
| 标准工具调用 | ✅ 原生支持（OpenAI 兼容） | 不需要 strict 模式，不需要 Beta 端点 |
| 思考模式 + 工具调用 | ✅ 多轮思考→执行循环 | Agent 可以"想→查参考→想→生成→想→回复" |
| strict 模式 | ⚡ 可选 Beta | 不需要。标准 function calling 足够 |
| 上下文缓存 | ✅ 默认开启 | System prompt（含上下文包+工具定义）作为 frozen prefix → 高缓存命中 |
| JSON 输出 | ✅ `response_format: 'json_object'` | 工具参数和返回值可要求结构化 |

**Agent 循环与 DeepSeek 思考模式的天然匹配**：

```
用户消息
  → Turn.N.1: 模型思考（参考案例已在 system prompt 中）→ 调用 read_module(...)
  → Turn.N.2: 模型收到模块内容 → 继续思考 → 调用 generate_slot(...)
  → Turn.N.3: 模型收到生成结果 → 思考 → 最终回复给用户
```

每轮工具调用后，`reasoning_content` 需回传。`content` 和 `tool_calls` 按 OpenAI 标准格式。

**参考案例库加载策略**（经底层分析后的决策）：

4 个参考案例（去除 evaluation.md 后）合计 ~137K 字符 / ~132K tokens（中文约 1.5 tokens/字，英文约 0.25 tokens/字），占 DeepSeek 1M 窗口的 13.2%。

| 方案 | token 效率 | 响应速度 | 决策质量 |
|------|-----------|---------|---------|
| Tool call 按需获取 | 差——参考内容进入对话历史后，每轮后续请求都要重复消耗 | 慢——多一次 API 往返 | LLM 可能"该查没查"或"不该查却查" |
| **System prompt 预加载** | **好——首次请求后 ~132K tokens 作为 frozen prefix 缓存命中，零增量成本** | **快——一枪命中** | **参考始终在上下文中，无需决策门槛** |

**结论**：参考案例库放入 system prompt 的 Layer 3。LLM 像有工具书放在桌上——需要时翻开，不需要时忽略。比 tool call 方案省约 3 倍 token。

**callAI() 需要的扩展**：
- 新增 `tools` 参数（工具定义数组）
- 新增 `tool_choice` 参数（"auto" / "none"）
- 响应新增 `tool_calls` 字段解析
- 消息类型新增 `role: "tool"` + `tool_call_id`
- 透传 `reasoning_content`

---

## 三、架构设计

### 3.1 Agent 执行循环

核心 ~30 行伪代码：

```typescript
async function agentLoop(env, workId, lang, userMessage, history) {
  const systemPrompt = buildSystemPrompt(env, workId, lang);
  const messages = [
    { role: 'system', content: systemPrompt },
    ...history,
    { role: 'user', content: userMessage },
  ];

  while (true) {
    const response = await callAI(env, messages, { tools: TOOL_DEFS });

    if (!response.tool_calls || response.tool_calls.length === 0) {
      // 没有工具调用 → 最终回复
      return response.content;
    }

    // 执行工具调用
    for (const tc of response.tool_calls) {
      const result = await executeTool(env, tc);
      messages.push({ role: 'tool', tool_call_id: tc.id, content: result });
    }
    // 循环继续，LLM 处理工具结果后决定下一步
  }
}
```

**停止条件**：LLM 返回无 tool_call 的文本 → 正常结束；达到最大迭代次数（如 10 次）→ 异常结束。

### 3.2 工具系统

#### 3.2.1 工具定义格式

```typescript
interface ToolDef {
  name: string;
  description: string;     // 告诉 LLM 这个工具做什么、什么时候可能用到
  parameters: object;      // JSON Schema
  execute(env, params): Promise<string>;  // 返回工具结果文本
}
```

`description` 是给 LLM 的 **建议**，不是命令："当你需要灵感或参考其他作品的创作手法时，可以搜索经典作品的创作框架分析"。

#### 3.2.2 L2.0 的 3 个工具

| 工具 | 职责 | 与现有代码的关系 |
|------|------|----------------|
| `read_module` | 读取当前模块的完整内容（slots + free_content） | **委托** `getModule()`，返回 slots 数据 + 渲染后的 markdown |
| `generate_slot` | 生成指定模块/slot 的内容 | **吸收** 现有 `generateWorldbuilding/Outline/Draft` 的 prompt 构建逻辑。用 system+user 分离方式调用 LLM |
| `write_to_slot` | 将生成内容写入槽位 | **委托** `updateModule()`。自动走 L1 版本历史 |

> **为什么没有 `search_references`？** 参考案例库（4 个经典作品框架分析，~132K tokens）直接预加载到 system prompt Layer 3。首次请求后作为 frozen prefix 缓存命中，后续请求零增量 token 成本。比 tool call 方案省约 3 倍 token。详见 2.2 节分析。

**generate_slot 的关键改造**：

```
现 在: callAI([{role:'user', content: 模板JSON + 上下文 + 任务指令全塞一起}])
改造后: callAI([
          {role:'system', content: '你是 Story Elf...' + 上下文包},
          {role:'user',   content: '请生成 M1 世界观的力量体系部分...'}
        ])
        → system 作为 frozen prefix → 缓存命中
```

#### 3.2.3 工具注册表

```typescript
const TOOL_REGISTRY: Record<string, ToolDef> = {
  read_module:   { ... },
  generate_slot: { ... },
  write_to_slot: { ... },
};

// 生成给 DeepSeek 的 tools 参数
function buildToolsParam(): object[] {
  return Object.values(TOOL_REGISTRY).map(t => ({
    type: 'function',
    function: {
      name: t.name,
      description: t.description,
      parameters: t.parameters,
    },
  }));
}
```

### 3.3 System Prompt 设计

#### 3.3.1 分层结构

```
┌─────────────────────────────────────────────┐
│ Layer 1: 统一人格（跨 Read/Write，最静态）   │  ← 缓存命中
│   Story Elf 是谁、核心行为准则               │
│   Write 侧重辅助创作 / Read 侧重陪伴阅读     │
├─────────────────────────────────────────────┤
│ Layer 2: 上下文包（静态，同作品不变）        │  ← 缓存命中
│   M0-M5 完整写作上下文（Write 侧）           │
│   当前章节 + 阅读进度（Read 侧）             │
├─────────────────────────────────────────────┤
│ Layer 3: 参考案例库（静态，跨作品共享）      │  ← 缓存命中
│   4 部经典作品框架分析，~79K tokens          │
├─────────────────────────────────────────────┤
│ Layer 4: 工具说明 + 行为建议（静态）         │  ← 缓存命中
│   每个工具的 description + 使用建议          │
├─────────────────────────────────────────────┤
│ Layer 5: 记忆注入层（半静态，偶尔更新）      │  ← 偶尔 miss
│   ├── 作品级记忆 (L2 STM)                    │
│   └── 用户画像 (L3 LTM，精简字段)            │
│   Read/Write 侧加载对应的子记忆              │
└─────────────────────────────────────────────┘
```

> 动态信息（当前模块、章节标题）注入 user message 前缀，不进 system prompt。
> 
> Layer 5 随会话更新而变化，放在最后——最动态的内容在尾部，不影响前 4 层的缓存命中。

#### 3.3.2 信息冲突的优先级

当多来源信息冲突时（借鉴 CodeWhale 的宪法层次）：

| 优先级 | 来源 | 说明 |
|--------|------|------|
| 1（最高） | 用户当前指令 | 用户刚说的话 |
| 2 | 上下文包（M0-M5） | 作品的正式设定，是最权威的约束文档 |
| 3 | 作品级记忆 (L2 STM) | 历史对话中沉淀的偏好和决策（事实，非命令） |
| 4 | 用户画像 (L3 LTM) | 跨作品提炼的长期偏好（参考，非强制） |
| 5（最低） | 旧对话日志 (L1) | 旧结论，可能已过时。仅供提取器使用，不注入 prompt |
| 4（最低） | 历史对话 | 旧结论。可能已过时 |

**核心原则**：用户刚说的 > 作品设定 > 旧记忆 > 旧对话。防止旧记忆覆盖用户新指令。

### 3.4 人格注入层

Story Elf 在 Read 侧和 Write 侧共享**统一的底层人格**，确保用户切换场景时 Elf 的一致性。

```
┌─────────────────────────────────────────────┐
│        Story Elf 统一人格（跨 Read/Write）    │
│                                              │
│  "灵动、有魔法感、机智的创作伙伴"              │
│  鼓励、建设性，尊重作者/读者的最终决定权        │
│  你是帮手，不是替代者                          │
├────────────────────┬────────────────────────┤
│  Write 侧行为侧重   │  Read 侧行为侧重        │
│  帮助构思/发展角色   │  陪伴阅读/交流心得       │
│  检查一致性和结构    │  不剧透，灵动温暖        │
│  遵循模板格式        │  感知阅读位置            │
└────────────────────┴────────────────────────┘
```

**人格文件**：`lib/l1/prompts/writer_companion/system.md`（当前已有），未来增加 `reader_companion/system.md`。两个文件共享核心人格定义，场景侧的行为指令作为**追加层**，不覆盖核心人格。

### 3.5 记忆系统：三级记忆模型

> 借鉴 Claude Code 的 MEMORY.md 多级体系 + OpenClaw 的睡眠/画像提取机制。

#### 3.5.1 总体架构

```
┌──────────────────────────────────────────────────────────┐
│                   用户记忆（统一，跨 Read/Write）           │
│                                                           │
│  ┌─────────────────────────────────────────────────────┐ │
│  │ L3: 用户画像（长期记忆 LTM）                          │ │
│  │   跨作品、跨会话的持久画像                             │ │
│  │   风格偏好 / 节奏偏好 / 创作习惯 / 阅读口味            │ │
│  │   注入 system prompt（精简摘要，非全量）               │ │
│  ├─────────────────────────────────────────────────────┤ │
│  │ L2: 作品级记忆（短期记忆 STM）                        │ │
│  │   单作品的跨会话记忆                                   │ │
│  │   关键决策 / 灵感方向 / 已讨论过的修改计划              │ │
│  │   注入 system prompt（XML 块）                        │ │
│  ├─────────────────────────────────────────────────────┤ │
│  │ L1: 会话日志（瞬时记忆）                              │ │
│  │   本次对话的原始记录                                   │ │
│  │   R2 多文件累积存储（按日期/会话分割）                  │ │
│  │   不注入 system prompt → 供 L2/L3 提取用              │ │
│  └─────────────────────────────────────────────────────┘ │
│                                                           │
│            ┌──────────┐                                   │
│            │ 记忆提取器 │  ← L1 → L2 → L3 逐级提炼         │
│            │ (TBD)    │    程序规则 / LLM "睡眠模式"        │
│            └──────────┘                                   │
└──────────────────────────────────────────────────────────┘
```

#### 3.5.2 L1：会话日志（瞬时记忆）

**存储**：R2 `users/{user_token}/memory/write/{work_id}/{date}_{session_id}.json` 和 `users/{user_token}/memory/read/{work_id}/{date}_{session_id}.json`

**内容**：原始对话记录。Write 侧和 Read 侧分开存储，但逻辑结构一致。

```json
{
  "session_id": "sess_xxx",
  "date": "2026-05-28",
  "page": "write",
  "work_id": "work_xxx",
  "messages": [
    {"role": "user", "content": "...", "timestamp": 1716890400},
    {"role": "assistant", "content": "...", "timestamp": 1716890410}
  ],
  "summary": null
}
```

**规则**：
- 每个会话一个文件，按日期分目录
- Write 和 Read 分别存储，但共享同一套提取管道
- 原始记录**不注入 system prompt**——仅供记忆提取器使用

#### 3.5.3 L2：作品级记忆（短期记忆 STM）

**存储**：R2 `works/{work_id}/elf_project_memory.md`

**内容**：从 L1 中提取的、与当前作品相关的关键信息。声明式事实。

```markdown
## 写作偏好
- 2026-05-28: 偏好短句、快节奏叙事，不喜欢冗长环境描写
- 2026-05-27: 对话风格偏好：简洁、潜台词丰富，避免"说教感"

## 作品决策
- 2026-05-28: 主角成长弧线定为"坠落型"（类似佛罗多），非"英雄型"
- 2026-05-27: 魔法体系选择软魔法，规则不明确、代价模糊
- 2026-05-25: 结局确定为"悲壮的希望"，不要大团圆

## 待办/计划
- 第 3 章需要重写情感转折段落
- M1 承诺清单缺少第 5 条，下次补充
```

**规则**：
- **声明式事实**，禁止命令式（"偏好短句" ✅，"永远用短句" ❌）
- 同等条件下，最近的信息权重更高
- 单文件 < 100KB，超出时裁剪最旧的条目
- 注入 system prompt Layer 5（`<project_memory>` XML 块）

#### 3.5.4 L3：用户画像（长期记忆 LTM）

**存储**：D1 `user_profiles` 表（未来）或 R2 `users/{user_token}/profile.json`

**内容**：跨作品、跨会话的持久用户画像。从多个作品的 L2 记忆中二次提炼。

```json
{
  "user_token": "usr_xxx",
  "writing_style": {
    "pace": "fast",
    "sentence_length": "short",
    "dialogue_style": "concise_subtext",
    "description_density": "sparse",
    "tone": "dark_hopeful"
  },
  "genre_preferences": ["epic_fantasy", "sci_fi"],
  "reading_preferences": {
    "favored_themes": ["sacrifice", "moral_ambiguity", "fallen_heroes"],
    "reading_pace": "binge"
  },
  "interaction_style": {
    "wants_proactive_suggestions": true,
    "preferred_elf_tone": "professional"
  },
  "extracted_at": "2026-05-28",
  "source_sessions": 15
}
```

**注入方式**：精选关键字段 → 渲染为精简文本 → 注入 system prompt Layer 5。

#### 3.5.5 记忆提取器

**从 L1 → L2**：每次会话结束后（或会话中达到 N 轮），提取关键决策和偏好，追加到 `elf_project_memory.md`。

**从 L2 → L3**：每 N 次会话或每 M 个作品后，跨作品提炼用户画像，更新 `profile.json`。

**提取机制（TBD）**：

| 方案 | 优点 | 缺点 |
|------|------|------|
| **程序规则** | 零 token 成本，确定性高 | 只能提取结构化字段（如"偏好短句"这类明确信号），灵活度低 |
| **LLM "睡眠模式"** | 灵活，能理解隐含信息 | 消耗 token，需要设计触发时机和频率 |
| **混合** | 规则处理明确的结构化提取，LLM 处理需要理解上下文的抽象提炼 | 实现复杂度高 |

**当前建议**：L2.0 阶段手动维护 `elf_project_memory.md`。L2.1 引入 LLM 睡眠模式做 L1→L2 提取（每次会话结束后一次轻量 LLM 调用）。L3 画像提炼留到 Phase 4。

#### 3.5.6 System Prompt 中的位置

更新后的 System Prompt 分层：

```
┌─────────────────────────────────────────────┐
│ Layer 1: 统一人格（跨 Read/Write）           │  ← 缓存命中
├─────────────────────────────────────────────┤
│ Layer 2: 上下文包（M0-M5）                   │  ← 缓存命中
├─────────────────────────────────────────────┤
│ Layer 3: 参考案例库（~79K tokens）           │  ← 缓存命中
├─────────────────────────────────────────────┤
│ Layer 4: 工具说明 + 行为建议                 │  ← 缓存命中
├─────────────────────────────────────────────┤
│ Layer 5: 记忆注入层                         │  ← 偶尔 miss
│   ├── 作品级记忆 (L2 STM)                    │
│   └── 用户画像 (L3 LTM，精简字段)            │
│   Read/Write 侧加载对应的子记忆              │
└─────────────────────────────────────────────┘
```

> Layer 5 的内容随会话更新而变化，因此放在最后——最动态的内容在尾部，不影响前 4 层的缓存命中。

### 3.6 Guardrails

框架强制，不由 LLM 自觉：

| 规则 | 实现 |
|------|------|
| 不可修改 M0 | `write_to_slot` 执行前校验 |
| 所有写入走版本历史 | `updateModule()` 内部自动快照 |
| 不可删除用户内容 | 不提供 delete 工具 |
| 订阅配额 | `generate_slot` 执行前检查 |

### 3.7 前端交互 — SSE 流式

Agent 多步执行过程通过 SSE 推送给前端：

```
data: {"type":"thinking",  "text":"让我看看你当前的设定..."}
data: {"type":"tool_call",  "tool":"read_module", "params":{"module":"m1"}}
data: {"type":"tool_result","tool":"read_module", "summary":"世界观设定已加载"}
data: {"type":"thinking",  "text":"参考魔戒的魔法体系，结合你的设定..."}
data: {"type":"text_delta", "text":"你的魔法体系可以考虑..."}
data: {"type":"done"}
```

用户看到 Elf 的思考过程，不是黑盒等待。

---

## 四、云端持久执行模型

> Story Elf 区别于传统 AI 聊天应用的核心差异化能力。

### 4.1 核心洞察：CPU Time ≠ Wall Time

Story Elf 运行在 Cloudflare Workers 上。一次典型的 Agent 工具调用：

```
调用 generate_slot → callAI():
  ├─ 构建请求体           ← ~1ms CPU
  ├─ fetch() 等待 LLM     ← 30-60s wall time（零 CPU 消耗！）
  ├─ 解析响应             ← ~2ms CPU
  └─ 写入 R2 + 更新 D1    ← ~5ms CPU

单次迭代 CPU 消耗:         ← ~20ms
单次迭代 Wall Time:        ← 30-60s
```

**关键发现**：95%+ 的时间在等待 DeepSeek 返回结果。Worker CPU 在此期间完全空闲。这意味着：

- 生成 10 章的 CPU 消耗约 200ms，远低于 Worker 的 CPU 时间上限
- 生成 100 章的 CPU 消耗约 2 秒，在付费计划限制内

### 4.2 持久执行：前端是对话界面，Elf 在云端持续运行

```
传统 AI 聊天应用:
  用户关浏览器 → 对话中断 → 丢失上下文 → 下次从头开始

Story Elf:
  用户发消息 → Worker 开始执行 Agent 循环
    → 逐步推进任务: A✅ B✅ C✅
    (用户关浏览器 — Elf 不停)
    → 继续: D✅ E✅ F✅
    → 到 G 遇到需要用户确认的决策 → 主动暂停
    → R2 保存: A-F✅ G🔄 H⬜
  用户回来 → 看到进展 + G 待确认 → 确认 → Elf 继续
```

**前端只是对话界面。真正的 Agent 在 Cloudflare Worker 中持续运行，与用户是否在线无关。用户回来时看到的是进展，不是等待。**

### 4.3 Checklist 持久化：云端持续执行，用户回来看到进展

Story Elf 不会因为用户关闭浏览器而停止。它会持续工作直到完成，或直到遇到需要用户确认的节点才暂停。

```
用户在线的部分:
  用户: "帮我把 10 个角色的设定都优化一遍"
    → Elf: checklist_write([A, B, C, D, E, F, G, H, I, J])
    → 执行 A → 更新进度
    → 执行 B → 更新进度
    → 执行 C → 用户关浏览器

用户离线期间 — Elf 在云端继续执行:
    → 执行 D ✅ → 执行 E ✅ → 执行 F ✅ → 执行 G ✅
    → 到 H 时：发现需要用户确认角色H的弧线方向
    → Elf 主动暂停，R2 保存: A-G✅ H🔄 I⬜ J⬜

用户第二天回来:
    → 前端从 R2 读取 checklist
    → 展示: "已完成 7/10 个角色。当前停在角色H——需要你确认弧线方向。"
    
用户的感知: "我昨天只看到它完成了3个，今天回来它已经做了7个！
            这系统在我睡觉的时候还在工作。"

用户确认后 → Elf 继续完成 H, I, J → 全部完成
```

### 4.4 竞争优势

与 CodeWhale、Claude Code、OpenClaw 等 Agent 产品相比，Story Elf 的独特定位：

| 产品 | 运行位置 | 用户离线后 | 任务持续性 |
|------|---------|-----------|-----------|
| Claude Code | 用户本地终端 | 进程终止 | ❌ 中断 |
| CodeWhale | 用户本地 TUI | 进程终止 | ❌ 中断 |
| OpenClaw | 用户本地物理机 | 持续运行 | ✅ 但需物理机 |
| **Story Elf** | **Cloudflare Workers（云端）** | **持续运行** | **✅ 云端持久** |

Story Elf 不需要用户保持浏览器打开，不需要物理机器——它在 Cloudflare 的全球网络上运行，天然持久。

### 4.5 未来演进：Workflows

当前 Worker 模型可以处理 100 章以内的任务。当需要更长时间执行（如批量生成 500 章的专业级长篇），可迁移到 Cloudflare Workflows：

```
Workflow 模型:
  step.generate_ch1() → 挂起，等 AI 返回 → step.generate_ch2() → ...
  
  每个 step 之间 Workflow 挂起到持久存储
  可以从任何 step 恢复
  天然支持几小时到几天的执行时间
```

Worker 和 Workflow 的 Agent 循环代码完全复用——只是外层"wait loop"的实现不同。

---

## 六、实施路径

### 6.1 L2.0 — Agent 循环 + 核心工具 + 参考案例库

**目标**：Agent 循环跑通，3 个工具全部可用，参考案例库预加载，Elf 能多步思考。

**具体任务**：

1. **扩展 `callAI()`**：支持 `tools`/`tool_choice` 参数，解析 `tool_calls` 响应，支持 `role: "tool"` 消息
2. **加载参考案例库**：从 R2 读取 `system/case_knowledge/case_reference_package.md`（单一文件，~132K tokens），注入 system prompt Layer 3
3. **实现 Agent 循环**：`agentLoop()` 函数，while 循环直到 LLM 停止调用工具
4. **实现 3 个工具**：
   - `read_module` — 委托 `getModule()`
   - `generate_slot` — 吸收现有 generate prompt 逻辑，system+user 分离调用
   - `write_to_slot` — 委托 `updateModule()`
5. **构建 System Prompt**：5 层结构（Persona + 上下文包 + 参考案例库 + 工具说明 + 项目记忆）
6. **前端 SSE 展示**：5 种事件流

**预计新增代码**：~300 行 TypeScript + 1 个 System Prompt 模板。在 `elf_chat.ts` 基础上扩展，暂不拆目录。

### 6.2 L2.1 — 项目记忆 + 用户画像

**目标**：Elf 能记住跨会话的偏好和决策。

**具体任务**：

1. `elf_project_memory.md` 的自动读写
2. 会话摘要生成（每次对话结束后的压缩）
3. 用户偏好提取（风格、节奏、关注点）

### 6.3 L2.2+ — 批量流水线 + Read 侧

远期待定。批量章节生成本质上是 `create_plan` + 多次 `generate_slot` 的组合。Read 侧伴读是独立的 Agent 实例，用不同的 system prompt。

---

## 七、参考案例库

### 7.1 现状

R2 `system/case_knowledge/` 下已预构建统一的参考手册：

**单一文件**：`system/case_knowledge/case_reference_package.md`（5,057 行 / 137K 字符 / ~132K tokens / 297KB）

| 案例 | 字符数 | ~tokens | 类型 |
|------|--------|---------|------|
| 《魔戒》 | 33,555 | ~32K | 史诗奇幻 |
| 《三体》 | 30,495 | ~29K | 硬科幻 |
| 《阿凡达》 | 42,919 | ~41K | 科幻/奇幻混合 |
| 《星际争霸》 | 29,190 | ~28K | 太空歌剧 |
| **合计** | **136,159** | **~132,071** | 四种类型 |

文件头部包含使用说明和来源备注。各案例的独立文件（`world_bible.md`、`outline.md` 等）继续保留在各自目录下备查。`evaluation.md`（模板体系反向验证报告）已删除。

### 7.2 加载策略

**全量预加载到 system prompt Layer 3。**

~132K tokens 仅占 DeepSeek 1M 窗口的 13.2%。首次请求后作为 frozen prefix 缓存命中，后续请求零增量 token 成本。

比 tool call 按需获取省约 3 倍 token——参考内容通过 tool result 进入对话历史后，每轮后续请求都要重复带上；而在 system prompt 中只付一次费用。

LLM 像有参考书放在桌上——需要时翻开，不需要时忽略。无需决策门槛。

---

## 八、与现有代码的关系

| 现有文件 | L2 后如何处理 |
|---------|-------------|
| `elf_chat.ts` | **就地升级**为 Agent 循环入口。原单次 callAI 逻辑替换为 agentLoop() |
| `worldbuilding.ts` 的 `generateWorldbuilding()` | prompt 构建逻辑被 `generate_slot` 工具**吸收**。API 端点可以保留兼容，但内部委托给 Agent 工具 |
| `outline.ts` 的 `generateOutline()` | 同上 |
| `draft.ts` 的 `generateDraft()` / `checkConsistency()` / `polishDraft()` | 同上 |
| `module.ts` 的 `generateModule()` | 路由器 → 委托给 Agent 工具 |
| `story-elf.js` | 新增 SSE 事件监听，展示 Agent 多步执行过程 |

---

## 九、验证测试：参考包 + 单轮生成

> 2026-05-28，通过 CF AI Gateway 直接调用 `deepseek-v4-flash`，将完整 Reference Package（~137K 字符 / 79K tokens）注入 system prompt，测试单轮 M0-M5 生成能力。

### 9.1 测试设置

- **System prompt**：简短 Persona + 完整 `case_reference_package.md`（4 案例 × M1-M5，79,175 tokens）
- **User prompt**：给定一个史诗奇幻构想（被放逐的王子 + 魔法消亡 + 寻找龙族），要求参考《魔戒》框架给出 M0-M5 创作建议
- **无 max_tokens 限制**，让模型自然输出完

### 9.2 测试结果

| 指标 | 数值 |
|------|------|
| HTTP 状态 | 200，`finish_reason: "stop"` |
| prompt_tokens | 79,175 |
| completion_tokens | 2,596 |
| 首次请求缓存命中 | 0 |
| **第二次请求缓存命中** | **79,104 / 79,175 = 99.91%** |
| 响应字数 | 3,661 字符 |

### 9.3 响应质量分析

模板要素覆盖率：**16/21（76%）**。

| 模块 | 覆盖情况 | 评价 |
|------|---------|------|
| M0 | ✅ 全部 | 超出预期——将"点燃魔法"深化为"赎回罪孽 vs 让火焰熄灭"的二元选择 |
| M1 | ⚠️ 部分 | 力量体系、代价到位。缺少承诺清单、内容禁区、语言风格 |
| M2 | ⚠️ 部分 | 三幕结构扎实。缺少支线规划表、节奏规划表 |
| M3 | ⚠️ 部分 | 主角弧线清晰，镜像反派出色。缺少关系网、能力边界 |
| M4 | ❌ 薄弱 | 仅 3 个伏笔种子。缺少强度分级、生命周期阶段、交叉引用 |
| M5 | ❌ 薄弱 | 仅 3 个关键章节。缺少正式意图卡结构（冲突推进/情绪目标/POV 等字段） |

**综合评分：7/10。** 作为创作启发——出色。作为完整框架——不足。模型在 reasoning 中明确意识到参考包的价值（"我打算用《魔戒》的分析方法来解构世界观和角色弧线"），但 2,596 tokens 的输出不可能覆盖完整的 M0-M5。

### 9.4 关键结论

**1. 参考包预加载策略验证通过。** 79K tokens 占窗口 7.9%。第二次请求缓存命中率 99.91%，仅 71 个 token 未命中。首次付费，后续几乎免费。

**2. 单轮生成天花板明确。** 模型理解框架且能迁移，但单次回复无法输出上万字的完整 M0-M5。M4-M5 尤其薄弱——这正是需要多轮 Agent 迭代的地方。

**3. 这恰好证明了 L2 Agent 架构的必要性。** 单轮给 7 分灵感，多轮 Agent 才能做到 9 分完整。

---

## 十、核心工作流：迭代生成 + 自检 + 跨模块校验

> 基于测试验证，明确了 Story Elf L2 的核心价值不在于"一次性生成"，而在于**多轮迭代、逐模块完善、自检自修、跨模块一致性校验**。

### 10.1 迭代生成流程

```
作者: "帮我生成 M1 世界观"
  → Elf: 调用 generate_slot("m1") → 生成初稿 → write_to_slot
  → 作者审阅 → 微调

作者: "力量体系不够详细"
  → Elf: 调用 read_module("m1") → 定位 power_system slot
  → 调用 generate_slot("m1", slot_id="power_system", instructions="更详细...")
  → write_to_slot → 作者确认

作者: "继续 M2 大纲"
  → Elf: read_module("m1") 获取世界观上下文（自动）
  → generate_slot("m2") → 基于 M1 约束生成大纲
  → write_to_slot → 作者确认

... 逐模块推进，每次聚焦一个模块甚至一个 slot
```

**关键设计**：不是一次性输出全量内容，而是每次聚焦一个小目标。M5 的 30-50 张意图卡，可能分 10 轮对话逐批生成。

### 10.2 自检机制

生成后，Elf 自动检查输出是否与模板对齐：

```
generate_slot("m1") 完成
  → Elf 内部自检:
     ✅ 一、世界规则与边界：已覆盖
     ✅ 二、核心主题与价值观：已覆盖
     ❌ 五、承诺清单：缺失 → 提示作者"要不要补充对读者的承诺？"
     ⚠️ 三、角色体系：简略，建议在 M3 中展开
```

**实现方式**：`generate_slot` 完成后，Elf 对比模板的 `sections[].slots[]` 与生成结果中各 slot 的内容。空 slot 标记为缺失。然后主动提示作者补充或让 Elf 补充。

### 10.3 跨模块一致性校验

当作者修改内容后，Elf 自动回溯检查是否破坏了上游约束：

```
作者修改 M6 第 8 章
  → Elf check_consistency:
     - 对照 M1 承诺清单：第 8 章主角行为是否违背了"怜悯才有回报"的承诺？
     - 对照 M3 人物卡：主角在这一章的表现是否符合其能力边界？
     - 对照 M4 伏笔账本：是否有标记为"ch8 回收"的伏笔未兑现？
     - 对照 M2 大纲：本章是否在正确的结构位置上？
```

这是 Story Elf 相对于普通 AI 聊天的核心差异化价值——**Elf 不仅生成内容，还维护内容的一致性。** 人手做不到在修改第 200 章时自动对照第 1 章埋下的伏笔。

---

## 十一、关联文档

- [L2 Agent 记忆系统设计](L2_agent_memory.md) — 三级记忆模型（L1 瞬时 → L2 短期 → L3 长期）的完整设计

---

## 十二、版本历史

| 版本 | 日期 | 说明 |
|------|------|------|
| v1.5.0 | 2026-05-29 | 新增「云端持久执行模型」：CPU time ≠ wall time 分析、前端对话界面/Agent 云端持续运行、checklist 跨会话恢复、差异化竞争优势定位、Workflows 演进路径 |
| v1.4.0 | 2026-05-29 | 记忆系统全面升级：三级记忆模型（L1 会话日志/L2 作品级记忆/L3 用户画像）；统一人格注入层（跨 Read/Write）；记忆提取器设计（TBD：程序规则 vs LLM 睡眠模式）；System Prompt 分层更新为 5 层 |
| v1.3.0 | 2026-05-28 | 新增 DeepSeek 实测验证（99.91% 缓存命中） + 迭代生成/自检/跨模块一致性校验工作流设计 |
| v1.2.0 | 2026-05-28 | 4 案例合并为单一 `case_reference_package.md`（297KB/~132K tokens），写入 R2。System prompt 构建只需读一个文件 |
| v1.1.0 | 2026-05-28 | 参考案例库策略调整：tool call 按需获取 → system prompt 预加载（基于 DeepSeek 缓存机制底层分析）。工具从 4 个减为 3 个。删除所有 evaluation.md |
| v1.0.0 | 2026-05-28 | 定稿：融合架构讨论 + CodeWhale 参考分析 + generate 端点实地审查。一个文档覆盖全部 L2 设计 |
