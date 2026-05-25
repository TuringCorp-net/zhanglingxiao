// L1: 模板渲染引擎
// 轻量级 Mustache-like 模板引擎，支持 {{ var.path }} 变量替换 + 管道过滤器。
// 从 turingcorp-workflow/decider 移植并精简。

// ============================================================
// 过滤器
// ============================================================

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type FilterFn = (input: string, ...args: any[]) => string;

const filters: Record<string, FilterFn> = {
  trim: (s) => s.trim(),

  truncate: (s, n) => {
    const max = Number(n) || 0;
    return s.length > max ? s.slice(0, max) + '\n…[已截断]' : s;
  },

  codeblock: (s, title?) => {
    const head = title ? `${String(title)}\n` : '';
    return `\n\`\`\`\n${head}${s}\n\`\`\`\n`;
  },

  json: (s) => {
    try { return JSON.stringify(JSON.parse(s), null, 2); } catch { return s; }
  },

  /** 当值为空时显示默认值：{{ key | default("暂无") }} */
  default: (s, fallback?) => (s && s.trim()) ? s : (String(fallback || '')),
};

// ============================================================
// 路径解析
// ============================================================

function getByPath(obj: unknown, path: string): unknown {
  if (!path) return undefined;
  const parts = path.split('.').map(p => p.trim()).filter(Boolean);
  let cur: unknown = obj;
  for (const key of parts) {
    if (cur == null) return undefined;
    cur = (cur as Record<string, unknown>)[key];
  }
  return cur;
}

// ============================================================
// 参数解析
// ============================================================

function parseArgs(argStr: string): unknown[] {
  if (!argStr.trim()) return [];
  return argStr.split(',').map(x => x.trim()).map(x => {
    if (/^-?\d+(\.\d+)?$/.test(x)) return Number(x);
    const m = x.match(/^"(.*)"$/) || x.match(/^'(.*)'$/);
    if (m) return m[1];
    return x;
  });
}

// ============================================================
// 表达式求值
// ============================================================

function evalExpr(expr: string, vars: unknown, strict: boolean): string {
  const parts = expr.split('|').map(p => p.trim()).filter(Boolean);
  const path = parts[0];
  const raw = getByPath(vars, path);
  if (raw == null) {
    if (strict) {
      throw new Error(`[Template] 缺失变量: ${path}`);
    }
    return '';
  }
  let out = String(raw);
  for (let i = 1; i < parts.length; i++) {
    const seg = parts[i];
    const m = seg.match(/^([a-zA-Z_]\w*)\s*(?:\((.*)\))?$/);
    if (!m) throw new Error(`[Template] 非法过滤器: ${seg}`);
    const [, name, argStr = ''] = m;
    const fn = filters[name];
    if (!fn) throw new Error(`[Template] 未知过滤器: ${name}`);
    out = fn(out, ...parseArgs(argStr));
  }
  return out;
}

// ============================================================
// 对外接口
// ============================================================

export interface RenderOptions {
  /** 严格模式：缺失变量抛异常（默认 false，缺失返回空字符串） */
  strict?: boolean;
}

/**
 * 渲染模板字符串，替换所有 {{ var.path }} 和 {{{ var.path }}} 占位符。
 * 支持管道过滤器：{{ var.path | truncate(1000) | codeblock("标题") }}
 */
export function renderTemplate(
  template: string,
  vars: unknown,
  opts: RenderOptions = {},
): string {
  const strict = opts.strict ?? false;

  // 先处理 {{{ }}}（三重大括号），再处理 {{ }}（双重大括号）
  template = template.replace(/\{\{\{\s*([^}]+?)\s*\}\}\}/g, (_, expr) =>
    evalExpr(String(expr).trim(), vars, strict),
  );
  template = template.replace(/\{\{\s*([^}]+?)\s*\}\}/g, (_, expr) =>
    evalExpr(String(expr).trim(), vars, strict),
  );
  return template;
}
