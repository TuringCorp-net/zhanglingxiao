# Story Elf L2 Agent — 逐层验证计划

> 版本: v1.2.0 | 状态: 验证计划 | 最后更新: 2026-06-01
>
> **关联文档**：[L2 Agent 架构设计](L2_agent_design.md) ← 本文档的验证依据
>
> **测试作品**：「镜中棋局」`aa489993-1e7b-4804-b6af-723619b150b6`（fantasy，已发布，有 M0-M2 内容）
>
> **API Base URL**：`https://cau.turingcorp.net`
> **Auth Token**：`admin-TuringCorp-13572468`（管理端 Bearer token）
>
> **验证方式**：人工逐点验证。每步：发一个 curl → 看返回 → 判断是否符合预期。通过后打勾，失败则修代码再验。

---

## 零、验证前现状

### 已完成 & 已验证

| 层 | 模块 | 验证状态 |
|----|------|---------|
| L0 | AI Gateway 基础调用（文本/JSON） | ✅ |
| L0 | **工具调用（tools/tool_choice）** | ❌ 未验证 |
| L1 | R2 读写 + 上下文包 | ✅ |
| L1 | 版本历史 + diff | ✅ |
| L1 | **记忆写入** | ❌ 未实现（L2.1） |
| L2 | 全部代码（`src/lib/l2/*.ts`） | ❌ 零验证 |

### 代码文件清单

| 文件 | 职责 |
|------|------|
| `src/lib/l0/aiGateway.ts` | AI Gateway 客户端（含工具调用支持） |
| `src/lib/l2/types.ts` | L2 类型定义 |
| `src/lib/l2/prompt.ts` | 5 层 System Prompt 构建 |
| `src/lib/l2/tools.ts` | 工具实现（5 个：checklist_write / get_writing_guide / read_module / generate_slot / write_to_slot） |
| `src/lib/l2/agent.ts` | Agent 执行循环 |
| `src/api/write/elf_chat.ts` | API 端点，组装一切 |

### 关于工具内部的函数调用方式

之前在 `tools.ts:123` 看到 `new Request("https://internal/...")` ，我当时标注为 "高风险"。仔细看完代码后确认：**这不是真正的 HTTP 请求，只是构造一个假的 Request 对象传给 handler 函数**。实际调用链是：

```
tools.ts: createReadModuleTool()
  → import { getModule } from '../../api/write/module'
  → const req = new Request("https://internal/...")  // ← 假对象，填 Request 接口
  → const response = await getModule(env, req, moduleId)  // ← 直接函数调用，零网络
```

`getModule()` 是 API handler，签名要求 `(env, Request)` ，所以需要一个 Request 对象。`https://internal` 只是占位符，永远不会发起 HTTP。`write_to_slot` 同理，直接调用 `updateModule()`。**没有风险。**

---

## 一、验证总览

```
第一步：前置检查 —— 确认 L0 工具调用能跑通
  ↓
第二步：System Prompt 逐层验证（5 层）
  ↓
第三步：工具逐个验证（含新增 get_writing_guide）
  ↓
第四步：Agent 循环集成（简单 → 复杂）
  ↓
第五步：缓存命中率验证
  ↓
第六步：边界情况
```

---

## 二、新增工具：get_writing_guide ✅ 已实现

> **实现日期**：2026-06-01
>
> **实现文件**：[`src/lib/l2/guides.ts`](../src/lib/l2/guides.ts)（指南内容） + [`src/lib/l2/tools.ts`](../src/lib/l2/tools.ts)（工具注册）
>
> **设计原则**：System Prompt 中已有基础认知（上下文包 + 参考案例），`get_writing_guide` 是"再次强调"——通过工具调用的就近原则，让 LLM 在操作某个模块之前获得精确的写作规范。

### 2.1 工具设计

**工具名**：`get_writing_guide`

**参数**：`module_type`（`m0` ~ `m6_chapter`，共 8 个值）

**返回**：两部分组成：
1. **文字指导**：200-500 字的模块写作指南（定位、写作要点、特殊规则、与其他模块的关系）
2. **模板结构**：如果该模块有 TemplateDef，附上完整的模板 JSON（含所有 slot 的 id/label/hint）

**典型调用流程**：

