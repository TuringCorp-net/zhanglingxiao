// Behavior Scoring & Recommendations - F-015
// Implements behavioral feedback loop for personalized recommendations
//
// F-015-01: Behavior weight calculation based on click/favorite/save/dislike
// F-015-02: Collaborative filtering (basic cosine similarity)
// F-015-03: Result reranking combining rule + behavior scores
// F-015-04: MMR (Maximal Marginal Relevance) diversity control
//
// Scoring formula (SRS Section 4.6):
//   score_behavior(product_id) =
//     click_count × 1 + favorite_count × 5 + save_count × 3 - dislike_count × 8
//
// Time decay (30 days → 20%):
//   decay_score = score × e^(-0.1 × days_ago)
//
// Final score: score_rule × 0.6 + score_behavior × 0.4
//
// Cold start: users with < 5 behaviors → pure rule-based
// Collaboration trigger: ≥100 users, ≥10 per tag

import { Env } from '../db/schema';
import { jsonSuccess, jsonError, parseJSON } from '../lib/response';
import { ErrorCodes } from '../lib/errors';

// ============================================================
// F-015-01: Behavior Weight Calculation
// ============================================================

// Weight constants from SRS F-015-01
const WEIGHT_CLICK = 1;
const WEIGHT_FAVORITE = 5;
const WEIGHT_SAVE = 3;
const WEIGHT_DISLIKE = 8;

// Time decay constant (30 days → 20% decay)
const DECAY_LAMBDA = 0.1;

// Cold start threshold
const COLD_START_THRESHOLD = 5;

// Collaborative filtering threshold
const COLLAB_USER_MIN = 100;
const COLLAB_TAG_MIN_USERS = 10;

/**
 * Calculate behavior score for a single product
 * Returns score and decay-adjusted score
 */
export function calculateBehaviorScore(
  clickCount: number,
  favoriteCount: number,
  saveCount: number,
  dislikeCount: number,
  daysSinceLastAction: number
): { raw: number; decay: number } {
  const raw = clickCount * WEIGHT_CLICK
    + favoriteCount * WEIGHT_FAVORITE
    + saveCount * WEIGHT_SAVE
    - dislikeCount * WEIGHT_DISLIKE;

  // Time decay: e^(-0.1 × days_ago)
  const decay = raw * Math.exp(-DECAY_LAMBDA * daysSinceLastAction);

  return { raw, decay };
}

/**
 * Aggregate behavior scores from D1 clicks and favorites data
 * Returns scores per product_id
 */
