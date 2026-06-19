# Cyber Art Universe — 自动化测试方案

## 关联文档

- [CAU SRS](../docs/cau/SRS.md) → [CAU SDS](../docs/cau/SDS.md) → [CAU STR](../docs/cau/STR.md)
- [Story Forger SRS](../docs/story_forger/SRS.md) → [Story Forger SDS](../docs/story_forger/SDS.md) → [Story Forger STR](../docs/story_forger/STR.md)
- [Story Elf System Design](../docs/story_elf/system_design.md) → [L2 Agent 设计](../docs/story_elf/L2_agent_design.md)
- [L2 Agent 验证计划](../docs/story_elf/L2_agent_test.md)

## 测试目标

验证 CAU 核心链路：**Story Forger 写作 → 发布 → CAU 阅读 → AI Agent 抓取**，以及 **Story Elf 永续对话 + System Prompt 组装**。

## 测试架构（两层）

```
Layer A — 离线验证（零 LLM 成本）         Layer B — 端到端验证（真实 LLM 调用）
├── system/l2_prompt_verify.sh  ~104 项   ├── generate_slot / write_to_slot
├── system/conversation_test.sh   8 项    ├── 多工具链 (read→generate→write)
├── system/v3_module_api.sh     ~20 项    ├── 多轮对话 + 历史传递
└── 通过 mock_reply 模拟 AI 回复          └── checklist_write 工具
    完整走永续对话持久化路径
```

Layer A 覆盖 90%+ 的结构性验证。Layer B 在 LLM 流程稳定后再实施。

### 专项测试（平时不跑）

| 脚本 | 说明 | 为何单独运行 |
|------|------|-------------|
| `memory_verify.sh` | Memory 系统端到端验证 | 会产生 LLM 成本 + 修改生产环境 R2 记忆数据 |
| `memory-eval` API | LLM-as-Judge 评估 8 个场景 | 真实 LLM token 成本，约 50K tokens/run |

## 文件结构

```
tests/
├── README.md                     # 本文件
├── run_all.sh                    # 一键运行全部测试
├── fixtures/                     # 测试数据（待补充）
├── human_test.sh                 # 人类阅读路径验证
├── agent_test.sh                 # AI Agent 阅读路径验证
└── system/
    ├── README.md                 # System test 约定
    ├── l2_prompt_verify.sh       # L2 Prompt 组装验证（~104 项，零 LLM 成本）
    ├── conversation_test.sh      # 永续对话验证（8 项，零 LLM 成本）
    ├── v3_module_api.sh          # V3/V4 Module API 闭环测试
    └── memory_verify.sh          # Memory 系统专项验证（⚠️ 产生LLM成本，平时不跑）
```

## 一键运行

```bash
# 全部测试（推荐）
bash tests/run_all.sh

# 指定环境
BASE_URL=https://cau.turingcorp.net TOKEN=admin-TuringCorp-13572468 WORK_ID=aa489993-1e7b-4804-b6af-723619b150b6 bash tests/run_all.sh
```

## 各测试套件说明

### run_all.sh — 统一入口

整合以下全部测试，输出汇总结果：

| 套件 | 项数 | LLM 成本 | 说明 |
|------|------|---------|------|
| `l2_prompt_verify.sh` | ~104 | 零 | System Prompt 5 层组装 + 动态信息隔离 + 层序 |
| `conversation_test.sh` | 8 | 零 | 永续对话/消息持久化/作品隔离/Read-Write 隔离 |
| `v3_module_api.sh` | ~20 | 零 | V3/V4 Module API CRUD + 版本/diff 闭环 |
| `human_test.sh` | 5 | 零 | 人类阅读路径（Catalog/Browse/Section） |
| `agent_test.sh` | 6 | 零 | AI Agent 阅读路径（Manifest/llms.txt/Catalog/Content） |

### system/l2_prompt_verify.sh — L2 Prompt 组装验证

通过 `debug:prompt` 端点拦截 System Prompt，逐模块 × 逐层验证组装正确性。外循环 Layer 1-5 + 动态隔离 + 层序，内循环 M0-M6（7 个模块：m0/m1/m2/m3_card/m4_card/m5_intent/m6_chapter）。

