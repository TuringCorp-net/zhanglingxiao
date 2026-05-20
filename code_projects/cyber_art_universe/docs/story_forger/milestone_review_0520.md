# Story Forger — Milestone Review Report 0520

> 本文档是 M0-M5 阶段改造完成后的全面 review 报告，涵盖文档一致性、代码与文档对照、数据完整性、前端实现四个维度。

## 一、Review 范围

| 维度 | 覆盖 |
|------|------|
| 文档一致性 | SRS / system_design / SDS / STR / frontend_design / original_concept 全部 6 份文档 |
| 后端代码 | `src/api/` 全部 Write 侧端点 + D1 表结构 + R2 存储路径 |
| 前端代码 | `write.html` / `write.js` / `write-api.js` / `style.css` / `i18n-data.js` / `story-elf.js` |
| 测试数据 | 镜中棋局 (aa489993) — 8 个 API 端点 + D1 实体 |
| 基础设施 | D1 schema、R2 路径、认证机制 |

---

## 二、Issues 总览

共发现 **4 个🔥高优先级**、**8 个⚠️中优先级**、**8 个💤低优先级** 问题。

---

## 三、🔥 高优先级（建议立即修复）

### 3.1 [FRONTEND] 拖拽排序后 UI 未刷新 — 缓存失效缺失

**位置**: `write.js:1062-1070`

章节拖拽排序成功后调用 `loadChapterCardList()`，该函数优先从 `cacheGet('outline')` 读缓存，但缓存未在 PUT 成功后清除，导致左面板显示的仍是旧顺序。

**修复**: 在 `hPut` 成功后、`loadChapterCardList()` 前加 `cacheClear(['outline'])`。

### 3.2 [FRONTEND] Pipeline 步骤未渲染状态

**位置**: `write.js:74-80`

`updatePipelineStatuses()` 只更新步骤的文字标签，未应用视觉差异（颜色/图标）。已完成、进行中、待开始的步骤外观完全一致，用户无法从 Pipeline 条判断哪些模块已完成。

**修复**: 在 `updatePipelineStatuses()` 中根据 status 值（done/in_progress/empty）给 `.pipeline-step` 添加 CSS class，如 `data-status="done"` 并用 CSS 着色。

### 3.3 [DOC] SDS 和 STR 严重过时（v1.7.0，滞后 11 天）

**位置**: `SDS.md`、`STR.md`

两文档停留在 2026-05-09 的 v1.7.0，缺失以下关键更新：
- M0 原始构想模块
- Story Elf 浮动伴侣
- 多语言 `?lang=` 架构
- 槽位编辑器（三标记格式）
- 左活页夹去除（Pipeline + 两栏布局）
- M4 伏笔统一存储架构
- ADMIN_TOKEN 独立 Secret

**修复**: 更新 SDS 至当前代码状态，更新 STR 至涵盖所有新功能。或标注为"待更新"并在下次文档工作周期中处理。

### 3.4 [DOC] system_design §10.8 槽位格式描述与实际不一致

**位置**: `system_design.md:1180` vs 所有模板代码

§10.8 描述槽位格式为 `<!-- slot:提示文字 -->...<!-- /slot -->`（双标记），但 **所有实际模板代码** 使用三标记格式 `<!-- hint:提示 --><!-- slot -->...<!-- /slot -->`。文档会误导新开发者。

**修复**: 更新 §10.8 的描述为三标记格式，与代码一致。

---

## 四、⚠️ 中优先级（建议本里程碑修复）

### 4.1 [CODE] M5 Intent Card 格式不一致

**位置**: `system_design.md:575-616` vs `draft.ts:80-97` vs `write.js:639-709`

三个地方描述了三种不同的 intent 格式：

| 字段 | system_design | draft.ts 后端 | write.js 前端表单 |
|------|-------------|-------------|-----------------|
| goal | 嵌套对象 `{advance_conflict, reveal_info, create_suspense}` | 平铺 string | 单个 textarea |
| structure | 嵌套对象 `{opening_hook, reversal_point, cliffhanger}` | 无 | 无 |
| foreshadowing_triggered | `[{hook_id, action}]` | `foreshadowing_ids` (string[]) | 逗号分隔 input |
| promise_checklist_refs | string[] | 无 | 无 |
| characters_involved | string[] | 无 | 无 |
| estimated_words | number | 无 | 无 |

**建议**: 如果当前简化版能满足创作需求，则更新 system_design 的 M5 schema 为简化版（平铺 goal、foreshadowing_ids 等）。如果未来需要完整 schema，则在前端和后端补齐缺失字段。

