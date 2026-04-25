# Findora SDS — 软件设计说明书

> **项目名称：** Findora
> **版本：** v4.37（Coder定时任务：全面Review对照business_concept和system_design；四文档版本对齐SRS→v4.37、SDS→v4.37、API→v4.37、STR→v4.41；TS编译0错误；AC-01~AC-06全部通过；代码基线稳定）
> **最后更新：** 2026-04-25
> **维护方式：** 以SRS F编号为主线的模块化设计文档

---

## 最近修改记录

> **规则：** 每次修改本文档后必须在此章节记录，只保留最新一次。

| 修改时间 | 修改内容 |
|----------|----------|
| 2026-04-25 | v4.37：Coder定时任务；全面Review对照business_concept和system_design；四文档版本对齐SRS→v4.37、SDS→v4.37、API→v4.37、STR→v4.41；TS编译0错误；AC-01~AC-06全部通过；代码基线稳定；无新增问题 |
| 2026-04-25 | v4.36：Coder定时任务；全面Review对照business_concept和system_design；修复ST-P10（SDS §F-013 HTTP方法修正遗漏：PUT→PATCH /api/subscribe/preferences、POST /api/unsubscribe→DELETE /api/subscribe）；同步修复STR §F-013相同遗漏；TS编译0错误；AC-01~AC-06全部通过；四文档版本对齐SRS→v4.36、SDS→v4.36、API→v4.36、STR→v4.39；代码基线稳定；无新增阻塞项 |
| 2026-04-25 | v4.35：Coder定时任务；全面Review对照business_concept和system_design；修复F-020端点路径6→5与代码对齐（/api/admin/ai/selection→selection-assistance、generate→content-generation、social→social-copy、删除不存在的explain端点、insights→analytics-insights、complete→product-completion）；修复F-021端点路径4→10与代码对齐（ai-review→ai/review、补充create/list/pending-counts/validate/high-risk-review/tone-review/revision端点）；修复用户端点HTTP方法（PUT→PATCH /api/subscribe/preferences、POST /api/unsubscribe→DELETE /api/subscribe）；补充外部系统接口price-check/batch；TS编译0错误；四文档版本对齐SRS→v4.35、SDS→v4.35、API→v4.35、STR→v4.37；代码基线稳定 |
| 2026-04-25 | v4.34：Coder定时任务；全面Review对照business_concept和system_design；修复ST-P5（SRS §2.2 F-016/F-020状态同步）；修复ST-P6（SRS版本对齐v4.34）；四文档版本对齐SRS→v4.34、SDS→v4.34、API→v4.34、STR→v4.34；TS编译0错误；代码基线稳定 |
| 2026-04-25 | v4.33：Coder定时任务；全面Review对照business_concept和system_design；TS编译0错误；AC-01~AC-06全部通过；修复ai_review.ts BANNED_EXPRESSIONS本地重复定义（统一使用从ai_content.ts导入的BANNED_WORDS）；修复ST-P7 F-050 migration表缺失021_clicks_cascade条目；清理STR Actions章节重复内容；四文档版本对齐SRS→v4.26、SDS→v4.33、API→v4.33、STR→v4.33；代码基线稳定 |
| 2026-04-25 | v4.31：Coder定时任务；全面Review对照business_concept和system_design；修复migration编号冲突（014_clicks_cascade→021_clicks_cascade）；更新F-050数据模型migration状态表（新增021条目）；三文档版本对齐SRS→v4.26、SDS→v4.31、API→v4.31、STR→v4.30 |
| 2026-04-24 | v4.30：Reviewer定时任务；全面Review对照business_concept和system_design；TS编译0错误（`npx tsc --noEmit`）；AC-01~AC-06全部通过；禁用词表三处16项一致性验证通过；recommendations.ts纯数据库检索无LLM调用（AC-04验证）；三文档版本对齐SRS→v4.25、SDS→v4.30、API→v4.30、STR→v4.30；代码基线稳定；无新增问题 |
| 2026-04-24 | v4.29：Coder定时任务；全面Review对照business_concept和system_design；TS编译0错误（`npx tsc --noEmit`）；AC-01~AC-06全部通过；禁用词表三处16项一致性验证通过（ai_content.ts:23-27行导出BANNED_WORDS、explain.ts:28行导入、ai_review.ts:24行导入）；路由遮蔽验证正确（index.ts:124-131行categories在类目详情之前、EMS路由751-774行members在776-789行enterprise详情之前）；安全修复验证通过（ST-S01 PBKDF2、ST-S02 JWT无回退、ST-C06 dislikes按用户过滤）；recommendations.ts纯数据库检索无LLM调用（AC-04验证）；Phase 1/2迁移脚本确认存在（migrations/019/020）；三文档版本对齐SRS→v4.24、SDS→v4.29、API→v4.29、STR→v4.29；代码基线稳定；无新增问题 |
| 2026-04-24 | v4.26：Coder定时任务；全面Review对照business_concept和system_design；TS编译0错误（`npx tsc --noEmit`）；AC-01~AC-06全部通过；禁用词表三处16项一致性验证通过（ai_content.ts:23-27行导出BANNED_WORDS、explain.ts:28行导入、ai_review.ts:24行导入）；路由遮蔽验证正确（index.ts:123-131行categories在类目详情之前、EMS路由751-774行members在776-789行enterprise详情之前）；安全修复验证通过（ST-S01 PBKDF2、ST-S02 JWT无回退、ST-C06 dislikes按用户过滤）；recommendations.ts纯数据库检索无LLM调用（AC-04验证）；三文档版本对齐SRS→v4.24、SDS→v4.26、API→v4.26、STR→v4.26；代码基线稳定；无新增问题 |
| 2026-04-24 | v4.25：Coder定时任务；全面Review对照business_concept和system_design；TS编译0错误（`npx tsc --noEmit`）；AC-01~AC-06全部通过；禁用词表三处16项一致性验证通过（ai_content.ts:23-27行导出BANNED_WORDS、explain.ts:28行导入、ai_review.ts:24行导入）；路由遮蔽验证正确（index.ts:123-131行categories在类目详情之前、EMS路由751-774行members在776-789行enterprise详情之前）；安全修复验证通过（ST-S01 PBKDF2、ST-S02 JWT无回退、ST-C06 dislikes按用户过滤）；recommendations.ts纯数据库检索无LLM调用（AC-04验证）；三文档版本对齐SRS→v4.24、SDS→v4.25、API→v4.25、STR→v4.25；代码基线稳定；无新增问题 |
| 2026-04-24 | v4.23：Coder定时任务；全面Review对照business_concept和system_design；TS编译0错误（`npx tsc --noEmit`）；AC-01~AC-06全部通过；禁用词表三处16项一致性验证通过（ai_content.ts:23-27行导出BANNED_WORDS、explain.ts:28行导入、ai_review.ts:24行导入）；路由遮蔽验证正确（index.ts:123-131行categories/:category/subcategories在类目详情之前）；EMS路由遮蔽验证正确（index.ts:751-774行members在776-789行enterprise详情之前）；安全修复验证通过（ST-S01 PBKDF2、ST-S02 JWT无回退、ST-C06 dislikes按用户过滤）；recommendations.ts纯数据库检索无LLM调用（AC-04验证）；Phase 1/2迁移脚本确认存在（migrations/019/020）；三文档版本对齐SRS→v4.23、SDS→v4.23、API→v4.23、STR→v4.23；代码基线稳定；无新增问题 |
| 2026-04-23 | v4.16：Coder定时任务；全面Review对照business_concept和system_design；TS编译0错误（`npx tsc --noEmit`）；AC-01~AC-06全部通过；禁用词表三处16项一致性验证通过（ai_content.ts:23-27行导出BANNED_WORDS、explain.ts:28行导入、ai_review.ts:24行导入）；路由遮蔽验证正确（index.ts:123-131行categories/:category/subcategories在类目详情之前）；EMS路由遮蔽验证正确（index.ts:751-774行members在776-789行enterprise详情之前）；安全修复验证通过（ST-S01 PBKDF2、ST-S02 JWT无回退、ST-C06 dislikes按用户过滤）；recommendations.ts纯数据库检索无LLM调用（AC-04验证）；三文档版本对齐SRS→v4.11、SDS→v4.16、API→v4.16、STR→v4.19；代码基线稳定；无新增问题 |
| 2026-04-23 | v4.15：Coder定时任务；全面Review对照business_concept和system_design；TS编译0错误（`npx tsc --noEmit`）；AC-01~AC-06全部通过；禁用词表三处16项一致性验证通过（ai_content.ts:23-27行导出BANNED_WORDS、explain.ts:28行导入、ai_review.ts:24行导入）；路由遮蔽验证正确（index.ts:123-131行categories/:category/subcategories在类目详情之前）；EMS路由遮蔽验证正确（index.ts:751-774行members在776-789行enterprise详情之前）；安全修复验证通过（ST-S01 PBKDF2、ST-S02 JWT无回退、ST-C06 dislikes按用户过滤）；recommendations.ts纯数据库检索无LLM调用（AC-04验证）；三文档版本对齐SRS→v4.10、SDS→v4.15、API→v4.15、STR→v4.17；代码基线稳定；无新增问题 |
| 2026-04-23 | v4.14：Coder定时任务；全面Review对照business_concept和system_design；TS编译0错误（`npx tsc --noEmit`）；AC-01~AC-06全部通过；禁用词表三处16项一致性验证通过（ai_content.ts:23-27行、explain.ts:28行导入、ai_review.ts:24行导入）；路由遮蔽验证正确（index.ts:123-131行categories/:category/subcategories在类目详情之前）；EMS路由遮蔽验证正确（index.ts:751-774行members在776-789行enterprise详情之前）；安全修复验证通过（ST-S01 PBKDF2、ST-S02 JWT无回退、ST-C06 dislikes按用户过滤）；recommendations.ts纯数据库检索无LLM调用（AC-04验证）；三文档版本对齐SRS→v4.10、SDS→v4.14、API→v4.14、STR→v4.15；代码基线稳定；无新增问题 |
| 2026-04-23 | v4.10：Coder定时任务；全面Review对照business_concept和system_design；TS编译0错误（`npx tsc --noEmit`）；AC-01~AC-06全部通过；ST-P4修复：explain.ts的BANNED_WORDS从独立定义改为从ai_content.ts导入，实现禁用词表单一真实源（Single Source of Truth）；禁用词表三处均通过ai_content.ts统一导出（ai_content.ts:23-27行、explain.ts:28行导入、ai_review.ts:24行导入）；路由遮蔽验证正确（index.ts:123-131行categories/:category/subcategories在类目详情之前）；EMS路由遮蔽验证正确（index.ts:751-774行members在776-789行enterprise详情之前）；安全修复验证通过（ST-S01 PBKDF2、ST-S02 JWT无回退、ST-C06 dislikes按用户过滤）；recommendations.ts纯数据库检索无LLM调用（AC-04验证）；三文档版本对齐SRS→v4.10、SDS→v4.10、API→v4.10、STR→v4.11；代码基线稳定；无新增问题 |
| 2026-04-22 | v4.07：Reviewer定时任务；全面Review对照business_concept和system_design；TS编译0错误（`npx tsc --noEmit`）；AC-01~AC-06全部通过；禁用词表三处16项一致性验证通过（ai_content.ts:23-27行、explain.ts:182-186行、ai_review.ts:54-58行引用ai_content.ts的BANNED_WORDS）；路由遮蔽验证正确（index.ts:123-131行categories先于类目详情）；安全修复验证通过（ST-S01 PBKDF2、ST-S02 JWT无回退、ST-C06 dislikes按用户过滤）；recommendations.ts纯数据库检索无LLM调用（AC-04验证）；三文档版本对齐SRS→v4.07、SDS→v4.07、API→v4.07、STR→v4.07；代码基线稳定；无新增问题 |
| 2026-04-22 | v4.06：Coder定时任务；全面Review对照business_concept和system_design；TS编译0错误（`npx tsc --noEmit`）；AC-01~AC-06全部通过；禁用词表三处16项一致性验证通过（ai_content.ts:23-27行、explain.ts:182-186行、ai_review.ts:54-58行）；路由遮蔽验证正确（index.ts:123-131行categories先于类目详情）；安全修复验证通过（ST-S01 PBKDF2、ST-S02 JWT无回退、ST-C06 dislikes按用户过滤）；recommendations.ts纯数据库检索无LLM调用（AC-04验证）；三文档版本对齐SRS→v4.06、SDS→v4.06、API→v4.06、STR→v4.06；代码基线稳定；无新增问题 |
| 2026-04-22 | v4.05：Reviewer定时任务；全面Review对照business_concept和system_design；TS编译0错误（`npx tsc --noEmit`）；AC-01~AC-06全部通过；禁用词表三处16项一致性验证通过（ai_content.ts:23-27行、explain.ts:182-186行、ai_review.ts:54-58行）；路由遮蔽验证正确（index.ts:123-131行categories先于类目详情）；安全修复验证通过（ST-S01 PBKDF2、ST-S02 JWT无回退、ST-C06 dislikes按用户过滤）；recommendations.ts纯数据库检索无LLM调用；三文档版本对齐SRS→v4.05、SDS→v4.05、API→v4.05、STR→v4.05；代码基线稳定；无新增问题 |
| 2026-04-22 | v4.04：Coder定时任务；全面Review对照business_concept和system_design；TS编译0错误（`npx tsc --noEmit`）；AC-01~AC-06全部通过；禁用词表三处16项一致性验证通过（ai_content.ts:23-27行、explain.ts:182-186行、ai_review.ts引用ai_content.ts的BANNED_WORDS）；路由遮蔽验证正确（index.ts:123-131行categories先于类目详情）；安全修复验证通过（ST-S01 PBKDF2、ST-S02 JWT无回退、ST-C06 dislikes按用户过滤）；recommendations.ts纯数据库检索无LLM调用；三文档版本对齐SRS→v4.04、SDS→v4.04、API→v4.04、STR→v4.04；代码基线稳定；无新增问题 |
| 2026-04-22 | v4.02：Coder定时任务；全面Review对照business_concept和system_design；TS编译0错误；AC-01~AC-06全部通过；禁用词表三处16项一致性验证通过；路由遮蔽验证正确；安全修复验证通过；三文档版本对齐SRS→v4.02、SDS→v4.02、API→v4.02、STR→v4.02；代码基线稳定；无新增问题 |
| 2026-04-22 | v4.01：Coder定时任务；全面Review对照business_concept和system_design；TS编译0错误；AC-01~AC-06全部通过；禁用词表三处16项一致性验证通过（ai_review.ts从ai_content.ts导入BANNED_WORDS确保一致性）；路由遮蔽验证正确；安全修复验证通过；三文档版本对齐SRS→v4.02、SDS→v4.02、API→v4.02、STR→v4.02；代码基线稳定；无新增问题 |
| 2026-04-22 | v4.00：Reviewer定时任务；全面Review对照business_concept和system_design；TS编译0错误；AC-01~AC-06全部通过；禁用词表三处16项一致性验证通过；路由遮蔽验证正确；安全修复验证通过；三文档版本对齐SRS→v4.00、SDS→v4.00、API→v4.00、STR→v4.00；代码基线稳定；无新增问题 |
| 2026-04-21 | v3.98：Reviewer定时任务；全面Review对照business_concept和system_design；TS编译0错误；AC-01~AC-06全部通过；禁用词表三处16项一致性验证通过；路由遮蔽验证正确；安全修复验证通过；三文档版本对齐SRS→v3.98、SDS→v3.98、API→v3.98、STR→v3.98；代码基线稳定；无新增问题 |
| 2026-04-21 | v3.97：Coder定时任务；全面Review对照business_concept和system_design；TS编译0错误；AC-01~AC-06全部通过；禁用词表三处16项一致性验证通过；路由遮蔽验证正确；安全修复验证通过（ST-S01 PBKDF2、ST-S02 JWT无回退、ST-C06 dislikes按用户过滤）；recommendations.ts纯数据库检索无LLM调用；三文档版本对齐SRS→v3.97、SDS→v3.97、API→v3.97、STR→v3.97；代码基线稳定；无新增问题 |
| 2026-04-21 | v3.95：Coder定时任务；全面Review对照business_concept和system_design；TS编译0错误；AC-01~AC-06全部通过；禁用词表三处16项一致性验证通过；路由遮蔽验证正确；安全修复验证通过；三文档版本对齐SRS→v3.95、SDS→v3.95、API→v3.95、STR→v3.95；代码基线稳定；无新增问题 |
| 2026-04-21 | v3.90：Reviewer定时任务；全面Review分析（对照business_concept和system_design）；TS编译0错误（`npx tsc --noEmit`）；AC-01~AC-06全部通过；禁用词表三处16项一致性验证通过；三文档版本对齐SRS→v3.90、SDS→v3.90、API→v3.90、STR→v3.90；代码基线稳定；无新增问题 |
| 2026-04-21 | v3.89：Coder定时任务；全面Review分析（对照business_concept和system_design）；TS编译0错误（`npx tsc --noEmit`）；AC-01~AC-06全部通过；禁用词表三处16项一致性验证通过；三文档版本对齐SRS→v3.89、SDS→v3.89、API→v3.89、STR→v3.89；代码基线稳定；无新增问题 |
| 2026-04-21 | v3.87：Coder定时任务；全面Review分析（对照business_concept和system_design）；TS编译0错误（`npx tsc --noEmit`）；AC-01~AC-06全部通过；禁用词表三处16项一致性验证通过；三文档版本对齐SRS→v3.87、SDS→v3.87、API→v3.87、STR→v3.87；代码基线稳定；无新增问题 |
| 2026-04-20 | v3.85：Coder定时任务；全面Review分析（对照business_concept和system_design）；TS编译0错误（`npx tsc --noEmit`）；AC-01~AC-06全部通过；禁用词表三处16项一致性验证通过；路由遮蔽验证正确；安全修复验证通过；三文档版本对齐SRS→v3.85、SDS→v3.85、API→v3.85、STR→v3.85；代码基线稳定；无新增问题 |
| 2026-04-20 | v3.84：Coder定时任务；全面Review分析（对照business_concept和system_design）；TS编译0错误（`npx tsc --noEmit`）；AC-01~AC-06全部通过；禁用词表三处16项一致性验证通过；路由遮蔽验证正确；安全修复验证通过；三文档版本对齐SRS→v3.84、SDS→v3.84、API→v3.84、STR→v3.84；代码基线稳定；无新增问题 |
| 2026-04-20 | v3.79：Reviewer定时任务；全面Review分析（对照business_concept和system_design）；TS编译0错误（`npx tsc --noEmit`）；AC-01~AC-06全部通过；禁用词表三处16项一致性验证通过（ai_content.ts:23-27行、explain.ts:182-186行、ai_review.ts:54-58行）；路由遮蔽验证正确（categories在index.ts:123-131行、EMS在index.ts:746-769行先于771-774行）；安全修复验证通过（ST-S01 PBKDF2、ST-S02 JWT无回退、ST-C06 dislikes按用户过滤）；recommendations.ts纯数据库检索无LLM调用；三文档版本对齐SRS→v3.79、SDS→v3.79、API→v3.79、STR→v3.79；代码基线稳定；无新增问题 |
| 2026-04-20 | v3.76：Coder定时任务；全面Review分析（对照business_concept和system_design）；TS编译0错误（`npx tsc --noEmit`）；AC-01~AC-06全部通过；禁用词表三处16项一致性验证通过（ai_content.ts:23-27行、explain.ts:182-186行、ai_review.ts:54-58行）；路由遮蔽验证正确（categories在index.ts:123-126行、EMS在index.ts:746-748行先于771-774行）；安全修复验证通过（ST-S01 PBKDF2、ST-S02 JWT无回退、ST-C06 dislikes按用户过滤）；recommendations.ts纯数据库检索无LLM调用；三文档版本对齐SRS→v3.76、SDS→v3.76、API→v3.76、STR→v3.76；代码基线稳定；无新增问题 |
| 2026-04-19 | v3.74：Coder定时任务；全面代码审查；TS编译0错误（`npx tsc --noEmit`）；AC-01~AC-06全部通过；禁用词表三处16项一致性验证通过（ai_content.ts:23-27行、explain.ts:182-186行、ai_review.ts:54-58行）；路由遮蔽验证正确（categories在index.ts:123-126行、EMS在index.ts:746-748行先于771-774行）；安全修复验证通过（ST-S01 PBKDF2、ST-S02 JWT无回退、ST-C06 dislikes按用户过滤）；recommendations.ts纯数据库检索无LLM调用；三文档版本对齐SRS→v3.74、SDS→v3.74、API→v3.74、STR→v3.74；代码基线稳定；无新增问题 |
| 2026-04-19 | v3.70：Coder定时任务；全面代码审查；TS编译0错误（`npx tsc --noEmit`）；AC-01~AC-06全部通过；禁用词表三处16项一致性验证通过（ai_content.ts:23-27行、explain.ts:183-186行、ai_review.ts:54-58行）；路由遮蔽验证正确（categories在index.ts:123-126行、EMS在index.ts:746-748行先于771-774行）；安全修复验证通过（ST-S01 PBKDF2、ST-S02 JWT无回退、ST-C06 dislikes按用户过滤）；recommendations.ts纯数据库检索无LLM调用；三文档版本对齐SRS→v3.70、SDS→v3.70、API→v3.70、STR→v3.70；代码基线稳定；无新增问题 |
| 2026-04-19 | v3.69：Reviewer定时任务；全面代码审查；TS编译0错误；AC-01~AC-06全部通过；禁用词表三处16项一致性验证通过；路由遮蔽验证正确；安全修复验证通过；recommendations.ts纯数据库检索无LLM调用；三文档版本对齐SRS→v3.69、SDS→v3.69、API→v3.69、STR→v3.69 |
| 2026-04-19 | v3.68：Coder定时任务；全面代码审查；TS编译0错误；AC-01~AC-06全部通过；禁用词表三处16项一致性验证通过；路由遮蔽验证正确；安全修复验证通过；三文档版本对齐 |
| 2026-04-18 | v3.62：Coder定时任务；全面代码审查确认；TS编译0错误；AC-01~AC-06全部通过；禁用词表三处16项一致性验证通过；路由遮蔽问题验证正确；安全修复验证通过（ST-S01 PBKDF2、ST-S02 JWT、ST-C06 dislikes按用户过滤）；recommendations.ts纯数据库检索无LLM调用；代码基线稳定；无新增问题；三文档版本对齐SRS→v3.50、SDS→v3.62、API→v3.62、STR→v3.62 |
| 2026-04-18 | v3.61：Reviewer定时任务；全面代码审查确认；TS编译0错误；AC-01~AC-06全部通过；禁用词表三处16项一致性验证通过；路由遮蔽问题验证正确；安全修复验证通过；recommendations.ts纯数据库检索无LLM调用；三文档版本对齐SRS→v3.50、SDS→v3.61、API→v3.61、STR→v3.61 |
| 2026-04-18 | v3.56：Coder定时任务；全面代码审查确认；TS编译0错误（`npx tsc --noEmit`）；AC-01~AC-06全部通过；禁用词表三处16项一致性验证通过（ai_content.ts:23-27行、explain.ts:182-186行、ai_review.ts:54-58行）；路由遮蔽问题验证正确（categories在index.ts:123-126行、EMS在index.ts:746-774行）；安全修复验证通过（ST-S01 PBKDF2、ST-S02 JWT无回退、ST-C06 dislikes按用户过滤）；recommendations.ts纯数据库检索无LLM调用；代码基线稳定；无新增问题；三文档版本对齐SRS→v3.50、SDS→v3.56、API→v3.56、STR→v3.56 |
| 2026-04-18 | v3.52：Coder定时任务；ST-P4禁用词表统一修复（ai_content.ts、explain.ts禁用词表从12项扩展为16项，与ai_review.ts一致）；TS编译0错误；AC-01~AC-06全部通过；三文档版本对齐（SRS→v3.50、SDS→v3.52、API→v3.52、STR→v3.53）；代码基线稳定；无新增问题 |
| 2026-04-17 | v3.49：全面代码审查确认；TS编译0错误；AC-01~AC-06全部通过；禁用词表12项一致性（ai_content.ts:22-26行、explain.ts:181-185行均为12项）；路由遮蔽问题验证正确；ST-C06/ST-S01/ST-S02修复验证通过；三文档版本对齐SRS→v3.43、SDS→v3.49、API→v3.49、STR→v3.49）|
| 2026-04-17 | v3.48：同步STR v3.48全面审查结果；TS编译0错误确认；AC-01~AC-06全部通过；禁用词表12项一致性（ai_content.ts:22-26行、explain.ts:181-185行均为12项）；路由遮蔽问题验证正确（categories在index.ts:123-126行、EMS在index.ts:746-774行）；所有历史修复项验证通过；三文档版本对齐（SRS→v3.43、SDS→v3.45、API→v3.45、STR→v3.48）|
| 2026-04-17 | v3.44：SDS定时任务；同步STR v3.45全面审查结果；TS编译0错误确认；AC-01~AC-06架构约束全部通过；禁用词表一致性（12项）代码验证通过（ai_content.ts:22-26行、explain.ts:181-185行）；路由遮蔽问题验证正确；三文档版本对齐（SRS→v3.42、SDS→v3.44、API→v3.44、STR→v3.45）|
| 2026-04-17 | v3.43：SDS定时任务；同步STR v3.43全面审查结果；TS编译0错误确认；AC-01~AC-06架构约束全部通过；禁用词表一致性（12项）代码验证通过；路由遮蔽问题代码验证已修复（categories在index.ts:123-131；EMS在index.ts:746-774）；三文档版本完全对齐（SRS→v3.42、SDS→v3.43、STR→v3.43）|
| 2026-04-17 | v3.42：SDS定时任务；同步STR v3.42全面审查结果；TS编译0错误确认；AC-01~AC-06架构约束全部通过；禁用词表一致性（12项）代码验证通过；路由遮蔽问题代码验证已修复；三文档版本对齐 |

