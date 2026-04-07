// AI Recommendation Explanation - F-016
// Generates "Why we're recommending this" text for recommendations
//
// F-016-01: Template-based + AI extension recommendation reasons
// F-016-02: Product comparison explanations
// F-016-03: Scenario-based descriptions
// F-016-04: KV-based caching with TTL tiers
//
// Explanation priority templates (SRS Section 4.7):
//   1. "Because you liked [category] picks like [product]"
//   2. "Picked for your [category] feed"
//   3. "Matches your [budget/mid/premium] preference"
//   4. "Matches your interest in [tag]"
//   5. "Trending in [category] this week"
//   6. "People who viewed [product] also liked this" (fallback)
//
// AI expansion: 20-40 words, NO banned words, English only
// Banned: best/safest/guaranteed/proven/clinically/miracle/revolutionary/lifesaving
//
// Cache TTL (SRS Section 4.7.4):
//   - User × Product: 24h
//   - Product generic: 7d
//   - AI-generated: 72h

import { Env } from '../db/schema';
import { jsonSuccess, jsonError, parseJSON } from '../lib/response';
import { ErrorCodes } from '../lib/errors';

// ============================================================
// Explanation Templates
// ============================================================

export interface ExplanationContext {
  productId: string;
  productTitle: string;
  category: string;
  tags: string[];
  userId?: string;
  userLikedTags?: string[];
  userSubscribedCategories?: string[];
  userPricePreference?: string | null;
  userClickHistory?: string[];
  similarProductTitle?: string;
  trendingCategory?: string;
  isNewUser?: boolean;
}

export interface ExplanationResult {
  product_id: string;
  reason: string;
  reason_type: string;
  template_vars: Record<string, unknown>;
  ai_extended?: string;
  cached: boolean;
  cache_key?: string;
  generated_at: string;
}

// Template definitions by priority
interface Template {
  priority: number;
  condition: (ctx: ExplanationContext) => boolean;
  generate: (ctx: ExplanationContext) => { reason: string; type: string; vars: Record<string, unknown> };
  aiPrompt?: string;
}

const TEMPLATES: Template[] = [
  // Priority 1: User has liked similar category products
  {
    priority: 1,
    condition: (ctx) =>
      !!(ctx.userClickHistory && ctx.userClickHistory.length > 0 && ctx.category),
    generate: (ctx) => ({
      reason: `Because you liked ${ctx.category} picks like ${ctx.similarProductTitle || 'similar items'}`,
      type: 'similar_category_liked',
      vars: {
        category: ctx.category,
        similar_product: ctx.similarProductTitle || 'similar items',
      },
    }),
  },

  // Priority 2: User subscribed to this category
  {
    priority: 2,
    condition: (ctx) =>
      !!(ctx.userSubscribedCategories && ctx.userSubscribedCategories.includes(ctx.category)),
    generate: (ctx) => ({
      reason: `Picked for your ${ctx.category} feed`,
      type: 'subscribed_category',
      vars: { category: ctx.category },
    }),
  },

  // Priority 3: Matches price preference
  {
    priority: 3,
    condition: (ctx) => !!ctx.userPricePreference,
    generate: (ctx) => ({
      reason: `Matches your ${ctx.userPricePreference} preference`,
      type: 'price_match',
      vars: { price_preference: ctx.userPricePreference },
    }),
  },

  // Priority 4: Matches liked tags
  {
    priority: 4,
    condition: (ctx) =>
      !!(ctx.userLikedTags && ctx.userLikedTags.length > 0 && ctx.tags),
    generate: (ctx) => {
      const matchingTags = ctx.tags.filter(t => ctx.userLikedTags!.includes(t));
      const tagDisplay = matchingTags.length > 0
        ? matchingTags.slice(0, 2).join(' and ')
        : ctx.tags[0] || 'your interests';
      return {
        reason: `Matches your interest in ${tagDisplay}`,
        type: 'tag_match',
        vars: { matched_tags: matchingTags.slice(0, 3) },
      };
    },
  },

  // Priority 5: New user + trending
  {
    priority: 5,
    condition: (ctx) => !!(ctx.isNewUser && ctx.trendingCategory),
    generate: (ctx) => ({
      reason: `Trending in ${ctx.trendingCategory} this week`,
      type: 'trending',
      vars: { trending_category: ctx.trendingCategory },
    }),
  },

  // Priority 6: Fallback - people who viewed also liked
  {
    priority: 6,
    condition: () => true,
    generate: (ctx) => ({
      reason: `People who viewed ${ctx.similarProductTitle || ctx.productTitle} also liked this`,
      type: 'viewers_also_liked',
      vars: {
        reference_product: ctx.similarProductTitle || ctx.productTitle,
      },
    }),
  },
];

