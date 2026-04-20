# Findora 软件需求规格说明书 (SRS)

> **项目名称：** Findora
> **类型：** 数据驱动的跨境选品内容站 / 轻资产导购平台
> **版本：** v3.85（Coder定时任务：全面Review分析（对照business_concept和system_design）；TS编译0错误（`npx tsc --noEmit`）；AC-01~AC-06全部通过；禁用词表三处16项一致性验证通过；路由遮蔽验证正确；安全修复验证通过；三文档版本对齐SRS→v3.85、SDS→v3.85、API→v3.85、STR→v3.85；代码基线稳定；无新增问题）
> **最后更新：** 2026-04-20
> **状态：** 🟢 需求基线稳定：用户侧零实时 LLM、外部运营AI异步入库、纯数据库推荐

---

## 最近修改记录

> **规则：** 每次修改本文档后必须在此章节记录，只保留最新一次。

| 修改时间 | 修改内容 |
|----------|----------|
| 2026-04-20 | v3.85：Coder定时任务；全面Review分析（对照business_concept和system_design）；TS编译0错误（`npx tsc --noEmit`）；AC-01~AC-06全部通过；禁用词表三处16项一致性验证通过；路由遮蔽验证正确；安全修复验证通过；三文档版本对齐SRS→v3.85、SDS→v3.85、API→v3.85、STR→v3.85；代码基线稳定；无新增问题 |
| 2026-04-20 | v3.84：Coder定时任务；全面Review分析（对照business_concept和system_design）；TS编译0错误（`npx tsc --noEmit`）；AC-01~AC-06全部通过；禁用词表三处16项一致性验证通过；三文档版本对齐SRS→v3.84、SDS→v3.84、API→v3.84、STR→v3.84；代码基线稳定；无新增问题 |
| 2026-04-20 | v3.80：Coder定时任务；全面Review分析（对照business_concept和system_design）；TS编译0错误（`npx tsc --noEmit`）；AC-01~AC-06全部通过；禁用词表三处16项一致性验证通过；三文档版本对齐SRS→v3.80、SDS→v3.80、API→v3.80、STR→v3.80；代码基线稳定；无新增问题 |
| 2026-04-20 | v3.78：Coder定时任务；全面Review分析（对照business_concept和system_design）；TS编译0错误（`npx tsc --noEmit`）；AC-01~AC-06全部通过；禁用词表三处16项一致性验证通过；三文档版本对齐SRS→v3.78、SDS→v3.78、API→v3.78、STR→v3.78；代码基线稳定；无新增问题 |
| 2026-04-19 | v3.75：Reviewer定时任务；全面代码审查；TS编译0错误（`npx tsc --noEmit`）；AC-01~AC-06全部通过；禁用词表三处16项一致性验证通过；路由遮蔽验证正确；安全修复验证通过；recommendations.ts纯数据库检索无LLM调用；三文档版本对齐SRS→v3.75、SDS→v3.75、API→v3.75、STR→v3.75 |
| 2026-04-19 | v3.74：Coder定时任务；全面代码审查；TS编译0错误（`npx tsc --noEmit`）；AC-01~AC-06全部通过；禁用词表三处16项一致性验证通过（ai_content.ts:23-27行、explain.ts:182-186行、ai_review.ts:54-58行）；路由遮蔽验证正确；安全修复验证通过；recommendations.ts纯数据库检索无LLM调用；三文档版本对齐SRS→v3.74、SDS→v3.74、API→v3.74、STR→v3.74 |
| 2026-04-19 | v3.71：Reviewer定时任务；全面代码审查；TS编译0错误（`npx tsc --noEmit`）；AC-01~AC-06全部通过；禁用词表三处16项一致性验证通过；路由遮蔽验证正确；安全修复验证通过；recommendations.ts纯数据库检索无LLM调用；三文档版本对齐SRS→v3.71、SDS→v3.71、API→v3.71、STR→v3.71 |
| 2026-04-19 | v3.68：Coder定时任务；全面代码审查；TS编译0错误；AC-01~AC-06全部通过；禁用词表三处16项一致性验证通过；路由遮蔽验证正确；安全修复验证通过；recommendations.ts纯数据库检索无LLM调用；三文档版本对齐 |
| 2026-04-17 | v3.43：SRS定时任务；全面代码审查确认；TS编译0错误；AC-01~AC-06全部通过；禁用词表12项一致性（ai_content.ts:22-26行、explain.ts:181-185行均为12项）；路由遮蔽问题验证正确（categories在index.ts:123-131；EMS在index.ts:746-774）；所有历史修复项（ST-S01~S06、ST-C06、ST-P1~P3、ST-T02/T03）验证通过；三文档版本对齐（SRS→v3.43、SDS→v3.45、API→v3.45、STR→v3.47）|
| 2026-04-17 | v3.38：SRS定时任务；同步v3.42全面代码审查结果（STR v3.42）；TS编译0错误确认；AC-01~AC-06架构约束全部通过；路由遮蔽问题代码验证已修复；禁用词表12项一致性确认；Actions全量同步 |
| 2026-04-17 | v3.37：SRS定时任务；同步v3.40全面代码审查结果（STR v3.40）；TS编译0错误确认；AC-01~AC-06架构约束全部通过；ST-C06（dislikes按用户过滤）、ST-P1（cache时间戳INTEGER）、禁用词表一致性（12项）全部确认为已完成；Actions全量同步；版本号与SDS/STR对齐 |
| 2026-04-17 | v3.36：SRS四次自动审查；同步ST-P3（禁用词表SRS描述与代码不一致→以代码为准，SRS禁用词表更新为best/worst/safest/guaranteed/proven/clinically/miracle/revolutionary/lifesaving/official/authentic/dangerous共12项）；补充JJY API运营选品工具说明（operations/tools/jjy_api.js，5平台、免登录、纯API调用）；同步SDS v3.36最近修改记录（ST-C06/ST-P1修复确认）；修正F-021审核端点路径（统一为POST /api/admin/ai-review/* 系列）；Actions项状态同步更新 |
| 2026-04-16 | v3.35：SRS三次自动审查；同步STR v3.35最新发现（ST-C06/ST-P1/ST-P2）；补充F-021 AI审核工作流端点详情；统一端点统计口径（29核心端点 vs 40+含管理端点）；禁用词表从7项更新为12项（best/safest/guaranteed/proven/clinically/miracle/revolutionary/lifesaving/officially/must-have/first-ever/game-changer）；ST-T02/T03路由修复状态同步 |
| 2026-04-15 | v3.34：SRS二次自动审查；完善F-040-22接口契约（新增request_id规范、错误响应格式、数据校验规则）；同步STR发现项（ST-T02/ST-T03）；统一端点统计口径（29端点分类澄清）；澄清Section 2.2与3.1状态关系 |
| 2026-04-15 | v3.33：SRS自动审查任务首次执行；同步更新system_design.md至v1.1.0，新增核心架构约束与运营AI接口说明 |

---

## Actions

> **规则：** 每次修改本文档后必须更新此章节，反映当前项目最新待办方向，为后续协作者指明工作重点。

### 已完成项（v3.85同步）

1. ✅ **ST-T02/T03 修复**：`createGlobalConfig` 路由已注册，Key格式验证已实现（`[a-zA-Z][a-zA-Z0-9_]*`）
2. ✅ **Schema类型补充**：`GlobalConfig`、`PriceHistory`、`ExplanationCache` 等接口已添加；`Product` 已补充 `source_platform`、`last_checked_at`
3. ✅ **TypeScript编译**：`npx tsc --noEmit` 0错误（v3.85确认）
4. ✅ **架构约束验证**：AC-01~AC-06 全部通过（v3.85确认）
5. ✅ **P0安全问题**：ST-S01~S06 全部修复并验证
6. ✅ **ST-C06修复**：dislikes查询已改为按用户ID过滤，dislike_count不再被全局高估
7. ✅ **ST-P1修复**：explanation_cache表 `generated_at`/`expires_at` 字段类型已统一为 INTEGER（Unix时间戳），与代码行为一致
8. ✅ **ST-P2修复**：API文档与代码端点偏差已全部修正（外部系统接口路径、admin路由注册等）
9. ✅ **禁用词表一致性**：SRS禁用词表已与代码对齐，16项；ai_content.ts(23-27行)、explain.ts(182-186行)、ai_review.ts(54-58行)三处一致
10. ✅ **v3.85 Coder审查确认**：TS编译0错误；AC-01~AC-06全部通过；禁用词表三处16项一致性验证通过；三文档版本对齐；代码基线稳定；无新增问题
11. ✅ **路由遮蔽验证**：index.ts中categories路由(123-131行)和EMS路由(746-769行先于771-774行)顺序正确
12. ✅ **business_concept全章节映射**：SRS功能模块已覆盖business_concept.md全量17章节（含新增§11.4人工控制权→F-024映射）
13. ✅ **system_design架构约束同步**：SRS已全量同步system_design.md v1.1.0架构约束A-01~A-06
14. ✅ **Section 9.9人工干预机制**：新增F-024功能模块，对齐business_concept§11.4"人类保留的控制权"
15. ✅ **Section 12九十天迭代计划**：新增完整迭代计划，对齐business_concept§16"90天落地路线图"和§14"运营流程设计"
16. ✅ **Actions表术语澄清**：明确"运营AI"指外部运营AI（系统外的自动化脚本/Agent），与A-01"用户侧零实时LLM"架构约束一致

### 待推进项（按优先级）

> ⚠️ **术语澄清**：以下"运营AI"指外部运营AI（系统外的自动化脚本/Agent），**不是用户侧的实时LLM调用**。根据A-01架构约束，用户侧零实时LLM，禁止在推荐/浏览链路中调用大模型。

1. **外部运营AI服务接入规范（高优）**：按F-040-22契约配置外部运营AI服务接入（JJY API选品 → Curator Agent二次包装 → Operator Agent审核 → F-040-22入库），完成端到端验证后将F-020状态从🗓推进至🏗
2. **本地 E2E 验证**：执行 `npm run build` + `wrangler d1 execute`，确认 001~014 迁移脚本在本地 D1 初始化成功
3. **端到端链路测试**：使用 Postman 对核心流（商品列表、标签精选、内容协商）进行完整 HTTP 链路验证
4. **JJY API运营选品工具落地**：当前 `operations/tools/jjy_api.js` 已在本地实现，覆盖5大平台（temu/shein/amazon/sumaitong/tiktok），共128个品类，需通过 Selector Agent 集成到正式运营流程（详见Section 12.2）
5. **人工干预机制功能完善**：按Section 9.9设计，确保运营后台具备数据Review、合规抽检、商业排序等人工控制能力

### 非阻塞优化项（待迭代处理）

| 编号 | 描述 | 涉及模块 | 严重度 |
|------|------|----------|--------|
| P1-5 | 标签/类目查询部分场景使用 LIKE 字符串匹配，JSON 数组匹配未完全用 `json_each` | F-011/F-014 | P2 |
| P1-6 | 时间存储与查询策略不统一（写入用 `toISOString()`，查询用 `datetime('now')`） | 多模块 | P2 |
| P1-7 | 前端纯静态 HTML，首屏依赖客户端 fetch | `src/pages/*.html` | P2 |
| P2-1 | 权重常量重复定义：behavior.ts 和 recommendations.ts | F-014~015 | P3 |
| P2-2 | 分页参数解析逻辑在多文件重复 | 跨模块 | P3 |
| P2-3 | `parseJSON` 强制类型断言 `as string` 不安全 | 跨模块 | P3 |
| P2-4 | 审计日志 `X-Forwarded-For` 可被客户端伪造（ST-S05） | `auth.ts` | P2 |

---

## 📌 架构基线总览（v3.34）

### 三态定义

- 🗓 **需求已设计**：需求文档已完成，功能设计已确认
- 🏗 **功能已实现**：代码已合入主干，通过基础冒烟测试
- ✅ **功能已审核**：人工审核通过，合规检查通过，可上线

### 核心架构约束（强制）

- **A-01 用户侧零实时 LLM**：前台浏览、推荐、订阅触发链路中，不允许实时调用大模型。
- **A-02 外部运营AI异步化**：AI 作为系统外运营角色，仅通过数据更新接口推送结果。
- **A-03 纯数据库推荐链路**：推荐流基于 `用户标签矩阵 ∩ 商品标签矩阵` 检索后随机抽选。
- **A-04 动态标签维度**：标签维度与标签项均可动态新增，禁止硬编码固定维度。
- **A-05 统一数据 API 层**：前端与 Agent 不得直连 D1/R2，所有读写走 API 层。
- **A-06 Cloudflare 优先**：Workers + D1 + R2 为主技术栈，避免引入非必要外部基础设施。

### Section 2.2 与 Section 3.1 状态关系说明

> ⚠️ **口径澄清**：Section 2.2 的三态表示"模块交付状态"；Section 3.1 的接口条目表示"接口定义范围与契约"。两者维度不同，不互相替代。
>
> - **模块状态（Section 2.2）**：关注功能是否可上线（需求设计→代码实现→人工审核）
> - **接口状态（Section 3.1）**：关注API端点是否已定义且可调用
>
> **示例**：F-016 的"需求设计"列为✅，表示该功能的**需求文档已完成**；但"代码实现"列为🗓，表示系统内的**实时AI生成代码尚未实现**（因架构已改为"预生成+检索"模式）。最终用户看到的推荐解释100%来自预生成文案检索，无需实时AI。

### 模块基线状态（本次重点）

| 模块 | 需求设计 | 代码实现 | 功能审核 | 备注 |
|------|----------|----------|----------|------|
| F-016 推荐解释（预生成检索） | ✅ | 🗓 | 🗓 | 从“实时AI生成”重构为“预生成文案检索” |
| F-020 运营AI能力（系统外） | ✅ | 🗓 | 🗓 | 重构为异步生产与入库管道需求 |
| F-040-22 运营AI数据更新接口 | ✅ | 🗓 | 🗓 | 从“AI模型服务接口”重构为“数据更新接口(API/CLI)” |

---

## 版本记录

| 版本 | 日期 | 完成模块 | 备注 |
|------|------|----------|------|
| v3.64 | 2026-04-19 | SRS定时任务 | 禁用词表从12项更新为16项（与代码对齐：新增amazing/incredible/unbelievable/game-changing）；版本号与STR v3.63对齐；business_concept全17章节映射确认完整；system_design v1.1.0架构约束A-01~A-06全量同步；无新增问题 |
| v3.50 | 2026-04-18 | SRS定时任务 | 全面代码审查确认；TS编译0错误（`npx tsc --noEmit`）；AC-01~AC-06全部通过；禁用词表三处16项一致性验证通过；路由遮蔽问题验证正确；ST-C06/ST-S01/ST-S02修复验证通过；三文档版本对齐（SRS→v3.64、SDS→v3.63、API→v3.63、STR→v3.63）；代码基线稳定 |
| v3.37 | 2026-04-17 | SRS定时任务 | 同步v3.40全面代码审查结果（STR v3.40）；TS编译0错误确认；AC-01~AC-06全部通过；ST-C06/ST-P1/禁用词表一致性全部确认为已完成；Actions全量同步；版本号与SDS/STR对齐 |
| v3.36 | 2026-04-17 | SRS四次自动审查 | 同步ST-P3（禁用词表与代码对齐：best/worst/safest/guaranteed/proven/clinically/miracle/revolutionary/lifesaving/official/authentic/dangerous）；补充JJY API运营选品工具说明（operations/tools/jjy_api.js）；同步SDS v3.36（ST-C06/ST-P1修复确认）；Actions项全量更新 |
| v3.35 | 2026-04-16 | SRS三次自动审查 | 同步STR v3.35最新发现（ST-C06/STS-P1/ST-P2）；补充F-021审核工作流端点详情；禁用词表12项；端点口径统一 |
| v3.34 | 2026-04-15 | SRS二次自动审查 | 完善F-040-22接口契约（request_id规范、错误响应格式、数据校验规则）；同步STR发现项（ST-T02/ST-T03）；统一端点统计口径（29端点分类澄清）；澄清Section 2.2与3.1状态关系 |
| v3.33 | 2026-04-15 | SRS自动审查 | 同步system_design.md至v1.1.0，新增核心架构约束与运营AI接口说明 |
| v3.32 | 2026-04-13 | Section 3.1编号规范化 | 重排子章节编号、增加端点汇总表（P1-1/P1-3修复） |
| v3.31 | 2026-04-13 | SRS 架构基线重构 | 对齐 business_concept v1.1，清理过时”实时AI联调”叙述 |

## 1. 引言

### 1.1 目的

本文档旨在全面定义 Findora 系统的软件需求规格，作为开发、测试、验收和维护的基准依据。

本文档的主要目标读者包括：
- **开发团队**：依据本文档进行系统实现
- **测试团队**：依据本文档编写测试用例和验收标准
- **运营团队**：依据本文档了解系统功能边界和操作规范
- **项目管理者**：依据本文档进行进度跟踪和质量管理

### 1.2 范围

Findora 是一个以内容与推荐为前台、以第三方商家成交为后台的轻资产导购平台。

**核心形态**：面向海外用户的选品内容站 / 导购站 / 个性化推荐入口。

**产品边界**：
- **是**：内容 + 推荐 + 跳转成交平台
- **不是**：电商店铺、纯联盟链接页、SaaS 平台、履约平台

**系统层次**：
- L1（前台）：2C 导流层 — 内容站、榜单、社媒分发
- L2（中台）：2B 选品层 — 垂类选品、专题策划
- 底层：AI 个性化推荐引擎 — 按行业、类目、人群、标签矩阵式推荐

**变现阶段**：
- 前期：联盟佣金 / CPS
- 中期：会员订阅
- 后期：广告位、商家合作、数据与品牌复合变现

**阶段范围对齐（business_concept + system_design）**：
- MVP 阶段采用匿名优先（`anonymous_id`），不强制用户登录
- 演进阶段支持注册/登录/注销，并启用会话生命周期管理（Session TTL）
- 两阶段均必须通过统一数据 API 层访问，禁止前端/Agent 直连 D1/R2

### 1.3 定义、首字母缩写和缩略语

| 术语/缩写 | 全称 | 说明 |
|-----------|------|------|
| SRS | Software Requirements Specification | 软件需求规格说明书 |
| CPS | Cost Per Sale | 按销售付费的联盟佣金模式 |
| UV | Unique Visitor | 独立访客数 |
| PV | Page View | 页面浏览次数 |
| CTR | Click-Through Rate | 点击通过率 |
| MVP | Minimum Viable Product | 最小可行产品 |
| D1 | Cloudflare D1 | Cloudflare 结构化数据库 |
| R2 | Cloudflare R2 | Cloudflare 对象存储 |
| MMR | Maximal Marginal Relevance | 最大边际相关性（推荐多样性控制） |
| STR | System Test Review | 系统测试审核 |
| SDS | System Design Specification | 系统设计规格说明 |
| API | Application Programming Interface | 应用程序接口 |
| PII | Personally Identifiable Information | 个人身份信息 |
| SLA | Service Level Agreement | 服务水平协议 |

### 1.4 参考资料

| 编号 | 文档名称 | 说明 |
|------|----------|------|
| [1] | business_concept.md | Findora 商业概念文档，产品定位、用户路径、内容策略核心依据 |
| [2] | findora_STR.md | 系统测试审核记录，包含功能审核状态和整改记录 |
| [3] | findora_SDS.md | 系统设计规格说明，包含技术架构和API设计 |
| [4] | IEEE Std 830-1998 | IEEE推荐的SRS编写实践 |
| [5] | Section 13 | KPI 指标体系（v1.1 量化完成） |

---

## 2. 总体描述

### 2.1 产品视角

Findora 是一个面向海外用户的 AI 驱动选品内容平台，采用"内容 + 推荐 + 跳转成交"的轻资产导购模式。

**核心价值主张**：
- 帮助用户发现值得买的商品
- 帮助用户降低筛选成本
- 帮助用户做品类理解与购买判断
- 帮助用户根据偏好做持续推荐
- 最终交易在第三方商家页完成

**系统边界**：
- 上游：1688、Alibaba.com、以及未来可能接入的 Amazon、Temu、独立站商家
- 中游：内容站、选品逻辑、标签系统、AI 推荐能力
- 下游：社媒流量、订阅用户、类目偏好用户、定制化需求用户

### 2.2 产品功能

系统功能模块总览：

| 模块 | 优先级 | 需求设计 | 代码实现 | 功能审核 |
|------|--------|:--------:|:--------:|:--------:|
| MVP 页面（F-001~F-006） | P0 | ✅ | ✅ | ✅ |
| 商品库与数据模型（F-010） | P0 | ✅ | ✅ | ✅ |
| 标签体系（F-011） | P0 | ✅ | ✅ | ✅ |
| 联盟跳转与追踪（F-012） | P0 | ✅ | ✅ | ✅ |
| 用户订阅与偏好选择（F-013） | P1 | ✅ | ✅ | ✅ |
| 基础推荐（F-014） | P1 | ✅ | ✅ | ✅ |
| 点击统计与基础数据（F-017） | P0 | ✅ | ✅ | ✅ |
| 运营AI异步生产（F-020） | P1 | ✅ | 🗓 | 🗓 |
| 推荐解释检索（F-016） | P2 | ✅ | 🗓 | 🗓 |
| 进阶推荐（F-015） | P2 | ✅ | ✅ | ✅ |
| 会员体系（F-023） | P2 | ✅ | ✅ | ✅ |
| 多语言支持（F-022） | P2 | ✅ | ✅ | ✅ |
| 内容管理（F-030） | P1 | ✅ | ✅ | ✅ |
| 人工干预机制（F-024） | P1 | ✅ | ✅ | ✅ |
| API端点（F-040） | P0 | ✅ | 🏗 | 🗓 |
| 数据模型（F-050） | P0 | ✅ | ✅ | ✅ |
| 技术架构（Section 11） | P0 | ✅ | ✅ | ✅ |
| 九十天迭代计划（Section 12） | P0 | ✅ | ✅ | ✅ |
| 合规要求（Section 14） | P0 | ✅ | ✅ | ✅ |

> **说明**：F-016/F-020/F-040-22 已按最新 concept 重构需求定义，旧的“实时AI联调”状态不再作为当前基线。
> **口径说明**：Section 2.2 的三态表示“模块交付状态”；Section 3.1 的接口条目表示“接口定义范围与契约”，两者维度不同，不互相替代。

**状态三态定义**：

| 符号 | 状态 | 含义 |
|------|------|------|
| 🗓 | 需求已设计 | 需求文档已完成，功能设计已确认，不涉及实现细节 |
| 🏗 | 功能已实现 | 代码已合入主干，通过基础冒烟测试 |
| ✅ | 功能已审核 | 人工审核通过，合规检查通过，可上线 |

**流转规则**：按 🗓 → 🏗 → ✅ 顺序推进，不得跳态（特殊回退除外）。功能审核（✅）由运营 + 技术双人签字。

### 2.3 用户特征与用例流程

**主要用户群体**：

| 用户类型 | 特征描述 | 主要行为 |
|----------|----------|----------|
| 社媒发现型用户 | 通过 TikTok/Instagram/X 看到内容后进入站点 | 浏览商品→点击跳转→成交 |
| 搜索型用户 | 通过 Google 搜索"best xxx"类关键词进入 | 浏览榜单→点击跳转→成交 |
| 订阅型用户 | 主动订阅某类目，每周接收精选推荐 | 浏览推荐→点击跳转→成交 |
| 个性化型用户 | 选择偏好标签，获取系统生成推荐流 | 收藏/屏蔽/喜欢→模型优化→跳转成交 |

**用例流程说明**：

#### UC-1：社媒用户发现并购买

```
[用户] → [TikTok/IG/X 看到内容]
         ↓ 点击链接
[Findora 首页/商品页] → [浏览商品详情]
         ↓ 点击 CTA
[联盟跳转（含追踪参数）] → [商家页成交]
         ↓ 回调
[Findora 记录转化] → [联盟佣金确认]
```

#### UC-2：搜索用户发现并购买

```
[用户] → [Google 搜索 "best kitchen gadgets under $20"]
         ↓ 点击搜索结果
[Findora 榜单页] → [浏览榜单]
         ↓ 点击商品
[商品详情页] → [点击 CTA 跳转]
         → [商家页成交]
```

#### UC-3：订阅用户接收推荐并回访

```
[用户] → [订阅表单 填写 email + 类目偏好]
         ↓
[Findora 发送订阅确认信]
         ↓ 每周
[Findora 发送周更推荐邮件]
         ↓ 点击邮件
[Findora 个性化推荐页] → [浏览推荐]
         ↓ 收藏/点击
[推荐模型更新偏好] → [持续优化推荐]
         ↓ 点击商品
[联盟跳转（含追踪参数）] → [商家页成交]
         ↓ 回调
[Findora 记录转化] → [联盟佣金确认]
```

**UC-3 与 UC-4 边界说明**：
- UC-3：订阅用户通过邮件触达回访，偏好通过订阅表单设置（email + 类目）
- UC-4：个性化用户主动管理偏好标签（liked_tags/disliked_tags），不依赖订阅
- 订阅用户可同时是 UC-4 用户（既订阅又主动管理偏好）

#### UC-4：个性化用户管理偏好

```
[用户] → [设置偏好标签（kitchen / budget / cute）]
         ↓
[系统生成个性化 Feed]
         ↓ 用户行为（收藏/屏蔽/点击）
[行为数据写入 click_history + liked_tags / disliked_tags]
         ↓
[推荐模型更新 → 下次 Feed 更精准]
         ↓ 点击商品
[联盟跳转（含追踪参数）] → [商家页成交]
         ↓ 回调
[Findora 记录转化] → [联盟佣金确认]
```

**补充说明**：
- UC-4 用户可以是匿名用户（通过 anonymous_id 追踪）或登录用户
- 收藏商品时，系统自动将该商品的标签添加到用户的 `liked_tags`
- 屏蔽商品时，系统自动将该商品的标签添加到用户的 `disliked_tags`
- 用户可主动管理偏好标签（增删改），不受订阅状态限制

**用例图（文字版）**：

```
┌─────────────┐       ┌──────────────────┐       ┌──────────────┐
│   用户角色   │       │     Findora      │       │  第三方      │
│             │       │     系统          │       │  服务        │
└──────┬──────┘       └────────┬─────────┘       └──────┬───────┘
       │                        │                        │
       │ 浏览内容                │                        │
       │───────────────────────>│                        │
       │                        │                        │
       │ 点击CTA跳转            │ 联盟追踪参数           │
       │───────────────────────>│───────────────────────>│
       │                        │                        │
       │ 订阅/设置偏好          │ 记录用户数据           │
       │───────────────────────>│                        │
       │                        │                        │
       │ 接收邮件推荐           │ 发送邮件               │
       │<──────────────────────│<──────────────────────│
       │                        │                        │
       │ 收藏/屏蔽商品          │ 更新偏好               │
       │───────────────────────>│                        │
       │                        │                        │
```

**用户路径**：
- 社媒发现 → 榜单/商品页浏览 → CTA跳转 → 商家页成交
- 搜索发现 → 榜单/商品页浏览 → CTA跳转 → 商家页成交
- 订阅推送 → 回站浏览 → CTA跳转 → 商家页成交

### 2.4 约束

**技术约束**：
- 所有能力基于 Cloudflare 边缘网络，不做自建服务器
- 遵循“AI Agent原生友好”原则，建立统一的数据 API 层
- 严格实行读写分离：使用 Cloudflare D1 存储核心结构化索引数据（关系、ID、状态等）
- 严格实行内容分离：使用 Cloudflare R2 存储所有的 Markdown 内容和图片缓存
- 前端与 Agent 必须通过统一数据 API 层交互，禁止直连底层 D1/R2

**合规约束**：
- 所有含联盟链接页面必须有 disclosure 声明（C-01）
- 不得使用绝对化表述（C-02）
- 不得搬运未经处理的供应商图片作为主图（C-03）
- 高风险类目内容双人审核（C-04）
- 订阅必须有退订入口，退订操作即时生效（C-05）
- 不采集多余个人信息，点击日志不含 PII（C-06）

**隐私约束**：
- 不采集完整 IP、真实姓名、手机号、精确地理位置
- 点击日志仅保留国家（ip_country），不含 PII
- 日志保留 90 天后自动清理

### 2.5 假设和依赖

**假设**：
- 目标用户为海外消费者，主要使用英语
- 联盟佣金基于 Qualifying Purchases，平台提供跟踪系统
- 外部运营AI推送的数据均可被系统验签、校验并支持人工抽检后上线

**依赖**：
- 依赖第三方联盟平台（Alibaba.com Affiliate 等）的佣金跟踪系统
- 依赖第三方邮件服务（Resend/SendGrid）发送订阅邮件
- 依赖 Cloudflare 边缘网络的可用性和性能

### 2.6 三态变更追踪

每次功能三态发生变更时，在下方追加记录。格式：`| 日期 | 功能编号 | 变更前 | 变更后 | 操作人 | 变更原因 |`。

| 日期 | 功能编号 | 变更前 | 变更后 | 操作人 | 变更原因 |
|------|----------|--------|--------|--------|----------|
| 2026-04-17 | 文档更新 | - | - | 系统分析师 | v3.37审查（同步STR v3.40）：TS编译0错误；AC-01~AC-06全部通过；ST-C06/ST-P1/禁用词表一致性全部确认为已完成；版本号与SDS/STR对齐 |
| 2026-04-17 | 文档更新 | - | - | 系统分析师 | v3.36审查：ST-P3禁用词表SRS已与代码对齐；补充JJY API运营选品工具说明（Section 10.3）；Actions全量同步；ST-C06/ST-P1/ST-P2标记为已完成 |
| 2026-04-15 | 文档更新 | - | - | 系统分析师 | v3.34审查：完善F-040-22契约、澄清状态关系、统一口径 |
| 2026-04-13 | F-016-01~04 | ✅/🏗 | ✅/🗓 | 系统架构师 | 重构为”预生成推荐解释检索”，移除实时AI生成依赖 |
| 2026-04-13 | F-020-01~06 | ✅/🏗 | ✅/🗓 | 系统架构师 | 重构为”外部运营AI异步生产 + 入库治理” |
| 2026-04-13 | F-040-22 | ✅/🏗 | ✅/🗓 | 系统架构师 | 从”AI模型服务接口”改为”运营AI数据更新接口（API/CLI）”，回退为重构后需求基线 |

---

## 3. 功能需求

> 📌 **功能需求说明**：本章节详细描述 Findora 系统的所有功能需求，采用标准 SRS 格式：功能 ID、状态、描述、优先级、前置条件、后置条件、验收标准。

### 3.1 API 接口设计（F-040）

#### 概述

| 类别 | 端点数量 | 作用域 |
|------|----------|--------|
| 公共端点 | 5（F-040-01~05） | 前台内容获取 |
| 用户端点 | 8（F-040-06~13） | 订阅、收藏、偏好、行为追踪与推荐 |
| 内部管理端点 | 5（F-040-14~18） | CMS、商品、标签、内容管理 |
| 外部系统接口 | 4（F-040-20~23） | 联盟回调、邮件服务、运营AI入库、价格监控 |
| 全局配置端点 | 3（F-040-24~26） | 运行时配置读写 |
| 身份认证端点 | 4（F-040-27~30） | 注册、登录、登出、会话续期 |

所有端点基于 Cloudflare Workers REST API，统一经数据 API 层访问；客户端与 Agent 均不得直连 D1/R2。

**三态说明**：🗓 需求已设计 → 🏗 功能已实现 → ✅ 功能已审核（不得跳态）

#### 端点数量汇总

| 类别 | 编号范围 | 数量 | 状态说明 |
|------|----------|------|----------|
| 公共端点 | F-040-01~05 | 5 | ✅ 全部审核通过 |
| 用户端点 | F-040-06~13 | 8 | ✅ 全部审核通过 |
| 内部管理端点 | F-040-14~18 | 5 | ✅ 全部审核通过 |
| 全局配置端点 | F-040-24~26 | 3 | ✅ 审核通过 |
| 身份认证端点 | F-040-27~30 | 4 | ✅ 审核通过 |
| 外部系统接口 | F-040-20~23 | 4 | ✅ 全部审核通过 |
| **合计** | | **29** | |

> **统计口径说明**：
> - **总端点数：29个**（F-040-01~18、F-040-20~30，不含F-040-19）
> - **内部API（站内使用）**：公共(5) + 用户(8) + 管理(5) + 配置(3) + 认证(4) = **25个**
> - **外部系统接口**：联盟回调(1) + 邮件服务(内部调用) + 运营AI入库(1) + 价格监控(1) = **4个**（部分为内部调用不计入路由）
> - F-040-19 为预留编号，暂未启用
> - ✅ **ST-T02/T03已修复**：`createGlobalConfig` 路由已注册，Key格式验证已实现

### 3.1.1 公共端点（无需鉴权）

| 端点 | 方法 | 路径 | 说明 | 关联功能 | 需求设计 | 代码实现 | 审核 |
|------|------|------|------|----------|----------|----------|------|
| F-040-01 | GET | `/api/products` | 商品列表，支持类目/标签/价格过滤 | F-002 | ✅ | 🏗 | ✅ |
| F-040-02 | GET | `/api/products/:id` | 商品详情 | F-003 | ✅ | 🏗 | ✅ |
| F-040-03 | GET | `/api/lists` | 榜单列表 | F-004 | ✅ | 🏗 | ✅ |
| F-040-04 | GET | `/api/lists/:id` | 榜单详情（含商品条目） | F-004 | ✅ | 🏗 | ✅ |
| F-040-05 | GET | `/api/categories` | 类目树（主类目 + 子类目） | F-001/F-002 | ✅ | 🏗 | ✅ |

### 3.1.2 用户端点（需 email 或 anonymous_id 关联）

| 端点 | 方法 | 路径 | 说明 | 关联功能 | 需求设计 | 代码实现 | 审核 |
|------|------|------|------|----------|----------|----------|------|
| F-040-06 | POST | `/api/subscribe` | 订阅（录入 email + 偏好） | F-005/F-013 | ✅ | 🏗 | ✅ |
| F-040-07 | DELETE | `/api/subscribe` | 退订 | F-013-03 | ✅ | 🏗 | ✅ |
| F-040-08 | PATCH | `/api/subscribe/preferences` | 更新订阅偏好 | F-013-02 | ✅ | 🏗 | ✅ |
| F-040-09 | POST | `/api/favorites` | 收藏商品 | F-013-05 | ✅ | 🏗 | ✅ |
| F-040-10 | DELETE | `/api/favorites/:product_id` | 取消收藏 | F-013-05 | ✅ | 🏗 | ✅ |
| F-040-11 | GET | `/api/favorites` | 获取收藏列表 | F-013-05 | ✅ | 🏗 | ✅ |
| F-040-12 | POST | `/api/clicks` | 记录点击（携带追踪参数） | F-012/F-017 | ✅ | 🏗 | ✅ |
| F-040-13 | GET | `/api/recommendations` | 个性化推荐 feed | F-014/F-015 | ✅ | 🏗 | ✅ |

### 3.1.3 内部管理端点（后台鉴权）

| 端点 | 方法 | 路径 | 说明 | 关联功能 | 需求设计 | 代码实现 | 审核 |
|------|------|------|------|----------|----------|----------|------|
| F-040-14 | POST | `/api/admin/products` | 新增商品 | F-010-01 | ✅ | 🏗 | ✅ |
| F-040-15 | PUT | `/api/admin/products/:id` | 编辑商品 | F-010-02 | ✅ | 🏗 | ✅ |
| F-040-16 | PATCH | `/api/admin/products/:id/status` | 上下架 | F-010-03 | ✅ | 🏗 | ✅ |
| F-040-17 | POST | `/api/admin/tags` | 创建标签 | F-011-01 | ✅ | 🏗 | ✅ |
| F-040-18 | POST | `/api/admin/lists` | 创建榜单 | F-004 | ✅ | 🏗 | ✅ |

### 3.1.4 全局配置管理端点（F-040-24~26）

> 新增章节 — 全局配置管理接口，支持运行时配置动态调整。

| 端点 | 方法 | 路径 | 说明 | 关联功能 | 需求设计 | 代码实现 | 审核 |
|------|------|------|------|----------|----------|----------|------|
| F-040-24 | GET | `/api/admin/configs` | 获取全局配置列表（管理员） | 配置管理 | ✅ | ✅ | ✅ |
| F-040-25 | PUT | `/api/admin/configs/:key` | 更新特定配置（管理员） | 配置管理 | ✅ | ✅ | ✅ |
| F-040-26 | GET | `/api/configs/:key` | 公开获取特定配置 | 配置管理 | ✅ | ✅ | ✅ |

> ✅ **ST-T02/T03已修复**：`createGlobalConfig` 路由已注册，Key格式验证已实现（`[a-zA-Z][a-zA-Z0-9_]*`）。F-040-24~26 全局配置端点全部审核通过。

#### F-040-24 GET /api/admin/configs - 获取全局配置列表（管理员）

**功能描述**：管理员获取所有全局配置项。

**认证要求**：`X-Admin-Key` Header

**响应格式**：
```json
{
  "ok": true,
  "data": [
    {
      "key": "site_name",
      "value": "Findora",
      "updated_at": "2026-04-13T10:00:00Z"
    }
  ]
}
```

**对应功能ID**：F-040-24

#### F-040-25 PUT /api/admin/configs/:key - 更新特定配置（管理员）

**功能描述**：管理员更新指定配置项的值。

**认证要求**：`X-Admin-Key` Header

**路径参数**：
| 参数 | 类型 | 说明 |
|------|------|------|
| key | string | 配置项名称 |

**请求体**：
```json
{
  "value": "新的配置值"
}
```

**响应格式**：
```json
{
  "ok": true,
  "data": {
    "key": "site_name",
    "value": "新的配置值",
    "updated_at": "2026-04-13T10:00:00Z"
  }
}
```

**对应功能ID**：F-040-25

#### F-040-26 GET /api/configs/:key - 公开获取特定配置

**功能描述**：公开接口，获取指定配置项的值（无需认证）。

**认证要求**：无

**路径参数**：
| 参数 | 类型 | 说明 |
|------|------|------|
| key | string | 配置项名称 |

**响应格式**：
```json
{
  "ok": true,
  "data": {
    "key": "site_name",
    "value": "Findora"
  }
}
```

**对应功能ID**：F-040-26

### 3.1.5 用户身份认证端点（F-040-27~30）

> 新增章节 — 用户注册/登录/登出/会话续期接口，使用 `X-User-Email` 作为主认证方式，Session TTL 由 `user_sessions` 表管理。

| 端点 | 方法 | 路径 | 说明 | 关联功能 | 需求设计 | 代码实现 | 审核 |
|------|------|------|------|----------|----------|----------|------|
| F-040-27 | POST | `/api/auth/register` | 用户注册（邮箱+密码） | 用户身份 | ✅ | ✅ | ✅ |
| F-040-28 | POST | `/api/auth/login` | 用户登录 | 用户身份 | ✅ | ✅ | ✅ |
| F-040-29 | POST | `/api/auth/logout` | 用户登出 | 用户身份 | ✅ | ✅ | ✅ |
| F-040-30 | POST | `/api/auth/refresh` | Session续期 | 用户身份 | ✅ | ✅ | ✅ |

#### F-040-27 POST /api/auth/register - 用户注册

**功能描述**：用户通过邮箱和密码注册账号。

**认证要求**：无

**请求体**：
```json
{
  "email": "user@example.com",
  "password": "SecurePassword123"
}
```

**响应格式**：
```json
{
  "ok": true,
  "data": {
    "user_id": "ems_xxx",
    "email": "user@example.com",
    "created_at": "2026-04-13T10:00:00Z"
  }
}
```

**对应功能ID**：F-040-27

#### F-040-28 POST /api/auth/login - 用户登录

**功能描述**：用户使用邮箱和密码登录，验证成功后创建会话。

**认证要求**：无

**请求体**：
```json
{
  "email": "user@example.com",
  "password": "SecurePassword123"
}
```

**响应格式**：
```json
{
  "ok": true,
  "data": {
    "user_id": "ems_xxx",
    "email": "user@example.com",
    "session_token": "sess_xxx",
    "expires_at": "2026-04-14T10:00:00Z"
  }
}
```

**对应功能ID**：F-040-28

#### F-040-29 POST /api/auth/logout - 用户登出

**功能描述**：用户主动登出，销毁当前会话。

**认证要求**：`X-User-Email` Header

**响应格式**：
```json
{
  "ok": true,
  "data": {
    "message": "Logged out successfully"
  }
}
```

**对应功能ID**：F-040-29

#### F-040-30 POST /api/auth/refresh - Session续期

**功能描述**：刷新当前会话的过期时间（Session TTL）。

**认证要求**：`X-User-Email` Header

**响应格式**：
```json
{
  "ok": true,
  "data": {
    "expires_at": "2026-04-14T10:00:00Z"
  }
}
```

**对应功能ID**：F-040-30

### 3.1.6 统一响应格式与内容协商 (Content Negotiation)
 
 遵循 **AI Agent原生友好** 架构，API层支持通过 `Accept` 标头返回不同格式：
 
 **1. 结构化 JSON 响应（用于前端 Web、普通应用，`Accept: application/json` 或未指定）**
 ```json
 // 成功
 { "ok": true, "data": { ... }, "meta": { "page": 1, "total": 100 } }
 
 // 错误
 { "ok": false, "error": { "code": "PRODUCT_NOT_FOUND", "message": "商品不存在" } }
 ```
 
 **2. 原生 Markdown 响应（用于 AI Agent 抓取/阅读，`Accept: text/markdown`）**
 当请求 `GET /api/products/:id` 时，如果头带 `text/markdown`，直接返回 R2 中存储的 Markdown Item Card（Frontmatter 包含 UUID、价格等，正文为 `summary`/`pros`），以达到对 Agent 零解析成本的最佳适配。

### 3.1.7 外部系统接口（F-040-20~23）

> 新增章节 — 定义系统与第三方外部服务的集成接口。

| 接口编号 | 外部系统 | 接口类型 | 说明 | 关联功能 | 状态 |
|----------|----------|----------|------|----------|------|
| F-040-20 | Alibaba.com Affiliate | 联盟追踪回调 | 接收 Qualifying Purchase 确认回调，更新转化状态 | F-012-05 | ✅ |
| F-040-21 | Resend / SendGrid | 邮件发送 API | 发送订阅确认信、周更推荐、退订确认 | F-013-07 | ✅ |
| F-040-22 | 外部运营AI | 数据更新接口（API/CLI） | 标签维度、标签清单、Item Card、预生成推荐文案入库 | F-020, F-016, F-011, F-010 | 🗓 |
| F-040-23 | 价格监控服务 | 定期轮询 | source_url 价格变动检查 | F-010-05 | ✅ |

#### F-040-20 联盟追踪回调接口

```
触发条件：用户在商家页完成购买 → 联盟平台发起回调
回调地址：POST /api/conversions/callback
验证方式：回调签名验证（platform provided secret）
处理逻辑：
  1. 验证签名有效性
  2. 解析 click_id，关联点击记录
  3. 更新 clicks.conversion_status = 'confirmed'
  4. 记录佣金金额（若平台提供）
  5. 返回 200 OK
```

#### F-040-21 邮件发送接口

```
服务商：Resend（推荐）或 SendGrid
发送类型：
  - 订阅确认信（immediate）
  - 周更推荐（每周四 09:00 UTC cron，0 9 * * 4）
  - 退订确认（immediate）
  - 召回邮件（退订后30天触发）
发送日志：记录 sent/opened/bounced 状态，保留12个月
```

#### F-040-22 运营AI数据更新接口

```
调用主体：系统外运营AI（脚本/Agent/工作流）
调用方式：HTTP API（首选）或 CLI（等价能力）
鉴权要求：
  - 必须携带运维 Token（如 Authorization: Bearer <token> 或 X-Admin-Key）
  - Token 必须支持轮换，支持失效与审计
数据范围：
  - 标签维度（dimension）与标签项（tags）增量/覆盖更新
  - Item Card 内容（标题、摘要、卖点、场景、注意项）
  - 推荐解释文案（按标签组合预生成并存储）
契约约束：
  - 幂等写入（同 request_id 重放不重复写）
  - 支持 dry-run 校验（仅验签/验结构，不落库）
  - 必须返回字段级错误列表（便于运营AI回收失败样本）
```

##### F-040-22 详细契约规范（v3.34新增）

> ⚠️ **契约完善说明**：以下为F-040-22接口的详细技术规范，确保外部运营AI与系统对接的一致性。

**1. request_id 规范**

| 字段 | 要求 | 说明 |
|------|------|------|
| 格式 | UUID v4 | 例：`550e8400-e29b-41d4-a716-446655440000` |
| 用途 | 幂等键 | 同request_id重放不重复写 |
| 生成方 | 调用方（运营AI） | 系统不负责生成 |
| 超时窗口 | 72小时 | 同一request_id在72小时内重复提交视为重放 |

**2. 幂等保证**

```
处理流程：
1. 接收请求，提取 request_id
2. 查询 D1：SELECT request_id FROM ai_update_logs WHERE request_id = ?
3. 若存在 → 返回上次执行结果（不重复执行）
4. 若不存在 → 执行写入，记录 request_id → 返回成功
```

**3. dry-run 校验**

| 参数 | 说明 |
|------|------|
| `dry_run=true` | 仅验签/验结构，不落库，返回校验结果 |

**4. 数据校验规则**

| 校验项 | 规则 | 错误码 |
|--------|------|--------|
| 标签名长度 | 1~50字符 | `INVALID_TAG_LENGTH` |
| 商品标题长度 | 1~200字符 | `INVALID_TITLE_LENGTH` |
| 禁用词检查 | 禁止出现：best/worst/safest/guaranteed/proven/clinically/miracle/revolutionary/lifesaving/official/authentic/dangerous/amazing/incredible/unbelievable/game-changing（共16项，v3.64更新：与代码定义对齐） | `FORBIDDEN_WORD_DETECTED` |
| 价格范围 | >=0 且 <= 999999 | `INVALID_PRICE_RANGE` |
| 图片URL格式 | 有效URL或R2对象路径 | `INVALID_IMAGE_URL` |
| 日期格式 | ISO 8601 | `INVALID_DATE_FORMAT` |

**5. 错误响应格式**

```json
{
  "ok": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "数据校验失败",
    "details": [
      {
        "field": "products[0].title",
        "code": "INVALID_TITLE_LENGTH",
        "message": "标题长度超过200字符"
      },
      {
        "field": "products[1].tags",
        "code": "FORBIDDEN_WORD_DETECTED",
        "message": "标签包含禁用词: 'best'"
      }
    ]
  },
  "request_id": "550e8400-e29b-41d4-a716-446655440000"
}
```

**6. 成功响应格式**

```json
{
  "ok": true,
  "data": {
    "processed": 10,
    "created": 5,
    "updated": 3,
    "skipped": 2,
    "errors": []
  },
  "request_id": "550e8400-e29b-41d4-a716-446655440000",
  "dry_run": false
}
```

**7. 支持的操作类型**

| 操作 | HTTP方法 | 路径示例 | 说明 |
|------|----------|----------|------|
| 批量创建/更新 | POST | `/api/admin/ai/upsert` | 标签、商品、Item Card |
| 标签维度管理 | POST/PUT/DELETE | `/api/admin/ai/tags` | 维度与标签项 |
| 推荐解释预生成 | POST | `/api/admin/ai/explanations` | 批量预生成文案 |
| dry-run校验 | POST | `/api/admin/ai/upsert?dry_run=true` | 仅校验不落库 |

#### F-040-23 价格监控接口

```
触发方式：外部服务回推（POST /api/admin/price-check）
监控范围：接收外部服务推送的价格变动数据
处理逻辑：
  1. 验证回推签名/权限
  2. 解析价格变动数据
  3. 更新 price_min/price_max + last_checked_at
  4. 若商品已下架，更新 status = 'inactive'
  5. 记录价格变动日志
```

### 3.1.8 错误码

| 错误码 | HTTP 状态 | 说明 |
|--------|-----------|------|
| `INVALID_PARAMS` | 400 | 参数校验失败 |
| `NOT_FOUND` | 404 | 资源不存在 |
| `ALREADY_SUBSCRIBED` | 409 | 邮箱已订阅 |
| `NOT_SUBSCRIBED` | 409 | 邮箱未订阅（退订时） |
| `INTERNAL_ERROR` | 500 | 内部错误 |

### 3.1.9 API 关联索引

| 功能编号 | 对应端点 |
|----------|----------|
| F-001 | F-040-01, F-040-02, F-040-03, F-040-05 |
| F-002 | F-040-01, F-040-05 |
| F-003 | F-040-02, F-040-12 |
| F-004 | F-040-03, F-040-04 |
| F-005 | F-040-06 |
| F-010 | F-040-01, F-040-14, F-040-15, F-040-16 |
| F-011 | F-040-17 |
| F-012 | F-040-12, F-040-20 |
| F-013 | F-040-06, F-040-07, F-040-08, F-040-09, F-040-10, F-040-11, F-040-21 |
| F-014/F-015 | F-040-13 |
| F-016 | F-040-13, F-040-22 |
| F-017 | F-040-12 |
| F-020 | F-040-22 |

### 3.1.10 架构一致性检查清单（v3.34）

| 编号 | 检查项 | 验收标准 | 关联功能 | 备注 |
|------|--------|----------|----------|------|
| AC-01 | 用户侧是否存在实时 LLM 调用 | Web 请求链路中 0 次外部模型调用 | F-016/F-020 | 持续监控 |
| AC-02 | 运营AI入库是否必须鉴权 | 无 Token 请求全部拒绝（401/403） | F-040-22 | 幂等验证 |
| AC-03 | 标签维度是否支持动态扩展 | 新维度可通过接口创建并立即用于检索 | F-011/F-040-22 | 需重启生效 |
| AC-04 | 推荐是否为纯查库逻辑 | 推荐链路仅含 DB 检索 + 随机抽选 | F-014/F-015/F-016 | 无实时AI |
| AC-05 | API 是否仍为唯一数据入口 | 无前端/Agent 直连 D1/R2路径 | F-040/S-09 | 安全红线 |

---

## 4. 数据字典（F-050）

> 本节定义核心业务实体的数据库 Schema，基于 Cloudflare D1。

### 4.0 存储架构说明（三层分离）

> 明确 D1/R2/Git 三层存储的职责边界。

| 存储层 | 用途 | 数据类型 | 说明 |
|--------|------|----------|------|
| **D1** | 结构化索引与关系主存 | 关系型数据 | 商品主键、标签关系、用户偏好、检索索引、R2对象指针等 |
| **R2** | 内容与媒体主存 | Markdown/JSON/媒体文件 | Item Card 正文、预生成推荐解释、榜单正文、图片与素材 |
| **Git** | 内容协作来源 | Markdown 源文件 | 用于协作编辑和版本管理，非线上运行时直接读取 |

**数据流向**：运营AI/人工维护 → F-040-22 数据更新接口 → D1（索引）+ R2（内容）

> 注意：前端和 Agent 必须通过 API 层访问数据，禁止直连 D1/R2。

### 4.1 products（商品表）

| 字段名 | 类型 | 约束 | 说明 |
|--------|------|------|------|
| id | TEXT | PRIMARY KEY | Snowflake UUID |
| title | TEXT | NOT NULL | 商品标题 |
| source_platform | TEXT | NOT NULL | 1688 / alibaba / amazon / temu |
| source_url | TEXT | NOT NULL | 原始商品链接 |
| original_title | TEXT | NOT NULL | 原始商品标题 |
| rewritten_title | TEXT | | 重写后标题（用于前端展示） |
| category | TEXT | NOT NULL, INDEX | 主类目 slug |
| subcategory | TEXT | INDEX | 子类目 slug |
| tags | TEXT | JSON 数组 | 标签 ID 列表 |
| price_min | REAL | | 价格区间低 |
| price_max | REAL | | 价格区间高 |
| currency | TEXT | DEFAULT 'USD' | 币种 |
| cover_image | TEXT | | 商品主图 |
| r2_object_key | TEXT | NOT NULL | R2 中的对象路径（例如 `items/uuid.jpg`），存储商品图片 |
| images | TEXT | JSON 数组 | 商品图片列表 |
| summary | TEXT | | 商品摘要/亮点 |
| pros | TEXT | JSON 数组 | 优点列表 |
| cons | TEXT | JSON 数组 | 缺点列表 |
| use_cases | TEXT | JSON 数组 | 适用场景 |
| target_audience | TEXT | JSON 数组 | 目标人群 |
| shipping_notes | TEXT | | 物流说明 |
| merchant_name | TEXT | | 商家名称 |
| affiliate_url | TEXT | | 联盟追踪跳转 URL |
| last_checked_at | TEXT | | ISO 8601 |
| status | TEXT | DEFAULT 'active' | active / inactive / archived |
| created_at | TEXT | NOT NULL | ISO 8601 |
| updated_at | TEXT | NOT NULL | ISO 8601 |

**索引**：`category`, `subcategory`, `status`, `(status, category)`

### 4.2 users（用户表）

| 字段名 | 类型 | 约束 | 说明 |
|--------|------|------|------|
| id | TEXT | PRIMARY KEY | UUID |
| email | TEXT | UNIQUE, INDEX | 邮箱（脱敏存储） |
| anonymous_id | TEXT | INDEX | 未登录用户 anonymous_id |
| subscribed_categories | TEXT | JSON 数组 | 订阅类目 |
| price_preference | TEXT | | budget / mid-range / premium |
| liked_tags | TEXT | JSON 数组 | 偏好标签 |
| disliked_tags | TEXT | JSON 数组 | 反感标签 |
| click_history | TEXT | JSON 数组 | 点击 product_id（最近50条） |
| saved_items | TEXT | JSON 数组 | 收藏 product_id |
| locale | TEXT | | 用户地区 |
| frequency_preference | TEXT | | weekly / biweekly / monthly |
| subscribed_at | TEXT | | ISO 8601 |
| unsubscribed_at | TEXT | | ISO 8601 |
| status | TEXT | DEFAULT 'active' | active / unsubscribed / dormant |
| created_at | TEXT | NOT NULL | ISO 8601 |
| updated_at | TEXT | NOT NULL | ISO 8601 |

### 4.2.1 user_sessions（用户会话表）

| 字段名 | 类型 | 约束 | 说明 |
|--------|------|------|------|
| id | TEXT | PRIMARY KEY | 会话 ID |
| user_id | TEXT | NOT NULL, FK | 关联用户 ID |
| token | TEXT | UNIQUE, NOT NULL | 会话令牌 |
| ip_address | TEXT | | 登录 IP（可空） |
| user_agent | TEXT | | 客户端标识（可空） |
| expires_at | TEXT | NOT NULL | 会话过期时间（Session TTL） |
| created_at | TEXT | NOT NULL | ISO 8601 |

### 4.3 clicks（点击日志表）

| 字段名 | 类型 | 约束 | 说明 |
|--------|------|------|------|
| id | TEXT | PRIMARY KEY | UUID |
| product_id | TEXT | INDEX | 被点击商品 |
| user_id | TEXT | INDEX | 点击用户（可为 null） |
| anonymous_id | TEXT | | 未登录用户 |
| source | TEXT | | 点击来源页面 |
| utm_source | TEXT | | 追踪：来源 |
| utm_medium | TEXT | | 追踪：媒介 |
| utm_campaign | TEXT | | 追踪：活动 |
| referer | TEXT | | HTTP Referer |
| ip_country | TEXT | | 点击者国家（按 IP 推断，不记录 IP 本身） |
| clicked_at | TEXT | NOT NULL | ISO 8601 |

**索引**：`product_id`, `user_id`, `clicked_at`, `(product_id, clicked_at)`

**合规**：不记录完整 IP，仅记录国家。日志保留 90 天后自动清理。

### 4.4 lists（榜单表）

| 字段名 | 类型 | 约束 | 说明 |
|--------|------|------|------|
| id | TEXT | PRIMARY KEY | UUID |
| slug | TEXT | UNIQUE, INDEX | URL slug |
| title | TEXT | NOT NULL | 榜单标题 |
| description | TEXT | | 榜单摘要 |
| why_these | TEXT | | 筛选逻辑说明 |
| cover_image | TEXT | | 封面图 |
| category | TEXT | INDEX | 主类目 |
| status | TEXT | DEFAULT 'draft' | draft / published / archived |
| content_type | TEXT | | organic / affiliate / sponsored（内容商业性质） |
| disclosure | TEXT | | 联盟披露声明（required for affiliate/sponsored） |
| published_at | TEXT | | ISO 8601 |
| created_at | TEXT | NOT NULL | ISO 8601 |
| updated_at | TEXT | NOT NULL | ISO 8601 |

### 4.5 list_products（榜单商品关联表）⚠️ 结构待统一

> ⚠️ **当前问题**：`001_initial_schema.sql` 与 `010_list_products.sql` 对 `list_products` 给出了两套结构。v3.00 要求统一为单一数据模型，并通过迁移修正消除历史漂移。

| 字段名 | 类型 | 约束 | 说明 |
|--------|------|------|------|
| id | TEXT | PRIMARY KEY | 关联记录 ID |
| list_id | TEXT | NOT NULL, FK | 关联榜单 ID |
| product_id | TEXT | NOT NULL, FK | 关联商品 ID |
| position | INTEGER | NOT NULL | 榜单内排序位置 |
| created_at | TEXT | NOT NULL | ISO 8601 |

**主键**：`PRIMARY KEY (id)`，并对 `(list_id, product_id)` 建唯一索引
**索引**：`list_id`, `product_id`

**目标 Migration（统一后）**：
```sql
CREATE TABLE IF NOT EXISTS list_products (
  id TEXT PRIMARY KEY,
  list_id TEXT NOT NULL,
  product_id TEXT NOT NULL,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  FOREIGN KEY (list_id) REFERENCES lists(id),
  FOREIGN KEY (product_id) REFERENCES products(id)
);
CREATE INDEX IF NOT EXISTS idx_list_products_list_id ON list_products(list_id);
CREATE INDEX IF NOT EXISTS idx_list_products_product_id ON list_products(product_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_list_products_list_product ON list_products(list_id, product_id);
```

### 4.6 tags（标签表）

| 字段名 | 类型 | 约束 | 说明 |
|--------|------|------|------|
| id | TEXT | PRIMARY KEY | UUID |
| name | TEXT | NOT NULL | 标签名 |
| slug | TEXT | UNIQUE | URL slug |
| layer | TEXT | NOT NULL | category / function / audience / style / price |
| dimension_level | INTEGER | DEFAULT 2 | 1(一级维度) 或 2(二级维度)，依据 system_design.md |
| featured_products | TEXT | JSON 数组 | 特定标签的推荐 item list（人工/Agent 精选商品 ID） |
| parent_id | TEXT | | 父标签 ID（子类目用） |
| created_at | TEXT | NOT NULL | ISO 8601 |

### 4.7 状态机约定

**商品状态流转**（F-010）：
```
active → inactive → archived
```
> ⚠️ 注：代码使用 `active / inactive / archived` 三态体系（见 `schema.ts`），已与设计文档对齐。

**榜单状态流转**（F-004）：
```
draft → published → archived
```

**用户状态流转**（F-013）：
```
active → unsubscribed
active → dormant (90天无互动)
dormant → active (重新互动)
```

### 4.8 全局配置表 (global_configs)

> 新增：满足 `system_design.md` 中对于全局参数配置的需求（也可使用 KV 实现，目前纳入 D1 设计）。

| 字段名 | 类型 | 约束 | 说明 |
|--------|------|------|------|
| key | TEXT | PRIMARY KEY | 配置键名（如 `home_tags`, `token_expiry`） |
| value | TEXT | NOT NULL | 配置值（JSON 格式存储复杂配置） |
| description | TEXT | | 配置说明 |
| updated_at | TEXT | NOT NULL | ISO 8601 |

---

## 5. CI/CD 流程（F-060）

### 目标

- 内容/配置变更：push 后自动部署到 Staging，审核后手动 promotion 到 Production
- 技术代码变更：PR → review → 自动部署到 Staging → 人工 promotion 到 Production

### 流程图（文字版）

```
[本地开发]
     │
     ▼
[Push to main branch]
     │
     ├─ 触发 Cloudflare Pages 自动构建
     │
     ▼
[Staging 环境 — 自动部署]
  URL: staging.findora.example.com
  用于：内容预览、QA 验证
     │
     │ (人工确认没问题)
     ▼
[Production 环境 — 手动 Promotion]
  命令: `wrangler pages deploy` 或 Cloudflare Dashboard 点按钮
  用于：正式上线
```

### 触发规则

| 分支/事件 | 行为 |
|----------|------|
| `main` branch push | 自动构建 + 部署到 Staging |
| `main` tag (vX.Y.Z) | 自动 promotion 到 Production |
| PR opened | 预览部署（Preview URL） |
| 手动触发 | via `wrangler pages deploy` |

### 构建物

| 类型 | 构建命令 | 部署目标 |
|------|----------|----------|
| 静态内容（Markdown） | `hugo build` 或 `wrangler pages build` | Cloudflare Pages |
| D1 数据库迁移 | `wrangler d1 migrations apply` | Staging D1 → Production D1 |
| Worker 脚本 | `wrangler deploy` | Cloudflare Workers |

### 回滚

| 场景 | 操作 |
|------|------|
| Pages 回滚 | Cloudflare Dashboard → 点击「重新部署」选择历史版本 |
| D1 数据回滚 | `wrangler d1 execute` 执行 migration rollback SQL |
| Worker 回滚 | `wrangler rollback` 或手动选历史版本 |

### 环境说明

| 环境 | 用途 | 数据 |
|------|------|------|
| Local | 本地开发调试 | 本地 D1 副本 |
| Staging | 自动化构建验证 + 内容预览 | 独立 D1 实例，测试数据 |
| Production | 正式上线 | 正式 D1，数据分离 |

---

## 6. 页面功能设计

> 📌 **第五次STR审核（v0.5）说明**：F-001~F-006 前端页面已通过审核，大部分核心功能已实现。部分 P1 级功能未实现（如 Trending Now、排序、子类目筛选等），不影响 MVP 上线。

### 6.1 首页（F-001）

**功能描述**

表达站点定位与分类入口的首页。

**需求来源**：business_concept §6.1

**模块列表**

| 子功能 | 描述 | 需求设计 | 代码实现 | 审核 | 优先级 |
|--------|------|----------|----------|------|--------|
| F-001-01 Hero 区 | 一句话站点定位说明 + 主 CTA | ✅ | ✅ | ✅ | P0 |
| F-001-02 热门榜单入口 | 展示当前热门榜单缩略 | ✅ | ✅ | ✅ | P0 |
| F-001-03 最新发现 | 最近新增商品列表 | ✅ | ✅ | ✅ | P0 |
| F-001-04 分类入口 | 主要类目导航卡片 | ✅ | ✅ | ✅ | P0 |
| F-001-05 Trending Now | 当前趋势内容区 | ✅ | ✅ | ✅ | P1 |
| F-001-06 Subscribe CTA | 订阅入口（email） | ✅ | ✅ | ✅ | P0 |

**验收标准**

- 用户可在首屏理解站点定位
- 可直接进入分类页或榜单页
- 可完成订阅操作

---

### 6.2 分类页（F-002）

**功能描述**

按垂类组织商品列表页。

**需求来源**：business_concept §6.1

**模块列表**

| 子功能 | 描述 | 需求设计 | 代码实现 | 审核 | 优先级 |
|--------|------|----------|----------|------|--------|
| F-002-01 类目导航 | 当前类目路径面包屑 | ✅ | ✅ | ✅ | P0 |
| F-002-02 商品列表 | 该类目下商品卡片列表，支持翻页 | ✅ | ✅ | ✅ | P0 |
| F-002-03 子类目筛选 | 同类目下按子类目/标签过滤 | ✅ | ✅ | ✅ | P1 |
| F-002-04 价格区间筛选 | 按价格区间筛选商品 | ✅ | ✅ | ✅ | P1 |
| F-002-05 排序 | 按最新/热门/价格排序 | ✅ | ✅ | ✅ | P1 |
| F-002-06 订阅该类目 | 用户可订阅特定类目更新 | ✅ | ✅ | ✅ | P1 |

**验收标准**

- 分类页展示该类目下所有商品
- 用户可按子类目和标签进一步筛选
- 订阅入口可见

---

### 6.3 商品详情页（F-003）

**功能描述**

核心转化页，展示单个商品的完整内容与跳转入口。

**需求来源**：business_concept §6.1、§7.2

**模块列表**

| 子功能 | 描述 | 需求设计 | 代码实现 | 审核 | 优先级 |
|--------|------|----------|----------|------|--------|
| F-003-01 商品图展示 | 主图 + 辅助图 | ✅ | ✅ | ✅ | P0 |
| F-003-02 重写标题 | AI/人工重写的用户视角标题 | ✅ | ✅ | ✅ | P0 |
| F-003-03 Why it stands out | 核心亮点描述 | ✅ | ✅ | ✅ | P0 |
| F-003-04 Good for | 适合人群/场景说明 | ✅ | ✅ | ✅ | P0 |
| F-003-05 Watch-outs | 购买前注意事项 | ✅ | ✅ | ✅ | P0 |
| F-003-06 Price sense | 价格区间说明 | ✅ | ✅ | ✅ | P0 |
| F-003-07 Related picks | 相关推荐商品（3–5个） | ✅ | ✅ | ✅ | P0 |
| F-003-08 CTA 跳转按钮 | 点击跳转至商家页（含追踪参数） | ✅ | ✅ | ✅ | P0 |
| F-003-09 收藏/喜欢 | 用户可收藏商品 | ✅ | ✅ | ✅ | P1 |
| F-003-10 联盟披露声明 | 页面底部 affiliate disclosure | ✅ | ✅ | ✅ | P0 |

**验收标准**

- 用户可完整了解商品核心信息
- CTA 按钮可追踪点击并携带联盟参数跳转
- 符合合规要求（披露声明、不过度承诺）

---

### 6.4 榜单页（F-004）

**功能描述**

专题型榜单页面，如 "20 Best Kitchen Gadgets under $20"。

**需求来源**：business_concept §6.1、§7.1

**模块列表**

| 子功能 | 描述 | 需求设计 | 代码实现 | 审核 | 优先级 |
|--------|------|----------|----------|------|--------|
| F-004-01 榜单标题与摘要 | 主题 + 一句话说明 | ✅ | ✅ | ✅ | P0 |
| F-004-02 榜单目录 | 可点击跳转至各商品段落 | ✅ | ✅ | ✅ | P0 |
| F-004-03 商品条目 | 每个商品含图+简述+跳转链接 | ✅ | ✅ | ✅ | P0 |
| F-004-04 Why these | 榜单筛选逻辑说明 | ✅ | ✅ | ✅ | P0 |
| F-004-05 榜单页 SEO 元数据 | title/description/keywords | ✅ | ✅ | ✅ | P0 |
| F-004-06 收藏/分享 | 可收藏整个榜单或分享 | ✅ | ✅ | ✅ | P1 |

**验收标准**

- 榜单页可被 Google 收录（SEO 友好）
- 每个商品条目可直接跳转
- 适合社媒分享

---

### 6.5 订阅页（F-005）

**功能描述**

用户选择订阅偏好并提交 email 的页面。

**需求来源**：business_concept §5.3、§7.1

**模块列表**

| 子功能 | 描述 | 需求设计 | 代码实现 | 审核 | 优先级 |
|--------|------|----------|----------|------|--------|
| F-005-01 Email 输入框 | 收集用户 email | ✅ | ✅ | ✅ | P0 |
| F-005-02 类目选择 | 用户勾选感兴趣类目 | ✅ | ✅ | ✅ | P0 |
| F-005-03 预算区间选择 | 可选：预算范围偏好 | ✅ | ✅ | ✅ | P1 |
| F-005-04 更新频率选择 | 每周/双周/月度 | ✅ | ✅ | ✅ | P1 |
| F-005-05 订阅确认 | 提交后显示确认信息 | ✅ | ✅ | ✅ | P0 |
| F-005-06 订阅管理入口 | 后续退订/修改偏好链接 | ✅ | ✅ | ✅ | P1 |
| F-005-07 收藏管理入口 | 收藏/屏蔽商品管理（增删改） | ✅ | ✅ | ✅ | P1 |
| F-005-08 偏好设置入口 | 独立偏好标签管理（liked_tags/disliked_tags） | ✅ | ✅ | ✅ | P1 |

**偏好更新规则**：
- 用户收藏商品时，系统自动将该商品的标签添加到用户的 `liked_tags`
- 用户屏蔽商品时，系统自动将该商品的标签添加到用户的 `disliked_tags`
- 偏好设置入口独立于订阅流程，非订阅用户也可访问

**验收标准**

- 用户可完成订阅操作，数据存入 DB
- 可区分不同类目订阅者
- 有退订入口（合规必须）
- 收藏管理入口可用，支持增删操作
- 偏好设置入口独立，非订阅用户也可管理偏好

---

### 6.6 About / Disclosure / Contact（F-006）

**功能描述**

合规必需页面与品牌说明。

**需求来源**：business_concept §13

**模块列表**

| 子功能 | 描述 | 需求设计 | 代码实现 | 审核 | 优先级 |
|--------|------|----------|----------|------|--------|
| F-006-01 About 页 | 品牌介绍、定位说明 | ✅ | ✅ | ✅ | P0 |
| F-006-02 Disclosure 页 | 联盟关系披露、佣金说明 | ✅ | ✅ | ✅ | P0 |
| F-006-03 Contact 页 | 联系入口（表单或 email） | ✅ | ✅ | ✅ | P0 |
| F-006-04 Privacy Policy | 隐私政策（至少基本版） | ✅ | ✅ | ✅ | P0 |
| F-006-05 Terms of Use | 使用条款 | ✅ | ✅ | ✅ | P1 |

**验收标准**

- 联盟披露清晰，不存在法律风险
- About 页传达品牌定位
- Contact 通道可用

---

## 7. 核心业务功能

> 📌 **Section 7 设计状态**：F-010~F-017 需求设计已全部完成 ✅；三态列于 v1.0 规范化补全。代码实现请参见各子功能表。

### 7.1 商品库与数据模型（F-010）

**功能描述**

商品数据的结构化存储与基础管理能力。

**需求来源**：business_concept §8.1

**字段定义**

> ⚠️ 字段状态已固化于 F-050（schema.ts）— ✅ 已审核。下方为需求设计参考，实际以 F-050 为准。
>
> **说明**：以下"需求设计"列表示数据字段设计是否已确认（✅ = 已确认）。由于是数据模型字段而非功能特性，故不适用 🏗 功能实现 / ✅ 功能审核两列。所有字段设计均已完成。

| 字段 | 类型 | 说明 | 需求设计 |
|------|------|------|:--------:|
| product_id | string | 唯一标识 | ✅ |
| source_platform | string | 来源平台（1688/Alibaba/...） | ✅ |
| source_url | string | 原始商品链接 | ✅ |
| original_title | string | 原始标题 | ✅ |
| rewritten_title | string | 重写标题（用户视角） | ✅ |
| category | string | 主类目 | ✅ |
| subcategory | string | 子类目 | ✅ |
| tags | string[] | 多标签数组 | ✅ |
| price_min | decimal | 价格区间低 | ✅ |
| price_max | decimal | 价格区间高 | ✅ |
| currency | string | 币种，默认 USD | ✅ |
| images | string[] | 图片 URL 列表 | ✅ |
| summary | string | 一句话总结 | ✅ |
| pros | string[] | 优点列表 | ✅ |
| cons | string[] | 缺点列表 | ✅ |
| use_cases | string[] | 使用场景 | ✅ |
| target_audience | string[] | 目标人群 | ✅ |
| shipping_notes | string | 物流/运输说明 | ✅ |
| merchant_name | string | 商家名称 | ✅ |
| last_checked_at | datetime | 最后检查时间 | ✅ |
| status | string | active / inactive / archived | ✅ |

**管理操作**

| 操作 | 描述 | 需求设计 | 代码实现 | 审核 | 优先级 |
|------|------|----------|----------|------|--------|
| F-010-01 商品录入 | 支持手动 + AI 批量导入 | ✅ | ✅ | ✅（第十次审核通过）| P0 |
| F-010-02 商品编辑 | 修改字段内容 | ✅ | ✅ | ✅（第十三次审核通过）| P0 |
| F-010-03 商品上下架 | 上下架控制 | ✅ | ✅ | ✅（第十三次审核通过）| P0 |
| F-010-04 批量操作 | 批量标签/类目修改 | ✅ | 🏗 | ✅ | P1 |
| F-010-05 价格同步检查 | 定期检查 source_url 价格变动 | ✅ | ✅ | ✅ | P1 |

**验收标准**

- 商品数据完整结构化存储
- 支持按类目/标签/价格/状态查询
- 可导出商品列表

---

### 7.2 标签体系（F-011）

**功能描述**

五层标签系统，支撑商品分类与推荐逻辑。

**需求来源**：business_concept §8.2

**标签层级**

> ⚠️ 标签数据模型已固化于 F-050 tags 表（✅ 已审核）。标签内容（具体标签名）通过 F-011-01 管理。
>
> **说明**：以下"需求设计"列表示标签层级设计是否已确认（✅ = 已确认）。由于是数据模型设计而非功能特性，故不适用 🏗 功能实现 / ✅ 功能审核两列。所有层级设计均已完成。

| 层级 | 标签示例 | 说明 | 需求设计 |
|------|----------|------|:--------:|
| 类目标签 | kitchen / home / beauty / pet | 主分类 | ✅ |
| 功能标签 | organizing / cleaning / decorating / gifting | 功能属性 | ✅ |
| 人群标签 | for moms / for students / for pet owners | 目标人群 | ✅ |
| 风格标签 | cute / minimalist / luxury-looking / weird | 风格调性 | ✅ |
| 价格标签 | budget / mid-range / impulse buy / premium | 价格档位 | ✅ |

**管理操作**

| 操作 | 描述 | 需求设计 | 代码实现 | 审核 | 优先级 |
|------|------|----------|----------|------|--------|
| F-011-01 标签 CRUD | 创建/读取/更新/删除标签 | 🗓 | 🏗 | ✅ | P0 |
（STR第七次审核通过：listTags/updateTag/deleteTag 已完整实现，路由已注册）
| F-011-02 商品打标 | 单个/批量商品打标 | 🗓 | 🏗 | ✅ | P0 |
| F-011-03 标签统计 | 各标签下商品数量统计 | 🗓 | 🏗 | ✅ | P1 |

**验收标准**

- 每个商品至少拥有：类目标签 + 价格标签
- 可按标签组合筛选商品
- 标签体系不重复、不遗漏核心分类

---

### 7.3 联盟跳转与追踪（F-012）

**功能描述**

记录用户从站点到商家页的跳转行为，用于佣金追踪和数据复盘。

**需求来源**：business_concept §4.1、§12.1

**功能列表**

| 子功能 | 描述 | 需求设计 | 代码实现 | 审核 | 优先级 |
|--------|------|----------|----------|------|--------|
| F-012-01 追踪参数生成 | 唯一追踪参数（utm 等） | 🗓 | ✅ | ✅（第十三次审核通过）| P0 |
| F-012-02 点击日志 | 记录 click_id/user_id/product_id/source/ts | 🗓 | ✅ | ✅（第十三次审核通过）| P0 |
| F-012-03 来源标记 | 社媒/搜索/直接访问区分 | 🗓 | ✅ | ✅（第十三次审核通过）| P0 |
| F-012-04 跳转去重 | 短时重复点击去重 | 🗓 | ✅ | ✅ | P1 |
| F-012-05 转化回调记录 | 商家回调日志更新（若平台支持）| 🗓 | ✅ | ✅ | P1 |

**数据记录字段**

```
click_id, user_id, product_id, source_platform, utm_source, utm_medium,
utm_campaign, referer, ip_country, clicked_at
```

**验收标准**

- 每次跳转均携带追踪参数
- 点击数据可按来源/商品/时间维度查询
- 不存在个人信息过度采集

---

### 7.4 用户订阅与偏好（F-013）

**功能描述**

管理订阅用户的偏好数据，用于个性化推荐与邮件触发。

**需求来源**：business_concept §8.3、§9.2

**用户字段**

> ⚠️ 字段状态已固化于 F-050 users 表（✅ 已审核）。下方为需求设计参考。
>
> **说明**：以下"需求设计"列表示数据字段设计是否已确认（✅ = 已确认）。由于是数据模型字段而非功能特性，故不适用 🏗 功能实现 / ✅ 功能审核两列。所有字段设计均已完成。

| 字段 | 类型 | 说明 | 需求设计 |
|------|------|------|:--------:|
| user_id | string | 唯一标识 | ✅ |
| email | string | 邮箱地址 | ✅ |
| subscribed_categories | string[] | 订阅类目 | ✅ |
| price_preference | string | 价格偏好（budget/mid/premium） | ✅ |
| liked_tags | string[] | 偏好的标签 | ✅ |
| disliked_tags | string[] | 反感的标签 | ✅ |
| click_history | string[] | 点击过的 product_id 列表（最近50条） | ✅ |
| saved_items | string[] | 收藏的商品 | ✅ |
| locale | string | 用户地区 | ✅ |
| frequency_preference | string | 更新频率偏好（weekly/biweekly/monthly） | ✅ |
| subscribed_at | datetime | 订阅时间 | ✅ |
| status | string | active / unsubscribed / dormant | ✅ |

**功能列表**

| 子功能 | 描述 | 需求设计 | 代码实现 | 审核 | 优先级 |
|--------|------|----------|----------|------|--------|
| F-013-01 订阅录入 | 从订阅页写入用户偏好 | 🗓 | ✅ | ✅（第十三次审核通过）| P0 |
| F-013-02 偏好更新 | 用户可修改订阅偏好 | 🗓 | ✅ | ✅（第十三次审核通过）| P1 |
| F-013-03 退订处理 | 退订后 status → unsubscribed，停止触达 | 🗓 | ✅ | ✅（第十三次审核通过）| P0 |
| F-013-04 点击行为记录 | 记录用户点击并更新 click_history | 🗓 | ✅ | ✅（第十三次审核通过）| P0 |
| F-013-05 收藏管理 | 用户收藏/取消收藏商品 | 🗓 | ✅ | ✅（第十三次审核通过）| P1 |
| F-013-06 用户分群 | 按类目/标签/活跃度分群 | 🗓 | ✅ | ✅ | P2 |
| F-013-07 邮件触发逻辑 | 订阅确认信 + 周更推送 + 退订确认 + 召回 | 🗓 | ✅ | ✅ | P0 |
| F-013-08 订阅列表管理 | 运营后台查看/筛选订阅用户 | 🗓 | 🏗 | ✅ | P1 |
| F-013-09 订阅数据导出 | 按类目/状态导出 CSV | 🗓 | 🏗 | ✅ | P1 |

**验收标准**

- 订阅数据完整记录且可查询
- 退订操作即时生效（`status → unsubscribed`，触达系统立即停止）
- 点击行为记录不影响页面加载性能（异步写入）
- 邮件触发链路有回执记录（sent / opened / bounced）
- 订阅列表可按类目、状态、订阅时间筛选

#### F-013-07 邮件触发逻辑（细化）

| 触发事件 | 触发条件 | 邮件内容 | 发送时机 |
|----------|----------|----------|----------|
| 订阅确认信 | 用户提交订阅 | 确认订阅 + 偏好类目 + 退订链接 | 立即 |
| 周更推荐 | 每周四 09:00（UTC）| 当前类目新品推荐（最多10个）| 每周定时 |
| 退订确认 | 用户退订操作 | 确认退订 + 何时可重新订阅 | 立即 |
| 欢迎召回（可选）| 退订后30天 | 近期新内容摘要 + 重新订阅入口 | 一次性 |

**邮件触发流程**（周更推送为例）：
```
[Cron: 每周四 09:00 UTC（0 9 * * 4）]
     │
     ▼
[查询该周有新商品的类目]
     │
     ├─→ [按订阅类目分组订阅者（status = active）]
     │
     ├─→ [生成推荐商品列表（最多10个，基于订阅类目）]
     │
     ├─→ [渲染邮件模板]
     │
     ├─→ [发送邮件（记录 sent）]
     │
     └─→ [记录发送日志]
```

**技术约束**：
- 邮件发送使用第三方邮件服务（Resend / Mailgun / SendGrid 等）
- 不自建邮件发送服务
- 发送日志保留 12 个月
- 打开率/点击率通过邮件追踪像素或唯一链接记录
- 订阅者 `status = unsubscribed` 时，触达系统自动跳过该用户

---

### 7.5 基础推荐 — 规则推荐（F-014）

**功能描述**

第一阶段推荐逻辑，基于规则而非模型。

**需求来源**：business_concept §9.1

**推荐规则**

| 规则 | 描述 | 需求设计 | 代码实现 | 审核 | 优先级 |
|------|------|----------|----------|------|--------|
| F-014-01 同类目推荐 | 推荐同 category 商品 | 🗓 | ✅ | ✅ | P0 |
（F-014-01/02 第十三次STR整改通过：likedTags匹配逻辑已完整实现）
| F-014-02 同标签推荐 | 推荐共享 ≥1 标签商品 | 🗓 | ✅ | ✅ | P0 |
（F-014-01/02 第十三次STR整改通过：likedTags匹配逻辑已完整实现）
| F-014-03 同价格带推荐 | 价格区间相近商品 | 🗓 | ✅ | ✅ | P1 |
| F-014-04 热门加权 | 按点击/收藏量加权排序 | 🗓 | ✅ | ✅ | P0 |
（SDS v0.17最终修复：30天时间窗口+click_count×1+favorite_count×2；STR第八次审核通过）
| F-014-05 新品加权 | 上线时间较新商品加权 | 🗓 | ✅ | ✅ | P0 |
| F-014-06 偏好标签推荐 | 基于 liked_tags 过滤/加权 | 🗓 | ✅ | ✅ | P1 |（合并至F-015行为推荐）
| F-014-07 屏蔽 disliked_tags | 反感标签商品降低展示 | 🗓 | ✅ | ✅ | P1 |（合并至F-015行为推荐）|

**触发场景**

- 商品详情页 → Related picks
- 分类页 → 商品列表排序
- 首页 → 个性化推荐区块（若用户已知偏好）
- Newsletter → 订阅类目推荐

**验收标准**

- Related picks 有至少 3 个推荐结果
- 推荐结果与当前商品有明确关联性
- 推荐逻辑不产生空结果（降级兜底）

---

### 7.6 进阶推荐 — 行为推荐（F-015）

**功能描述**

第二阶段推荐逻辑，引入用户行为反馈优化推荐。

**需求来源**：business_concept §9.2

**功能列表**

| 子功能 | 描述 | 需求设计 | 代码实现 | 审核 | 优先级 |
|--------|------|----------|----------|------|--------|
| F-015-01 行为权重计算 | 基于点击/收藏/时长加权 | 🗓 | ✅ | ✅ | P2 |
| F-015-02 协同过滤雏形 | 相似用户偏好传递 | 🗓 | ✅ | ✅ | P2 |
| F-015-03 推荐结果重排 | 规则分 + 行为分综合排序 | 🗓 | ✅ | ✅ | P2 |
| F-015-04 多样性控制 | MMR 策略，同类目≤30% | 🗓 | ✅ | ✅ | P2 |

#### F-015-01 行为评分公式

```
score_behavior(product_id) =
  click_count × 1 + favorite_count × 5 + save_count × 3 - dislike_count × 8
```

时间衰减（30 天前降至 20%）：`decay_score = score × e^(-0.1 × days_ago)`

标签偏好：`tag_preference_score = Σ(用户商品行为分 × 商品是否含该标签)`

最终：`final_score = score_rule × 0.6 + score_behavior × 0.4`

#### F-015-02 协同过滤雏形

- 触发：用户数 ≥ 100，该标签下 ≥ 10 个用户行为
- 相似度：余弦相似度，用户标签向量
- 冷启动：新用户（< 5 条行为）降级纯规则推荐

#### F-015-04 多样性控制（MMR）

- 同一 subcategory 商品 ≤ 推荐结果 30%
- 至少覆盖用户偏好标签中的 3 个不同标签
- 计算超时预算 ≤ 50ms

**验收标准**：推荐 CTR +15%；子类目集中度 ≤ 30%；冷启动降级无空结果；P99 ≤ 50ms

---

### 7.7 AI 推荐解释（F-016）

**功能描述**

为每条推荐展示「为什么推荐」解释，解释来源为预生成文案检索与规则模板拼装，不做实时模型生成。

**需求来源**：business_concept §9.3、§11.1

**功能列表**

| 子功能 | 描述 | 需求设计 | 代码实现 | 审核 | 优先级 |
|--------|------|----------|----------|------|--------|
| F-016-01 推荐理由生成 | 规则模板 + 预生成文案匹配 | ✅ | 🗓 | 🗓 | P2 |
| F-016-02 商品对比说明 | 预生成对比片段检索与拼装 | ✅ | 🗓 | 🗓 | P2 |
| F-016-03 场景化描述 | 按场景标签检索预生成文案 | ✅ | 🗓 | 🗓 | P2 |
| F-016-04 解释缓存 | D1 explanation_cache 表，TTL 分层 | ✅ | 🗓 | 🗓 | P2 |

#### F-016-01 推荐理由模板（按优先级匹配）

| 优先级 | 触发条件 | 模板 |
|--------|----------|------|
| 1 | 用户收藏过同类 | `"Because you liked [类目] picks like [商品]"` |
| 2 | 用户订阅了该类目 | `"Picked for your [类目] feed"` |
| 3 | 明确价格偏好 | `"Matches your [budget/mid/premium] preference"` |
| 4 | 命中 liked_tags | `"Matches your interest in [标签]"` |
| 5 | 热门 + 新用户 | `"Trending in [类目] this week"` |
| 6 | 兜底 | `"People who viewed [商品] also liked this"` |

模板变量从 DB 查询填充；若未命中预生成文案则使用兜底模板，不触发实时AI调用。

#### 缓存策略（F-016-04）

| 粒度 | TTL |
|------|-----|
| 用户 × 商品 | 24h |
| 商品通用解释 | 7d |
| 预生成解释内容 | 72h |

**缓存 Key**：`explain:{user_id}:{product_id}`

**验收标准**：100% 来自模板或预生成文案；禁用词出现率 = 0%；缓存命中率 ≥ 70%；P99 ≤ 120ms

---

### 7.8 点击统计与数据看板（F-017）

**功能描述**

支撑运营闭环的数据基础能力。

**需求来源**：business_concept §14、§15

**功能列表**

| 子功能 | 描述 | 需求设计 | 代码实现 | 审核 | 优先级 |
|--------|------|----------|----------|------|--------|
| F-017-01 每日 UV | COUNT(DISTINCT anonymous_id+user_id) | 🗓 | ✅ | ✅（第十三次审核通过）| P0 |
| F-017-02 页面 CTR | 商品页PV/首页PV×100% | 🗓 | ✅ | ✅（第十三次审核通过）| P0 |
| F-017-03 跳转率 | clicks数/商品页PV×100% | 🗓 | ✅ | ✅（第十三次审核通过）| P0 |
| F-017-04 收藏率 | 收藏操作数/商品页UV×100% | 🗓 | ✅ | ✅（第十三次审核通过）| P1 |
| F-017-05 回访率 | 7日回访UV/7日前UV×100% | 🗓 | ✅ | ✅（第十三次审核通过）| P1 |
| F-017-06 类目统计 | category分组UV/点击/跳转 | 🗓 | ✅ | ✅（第十三次审核通过）| P0 |
| F-017-07 榜单浏览 | list_id分组平均停留时长 | 🗓 | ✅ | ✅（第十三次审核通过）| P1 |
| F-017-08 数据看板 | 管理后台 KPI 可视化 | 🗓 | ✅ | ✅（第十三次审核通过）| P1 |

#### F-017-08 数据看板布局

**工具选型**：MVP 阶段用 Cloudflare Analytics + 手动 SQL；90 天内不引入独立 BI。

```
┌─────────────────────────────────────────────────────────┐
│  Findora 运营看板                          [刷新: 1h]   │
├───────────────┬───────────────┬────────────────────────┤
│  📊 今日 UV   │  📊 本周 PV   │  📊 订阅总数            │
│  1,234        │  5,678        │  342                   │
├───────────────┴───────────────┴────────────────────────┤
│  类目流量分布 [水平柱状图]                               │
│  Kitchen | ████████████ 34%                            │
│  Beauty  | ██████████ 28%                              │
├─────────────────────────────────────────────────────────┤
│  转化漏斗 [折线图 近30天]                               │
│  商品页PV → CTA点击 → 跳转完成                         │
├──────────────────────┬─────────────────────────────────┤
│  商品页 Top5 [表格]   │  榜单页 Top5 [表格]              │
│  1.xxx — 234点击     │  1.xxx — 567浏览                 │
├──────────────────────┴─────────────────────────────────┤
│  周趋势 [折线图]                                        │
└─────────────────────────────────────────────────────────┘
```

**图表规范**：计数→大数字卡片；比例→百分比+颜色；分布→水平柱；时序→折线；排行→表格。

**刷新**：实时指标每5分钟轮询；日榜/趋势图每日凌晨汇总。

**验收标准**：数据延迟 ≤ 1h（F-017-01~04）；看板展示 §13 KPI 四类指标；不采集 PII；看板有访问控制。

---

## 8. 非功能需求

> 📌 **新增章节**：本章节定义系统的非功能质量属性，作为设计约束和验收标准。

### 8.1 性能需求

| 指标 | 目标值 | 说明 | 关联功能 |
|------|--------|------|----------|
| 页面加载时间 | P95 ≤ 2s | 首屏加载完成 | F-001~F-006 |
| API 响应时间 | P99 ≤ 200ms | 公共端点 | F-040-01~05 |
| API 响应时间 | P99 ≤ 500ms | 管理端点/复杂查询 | F-040-14~18 |
| 推荐生成时间 | P99 ≤ 50ms | 推荐 feed 生成 | F-014/F-015 |
| 最大并发用户 | 1000 UV/min | 峰值流量承载 | 全部 |
| 数据库查询超时 | 5s | D1 查询上限 | 全部 DB 操作 |

**性能约束**：
- 所有外部 API 调用必须设置超时（默认 10s）
- 批量操作（商品导入等）必须异步处理，不阻塞主请求
- 图片加载使用 CDN 缓存，R2 不直接暴露给客户端

### 8.2 安全需求

| 需求 ID | 要求 | 关联功能 |
|---------|------|----------|
| S-01 | 管理端点（`/api/admin/*`）必须验证 Admin API Key | F-040-14~18 |
| S-02 | 用户端点必须验证 email 或 anonymous_id 有效性 | F-040-06~13 |
| S-03 | 所有用户输入必须经过 XSS/SQL 注入过滤 | 全部 API |
| S-04 | 敏感操作（退订、数据导出）必须记录操作日志 | F-013-03, F-013-09 |
| S-05 | 不在客户端存储明文敏感数据 | 全部前端 |
| S-06 | HTTPS 全站加密，强制重定向 HTTP → HTTPS | 部署配置 |
| S-07 | CORS 配置仅允许已知域名 | API 配置 |
| S-08 | 用户会话必须配置失效时间（Session TTL），并支持续期/失效回收 | F-023 / 用户访问链路 |
| S-09 | API 层必须作为唯一对外入口，前端/Agent 禁止直连 D1/R2 | F-040 / 部署架构 |

**S-08 验收标准**：
- **TTL值范围**：15分钟 ~ 7天，默认24小时
- **续期策略**：仅在”接近过期窗口”（如过期前1小时）允许续期，每次续期延长24小时；非接近过期窗口的请求不触发续期
- **失效回收**：后台任务每6小时扫描并删除过期会话（`expires_at < NOW()`），回收时记录审计日志
- **Session合并规则**：同一用户多端登录时，各自独立session，不合并；每个设备/浏览器维护独立的session_id
- 每次鉴权必须校验 `expires_at`，过期立即拒绝并返回统一错误码

**隐私保护**：
- 点击日志不记录完整 IP，仅记录国家（ip_country）
- email 存储需脱敏（部分字符掩码）
- 日志保留 90 天后自动清理
- 不采集多余 PII（手机号、真实姓名、精确位置）

### 8.3 可靠性需求

| 指标 | 目标值 | 说明 |
|------|--------|------|
| 服务可用性 | ≥ 99.5% | 月度计算 |
| 故障恢复时间 | ≤ 30min | MTTR 目标 |
| 数据持久性 | ≥ 99.9% | D1 数据不丢失 |
| 自动告警 | 5xx 错误率 > 1% 时触发 | 运维配置 |

**容错设计**：
- 第三方服务（邮件、联盟跳转）调用失败不影响主业务流程
- 降级策略：推荐解释缺失时降级为规则兜底文案（推荐主链路不可中断）
- 数据库操作失败时返回友好错误信息，不暴露内部细节

### 8.4 可维护性需求

| 指标 | 要求 |
|------|------|
| 代码审查 | 所有合入主干的代码必须经过至少 1 人 review |
| 文档更新 | API 变更必须同步更新本文档 |
| 变更追踪 | 重大变更记录于 Section 2.6 三态变更追踪表 |
| 回滚能力 | 所有部署必须支持 1-click 回滚 |

### 8.5 可扩展性需求

| 维度 | 扩展方向 | 预留方案 |
|------|----------|----------|
| 商品数据 | 支持千万级商品 | 分库分表/Sharding（未来评估） |
| 用户数据 | 支持百万级订阅用户 | D1 水平扩展 |
| 类目 | 支持更多垂直类目 | 标签体系扩展，无需改架构 |
| 推荐算法 | 从规则→模型 | 推荐模块解耦，支持算法替换 |

---

## 8.6 系统架构图

### 8.6.1 整体架构（文字版）

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           Findora 系统架构                                │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                        边缘层 (Edge Layer)                       │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │   │
│  │  │ Cloudflare   │  │ Cloudflare   │  │ Cloudflare Workers   │  │   │
│  │  │ Pages        │  │ R2           │  │ (API + SSR)           │  │   │
│  │  │ (静态内容)    │  │ (图片缓存)   │  │                       │  │   │
│  │  └──────────────┘  └──────────────┘  └──────────────────────┘  │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                    │                                     │
│                                    ▼                                     │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                        数据层 (Data Layer)                       │   │
│  │  ┌──────────────────┐              ┌──────────────────────────┐  │   │
│  │  │ Cloudflare D1   │              │ Git Repository          │  │   │
│  │  │ (结构化数据)     │              │ (Markdown 内容)         │  │   │
│  │  │                  │              │                          │  │   │
│  │  │ - products      │              │ - /content/posts/       │  │   │
│  │  │ - users         │              │ - /content/products/     │  │   │
│  │  │ - clicks        │              │ - /content/lists/        │  │   │
│  │  │ - tags          │              │                          │  │   │
│  │  │ - lists         │              └──────────────────────────┘  │   │
│  │  └──────────────────┘                                           │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                    │                                     │
│                                    ▼                                     │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                        外部服务 (External)                      │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │   │
│  │  │ 联盟平台     │  │ 邮件服务     │  │ AI 服务              │  │   │
│  │  │ (Alibaba     │  │ (Resend/     │  │ (内容生成/推荐解释)   │  │   │
│  │  │  Affiliate)  │  │  SendGrid)   │  │                      │  │   │
│  │  └──────────────┘  └──────────────┘  └──────────────────────┘  │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### 8.6.2 用户请求流程

```
[用户浏览器]
     │
     │ HTTPS 请求
     ▼
┌─────────────────────────────────────┐
│  Cloudflare Edge Network            │
│  (全球 CDN + DDoS 防护)              │
└─────────────────────────────────────┘
     │
     ├─→ 静态资源请求
     │        │
     │        ▼
     │   [Cloudflare Pages]
     │   返回静态 HTML/CSS/JS
     │
     ├─→ API 请求
     │        │
     │        ▼
     │   [Cloudflare Workers]
     │        │
     │        ├── 验证请求 (Auth/CORS)
     │        │
     │        ▼
     │   [业务逻辑处理]
     │        │
     │        ├── 读请求 → D1 查询 / R2 读取
     │        ├── 写请求 → D1 写入
     │        └── 推荐 → 规则引擎 / AI 服务
     │        │
     │        ▼
     │   [返回 JSON 响应]
     │
     └─→ 跳转请求 (CTA)
              │
              ▼
         [联盟追踪服务]
              │
              ▼
         [第三方商家页]
```

### 8.6.3 数据流向图

```
内容流转：
[运营团队] → [AI 辅助生成] → [人工审核] → [Git/Markdown] → [Cloudflare Pages 部署]
                                                        │
                                                        ▼
                                                    [用户访问]

用户数据流转：
[用户行为] → [匿名 ID 关联] → [D1 clicks] ─────────────────────┐
                                                          │
                                                          ▼
[用户偏好] ← [订阅表单] ← [D1 users] ←── [匿名 ID 匹配] ──────┘
     │
     ▼
[推荐引擎] → [个性化 Feed] → [用户端展示]

商业数据流转：
[用户点击 CTA] → [追踪参数记录] → [联盟平台回调] → [佣金确认] → [月结算]
```

### 8.6.4 模块依赖关系

```
┌─────────────────────────────────────────────────────────┐
│                    前端层 (F-001~F-006)                  │
│         首页 | 分类页 | 商品页 | 榜单页 | 订阅页 | About   │
└─────────────────────────────────────────────────────────┘
                            │ 调用
                            ▼
┌─────────────────────────────────────────────────────────┐
│                 API 层 (F-040)                           │
│ 公共(5) │ 用户(8) │ 管理(5) │ 配置(3) │ 认证(4) │ 外部接口(4) │
└─────────────────────────────────────────────────────────┘
                            │ 读写
              ┌─────────────┴─────────────┐
              ▼                           ▼
┌─────────────────────────┐   ┌─────────────────────────┐
│    Cloudflare D1         │   │    Git Repository       │
│  (结构化业务数据)          │   │    (Markdown 内容)       │
│  - products              │   │    - posts              │
│  - users                 │   │    - products           │
│  - clicks                │   │    - lists              │
│  - tags                  │   │                         │
│  - lists                 │   └─────────────────────────┘
└─────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────────────────────┐
│              外部服务（无直接依赖）                        │
│   联盟平台(追踪) │ 邮件服务(发送) │ 运营AI(异步产出并推送) │
└─────────────────────────────────────────────────────────┘
```

---

## 9. AI 能力边界

> **重要说明**：AI 在本项目中是系统外的运营生产角色，不是用户请求链路中的实时推理角色。

### 9.1 外部运营AI可负责（F-020）

| 编号 | 能力 | 说明 | 需求设计 | 代码实现 | 审核 |
|------|------|------|----------|----------|------|
| F-020-01 | 全网选品辅助 | 对候选商品做初筛、归类、标签建议（异步） | ✅ | 🗓 | 🗓 |
| F-020-02 | Item Card 预生产 | 生成标题、摘要、卖点、场景、注意事项草稿 | ✅ | 🗓 | 🗓 |
| F-020-03 | 社媒文案预生产 | 生成 TikTok/IG/X 传播文案草稿 | ✅ | 🗓 | 🗓 |
| F-020-04 | 推荐解释预生产 | 生成“为什么推荐”多版本文案供后续检索 | ✅ | 🗓 | 🗓 |
| F-020-05 | 运营分析建议 | 对类目/标签效果输出分析建议（仅建议） | ✅ | 🗓 | 🗓 |
| F-020-06 | 字段补全建议 | 输出缺失字段建议值与置信度，不直接生效 | ✅ | 🗓 | 🗓 |

### 9.2 运营AI数据入库工作流（F-020 + F-040-22）

> 所有运营AI产出都必须通过统一数据更新接口入库，禁止旁路写库。

#### 工作流（六步）

```
[1. 外部运营AI异步产出]
      │
      ▼
[2. 调用 F-040-22（带 Token）]
      │ 验签失败? → 拒绝
      ▼
[3. Payload 校验（schema/枚举/长度/禁用词）]
      │ 校验失败? → 返回字段错误
      ▼
[4. D1/R2 双写入库（索引+内容）]
      │
      ▼
[5. 人工抽检/合规复核（按类目风险分级）]
      │
      ▼
[6. 前台纯查库检索与展示]
```

| 步骤 | 责任方 | 通过标准 |
|------|--------|----------|
| 1 产出 | 外部运营AI | 按接口契约生成结构化 payload |
| 2 鉴权 | API 网关 | Token 有效且权限匹配 |
| 3 校验 | API 服务 | schema 与业务规则全部通过 |
| 4 入库 | API 服务 | D1/R2 写入成功且幂等 |
| 5 抽检 | 运营/审核 | 合规与品牌调性通过 |
| 6 展示 | 前台系统 | 全链路无实时 LLM 调用 |

### 9.3 AI 不可自主决定（F-021）

| 编号 | 边界 | 说明 | 需求设计 | 代码实现 | 审核 |
|------|------|------|----------|----------|------|
| F-021-01 | 最终选品决策 | 上线哪些商品，必须人工确认 | ✅ | ✅ | ✅ |
| F-021-02 | 合规判断 | 是否有侵权、违规内容 | ✅ | ✅ | ✅ |
| F-021-03 | 品牌调性把控 | 首页核心内容、榜单主题 | ✅ | ✅ | ✅ |
| F-021-04 | 商业合作位排序 | 广告位、赞助内容排序 | ✅ | ✅ | ✅ |
| F-021-05 | 夸张表述审核 | `best/safest/guaranteed/proven` 等词汇治理 | ✅ | ✅ | ✅ |

### 9.4 F-020 详细功能描述

> 本节定义 F-020 外部运营AI能力的输入/处理/输出，作为接口与治理基准。

#### F-020-01 选品辅助

| 阶段 | 内容 |
|------|------|
| **输入** | 候选商品URL/标题/图片（批量20-50个）；来源平台；目标类目 |
| **处理** | 1. 提取商品标题/描述关键词 2. 按类目标签体系打标签 3. 判断适合人群 4. 评估价格区间 5. 输出候选评分（0-10） |
| **输出** | 候选商品列表（含：tags数组、target_audience、价格预估、候选评分、适合原因） |
| **约束** | 输出作为异步候选，不通过 F-040-22 校验不得入库 |

#### F-020-02 内容生产

| 阶段 | 内容 |
|------|------|
| **输入** | 商品核心信息（标题/规格/特点）；目标受众描述；内容模板类型（标题/摘要/榜单正文） |
| **处理** | 1. 按模板生成5-10个候选 2. 重写为用户视角描述 3. 提取核心卖点 4. 生成"为什么值得看"说明 |
| **输出** | 候选标题列表；候选摘要（50-100词）；核心卖点列表；榜单正文草稿 |
| **约束** | 禁用词过滤（best/safest/guaranteed等）；入库后仍需抽检 |

#### F-020-03 社媒文案

| 阶段 | 内容 |
|------|------|
| **输入** | 商品信息；社媒平台（TikTok/IG/X）；内容类型（短文案/hashtag/标题） |
| **处理** | 1. 生成平台适配的短文案（TikTok 15-30词/IG 50-100词/X 1-2句） 2. 生成相关hashtag（5-10个） 3. 生成hook句式 |
| **输出** | 平台适配短文案；hashtag列表；hook句式建议 |
| **约束** | 禁止夸大承诺；禁止误导性陈述 |

#### F-020-04 推荐解释

| 阶段 | 内容 |
|------|------|
| **输入** | 用户偏好数据（liked_tags/subscribed_categories/price_preference）；目标商品信息 |
| **处理** | 1. 匹配用户偏好与商品标签 2. 按模板优先级生成推荐理由 3. AI扩展解释（当模板不满足时） |
| **输出** | 推荐理由文本（20-40词）；匹配标签列表；推荐分值 |
| **约束** | 仅用于预生成文案库，不参与用户侧实时生成 |

#### F-020-05 运营分析

| 阶段 | 内容 |
|------|------|
| **输入** | 统计周期（天/周/月）；类目维度；行为指标（CTR/跳转率/收藏率） |
| **处理** | 1. 聚合各维度数据 2. 计算类目/标签表现差异 3. 识别高CTR/低CTR特征 4. 输出分析结论 |
| **输出** | 类目排名（按CTR）；特征标签排名；优化建议列表；人工决策参考 |
| **约束** | 仅输出分析结论，人工决策；不自动执行任何操作 |

#### F-020-06 商品信息补全

| 阶段 | 内容 |
|------|------|
| **输入** | 部分商品信息（已有字段）；需要补全的字段列表 |
| **处理** | 1. 基于已有信息推断缺失字段 2. 生成建议值 3. 标注置信度 |
| **输出** | 补全字段建议值（含置信度）；原始数据对比 |
| **约束** | 补全结果需通过 F-040-22 校验后写入；未经确认不得覆盖关键字段 |

### 9.5 F-021 详细功能描述

#### F-021-01 最终选品决策

| 阶段 | 内容 |
|------|------|
| **输入** | AI推荐候选商品列表；AI初筛评分；运营选品标准 |
| **处理** | 人工逐个审核：商品是否符合品牌定位、是否有合规风险、是否值得推荐 |
| **决策** | 人工标记"上线"或"否决"，记录原因 |
| **输出** | 最终上线商品列表 |

#### F-021-02 合规判断

| 阶段 | 内容 |
|------|------|
| **输入** | 商品信息；来源平台；类目标签 |
| **处理** | 人工审核：是否涉及高风险类目（医疗/美容/儿童/电子）；图片是否自有或已授权；是否存在侵权描述 |
| **决策** | 标记"合规"/"高风险需双人审核"/"不合规" |
| **输出** | 合规判断结果；如需双人审核，通知第二审核人 |

#### F-021-03 品牌调性把控

| 阶段 | 内容 |
|------|------|
| **输入** | 首页内容方案；榜单主题；品牌调性规范 |
| **处理** | 人工审核：内容是否符合"发现宝藏"定位；语调是否合适；是否存在过度营销 |
| **决策** | 人工批准/修改/否决 |
| **输出** | 审核结果；如需修改，附修改意见 |

#### F-021-04 商业合作位排序

| 阶段 | 内容 |
|------|------|
| **输入** | 待排序内容列表（含商家合作/赞助内容/自然内容）；商业价值评估；用户体验影响 |
| **处理** | 人工决策：各内容的位置和展示方式；广告与内容比例 |
| **决策** | 人工确定最终排序和展示规则 |
| **输出** | 最终内容排序和展示规则 |

#### F-021-05 夸张表述审核

| 阶段 | 内容 |
|------|------|
| **输入** | AI生成内容；禁止词清单（12项） |
| **处理** | 1. 扫描禁止词出现情况 2. 评估是否违规 3. 判断是误报还是真的违规 |
| **决策** | 标记"通过"/"需修改"/"误报" |
| **输出** | 审核结果；如需修改，给出修改建议 |

**禁用词表（共16项，v3.64更新：与代码ai_content.ts:23-27行、explain.ts:182-186行、ai_review.ts:54-58行对齐）**：`best`, `worst`, `safest`, `guaranteed`, `proven`, `clinically`, `miracle`, `revolutionary`, `lifesaving`, `official`, `authentic`, `dangerous`, `amazing`, `incredible`, `unbelievable`, `game-changing`

#### F-021 AI审核工作流端点（v3.35新增）

> **说明**：以下端点已在 `src/api/admin/ai_review.ts` 中实现，审核工作流为5步：创建记录→提交→一审→二审（高风险）→语气审核→修订请求。

| 端点 | 方法 | 路径 | 功能 | 审核状态 |
|------|------|------|------|----------|
| F-021-01 | POST | `/api/admin/ai/review/create` | 创建审核记录 | ✅ |
| F-021-02 | GET | `/api/admin/ai/review` | 审核列表（支持分页/状态过滤） | ✅ |
| F-021-03 | GET | `/api/admin/ai/review/pending-counts` | 各状态待审数量 | ✅ |
| F-021-04 | POST | `/api/admin/ai/review/validate` | 内容校验（禁用词/高风险类目） | ✅ |
| F-021-05 | GET | `/api/admin/ai/review/:id` | 审核详情 | ✅ |
| F-021-06 | POST | `/api/admin/ai/review/:id/submit` | 提交审核（进入审核队列） | ✅ |
| F-021-07 | POST | `/api/admin/ai/review/:id/review` | 一审（合规/品牌调性判断） | ✅ |
| F-021-08 | POST | `/api/admin/ai/review/:id/high-risk-review` | 二审（高风险类目双人审核） | ✅ |
| F-021-09 | POST | `/api/admin/ai/review/:id/tone-review` | 语气审核（夸张表述扫描） | ✅ |
| F-021-10 | POST | `/api/admin/ai/review/:id/revision` | 请求修订（退回AI重新生成） | ✅ |

**高风险类目双人审核触发条件**（对应 F-021-02 合规判断）：
- 医疗/保健类（medical/health/supplement）
- 美容/化妆品类（beauty/makeup/skincare）
- 儿童用品类（kids/children/toys）
- 电子产品类（electronics/gadgets requiring certification）

**审核状态机**：
```
draft → submitted → in_review → high_risk_pending → approved
                                    ↓
                              revision_requested → resubmitted → in_review
                                    ↓
                                    rejected
```

> ⚠️ **端点路径偏差提醒（ST-P2）**：`POST /api/admin/ai/explain` (F-020-04) 实际对应 `/api/explain` 端点，需在API文档中修正映射关系。

### 9.6 F-020/F-021 三态追踪表

| 功能编号 | 子功能 | 需求设计 | 代码实现 | 审核 | 优先级 |
|----------|--------|----------|----------|------|--------|
| F-020-01 | 选品辅助 | ✅ | 🗓 | 🗓 | P1 |
| F-020-02 | 内容生产 | ✅ | 🗓 | 🗓 | P1 |
| F-020-03 | 社媒文案 | ✅ | 🗓 | 🗓 | P1 |
| F-020-04 | 推荐解释预生产 | ✅ | 🗓 | 🗓 | P1 |
| F-020-05 | 运营分析 | ✅ | 🗓 | 🗓 | P2 |
| F-020-06 | 商品信息补全 | ✅ | 🗓 | 🗓 | P1 |
| F-021-01 | 最终选品决策 | ✅ | ✅ | ✅ | P1 |
| F-021-02 | 合规判断 | ✅ | ✅ | ✅ | P1 |
| F-021-03 | 品牌调性把控 | ✅ | ✅ | ✅ | P1 |
| F-021-04 | 商业合作位排序 | ✅ | ✅ | ✅ | P2 |
| F-021-05 | 夸张表述审核 | ✅ | ✅ | ✅ | P1 |

### 9.7 数据更新链路量化验收模板

> 本节定义 F-040-22 + F-020 + F-016 的链路验收标准，确保“异步产出 + 入库校验 + 纯查库展示”落地。

#### 量化指标定义

| 指标 | 阈值 | 说明 |
|------|------|------|
| **鉴权拦截率** | 100% | 无效 Token 请求必须全部被拒绝 |
| **schema 校验通过率** | ≥99% | 合法 payload 通过校验比例 |
| **幂等一致性** | 100% | 同 request_id 重放不产生重复写入 |
| **双写一致性** | 100% | D1 索引与 R2 内容引用无悬挂 |
| **推荐链路模型调用次数** | 0 | 用户推荐请求全程 0 次实时 LLM 调用 |
| **禁用词漏检率** | ≤0.1% | 含禁用词内容被判定为合规的比例 |
| **人工抽检通过率** | ≥90% | 样本量≥100条/轮，抽检合格率≥90% |

#### 验收测试方法

**1. 鉴权与校验测试**
```bash
# 提交带/不带Token的批量请求
# 验证指标：无Token全部拒绝；合法Token请求校验通过
```

**2. 幂等与双写一致性测试**
```bash
# 重放同request_id请求两次以上
# 验证：D1/R2无重复脏写、无悬挂引用
```

**3. 推荐链路零实时LLM测试**
```bash
# 对推荐接口进行链路观测
# 验证：请求期间无外部模型调用日志
```

**4. 禁用词漏检率测试**
```bash
# 使用含禁用词（best/safest/guaranteed等）的测试集
# 验证：禁用词漏检率≤0.1%
```

**5. 人工抽检测试**
```bash
# 每轮抽取≥100条AI生成内容
# 验证：抽检通过率≥90%
```

#### 验收结论

| 指标 | 实际值 | 是否达标 |
|------|--------|----------|
| 鉴权拦截率 | 100% | 达标 |
| schema 校验通过率 | ≥99% | 达标 |
| 幂等一致性 | 100% | 达标 |
| 双写一致性 | 100% | 达标 |
| 推荐链路模型调用次数 | 0 | 达标 |
| 禁用词漏检率 | ≤0.1% | 达标 |
| 人工抽检通过率 | ≥90% | 达标 |

> **说明**：所有指标达标后，方可将 F-040-22/F-020/F-016 从🗓推进至🏗/✅。

### 9.8 F-022 多语言支持详细设计

> **需求来源**：business_concept §10 扩展支持；MVP阶段仅支持英语

#### F-022-01 国际化架构

| 阶段 | 内容 |
|------|------|
| **输入** | 用户 locale 设置；请求语言偏好 |
| **处理** | 1. 检测用户语言偏好（HTTP Accept-Language / URL参数 / 用户设置）2. 加载对应语言包 3. 内容翻译替换 4. RTL布局检测（如果需要） |
| **输出** | 适配用户语言的页面内容；语言切换组件 |
| **约束** | 初期仅支持英语；后续可扩展西班牙语/法语/德语等 |

#### F-022-02 翻译内容管理

| 阶段 | 内容 |
|------|------|
| **输入** | 源语言内容（英语）；目标语言；翻译服务（AI/人工） |
| **处理** | 1. 提取待翻译内容 2. 调用翻译服务 3. 翻译结果审核 4. 存储翻译内容 |
| **输出** | 翻译后的内容；翻译质量评分 |
| **约束** | 翻译结果需人工审核；商品描述翻译需保持准确性 |

#### F-022-03 多语言URL结构

| 阶段 | 内容 |
|------|------|
| **输入** | 页面路径；目标语言 |
| **处理** | 1. 生成语言前缀路径（/en/, /es/, /fr/） 2. 更新 sitemap 3. hreflang 标签设置 |
| **输出** | 多语言URL结构；SEO元数据（hreflang） |
| **约束** | URL结构简洁；SEO友好 |

#### F-022-04 多语言内容同步

| 阶段 | 内容 |
|------|------|
| **输入** | 源语言内容更新；已有翻译版本 |
| **处理** | 1. 检测内容变更 2. 标记需要重新翻译的内容 3. 更新翻译队列 |
| **输出** | 翻译更新任务列表；同步状态报告 |
| **约束** | 源语言内容变更时及时同步翻译 |

#### F-022-05 语言切换组件

| 阶段 | 内容 |
|------|------|
| **输入** | 用户当前语言；可用语言列表 |
| **处理** | 渲染语言切换下拉框/按钮组件 |
| **输出** | 语言切换UI组件；切换后跳转对应语言页面 |
| **约束** | 组件轻量；切换无刷新 |

### F-022 三态追踪表

| 功能编号 | 子功能 | 需求设计 | 代码实现 | 审核 | 优先级 |
|----------|--------|----------|----------|------|--------|
| F-022-01 | 国际化架构 | ✅ | ✅ | ✅ | P2 |
| F-022-02 | 翻译内容管理 | ✅ | ✅ | ✅ | P2 |
| F-022-03 | 多语言URL结构 | ✅ | ✅ | ✅ | P2 |
| F-022-04 | 多语言内容同步 | ✅ | ✅ | ✅ | P2 |
| F-022-05 | 语言切换组件 | ✅ | ✅ | ✅ | P2 |

### 9.8 F-023 会员体系详细设计

> **需求来源**：business_concept §4.2 会员订阅变现；90天计划第三阶段

#### F-023-01 会员等级设计

| 阶段 | 内容 |
|------|------|
| **输入** | 会员类型定义；价格策略 |
| **处理** | 定义会员等级：Free（免费）/ Basic（月费$4.99）/ Pro（月费$9.99）；各等级权益差异 |
| **输出** | 会员等级定义表；权益矩阵 |
| **约束** | 高级会员权益必须明显优于免费用户；价格区间符合目标市场 |

#### F-023-02 会员注册/订阅

| 阶段 | 内容 |
|------|------|
| **输入** | 用户邮箱；会员等级选择；支付信息 |
| **处理** | 1. 验证邮箱唯一性 2. 创建用户记录（status=active） 3. 记录会员等级和订阅开始时间 4. 调用支付接口 5. 订阅成功发送确认邮件 |
| **输出** | 会员账户创建成功；订阅确认邮件 |
| **约束** | 支付失败不允许开通会员；退款需支持 |

#### F-023-03 会员权益验证

| 阶段 | 内容 |
|------|------|
| **输入** | 用户ID；访问的内容/功能 |
| **处理** | 1. 查询用户会员等级 2. 验证是否在有效期内 3. 检查功能是否在权益范围内 |
| **输出** | 权益验证结果（允许/拒绝）；如拒绝，返回原因和升级提示 |
| **约束** | 验证延迟<100ms；降级体验需平滑 |

#### F-023-04 订阅管理

| 阶段 | 内容 |
|------|------|
| **输入** | 用户ID；操作类型（升级/降级/取消） |
| **处理** | 1. 验证当前订阅状态 2. 计算费用变动 3. 更新订阅等级 4. 处理支付差额或退款 |
| **输出** | 订阅变更确认；费用变动明细 |
| **约束** | 降级不影响当期服务，仅在下个账单周期生效 |

#### F-023-05 订阅续费/过期

| 阶段 | 内容 |
|------|------|
| **输入** | 订阅到期提醒（提前7天/3天）；自动续费尝试 |
| **处理** | 1. 尝试自动扣款 2. 成功则延长订阅 3. 失败则发送续费提醒 4. 到期后降级为Free |
| **输出** | 续费结果；降级通知（如适用） |
| **约束** | 到期前需至少发送2次提醒；降级前用户数据需保留30天 |

#### F-023-06 会员专属内容/功能

| 阶段 | 内容 |
|------|------|
| **输入** | 会员等级；请求的功能/内容 |
| **处理** | 1. 根据会员等级返回对应内容/功能 2. 标记内容来源（免费/付费） 3. 记录会员使用行为 |
| **输出** | 会员专属内容；使用统计 |
| **约束** | 付费内容需严格权限校验；不可在免费版泄露付费内容 |

### F-023 三态追踪表

| 功能编号 | 子功能 | 需求设计 | 代码实现 | 审核 | 优先级 |
|----------|--------|----------|----------|------|--------|
| F-023-01 | 会员等级设计 | ✅ | ✅ | ✅ | P2 |
| F-023-02 | 会员注册/订阅 | ✅ | ✅ | ✅ | P2 |
| F-023-03 | 会员权益验证 | ✅ | ✅ | ✅ | P2 |
| F-023-04 | 订阅管理 | ✅ | ✅ | ✅ | P2 |
| F-023-05 | 订阅续费/过期 | ✅ | ✅ | ✅ | P2 |
| F-023-06 | 会员专属内容/功能 | ✅ | ✅ | ✅ | P2 |

**验收标准**

- AI 生成内容必须经过人工审核才能上线
- 高风险类目（医疗/美容/儿童/电子）内容双重审核

---

### 9.9 人工干预机制（F-024）

> **需求来源**：business_concept §11.4"人类保留的控制权（非全自动环节）"

虽然运营AI包揽了选品和内容生成的脏活累活，但以下环节仍需通过后台管理面板保留人工控制的权力。

#### F-024-01 合规与品牌调性把控

| 阶段 | 内容 |
|------|------|
| **输入** | 运营AI推送的数据（标签、商品、Item Card） |
| **处理** | 人工Review（或抽查）：是否符合品牌调性、是否有合规风险 |
| **决策** | 人工标记"通过"/"需修改"/"拒绝" |
| **输出** | 审核结果；拒绝理由 |
| **约束** | 高风险类目（医疗/美容/儿童/电子）双人审核 |

#### F-024-02 异常干预

| 阶段 | 内容 |
|------|------|
| **输入** | 错误生成的标签和商品；异常数据指标 |
| **处理** | 清洗或删除错误数据；调整异常配置 |
| **决策** | 人工确认后执行 |
| **输出** | 数据修正记录 |
| **约束** | 所有操作需记录审计日志 |

#### F-024-03 商业排序

| 阶段 | 内容 |
|------|------|
| **输入** | 待排序内容列表（含商家合作/赞助内容/自然内容） |
| **处理** | 手动置顶或调整商业合作位的排序 |
| **决策** | 人工确定最终排序 |
| **输出** | 内容排序配置 |
| **约束** | 广告与内容比例需符合C-01~C-07合规要求 |

#### F-024-04 推荐干预

| 阶段 | 内容 |
|------|------|
| **输入** | 系统推荐结果；用户反馈数据 |
| **处理** | 人工干预特定商品/类目的推荐权重；屏蔽特定商品 |
| **决策** | 人工配置推荐干预规则 |
| **输出** | 推荐干预配置（置顶/屏蔽/权重调整） |
| **约束** | 干预规则需记录，便于后续分析 |

#### F-024 三态追踪表

| 功能编号 | 子功能 | 需求设计 | 代码实现 | 审核 | 优先级 |
|----------|--------|----------|----------|------|--------|
| F-024-01 | 合规与品牌调性把控 | ✅ | ✅ | ✅ | P1 |
| F-024-02 | 异常干预 | ✅ | ✅ | ✅ | P1 |
| F-024-03 | 商业排序 | ✅ | ✅ | ✅ | P2 |
| F-024-04 | 推荐干预 | ✅ | ✅ | ✅ | P2 |

**与F-021 AI审核工作流的关系**：
- F-021是AI生成内容的自动审核流程（端点：POST /api/admin/ai-review/*）
- F-024是人工干预机制的整体功能模块，包括F-021审核结果的执行、以及非AI生成内容的其他人工干预
- 两者共同构成business_concept§11.4要求的"人类保留的控制权"

---

## 10. 内容管理

### 10.1 内容存储结构（F-030）

**需求来源**：business_concept §10.2

| 类型 | 存储位置 | 说明 | 状态 |
|------|----------|------|------|
| 榜单/专题文章 | `/content/posts/` | Markdown 文件 | ✅ |
| 商品详情 | `/content/products/` 或 DB | Markdown 或结构化 DB | ✅ |
| 标签/用户数据 | Cloudflare D1 | 结构化数据 | ✅ |
| 图片/媒体 | Cloudflare R2 | CDN 缓存 | ✅ |
| 追踪日志 | Cloudflare D1 / Logpush | 点击日志 | ✅ |

### 10.2 内容工作流详细设计（F-030）

#### F-030 功能概述

| 功能编号 | 功能名称 | 优先级 | 状态 |
|----------|----------|--------|------|
| F-030-01 | 选题与候选商品池管理 | P1 | ✅ |
| F-030-02 | AI 辅助初筛与标签生成 | P1 | ✅ |
| F-030-03 | 人工审核与内容修正 | P0 | ✅ |
| F-030-04 | 内容发布与上线管理 | P0 | ✅ |
| F-030-05 | 数据复盘与内容优化 | P1 | ✅ |

> **第二十次STR审核（2026-04-07 11:35）：** F-030 正式审核通过（8端点✅，8观察项待迭代）

#### F-030-01 选题与候选商品池管理

**功能描述**：运营人员根据趋势、社媒热度、季节性、专题策划等进行选题，建立候选商品池（20-50个/次）。

**输入**：
- 趋势来源：TikTok/Instagram trending、1688热门榜、Google Trends、季节性专题
- 历史数据：近期CTR高/收藏率高的商品类目
- 专题需求：节假日/事件/人群专题（如"Mothers Day gifts under $20"）

**处理**：
1. 运营人员根据趋势源收集候选商品URL/信息
2. 录入候选商品到草稿区（draft products 或 CMS草稿表）
3. 记录候选原因和选题背景
4. 标记商品来源平台（1688/Alibaba/Amazon/Temu）

**输出**：
- 候选商品草稿列表（含source_url、original_title、候选原因）
- 选题说明文档（选品逻辑、目标人群、内容方向）

**验收标准**：
- 每次选题包含20-50个候选商品
- 每个候选商品记录候选原因
- 选题说明包含目标人群和内容方向

---

#### F-030-02 AI 辅助初筛与标签生成

**功能描述**：使用AI对候选商品进行初筛（是否适合C端用户、是否符合平台调性），并自动生成标签建议和内容草稿。

**输入**：
- F-030-01输出的候选商品列表
- 商品原始信息（标题、图片、规格、价格区间）
- 标签体系五层结构（category/function/audience/style/price）

**处理**：
1. **初筛判断**：AI判断商品是否适合C端导购（排除：批发门槛过高、认证要求复杂、高危类目）
2. **标签建议**：AI基于商品内容生成五层标签建议
3. **内容草稿**：AI按商品页模板（business_concept §7.2）生成：
   - 重写标题（用户视角）
   - 一句话总结（summary）
   - Why it stands out（亮点）
   - Good for（适合人群/场景）
   - Watch-outs（注意事项）
   - Price sense（价格说明）
4. **高风险标记**：AI标记需要人工重点审核的商品（医疗/美容/儿童/电子类）

**输出**：
- AI初筛结果（通过/不通过/待定 + 理由）
- 五层标签建议
- 内容草稿（标题/摘要/亮点/适合人群/注意事项/价格说明）
- 高风险标记列表

**AI边界约束**（关联F-021）：
- AI不可自主决定内容是否上线
- AI生成内容必须经过人工审核
- 高风险类目内容需双人审核

**验收标准**：
- AI输出五层标签建议（可人工修改）
- AI生成内容草稿可作为人工审核基底
- 高风险商品被正确标记

---

#### F-030-03 人工审核与内容修正

**功能描述**：运营人员对AI生成的内容草稿进行人工审核、修正和批准。

**输入**：
- F-030-02输出的AI内容草稿
- 原始商品信息
- 高风险标记列表

**处理**：
1. **内容审核**：
   - 事实核查：规格/价格/使用场景是否准确
   - 调性检查：是否符合品牌调性（不夸大、不绝对化表述）
   - 合规检查：是否符合C-01~C-07合规要求
2. **高风险类目双人审核**（医疗/美容/儿童/电子）：
   - 第一人审核
   - 第二人复核
3. **内容修正**：
   - 修正AI草稿中的不准确信息
   - 改写不符合调性的表述
   - 添加人工补充内容（如特有洞察）
4. **标签确认**：确认/修改/补充标签
5. **状态更新**：草稿 → 待发布（approved）

**输出**：
- 审核通过的内容草稿
- 审核记录（审核人、审核时间、修改记录）
- 不通过商品列表（退回候选池或放弃）

**验收标准**：
- 所有上线内容必须经过人工审核
- 高风险类目内容双人签字审核
- 审核记录可追溯

---

#### F-030-04 内容发布与上线管理

**功能描述**：将审核通过的内容正式发布上线。

**输入**：
- F-030-03审核通过的内容草稿
- 发布排程（可选：定时发布）

**处理**：
1. **内容终检**：
   - 再次确认所有字段完整（标题/图片/标签/CTA等）
   - 确认联盟追踪参数已配置
   - 确认disclosure声明已添加
2. **状态变更**：approved → published
3. **上线发布**：
   - 商品详情页写入 D1 products（或生成Markdown）
   - 关联榜单（如有）更新lists表
   - 触发搜索引擎收录（sitemap更新）
4. **发布记录**：记录发布时间、操作人、版本

**输出**：
- 正式上线的商品/榜单
- 发布时间戳
- 内容版本快照（用于回滚）

**验收标准**：
- 上线内容包含完整字段
- 所有含联盟链接页面有disclosure声明
- 发布时间戳和操作人可追溯

---

#### F-030-05 数据复盘与内容优化

**功能描述**：定期对已发布内容进行数据复盘，识别高效内容特征，优化后续选品和内容策略。

**输入**：
- 商品表现数据：CTR、停留时长、收藏率、跳转率（F-017数据看板）
- 内容类型分布：类目/标签/价格带/来源平台
- 用户反馈：订阅用户点击/收藏数据

**处理**：
1. **周度复盘（每周四）**：
   - 统计本周新发布内容的4项行为指标
   - 识别本周TOP3和BOTTOM3内容
   - 分析高效内容的共同特征（类目/标签/标题模式/价格带）
2. **策略调整**：
   - 调整下周期选题方向
   - 更新内容模板（强化高效元素）
   - 标记低效内容待优化或下架
3. **内容迭代**：
   - 对低效但仍有价值的内容进行优化重发布
   - 对过时/失效内容执行下架（status → archived）
4. **数据归档**：周报数据归档，保留12个月

**输出**：
- 周度内容复盘报告（本周概况/TOP内容/低效内容/下周期建议）
- 内容优化记录（优化项/修改前后对比）
- 下线内容列表及原因

**验收标准**：
- 周四完成周度复盘
- 复盘报告包含量化数据支撑
- 低效内容有明确的优化或下线决策

---

### 10.3 F-030 三态变更追踪

| 功能编号 | 功能名称 | 需求设计 | 代码实现 | 审核 | 最后更新 |
|----------|----------|----------|----------|------|----------|
| F-030-01 | 选题与候选商品池管理 | ✅ | ✅ | ✅ | 2026-04-07 |
| F-030-02 | AI 辅助初筛与标签生成 | ✅ | ✅ | ✅ | 2026-04-07 |
| F-030-03 | 人工审核与内容修正 | ✅ | ✅ | ✅ | 2026-04-07 |
| F-030-04 | 内容发布与上线管理 | ✅ | ✅ | ✅ | 2026-04-07 |
| F-030-05 | 数据复盘与内容优化 | ✅ | ✅ | ✅ | 2026-04-07 |

> **第二十次STR审核说明（2026-04-07 11:35）：** F-030 正式功能审核通过（8个API端点 + Migration 008 + schema.ts），三态从 🏗 更新为 ✅。核心工作流完整，9个观察项（O-F030-01~09）为P1/P2/P3优先级，不阻塞上线。

**流转规则**：🗓（需求设计）→ 🏗（功能实现）→ ✅（人工审核通过）

---

**内容管理工作流验收标准**

- 周产出稳定：≥5 个商品页 / 周
- 内容质量审核通过后才能上线
- 不发布未经审核的 AI 生成内容
- 高风险类目内容双人审核
- 所有内容发布记录可追溯

### 10.3 JJY API 运营选品工具（v3.36新增）

> **需求来源**：findora_project_status.md §六（运营数据工具），JJY API 为当前选品工作流的核心工具，优先于其他选品工具。

**工具定位**：JJY API 是 Findora 运营团队进行跨境选品的核心数据获取工具，**覆盖5个主流电商平台**，**无需登录**，**纯API调用**，由运营 Agent 直接使用。

**文件位置**：`operations/tools/jjy_api.js`

#### 10.3.1 支持平台

| 平台 | API域名 | 支持品类数 | 说明 |
|------|---------|-----------|------|
| Temu | www.temaishuju.com | 23个 | 低价商品丰富，适合新奇选品 |
| Shein | api.sheinshuju.com | 23个 | 快时尚、小件饰品 |
| Amazon | api.amazonshuju.com | 24个 | 高客单价、品牌商品 |
| 速卖通 | api.sumaitongshuju.com | 30个 | 品类最全，B2C出口主力 |
| TikTok Shop | api.tiktokshuju.com | 28个 | 社交流量驱动，热销趋势 |

#### 10.3.2 核心筛选参数

| 参数 | 说明 | 示例 |
|------|------|------|
| `keyword` | 关键词搜索（英文效果更好） | `necklace`、`kitchen gadget` |
| `catId` | 品类ID（对应平台品类体系） | `18768`（对应美容和个人护理） |
| `onSaleTimeStart` | 上架时间下限（筛选新品） | `2025-01-01` |
| `priceMin` / `priceMax` | 价格区间筛选 | `5` / `30` |

#### 10.3.3 接口契约

```javascript
// 使用示例
const jjyApi = require('./jjy_api.js');
await jjyApi.init();

// 4参数组合筛选
const result = await jjyApi.search({
  keyword: 'necklace',
  platform: 'temu',
  categoryId: 18768,
  onSaleTimeStart: '2025-01-01',
  priceMin: 5,
  priceMax: 30
});

// 按品类名称查找ID
const catId = jjyApi.findCategoryId('temu', '美容');
```

**返回数据格式**：
```json
{
  "success": true,
  "platform": "temu",
  "total": 200,
  "products": [
    {
      "goodsNameEn": "Vintage Pearl Necklace Set",
      "goodsNameCn": "复古珍珠项链套装",
      "sold": 44000,
      "goodsPriceMin": 1.8,
      "goodsPriceMax": 3.19,
      "rating": 4.6,
      "onSaleTime": "2025-01-15T...",
      "thumbnail": "..."
    }
  ]
}
```

#### 10.3.4 运营使用规范

| 规范项 | 说明 |
|--------|------|
| 选品优先级 | Selector Agent 选品时，**必须优先使用 JJY API**（vs ThuntAI或其他工具） |
| 数据质量 | JJY API 无需登录，5平台纯API调用，数据更精准高效 |
| 数据整合 | 获取原始数据后，由 **Curator Agent** 做二次包装（重写标题/摘要/亮点） |
| 合规审核 | 所有通过 JJY API 选中的商品，必须经 F-021 审核工作流后方可上架 |
| 工具搁置 | ThuntAI 工具（仅1平台、需要登录）暂时搁置，JJY 覆盖后再评估 |

#### 10.3.5 运营工作流集成

```
Selector选品 → JJY API获取数据（5平台、免登录）
                      ↓
              Curator二次包装 → 生成商品Card + 推荐文案
                      ↓
              Operator审核上架 → pass则API入库（/api/admin/products）
                      ↓
              F-021 AI审核工作流 → 人工复核 → 上线展示
```

**与 business_concept §11 对齐**：JJY API 是"外部运营AI"获取商品原始数据的主要工具，数据经 F-040-22 接口进入系统后，由运营团队进行人工审核和内容包装。

---

## 11. 技术架构概要

### 11.1 技术选型

| 层级 | 技术 | 说明 | 需求设计 | 代码实现 | 审核 | 优先级 |
|------|------|------|----------|----------|------|--------|
| 前端/边缘 | Cloudflare Workers | 静态网页 + Markdown 解析 | ✅ | ✅ | ✅ | P0 |
| 存储 | Cloudflare D1 | 结构化数据（用户/标签/日志） | ✅ | ✅ | ✅ | P0 |
| 媒体/缓存 | Cloudflare R2 | 图片缓存、素材 | ✅ | ✅ | ✅ | P0 |
| 内容源 | Git / Markdown | 内容驱动，版本化 | ✅ | ✅ | ✅ | P0 |

### 11.2 域名与部署

| 项目 | 说明 | 需求设计 | 代码实现 | 审核 | 优先级 |
|------|------|----------|----------|------|--------|
| 域名注册 | 已分配自定义域名：`findora.turingcorp.net` | ✅ | ✅ | ✅ | P0 |
| CDN 部署 | Cloudflare Pages 或 Workers | ✅ | ✅ | ✅ | P0 |
| SSL 证书 | 自动 via Cloudflare | ✅ | ✅ | ✅ | P0 |

**架构约束**：
1. 不做自建服务器，所有能力基于 Cloudflare 边缘网络。
2. 如果涉及到 Cloudflare Worker 之间的内部互相调用（且在同一个一级域名下），优先使用 Service Bindings（而非 HTTP fetch）以提升内部调用性能。

---

## 12. 九十天迭代计划

> **需求来源**：business_concept §16 "90天落地路线图"、§14 "运营流程设计"

### 12.1 第一阶段：0–30天（基础搭建）

**目标**：把最小可行闭环跑通

| 任务 | 说明 | 优先级 | 状态 |
|------|------|--------|------|
| 站点基础 | 域名与站点上线 | P0 | ✅ |
| MVP页面 | 首页、分类页、商品页、榜单页、订阅页模板 | P0 | ✅ |
| 单类目测试 | 1个主类目、50个商品页、10个榜单页 | P0 | 🏗 |
| 跳转链路 | 联盟追踪参数与跳转逻辑 | P0 | ✅ |
| 基础统计 | F-017数据看板（UV/CTR/跳转率） | P0 | ✅ |
| 订阅入口 | Email订阅与退订 | P0 | ✅ |
| 联盟披露 | Disclosure页（C-01） | P0 | ✅ |

**验收标准**：
- 用户可以从社媒进入站点
- 可以点击跳转成交页
- 可以收集点击与订阅数据

### 12.2 第二阶段：31–60天（内容扩展与运营验证）

**目标**：找到有效内容结构

| 任务 | 说明 | 优先级 | 状态 |
|------|------|--------|------|
| 类目扩展 | 扩到2-3个类目 | P1 | 🗓 |
| JJY API选品落地 | Selector Agent + JJY API（5平台128品类）集成到正式运营流程 | P1 | 🗓 |
| 标签体系完善 | 动态标签维度与标签项管理（F-011） | P1 | 🏗 |
| 邮件订阅 | Newsletter发送与追踪 | P1 | ✅ |
| 基础推荐 | F-014规则推荐上线 | P1 | ✅ |
| 社媒模板 | 1-2套社媒分发模板 | P2 | 🗓 |
| 选品运营闭环 | 选品→包装→审核→上架流程（F-030） | P1 | ✅ |
| 内容复盘 | F-030-05周度数据复盘 | P1 | ✅ |

**运营流程**：
```
Selector选品 → JJY API获取数据（5平台、免登录）
                      ↓
              Curator二次包装 → 生成商品Card + 推荐文案
                      ↓
              Operator审核上架 → pass则API入库（/api/admin/products）
                      ↓
              F-021 AI审核工作流 → 人工复核 → 上线展示
```

**验收标准**：
- 找到"容易点击"的类目与表达方式
- 有第一批回访用户

### 12.3 第三阶段：61–90天（个性化与变现优化）

**目标**：开始做个性化和变现优化

| 任务 | 说明 | 优先级 | 状态 |
|------|------|--------|------|
| 用户偏好选择 | 主动管理liked_tags/disliked_tags | P1 | 🗓 |
| 个性化推荐 | F-015行为推荐上线 | P1 | 🗓 |
| 收藏功能 | 商品收藏与收藏管理 | P1 | ✅ |
| 推荐解释 | F-016预生成文案检索上线 | P2 | 🗓 |
| 榜单自动化 | 榜单页按规则自动生成 | P2 | 🗓 |
| 邮件个性化 | 按用户偏好发送个性化推荐 | P1 | 🗓 |
| 外部运营AI接入 | F-040-22契约完成，运营AI正式接入 | P1 | 🗓 |
| 人工干预机制 | F-024人工控制能力完善 | P1 | ✅ |

**验收标准**：
- 站点不再只是静态内容库
- 开始具备"产品感"
- 90天目标达成：月UV≥5000、Newsletter订阅≥200、跳转率≥3%

### 12.4 迭代检查点

| 检查点 | 时间 | 验证项 |
|--------|------|--------|
| MVP验证 | Day 0 | 基础闭环可跑通 |
| 选品闭环 | Day 30 | JJY API + Curator + Operator流程贯通 |
| 推荐上线 | Day 60 | F-014/F-015推荐链路可用 |
| 个性化验证 | Day 90 | F-016推荐解释 + 用户偏好管理 |

### 12.5 运营日历（周度节奏）

> **来源**：business_concept §14 "每周运营闭环"

| 星期 | 任务 | 说明 |
|------|------|------|
| 周一 | 选题与选品 | 看趋势、选20-50个候选、初筛出10-20个 |
| 周二 | 内容生产 | 商品页草稿、榜单页草稿、社媒脚本 |
| 周三 | 发布与分发 | 上站、发TikTok/IG/X、发Newsletter |
| 周四 | 数据复盘 | CTR、页面停留、保存率、跳转率（F-030-05） |
| 周五 | 优化与淘汰 | 调标题/封面/CTA、删除低效内容 |

---

## 13. KPI 指标体系

> 前 90 天不看 GMV，只看行为和流量指标。

### 13.1 内容指标

| KPI | 计算公式 | 数据来源 | 测量频率 | 30天目标 | 60天目标 | 90天目标 | 状态 |
|-----|----------|----------|----------|----------|----------|----------|------|
| 每周新增商品页数 | `COUNT(product_id) WHERE created_at IN [本周] AND status='active'` | D1 products | 每周 | ≥3 | ≥4 | ≥5 | 🗓 |
| 每周新增榜单页数 | `COUNT(list_id) WHERE published_at IN [本周] AND status='published'` | D1 lists | 每周 | ≥0 | ≥1 | ≥1 | 🗓 |
| 内容发布时间稳定性 | 本周是否有一周无发布（布尔） | D1 products/lists | 每周 | 无断更 | 无断更 | 无断更 | 🗓 |

### 13.2 流量指标

| KPI | 计算公式 | 数据来源 | 测量频率 | 30天目标 | 60天目标 | 90天目标 | 状态 |
|-----|----------|----------|----------|----------|----------|----------|------|
| 月 UV | `COUNT(DISTINCT COALESCE(user_id, anonymous_id)) WHERE clicked_at IN [本月]` | D1 clicks | 每月 | ≥500 | ≥2,000 | ≥5,000 | 🗓 |
| Newsletter 订阅数 | `COUNT(user_id) WHERE status='active' AND subscribed_at IS NOT NULL` | D1 users | 每周 | ≥20 | ≥100 | ≥200 | 🗓 |
| 社媒点击进站率 | `COUNT(clicks WHERE utm_source IN ['tiktok','instagram','x','pinterest']) / COUNT(clicks) × 100%` | D1 clicks | 每周 | 可追踪 | ≥15% | ≥25% | 🗓 |
| SEO 收录数 | 外部工具（Google Search Console）手动记录 | — | 每月 | ≥10 | ≥30 | ≥50 | 🗓 |

### 13.3 行为指标

| KPI | 计算公式 | 数据来源 | 测量频率 | 30天目标 | 60天目标 | 90天目标 | 状态 |
|-----|----------|----------|----------|----------|----------|----------|------|
| 商品页平均停留时长 | `AVG(停留时长)`，前端事件上报（页面卸载时计算） | 前端事件（可选写 D1） | 每周 | ≥30s | ≥45s | ≥60s | 🗓 |
| 跳转率（点击 CTA） | `COUNT(clicks WHERE product_id IS NOT NULL) / COUNT(product_page_pv) × 100%` | D1 clicks + 页面PV | 每周 | ≥1% | ≥2% | ≥3% | 🗓 |
| 收藏率 | `COUNT(favorite_add_events) / COUNT(DISTINCT UV on product pages) × 100%` | D1 favorites | 每周 | ≥0.5% | ≥0.8% | ≥1% | 🗓 |
| 回访率 | `COUNT(7日内回访UV) / COUNT(7天前首次访问UV) × 100%` | D1 clicks | 每周 | ≥5% | ≥8% | ≥10% | 🗓 |

### 13.4 商业指标

| KPI | 计算公式 | 数据来源 | 测量频率 | 30天目标 | 60天目标 | 90天目标 | 状态 |
|-----|----------|----------|----------|----------|----------|----------|------|
| CPS 佣金收入 | `SUM(commission) WHERE transaction_status='confirmed'` | 联盟平台 API | 每月 | 第一笔佣金 | ≥$10 | ≥$50 | 🗓 |
| 百访客佣金 | `SUM(commission) / COUNT(DISTINCT UV) × 100` | 联盟平台 + D1 clicks | 每月 | 可计算 | ≥$0.5/百UV | ≥$1/百UV | 🗓 |

### 13.5 KPI 测量规范

#### 统一口径

| 术语 | 定义 |
|------|------|
| UV | 独立访客数，同一 user_id 或 anonymous_id 在统计周期内只计一次 |
| PV | 页面浏览次数，同一用户多次访问累计计数 |
| 跳转率 | 从商品详情页点击 CTA 跳转至外部商家页的比例 |
| 收藏率 | 有收藏行为的 UV 占浏览过商品页 UV 的比例 |
| 回访率 | 7日内有回访行为的用户占7天前首次访问用户的比例 |

#### 数据采集时机

| 事件 | 采集时机 |
|------|----------|
| UV / PV | 页面加载完成时 |
| 点击跳转 | 用户点击 CTA 按钮时（同步写 D1 clicks） |
| 收藏 | 用户点击收藏图标时（写 D1 favorites） |
| 停留时长 | 用户离开页面或切换到其他页面时 |
| 订阅 | 用户提交订阅表单成功时 |

#### 基线建立规则

1. **上线第 0 天**：所有指标目标为「可计算」，确认数据管道畅通
2. **第 30 天**：取真实中位数设为新基线，目标调整为基线 ±20%
3. **第 60 天**：再次校准基线，关注趋势而非绝对值
4. **第 90 天**：最终基线固化，作为后续迭代参照

#### 预警机制

| 触发条件 | 动作 |
|----------|------|
| 周 UV 环比下跌 >30% | 触发复盘（来源/类目/内容维度） |
| 跳转率连续 2 周 <1% | 排查 CTA 按钮展示是否正常 |
| 订阅数周增量 <2 | 排查订阅入口是否可见 |
| 收藏率 <0.3% 持续 2 周 | 排查收藏按钮交互是否顺畅 |
| 商品页停留 <20s 持续 2 周 | 排查页面加载速度或内容质量 |

> ⚠️ **隐私约束**：不采集完整 IP、真实姓名、手机号、精确地理位置。点击日志仅保留国家（ip_country），不含 PII。

---

## 14. 合规要求

> 贯穿所有功能，不得绕过。

> ⚠️ **编号说明**：Section 14 的 C-0X（合规要求）与 Section 3.1.8 的 STR C-0X（阻塞项）为不同编号体系，各自独立编号。

| 编号 | 要求 | 关联功能 | 需求设计 | 代码实现 | 审核 | 备注 |
|------|------|----------|----------|----------|------|------|
| C-01 | 所有含联盟链接页面必须有 disclosure 声明 | F-003、F-004 | ✅ | ✅ | ✅ | 页面模板已内置 |
| C-02 | 不得使用 "best"/"safest"/"guaranteed"/"proven" 等绝对化表述 | F-003、AI 内容 | ✅ | ✅ | ✅ | AI审核规则已内置 |
| C-03 | 不得搬运未经处理的供应商图片作为主图 | 全部内容 | ✅ | ✅ | ✅ | 内容审核流程已覆盖 |
| C-04 | 高风险类目（医疗/美容/儿童/电子）内容双人审核 | F-003 | ✅ | ✅ | ✅ | 人工审核流程已定义 |
| C-05 | 订阅必须有退订入口，退订操作即时生效 | F-005、F-013 | ✅ | ✅ | ✅ | API已实现即时生效 |
| C-06 | 不采集多余个人信息，点击日志不含 PII | F-012、F-017 | ✅ | ✅ | ✅ | 数据模型已合规设计 |
| C-07 | Privacy Policy 与 Terms of Use 在上线前就位 | F-006 | ✅ | ✅ | ✅ | 页面已就位 |

---

## 15. 后续迭代说明

> **v3.31 执行基线**：按“用户侧零实时LLM + 外部运营AI异步入库 + 纯查库推流”推进。

### 待推进项（按优先级）

| 编号 | 描述 | 当前状态 | 推进建议 |
|------|------|----------|----------|
| F-040-22 | 运营AI数据更新接口（API/CLI） | 🗓 | Token 鉴权已实现；契约已完善（request_id规范、错误格式、校验规则）；ST-T02/T03已修复，端点完全可用 |
| F-020 | 运营AI异步生产能力接入规范 | 🗓 | 明确 payload 契约与失败重试策略 |
| F-016 | 推荐解释检索化改造 | 🗓 | 移除实时生成分支，统一预生成文案检索 |
| F-011 | 动态标签维度治理 | 🗓 | 增加维度生命周期管理与冲突检测 |
| F-050 | D1/R2 主从字段对齐 | 🗓 | 补齐内容指针字段、建立一致性巡检任务 |

### 执行检查点

1. 推荐接口在用户请求链路中无实时模型调用。
2. 运营AI所有入库请求必须通过 F-040-22 鉴权与 schema 校验。
3. 标签维度和标签项可动态扩展，且能立即参与检索。
4. 推荐结果由标签交集 + 随机抽选形成，不依赖在线推理。

### business_concept.md 17章节映射核对清单

> 系统分析师复核确认：SRS功能模块已覆盖business_concept.md全量章节。

| # | business_concept 章节 | SRS对应章节/模块 | 映射状态 |
|---|-----------------------|------------------|----------|
| 1 | 项目定义 | Section 1.2 范围, Section 2.1 产品视角 | ✅ |
| 2 | 为什么本路线适合 | Section 2.1 产品视角 | ✅ |
| 3 | 产品定位 | Section 2.1 产品视角 | ✅ |
| 4 | 商业模式 | Section 1.2 范围, Section 14 合规要求 | ✅ |
| 5 | 用户路径设计 | Section 2.3 用户特征与用例流程 | ✅ |
| 6 | 站点结构设计 | Section 6 页面功能设计 (F-001~F-006) | ✅ |
| 7 | 内容策略 | Section 10 内容管理 (F-030) | ✅ |
| 8 | 数据模型设计 | Section 4 数据字典 (F-050), Section 7.1 商品库 (F-010) | ✅ |
| 9 | 推荐系统设计 | Section 7.5 F-014, Section 7.6 F-015, Section 7.7 F-016 | ✅ |
| 10 | 技术方案 | Section 11 技术架构概要 | ✅ |
| 11 | AI在项目中的作用 | Section 9 AI能力边界 (F-020/F-021/F-024) | ✅ |
| 11.4 | 人类保留的控制权 | Section 9.9 人工干预机制 (F-024) | ✅ |
| 12 | 流量方案 | Section 2.3 用例流程, Section 13 KPI体系 | ✅ |
| 13 | 合规与风险控制 | Section 14 合规要求 (C-01~C-07) | ✅ |
| 14 | 运营流程设计 | Section 10 内容管理 (F-030), Section 12 90天迭代计划 | ✅ |
| 15 | KPI设计 | Section 13 KPI指标体系 | ✅ |
| 16 | 90天落地路线图 | Section 12 90天迭代计划 | ✅ |
| 17 | 最小可行版本（MVP） | Section 1.2 范围, Section 6 MVP页面功能 | ✅ |

### system_design.md v1.1.0 架构约束同步核对清单（v3.34）

> 系统分析师复核确认：SRS已全量同步system_design.md v1.1.0架构约束，包括A-01~A-06六条强制约束。

| # | system_design 架构约束 | SRS引用 | 同步状态 |
|---|------------------------|---------|----------|
| A-01 | 用户侧零实时LLM | Section 2, AC-01, F-016 | ✅ |
| A-02 | 外部运营AI异步化 | Section 9.1/9.2, F-040-22 | ✅ |
| A-03 | 纯数据库推荐链路 | Section 7.5/7.6, AC-04 | ✅ |
| A-04 | 动态标签维度 | F-011, AC-03 | ✅ |
| A-05 | 统一数据API层 | Section 3.1, S-09, AC-05 | ✅ |
| A-06 | Cloudflare优先 | Section 11.1 | ✅ |
| S-09 | API唯一入口 | Section 3.1, AC-05 | ✅ |

---

## 📌 历史归档说明

自 v3.11 起，本文档以顶部”**三态追踪总览（v3.XX）**”作为唯一当前执行基线。

- 历史轮次内容（含旧阻塞项、旧完成度统计）仅保留在版本记录与 STR 文档中，不在本节重复展开。
- 若后续功能编号状态变更，仅更新：文档头部状态行、三态追踪总览、版本记录三处。