```
用户: "帮我为主角写一张人物卡"
  → LLM: tool_call get_writing_guide("m3_card")     ← 就近原则：先查怎么对待人物卡
    → 返回: 文字指导（一个角色一张卡、模板字段、写作要点）
            + 模板结构 JSON（姓名/身份/性格特质/外貌/动机/能力边界/成长弧线/关系网）
  → LLM: tool_call read_module("m3_card")            ← 再看当前内容
    → 返回: (当前人物卡内容)
  → LLM: tool_call generate_slot("m3_card", ...)      ← 基于 guide + 现状 → 生成
  → LLM: tool_call write_to_slot(...)
```

### 2.2 实现概要

| 文件 | 新增/修改 | 说明 |
|------|----------|------|
| `src/lib/l2/guides.ts` | **新增** | 8 个模块的文字指导 + `renderTemplateStructure()` 渲染模板 JSON |
| `src/lib/l2/tools.ts` | 修改 | 导入 `getModuleGuide`，新增 `createWritingGuideTool()`，工具从 4 个增加到 5 个 |

**guides.ts 中 8 个模块的文字指导覆盖**：

| module_type | 核心要点 |
|-------------|---------|
| `m0` | 作者的"种子"，**禁止直接修改**，只能讨论和建议 |
| `m1` | 最高约束文档，所有 M2-M6 必须遵循 |
| `m2` | 作品骨架，三幕结构 + 节奏 + 支线规划 |
| `m3_card` | **一个角色一张卡**，强调功能 > 属性 |
| `m4_strategy` | 伏笔总体规划，每部作品一张策略表 |
| `m4_card` | **一个伏笔一张卡**，埋种→强化→揭示→回收四阶段 |
| `m5_intent` | **一章一张卡**，创作意图声明而非章纲 |
| `m6_chapter` | 自由文本，参考 M5 意图卡 + M1 风格指南 |

---

## 三、第一步：前置检查

### 1.1 L0 工具调用冒烟

**目的**：确认 `callAI()` 的 `tools`/`tool_choice` 参数传递正确，DeepSeek 能返回 `tool_calls`。

**发什么**：
```
POST /api/write/elf/chat
{
  "work_id": "<镜中棋局 work_id>",
  "page": "write",
  "messages": [
    {"role": "user", "content": "帮我读一下当前的 M1 世界观设定"}
  ]
}
```

**看什么**：
- [ ] HTTP 200？
- [ ] `reply` 非空？
- [ ] `steps` 里有 `{"type": "tool_call", "tool": "read_module"}`？
- [ ] `steps` 里有 `{"type": "tool_result", "tool": "read_module"}`？
- [ ] `usage` 字段完整（input/output/cacheHit/cacheMiss）？

**可能的问题**：
- 如果 LLM 不调用工具（直接文字回复），可能是 tool description 不够清晰，或 DeepSeek 的 tool_choice 行为跟预期不同
- 如果报错，检查 `callAI()` 中 `tools` 参数的序列化、AI Gateway 转发

---

## 四、第二步：System Prompt 逐层验证

> **核心思路**：不直接看 system prompt 文本（API 不暴露），而是通过 **LLM 的行为** 反向推断每一层是否生效。

### 2.1 Layer 1 — 统一人格

**发什么**：
```
{"messages": [{"role": "user", "content": "你是谁？介绍一下自己"}]}
```

**看什么**：
- [ ] 回复中提到 "Story Elf" 或 "故事精灵"？
- [ ] 回复语气是鼓励的、建设性的？
- [ ] 提到了 "辅助创作" 或类似表述？

### 2.2 Layer 2 — 上下文包

**发什么**：
```
{"messages": [{"role": "user", "content": "我当前在写的作品叫什么名字？世界观的核心设定是什么？"}]}
```

**看什么**：
- [ ] 正确说出 "镜中棋局"（来自 `works` 表，不是编的）？
- [ ] 回复的世界观内容跟 R2 上「镜中棋局」的 M1 内容一致（不是幻觉）？

**交叉验证**：先用 `GET /api/write/module/m1_{work_id}?lang=zh` 看实际内容，再对比 LLM 回复。

### 2.3 Layer 3 — 参考案例库

**发什么**：
```
{"messages": [{"role": "user", "content": "我想写一部史诗奇幻。请参考《魔戒》的世界观框架分析方法，帮我构思力量体系应该包含哪些维度。"}]}
```