### 4.2 [SRS] 模块编号冲突

**位置**: `SRS.md:117-229`

SRS 将世界观标记为"模块二"、长篇框架为"模块三"，但 system_design 中 M1=世界观、M2=长篇框架。编号始终差 1，跨文档引用时极易混淆。

**修复**: 将 SRS 的"模块二→模块一"、"模块三→模块二"以对应 M1/M2，或统一在 SRS 开头注明模块编号对应关系。

### 4.3 [SRS] 僵尸端点

**位置**: `SRS.md:295`

`POST /api/write/outline/{work_id}/conflicts`（SF-024）仍在 API 表中，但 SF-024 在 v1.4.0 已标记删除。存在僵尸引用。

**修复**: 从 SRS API 表中删除该行。

### 4.4 [FRONTEND] Story Elf 硬编码中文字符串

**位置**: `story-elf.js:54,196,208,231`

发送按钮、错误提示、placeholder 均为硬编码中文，未使用 `t()` i18n 函数。语言切换时 Elf 不会跟随翻译。

**修复**: 将硬编码字符串替换为 `t()` 调用，在 `i18n-data.js` 中补充对应的英文字段。

### 4.5 [DOC] M1/M2 左面板渲染行为与设计不符

**位置**: `system_design.md:951-953` vs `write.js:772,796`

System_design §六 描述左面板应该渲染"框架全文"（只读参考），但实际实现显示的是轮换提示（写作建议）。两者功能性不同——渲染框架更有助于作者在编辑时参考结构。

**修复**: 确认产品意图后统一。如果是轮换提示更合适，则更新文档。如果是框架渲染更合适，则修改前端。

### 4.6 [DOC] SRS R2 路径图缺少 `{lang}/` 前缀

**位置**: `SRS.md:245-261`

SRS 的 R2 存储结构图展示了 `works/{work_id}/world_bible.md` 等路径，没有 `{lang}/` 子目录。但 SF-016 明确规定 R2 按语言前缀分目录，所有 API 通过 `?lang=` 参数指定语言。

**修复**: 更新 SRS R2 路径图加入 `{lang}/` 段。

### 4.7 [CODE] hints API 未文档化

**位置**: `hints.ts` → 未在任何设计文档中提及

`GET /api/write/hints/{module}?work_id=xxx` 是一个完整可用的端点，提供写作提示轮换数据，前端 M0-M6 左面板都依赖它，但不在任何设计文档中。

**修复**: 在 system_design.md 或 SRS 中补充 hints API 的文档。

### 4.8 [DOC] frontend_design Pipeline 示例缺少 M0

**位置**: `frontend_design.md:110-117`

Pipeline Guide 的可视化示例从 M1 开始（缺少 M0），但其步骤表 (§4.4) 包含 M0 的完整定义。

**修复**: 更新可视化示例，加入 M0 步骤。

---

## 五、💤 低优先级（可延后处理）

### 5.1 [CSS] ~620 行死代码（旧 binder 布局残余）

**位置**: `style.css:428-1048`

大量旧 binder 布局样式未曾清理：`.binder-panel`、`.writing-desk`、`.writing-area`、`.writing-preview`、`.chat-messages` 等。其中 Story Elf 样式在 CSS 和 JS 中各有一份（双份维护），且 CSS 版从未生效（JS 版注入内联样式）。

**修复**: 集中清理死 CSS，预计可删减 50%+ 的 CSS 文件体积。

### 5.2 [CSS] `.chapter-filters` / `.chapter-filter-btn` 重复定义

**位置**: `style.css:467-470` 和 `style.css:951-963`

同一组规则在文件中出现了两次，值略有差异（padding/border-radius）。

**修复**: 保留一份，删除重复。

### 5.3 [HTML] `#tmpl-fh-card-item` 模板未被使用

**位置**: `write.html:74-79`

HTML 中定义了 `#tmpl-fh-card-item` 模板，但 `renderFhCardList()` 实际使用 `#tmpl-entity-card-item`（与人物卡统一后）。死模板。

**修复**: 删除 `write.html` 中的 `#tmpl-fh-card-item`。

### 5.4 [FRONTEND] `renderFhCardList` 未使用实体缓存

**位置**: `write.js:889`

直接调用 `hGet('/api/content/.../entities')`，未使用 `refreshPipelineGuide()` 中已获取的 `cacheGet('entities')`。造成多余的 API 请求。

**修复**: 优先从缓存读取。

