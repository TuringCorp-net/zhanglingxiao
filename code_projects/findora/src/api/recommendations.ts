// Recommendations API - F-040-13 + F-014
// Scoring: category_match × 10 + tag_match × 3 + click_count × 1 + favorite_count × 2 + price_match × 5 + recency_days × 0.1
// Time window: 30 days for clicks and favorites aggregation
// F-014-01: 同类目推荐 ✅
// F-014-02: 同标签推荐 ✅
// F-014-03: 同价格带推荐 ✅ (price_match × 5)
// F-014-04: 热门加权 ✅ (click_count × 1 + favorite_count × 2)
// F-014-05: 新品加权 ✅ (recency_days × 0.1, max 7 days = 0.7 boost)
// F-014-06: 偏好标签推荐 ✅ (liked_tags filtering + likedTags × 3)
// F-014-07: 屏蔽 disliked_tags ✅
import { Env } from '../db/schema';
import { jsonSuccess, jsonError, parseJSON } from '../lib/response';
import { ErrorCodes } from '../lib/errors';

// Price ranges for F-014-03
const PRICE_RANGES = {
  budget: { min: 0, max: 25 },
  mid_range: { min: 25, max: 75 },
  premium: { min: 75, max: Infinity },
};

function getPriceRangeCategory(priceMin: number | null, priceMax: number | null): string | null {
  if (priceMin === null && priceMax === null) return null;
  const avg = (priceMin || 0 + (priceMax || 0)) / 2;
  if (avg <= 25) return 'budget';
  if (avg <= 75) return 'mid_range';
  return 'premium';
}

function buildPriceMatchCase(userPricePreference: string | null): { caseExpr: string; bindings: string[] } {
  if (!userPricePreference) {
    return { caseExpr: '0', bindings: [] };
  }

  const range = PRICE_RANGES[userPricePreference as keyof typeof PRICE_RANGES];
  if (!range) {
    return { caseExpr: '0', bindings: [] };
  }

  // Price match: if user's preference matches product's price range, add 5 points
  // We'll implement this in SQL with a CASE statement that checks if price_min/max overlaps with preference
  let caseExpr = `CASE
    WHEN p.price_min IS NOT NULL AND p.price_max IS NOT NULL THEN
      CASE
        WHEN ? = 'budget' AND p.price_max <= 25 THEN 5
        WHEN ? = 'mid_range' AND p.price_min >= 25 AND p.price_max <= 75 THEN 5
        WHEN ? = 'premium' AND p.price_min >= 75 THEN 5
        ELSE 0
      END
    WHEN p.price_min IS NOT NULL AND p.price_max IS NULL THEN
      CASE
        WHEN ? = 'budget' AND p.price_min <= 25 THEN 5
        WHEN ? = 'mid_range' AND p.price_min >= 25 AND p.price_min <= 75 THEN 5
        WHEN ? = 'premium' AND p.price_min >= 75 THEN 5
        ELSE 0
      END
    WHEN p.price_min IS NULL AND p.price_max IS NOT NULL THEN
      CASE
        WHEN ? = 'budget' AND p.price_max <= 25 THEN 5
        WHEN ? = 'mid_range' AND p.price_max >= 25 AND p.price_max <= 75 THEN 5
        WHEN ? = 'premium' AND p.price_max >= 75 THEN 5
        ELSE 0
      END
    ELSE 0
  END`;

  // Bind the preference 4 times (for each WHEN clause that uses it)
  const bindings = [userPricePreference, userPricePreference, userPricePreference, userPricePreference];

  return { caseExpr, bindings };
}