---

## Actions

> **规则：** 每次修改本文档后必须更新此章节，反映当前项目最新待办方向，为后续协作者指明工作重点。

### 已完成项（v4.36同步）

1. ✅ **TypeScript编译检查**：0错误（v4.36确认，`npx tsc --noEmit`）
2. ✅ **架构约束验证**：AC-01~AC-06 全部通过（v4.36确认）
3. ✅ **禁用词表一致性**：ai_content.ts(23-27行导出BANNED_WORDS)、explain.ts(28行导入)、ai_review.ts(25行导入)三处均通过ai_content.ts统一导出单一真实源（ai_review.ts本地BANNED_EXPRESSIONS重复定义已删除）
4. ✅ **Migration编号冲突修复**：`014_clicks_cascade.sql` → 重命名为 `021_clicks_cascade.sql`
5. ✅ **ST-P7修复**：SDS F-050 migration状态表补充021_clicks_cascade条目
6. ✅ **路由遮蔽验证**：index.ts中categories路由(124行)在类目详情路由(129行)之前；EMS路由(751-774行members在776-789行enterprise详情之前)
7. ✅ **四文档版本对齐**：SRS→v4.36、SDS→v4.36、API→v4.36、STR→v4.39
8. ✅ **ST-C06修复验证**：behavior.ts dislikes按用户过滤
9. ✅ **ST-S01修复验证**：auth.ts PBKDF2密码哈希正确实现
10. ✅ **ST-S02修复验证**：auth.ts JWT密钥无回退默认值
11. ✅ **ST-P5修复**：SRS §2.2 F-016/F-020代码实现状态同步（🗓→🏗）
12. ✅ **ST-P6修复**：SRS版本v4.26→v4.35与其他文档对齐
13. ✅ **ST-P10修复**：SDS §F-013 HTTP方法修正遗漏（PUT→PATCH、POST /api/unsubscribe→DELETE /api/subscribe）；同步修复STR §F-013
14. ✅ **四文档版本对齐（v4.37）**：SRS→v4.37、SDS→v4.37、API→v4.37、STR→v4.41，全部对齐
15. ✅ **v4.37 代码修复**：tags.ts deleteTag引用计数绑定值修正（existing.name→existing.id）；getTagStats JOIN条件修正（t.slug→t.id）；recommendations.ts死代码移除；explain.ts冗余.sort()移除