**看什么**：
- [ ] 回复中明确提到《魔戒》框架中的具体分析维度（如力量来源/代价/边界）？
- [ ] `usage.input` 显著大于无参考包的场景？（参考包 ~132K tokens）

### 2.4 Layer 4 — 工具说明

**发什么**：
```
{"messages": [{"role": "user", "content": "帮我看看我现在的大纲写了什么"}]}
```

**看什么**：
- [ ] LLM 调用了 `read_module`（而非凭空编造）？
- [ ] 调用的 `module_type` 正确（`"m2"`）？

### 2.5 Layer 5 — 记忆注入层

**当前实际状态**：有两部分：
1. **Checklist 恢复**（读取已实现，写入未实现）
2. **作品级记忆**（占位，L2.1 实现）

**验证点**（只验 checklist 读取）：
- [ ] 手动往 R2 放 `works/{work_id}/elf_checklist.json` → 发起对话 → LLM 回复中提到 "上次未完成的任务"

**结论**：Layer 5 标记为 ⚠️ 部分可用（读取有，写入缺），不影响后续验证。

---

## 五、第三步：工具逐个验证

### 3.1 read_module

| # | 发什么 | 看什么 |
|---|--------|--------|
| 3.1a | "读一下我的 M1 世界观" | `tool_call` module_type=m1，返回内容跟 R2 一致 |
| 3.1b | "读一下我的 M2 大纲" | `tool_call` module_type=m2，返回内容跟 R2 一致 |

### 3.2 get_writing_guide（新工具）

| # | 发什么 | 看什么 |
|---|--------|--------|
| 3.2a | "帮我为主角写一张人物卡" | LLM 在 generate 之前调用了 `get_writing_guide("m3_card")` |
| 3.2b | "帮我写第 1 章的意图卡" | LLM 调用了 `get_writing_guide("m5_intent")`，理解了意图卡的字段结构 |
| 3.2c | "帮我修改 M0 原始构想" | LLM 调用了 `get_writing_guide("m0")` → 看到"禁止修改 M0" → 回复中告知作者无法修改 |

### 3.3 generate_slot

| # | 发什么 | 看什么 |
|---|--------|--------|
| 3.3a | "帮我为 M1 世界观的力量体系生成内容" | module_type=m1，生成内容结构对齐 M1 模板 |
| 3.3b | "帮我为主角生成人物卡" | module_type=m3_card，生成的人物卡有结构化字段 |
| 3.3c | "帮第 1 章生成意图卡" | module_type=m5_intent，包含推进冲突/情绪目标等字段 |

**通用检查**：
- [ ] 生成前是否先 read_module 了解现状？
- [ ] 如果有 `get_writing_guide`，生成前是否先调用？
- [ ] 生成内容是否有意义（非乱码/非空）？

### 3.4 write_to_slot

**验证点**：写→读闭环。

**怎么做**：引导 LLM 生成 → 写入 → 用 GET API 验证。

**看什么**：
- [ ] `write_to_slot` 返回 "✅ 已写入 N 个槽位"
- [ ] `GET /api/write/module/...` 确认内容已持久化
- [ ] 版本历史新增记录

### 3.5 M0 保护（双重验证）

有了 `get_writing_guide("m0")` 后，M0 保护有两个层面：

| 层 | 机制 | 验证 |
|----|------|------|
| 指南层 | `get_writing_guide("m0")` 告知 LLM "M0 不可修改" | LLM 看到指南后主动拒绝 |
| 代码层 | `write_to_slot` 的 if 判断拦截 | 即使 LLM 尝试，也返回错误 |

两个层面都验证通过才打勾。

### 3.6 checklist_write

| # | 发什么 | 看什么 |
|---|--------|--------|
| 3.6a | "帮我做三件事：优化世界观、检查大纲、写人物卡。先列个计划" | `tool_call(checklist_write)`，返回清单含 3 项 |

---

## 六、第四步：Agent 循环集成验证

> 从简单到复杂，验证 Agent 循环的完整行为。

### 4.1 零工具 —— 纯对话

**发什么**："你好！今天写东西有点卡住了，能给一些通用的创作建议吗？"

**看什么**：
- [ ] 直接返回 `done`，`steps` 中无 `tool_call`
- [ ] 回复有建设性，符合 Layer 1 人格

