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
├── system/l2_prompt_verify.sh  121 项    ├── generate_slot / write_to_slot
└── system/conversation_test.sh  12 项    ├── 多工具链 (read→generate→write)
     └── 通过 mock_reply 模拟 AI 回复     ├── 多轮对话 + 历史传递
        完整走永续对话持久化路径            └── checklist_write 工具
```

Layer A 覆盖 90%+ 的结构性验证。Layer B 在 LLM 流程稳定后再实施。

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
    ├── l2_prompt_verify.sh       # L2 Prompt 组装验证（121 项，零 LLM 成本）
    └── conversation_test.sh      # 永续对话验证（12 项，零 LLM 成本）
    └── v3_module_api.sh          # V3/V4 Module API 闭环测试
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
| `l2_prompt_verify.sh` | 121 | 零 | System Prompt 5 层组装 + 动态信息隔离 + 层序 |
| `conversation_test.sh` | 12 | 零 | 永续对话/消息持久化/作品隔离/Read-Write 隔离 |
| `v3_module_api.sh` | ~20 | 零 | V3/V4 Module API CRUD + 版本/diff 闭环 |
| `human_test.sh` | 5 | 零 | 人类阅读路径（Catalog/Browse/Section） |
| `agent_test.sh` | 6 | 零 | AI Agent 阅读路径（Manifest/llms.txt/Catalog/Content） |

### system/l2_prompt_verify.sh — L2 Prompt 组装验证

通过 `debug:prompt` 端点拦截 System Prompt，逐模块 × 逐层验证组装正确性。外循环 Layer 1-5 + 动态隔离 + 层序，内循环 M0-M6（8 个模块）。

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

测试作品「镜中棋局」（`aa489993-1e7b-4804-b6af-723619b150b6`，fantasy，已发布），M0-M6 均有内容。

记忆测试使用持久 fixtures（`users/memory-test-001/`），通过 `POST /api/write/memory-test/setup` 上传。

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

- [x] L2 System Prompt 组装验证通过（121/121，含记忆层）
- [x] Session 管理验证通过（31/31，含 mock_reply 机制）
- [x] V3/V4 Module API 测试
- [x] human_test.sh / agent_test.sh
- [x] `run_all.sh` 统一入口
- [ ] 固化为 CI 测试用例

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