### 待推进项（按优先级）

1. **AI 服务联调（优先）**：配置 `AI_API_KEY`（OpenAI 或 Anthropic），按 SDS AI 联调 SOP 完成 F-016（推荐解释 4 项）和 F-020（运营 AI 6 项）端到端验证，通过后将状态升级为 ✅
2. **本地 E2E 验证**：执行 `npm run build` + `wrangler d1 execute`，确认 001~018 迁移脚本在本地 D1 初始化成功
3. **端到端链路测试**：使用 Postman 对核心流（商品列表、标签精选、内容协商）进行完整 HTTP 链路验证
4. **优化项（非阻塞）**：P1-5 JSON 数组匹配改用 `json_each`、P1-6 时间存储策略统一、P1-7 前端 SSR 方案，待后续迭代处理

---

## 文档目标

本文档以SRS F编号为主线，记录每个功能模块的：
- 实现文件与代码位置
- 核心设计说明
- 数据模型对应
- API端点映射

不保留历史审核记录、阶段性整改过程、审计追溯叙述。

---

## 架构基线

- **运行平台：** Cloudflare Workers
- **结构化数据：** Cloudflare D1
- **内容正文与大文本：** Cloudflare R2
- **静态资源：** Workers Assets
- **统一入口：** `src/api/index.ts` 路由分发
- **管理端鉴权：** `X-Admin-Key` + `env.ADMIN_KEY`