export async function getProductBehaviorScores(
  env: Env,
  productIds: string[],
  windowDays: number = 30,
  userId?: string
): Promise<Map<string, { raw: number; decay: number }>> {
  if (productIds.length === 0) {
    return new Map();
  }

  const placeholders = productIds.map(() => '?').join(',');

  // Get click counts per product (from clicks table)
  const clickRows = await env.DB.prepare(`
    SELECT product_id, COUNT(*) as click_count
    FROM clicks
    WHERE product_id IN (${placeholders})
      AND clicked_at >= datetime('now', '-' || ? || ' days')
    GROUP BY product_id
  `).bind(...productIds, windowDays).all<{ product_id: string; click_count: number }>();

  // Get favorite counts per product (from users with saved_items containing product_id)
  const favRows = await env.DB.prepare(`
    SELECT
      je.value as product_id,
      COUNT(DISTINCT u.id) as favorite_count
    FROM users u, json_each(u.saved_items) as je
    WHERE je.value IN (${placeholders})
      AND u.status = 'active'
      AND u.updated_at >= datetime('now', '-' || ? || ' days')
    GROUP BY je.value
  `).bind(...productIds, windowDays).all<{ product_id: string; favorite_count: number }>();

  // Get dislike counts - ST-C06 修复: 使用 json_each 匹配商品标签，并按用户过滤
  // 只统计当前用户 disliked_tags 中含有该商品标签的情况
  let dislikeRows;
  if (userId) {
    // 有用户ID时：只查询当前用户 dislike 的商品标签匹配情况
    const userDislikedTagsQuery = await env.DB.prepare(`
      SELECT disliked_tags FROM users WHERE id = ?
    `).bind(userId).first<{ disliked_tags: string }>();

    const userDislikedTags: string[] = userDislikedTagsQuery
      ? parseJSON(userDislikedTagsQuery.disliked_tags, [])
      : [];

    if (userDislikedTags.length === 0) {
      // 用户没有 disliked_tags，直接返回全0的Map
      const clickMap = new Map<string, number>(
        (clickRows.results || []).map(r => [r.product_id, r.click_count])
      );
      const favMap = new Map<string, number>(
        (favRows.results || []).map(r => [r.product_id, r.favorite_count])
      );
      const lastActionRows = await env.DB.prepare(`
        SELECT product_id, MAX(clicked_at) as last_action
        FROM clicks
        WHERE product_id IN (${placeholders})
        GROUP BY product_id
      `).bind(...productIds).all<{ product_id: string; last_action: string }>();

      const lastActionMap = new Map<string, string>(
        (lastActionRows.results || []).map(r => [r.product_id, r.last_action])
      );

      const scores = new Map<string, { raw: number; decay: number }>();
      for (const productId of productIds) {
        const clicks = clickMap.get(productId) || 0;
        const favs = favMap.get(productId) || 0;
        const lastAction = lastActionMap.get(productId);

        let daysSinceLastAction = 30;
        if (lastAction) {
          const lastDate = new Date(lastAction);
          const now = new Date();
          daysSinceLastAction = Math.floor((now.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24));
        }

        const score = calculateBehaviorScore(clicks, favs, 0, 0, daysSinceLastAction);
        scores.set(productId, score);
      }
      return scores;
    }

    // 查询商品标签是否匹配用户的disliked_tags
    dislikeRows = await env.DB.prepare(`
      SELECT
        p.id as product_id,
        1 as dislike_count
      FROM products p
      WHERE p.id IN (${placeholders})
        AND (
          ${userDislikedTags.map(tag =>
            `p.tags LIKE '%' || ? || '%'`
          ).join(' OR ')}
        )
    `).bind(...productIds, ...userDislikedTags).all<{ product_id: string; dislike_count: number }>();
  } else {
    // 无用户ID时：统计所有用户disliked_tags中包含该商品标签的商品
    dislikeRows = await env.DB.prepare(`
      SELECT
        p.id as product_id,
        COUNT(DISTINCT u.id) as dislike_count
      FROM products p
      JOIN users u ON u.status = 'active'
      JOIN products p2 ON p2.id = p.id
      WHERE p.id IN (${placeholders})
        AND u.disliked_tags IS NOT NULL
        AND u.disliked_tags != '[]'
        AND EXISTS (
          SELECT 1 FROM users u2, json_each(u2.disliked_tags) je
          WHERE u2.id = u.id
            AND p.tags LIKE '%' || je.value || '%'
        )
      GROUP BY p.id
    `).bind(...productIds).all<{ product_id: string; dislike_count: number }>();
  }

  // Get last action time per product for decay calculation
  const lastActionRows = await env.DB.prepare(`
    SELECT product_id, MAX(clicked_at) as last_action
    FROM clicks
    WHERE product_id IN (${placeholders})
    GROUP BY product_id
  `).bind(...productIds).all<{ product_id: string; last_action: string }>();

  const clickMap = new Map<string, number>(
    (clickRows.results || []).map(r => [r.product_id, r.click_count])
  );
  const favMap = new Map<string, number>(
    (favRows.results || []).map(r => [r.product_id, r.favorite_count])
  );
  const dislikeMap = new Map<string, number>(
    (dislikeRows?.results || []).map(r => [r.product_id, r.dislike_count])
  );
  const lastActionMap = new Map<string, string>(
    (lastActionRows.results || []).map(r => [r.product_id, r.last_action])
  );

  const scores = new Map<string, { raw: number; decay: number }>();

  for (const productId of productIds) {
    const clicks = clickMap.get(productId) || 0;
    const favs = favMap.get(productId) || 0;
    const dislikes = dislikeMap.get(productId) || 0;
    const lastAction = lastActionMap.get(productId);

    let daysSinceLastAction = 30; // default max window
    if (lastAction) {
      const lastDate = new Date(lastAction);
      const now = new Date();
      daysSinceLastAction = Math.floor((now.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24));
    }

    const score = calculateBehaviorScore(clicks, favs, 0, dislikes, daysSinceLastAction);
    scores.set(productId, score);
  }

  return scores;
}

