# Tools Prompt 模板索引

以下 11 个 `.md` 文件是 Story Forger 各 `POST .../generate` 端点的 task prompt 模板。
使用时通过 `renderTemplate(template, vars)`（Mustache 引擎，来自 `l1/render.ts`）注入变量，生成最终的 user prompt 发送给 AI。

**v2.5 重要变更**：所有 prompt 模板统一要求 LLM 输出 `{"slots": {...}}` JSON 格式，不再依赖 LLM 输出带槽位标记的 Markdown。Markdown 由服务端代码通过 `renderTemplate(tmpl, lang, level, {prefills, cleanOutput: true})` 组装生成。

**注意**：这些模板**不定义 AI 人格**（persona 由 `l1/prompts/writer_companion/system.md` 统一管理）。
模板内容仅包含任务描述和格式要求。

---

## 模板清单

### 1. worldbuilding_gen.md
- **来源文件**: `src/api/write/worldbuilding.ts` → `POST /api/write/worldbuilding/generate`
- **场景**: M1 世界观生成。作者提供原始构想（M0）或手动输入指令，AI 填充设定圣经的模板槽位
- **变量**: `work_title`, `category`, `summary`, `author_prompt`, `style_notes`, `entity_context`, `outline_context`, `template_json`, `lang_label`
- **输出**: JSON `{ "slots": { "power_system": "...", "social_structure": "...", ... } }`

### 2. outline_gen.md
- **来源文件**: `src/api/write/outline.ts` → `POST /api/write/outline/generate`
- **场景**: M2 大纲生成。根据世界观和已有角色，生成 N 章的章节列表 + 长篇框架槽位填充
- **变量**: `work_title`, `category`, `num_chapters`, `world_context`, `entity_names`, `template_json`, `lang_label`
- **输出**: JSON `{ "sections": [...], "framework_slots": { "one_line_pitch": "...", ... } }`

### 3. foreshadowing_gen.md
- **来源文件**: `src/api/write/foreshadowing.ts` → `POST /api/write/foreshadowing/generate`
- **场景**: M4 伏笔网络设计。根据世界观、大纲和章节结构，规划伏笔策略
- **变量**: `work_title`, `world_context_section`, `outline_context_section`, `section_titles_section`, `template_json`, `lang_label`
- **输出**: JSON `{ "slots": { "fh_strategy": "..." } }`

### 4. draft_generate.md
- **来源文件**: `src/api/write/draft.ts` → `POST /api/write/draft/generate`
- **场景**: M6 章节初稿生成。根据世界观约束、前文概要、创作意图卡，生成指定章节的完整正文
- **变量**: `work_title`, `category`, `chapter_index`, `chapter_title`, `world_context`, `prev_context`, `intent_context`, `section_summary`
- **输出**: JSON `{ "slots": { "content": "完整的章节正文（Markdown 格式）" } }`

### 5. draft_check.md
- **来源文件**: `src/api/write/draft.ts` → `POST /api/write/draft/check/{work_id}/{section_id}`
- **场景**: M6 一致性校验。检查章节内容是否与世界观设定、前文事实、人物设定一致
- **变量**: `world_context`, `chapter_content`, `prev_context`, `intent_context`
- **输出**: JSON `{ "issues": [{ severity, type, description, location, suggestion }] }`

### 6. draft_polish.md
- **来源文件**: `src/api/write/draft.ts` → `POST /api/write/draft/polish`
- **场景**: M6 章节润色。根据风格要求和需修复的问题清单，润色章节正文
- **变量**: `style_notes`, `fixes_section`, `chapter_content`
- **输出**: JSON `{ "slots": { "content": "润色后的章节正文（Markdown 格式）" } }`

### 7. draft_rewrite.md
- **来源文件**: `src/api/write/draft.ts` → `POST /api/write/draft/rewrite/{section_id}`
- **场景**: M6 章节重写。基于世界观约束和前文概要，重新撰写指定章节
- **变量**: `world_context`, `prev_context`, `intent_context`, `reference_content`, `instructions_section`
- **输出**: JSON `{ "slots": { "content": "重写后的章节正文（Markdown 格式）" } }`

### 8. marketing_extract.md
- **来源文件**: `src/api/write/marketing.ts` → `POST /api/write/marketing/extract/{section_id}`
- **场景**: 营销提取。从章节中提取金句、冲突点、钩子和推荐标签
- **变量**: `chapter_content`, `section_summary`
- **输出**: JSON `{ golden_lines, conflict_points, hooks, suggested_hashtags }`

### 9. marketing_titles.md
- **来源文件**: `src/api/write/marketing.ts` → `POST /api/write/marketing/titles/{work_id}`
- **场景**: 标题生成。为作品生成面向不同读者群的标题、副标题和钩子
- **变量**: `num_variants`, `work_title`, `category`, `summary`, `style_notes`
- **输出**: JSON `{ titles: [{ version, title, subtitle, hook }] }`

### 10. marketing_repurpose.md
- **来源文件**: `src/api/write/marketing.ts` → `POST /api/write/marketing/repurpose/{section_id}`
- **场景**: 分发改写。将章节改写为短视频口播/X线程/LinkedIn 帖子
- **变量**: `format_instruction`, `chapter_content`, `style_notes`
- **输出**: 纯文本

### 11. hints_dynamic.md
- **来源文件**: `src/api/write/hints.ts` → `appendDynamicHint()`（内部函数，待接入）
- **场景**: 动态提示生成。Story Elf 根据当前模块和作品内容，生成个性化双语创作提示
- **变量**: `work_title`, `category`, `module_label`, `context_snippet`
- **输出**: JSON `{ zh: "...", en: "..." }`

---

## 调用方式

所有模板通过统一的渲染管道加载：

```typescript
import { renderTemplate as renderText } from '../../lib/l1/render';
import someTemplateMd from '../../lib/l1/prompts/tools/some_template.md';

const vars = { work_title: "作品名", ... };
const prompt = renderText(someTemplateMd, vars);
const result = await callAI(env, [{ role: 'user', content: prompt }], {
  maxTokens: 4096,
  responseFormat: 'json',  // DeepSeek V4 JSON mode
});
```

变量注入使用 `{{variable}}` 和 `{{{variable}}}` 语法（参考 `l1/render.ts`）。

服务端组装 Markdown 使用 `template.ts` 中的 `renderTemplate()` / `renderCard()`：

```typescript
import { renderTemplate, extractTemplateJson } from '../../lib/template';

const parsed = extractTemplateJson(aiResult.content);
const cleanMd = renderTemplate(BIBLE_TEMPLATE, lang, 2, {
  prefills: parsed.slots,
  cleanOutput: true,
});
// cleanMd 是无标记的干净 Markdown，写 R2
```

## 数据流（v2.5）

```
TemplateDef (TypeScript) → renderTemplateAsJson() → JSON schema → LLM prompt
  → LLM 输出 {"slots": {...}} JSON
  → extractTemplateJson() 解析
  → renderTemplate(prefills, cleanOutput:true) → clean Markdown
  → R2 双文件: {module}.json (数据) + {module}.md (视图)
  → API 返回: { template: JSON结构, rendered_md: Markdown }
```