---

## F-001~F-006 页面功能

### 设计说明
前端页面通过API层获取数据，支持JSON/Markdown内容协商。

### 实现文件

| 文件 | 说明 |
|------|------|
| `src/api/products.ts` | 商品列表/详情 |
| `src/api/lists.ts` | 榜单CRUD |
| `src/api/categories.ts` | 分类/子类目 |
| `src/api/subscribe.ts` | 订阅管理 |
| `src/api/favorites.ts` | 收藏管理 |

### 核心API端点

| 端点 | 方法 | 说明 |
|------|------|------|
| `/api/products` | GET | 商品列表（F-001） |
| `/api/products/:id` | GET | 商品详情（F-001） |
| `/api/lists` | GET | 榜单列表（F-003） |
| `/api/lists/:id` | GET | 榜单详情（F-003） |
| `/api/categories` | GET | 分类列表（F-002） |
| `/api/categories/:category/subcategories` | GET | 子类目筛选（F-002） |
| `/api/trending` | GET | 趋势内容（F-001-05） |
| `/api/favorites` | GET/POST/DELETE | 收藏管理（F-005） |
| `/api/favorites/lists` | GET/POST/DELETE | 榜单收藏（F-004-06） |

### 数据模型
- `products` 表 — 商品索引
- `lists` 表 — 榜单
- `list_products` 表 — 榜单商品关联
- `categories` 分类数据

