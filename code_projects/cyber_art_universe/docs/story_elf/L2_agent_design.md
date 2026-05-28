# Story Elf L2 — Agent 架构设计

> 版本: v1.1.0 | 状态: 设计定稿 | 最后更新: 2026-05-28
>
> 本文档是 Story Elf L2（Agent 场景层）的权威架构设计，融合了 CodeWhale 参考分析、DeepSeek API 能力评估和 Story Forger 现有代码的实地审查。
>
> **关联文档**：[Story Elf 系统设计](system_design.md) → [Story Elf SRS](SRS.md) → 本文档 → [Story Elf 前端设计](frontend_design.md) → [AI Gateway 指南](cloudflare_ai_gateway_guide.md)

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

4 个参考案例（去除 evaluation.md 后）合计 ~136K 字符 / ~34K tokens，仅占 DeepSeek 1M 窗口的 3.4%。

| 方案 | token 效率 | 响应速度 | 决策质量 |
|------|-----------|---------|---------|
| Tool call 按需获取 | 差——参考内容进入对话历史后，每轮后续请求都要重复消耗 | 慢——多一次 API 往返 | LLM 可能"该查没查"或"不该查却查" |
| **System prompt 预加载** | **好——首次请求后 34K tokens 作为 frozen prefix 缓存命中，零增量成本** | **快——一枪命中** | **参考始终在上下文中，无需决策门槛** |

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

