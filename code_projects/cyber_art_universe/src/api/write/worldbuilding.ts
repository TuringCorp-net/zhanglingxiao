// 世界观引擎 — SF-010~016（多语言支持）
import { Env } from '../../db/schema';
import { jsonSuccess, jsonError } from '../../lib/response';
import { ErrorCodes } from '../../lib/errors';
import { generateWithAI } from '../../lib/ai';
import { workContentPath, SUPPORTED_LANGS, DEFAULT_LANG, DEFAULT_BILINGUAL, extractLang, readR2WithLangFallback, type Lang, LANG_LABELS } from '../../lib/work_content';

// ============================================================
// 世界观设定圣经 — 结构化模板（中英双语）
// ============================================================

const BIBLE_TEMPLATE_ZH = `# 世界观设定圣经

> 本文件是作品的最高约束文档。所有人物、情节、章节内容必须服从此圣经的规则。
> 各章节标题为设定框架，内容由作者与 AI 共同填充。可版本化、可回滚。

## 一、世界规则与边界

### 力量/技术体系
<!-- hint:描述这个世界的力量来源、等级划分、使用规则与代价 -->
<!-- slot -->
<!-- /slot -->

### 社会组织与结构
<!-- hint:国家、势力、阶层、家族等社会组织形态 -->
<!-- slot -->
<!-- /slot -->

### 禁忌与代价
<!-- hint:世界中不可触碰的禁忌、使用力量的代价 -->
<!-- slot -->
<!-- /slot -->

## 二、核心主题与价值观

### 核心命题
<!-- hint:作品要传达的核心思想或问题 -->
<!-- slot -->
<!-- /slot -->

### 情感基调
<!-- hint:整体的情感色彩：黑暗/希望/悲壮/轻松 等 -->
<!-- slot -->
<!-- /slot -->

### 叙事立场
<!-- hint:从谁的视角看世界？隐含的价值判断 -->
<!-- slot -->
<!-- /slot -->

## 三、角色体系

### 主角
<!-- hint:姓名、身份、核心动机、能力边界、成长弧线 -->
<!-- slot -->
<!-- /slot -->

### 核心配角
<!-- hint:与主角的关系、各自动机、在主线中的作用 -->
<!-- slot -->
<!-- /slot -->

### 角色关系网
<!-- hint:角色之间的关键关系（可后续由 M3 人物卡模块细化） -->
<!-- slot -->
<!-- /slot -->

## 四、场景与资源

### 主要地点
<!-- hint:关键场景的地理位置、特征、叙事功能 -->
<!-- slot -->
<!-- /slot -->

### 关键道具/技能
<!-- hint:可被反复使用的叙事资源（MacGuffin、圣物、核心能力等） -->
<!-- slot -->
<!-- /slot -->

## 五、承诺清单

<!-- hint:开篇对读者/观众许诺的爽点或价值，后续必须兑现。每条承诺一句话概括。 -->
<!-- slot -->
<!-- /slot -->
<!-- hint:承诺项 #1：写出第一个必须兑现的承诺 -->
<!-- slot -->
<!-- /slot -->
<!-- hint:承诺项 #2：写出第二个必须兑现的承诺 -->
<!-- slot -->
<!-- /slot -->
<!-- hint:承诺项 #3：写出第三个必须兑现的承诺 -->
<!-- slot -->
<!-- /slot -->

## 六、禁区与风格

### 内容禁区
<!-- hint:绝对不能触碰的内容主题 -->
<!-- slot -->
<!-- /slot -->

### 语言风格
<!-- hint:叙事语言的风格定位：简洁/华丽/口语化/文学性 等 -->
<!-- slot -->
<!-- /slot -->

### 节奏偏好
<!-- hint:快节奏/慢热/张弛有度 等 -->
<!-- slot -->
<!-- /slot -->
`;