### 4.2 单工具 —— 读后即回

**发什么**："帮我看看「镜中棋局」目前写了什么世界观设定"

**看什么**：
- [ ] steps 序列：`tool_call(read_module)` → `tool_result` → `done`
- [ ] 回复基于真实内容

### 4.3 双工具 —— 读取 → 生成

**发什么**："先读一下我的世界观，然后帮我优化力量体系这个槽位"

**看什么**：
- [ ] steps：`read_module` → `generate_slot` → `done`
- [ ] generate_slot 的 instructions 包含 "力量体系"

### 4.4 三工具完整链路 —— 读取 → 生成 → 写入

**发什么**："帮我优化世界观的力量体系部分，然后保存"

**看什么**：
- [ ] steps：`read_module` → `generate_slot` → `write_to_slot` → `done`
- [ ] 写入后 GET API 验证内容持久化

### 4.5 理想完整链路 —— 查指南 → 读取 → 生成 → 写入

**发什么**（在 get_writing_guide 实现后）："帮我为主角写一张人物卡并保存"

**看什么**：
- [ ] steps：`get_writing_guide("m3_card")` → `read_module` → `generate_slot` → `write_to_slot` → `done`
- [ ] 生成的人物卡结构对齐指南中的模板字段

### 4.6 复杂场景 —— checklist 驱动多步任务

**发什么**："帮我完成三件事：1) 检查世界观是否完整 2) 优化大纲结构 3) 为主角写一张人物卡"

**看什么**：
- [ ] LLM 先创建 checklist
- [ ] 每个子任务有对应工具调用
- [ ] 最终回复覆盖全部 3 个任务

### 4.7 迭代上限保护

**验证点**：达到 maxIterations（默认 30）后不挂死。

**怎么做**：给一个需要很多步骤的任务（如 "检查 M1-M5 所有模块的完整性"）。

**看什么**：
- [ ] 请求最终返回（不超时）
- [ ] 达到上限时 LLM 被要求总结

---

## 七、第五步：缓存命中率验证

### 5.1 同作品连续请求

**怎么做**：同一作品连续发 2 个请求。

```
请求 1: "帮我看看世界观"
请求 2: "那大纲呢？"
```

**看什么**：
- [ ] 请求 1：`cacheHit` 可能为 0（冷启动）
- [ ] 请求 2：`cacheHit` 显著增加（system prompt 前缀命中）

### 5.2 动态信息不进 system prompt（代码审查）

**看代码**：[agent.ts:69-81](../src/lib/l2/agent.ts#L69-L81)

- [ ] `buildAgentSystemPrompt()` 不接收 `contextModule`/`contextSectionTitle` 参数
- [ ] 动态信息在 `agentLoop()` 中追加到 user message 前缀，而非 system prompt

---

## 八、第六步：边界情况

### 6.1 空作品

对无内容的新作品发请求 → 应引导作者先创建基础设定，而非崩溃。

### 6.2 错误 work_id

不存在的 work_id → 返回 404。

---

## 九、已知待实现项（不影响当前验证）

| 功能 | 设计文档 | 代码现状 | 计划 |
|------|---------|---------|------|
| L1 会话日志存储 | §3.5.2 | ❌ | L2.1 |
| L2 作品级记忆读写 | §3.5.3 | ❌ 占位 | L2.1 |
| L3 用户画像 | §3.5.4 | ❌ | Phase 4 |
| 记忆提取器 | §3.5.5 | ❌ | L2.1+ |
| Checklist 会话结束自动保存 | §4.3 | ⚠️ 读取有，写入无 | L2.0 修复 |
| 订阅配额检查 | §3.6 | ❌ | L2.1 |
| SSE 流式推送 | §3.7 | ❌ | L2.1 |

---

## 十、版本历史

| 版本 | 日期 | 说明 |
|------|------|------|
| v1.2.0 | 2026-06-01 | `get_writing_guide` 工具实现完成（`guides.ts` + `tools.ts`）；工具从 4 个增加到 5 个 |
| v1.1.0 | 2026-06-01 | 测试作品指定为「镜中棋局」；新增 `get_writing_guide` 工具设计（§二）；修正内部 URL 的误判（实际是直接函数调用）；M0 保护改为双重验证 |
| v1.0.0 | 2026-06-01 | 初版：6 步逐层验证计划 |
