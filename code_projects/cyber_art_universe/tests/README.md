# Cyber Art Universe — 端到端测试方案

## 关联文档

- [CAU SRS](../docs/cau/SRS.md) → [CAU SDS](../docs/cau/SDS.md) → [CAU STR](../docs/cau/STR.md)
- [Story Forger SRS](../docs/story_forger/SRS.md) → [Story Forger SDS](../docs/story_forger/SDS.md) → [Story Forger STR](../docs/story_forger/STR.md)
- [System Design](../docs/system_design.md)

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

## 测试数据

测试用小说由人类作者（用户）通过 Story Forger 创作，存放在 `tests/fixtures/` 下。

### 最小完整作品规格
- 标题 + 简介
- L1 分类（如 fantasy）
- 3 章正文（每章 ≥ 200 字）
- 状态：draft → published

### 文件结构
```
tests/
├── README.md                  # 本文件
├── fixtures/
│   └── test_novel.md          # 测试小说源数据（markdown）
├── human_test.sh              # 人类阅读路径验证脚本
└── agent_test.sh              # AI Agent 阅读路径验证脚本
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

## 运行方式

```bash
# 设置测试作品 ID（由用户创作后提供）
export TEST_WORK_ID="<work_id>"

# 运行人类路径验证
bash tests/human_test.sh

# 运行 Agent 路径验证
bash tests/agent_test.sh
```

## 状态

- [ ] 测试小说创作完成（待用户）
- [ ] 测试数据录入 fixtures/
- [ ] human_test.sh 实现
- [ ] agent_test.sh 实现
- [ ] 首次端到端验证通过
- [ ] 固化为 CI 测试用例