**Layer 2 上下文包卡片验证范围**：M3 人物卡 + M4 伏笔卡。M5 意图卡默认不组装到 Layer 2（`includeM5=false`），而是通过 user message prefix 按需注入当前选中章节的蓝图，减少上下文包体量。

**Layer 5 Memory**：仅检查记忆层存在性与跨模块一致性，不验证具体记忆内容（记忆内容由专项 `memory_verify.sh` 单独验证）。

### system/conversation_test.sh — 永续对话验证

通过 `mock_reply` 模拟 AI 回复，零 LLM 成本地验证永续对话流程：

| 步骤 | 验证内容 |
|------|---------|
| Step 1 | 无 session_id 的 Chat — mock 回复正常返回 |
| Step 2 | GET conversation — 返回持久化消息 |
| Step 3 | 多轮消息累积 — 对话历史增长 |
| Step 4 | Read/Write 隔离 — 不同 page 的对话独立 |
| Step 5 | Session 端点已移除 — 404 |
| Step 6 | 最小字段 Chat — 无多余字段可正常工作 |

### system/v3_module_api.sh — V3/V4 Module API 测试

6 步闭环：列出模块 → 按类型列出 → 验证响应格式 → PUT 写入 + GET 验证 → 清理 → V4 版本历史 + diff。

### human_test.sh / agent_test.sh — 阅读路径

验证人类浏览器路径和 AI Agent 路径能正确获取已发布作品的内容。

## 测试数据

测试作品「镜中棋局」（`aa489993-1e7b-4804-b6af-723619b150b6`，fantasy，已发布），M0-M6 均有内容（含 6 张人物卡 + 4 张伏笔卡）。

### 记忆测试数据

- Memory 专项测试使用持久 fixtures（`users/memory-test-001/`），通过 `POST /api/write/memory-test/setup` 创建
- 创建后需手动触发 `extract-l2` 和 `extract-l3` 完成记忆提取
- **仅在 Story Elf 记忆系统出现异常时运行**，详见 `tests/system/memory_verify.sh`

## 运行方式

```bash
# 全部测试
bash tests/run_all.sh

# 单独运行
bash tests/system/l2_prompt_verify.sh
bash tests/system/session_test.sh
bash tests/system/v3_module_api.sh
bash tests/human_test.sh
bash tests/agent_test.sh

# 指定环境变量
TOKEN="admin-TuringCorp-13572468" WORK_ID="aa489993-1e7b-4804-b6af-723619b150b6" bash tests/run_all.sh
```

## 状态

- [x] L2 System Prompt 组装验证通过（88/88）
- [x] V3/V4 Module API 测试通过（10/10）
- [x] Conversation 测试通过（8/8）
- [x] human_test.sh / agent_test.sh
- [x] `run_all.sh` 统一入口
- [ ] 固化为 CI 测试用例

---

### memory-eval — 记忆系统 LLM-as-Judge 评估（半生产环境）

通过真实 LLM 调用验证 4 大类记忆/压缩 prompt 的输出质量。由 Claude（评判 LLM）读取 DeepSeek 返回结果并逐项评审。

**⚠️ 此测试会产生真实 LLM token 成本，不纳入 `run_all.sh`，需手动触发。**

#### 测试场景（8 个子场景）

| 类别 | 子场景 | 验证目标 |
|------|--------|---------|
| `mosaic_light` | L1_normal（5轮中文对话） | 逐条压缩：格式、关键信息保留、压缩率 |
| | L2_tool_calls（含工具调用） | 逐条压缩：工具调用信号是否保留 |
| `mosaic_heavy` | H1_decisions（12轮决策） | 成对压缩：关键决策是否完整捕获 |
| | H2_repetitive（含重复内容） | 成对压缩：去重能力（重复偏好不重复记录） |
| `stm_merge` | S1_merge（新+旧STM） | STM合并：增量合并、去重、旧记忆保留、自然遗忘 |
| | S2_initial（纯新对话） | STM提取：初始记忆提取质量、模板遵循 |
| `ltm_merge` | T1_merge（跨作品+旧LTM） | LTM合并：跨作品模式识别、画像增量更新 |
| | T2_initial（纯新对话） | LTM提取：初始画像提炼、自然语言叙述质量 |