// ============================================================
// Explanation Generation
// ============================================================

/**
 * Generate explanation for a single product recommendation
 * Uses template matching by priority, no AI by default (AI is optional extension)
 */
export function generateExplanation(ctx: ExplanationContext): {
  reason: string;
  type: string;
  vars: Record<string, unknown>;
} {
  // Find first matching template by priority
  for (const template of TEMPLATES.sort((a, b) => a.priority - b.priority)) {
    if (template.condition(ctx)) {
      return template.generate(ctx);
    }
  }

  // Fallback (shouldn't reach here since last template always matches)
  return {
    reason: `Recommended for you based on your interests`,
    type: 'generic',
    vars: {},
  };
}

// ============================================================
// AI Extension (Optional Enhancement)
// ============================================================

const BANNED_WORDS = [
  'best', 'worst', 'safest', 'guaranteed', 'proven', 'clinically',
  'miracle', 'revolutionary', 'lifesaving', 'official', 'authentic',
  'dangerous',
];

/**
 * Validate AI explanation against banned words
 * Returns null if valid, or the first banned word found
 */
export function validateExplanation(explanation: string): string | null {
  const lower = explanation.toLowerCase();
  for (const word of BANNED_WORDS) {
    if (lower.includes(word)) {
      return word;
    }
  }
  return null;
}

/**
 * Generate AI-enhanced explanation (optional extension)
 * Uses Cloudflare AI Gateway or external AI API if configured
 *
 * Requirements:
 * - Length: 20-40 words
 * - Language: English
 * - No banned words
 * - Describe match points without exaggeration
 */
export async function generateAIExplanation(
  env: Env,
  ctx: ExplanationContext,
  baseReason: string
): Promise<string | null> {
  // Check if AI is configured
  const aiProvider = env.AI_PROVIDER;
  const aiApiKey = env.AI_API_KEY;

  if (!aiProvider || !aiApiKey) {
    // No AI configured, return null (use template only)
    return null;
  }

  // Build prompt from SRS F-016-01
  const prompt = `You are explaining why a product recommendation was made to a user.
Base reason: "${baseReason}"
Product: ${ctx.productTitle}
Category: ${ctx.category}
Tags: ${ctx.tags.join(', ') || 'none'}

Write a brief, honest explanation (20-40 words) of why this product was recommended.
Focus on matching points (category, price, features, style).
Do NOT use: ${BANNED_WORDS.join(', ')}
Do NOT make exaggerated claims. Be specific and helpful.
Language: English only.`;

  try {
    let response: Response;

    if (aiProvider === 'openai') {
      response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${aiApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-3.5-turbo',
          messages: [{ role: 'user', content: prompt }],
          max_tokens: 80,
          temperature: 0.7,
        }),
      });
    } else if (aiProvider === 'anthropic') {
      response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': aiApiKey,
          'Content-Type': 'application/json',
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-3-haiku',
          max_tokens: 80,
          messages: [{ role: 'user', content: prompt }],
        }),
      });
    } else {
      return null;
    }

    if (!response.ok) {
      console.error('AI API error:', response.status);
      return null;
    }

    const result = await response.json() as { choices?: { message?: { content?: string } }[] };
    const aiText = result?.choices?.[0]?.message?.content?.trim();

    if (!aiText) {
      return null;
    }

    // Validate against banned words
    const bannedWord = validateExplanation(aiText);
    if (bannedWord) {
      console.warn(`AI explanation contains banned word "${bannedWord}", discarding`);
      return null;
    }

    return aiText;
  } catch (err) {
    console.error('AI explanation generation failed:', err);
    return null;
  }
}

