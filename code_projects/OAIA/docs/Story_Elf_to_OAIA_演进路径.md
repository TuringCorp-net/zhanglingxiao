# 从 Story Elf 到 OAIA — 演进路径与继承分析

> 版本: v1.0.0 | 最后更新: 2026-05-29
>
> 本文档记录 Story Elf（Cyber Art Universe 的 AI Agent 层）与 OAIA（Organized Artificial Intelligence Agent）之间的技术继承关系、可复用能力、以及演进路径。
>
> Story Elf = 单 Agent 在特定领域（文学创作）中的完整验证
> OAIA = 多 Agent 协作的通用组织操作系统

---

## 一、总体关系

```
Story Elf（当前）                     OAIA（远期）
─────────────────────────────────────────────────────
单 Agent + 4 工具 + checklist       →   多 Agent 组织 + 技能库 + 宪法治理
文学创作专用                          →   通用领域（可插拔角色）
Cloudflare Workers 同步 HTTP         →   Workflows 异步事件驱动
单用户对话界面                        →   多 Agent 协作工作群
Agent 自管理进度（checklist）          →   组织级任务状态机（PDCA 闭环）
System Prompt 5 层分层               →   LTM/STM/WM 三级记忆治理
M0 保护 + 版本历史                    →   Agent Level + Skill Threshold 物理门禁
```

---

## 二、Story Elf 已验证的能力（OAIA 可直接复用）

### 2.1 基础设施层（100% 复用）

| 能力 | Story Elf 实现 | OAIA 如何使用 |
|------|---------------|-------------|
| **R2 持久文件存储** | slot/json/md/checklist 的读写 | OAIA 的"公司账本"（Ledger Store）——Snapshots/Proposals/Actions/Reviews 的持久存储 |
| **D1 结构化索引** | works/sections/modules 表的字段级 CRUD | OAIA 的任务状态索引——Agent 工牌、任务关系链（root_task_id/parent_task_id/round_no）、字段级 UPDATE 的防冲突写入 |
| **Cloudflare Workers 计算** | Agent 循环 + 工具执行 | OAIA 的 Agent 执行运行时（单 Worker 模式，非 Workflow） |
| **AI Gateway 模型调用** | DeepSeek V4 + BYOK + 重试 + 超时 | OAIA 的多模型抽象层——支持 provider 切换、故障回退，与 OAIA 架构第 3 条"底层大模型可随时更换"完全一致 |
| **KV 缓存** | 当前未使用，但绑定已配置 | OAIA 的非关键配置/prompt 缓存 |

### 2.2 Agent 核心能力（模式复用）

| 能力 | Story Elf 实现 | OAIA 如何演进 |
|------|---------------|-------------|
| **Agent 执行循环** | `agentLoop()` — while tool_calls: execute → append → continue | 每个 OAIA Agent 拥有相同的循环结构，只是工具集和 system prompt 不同 |
| **工具注册表** | `ToolRegistry` = `Map<string, {def, execute}>` | OAIA 的技能系统（Skill-Plus）——从简单的 `{name, execute}` 升级为 `{mcp.ts, SKILL.md, oaia_skills.md}` 三层结构 |
| **System Prompt 分层** | 5 层静态→动态排序（Persona → Context → Reference → Tools → Memory） | OAIA 的 LTM/STM/WM 注入机制——宪法（LTM）在系统 prompt 最前面、章程（STM）在中间、工作记忆（WM）指针在尾部 |
| **Checklist 持久化** | R2 `elf_checklist.json`，跨会话恢复 | OAIA 的任务状态机（pending → claimed → running → reviewing → done）和 round 链追踪 |
| **参考案例库** | 4 部经典作品框架分析，预加载到 system prompt | OAIA 的技能库渐进式加载（Progressive Disclosure）——首层元数据索引 → 按需读取深度文档 |

### 2.3 安全与可靠性（原则复用）

| 能力 | Story Elf 实现 | OAIA 如何演进 |
|------|---------------|-------------|
| **M0 保护（不可修改）** | `write_to_slot` 执行前硬编码检查 | OAIA 的"宪法不可由 Agent 修改"——同样的原则：框架层 runtime check，不依赖 prompt 约束 |
| **版本历史自动保存** | `updateModule()` 内部自动快照 | OAIA 的"变更可回滚"——每次内部变更 Action 记录版本号 |
| **配额限制** | `generate_slot` 执行前检查订阅 | OAIA 的预算/WIP/红线约束（Snapshot.constraints） |

---

## 三、Story Elf 缺失的能力（OAIA 需要新建）

### 3.1 多 Agent 协作

| 缺口 | 说明 | OAIA 设计方案 |
|------|------|-------------|
| **Agent 间通信** | Story Elf 是单 Agent，无通信需求 | OAIA 架构第 10 条：Workflow 内部内存邮箱 + R2 公共区 |
| **角色分工** | 只有一个"Story Elf"角色 | OAIA 第 15 条：Planner / Executor / Reviewer / Secretary / Auditor |
| **共识决策** | 无 | OAIA 架构第 4 条：STM 修改需"多方 Agent 讨论→多方 Agent 决策" |
| **任务分解与派发** | LLM 自己通过 checklist 管理 | OAIA 第 9 条：universal-workteam-Workflow + universal-Agent-Workflow 嵌套 |

### 3.2 组织级记忆治理