### 5.5 [I18N] `m0.hint` 和 `m0.placeholder` 未使用

**位置**: `i18n-data.js:141-146`

两个 i18n key 被 `index.html` 使用，但在 write 页面从未引用。

**状态**: 无需修改代码；仅标注为已知。

### 5.6 [DB] schema.ts status 注释过时

**位置**: `schema.ts:15`

注释写 `// ongoing / completed / draft`，实际有效值为 `draft / published / closed`。

**修复**: 更正注释。

### 5.7 [DOC] CAU system_design R2 路径缺 `{lang}`

**位置**: `docs/system_design.md:62-79`

CAU Read 侧的 R2 路径图没有 `{lang}/` 前缀，与 SF-016 多语言架构不一致。

**修复**: 更新路径图。

### 5.8 [DOC] entity type `foreshadowing` 未列入设计文档

**位置**: `src/api/write/entities.ts:495`

entities 表支持 `type='foreshadowing'`（用于 M4 伏笔条目），但所有设计文档中 entity 类型枚举未包含此项。

**修复**: 更新 SRS/SDS 中 entities 类型的枚举值。

---

## 六、已验证正确的部分

以下方面经交叉验证确认无问题：

- ✅ **M0-M4 槽位模板格式**：所有 R2 内容使用正确的三标记格式（`<!-- hint -->` + `<!-- slot -->` + `<!-- /slot -->`）
- ✅ **### 标题层级**：所有模块的字段标题均为 `###`，无 `**粗体**` 充当标题
- ✅ **API 端点完整性**：8/8 API 全部返回 `ok: true`
- ✅ **测试数据完整性**：9 个实体（6 角色 + 3 伏笔），10 个章节
- ✅ **认证机制**：ADMIN_TOKEN / USER_TOKEN 双 Secret 独立校验，工作正常
- ✅ **保存逻辑**：M0-M6 全部模块覆盖，无遗漏
- ✅ **多语言路由**：所有 Write API 正确传递 `?lang=` 参数
- ✅ **统一架构**：M3/M4/M5 统一使用 D1 entities + R2 独立文件的模式
- ✅ **自由编辑区**：M3/M4 模板均包含 `---` + 自由编辑区
- ✅ **CSS field-sizing**：textarea 自适应高度正常工作，JS auto-grow 已移除
- ✅ **Pipeline 引导条**：7 步全部渲染，点击跳转正确
- ✅ **i18n 键完整性**：write.js 引用的所有 i18n key 在 i18n-data.js 中均有定义

---

## 七、建议修复优先级

| 优先级 | Issue | 预估工时 |
|--------|-------|---------|
| 🔥 1 | 拖拽排序缓存失效 (3.1) | 5 分钟 |
| 🔥 2 | Pipeline 状态渲染 (3.2) | 20 分钟 |
| 🔥 3 | SDS/STR 更新或标注 (3.3) | 2 小时 |
| 🔥 4 | §10.8 槽位格式描述修正 (3.4) | 5 分钟 |
| ⚠️ 5 | M5 Intent 格式统一 (4.1) | 讨论后定 |
| ⚠️ 6 | SRS 模块编号修正 (4.2) | 30 分钟 |
| ⚠️ 7 | SRS 僵尸端点删除 (4.3) | 1 分钟 |
| ⚠️ 8 | Story Elf i18n (4.4) | 30 分钟 |
| ⚠️ 9 | M1/M2 左面板设计确认 (4.5) | 讨论后定 |
| ⚠️ 10 | SRS R2 路径加 lang (4.6) | 5 分钟 |
| ⚠️ 11 | hints API 文档化 (4.7) | 15 分钟 |
| ⚠️ 12 | frontend_design Pipeline 示例修正 (4.8) | 5 分钟 |
| 💤 13 | 死 CSS 清理 (5.1) | 1 小时 |
| 💤 14-18 | 其他低优先级 (5.2-5.8) | 1 小时 |

---

## 八、建议讨论项

1. **M5 Intent Card schema** — 设计文档中的完整嵌套结构 vs 当前简化平铺结构。是否需要补齐？还是简化设计即可满足需求？

2. **M1/M2 左面板内容** — 轮换提示 vs 渲染框架全文。当前提示提供写作建议，渲染框架则帮助参考结构。两者分别解决不同问题，取舍？

3. **SDS/STR 更新策略** — 完全重写到当前状态，还是标注"待更新"后在工作周期中逐步推进？

4. **CSS 清理时机** — 是否在本次里程碑中清理死 CSS，还是推迟到后续专门的重构周期？