// ============================================================
// Caching Layer (D1-based KV substitute)
// ============================================================

/**
 * Cache explanations in a dedicated D1 table
 * TTL tiers:
 *   - user_product: 24h
 *   - product_generic: 7d
 *   - ai_generated: 72h
 */
async function ensureExplanationCacheTable(env: Env): Promise<void> {
  await env.DB.prepare(`
    CREATE TABLE IF NOT EXISTS explanation_cache (
      cache_key TEXT PRIMARY KEY,
      product_id TEXT NOT NULL,
      user_id TEXT,
      explanation_type TEXT NOT NULL,
      reason TEXT NOT NULL,
      ai_extended TEXT,
      generated_at TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      hit_count INTEGER DEFAULT 0
    )
  `).run();

  await env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_cache_product ON explanation_cache(product_id)`).run();
  await env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_cache_expires ON explanation_cache(expires_at)`).run();
}

type CacheType = 'user_product' | 'product_generic' | 'ai_generated';

function getTTLForType(type: CacheType): number {
  switch (type) {
    case 'user_product': return 24 * 60 * 60; // 24 hours
    case 'product_generic': return 7 * 24 * 60 * 60; // 7 days
    case 'ai_generated': return 72 * 60 * 60; // 72 hours
    default: return 24 * 60 * 60;
  }
}

function buildCacheKey(productId: string, userId?: string, isAI?: boolean): string {
  if (userId) {
    return isAI
      ? `explain:ai:${userId}:${productId}`
      : `explain:${userId}:${productId}`;
  }
  return isAI
    ? `explain:ai:generic:${productId}`
    : `explain:generic:${productId}`;
}

async function getCachedExplanation(
  env: Env,
  cacheKey: string
): Promise<{ reason: string; ai_extended?: string | null; cached: boolean } | null> {
  const row = await env.DB.prepare(`
    SELECT reason, ai_extended FROM explanation_cache
    WHERE cache_key = ? AND expires_at > datetime('now')
  `).bind(cacheKey).first<{ reason: string; ai_extended: string | null }>();

  if (row) {
    // Increment hit count
    await env.DB.prepare(`
      UPDATE explanation_cache SET hit_count = hit_count + 1 WHERE cache_key = ?
    `).bind(cacheKey).run();

    return { reason: row.reason, ai_extended: row.ai_extended, cached: true };
  }

  return null;
}