const BIBLE_TEMPLATE_EN = `# Setting Bible

> This document is the supreme constraint for the work. All characters, plots, and chapter content must obey the rules herein.
> Section headings form the structural framework; content is filled collaboratively by the author and AI. Version-controlled and rollback-capable.

## I. World Rules & Boundaries

### Power / Technology System
<!-- hint:Describe the source of power, hierarchy, usage rules, and costs in this world -->
<!-- slot -->
<!-- /slot -->

### Social Organization & Structure
<!-- hint:Nations, factions, classes, clans, and other social structures -->
<!-- slot -->
<!-- /slot -->

### Taboos & Costs
<!-- hint:Untouchable taboos in this world, costs of using power -->
<!-- slot -->
<!-- /slot -->

## II. Core Themes & Values

### Central Thesis
<!-- hint:The core idea or question the work seeks to convey -->
<!-- slot -->
<!-- /slot -->

### Emotional Tone
<!-- hint:Overall emotional register: dark / hopeful / tragic / lighthearted, etc. -->
<!-- slot -->
<!-- /slot -->

### Narrative Stance
<!-- hint:Whose perspective shapes the world? Implicit value judgments -->
<!-- slot -->
<!-- /slot -->

## III. Character System

### Protagonist
<!-- hint:Name, identity, core motivation, ability boundaries, growth arc -->
<!-- slot -->
<!-- /slot -->

### Key Supporting Characters
<!-- hint:Relationship to protagonist, individual motivations, role in the main plot -->
<!-- slot -->
<!-- /slot -->

### Character Relationship Web
<!-- hint:Key relationships between characters (to be refined by M3 Character Cards) -->
<!-- slot -->
<!-- /slot -->

## IV. Settings & Resources

### Major Locations
<!-- hint:Geography, features, and narrative function of key settings -->
<!-- slot -->
<!-- /slot -->

### Key Items / Artifacts
<!-- hint:Reusable narrative resources (MacGuffins, relics, core abilities, etc.) -->
<!-- slot -->
<!-- /slot -->

## V. Promise Checklist

<!-- hint:Promises made to readers/viewers that must be fulfilled later. One sentence per promise. -->
<!-- slot -->
<!-- /slot -->
<!-- hint:Promise #1: The first promise that must be delivered -->
<!-- slot -->
<!-- /slot -->
<!-- hint:Promise #2: The second promise that must be delivered -->
<!-- slot -->
<!-- /slot -->
<!-- hint:Promise #3: The third promise that must be delivered -->
<!-- slot -->
<!-- /slot -->

## VI. Boundaries & Style

### Content Red Lines
<!-- hint:Themes and content that must never be touched -->
<!-- slot -->
<!-- /slot -->

### Language Style
<!-- hint:Prose style: concise / ornate / colloquial / literary, etc. -->
<!-- slot -->
<!-- /slot -->

### Pacing Preference
<!-- hint:Fast-paced / slow-burn / balanced rhythm, etc. -->
<!-- slot -->
<!-- /slot -->
`;

/** 根据语言获取对应模板 */
function getBibleTemplate(lang: Lang): string {
  return lang === 'en' ? BIBLE_TEMPLATE_EN : BIBLE_TEMPLATE_ZH;
}

// ============================================================
// POST /api/write/worldbuilding/generate
// 支持 ?lang=zh&bilingual=true&langs=zh,en
// ============================================================