#### 运行方式

```bash
# 运行全部 8 个场景（约 60-90 秒，~50K tokens）
curl -s -X POST https://CAU.turingcorp.net/api/write/memory-test/eval \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer admin-TuringCorp-13572468' \
  -d '{"category": "all"}'

# 按类别运行
curl ... -d '{"category": "stm_merge"}'

# 按子场景运行
curl ... -d '{"scenarios": ["stm_merge/S1_merge", "ltm_merge/T1_merge"]}'

# 查看历史评估 run 列表
curl "https://CAU.turingcorp.net/api/write/memory-test/eval-results?run_id=xxx"

# 查看某次 run 的单个场景
curl "https://CAU.turingcorp.net/api/write/memory-test/eval-results?run_id=xxx&scenario=stm_merge/S1_merge"
```

#### 评判流程

评估端点返回每个场景的完整数据包（system prompt + user prompt + LLM 输出 + usage），由 Claude 作为评判 LLM 逐项检查：

1. **格式遵循**：输出是否符合 prompt 要求的 JSON/Markdown 格式？
2. **信息保真**：关键决策/偏好是否被完整保留？有没有遗漏？
3. **合并质量**（STM/LTM）：新旧信息是否自然融合？有没有重复或矛盾？
4. **去重/遗忘**（mosaic_heavy/STM）：重复内容是否被智能合并？旧信息是否自然淡化？
5. **叙述质量**（LTM）：画像是否使用自然语言描述而非列表化？

每次评判结果以表格形式呈现，标注 PASS / ⚠️ PASS（小瑕疵）/ ❌ FAIL。

#### 评判历史

| 日期 | Run ID | 结果 |
|------|--------|------|
| 2026-06-10 | `eval_2026-06-10T09-59-35` | 8/8 PASS，2 个小瑕疵（末尾消息偶发丢失、一条推断越界） |

---

## 待覆盖盲区（下一步验证计划）

> 以下为当前测试体系的已知盲区。这些验证需要真实 LLM 调用，待 L2 核心代码更成熟后再实施。

### 🔴 高优先级

| 盲区 | 说明 | 依赖 |
|------|------|------|
| `generate_slot` 工具 | 6 种模块类型各有不同的 prompt 构建路径，从未验证生成质量 | 各模块 prompt 模板定稿 |
| `write_to_slot` 工具 | 工具调用路径下的写入→持久化→版本历史闭环未验证 | generate_slot 先通过 |
| 多工具链（read→generate→write） | Agent 循环的核心价值场景，从未端到端跑过 | generate_slot + write_to_slot 先通过 |

### 🟡 中优先级

| 盲区 | 说明 | 依赖 |
|------|------|------|
| `get_writing_guide` 工具调用 | REST API 端点已验证，但 LLM 是否在合适时机主动调用——未验证 | 多工具链验证时顺带覆盖 |
| M0 保护 guardrail | `write_to_slot` 拒写 M0 的代码级保护是否生效，LLM 层是否通过 guide 主动避免 | 同上 |
| `checklist_write` 工具 | LLM 是否能正确创建和更新任务清单 | 复杂场景验证时覆盖 |

### 🟢 低优先级

| 盲区 | 说明 | 依赖 |
|------|------|------|
| Reader companion（Read 侧） | `reader_companion/system.md` 存在但从未调用验证 | Read 侧功能启动后 |
| 迭代上限保护 | maxIterations=30 后强制总结的逻辑 | 代码审查可覆盖 |
| 错误恢复 | 不存在的 work_id、空作品、格式错误请求 | 边界情况测试 |

### 验证策略说明

这是一个螺旋上升的过程：先打牢 prompt 组装 + Session 管理基础（Layer A），再逐步完善 Agent 行为验证（Layer B）。
