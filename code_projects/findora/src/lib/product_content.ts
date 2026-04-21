import { Env } from '../db/schema';
import { parseJSON } from './response';

type ProductContent = {
  summary: string | null;
  images: string[];
  pros: string[];
  cons: string[];
  use_cases: string[];
  target_audience: string[];
  shipping_notes: string | null;
};

const FRONTMATTER_PREFIX = '---\n';
const FRONTMATTER_SUFFIX = '\n---\n';

export function resolveProductR2Key(row: Record<string, unknown>): string {
  const key = typeof row.r2_object_key === 'string' ? row.r2_object_key.trim() : '';
  return key || `products/${String(row.id)}.md`;
}

export function buildProductContent(input: Partial<ProductContent>): ProductContent {
  return {
    summary: input.summary ?? null,
    images: Array.isArray(input.images) ? input.images : [],
    pros: Array.isArray(input.pros) ? input.pros : [],
    cons: Array.isArray(input.cons) ? input.cons : [],
    use_cases: Array.isArray(input.use_cases) ? input.use_cases : [],
    target_audience: Array.isArray(input.target_audience) ? input.target_audience : [],
    shipping_notes: input.shipping_notes ?? null,
  };
}

export function parseProductContentFromRow(row: Record<string, unknown>): ProductContent {
  return buildProductContent({
    summary: typeof row.summary === 'string' ? row.summary : null,
    images: parseJSON<string[]>(String(row.images || '[]'), []),
    pros: parseJSON<string[]>(String(row.pros || '[]'), []),
    cons: parseJSON<string[]>(String(row.cons || '[]'), []),
    use_cases: parseJSON<string[]>(String(row.use_cases || '[]'), []),
    target_audience: parseJSON<string[]>(String(row.target_audience || '[]'), []),
    shipping_notes: typeof row.shipping_notes === 'string' ? row.shipping_notes : null,
  });
}

export function encodeProductMarkdown(content: ProductContent): string {
  const frontmatter = JSON.stringify(content, null, 2);
  return `${FRONTMATTER_PREFIX}${frontmatter}${FRONTMATTER_SUFFIX}`;
}

function decodeMarkdown(markdown: string): ProductContent | null {
  if (!markdown.startsWith(FRONTMATTER_PREFIX)) {
    return null;
  }
  const end = markdown.indexOf(FRONTMATTER_SUFFIX, FRONTMATTER_PREFIX.length);
  if (end === -1) {
    return null;
  }
  const raw = markdown.slice(FRONTMATTER_PREFIX.length, end).trim();
  try {
    const parsed = JSON.parse(raw) as Partial<ProductContent>;
    return buildProductContent(parsed);
  } catch {
    return null;
  }
}

export async function writeProductContent(env: Env, key: string, content: ProductContent): Promise<void> {
  await env.PRODUCTS_BUCKET.put(key, encodeProductMarkdown(content), {
    httpMetadata: { contentType: 'text/markdown; charset=utf-8' },
  });
}

export async function readProductMarkdown(env: Env, key: string): Promise<string | null> {
  const object = await env.PRODUCTS_BUCKET.get(key);
  if (!object) {
    return null;
  }
  return object.text();
}

export async function readProductContent(env: Env, key: string): Promise<ProductContent | null> {
  const markdown = await readProductMarkdown(env, key);
  if (!markdown) {
    return null;
  }
  return decodeMarkdown(markdown);
}

export function getAcceptsMarkdown(request: Request): boolean {
  const accept = request.headers.get('Accept') || '';
  return accept.includes('text/markdown');
}

export function toClientProduct(
  row: Record<string, unknown>,
  content: ProductContent
): Record<string, unknown> {
  const title = typeof row.title === 'string' && row.title.trim()
    ? row.title.trim()
    : String(row.original_title || '');
  const coverImage = typeof row.cover_image === 'string' ? row.cover_image : null;
  const images = content.images.length > 0 ? content.images : (coverImage ? [coverImage] : []);
  return {
    ...row,
    title,
    tags: parseJSON<string[]>(String(row.tags || '[]'), []),
    cover_image: coverImage || images[0] || null,
    images,
    summary: content.summary,
    pros: content.pros,
    cons: content.cons,
    use_cases: content.use_cases,
    target_audience: content.target_audience,
    shipping_notes: content.shipping_notes,
    r2_object_key: resolveProductR2Key(row),
  };
}