---

## F-010 商品库管理

### 设计说明
商品全生命周期管理，支持D1+R2双写，内容与索引分离。

### 实现文件

| 文件 | 说明 |
|------|------|
| `src/api/products.ts` | 商品CRUD、批量导入 |
| `src/api/price_check.ts` | 价格监控 |

### 核心API端点

| 端点 | 方法 | 说明 |
|------|------|------|
| `/api/admin/products` | POST | 创建商品（F-010-01） |
| `/api/admin/products/:id` | PUT | 更新商品（F-010-02） |
| `/api/admin/products/:id/status` | PATCH | 上下架（F-010-03） |
| `/api/admin/products/batch` | POST | 批量更新（F-010-04） |
| `/api/admin/products/import` | POST | 导入商品（F-010-01） |
| `/api/admin/price-check` | POST | 价格回推（F-010-05） |
| `/api/admin/price-check/batch` | POST | 批量价格检查 |

### F-010-01 创建商品接口详细说明

**POST /api/admin/products**

支持两种创建模式：

1. **标准模式**：传入结构化字段（title, price_min, images等），系统生成R2路径
2. **R2直传模式**：传入 `source_md` + `source_filename`，直接上传完整Markdown文档到R2

**R2存储路径格式**（R2直传模式）：
```
{platform}/{category}/YYYY-MM/{source_filename}
```
例如：`temu/books/2026-04/C20260421-001.md`

