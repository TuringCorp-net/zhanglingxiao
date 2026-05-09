// R2 Markdown 读写层 — 作品/章节内容存储（多语言支持）
import { Env } from '../db/schema';
import { parseJSON } from './response';

// ============================================================
// 多语言支持
// ============================================================

/** 支持的语言。中文+英文为主力市场，后续可扩展 ja/ko/fr 等 */
export const SUPPORTED_LANGS = ['zh', 'en'] as const;
export type Lang = (typeof SUPPORTED_LANGS)[number];
export const DEFAULT_LANG: Lang = 'zh';

/** 默认双语生成：中文 + 英文 */
export const DEFAULT_BILINGUAL: Lang[] = ['zh', 'en'];

/** 语言显示名称 */
export const LANG_LABELS: Record<Lang, string> = {
  zh: '中文',
  en: 'English',
};

/** 从请求中提取 lang 参数，无效时返回默认值 */
export function extractLang(request: Request): Lang {
  const url = new URL(request.url);
  const lang = url.searchParams.get('lang');
  if (lang && SUPPORTED_LANGS.includes(lang as Lang)) {
    return lang as Lang;
  }
  return DEFAULT_LANG;
}

// 作品 Frontmatter 内容模型
export type WorkFrontmatter = {
  summary: string | null;
  tags: string[];
  cover_image: string | null;
};

const FRONTMATTER_PREFIX = '---\n';
const FRONTMATTER_SUFFIX = '\n---\n';

// ============================================================
// R2 路径构建（语言前缀：works/{id}/{lang}/...）
// ============================================================

export function workR2Key(workId: string, lang: Lang = DEFAULT_LANG): string {
  return `works/${workId}/${lang}/summary.md`;
}

export function sectionR2Key(workId: string, sectionId: string, lang: Lang = DEFAULT_LANG): string {
  return `works/${workId}/${lang}/chapters/${sectionId}.md`;
}

export function outlineR2Key(workId: string, lang: Lang = DEFAULT_LANG): string {
  return `works/${workId}/${lang}/outline.md`;
}

/** Story Forger 写入侧专用路径（不依赖 work_content.ts 的模块可直接使用） */
export function workContentPath(workId: string, lang: Lang, filename: string): string {
  return `works/${workId}/${lang}/${filename}`;
}

// ============================================================
// Frontmatter 编码/解码
// ============================================================

export function buildWorkFrontmatter(input: Partial<WorkFrontmatter>): WorkFrontmatter {
  return {
    summary: input.summary ?? null,
    tags: Array.isArray(input.tags) ? input.tags : [],
    cover_image: input.cover_image ?? null,
  };
}

export function encodeWorkMarkdown(content: WorkFrontmatter): string {
  const frontmatter = JSON.stringify(content, null, 2);
  return `${FRONTMATTER_PREFIX}${frontmatter}${FRONTMATTER_SUFFIX}`;
}

export function decodeMarkdown(markdown: string): WorkFrontmatter | null {
  if (!markdown.startsWith(FRONTMATTER_PREFIX)) {
    return null;
  }
  const end = markdown.indexOf(FRONTMATTER_SUFFIX, FRONTMATTER_PREFIX.length);
  if (end === -1) {
    return null;
  }
  const raw = markdown.slice(FRONTMATTER_PREFIX.length, end).trim();
  try {
    const parsed = JSON.parse(raw) as Partial<WorkFrontmatter>;
    return buildWorkFrontmatter(parsed);
  } catch {
    return null;
  }
}

// ============================================================
// 作品级 R2 读写
// ============================================================

export async function writeWorkContent(env: Env, workId: string, content: WorkFrontmatter): Promise<string> {
  const key = workR2Key(workId);
  await env.WORKS_BUCKET.put(key, encodeWorkMarkdown(content), {
    httpMetadata: { contentType: 'text/markdown; charset=utf-8' },
  });
  return key;
}

export async function readWorkMarkdown(env: Env, key: string): Promise<string | null> {
  const object = await env.WORKS_BUCKET.get(key);
  if (!object) return null;
  return object.text();
}

export async function readWorkContent(env: Env, workId: string): Promise<WorkFrontmatter | null> {
  const key = workR2Key(workId);
  const markdown = await readWorkMarkdown(env, key);
  if (!markdown) return null;
  return decodeMarkdown(markdown);
}

// ============================================================
// 章节级 R2 读写
// ============================================================

export async function writeSectionContent(
  env: Env, workId: string, sectionId: string, frontmatter: Record<string, unknown>, body: string, lang: Lang = DEFAULT_LANG
): Promise<string> {
  const key = sectionR2Key(workId, sectionId, lang);
  const fm = JSON.stringify(frontmatter, null, 2);
  const content = `${FRONTMATTER_PREFIX}${fm}${FRONTMATTER_SUFFIX}${body}`;
  await env.WORKS_BUCKET.put(key, content, {
    httpMetadata: { contentType: 'text/markdown; charset=utf-8' },
  });
  return key;
}

export async function readSectionMarkdown(env: Env, workId: string, sectionId: string, lang: Lang = DEFAULT_LANG): Promise<{
  frontmatter: Record<string, unknown> | null;
  body: string;
} | null> {
  const key = sectionR2Key(workId, sectionId, lang);
  const object = await env.WORKS_BUCKET.get(key);
  if (!object) return null;

  const text = await object.text();
  if (!text.startsWith(FRONTMATTER_PREFIX)) {
    return { frontmatter: null, body: text };
  }

  const end = text.indexOf(FRONTMATTER_SUFFIX, FRONTMATTER_PREFIX.length);
  if (end === -1) {
    return { frontmatter: null, body: text };
  }

  const raw = text.slice(FRONTMATTER_PREFIX.length, end).trim();
  const body = text.slice(end + FRONTMATTER_SUFFIX.length).trimStart();
  try {
    return { frontmatter: JSON.parse(raw), body };
  } catch {
    return { frontmatter: null, body: text };
  }
}

// ============================================================
// Outline R2 读写
// ============================================================

export async function writeOutline(env: Env, workId: string, markdown: string, lang: Lang = DEFAULT_LANG): Promise<string> {
  const key = outlineR2Key(workId, lang);
  await env.WORKS_BUCKET.put(key, markdown, {
    httpMetadata: { contentType: 'text/markdown; charset=utf-8' },
  });
  return key;
}

export async function readOutline(env: Env, workId: string, lang: Lang = DEFAULT_LANG): Promise<string | null> {
  const key = outlineR2Key(workId, lang);
  const object = await env.WORKS_BUCKET.get(key);
  if (!object) return null;
  return object.text();
}

// ============================================================
// 工具函数
// ============================================================

export function getAcceptsMarkdown(request: Request): boolean {
  const accept = request.headers.get('Accept') || '';
  return accept.includes('text/markdown');
}

export function resolveWorkR2Key(row: Record<string, unknown>): string {
  const key = typeof row.r2_object_key === 'string' ? row.r2_object_key.trim() : '';
  return key || workR2Key(String(row.id));
}