async function setCachedExplanation(
  env: Env,
  params: {
    cacheKey: string;
    productId: string;
    userId?: string;
    explanationType: string;
    reason: string;
    aiExtended?: string | null;
    cacheType: CacheType;
  }
): Promise<void> {
  const ttlSeconds = getTTLForType(params.cacheType);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + ttlSeconds * 1000);

  await env.DB.prepare(`
    INSERT OR REPLACE INTO explanation_cache
      (cache_key, product_id, user_id, explanation_type, reason, ai_extended, generated_at, expires_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    params.cacheKey,
    params.productId,
    params.userId || null,
    params.explanationType,
    params.reason,
    params.aiExtended || null,
    now.toISOString(),
    expiresAt.toISOString()
  ).run();
}

/**
 * Get explanation with caching
 * Checks cache first, generates if missing, stores result
 */
export async function getExplanation(
  env: Env,
  ctx: ExplanationContext,
  useAI: boolean = false
): Promise<ExplanationResult> {
  await ensureExplanationCacheTable(env);

  const isGeneric = !ctx.userId;
  const cacheType: CacheType = isGeneric
    ? (useAI ? 'ai_generated' : 'product_generic')
    : (useAI ? 'ai_generated' : 'user_product');

  const cacheKey = buildCacheKey(ctx.productId, ctx.userId, useAI);

  // Check cache
  const cached = await getCachedExplanation(env, cacheKey);
  if (cached) {
    return {
      product_id: ctx.productId,
      reason: cached.reason,
      reason_type: cached.ai_extended ? 'ai_extended' : 'template',
      template_vars: {},
      ai_extended: cached.ai_extended || undefined,
      cached: true,
      cache_key: cacheKey,
      generated_at: new Date().toISOString(),
    };
  }

  // Generate explanation
  const { reason, type, vars } = generateExplanation(ctx);

  // Optionally extend with AI
  let aiExtended: string | null = null;
  if (useAI) {
    aiExtended = await generateAIExplanation(env, ctx, reason);
  }

  // Cache result
  await setCachedExplanation(env, {
    cacheKey,
    productId: ctx.productId,
    userId: ctx.userId,
    explanationType: type,
    reason,
    aiExtended,
    cacheType,
  });

  return {
    product_id: ctx.productId,
    reason,
    reason_type: aiExtended ? 'ai_extended' : type,
    template_vars: vars,
    ai_extended: aiExtended || undefined,
    cached: false,
    cache_key: cacheKey,
    generated_at: new Date().toISOString(),
  };
}

// ============================================================
// Batch Explanation Generation
// ============================================================

/**
 * Generate explanations for multiple product recommendations
 */
export async function getExplanationsForProducts(
  env: Env,
  products: Array<{
    id: string;
    title: string;
    category: string;
    tags: string[];
  }>,
  userContext: {
    userId?: string;
    likedTags?: string[];
    subscribedCategories?: string[];
    pricePreference?: string | null;
    clickHistory?: string[];
  },
  useAI: boolean = false
): Promise<ExplanationResult[]> {
  // Get similar product titles from click history for template 1
  let similarProductTitle: string | undefined;
  if (userContext.clickHistory && userContext.clickHistory.length > 0) {
    const lastClickedId = userContext.clickHistory[userContext.clickHistory.length - 1];
    const lastClicked = await env.DB.prepare(
      'SELECT rewritten_title, original_title FROM products WHERE id = ?'
    ).bind(lastClickedId).first<{ rewritten_title: string | null; original_title: string }>();
    similarProductTitle = lastClicked?.rewritten_title || lastClicked?.original_title;
  }

  const explanations: ExplanationResult[] = [];

  for (const product of products) {
    const ctx: ExplanationContext = {
      productId: product.id,
      productTitle: product.title,
      category: product.category,
      tags: product.tags,
      userId: userContext.userId,
      userLikedTags: userContext.likedTags,
      userSubscribedCategories: userContext.subscribedCategories,
      userPricePreference: userContext.pricePreference,
      userClickHistory: userContext.clickHistory,
      similarProductTitle,
      isNewUser: (userContext.clickHistory?.length || 0) < 5,
    };

    const explanation = await getExplanation(env, ctx, useAI);
    explanations.push(explanation);
  }

  return explanations;
}

// ============================================================
// Product Comparison Explanations (F-016-02)
// ============================================================

export interface ProductComparison {
  product_id: string;
  product_title: string;
  compared_to_id: string;
  compared_to_title: string;
  comparison_type: 'same_category' | 'similar_price' | 'similar_tags';
  explanation: string;
}

/**
 * Generate comparison explanation between two products
 */
export function generateComparisonExplanation(
  product: { id: string; title: string; category: string; tags: string[]; price_min?: number | null; price_max?: number | null },
  comparedTo: { id: string; title: string; category: string; tags: string[]; price_min?: number | null; price_max?: number | null }
): ProductComparison {
  // Determine comparison type
  const sameCategory = product.category === comparedTo.category;
  const samePrice = product.price_min === comparedTo.price_min && product.price_max === comparedTo.price_max;
  const commonTags = product.tags.filter(t => comparedTo.tags.includes(t)).length;
  const similarTags = commonTags > 0;

  let comparisonType: ProductComparison['comparison_type'];
  let explanation: string;

  if (sameCategory && similarTags) {
    comparisonType = 'same_category';
    explanation = `Both "${product.title}" and "${comparedTo.title}" are in ${product.category}, offering similar benefits with ${commonTags} shared characteristic${commonTags > 1 ? 's' : ''}.`;
  } else if (samePrice) {
    comparisonType = 'similar_price';
    explanation = `"${product.title}" and "${comparedTo.title}" are priced similarly, giving you comparable value at the same price point.`;
  } else if (similarTags) {
    comparisonType = 'similar_tags';
    explanation = `"${product.title}" shares ${commonTags} feature${commonTags > 1 ? 's' : ''} with "${comparedTo.title}", making them both relevant to your interests.`;
  } else {
    comparisonType = 'same_category';
    explanation = `Both products are in the ${product.category} category, giving you options within the same space.`;
  }

  return {
    product_id: product.id,
    product_title: product.title,
    compared_to_id: comparedTo.id,
    compared_to_title: comparedTo.title,
    comparison_type: comparisonType,
    explanation,
  };
}

// ============================================================
// Scenario-Based Descriptions (F-016-03)
// ============================================================

export interface ScenarioDescription {
  product_id: string;
  scenarios: string[];
}

/**
 * Generate scenario-based descriptions for a product
 * Maps product attributes to common use cases
 */
export function generateScenarioDescriptions(
  product: {
    id: string;
    title: string;
    tags: string[];
    use_cases?: string[];
    target_audience?: string[];
  }
): ScenarioDescription {
  const scenarios: string[] = [];

  // Get tags to map to scenarios
  const tags = product.tags || [];

  // Map common tags to scenarios
  const tagScenarios: Record<string, string[]> = {
    kitchen: ['Perfect for small kitchens', 'Great for apartment living', 'Ideal for dorm rooms'],
    home: ['Upgrade your living space', 'Add comfort to any room', 'Perfect for home organization'],
    beauty: ['Daily beauty routine essential', 'Perfect for self-care moments', 'Great gift idea'],
    pet: ['Happy pet, happy home', 'Perfect for pet owners', 'Makes pet care easier'],
    fitness: ['Stay in shape at home', 'Perfect for daily workouts', 'Great for small spaces'],
    office: ['Boost your workspace', 'Perfect for remote work', 'Essential desk accessory'],
    travel: ['Perfect travel companion', 'Lightweight and portable', 'Great for trips'],
    garden: ['Green up your space', 'Perfect for outdoor living', 'Ideal for small gardens'],
  };

  for (const tag of tags) {
    const tagLower = tag.toLowerCase();
    for (const [key, scenariosForTag] of Object.entries(tagScenarios)) {
      if (tagLower.includes(key)) {
        // Pick one scenario per matching tag
        const randomScenario = scenariosForTag[Math.floor(Math.random() * scenariosForTag.length)];
        if (!scenarios.includes(randomScenario)) {
          scenarios.push(randomScenario);
        }
        break;
      }
    }
  }

  // Add custom use cases if available
  const useCases = product.use_cases || [];
  for (const useCase of useCases.slice(0, 2)) {
    const formatted = `Great for: ${useCase}`;
    if (!scenarios.includes(formatted)) {
      scenarios.push(formatted);
    }
  }

  // Add audience-based scenarios
  const audience = product.target_audience || [];
  for (const aud of audience.slice(0, 2)) {
    const formatted = `Perfect for ${aud}`;
    if (!scenarios.includes(formatted)) {
      scenarios.push(formatted);
    }
  }

  // If no scenarios found, add generic
  if (scenarios.length === 0) {
    scenarios.push('Versatile and practical', 'Great value for everyday use');
  }

  return {
    product_id: product.id,
    scenarios: scenarios.slice(0, 4), // Max 4 scenarios
  };
}

// ============================================================
// API Endpoints
// ============================================================

/**
 * GET /api/explain/:product_id
 * Get explanation for a single product recommendation
 */
export async function explainProduct(env: Env, request: Request, productId: string): Promise<Response> {
  const url = new URL(request.url);
  const email = request.headers.get('X-User-Email');
  const anonymous_id = request.headers.get('X-Anonymous-Id');
  const useAI = url.searchParams.get('ai') === 'true';

  // Get product info
  const product = await env.DB.prepare(
    'SELECT id, rewritten_title, original_title, category, tags FROM products WHERE id = ?'
  ).bind(productId).first<{
    id: string;
    rewritten_title: string | null;
    original_title: string;
    category: string;
    tags: string;
  }>();

  if (!product) {
    return new Response(JSON.stringify(jsonError(ErrorCodes.NOT_FOUND, 'Product not found')), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Get user context if available
  let userContext = {};
  if (email || anonymous_id) {
    let userQuery = 'SELECT id, liked_tags, subscribed_categories, price_preference, click_history FROM users WHERE ';
    if (email) {
      userQuery += 'email = ?';
    } else {
      userQuery += 'anonymous_id = ?';
    }

    const user = await env.DB.prepare(userQuery)
      .bind(email ? email.toLowerCase() : anonymous_id!).first<{
        id: string;
        liked_tags: string;
        subscribed_categories: string;
        price_preference: string | null;
        click_history: string;
      }>();

    if (user) {
      userContext = {
        userId: user.id,
        likedTags: parseJSON(user.liked_tags, []),
        subscribedCategories: parseJSON(user.subscribed_categories, []),
        pricePreference: user.price_preference,
        clickHistory: parseJSON(user.click_history, []),
      };
    }
  }

  const tags: string[] = parseJSON(product.tags, []);
  const ctx: ExplanationContext = {
    productId: product.id,
    productTitle: product.rewritten_title || product.original_title,
    category: product.category,
    tags,
    ...userContext,
    isNewUser: ((userContext as { clickHistory?: string[] }).clickHistory?.length || 0) < 5,
  };

  const explanation = await getExplanation(env, ctx, useAI);

  return new Response(JSON.stringify(jsonSuccess(explanation)), {
    headers: { 'Content-Type': 'application/json' },
  });
}

/**
 * POST /api/explain/batch
 * Generate explanations for multiple products at once
 */
export async function explainBatch(env: Env, request: Request): Promise<Response> {
  const body = await request.json() as {
    product_ids: string[];
    use_ai?: boolean;
  };

  if (!Array.isArray(body.product_ids) || body.product_ids.length === 0) {
    return new Response(JSON.stringify(jsonError(ErrorCodes.INVALID_PARAMS, 'product_ids is required')), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (body.product_ids.length > 50) {
    return new Response(JSON.stringify(jsonError(ErrorCodes.INVALID_PARAMS, 'Maximum 50 products per request')), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const email = request.headers.get('X-User-Email');
  const anonymous_id = request.headers.get('X-Anonymous-Id');

  // Get product details
  const placeholders = body.product_ids.map(() => '?').join(',');
  const products = await env.DB.prepare(
    `SELECT id, rewritten_title, original_title, category, tags, use_cases, target_audience
     FROM products WHERE id IN (${placeholders})`
  ).bind(...body.product_ids).all<Record<string, unknown>>();

  if (!products.results || products.results.length === 0) {
    return new Response(JSON.stringify(jsonError(ErrorCodes.NOT_FOUND, 'No products found')), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Get user context
  let userContext = {
    userId: undefined as string | undefined,
    likedTags: [] as string[],
    subscribedCategories: [] as string[],
    pricePreference: null as string | null,
    clickHistory: [] as string[],
  };

  if (email || anonymous_id) {
    let userQuery = 'SELECT id, liked_tags, subscribed_categories, price_preference, click_history FROM users WHERE ';
    if (email) {
      userQuery += 'email = ?';
    } else {
      userQuery += 'anonymous_id = ?';
    }

    const user = await env.DB.prepare(userQuery)
      .bind(email ? email.toLowerCase() : anonymous_id!).first<Record<string, unknown>>();

    if (user) {
      userContext = {
        userId: user.id as string,
        likedTags: parseJSON(user.liked_tags as string, []),
        subscribedCategories: parseJSON(user.subscribed_categories as string, []),
        pricePreference: user.price_preference as string | null,
        clickHistory: parseJSON(user.click_history as string, []),
      };
    }
  }

  // Generate explanations
  const explanations = await getExplanationsForProducts(
    env,
    products.results!.map(p => ({
      id: p.id as string,
      title: (p.rewritten_title as string) || (p.original_title as string),
      category: p.category as string,
      tags: parseJSON(p.tags as string, []),
    })),
    userContext,
    body.use_ai || false
  );

  return new Response(JSON.stringify(jsonSuccess(explanations)), {
    headers: { 'Content-Type': 'application/json' },
  });
}

/**
 * GET /api/explain/:product_id/comparison?compare_with=:id
 * Get comparison explanation between two products
 */
export async function explainComparison(env: Env, request: Request, productId: string): Promise<Response> {
  const url = new URL(request.url);
  const compareWithId = url.searchParams.get('compare_with');

  if (!compareWithId) {
    return new Response(JSON.stringify(jsonError(ErrorCodes.INVALID_PARAMS, 'compare_with parameter is required')), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const [product, comparedTo] = await Promise.all([
    env.DB.prepare(
      'SELECT id, rewritten_title, original_title, category, tags, price_min, price_max FROM products WHERE id = ?'
    ).bind(productId).first<Record<string, unknown>>(),
    env.DB.prepare(
      'SELECT id, rewritten_title, original_title, category, tags, price_min, price_max FROM products WHERE id = ?'
    ).bind(compareWithId).first<Record<string, unknown>>(),
  ]);

  if (!product || !comparedTo) {
    return new Response(JSON.stringify(jsonError(ErrorCodes.NOT_FOUND, 'One or both products not found')), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const comparison = generateComparisonExplanation(
    {
      id: product.id as string,
      title: (product.rewritten_title as string) || (product.original_title as string),
      category: product.category as string,
      tags: parseJSON(product.tags as string, []),
      price_min: product.price_min as number | null,
      price_max: product.price_max as number | null,
    },
    {
      id: comparedTo.id as string,
      title: (comparedTo.rewritten_title as string) || (comparedTo.original_title as string),
      category: comparedTo.category as string,
      tags: parseJSON(comparedTo.tags as string, []),
      price_min: comparedTo.price_min as number | null,
      price_max: comparedTo.price_max as number | null,
    }
  );

  return new Response(JSON.stringify(jsonSuccess(comparison)), {
    headers: { 'Content-Type': 'application/json' },
  });
}

/**
 * GET /api/explain/:product_id/scenarios
 * Get scenario-based descriptions for a product
 */
export async function explainScenarios(env: Env, request: Request, productId: string): Promise<Response> {
  const product = await env.DB.prepare(
    'SELECT id, rewritten_title, original_title, category, tags, use_cases, target_audience FROM products WHERE id = ?'
  ).bind(productId).first<Record<string, unknown>>();

  if (!product) {
    return new Response(JSON.stringify(jsonError(ErrorCodes.NOT_FOUND, 'Product not found')), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const scenarios = generateScenarioDescriptions({
    id: product.id as string,
    title: (product.rewritten_title as string) || (product.original_title as string),
    tags: parseJSON(product.tags as string, []),
    use_cases: parseJSON(product.use_cases as string || '[]', []),
    target_audience: parseJSON(product.target_audience as string || '[]', []),
  });

  return new Response(JSON.stringify(jsonSuccess(scenarios)), {
    headers: { 'Content-Type': 'application/json' },
  });
}

/**
 * GET /api/admin/explain/cache/stats
 * Get explanation cache statistics
 */
export async function getExplainCacheStats(env: Env): Promise<Response> {
  await ensureExplanationCacheTable(env);

  const stats = await env.DB.prepare(`
    SELECT
      explanation_type,
      COUNT(*) as count,
      SUM(hit_count) as total_hits,
      MIN(expires_at) as oldest_expiry,
      MAX(expires_at) as newest_expiry
    FROM explanation_cache
    GROUP BY explanation_type
  `).all<Record<string, unknown>>();

  const total = await env.DB.prepare('SELECT COUNT(*) as total, SUM(hit_count) as total_hits FROM explanation_cache')
    .first<{ total: number; total_hits: number }>();

  return new Response(JSON.stringify(jsonSuccess({
    total_cached: total?.total || 0,
    total_hits: total?.total_hits || 0,
    by_type: stats.results || [],
    cache_ttl_tiers: {
      user_product: '24 hours',
      product_generic: '7 days',
      ai_generated: '72 hours',
    },
  })), {
    headers: { 'Content-Type': 'application/json' },
  });
}