| 缺口 | 说明 | OAIA 设计方案 |
|------|------|-------------|
| **LTM 用户独有修改权** | Story Elf 的项目记忆 Agent 也可写 | OAIA 架构第 4-1 条：LTM 由用户为主完成，Agent 只读 |
| **STM 共识修改** | 无 | OAIA 架构第 4-2 条：Agent 修改 STM 前必须通过共识流程 |
| **WM → STM 沉淀** | 无 | OAIA 架构第 4-3 条：工作记忆定期保存到短期记忆 |
| **accountant 角色** | 无 | OAIA 组织结构设想：记账员（State Clerk）负责结构校验 + 落盘 + 切片分发 |

### 3.3 事件驱动的异步架构

| 缺口 | 说明 | OAIA 设计方案 |
|------|------|-------------|
| **同步 HTTP → 异步 Workflow** | Story Elf 是请求→响应模型 | OAIA 架构第 12 条：IM Server DO + Fire-and-Forget + Workflow 挂起/唤醒 |
| **WebSocket 推送** | 无 | OAIA 架构第 7-1 条：自建 Web IM Server（Durable Objects + WebSocket） |
| **长时间执行保障** | 受 Worker 时间限制 | OAIA 架构第 9 条：Workflow waiting 态不消耗 CPU，天然支持几小时执行 |

### 3.4 技能系统

| 缺口 | 说明 | OAIA 设计方案 |
|------|------|-------------|
| **技能三层结构** | Story Elf 的工具是扁平的 `{name, description, execute}` | OAIA 架构第 13 条：Skill-Plus = `mcp.ts` + `SKILL.md`（只读）+ `oaia_skills.md`（可读写） |
| **技能审批上架** | 无 | OAIA 架构第 8 条：批准类 skill 需 CEO Meeting 决策通过 |
| **渐进式加载** | 参考案例全量预加载 | OAIA 架构第 13 条：首层索引 → Agent 按需拉取深度文档 |

### 3.5 安全模型升级

| 缺口 | 说明 | OAIA 设计方案 |
|------|------|-------------|
| **Agent Level（不可篡改工牌）** | Story Elf 只有一个隐式的"完全信任"级别 | OAIA 架构第 11 条：运行时物理硬编码 Agent Level，大模型无法修改 |
| **Skill Threshold（工具门禁）** | 只有简单的 M0 保护 | OAIA 架构第 11 条：双向核对——Agent Level < Skill Level → 物理切断调用 |
| **Prompt Injection 防御** | 无专门机制 | OAIA 架构第 11 条：安全不依赖大模型"有多乖"，依赖非 AI 仲裁防火墙 |

---

## 四、演进阶段

```
Phase 1 — Story Elf L2（当前）          Phase 2 — 单 Agent 通用化        Phase 3 — 多 Agent 组织        Phase 4 — OAIA
────────────────────────────────────────────────────────────────────────────────────────────────

✅ Agent 循环                            🟡 工具插件化                       🔴 Planner + Executor +          🔴 CAAS 完整闭环
✅ 工具注册表                            🟡 System Prompt 角色插槽化           Reviewer 三角色协作             🔴 宪法/章程/制度治理
✅ System Prompt 分层                    🟡 参考案例 → 通用技能库             🔴 Event-driven Workflow          🔴 技能库自进化
✅ Checklist 持久化                       🟡 M0 保护 → Agent Level            🔴 Agent 间通信邮箱               🔴 审计与演进组
✅ R2/D1/AI Gateway                                                           🔴 Consensus Decision
✅ 参考案例库预加载                                                             🔴 任务状态机 + round 链
                                                                               🔴 自适应复查
```

**每个 Phase 的关键验收标准**：

- **Phase 2**：同一个 Agent 循环，换上不同的 System Prompt 和工具集，能在另一个领域（比如营销文案）工作
- **Phase 3**：3 个 Agent（Planner/Executor/Reviewer）通过 Workflow + 事件协作完成一个多步骤任务，中间 Agent 可休眠/唤醒
- **Phase 4**：OAIA 最小闭环跑通——一个自运行的"分析→决策→执行→验收→记账→迭代"周期

---

## 五、关键技术债务（从 Story Elf 带到 OAIA 之前需要清理的）

| 债务 | 当前状态 | 影响 | 建议清理时机 |
|------|---------|------|------------|
| 工具定义与 API 端点耦合 | `tools.ts` 直接 import `getModule`/`updateModule` | 换一个领域，这些工具全废 | Phase 2 引入 ToolPlugin 接口 |
| 文学创作硬编码在 System Prompt | Persona 写死了"写作精灵" | 换角色需要改代码 | Phase 2 角色配置化 |
| 单 Worker 同步模型 | `agentLoop()` 在单个 HTTP 请求中完成 | 不支持几小时的长任务 | Phase 3 迁移到 Workflow |
| 隐式信任模型 | Agent 可以做任何工具调用 | 多 Agent 场景需要权限控制 | Phase 3 引入 Agent Level |
| `as any` 类型绕过 | 工具内部用合成 Request 调用 API | 技术债务累积 | Phase 2 改内部接口 |

---

## 六、一句话总结

**Story Elf 是 OAIA 的"单细胞验证"**——证明了 Agent 循环 + 工具调用 + 持久记忆 + 云端执行这个基础模型在单个领域中可以工作。OAIA 需要的是从"单细胞"进化到"多细胞组织"——新增多 Agent 协作、组织记忆治理、事件驱动架构、技能系统、和安全模型，每一项都是独立的工作量，但不需要重新发明存储层、模型调用层和 Agent 循环层。

---

## 七、版本历史

| 版本 | 日期 | 说明 |
|------|------|------|
| v1.0.0 | 2026-05-29 | 初始版本：Story Elf L2 → OAIA 的演进路径、继承清单、缺口分析、阶段规划 |
