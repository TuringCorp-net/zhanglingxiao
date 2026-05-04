// R2 Markdown 读写层 — 作品/章节内容存储
import { Env } from '../db/schema';
import { parseJSON } from './response';

// 作品 Frontmatter 内容模型
export type WorkFrontmatter = {
  summary: string | null;
  tags: string[];
  cover_image: string | null;
};

const FRONTMATTER_PREFIX = '---\n';
const FRONTMATTER_SUFFIX = '\n---\n';

// ============================================================
// R2 路径构建
// ============================================================

export function workR2Key(workId: string): string {
  return `works/${workId}/summary.md`;
}

export function sectionR2Key(workId: string, sectionId: string): string {
  return `works/${workId}/chapters/${sectionId}.md`;
}

export function outlineR2Key(workId: string): string {
  return `works/${workId}/outline.md`;
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
  env: Env, workId: string, sectionId: string, frontmatter: Record<string, unknown>, body: string
): Promise<string> {
  const key = sectionR2Key(workId, sectionId);
  const fm = JSON.stringify(frontmatter, null, 2);
  const content = `${FRONTMATTER_PREFIX}${fm}${FRONTMATTER_SUFFIX}${body}`;
  await env.WORKS_BUCKET.put(key, content, {
    httpMetadata: { contentType: 'text/markdown; charset=utf-8' },
  });
  return key;
}

export async function readSectionMarkdown(env: Env, workId: string, sectionId: string): Promise<{
  frontmatter: Record<string, unknown> | null;
  body: string;
} | null> {
  const key = sectionR2Key(workId, sectionId);
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

export async function writeOutline(env: Env, workId: string, markdown: string): Promise<string> {
  const key = outlineR2Key(workId);
  await env.WORKS_BUCKET.put(key, markdown, {
    httpMetadata: { contentType: 'text/markdown; charset=utf-8' },
  });
  return key;
}

export async function readOutline(env: Env, workId: string): Promise<string | null> {
  const key = outlineR2Key(workId);
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
