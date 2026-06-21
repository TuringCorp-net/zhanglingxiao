// 模板定义与渲染 — 统一的 SlotDefinition 系统
// 一套结构化定义，按需渲染出不同语言的 markdown 模板或 JSON schema

export type Lang = 'zh' | 'en';

// ============================================================
// 渲染选项
// ============================================================

/** renderTemplate / renderCard 的选项 */
export interface RenderOpts {
  /** 预填内容，key 为 slot.id */
  prefills?: Record<string, string>;
  /** 动态名称（如角色名），追加到 title 后面 */
  name?: string;
  /** 是否输出 clean Markdown（无标记）。默认 false（保留标记，用于空模板） */
  cleanOutput?: boolean;
}

// ============================================================
// 槽位定义
// ============================================================

/** 单个槽位定义：level + 多语言 label + hint */
export interface SlotDef {
  id: string;                           // 唯一标识，如 "power_system"
  level: 1 | 2;                         // 所属分级：L1 默认可见，L2 需解锁
  label: Record<Lang, string>;          // ### 标题（同一 section 内连续相同 label 只渲染一次）
  hint: Record<Lang, string>;           // 提示文字
}

/** 模板分区：一个 ## 标题 + 其下的槽位列表 */
export interface SectionDef {
  heading: Record<Lang, string>;        // ## 标题
  slots: SlotDef[];
}

/** 模块级模板定义（M1 世界观 / M2 大纲 / M3 人物卡 / M4 伏笔策略） */
export interface TemplateDef {
  title: Record<Lang, string>;
  intro: Record<Lang, string>;          // 标题下方引导语（渲染为 > blockquote）
  sections: SectionDef[];
  outro: Record<Lang, string>;          // --- 之后自由编辑区的引导文字
}

// ============================================================
// JSON 结构类型
// ============================================================

/** 给前端的 template JSON 结构 */
export interface TemplateJson {
  title: string;
  intro: string;
  sections: SectionJson[];
  outro: string;
  free_content?: string;
}

export interface SectionJson {
  heading: string;
  level: number;
  slots: SlotJson[];
}

export interface SlotJson {
  id: string;
  level: number;
  label: string;
  hint: string;
  /** 当前填充内容（来自 R2 .json 或空） */
  content: string;
}

/** LLM 输出的 JSON 解析结果 */
export interface TemplateJsonResult {
  slots: Record<string, string>;
}

/** R2 .json 存储格式 — slots + 槽位级乐观锁时间戳，free_content 存储于独立 .free.md 文件 */
export interface R2SlotData {
  slots: Record<string, string>;
  /** 每个 slot 的最后修改时间（毫秒时间戳），用于乐观并发冲突检测 */
  slot_timestamps: Record<string, number>;
}

// ============================================================
// 渲染函数
// ============================================================

/**
 * 将结构化模板渲染为 markdown。
 * - cleanOutput=false（默认，空模板）：输出带标记的 markdown
 * - cleanOutput=true + prefills：输出无标记的 clean markdown
 */
export function renderTemplate(
  tmpl: TemplateDef,
  lang: Lang,
  userLevel: number,
  opts?: RenderOpts,
): string {
  const lines: string[] = [];

  let title = tmpl.title[lang];
  if (opts?.name) {
    const sep = lang === 'zh' ? '：' : ': ';
    title += sep + opts.name;
  }
  lines.push(`# ${title}`);
  lines.push('');
  lines.push(`> ${tmpl.intro[lang]}`);

  const clean = !!(opts?.cleanOutput && opts?.prefills);

  for (const section of tmpl.sections) {
    lines.push('');

    const sectionLevel = Math.min(...section.slots.map(s => s.level));
    if (!clean) lines.push(`<!-- L${sectionLevel} -->`);
    lines.push(`## ${section.heading[lang]}`);

    let prevLabel = '';
    for (const slot of section.slots) {
      if (slot.level > userLevel) continue;

      lines.push('');

      const label = slot.label[lang];
      const pre = opts?.prefills?.[slot.id];

      if (clean) {
        // clean 模式：直接输出 ### 标题 + 内容，无标记
        if (label && label !== prevLabel) {
          lines.push(`### ${label}`);
          prevLabel = label;
        }
        if (pre) lines.push(pre);
      } else {
        // 标记模式：保留三标记
        if (label && label !== prevLabel) {
          lines.push(`<!-- L${slot.level} -->`);
          lines.push(`### ${label}`);
          prevLabel = label;
        }

        lines.push(`<!-- L${slot.level} -->`);
        lines.push(`<!-- hint:${slot.hint[lang]} -->`);
        lines.push('<!-- slot -->');
        if (pre) lines.push(pre);
        lines.push('<!-- /slot -->');
      }
    }
  }

  lines.push('');
  lines.push('---');
  lines.push('');
  if (tmpl.outro[lang]) lines.push(tmpl.outro[lang]);

  return lines.join('\n') + '\n';
}