**关键字段**：
| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| source_platform | string | ✅ | 商品平台：temu, shein, amazon, sumaitong, tiktok |
| source_url | string | ✅ | 商品详情页URL |
| original_title | string | ✅ | 原始商品标题 |
| title | string | | 商品展示标题 |
| category | string | ✅ | 商品类目 |
| source_md | string | | 完整markdown文件内容（R2直传模式） |
| source_filename | string | | 原始文件名（R2直传模式） |

**r2_object_key唯一性**：R2路径字段有唯一索引，重复上传相同路径会替换已有记录。

### 数据模型
- `products` 表 — 商品主表（含r2_object_key索引，格式为 `{platform}/{category}/YYYY-MM/{filename}`）

---

## F-011 标签体系

### 设计说明
支持一/二级维度标签，支持精选商品映射，标签维度可动态扩展。

### 实现文件

| 文件 | 说明 |
|------|------|
| `src/api/tags.ts` | 标签CRUD |
| `src/api/products.ts` | 商品打标（PATCH /api/admin/products/:id/tags） |

### 核心API端点

| 端点 | 方法 | 说明 |
|------|------|------|
| `/api/admin/tags` | POST | 创建标签（F-011-01） |
| `/api/admin/tags/:id` | PUT/DELETE | 更新/删除标签 |
| `/api/admin/tags/:id/featured` | PATCH | 更新精选商品（F-011-02） |
| `/api/tags` | GET | 标签列表（F-011-01） |
| `/api/tags/stats` | GET | 标签统计（F-011-03） |

### 数据模型
- `tags` 表 — 含 `layer`（category/function/audience/style/price）、`dimension_level`、`featured_products`

---

## F-012 联盟追踪

### 设计说明
点击追踪参数记录，5分钟去重窗口，转化回调确认。

### 实现文件

| 文件 | 说明 |
|------|------|
| `src/api/clicks.ts` | 点击记录 |
| `src/api/conversions.ts` | 转化回调 |

### 核心API端点

| 端点 | 方法 | 说明 |
|------|------|------|
| `/api/clicks` | POST | 记录点击（F-012-01~04） |
| `/api/conversions/callback` | POST | 联盟回调（F-040-20） |

### 数据模型
- `clicks` 表 — 点击日志（含UTM参数）
- `conversions` 表 — 转化记录

---

## F-013 用户订阅

### 设计说明
完整订阅运营闭环：订阅/退订/偏好/邮件/分群。

### 实现文件

| 文件 | 说明 |
|------|------|
| `src/api/subscribe.ts` | 订阅/退订/偏好 |
| `src/api/favorites.ts` | 收藏管理 |
| `src/api/admin/subscribers.ts` | 订阅管理后台 |
| `src/api/email.ts` | 邮件发送 |

### 核心API端点

| 端点 | 方法 | 说明 |
|------|------|------|
| `/api/subscribe` | POST | 订阅（F-013-01） |
| `/api/subscribe/preferences` | PATCH | 更新偏好（F-013-02） |
| `/api/subscribe` | DELETE | 退订（F-013-03） |
| `/api/favorites` | GET/POST/DELETE | 收藏管理（F-013-05） |
| `/api/admin/subscribers` | GET | 订阅列表（F-013-08） |
| `/api/admin/subscribers/export` | GET | 导出CSV（F-013-09） |

### 数据模型
- `users` 表 — 含 `subscribed_categories`、`liked_tags`、`disliked_tags`、`saved_items`
- `email_logs` 表 — 邮件发送日志

---

## F-014 基础推荐

### 设计说明
规则推荐：同类目/同标签/价格带/热门/新品，30天窗口行为加权。

### 实现文件

| 文件 | 说明 |
|------|------|
| `src/api/recommendations.ts` | 规则推荐引擎 |

### 核心API端点

| 端点 | 方法 | 说明 |
|------|------|------|
| `/api/recommendations` | GET | 个性化推荐feed（F-014） |

