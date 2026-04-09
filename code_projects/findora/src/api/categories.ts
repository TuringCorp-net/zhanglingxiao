// Categories API - F-040-05, F-002-03
import { Env } from '../db/schema';
import { jsonSuccess, jsonError } from '../lib/response';
import { ErrorCodes } from '../lib/errors';

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

// GET /api/categories/:category/subcategories - F-002-03
export async function getCategorySubcategories(env: Env, category: string): Promise<Response> {
  const result = await env.DB.prepare(`
    SELECT DISTINCT subcategory
    FROM products
    WHERE category = ? AND status = ? AND subcategory IS NOT NULL
    ORDER BY subcategory ASC
  `).bind(category, 'active').all<{ subcategory: string }>();

  const subcategories = (result.results || []).map(row => row.subcategory);

  if (subcategories.length === 0) {
    return new Response(JSON.stringify(jsonError(ErrorCodes.NOT_FOUND, 'Category not found or has no subcategories')), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify(jsonSuccess(subcategories)), {
    headers: { 'Content-Type': 'application/json' },
  });
}