/**
 * 将卡片式模板渲染为 markdown（多 group 拼接使用，无 #/## section）。
 * 用于伏笔卡（M4），起始于 ### 级别。
 */
export function renderCard(
  name: string,
  slots: SlotDef[],
  lang: Lang,
  userLevel: number,
  prefills?: Record<string, string>,
  cleanOutput?: boolean,
): string {
  const lines: string[] = [];
  const clean = !!(cleanOutput && prefills);

  lines.push(`### ${name}`);

  let prevLabel = '';
  for (const slot of slots) {
    if (slot.level > userLevel) continue;

    lines.push('');

    const label = slot.label[lang];
    const pre = prefills?.[slot.id];

    if (clean) {
      if (label && label !== prevLabel) {
        lines.push(`#### ${label}`);
        prevLabel = label;
      }
      if (pre) lines.push(pre);
    } else {
      if (label && label !== prevLabel) {
        lines.push(`<!-- L${slot.level} -->`);
        lines.push(`#### ${label}`);
        prevLabel = label;
      }

      lines.push(`<!-- L${slot.level} -->`);
      lines.push(`<!-- hint:${slot.hint[lang]} -->`);
      lines.push('<!-- slot -->');
      if (pre) lines.push(pre);
      lines.push('<!-- /slot -->');
    }
  }

  lines.push('');
  lines.push('---');
  lines.push('');
  const outro = lang === 'zh'
    ? '自由编辑区'
    : 'Free editing zone';
  lines.push(outro);

  return lines.join('\n') + '\n';
}

// ============================================================
// JSON schema 渲染（嵌入 LLM prompt 用）
// ============================================================

/**
 * 将模板定义渲染为 JSON schema 描述文本，嵌入 LLM prompt。
 * LLM 看到这个结构，知道要输出哪些 slot。
 */
export function renderTemplateAsJson(
  tmpl: TemplateDef,
  lang: Lang,
  userLevel: number,
): string {
  const sections = tmpl.sections.map(sec => {
    const visibleSlots = sec.slots
      .filter(s => s.level <= userLevel)
      .map(s => ({
        id: s.id,
        label: s.label[lang],
        hint: s.hint[lang],
        level: s.level,
      }));
    return {
      heading: sec.heading[lang],
      slots: visibleSlots,
    };
  }).filter(s => s.slots.length > 0);

  return JSON.stringify({
    title: tmpl.title[lang],
    intro: tmpl.intro[lang],
    sections,
    output_format: {
      description: lang === 'zh'
        ? '请输出一个 JSON 对象，slots 字段中每个 slot.id 映射到填充内容字符串（Markdown 格式）'
        : 'Output a JSON object. In the slots field, each slot.id maps to a content string in Markdown format.',
      example: (() => {
        const ex: Record<string, string> = {};
        sections.forEach(s => s.slots.forEach(sl => { ex[sl.id] = '（内容）'; }));
        return { slots: ex };
      })(),
    },
  }, null, 2);
}

/**
 * 将卡片槽位渲染为 JSON schema 描述文本。
 */