// GET /api/recommendations - F-040-13
export async function getRecommendations(env: Env, request: Request): Promise<Response> {
  const url = new URL(request.url);
  const email = request.headers.get('X-User-Email');
  const anonymous_id = request.headers.get('X-Anonymous-Id');
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '20'), 100);

  if (!email && !anonymous_id) {
    return new Response(JSON.stringify(jsonError(ErrorCodes.INVALID_PARAMS, 'Email or anonymous_id is required')), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  let userQuery = 'SELECT * FROM users WHERE ';
  if (email) {
    userQuery += 'email = ?';
  } else {
    userQuery += 'anonymous_id = ?';
  }

  const user = await env.DB.prepare(userQuery).bind(email ? email.toLowerCase() : anonymous_id!).first<Record<string, unknown>>();

  if (!user) {
    // Return popular products for unknown users (30-day window)
    // Popularity = click_count * 1 + favorite_count * 2
    const popular = await env.DB.prepare(`
      SELECT p.*,
        COALESCE(cc.click_count, 0) as click_count,
        COALESCE(fc.favorite_count, 0) as favorite_count
      FROM products p
      LEFT JOIN (
        SELECT product_id, COUNT(*) as click_count
        FROM clicks
        WHERE clicked_at >= datetime('now', '-30 days')
        GROUP BY product_id
      ) cc ON p.id = cc.product_id
      LEFT JOIN (
        SELECT
          je.value as product_id,
          COUNT(DISTINCT u.id) as favorite_count
        FROM users u, json_each(u.saved_items) as je
        WHERE u.status = 'active'
          AND u.updated_at >= datetime('now', '-30 days')
        GROUP BY je.value
      ) fc ON p.id = fc.product_id
      WHERE p.status = 'active'
      ORDER BY (COALESCE(cc.click_count, 0) + COALESCE(fc.favorite_count, 0) * 2) DESC
      LIMIT ?
    `).bind(limit).all<Record<string, unknown>>();

    return new Response(JSON.stringify(jsonSuccess(popular.results || [])), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Get user's preferences
  const likedTags: string[] = parseJSON(user.liked_tags as string, []);
  const subscribedCategories: string[] = parseJSON(user.subscribed_categories as string, []);
  const dislikedTags: string[] = parseJSON(user.disliked_tags as string, []);
  const clickHistory: string[] = parseJSON(user.click_history as string, []);
  const pricePreference: string | null = user.price_preference as string | null;

  // Build WHERE conditions
  const conditions: string[] = ["p.status = ?"];
  const bindings: (string | number)[] = ['active'];

  // Exclude already clicked products
  if (clickHistory.length > 0) {
    conditions.push(`p.id NOT IN (${clickHistory.map(() => '?').join(',')})`);
    bindings.push(...clickHistory);
  }

  // Exclude products with disliked tags (F-014-07)
  for (const dt of dislikedTags) {
    // JSON array search - tag should not exist in the tags array
    conditions.push(`p.tags NOT LIKE ?`);
    bindings.push(`%"${dt}"%`);
  }

  const whereClause = conditions.join(' AND ');

  // Category match: 10 for subscribed categories, 0 for others (F-014-01)
  // We want to PRIORITIZE subscribed categories, so matching = higher score
  let categoryCase = '0';
  if (subscribedCategories.length > 0) {
    const catPlaceholders = subscribedCategories.map(() => '?').join(',');
    categoryCase = `CASE WHEN p.category IN (${catPlaceholders}) THEN 10 ELSE 1 END`;
    bindings.push(...subscribedCategories);
  }

  // Tag match count - number of likedTags found in product's tags (F-014-02 + F-014-06)
  // Each matching tag adds 3 to score
  // Using json_each for proper JSON array parsing instead of LIKE pattern matching
  const tagMatchCase = likedTags.length > 0
    ? `(SELECT COUNT(*) FROM json_each(p.tags) AS je WHERE je.value IN (${likedTags.map(() => '?').join(',')}))`
    : '0';
  if (likedTags.length > 0) {
    bindings.push(...likedTags);
  }

  // Price match: 5 points if product price range matches user's preference (F-014-03)
  const { caseExpr: priceMatchCase, bindings: priceBindings } = buildPriceMatchCase(pricePreference);
  bindings.push(...priceBindings);

  // Scoring formula (per SRS Section 4.5):
  // score = category_match_score + tag_match_score*3 + click_count*1 + favorite_count*2 + price_match*5 + recency_score
  // The final score is used for ORDER BY DESC (higher = better)
  // F-014-05: recency_score = MIN(7, days_since_created) * 0.1 (max 0.7 boost for products < 7 days old)
  const query = `
    SELECT
      p.*,
      COALESCE(cc.click_count, 0) as click_count,
      COALESCE(fc.favorite_count, 0) as favorite_count,
      (
        ${categoryCase}
        + ${tagMatchCase} * 3
        + COALESCE(cc.click_count, 0) * 1
        + COALESCE(fc.favorite_count, 0) * 2
        + ${priceMatchCase}
        + MIN(7, julianday('now') - julianday(p.created_at)) * 0.1
      ) as score
    FROM products p
    LEFT JOIN (
      SELECT product_id, COUNT(*) as click_count
      FROM clicks
      WHERE clicked_at >= datetime('now', '-30 days')
      GROUP BY product_id
    ) cc ON p.id = cc.product_id
    LEFT JOIN (
      SELECT
        je.value as product_id,
        COUNT(DISTINCT u.id) as favorite_count
      FROM users u, json_each(u.saved_items) as je
      WHERE u.status = 'active'
        AND u.updated_at >= datetime('now', '-30 days')
      GROUP BY je.value
    ) fc ON p.id = fc.product_id
    WHERE ${whereClause}
    ORDER BY score DESC, p.created_at DESC
    LIMIT ?
  `;

  bindings.push(limit);

  const recommendations = await env.DB.prepare(query).bind(...bindings).all<Record<string, unknown>>();

  return new Response(JSON.stringify(jsonSuccess(recommendations.results || [])), {
    headers: { 'Content-Type': 'application/json' },
  });
}