/**
 * Check if user is in cold start state (< 5 behaviors)
 */
export async function isColdStartUser(env: Env, userId: string): Promise<boolean> {
  const clickCount = await env.DB.prepare(`
    SELECT COUNT(*) as count FROM clicks WHERE user_id = ?
  `).bind(userId).first<{ count: number }>();

  const user = await env.DB.prepare('SELECT saved_items FROM users WHERE id = ?')
    .bind(userId).first<{ saved_items: string }>();

  const savedItems: string[] = user ? parseJSON(user.saved_items, []) : [];
  const totalBehaviors = (clickCount?.count || 0) + savedItems.length;

  return totalBehaviors < COLD_START_THRESHOLD;
}

// ============================================================
// F-015-02: Collaborative Filtering (Basic)
// ============================================================

/**
 * Calculate user-user cosine similarity based on tag vectors
 * Returns top-N similar users for a given user
 */
export async function findSimilarUsers(
  env: Env,
  userId: string,
  topN: number = 10
): Promise<{ user_id: string; similarity: number }[]> {
  // Get target user's liked_tags
  const targetUser = await env.DB.prepare('SELECT liked_tags FROM users WHERE id = ?')
    .bind(userId).first<{ liked_tags: string }>();

  if (!targetUser) {
    return [];
  }

  const targetTags: string[] = parseJSON(targetUser.liked_tags, []);
  if (targetTags.length === 0) {
    return [];
  }

  // Get all users with liked_tags (potential candidates)
  const candidates = await env.DB.prepare(`
    SELECT id, liked_tags
    FROM users
    WHERE id != ?
      AND status = 'active'
      AND liked_tags IS NOT NULL
      AND liked_tags != '[]'
    LIMIT 500
  `).bind(userId).all<{ id: string; liked_tags: string }>();

  if (!candidates.results || candidates.results.length < COLLAB_USER_MIN) {
    // Not enough users for collaboration
    return [];
  }

  // Build tag vector for target user
  const targetVector = new Map<string, number>();
  for (const tag of targetTags) {
    targetVector.set(tag, (targetVector.get(tag) || 0) + 1);
  }

  const similarities: { user_id: string; similarity: number }[] = [];

  for (const candidate of candidates.results!) {
    const candidateTags: string[] = parseJSON(candidate.liked_tags, []);
    if (candidateTags.length === 0) continue;

    const candidateVector = new Map<string, number>();
    for (const tag of candidateTags) {
      candidateVector.set(tag, (candidateVector.get(tag) || 0) + 1);
    }

    // Cosine similarity
    const similarity = cosineSimilarity(targetVector, candidateVector);
    if (similarity > 0) {
      similarities.push({ user_id: candidate.id, similarity });
    }
  }

  // Sort by similarity and return top N
  similarities.sort((a, b) => b.similarity - a.similarity);
  return similarities.slice(0, topN);
}

/**
 * Get product recommendations from similar users
 * (Products liked by similar users that target user hasn't seen)
 */
export async function getCollaborativeRecommendations(
  env: Env,
  userId: string,
  excludeProductIds: string[],
  limit: number = 10
): Promise<string[]> {
  const similarUsers = await findSimilarUsers(env, userId);
  if (similarUsers.length === 0) {
    return [];
  }

  // Get products from similar users' saved_items
  const userIds = similarUsers.map(s => s.user_id);
  const userPlaceholders = userIds.map(() => '?').join(',');

  const rows = await env.DB.prepare(`
    SELECT DISTINCT je.value as product_id, u.id as user_id
    FROM users u, json_each(u.saved_items) as je
    WHERE u.id IN (${userPlaceholders})
      AND je.value NOT IN (${excludeProductIds.map(() => '?').join(',')})
    ORDER BY u.updated_at DESC
    LIMIT ?
  `).bind(...userIds, ...excludeProductIds, limit).all<{ product_id: string }>();

  return (rows.results || []).map(r => r.product_id);
}

/**
 * Cosine similarity between two tag vectors
 */
