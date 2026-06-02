# Cyber Art Universe — 端到端测试方案

## 关联文档

- [CAU SRS](../docs/cau/SRS.md) → [CAU SDS](../docs/cau/SDS.md) → [CAU STR](../docs/cau/STR.md)
- [Story Forger SRS](../docs/story_forger/SRS.md) → [Story Forger SDS](../docs/story_forger/SDS.md) → [Story Forger STR](../docs/story_forger/STR.md)
- [System Design](../docs/system_design.md)
- [L2 Agent 验证计划](../docs/story_elf/L2_agent_test.md)

## 测试目标

验证 CAU 的核心链路：**Story Forger 写作 → 发布 → CAU 人类阅读 → AI Agent API 抓取**，两端都能正确获取内容。

## 测试范围

### 人类阅读路径（浏览器 / curl 模拟）
1. Catalog 能搜索到已发布作品
2. 作品详情（metadata + summary）正确
3. Outline（章节列表）正确
4. Section 正文内容正确
5. Category（L1 分类）正确

### AI Agent 阅读路径（API 程序化）
1. `GET /api/catalog` → 能搜到作品
2. `GET /api/content/{id}` → metadata 完整
3. `GET /api/content/{id}/outline` → 章节列表可解析
4. `GET /api/content/{id}/sections/{sid}` → 正文 markdown 可读
5. `GET /llms.txt` → 作品入口可发现
6. `GET /.well-known/ai-manifest.json` → 资源声明正确

### L2 Agent Prompt 组装验证（零 LLM 成本）
通过 `debug:prompt` 端点拦截 System Prompt，逐模块 × 逐层验证组装正确性。

## 测试数据

测试用作品「镜中棋局」（`aa489993-1e7b-4804-b6af-723619b150b6`，fantasy，已发布），M0-M6 均有内容。

## 文件结构
```
tests/
├── README.md                  # 本文件
├── fixtures/                  # 测试数据（待补充）
├── human_test.sh              # 人类阅读路径验证脚本
├── agent_test.sh              # AI Agent 阅读路径验证脚本
└── system/                    # 系统级集成测试
    ├── README.md              # System test 约定
    ├── v3_module_api.sh       # V3/V4 Module API 闭环测试
    └── l2_prompt_verify.sh    # L2 Prompt 组装验证
```

## 验证脚本

### human_test.sh — 人类阅读路径
模拟浏览器行为，验证 HTML 页面 + API 返回：
1. 访问 `/browse.html?category=fantasy` → 应包含测试作品
2. `GET /api/catalog?category=fantasy` → 应返回测试作品
3. `GET /api/content/{work_id}` → metadata 完整
4. `GET /api/content/{work_id}/outline` → 3 章
5. `GET /api/content/{work_id}/sections/{sid}` → 正文非空

### agent_test.sh — AI Agent 阅读路径
模拟 AI Agent 通过 API 发现和阅读内容：
1. `GET /llms.txt` → 包含作品入口
2. `GET /.well-known/ai-manifest.json` → 资源声明
3. `GET /api/catalog?status=published` → 可发现已发布作品
4. `GET /api/content/{work_id}` → JSON 元数据完整
5. `GET /api/content/{work_id}/outline` → 章节列表可解析
6. `GET /api/content/{work_id}/sections/{sid}?mode=full` → 正文完整

### system/l2_prompt_verify.sh — L2 Prompt 组装验证

**原理**：通过 `POST /api/write/elf/chat` 的 `debug:prompt` 模式，拦截发往 LLM 之前的
完整 messages 数组和 5 层 system prompt，零 LLM 调用成本。

**验证循环**：外层 M0-M6（8 个模块），内层 5 层 system prompt：

| 层 | 验证内容 | 方法 |
|----|---------|------|
| Layer 1 人格 | Story Elf 角色描述 + 作品信息 | 特征标记检查 + 8 模块跨对比 |
| Layer 2 上下文包 | M0-M5 完整内容 | 结构标题 + 内容指纹 + 8 模块跨对比 |
| Layer 3 参考案例库 | 4 部经典作品框架分析 | 特征标记检查 + 8 模块跨对比 |
| Layer 4 工具说明 | 5 个工具名称 + 顺序 | 工具名检查 + 顺序检查 + 8 模块跨对比 |
| Layer 5 记忆层 | L2.1 占位文字 | 占位检查 + 8 模块跨对比 |
| 动态信息隔离 | `[当前模块: X]` 注入位置 | prefix 验证 + system prompt 泄漏检查 |
| 层序 | Layer 1 < 2 < 3 < 4 < 5 | 位置关系验证 |

**运行**：
```bash
# 默认配置（镜中棋局）
./tests/system/l2_prompt_verify.sh

# 指定环境
BASE_URL=https://cau.turingcorp.net TOKEN=admin-TuringCorp-13572468 WORK_ID=aa489993-1e7b-4804-b6af-723619b150b6 ./tests/system/l2_prompt_verify.sh
```

**结果解读**：
- ✅ 85 项全部通过 = prompt 组装逻辑正确
- ❌ 某项失败 → 检查对应层的代码逻辑，修复后重新验证

## 运行方式

```bash
# 设置测试作品 ID
export TEST_WORK_ID="aa489993-1e7b-4804-b6af-723619b150b6"

# 运行人类路径验证
bash tests/human_test.sh

# 运行 Agent 路径验证
bash tests/agent_test.sh

# 运行 L2 Prompt 组装验证
bash tests/system/l2_prompt_verify.sh

# 运行 V3/V4 Module API 测试（需要 admin token）
TOKEN="admin-TuringCorp-13572468" ./tests/system/v3_module_api.sh
```

## 状态

- [x] 测试作品「镜中棋局」已创建并发布
- [x] human_test.sh 实现
- [x] agent_test.sh 实现
- [x] v3_module_api.sh 实现
- [x] l2_prompt_verify.sh 实现
- [x] L2 System Prompt 组装验证通过（85/85）
- [x] L2 工具调用冒烟验证通过
- [ ] 固化为 CI 测试用例