export function renderCardAsJson(
  name: string,
  slots: SlotDef[],
  lang: Lang,
  userLevel: number,
): string {
  const visibleSlots = slots
    .filter(s => s.level <= userLevel)
    .map(s => ({
      id: s.id,
      label: s.label[lang],
      hint: s.hint[lang],
      level: s.level,
    }));

  const ex: Record<string, string> = {};
  visibleSlots.forEach(s => { ex[s.id] = '（内容）'; });

  return JSON.stringify({
    name,
    slots: visibleSlots,
    output_format: {
      description: lang === 'zh'
        ? '请输出一个 JSON 对象，slots 字段中每个 slot.id 映射到填充内容字符串'
        : 'Output a JSON object. In the slots field, each slot.id maps to a content string.',
      example: { slots: ex },
    },
  }, null, 2);
}

// ============================================================
// JSON 提取与解析
// ============================================================

/**
 * 从 LLM 原始输出中提取并解析 JSON。
 * 自动处理 markdown fence、嵌入文本等边缘情况。
 * @returns 解析成功时返回 {slots}，失败时返回 null
 */
export function extractTemplateJson(raw: string): TemplateJsonResult | null {
  if (!raw) return null;

  // 1) 直接解析
  try {
    const r = JSON.parse(raw);
    if (r && typeof r === 'object' && r.slots && typeof r.slots === 'object') return r;
  } catch { /* continue */ }

  // 2) 提取 markdown fence 中的 JSON
  const fence = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) {
    try {
      const r = JSON.parse(fence[1].trim());
      if (r && r.slots) return r;
    } catch { /* continue */ }
  }

  // 3) 提取第一个 JSON 对象
  const obj = raw.match(/\{[\s\S]*\}/);
  if (obj) {
    try { return JSON.parse(obj[0]); } catch { /* continue */ }
  }

  return null;
}

// ============================================================
// Template JSON 组装（给前端 API 返回用）
// ============================================================

/**
 * 将 TemplateDef 与 R2 中的 slot 数据组装为前端的 template JSON 结构。
 * @param tmpl 模板定义
 * @param lang 目标语言
 * @param userLevel 当前用户 level
 * @param slotData 从 R2 .json 读取的 slot 数据（可选，空模板时为 null）
 * @param freeContent 自由编辑区内容（可选）
 */
export function buildTemplateJson(
  tmpl: TemplateDef,
  lang: Lang,
  userLevel: number,
  slotData?: R2SlotData | null,
): TemplateJson {
  const sections: SectionJson[] = tmpl.sections.map(sec => {
    const sectionLevel = Math.min(...sec.slots.map(s => s.level));
    const slots: SlotJson[] = sec.slots
      .filter(s => s.level <= userLevel)
      .map(s => ({
        id: s.id,
        level: s.level,
        label: s.label[lang],
        hint: s.hint[lang],
        content: slotData?.slots?.[s.id] || '',
      }));
    return {
      heading: sec.heading[lang],
      level: sectionLevel,
      slots,
    };
  }).filter(s => s.slots.length > 0);

  return {
    title: tmpl.title[lang],
    intro: tmpl.intro[lang],
    sections,
    outro: tmpl.outro[lang],
    free_content: '',
  };
}

/**
 * 将卡片槽位与数据组装为前端 JSON 结构。
 * 注意：free_content 来自独立 .free.md 文件，不由 slotData 传入。
 */
export function buildCardJson(
  name: string,
  slots: SlotDef[],
  lang: Lang,
  userLevel: number,
  slotData?: R2SlotData | null,
): { name: string; slots: SlotJson[]; free_content?: string } {
  const visibleSlots: SlotJson[] = slots
    .filter(s => s.level <= userLevel)
    .map(s => ({
      id: s.id,
      level: s.level,
      label: s.label[lang],
      hint: s.hint[lang],
      content: slotData?.slots?.[s.id] || '',
    }));

  return { name, slots: visibleSlots, free_content: '' };
}