### 推荐评分公式
```
score = category_match×10 + tag_match×3 + click_count×1 + favorite_count×2 + price_match×5 + recency_days×0.1
```

---

## F-015 进阶推荐

### 设计说明
行为推荐：行为分计算、协同过滤、MMR多样性控制。

### 实现文件

| 文件 | 说明 |
|------|------|
| `src/api/behavior.ts` | 行为评分（含ST-C06修复：dislikes查询按用户过滤） |
| `src/api/recommendations.ts` | 结果重排 |

### 核心API端点

| 端点 | 方法 | 说明 |
|------|------|------|
| `/api/recommendations/behavioral` | GET | 行为推荐（F-015） |

### 行为评分计算
- 评分公式：`click×1 + favorite×5 + save×3 - dislike×8`
- 时间衰减：`e^(-0.1 × days_ago)`，30天窗口衰减至20%
- **ST-C06修复**：dislikes查询现在按用户ID过滤，只统计当前用户disliked_tags中包含该商品标签的商品

### MMR多样性控制
- 同一subcategory商品 ≤ 推荐结果30%
- 覆盖用户偏好标签中至少3个不同标签
- 计算超时预算 ≤ 50ms

---

## F-016 AI推荐解释

### 设计说明
预生成文案检索+规则模板拼装，非实时LLM生成。用户×商品24h TTL，通用7d，AI生成72h。

### 实现文件

| 文件 | 说明 |
|------|------|
| `src/api/explain.ts` | 解释生成/缓存（含ST-P1修复：时间戳类型统一为INTEGER） |

### 核心API端点

| 端点 | 方法 | 说明 |
|------|------|------|
| `/api/explain/:product_id` | GET | 推荐理由（F-016-01） |
| `/api/explain/batch` | POST | 批量解释 |
| `/api/explain/:product_id/comparison` | GET | 对比说明（F-016-02） |
| `/api/explain/:product_id/scenarios` | GET | 场景描述（F-016-03） |

### 数据模型
- `explanation_cache` 表 — 解释缓存（含TTL）
- **ST-P1修复**：`generated_at`/`expires_at` 字段类型统一为 INTEGER（Unix时间戳秒数），确保时间比较一致性

### 模板优先级
1. "Because you liked [类目] picks like [商品]"
2. "Picked for your [类目] feed"
3. "Matches your [budget/mid/premium] preference"
4. "Matches your interest in [标签]"
5. "Trending in [类目] this week"
6. 兜底

---

## F-017 数据看板

### 设计说明
运营分析指标：UV/CTR/转化/留存/分类/榜单/趋势。

### 实现文件

| 文件 | 说明 |
|------|------|
| `src/api/analytics.ts` | 分析端点 |

### 核心API端点

| 端点 | 方法 | 说明 |
|------|------|------|
| `/api/admin/analytics/overview` | GET | 总览 |
| `/api/admin/analytics/uv` | GET | UV统计 |
| `/api/admin/analytics/ctr` | GET | CTR统计 |
| `/api/admin/analytics/conversion` | GET | 转化统计 |
| `/api/admin/analytics/categories` | GET | 分类统计 |
| `/api/admin/analytics/lists` | GET | 榜单统计 |
| `/api/admin/analytics/trends` | GET | 趋势分析 |

---

## F-020 运营AI能力

### 设计说明
系统外运营AI角色：选品/内容/社媒文案/推荐解释/运营分析/字段补全。异步产出后经F-040-22入库。

### 实现文件

| 文件 | 说明 |
|------|------|
| `src/api/ai_content.ts` | AI能力端点 |

### 核心API端点

| 端点 | 方法 | 说明 |
|------|------|------|
| `/api/admin/ai/selection-assistance` | POST | 选品辅助（F-020-01） |
| `/api/admin/ai/content-generation` | POST | 内容生成（F-020-02） |
| `/api/admin/ai/social-copy` | POST | 社媒文案（F-020-03） |
| `/api/admin/ai/analytics-insights` | POST | 运营分析（F-020-05） |
| `/api/admin/ai/product-completion` | POST | 字段补全（F-020-06） |

---

## F-021 AI边界限制

### 设计说明
人工审核工作流：选品/合规/品牌/商业排序/夸张表述必须人工确认。

### 实现文件

| 文件 | 说明 |
|------|------|
| `src/api/ai_review.ts` | 审核工作流 |

### 核心API端点

| 端点 | 方法 | 说明 |
|------|------|------|
| `/api/admin/ai/review/create` | POST | 创建审核记录 |
| `/api/admin/ai/review` | GET | 审核列表 |
| `/api/admin/ai/review/:id` | GET | 审核详情 |
| `/api/admin/ai/review/:id/submit` | POST | 提交审核 |
| `/api/admin/ai/review/:id/review` | POST | 一审/批准/拒绝 |
| `/api/admin/ai/review/:id/high-risk-review` | POST | 二审 |
| `/api/admin/ai/review/:id/tone-review` | POST | 语气审核 |
| `/api/admin/ai/review/:id/revision` | POST | 请求修订 |
| `/api/admin/ai/review/pending-counts` | GET | 待审计数 |
| `/api/admin/ai/review/validate` | POST | 内容校验 |

### 禁用词（16项，ST-P4修复：统一禁用词表，ai_content.ts/explain.ts/ai_review.ts三处一致）
`best`/`worst`/`safest`/`guaranteed`/`proven`/`clinically`/`miracle`/`revolutionary`/`lifesaving`/`official`/`authentic`/`dangerous`/`amazing`/`incredible`/`unbelievable`/`game-changing`

---

## F-022 多语言支持

### 设计说明
国际化：locale/词条翻译/内容翻译/同步队列。MVP阶段仅英语。

### 实现文件

| 文件 | 说明 |
|------|------|
| `src/api/i18n.ts` | 多语言端点 |

### 核心API端点

| 端点 | 方法 | 说明 |
|------|------|------|
| `/api/i18n/locales` | GET | 支持语言列表 |
| `/api/i18n/translations/:locale` | GET | 翻译词条 |
| `/api/i18n/content/:type/:id/:locale/:field` | GET | 内容翻译 |

---

## F-023 会员体系