export async function generateWorldbuilding(env: Env, request: Request): Promise<Response> {
  const body = await request.json() as { work_id: string; prompt?: string; style_notes?: string; bilingual?: boolean; langs?: string[] };
  if (!body.work_id) {
    return new Response(JSON.stringify(jsonError(ErrorCodes.MISSING_REQUIRED_FIELD, 'work_id is required')), {
      status: 400, headers: { 'Content-Type': 'application/json' },
    });
  }

  const work = await env.DB.prepare('SELECT id, title, category, summary FROM works WHERE id = ?').bind(body.work_id).first<Record<string, unknown>>();
  if (!work) {
    return new Response(JSON.stringify(jsonError(ErrorCodes.WORK_NOT_FOUND, 'Work not found')), {
      status: 404, headers: { 'Content-Type': 'application/json' },
    });
  }

  // 确定生成语言：bilingual=true 时用 langs（默认中英），否则用请求参数或默认中文
  const bilingual = body.bilingual ?? true; // 默认双语生成
  const targetLangs: Lang[] = bilingual
    ? (body.langs?.filter(l => SUPPORTED_LANGS.includes(l as Lang)) as Lang[] || DEFAULT_BILINGUAL)
    : [extractLang(request)];

  // 收集上下文
  const entities = await env.DB.prepare('SELECT name, type, description FROM entities WHERE work_id = ?').bind(body.work_id).all<Record<string, unknown>>();
  const sections = await env.DB.prepare('SELECT title, section_summary FROM sections WHERE work_id = ? ORDER BY order_index LIMIT 3').bind(body.work_id).all<Record<string, unknown>>();

  const entityContext = (entities.results || []).map(e => `- ${e.name}(${e.type}): ${e.description || '暂无描述'}`).join('\n');
  const outlineContext = (sections.results || []).map(s => `- ${s.title}: ${s.section_summary || ''}`).join('\n');

  // 并行生成所有目标语言
  const results: Record<string, { content: string; constraints: { section: string; rule: string }[] }> = {};

  await Promise.all(targetLangs.map(async (lang) => {
    const template = getBibleTemplate(lang);
    const langLabel = LANG_LABELS[lang];

    const prompt = `你是一位专业的小说世界观设计师。请根据以下信息，为作品《${work.title}》填充一份结构化的世界观设定圣经（Setting Bible）。

作品题材：${work.category || '未指定'}
作品简介：${work.summary || '未提供'}
作者补充：${body.prompt || '无'}
风格要求：${body.style_notes || '专业、详细'}

${entityContext ? `已有角色/实体：\n${entityContext}` : ''}
${outlineContext ? `已有章节概要：\n${outlineContext}` : ''}

请严格按照以下 Markdown 模板结构输出。模板使用三标记分离格式：the hint marker 为提示文字，the slot opening marker 为槽位开始，the slot closing marker 为槽位结束。请在这三个标记之后（即 the slot opening marker 和 the slot closing marker 之间）写入实际内容，保留所有标记不变。标题、引用等其他结构保持原样。如果某个章节暂时无法填充，保留三个标记不变，其间留空行。

输出模板：

${template}

重要要求：
1. 保持所有 ## 和 ### 标题不变
2. 将内容写在 the slot opening marker 和 the slot closing marker 之间（the hint marker 保留在上方），每个槽位写 2-5 段实际内容
3. 承诺清单（## 五）至少给出 3 条具体的承诺项
4. 内容必须自洽，规则之间不能矛盾
5. 用${langLabel}输出`;

    const result = await generateWithAI(env, prompt, { maxTokens: 4096 });
    if (result) {
      // 写入 R2（按语言路径）
      try {
        await env.WORKS_BUCKET.put(workContentPath(body.work_id, lang, 'world_bible.md'), result, {
          httpMetadata: { contentType: 'text/markdown; charset=utf-8' },
        });
      } catch (err) {
        console.error(`R2 write failed for world_bible.md (${lang}):`, body.work_id, err);
      }

      const constraints = extractConstraints(result);
      try {
        await env.WORKS_BUCKET.put(workContentPath(body.work_id, lang, 'constraints.json'), JSON.stringify(constraints, null, 2), {
          httpMetadata: { contentType: 'application/json' },
        });
      } catch (err) {
        console.error(`R2 write failed for constraints.json (${lang}):`, body.work_id, err);
      }

      results[lang] = { content: result, constraints };
    }
  }));

  return new Response(JSON.stringify(jsonSuccess({
    work_id: body.work_id,
    bilingual: targetLangs.length > 1,
    languages: targetLangs,
    results,
  })), {
    headers: { 'Content-Type': 'application/json' },
  });
}