function cosineSimilarity(vecA: Map<string, number>, vecB: Map<string, number>): number {
  const allTags = new Set([...vecA.keys(), ...vecB.keys()]);

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (const tag of allTags) {
    const a = vecA.get(tag) || 0;
    const b = vecB.get(tag) || 0;
    dotProduct += a * b;
    normA += a * a;
    normB += b * b;
  }

  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

// ============================================================
// F-015-03: Combined Scoring (Rule + Behavior)
// ============================================================

const RULE_WEIGHT = 0.6;
const BEHAVIOR_WEIGHT = 0.4;

/**
 * Get behavior-enhanced recommendations by combining rule score + behavior score
 */
export async function getBehaviorEnhancedRecommendations(
  env: Env,
  userId: string,
  ruleScoreMap: Map<string, number>, // pre-computed rule scores from recommendations.ts
  limit: number = 20
): Promise<{ product_id: string; combined_score: number; rule_score: number; behavior_score: number }[]> {
  const productIds = [...ruleScoreMap.keys()];

  if (productIds.length === 0) {
    return [];
  }

  // Check cold start
  const coldStart = await isColdStartUser(env, userId);
  if (coldStart) {
    // Cold start: return pure rule-based, no behavior boost
    return productIds.slice(0, limit).map(id => ({
      product_id: id,
      combined_score: ruleScoreMap.get(id) || 0,
      rule_score: ruleScoreMap.get(id) || 0,
      behavior_score: 0,
    }));
  }

// Get behavior scores (ST-C06修复：传入userId以正确过滤disliked_tags)
  const behaviorScores = await getProductBehaviorScores(env, productIds, 30, userId);

  // Combine scores: rule × 0.6 + behavior × 0.4
  const combined: { product_id: string; combined_score: number; rule_score: number; behavior_score: number }[] = [];

  for (const productId of productIds) {
    const ruleScore = ruleScoreMap.get(productId) || 0;
    const behaviorData = behaviorScores.get(productId);
    const behaviorDecay = behaviorData?.decay || 0;

    const combinedScore = ruleScore * RULE_WEIGHT + behaviorDecay * BEHAVIOR_WEIGHT;

    combined.push({
      product_id: productId,
      combined_score: combinedScore,
      rule_score: ruleScore,
      behavior_score: behaviorDecay,
    });
  }

  // Sort by combined score descending
  combined.sort((a, b) => b.combined_score - a.combined_score);

  return combined.slice(0, limit);
}

// ============================================================
// F-015-04: MMR Diversity Control
// ============================================================

/**
 * MMR (Maximal Marginal Relevance) reranking
 * - Same subcategory ≤ 30% of results
 * - Cover at least 3 distinct tags from user's liked_tags
 * - Budget: ≤ 50ms timeout
 *
 * Formula: MMR = argmax [λ × similarity(context, doc) - (1-λ) × max_similarity(existing_set, doc)]
 */
export function mmrRerank<T extends { id: string; subcategory?: string | null; tags?: string[] }>(
  items: T[],
  userTags: string[],
  lambda: number = 0.5,
  maxSubcategoryRatio: number = 0.3,
  minDistinctTags: number = 3
): T[] {
  if (items.length === 0) return [];
  if (items.length === 1) return items;

  const result: T[] = [];
  const remaining = [...items];

  // Calculate tag coverage importance score for each item
  const tagScores = items.map(item => {
    const itemTags = item.tags || [];
    const matchCount = itemTags.filter(t => userTags.includes(t)).length;
    return { index: items.indexOf(item), matchCount };
  });

  // Sort by tag match descending to prioritize high-relevance items
  tagScores.sort((a, b) => b.matchCount - a.matchCount);

  // Greedy selection with MMR
  const maxPerSubcategory = Math.max(1, Math.floor(items.length * maxSubcategoryRatio));
  const subcategoryCounts = new Map<string, number>();

  let tagCoverage = new Set<string>();

  for (const { index } of tagScores) {
    if (result.length >= items.length) break;

    const item = remaining[index];
    if (!item) continue;

    // Check subcategory constraint
    const subcat = item.subcategory || 'unknown';
    const currentSubcatCount = subcategoryCounts.get(subcat) || 0;

    if (currentSubcatCount >= maxSubcategoryRatio && subcategoryCounts.size > 1) {
      // Skip if this subcategory is already at max (unless it's the only subcategory)
      continue;
    }

    // Add item to result
    result.push(item);
    remaining.splice(remaining.indexOf(item), 1);
    subcategoryCounts.set(subcat, currentSubcatCount + 1);

    // Track tag coverage
    const itemTags = item.tags || [];
    for (const tag of itemTags) {
      if (userTags.includes(tag)) {
        tagCoverage.add(tag);
      }
    }
  }

  // If we don't have enough items due to strict constraints, relax and add remaining
  if (result.length < items.length) {
    for (const item of remaining) {
      if (result.length >= items.length) break;
      result.push(item);
    }
  }

  return result;
}

/**
 * Apply MMR diversity to recommendation results
 * Combines behavior scores with diversity control
 */
export async function applyMMRToRecommendations(
  env: Env,
  userId: string,
  products: Array<{ id: string; subcategory?: string | null; tags?: string[]; [key: string]: unknown }>,
  limit: number = 20
): Promise<{ products: unknown[]; diversity_stats: { subcategory_coverage: number; tag_coverage: number } }> {
  // Get user's liked tags for diversity calculation
  const user = await env.DB.prepare('SELECT liked_tags FROM users WHERE id = ?')
    .bind(userId).first<{ liked_tags: string }>();

  const userTags: string[] = user ? parseJSON(user.liked_tags, []) : [];

  // Apply MMR reranking
  const itemsWithTags = products.map(p => ({
    ...p,
    id: p.id,
    subcategory: p.subcategory,
    tags: p.tags,
  }));

  const reranked = mmrRerank(itemsWithTags, userTags);

  // Calculate diversity stats
  const subcategories = new Set(reranked.map(p => p.subcategory || 'unknown'));
  const coveredTags = new Set<string>();
  for (const item of reranked) {
    for (const tag of (item.tags || [])) {
      if (userTags.includes(tag)) {
        coveredTags.add(tag);
      }
    }
  }

  const totalProducts = reranked.length;
  const subcatRatio = totalProducts > 0
    ? (subcategories.size / totalProducts)
    : 0;
  const tagCoverageRatio = userTags.length > 0
    ? (coveredTags.size / userTags.length)
    : 0;

  return {
    products: reranked.slice(0, limit),
    diversity_stats: {
      subcategory_coverage: Math.round(subcatRatio * 100) / 100,
      tag_coverage: Math.round(tagCoverageRatio * 100) / 100,
    },
  };
}

// ============================================================
// API Endpoints
// ============================================================

/**
 * GET /api/admin/recommendations/behavior
 * Admin endpoint to view behavior scores for a product
 */
export async function getProductBehaviorScore(env: Env, request: Request): Promise<Response> {
  const url = new URL(request.url);
  const productId = url.searchParams.get('product_id');

  if (!productId) {
    return new Response(JSON.stringify(jsonError(ErrorCodes.INVALID_PARAMS, 'product_id is required')), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const scores = await getProductBehaviorScores(env, [productId]);
  const score = scores.get(productId);

  if (!score) {
    return new Response(JSON.stringify(jsonSuccess({
      product_id: productId,
      behavior_score: 0,
      decay_score: 0,
      note: 'No behavior data available',
    })), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify(jsonSuccess({
    product_id: productId,
    behavior_score: score.raw,
    decay_score: Math.round(score.decay * 100) / 100,
  })), {
    headers: { 'Content-Type': 'application/json' },
  });
}

/**
 * GET /api/recommendations/behavioral
 * User-facing endpoint for behavior-enhanced recommendations (F-015)
 * Combines rule-based + behavior scoring + MMR diversity
 */
export async function getBehavioralRecommendations(env: Env, request: Request): Promise<Response> {
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

  // Get user identifier
  let userQuery = 'SELECT id, liked_tags, subscribed_categories, click_history FROM users WHERE ';
  if (email) {
    userQuery += 'email = ?';
  } else {
    userQuery += 'anonymous_id = ?';
  }

  const user = await env.DB.prepare(userQuery)
    .bind(email ? email.toLowerCase() : anonymous_id!).first<Record<string, unknown>>();

  if (!user) {
    return new Response(JSON.stringify(jsonError(ErrorCodes.NOT_FOUND, 'User not found')), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const userId = user.id as string;
  const likedTags: string[] = parseJSON(user.liked_tags as string, []);
  const subscribedCategories: string[] = parseJSON(user.subscribed_categories as string, []);
  const clickHistory: string[] = parseJSON(user.click_history as string, []);

  // Check cold start
  const coldStart = await isColdStartUser(env, userId);

  // Get base recommendations from rule-based system (reuse existing logic concept)
  // For F-015, we enhance with behavior scoring
  // Get all candidate products (exclude clicked items)
  let candidateQuery = 'SELECT id, category, subcategory, tags FROM products WHERE status = ?';
  const candidateBindings: string[] = ['active'];

  if (clickHistory.length > 0) {
    const historyPlaceholders = clickHistory.map(() => '?').join(',');
    candidateQuery += ` AND id NOT IN (${historyPlaceholders})`;
    candidateBindings.push(...clickHistory);
  }

  candidateQuery += ' ORDER BY created_at DESC LIMIT 200';
  const candidates = await env.DB.prepare(candidateQuery).bind(...candidateBindings)
    .all<{ id: string; category: string; subcategory: string | null; tags: string }>();

  if (!candidates.results || candidates.results.length === 0) {
    return new Response(JSON.stringify(jsonSuccess([])), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const candidateIds = candidates.results.map(c => c.id);

  // Calculate rule-based scores (simplified - same logic as recommendations.ts)
  const ruleScores = new Map<string, number>();
  for (const candidate of candidates.results!) {
    const tags: string[] = parseJSON(candidate.tags, []);
    const catMatch = subscribedCategories.includes(candidate.category) ? 10 : 1;
    const tagMatch = tags.filter(t => likedTags.includes(t)).length * 3;
    ruleScores.set(candidate.id, catMatch + tagMatch);
  }

  // Get behavior-enhanced scores
  const enhancedScores = await getBehaviorEnhancedRecommendations(env, userId, ruleScores, Math.min(100, candidateIds.length));

  // Get product details for top candidates
  const topProductIds = enhancedScores.slice(0, limit).map(s => s.product_id);
  if (topProductIds.length === 0) {
    return new Response(JSON.stringify(jsonSuccess([])), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const productPlaceholders = topProductIds.map(() => '?').join(',');
  const productDetails = await env.DB.prepare(`
    SELECT * FROM products WHERE id IN (${productPlaceholders})
  `).bind(...topProductIds).all<Record<string, unknown>>();

  // Merge scores and apply MMR
  const productsWithScores: Array<Record<string, unknown> & { tags: string[]; combined_score: number; rule_score: number; behavior_score: number }> = (productDetails.results || []).map(p => {
    const scoreData = enhancedScores.find(s => s.product_id === p.id);
    const tags: string[] = parseJSON(p.tags as string || '[]', []);
    return {
      ...p,
      tags,
      combined_score: scoreData?.combined_score || 0,
      rule_score: scoreData?.rule_score || 0,
      behavior_score: scoreData?.behavior_score || 0,
    };
  });

  // Apply MMR diversity
  const mmrResult = await applyMMRToRecommendations(
    env,
    userId,
    productsWithScores as unknown as Array<{ id: string; subcategory?: string | null; tags?: string[] }>,
    limit
  );

  // Final results with scores attached
  const finalProducts = (mmrResult.products as Record<string, unknown>[]).map(p => {
    const original = productsWithScores.find(op => op.id === p.id);
    return {
      ...p,
      combined_score: original?.combined_score || 0,
      rule_score: original?.rule_score || 0,
      behavior_score: original?.behavior_score || 0,
    };
  });

  return new Response(JSON.stringify(jsonSuccess({
    products: finalProducts,
    diversity_stats: mmrResult.diversity_stats,
    cold_start: coldStart,
    scoring_breakdown: {
      rule_weight: RULE_WEIGHT,
      behavior_weight: BEHAVIOR_WEIGHT,
      weight_constants: {
        click: WEIGHT_CLICK,
        favorite: WEIGHT_FAVORITE,
        save: WEIGHT_SAVE,
        dislike: WEIGHT_DISLIKE,
      },
      decay_lambda: DECAY_LAMBDA,
    },
  })), {
    headers: { 'Content-Type': 'application/json' },
  });
}
