# Memory Log 74KB 膨胀根因分析

## 数据来源

AI Gateway 捕获的 STM 提取请求（`deepseek-v4-flash`，74K tokens in）。

## 129,401 字符的组成

```
作者消息:        992 字符 ( 0.8%) — 31 条
Elf 消息:      3,758 字符 ( 2.9%) — 72 条（含重复）
工具调用:     84,989 字符 (65.7%) — 53 条 ← 🔴 罪魁祸首！
  ├─ write_to_slot: 29次, 78,387字符 (每次包含完整模块内容, 最长4,820字符)
  ├─ checklist_write: 10次, 4,624字符
  └─ read_module/get_writing_guide/get_version_*: 14次, 1,978字符
日期/结构标记: 39,662 字符 (30.7%)
```

## 重复消息

```
"你好！我是作者，请简单介绍一下你自己吧"         ×7 次
"[当前模块: original_concept]"                     ×10 次
Story Elf 长篇自我介绍 (~600字)                   ×7 次
Story Elf 长篇评估 "哇哇哇！一口气读完..." (~800字)  ×6 次
```

## 🔴 根因 #1：工具调用参数包含了完整模块内容（65.7%）

`formatDailyLogForExtraction` 会把工具调用的**完整参数 JSON** 写入日志：

```
_[调用了工具: write_to_slot({"module_type":"m1","slot_id":"world_power_system",
  "content":"# 力量体系\n\n## 核心设定\n...(数千字)..."})]_
```

29 次 `write_to_slot` 调用共 78,387 字符。这些内容已经存在 R2 模块里了，在记忆日志中重复存储毫无意义。

## 🔴 根因 #2：每次对话累积全部历史（72条 Elf 消息中 21 条重复）

`elf_chat.ts` 组装 L1 消息时：

```typescript
const l1Messages: Message[] = [
  ...allMessages.slice(0, -1),   // ← 前端传来的完整历史！
  { role: 'user', content: ... },
];
// + 本轮 tool_call/tool_result + agentFinal.reply
```

前端每次请求都发送完整对话历史 → L1 每轮都记录全部历史。
一天 8 轮对话 → 第 1 轮的消息被记录了 8 遍。

## 🔴 根因 #3：冗长回复原样记录

虽然 Elf 消息只占 2.9%，但包含 6 轮长篇评估（每轮 ~800-2000 字），这些评估性内容对记忆提取价值极低。

---

## 建议修复

### 优先级 1：截断工具调用参数

`formatDailyLogForExtraction` 中，对 `write_to_slot` 这类携带大量内容的工具：
```
之前: _[调用了工具: write_to_slot({完整参数})]_
改为: _[调用了工具: write_to_slot(module=m1, slot=world_power_system, content_len=2847)]_
```

### 优先级 2：L1 只记录增量

`elf_chat.ts` 中不应该把 `allMessages` 完整写入 L1，只记录本轮新增的用户消息和 Elf 本轮产出。

### 优先级 3：截断过长的 Elf 消息

超过 500 字符的 Elf 消息可截断为摘要（但这个是锦上添花，前两个修复已经能减少 90%+ 的体积）。