// ============================================================
// GET /api/write/worldbuilding/{work_id}?lang=zh|en
// ============================================================

export async function readWorldbuilding(env: Env, request: Request, workId: string): Promise<Response> {
  const lang = extractLang(request);
  const { content, actualLang } = await readR2WithLangFallback(env, workId, lang, 'world_bible.md');

  if (!content) {
    // 返回对应语言的结构化空模板
    const template = getBibleTemplate(lang);
    return new Response(JSON.stringify(jsonSuccess({
      work_id: workId,
      lang,
      content: template,
      is_template: true,
      message: lang === 'en'
        ? 'Setting Bible not yet filled. Below is the framework. Please fill in section by section, or use AI generation.'
        : '世界观尚未填充，以下为设定框架。请按章节标题逐步填写，或使用 AI 生成。',
    })), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify(jsonSuccess({
    work_id: workId,
    lang: actualLang,
    content,
    is_template: false,
  })), {
    headers: { 'Content-Type': 'application/json' },
  });
}

// ============================================================
// PUT /api/write/worldbuilding/{work_id}?lang=zh|en
// ============================================================

export async function updateWorldbuilding(env: Env, request: Request, workId: string): Promise<Response> {
  const lang = extractLang(request);
  const body = await request.json() as { content: string };
  if (!body.content) {
    return new Response(JSON.stringify(jsonError(ErrorCodes.MISSING_REQUIRED_FIELD, 'content is required')), {
      status: 400, headers: { 'Content-Type': 'application/json' },
    });
  }

  // 验证 work 存在
  const work = await env.DB.prepare('SELECT id FROM works WHERE id = ?').bind(workId).first();
  if (!work) {
    return new Response(JSON.stringify(jsonError(ErrorCodes.WORK_NOT_FOUND, 'Work not found')), {
      status: 404, headers: { 'Content-Type': 'application/json' },
    });
  }

  await env.WORKS_BUCKET.put(workContentPath(workId, lang, 'world_bible.md'), body.content, {
    httpMetadata: { contentType: 'text/markdown; charset=utf-8' },
  });

  const constraints = extractConstraints(body.content);
  await env.WORKS_BUCKET.put(workContentPath(workId, lang, 'constraints.json'), JSON.stringify(constraints, null, 2), {
    httpMetadata: { contentType: 'application/json' },
  });

  return new Response(JSON.stringify(jsonSuccess({ work_id: workId, lang, updated: true, constraints })), {
    headers: { 'Content-Type': 'application/json' },
  });
}

// ============================================================
// GET /api/write/worldbuilding/{work_id}/constraints?lang=zh|en
// ============================================================

export async function readConstraints(env: Env, request: Request, workId: string): Promise<Response> {
  const lang = extractLang(request);
  const key = workContentPath(workId, lang, 'constraints.json');
  const obj = await env.WORKS_BUCKET.get(key);
  if (!obj) {
    return new Response(JSON.stringify(jsonSuccess({
      work_id: workId,
      lang,
      constraints: [],
      message: lang === 'en'
        ? 'Constraints not yet extracted. Please generate the Setting Bible first.'
        : '约束尚未提取，请先生成世界观',
    })), {
      headers: { 'Content-Type': 'application/json' },
    });
  }
  const data = await obj.text();
  return new Response(data, {
    headers: { 'Content-Type': 'application/json' },
  });
}

// ============================================================
// 约束提取
// ============================================================

function extractConstraints(md: string): { section: string; rule: string }[] {
  const constraints: { section: string; rule: string }[] = [];
  const lines = md.split('\n');
  let currentSection = '';

  for (const line of lines) {
    if (line.startsWith('## ')) {
      currentSection = line.replace('## ', '').trim();
    }
    const match = line.match(/^[-*]\s+(.+)/);
    if (match && currentSection) {
      const rule = match[1].trim();
      if (rule.length > 5 && rule.length < 200) {
        constraints.push({ section: currentSection, rule });
      }
    }
  }

  return constraints;
}
