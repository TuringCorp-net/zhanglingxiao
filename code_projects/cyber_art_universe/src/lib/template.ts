// 模板定义与渲染 — 统一的 SlotDefinition 系统
// 一套结构化定义，按需渲染出不同语言的 markdown 模板
// 生成的 markdown 遵循三标记分离格式，兼容现有 parseSlotTemplate 解析器

export type Lang = 'zh' | 'en';

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

/** 模块级模板定义（M1 世界观 / M2 大纲 / M4 伏笔策略总览） */
export interface TemplateDef {
  title: Record<Lang, string>;
  intro: Record<Lang, string>;          // 标题下方引导语（渲染为 > blockquote）
  sections: SectionDef[];
  outro: Record<Lang, string>;          // --- 之后自由编辑区的引导文字
}

// ============================================================
// 渲染函数
// ============================================================

/**
 * 将结构化模板渲染为三标记分离格式的 markdown。
 * @param tmpl 模板定义
 * @param lang 目标语言
 * @param userLevel 用户当前 level（只渲染 level <= userLevel 的槽位）
 * @param opts.prefills 预填内容，key 为 slot.id
 * @param opts.name 动态标题名（如人物卡名），追加到 title 后面
 */
export function renderTemplate(
  tmpl: TemplateDef,
  lang: Lang,
  userLevel: number,
  opts?: { prefills?: Record<string, string>; name?: string },
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

  for (const section of tmpl.sections) {
    lines.push('');

    // ## 标题的 level = section 内所有 slot 的 MIN level
    const sectionLevel = Math.min(...section.slots.map(s => s.level));
    lines.push(`<!-- L${sectionLevel} -->`);
    lines.push(`## ${section.heading[lang]}`);

    let prevLabel = '';
    for (const slot of section.slots) {
      if (slot.level > userLevel) continue;

      lines.push('');

      const label = slot.label[lang];
      if (label && label !== prevLabel) {
        lines.push(`<!-- L${slot.level} -->`);
        lines.push(`### ${label}`);
        prevLabel = label;
      }

      // 每个槽位前都放 level 标记（处理无 ### 的 section、或同 ### 下多个槽位 level 不同的情况）
      lines.push(`<!-- L${slot.level} -->`);
      lines.push(`<!-- hint:${slot.hint[lang]} -->`);
      lines.push('<!-- slot -->');
      const pre = opts?.prefills?.[slot.id];
      if (pre) lines.push(pre);
      lines.push('<!-- /slot -->');
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
 * 用于伏笔卡（M4），它们起始于 ### 级别，作为多 group 的一部分拼接。
 * @param name 卡片名（如伏笔名）
 * @param slots 槽位列表
 * @param lang 目标语言
 * @param userLevel 用户当前 level
 * @param prefills 预填内容
 */
export function renderCard(
  name: string,
  slots: SlotDef[],
  lang: Lang,
  userLevel: number,
  prefills?: Record<string, string>,
): string {
  const lines: string[] = [];

  lines.push(`### ${name}`);

  let prevLabel = '';
  for (const slot of slots) {
    if (slot.level > userLevel) continue;

    lines.push('');

    const label = slot.label[lang];
    if (label && label !== prevLabel) {
      lines.push(`<!-- L${slot.level} -->`);
      lines.push(`### ${label}`);
      prevLabel = label;
    }

    lines.push(`<!-- L${slot.level} -->`);
    lines.push(`<!-- hint:${slot.hint[lang]} -->`);
    lines.push('<!-- slot -->');
    const pre = prefills?.[slot.id];
    if (pre) lines.push(pre);
    lines.push('<!-- /slot -->');
  }

  lines.push('');
  lines.push('---');
  lines.push('');
  // outro 由调用方传入（如 "M3 自由编辑区"），渲染为纯文本标签
  const outro = lang === 'zh'
    ? '自由编辑区'
    : 'Free editing zone';
  lines.push(outro);

  return lines.join('\n') + '\n';
}
