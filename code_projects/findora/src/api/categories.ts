// Categories API - F-040-05
import { Env } from '../db/schema';
import { jsonSuccess } from '../lib/response';

// GET /api/categories - F-040-05
export async function getCategories(env: Env): Promise<Response> {
  // Build category tree from distinct categories in products
  const result = await env.DB.prepare(
    'SELECT DISTINCT category, subcategory FROM products WHERE status = ?'
  ).bind('active').all<{ category: string; subcategory: string | null }>();

  const categoryMap = new Map<string, Map<string, boolean>>();

  for (const row of result.results || []) {
    if (!categoryMap.has(row.category)) {
      categoryMap.set(row.category, new Map());
    }
    if (row.subcategory) {
      categoryMap.get(row.category)!.set(row.subcategory, true);
    }
  }

  const tree = Array.from(categoryMap.entries()).map(([category, subcategories]) => ({
    name: category,
    subcategories: Array.from(subcategories.keys()),
  }));

  return new Response(JSON.stringify(jsonSuccess(tree)), {
    headers: { 'Content-Type': 'application/json' },
  });
}