> **为什么没有 `search_references`？** 参考案例库（4 个经典作品框架分析，~34K tokens）直接预加载到 system prompt Layer 3。首次请求后作为 frozen prefix 缓存命中，后续请求零增量 token 成本。比 tool call 方案省约 3 倍 token。详见 2.2 节分析。

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
│ Layer 1: Persona + 行为准则（最静态）        │  ← 缓存命中
│   Story Elf 是谁、修改范围、模糊时确认       │
├─────────────────────────────────────────────┤
│ Layer 2: 上下文包（静态，同作品不变）        │  ← 缓存命中
│   M0-M5 完整写作上下文                      │
├─────────────────────────────────────────────┤
│ Layer 3: 参考案例库（静态，跨作品共享）      │  ← 缓存命中
│   4 部经典作品框架分析，~34K tokens          │
├─────────────────────────────────────────────┤
│ Layer 4: 工具说明 + 行为建议（静态）         │  ← 缓存命中
│   每个工具的 description + 使用建议          │
├─────────────────────────────────────────────┤
│ Layer 5: 项目记忆（半静态，偶尔更新）        │  ← 偶尔 miss
│   <project_memory> XML 块                   │
└─────────────────────────────────────────────┘
```

> 动态信息（当前模块、章节标题）注入 user message 前缀，不进 system prompt。

#### 3.3.2 信息冲突的优先级

当上下文包、项目记忆、用户指令冲突时：

| 优先级 | 来源 | 说明 |
|--------|------|------|
| 1（最高） | 用户当前指令 | 用户刚说的话 |
| 2 | 上下文包（M0-M5） | 作品的正式设定 |
| 3 | 项目记忆 | 历史对话中沉淀的偏好和决策 |
| 4（最低） | 历史对话 | 旧结论。可能已过时 |

**核心原则**：用户刚说的 > 作品设定 > 旧记忆 > 旧对话。防止旧记忆覆盖用户新指令。

### 3.4 记忆系统

#### 3.4.1 项目记忆

R2 单文件：`works/{work_id}/elf_project_memory.md`

```
格式：
- 2026-05-28: 作者偏好短句、快节奏叙事，不喜欢冗长描写
- 2026-05-28: 决定主角的成长弧线为"坠落型"（类似佛罗多），非"英雄型"
- 2026-05-27: 魔法体系选择软魔法（类似中土），规则不明确、代价模糊
```

**规则**：
- 声明式事实（"作者偏好短句"），禁止命令式（"永远用短句"）
- Elf 通过 `save_memory` 工具写入（未来）
- L2.0 阶段：手动维护此文件，Elf 只读

#### 3.4.2 对话日志

R2：`works/{work_id}/elf_chat_log.json`（保留最近 N 轮）

Agent 循环从日志加载最近对话，追加到 messages 中。

### 3.5 Guardrails

框架强制，不由 LLM 自觉：

| 规则 | 实现 |
|------|------|
| 不可修改 M0 | `write_to_slot` 执行前校验 |
| 所有写入走版本历史 | `updateModule()` 内部自动快照 |
| 不可删除用户内容 | 不提供 delete 工具 |
| 订阅配额 | `generate_slot` 执行前检查 |

### 3.6 前端交互 — SSE 流式

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

## 四、实施路径

### 4.1 L2.0 — Agent 循环 + 核心工具 + 参考案例库

**目标**：Agent 循环跑通，3 个工具全部可用，参考案例库预加载，Elf 能多步思考。

**具体任务**：

1. **扩展 `callAI()`**：支持 `tools`/`tool_choice` 参数，解析 `tool_calls` 响应，支持 `role: "tool"` 消息
2. **加载参考案例库**：从 R2 读取 `system/case_knowledge/case_reference_package.md`（单一文件，~34K tokens），注入 system prompt Layer 3
3. **实现 Agent 循环**：`agentLoop()` 函数，while 循环直到 LLM 停止调用工具
4. **实现 3 个工具**：
   - `read_module` — 委托 `getModule()`
   - `generate_slot` — 吸收现有 generate prompt 逻辑，system+user 分离调用
   - `write_to_slot` — 委托 `updateModule()`
5. **构建 System Prompt**：5 层结构（Persona + 上下文包 + 参考案例库 + 工具说明 + 项目记忆）
6. **前端 SSE 展示**：5 种事件流

**预计新增代码**：~300 行 TypeScript + 1 个 System Prompt 模板。在 `elf_chat.ts` 基础上扩展，暂不拆目录。

### 4.2 L2.1 — 项目记忆 + 用户画像

**目标**：Elf 能记住跨会话的偏好和决策。

**具体任务**：

1. `elf_project_memory.md` 的自动读写
2. 会话摘要生成（每次对话结束后的压缩）
3. 用户偏好提取（风格、节奏、关注点）

### 4.3 L2.2+ — 批量流水线 + Read 侧

远期待定。批量章节生成本质上是 `create_plan` + 多次 `generate_slot` 的组合。Read 侧伴读是独立的 Agent 实例，用不同的 system prompt。

---

## 五、参考案例库

### 5.1 现状

R2 `system/case_knowledge/` 下已预构建统一的参考手册：

**单一文件**：`system/case_knowledge/case_reference_package.md`（5,057 行 / 137K 字符 / ~34K tokens / 297KB）

| 案例 | 字符数 | ~tokens | 类型 |
|------|--------|---------|------|
| 《魔戒》 | 33,555 | 8,388 | 史诗奇幻 |
| 《三体》 | 30,495 | 7,623 | 硬科幻 |
| 《阿凡达》 | 42,919 | 10,729 | 科幻/奇幻混合 |
| 《星际争霸》 | 29,190 | 7,297 | 太空歌剧 |
| **合计** | **136,159** | **~34,039** | 四种类型 |

文件头部包含使用说明和来源备注。各案例的独立文件（`world_bible.md`、`outline.md` 等）继续保留在各自目录下备查。`evaluation.md`（模板体系反向验证报告）已删除。

### 5.2 加载策略

**全量预加载到 system prompt Layer 3。**

~34K tokens 仅占 DeepSeek 1M 窗口的 3.4%。首次请求后作为 frozen prefix 缓存命中，后续请求零增量 token 成本。

比 tool call 按需获取省约 3 倍 token——参考内容通过 tool result 进入对话历史后，每轮后续请求都要重复带上；而在 system prompt 中只付一次费用。

LLM 像有参考书放在桌上——需要时翻开，不需要时忽略。无需决策门槛。

---

## 六、与现有代码的关系

| 现有文件 | L2 后如何处理 |
|---------|-------------|
| `elf_chat.ts` | **就地升级**为 Agent 循环入口。原单次 callAI 逻辑替换为 agentLoop() |
| `worldbuilding.ts` 的 `generateWorldbuilding()` | prompt 构建逻辑被 `generate_slot` 工具**吸收**。API 端点可以保留兼容，但内部委托给 Agent 工具 |
| `outline.ts` 的 `generateOutline()` | 同上 |
| `draft.ts` 的 `generateDraft()` / `checkConsistency()` / `polishDraft()` | 同上 |
| `module.ts` 的 `generateModule()` | 路由器 → 委托给 Agent 工具 |
| `story-elf.js` | 新增 SSE 事件监听，展示 Agent 多步执行过程 |

---

## 七、版本历史

| 版本 | 日期 | 说明 |
|------|------|------|
| v1.2.0 | 2026-05-28 | 4 案例合并为单一 `case_reference_package.md`（297KB/~34K tokens），写入 R2。System prompt 构建只需读一个文件 |
| v1.1.0 | 2026-05-28 | 参考案例库策略调整：tool call 按需获取 → system prompt 预加载（基于 DeepSeek 缓存机制底层分析）。工具从 4 个减为 3 个。删除所有 evaluation.md |
| v1.0.0 | 2026-05-28 | 定稿：融合架构讨论 + CodeWhale 参考分析 + generate 端点实地审查。一个文档覆盖全部 L2 设计 |