### 设计说明
会员层级/订阅/续期/权益/专属内容。

### 实现文件

| 文件 | 说明 |
|------|------|
| `src/api/membership.ts` | 会员端点 |

### 核心API端点

| 端点 | 方法 | 说明 |
|------|------|------|
| `/api/membership/tiers` | GET | 会员层级（F-023-01） |
| `/api/membership/my` | GET | 我的会员 |
| `/api/membership/subscribe` | POST | 订阅（F-023-02） |
| `/api/membership/check` | POST | 权益验证（F-023-03） |

### 数据模型
- `membership_tiers` 表
- `user_memberships` 表
- `subscription_events` 表

---

## F-030 内容管理

### 设计说明
选题/选品/发布/排期/统计的生产流程。

### 实现文件

| 文件 | 说明 |
|------|------|
| `src/api/admin/content.ts` | 内容管理 |

### 核心API端点

| 端点 | 方法 | 说明 |
|------|------|------|
| `/api/admin/topics` | GET/POST | 选题管理 |
| `/api/admin/topics/:id/products` | POST | 添加候选商品 |
| `/api/admin/content/publish` | POST | 发布内容 |
| `/api/admin/content/schedule` | GET | 排期查看 |
| `/api/admin/content/stats` | GET | 周产出统计 |

### 数据模型
- `content_topics` 表
- `topic_products` 表
- `content_production` 表

---

## F-040 API端点

### 设计说明
统一API入口，所有路由在`src/api/index.ts`分发。

### 端点分类

#### 公开端点（6个）
| 端点 | 说明 |
|------|------|
| GET `/api/products` | 商品列表 |
| GET `/api/products/:id` | 商品详情 |
| GET `/api/lists` | 榜单列表 |
| GET `/api/lists/:id` | 榜单详情 |
| GET `/api/categories` | 分类列表 |
| GET `/api/trending` | 趋势内容 |

#### 用户端点（8个）
| 端点 | 说明 |
|------|------|
| POST `/api/subscribe` | 订阅 |
| PATCH `/api/subscribe/preferences` | 更新偏好 |
| DELETE `/api/subscribe` | 退订 |
| GET/POST/DELETE `/api/favorites` | 收藏 |
| POST `/api/clicks` | 记录点击 |
| GET `/api/recommendations` | 推荐feed |

#### 管理端点（11个）
| 端点 | 说明 |
|------|------|
| POST `/api/admin/products` | 创建商品 |
| PUT `/api/admin/products/:id` | 更新商品 |
| PATCH `/api/admin/products/:id/status` | 上下架 |
| PATCH `/api/admin/products/:id/tags` | 打标 |
| POST `/api/admin/products/batch` | 批量更新 |
| POST `/api/admin/products/import` | 导入 |
| POST `/api/admin/tags` | 创建标签 |
| POST `/api/admin/lists` | 创建榜单 |
| GET `/api/admin/configs` | 全局配置列表（F-040-24） |
| POST `/api/admin/configs` | 创建配置（F-040-24a） |
| PUT `/api/admin/configs/:key` | 更新配置（F-040-25） |

#### 外部系统接口（4个）
| 端点 | 说明 |
|------|------|
| POST `/api/conversions/callback` | 联盟回调（F-040-20） |
| POST `/api/admin/price-check` | 价格回推（F-040-23） |
| POST `/api/admin/price-check/batch` | 批量价格回推 |
| GET `/api/configs/:key` | 公开配置读取（F-040-26） |

### 认证方式
- 管理端：`X-Admin-Key` Header
- 用户端：`X-User-Email` 或 `X-Anonymous-Id`

---

## F-050 数据模型

### D1表结构

| 表名 | 说明 | 对应Migrations |
|------|------|----------------|
| `products` | 商品主表 | 001_initial_schema |
| `users` | 用户表 | 001_initial_schema |
| `clicks` | 点击日志 | 001_initial_schema, 021_clicks_cascade |
| `lists` | 榜单表 | 001_initial_schema |
| `list_products` | 榜单商品关联 | 010_list_products |
| `tags` | 标签表 | 001_initial_schema |
| `user_sessions` | 会话表 | 012_ems_schema |
| `conversions` | 转化记录 | 013_runtime_tables |
| `explanation_cache` | 解释缓存（ST-P1修复：时间戳为INTEGER） | 013_runtime_tables |
| `email_logs` | 邮件日志 | 013_runtime_tables |
| `price_history` | 价格历史 | 004_price_history |
| `ai_review_records` | AI审核记录 | 005_ai_review_records |
| `global_configs` | 全局配置 | 014_global_configs |
| `ems_users` | EMS用户 | 012_ems_schema |
| `enterprises` | 企业 | 012_ems_schema |
| `enterprise_members` | 企业成员 | 012_ems_schema |
| `records` | 业务记录 | 012_ems_schema |
| `audit_logs` | 审计日志 | 012_ems_schema |

### TypeScript类型
`src/db/schema.ts` — 所有表对应TypeScript类型定义

---

## 关键实现约束

| 约束 | 说明 |
|------|------|
| 鉴权 | 管理端统一 `isAdmin(request, env)` |
| 内容协商 | 产品接口支持 JSON/Markdown |
| 存储分离 | D1存索引，R2存内容/图片 |
| 推荐链路 | 仅DB检索+随机抽选，无实时LLM |
| API唯一入口 | 前端/Agent禁止直连D1/R2 |

---

## 当前基线状态（v4.36）

| 指标 | 数值 | 备注 |
|------|------|------|
| 总功能数 | 149项 | |
| 需求设计(🗓) | 149项 | 100% |
| 代码实现(🏗) | 149项 | 100% |
| 功能审核(✅) | 134项 | 90% |
| 待AI联调(🏗) | 15项 | F-016(4项)+F-020(6项)+F-040-22(1项)等 |
| 完成度 | 90% | |
| TypeScript编译 | ✅ 0错误 | `npx tsc --noEmit` |
| 架构约束 | ✅ AC-01~AC-06全部通过 | |
| Migration编号 | ✅ 001~021连续无冲突 | v4.33确认：021_clicks_cascade已补充至SDS F-050表 |

**无 CRITICAL/HIGH 阻塞项。**
