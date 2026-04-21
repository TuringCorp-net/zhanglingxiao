// AI Content Generation - F-020
// AI-powered content generation assistance for Findora
//
// F-020-01: Product selection assistance (tagging, categorization)
// F-020-02: Content generation (titles, summaries, descriptions, list drafts)
// F-020-03: Social media copy (TikTok/IG/X)
// F-020-04: Recommendation explanations (reviewed before use)
// F-020-05: Operational analytics insights
// F-020-06: Product information completion
//
// AI generates draft content that requires human review before publishing.
// All AI content is marked with status 'draft' and needs approval workflow.

import { Env } from '../db/schema';
import { jsonSuccess, jsonError, parseJSON } from '../lib/response';
import { ErrorCodes } from '../lib/errors';

// ============================================================
// Banned Words (F-021-05)
// ============================================================

// ST-P4修复：统一禁用词表为16项，与ai_review.ts保持一致
export const BANNED_WORDS = [
  'best', 'worst', 'safest', 'guaranteed', 'proven', 'clinically',
  'miracle', 'revolutionary', 'lifesaving', 'official', 'authentic',
  'dangerous', 'amazing', 'incredible', 'unbelievable', 'game-changing',
] as const;

export interface BannedWordResult {
  valid: boolean;
  banned_word?: string;
}

/**
 * Validate content against banned words
 * Returns validation result with first banned word found (if any)
 */
export function validateAgainstBannedWords(content: string): BannedWordResult {
  const lower = content.toLowerCase();
  for (const word of BANNED_WORDS) {
    if (lower.includes(word)) {
      return { valid: false, banned_word: word };
    }
  }
  return { valid: true };
}

// ============================================================
// AI Provider Integration
// ============================================================

interface AIConfig {
  provider: 'openai' | 'anthropic';
  apiKey: string;
}

function getAIConfig(env: Env): AIConfig | null {
  const provider = env.AI_PROVIDER;
  const apiKey = env.AI_API_KEY;

  if (!provider || !apiKey) {
    return null;
  }

  if (provider !== 'openai' && provider !== 'anthropic') {
    return null;
  }

  return { provider, apiKey };
}

async function callOpenAI(apiKey: string, prompt: string, maxTokens: number = 200): Promise<string | null> {
  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: maxTokens,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      console.error('OpenAI API error:', response.status);
      return null;
    }

    const result = await response.json() as { choices?: { message?: { content?: string } }[] };
    return result?.choices?.[0]?.message?.content?.trim() || null;
  } catch (err) {
    console.error('OpenAI call failed:', err);
    return null;
  }
}

async function callAnthropic(apiKey: string, prompt: string, maxTokens: number = 200): Promise<string | null> {
  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'Content-Type': 'application/json',
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-3-haiku',
        max_tokens: maxTokens,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!response.ok) {
      console.error('Anthropic API error:', response.status);
      return null;
    }

    const result = await response.json() as { content?: { text?: string }[] };
    return result?.content?.[0]?.text?.trim() || null;
  } catch (err) {
    console.error('Anthropic call failed:', err);
    return null;
  }
}

async function generateWithAI(env: Env, prompt: string, maxTokens: number = 200): Promise<string | null> {
  const config = getAIConfig(env);
  if (!config) {
    return null;
  }

  if (config.provider === 'openai') {
    return callOpenAI(config.apiKey, prompt, maxTokens);
  } else {
    return callAnthropic(config.apiKey, prompt, maxTokens);
  }
}

// ============================================================
// AI Content Generation Functions
// ============================================================

/**
 * F-020-01: Product Selection Assistance
 * AI assists in initial screening, tagging, and categorization of candidate products
 * Output is for human review, not direct publishing
 */
export interface SelectionAssistanceInput {
  product_id?: string;
  source_url?: string;
  original_title?: string;
  original_description?: string;
  price_range?: string;
  category_hint?: string;
}

export interface SelectionAssistanceResult {
  suggested_category?: string;
  suggested_tags?: string[];
  confidence_score?: number;
  reasoning?: string;
  ai_generated: boolean;
  draft_content: {
    suggested_category?: string;
    suggested_tags?: string[];
  };
}

/**
 * Generate product selection assistance (F-020-01)
 */
export async function generateSelectionAssistance(
  env: Env,
  input: SelectionAssistanceInput
): Promise<SelectionAssistanceResult> {
  const result: SelectionAssistanceResult = {
    ai_generated: false,
    draft_content: {},
  };

  const config = getAIConfig(env);
  if (!config) {
    // No AI configured, return empty draft
    return result;
  }

  const prompt = `You are assisting in product selection for a curated product recommendation website.
Analyze this product candidate and suggest:
1. Best category (from: kitchen, home, beauty, pet, fitness, office, travel, garden, electronics, kids)
2. Relevant tags (3-5 tags from: organizing, cleaning, decorating, gifting, cute, minimalist, luxury-looking, weird, budget, impulse-buy, premium, for-moms, for-students, for-pet-owners)
3. Confidence score (0-100) for these suggestions

Product info:
- Title: ${input.original_title || 'N/A'}
- Description: ${input.original_description || 'N/A'}
- Price range: ${input.price_range || 'N/A'}
- Category hint: ${input.category_hint || 'None'}

Respond in JSON format:
{
  "suggested_category": "category-name",
  "suggested_tags": ["tag1", "tag2", "tag3"],
  "confidence_score": 85,
  "reasoning": "Brief explanation"
}

Only respond with valid JSON, no additional text.`;

  const aiResponse = await generateWithAI(env, prompt, 150);
  if (!aiResponse) {
    return result;
  }

  try {
    // Extract JSON from response
    const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]) as {
        suggested_category?: string;
        suggested_tags?: string[];
        confidence_score?: number;
        reasoning?: string;
      };

      result.suggested_category = parsed.suggested_category;
      result.suggested_tags = parsed.suggested_tags;
      result.confidence_score = parsed.confidence_score;
      result.reasoning = parsed.reasoning;
      result.ai_generated = true;
      result.draft_content = {
        suggested_category: parsed.suggested_category,
        suggested_tags: parsed.suggested_tags,
      };
    }
  } catch (err) {
    console.error('Failed to parse AI selection response:', err);
  }

  return result;
}

/**
 * F-020-02: Content Generation
 * AI generates titles, summaries, rewritten descriptions, and list drafts
 */
export interface ContentGenerationInput {
  product_id?: string;
  original_title?: string;
  original_description?: string;
  category?: string;
  tone?: 'casual' | 'professional' | 'enthusiastic';
}

export interface ContentGenerationResult {
  summary?: string;
  pros?: string[];
  cons?: string[];
  use_cases?: string[];
  target_audience?: string[];
  validation: {
    has_banned_words: boolean;
    banned_words_found?: string[];
  };
  ai_generated: boolean;
}

/**
 * Generate content (F-020-02)
 */
export async function generateContent(
  env: Env,
  input: ContentGenerationInput
): Promise<ContentGenerationResult> {
  const result: ContentGenerationResult = {
    validation: { has_banned_words: false },
    ai_generated: false,
  };

  const config = getAIConfig(env);
  if (!config) {
    return result;
  }

  const toneInstruction = input.tone === 'professional'
    ? 'Use a professional, informative tone.'
    : input.tone === 'enthusiastic'
    ? 'Use an enthusiastic but honest tone. Do NOT exaggerate.'
    : 'Use a casual, helpful tone.';

  const prompt = `You are writing content for a curated product recommendation website.
${toneInstruction}
Generate the following for this product (respond in JSON):

{
  "summary": "One-sentence summary (max 100 chars)",
  "pros": ["Positive point 1", "Positive point 2", "Positive point 3"],
  "cons": ["Negative point 1", "Negative point 2"],
  "use_cases": ["Use case 1", "Use case 2"],
  "target_audience": ["Audience 1", "Audience 2"]
}

Product info:
- Original title: ${input.original_title || 'N/A'}
- Original description: ${input.original_description || 'N/A'}
- Category: ${input.category || 'general'}

IMPORTANT: Do NOT use these banned words: ${BANNED_WORDS.join(', ')}
Respond only with valid JSON, no additional text.`;

  const aiResponse = await generateWithAI(env, prompt, 300);
  if (!aiResponse) {
    return result;
  }

  try {
    const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]) as ContentGenerationResult;

      // Validate against banned words
      const allContent = [
        parsed.summary,
        ...(parsed.pros || []),
        ...(parsed.cons || []),
      ].filter(Boolean).join(' ');

      const validation = validateAgainstBannedWords(allContent);
      result.validation = {
        has_banned_words: !validation.valid,
        banned_words_found: validation.banned_word ? [validation.banned_word] : [],
      };

      result.summary = parsed.summary;
      result.pros = parsed.pros;
      result.cons = parsed.cons;
      result.use_cases = parsed.use_cases;
      result.target_audience = parsed.target_audience;
      result.ai_generated = true;
    }
  } catch (err) {
    console.error('Failed to parse AI content generation response:', err);
  }

  return result;
}

/**
 * F-020-03: Social Media Copy Generation
 * AI generates short copy for TikTok, Instagram, and X
 */
export interface SocialCopyInput {
  product_title?: string;
  category?: string;
  price_range?: string;
  platform: 'tiktok' | 'instagram' | 'x';
}

export interface SocialCopyResult {
  short_copy?: string;
  hashtags?: string[];
  emoji_suggestion?: string;
  validation: {
    has_banned_words: boolean;
    banned_words_found?: string[];
  };
  ai_generated: boolean;
}

/**
 * Generate social media copy (F-020-03)
 */
export async function generateSocialCopy(
  env: Env,
  input: SocialCopyInput
): Promise<SocialCopyResult> {
  const result: SocialCopyResult = {
    validation: { has_banned_words: false },
    ai_generated: false,
  };

  const config = getAIConfig(env);
  if (!config) {
    return result;
  }

  const platformSpecs: Record<string, { max_chars: number; style: string }> = {
    tiktok: { max_chars: 150, style: 'Hook-style, engaging, calls to action' },
    instagram: { max_chars: 150, style: 'Visual描述, aesthetic, relatable' },
    x: { max_chars: 280, style: 'Concise, witty, shareable' },
  };

  const spec = platformSpecs[input.platform] || platformSpecs.tiktok;

  const prompt = `Generate a ${input.platform} post for this product.
Style: ${spec.style}
Max length: ${spec.max_chars} characters.
Respond in JSON format:

{
  "short_copy": "The post text with appropriate emojis",
  "hashtags": ["#tag1", "#tag2", "#tag3", "#tag4", "#tag5"],
  "emoji_suggestion": "relevant emojis to use"
}

Product:
- Title: ${input.product_title || 'N/A'}
- Category: ${input.category || 'general'}
- Price: ${input.price_range || 'N/A'}

IMPORTANT: Do NOT use banned words: ${BANNED_WORDS.join(', ')}
Do NOT claim "best", "safest", "guaranteed", etc.
Respond only with valid JSON.`;

  const aiResponse = await generateWithAI(env, prompt, 200);
  if (!aiResponse) {
    return result;
  }

  try {
    const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]) as {
        short_copy?: string;
        hashtags?: string[];
        emoji_suggestion?: string;
      };

      const validation = validateAgainstBannedWords(parsed.short_copy || '');
      result.validation = {
        has_banned_words: !validation.valid,
        banned_words_found: validation.banned_word ? [validation.banned_word] : [],
      };

      result.short_copy = parsed.short_copy;
      result.hashtags = parsed.hashtags;
      result.emoji_suggestion = parsed.emoji_suggestion;
      result.ai_generated = true;
    }
  } catch (err) {
    console.error('Failed to parse AI social copy response:', err);
  }

  return result;
}

/**
 * F-020-05: Operational Analytics Insights
 * AI analyzes CTR/conversion data and provides insights for human decision-making
 */
export interface AnalyticsInsightInput {
  period_days?: number;
  category?: string;
}

export interface AnalyticsInsightResult {
  insights?: string[];
  high_performing_categories?: string[];
  low_performing_categories?: string[];
  recommendations?: string[];
  ai_generated: boolean;
}

/**
 * Generate operational analytics insights (F-020-05)
 */
export async function generateAnalyticsInsights(
  env: Env,
  input: AnalyticsInsightInput
): Promise<AnalyticsInsightResult> {
  const result: AnalyticsInsightResult = { ai_generated: false };

  const days = input.period_days || 30;

  // Get category performance data
  const categoryStats = await env.DB.prepare(`
    SELECT
      p.category,
      COUNT(DISTINCT c.anonymous_id) as unique_visitors,
      COUNT(c.id) as total_clicks,
      COUNT(c.id) * 1.0 / COUNT(DISTINCT c.anonymous_id) as clicks_per_visitor
    FROM products p
    LEFT JOIN clicks c ON p.id = c.product_id
      AND c.clicked_at >= datetime('now', '-' || ? || ' days')
    WHERE p.status = 'active'
    GROUP BY p.category
    ORDER BY clicks_per_visitor DESC
  `).bind(days).all<{
    category: string;
    unique_visitors: number;
    total_clicks: number;
    clicks_per_visitor: number;
  }>();

  if (!categoryStats.results || categoryStats.results.length === 0) {
    return result;
  }

  const config = getAIConfig(env);
  if (!config) {
    // Return raw data without AI insights
    const avgClicks = categoryStats.results.reduce((sum, c) => sum + c.clicks_per_visitor, 0) / categoryStats.results.length;
    return {
      insights: ['Insufficient data for AI insights. Configure AI provider for analysis.'],
      high_performing_categories: categoryStats.results.filter(c => c.clicks_per_visitor > avgClicks).map(c => c.category),
      low_performing_categories: categoryStats.results.filter(c => c.clicks_per_visitor < avgClicks).map(c => c.category),
      recommendations: ['Consider reviewing top-performing categories for expansion.'],
      ai_generated: false,
    };
  }

  const prompt = `Analyze this category performance data and provide insights.
Data (${days}-day period):
${categoryStats.results.map(c =>
    `- ${c.category}: ${c.unique_visitors} visitors, ${c.total_clicks} clicks, ${c.clicks_per_visitor.toFixed(2)} clicks/visitor`
  ).join('\n')}

Respond in JSON format:
{
  "insights": ["Key insight 1", "Key insight 2"],
  "high_performing_categories": ["category-name"],
  "low_performing_categories": ["category-name"],
  "recommendations": ["Actionable recommendation 1", "Actionable recommendation 2"]
}

Focus on actionable insights a human can act upon. Do not make absolute claims.`;

  const aiResponse = await generateWithAI(env, prompt, 250);
  if (!aiResponse) {
    return result;
  }

  try {
    const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]) as AnalyticsInsightResult;
      result.insights = parsed.insights;
      result.high_performing_categories = parsed.high_performing_categories;
      result.low_performing_categories = parsed.low_performing_categories;
      result.recommendations = parsed.recommendations;
      result.ai_generated = true;
    }
  } catch (err) {
    console.error('Failed to parse AI analytics response:', err);
  }

  return result;
}

/**
 * F-020-06: Product Information Completion
 * AI fills in missing fields for a product (result needs human confirmation)
 */
export interface ProductCompletionInput {
  product_id: string;
}

export interface ProductCompletionResult {
  product_id: string;
  completed_fields?: {
    summary?: string;
    pros?: string[];
    cons?: string[];
    use_cases?: string[];
    target_audience?: string[];
    shipping_notes?: string;
  };
  confidence_score?: number;
  needs_human_review: boolean;
  validation: {
    has_banned_words: boolean;
    banned_words_found?: string[];
  };
  ai_generated: boolean;
}

/**
 * Generate product information completion (F-020-06)
 */
export async function generateProductCompletion(
  env: Env,
  input: ProductCompletionInput
): Promise<ProductCompletionResult> {
  const result: ProductCompletionResult = {
    product_id: input.product_id,
    needs_human_review: true,
    validation: { has_banned_words: false },
    ai_generated: false,
  };

  // Get existing product data
  const product = await env.DB.prepare(
    'SELECT * FROM products WHERE id = ?'
  ).bind(input.product_id).first<Record<string, unknown>>();

  if (!product) {
    return result;
  }

  const config = getAIConfig(env);
  if (!config) {
    return result;
  }

  const prompt = `Analyze this product and fill in missing information.
Product data:
- Title: ${product.title || product.original_title || 'N/A'}
- Category: ${product.category || 'N/A'}
- Price: ${product.price_min || '?'} - ${product.price_max || '?'} ${product.currency || 'USD'}
- Summary: ${product.summary || 'MISSING'}
- Pros: ${product.pros || 'MISSING'}
- Cons: ${product.cons || 'MISSING'}
- Use cases: ${product.use_cases || 'MISSING'}
- Target audience: ${product.target_audience || 'MISSING'}
- Shipping: ${product.shipping_notes || 'MISSING'}
- Merchant: ${product.merchant_name || 'N/A'}

Respond in JSON with only the MISSING or incomplete fields filled in:
{
  "summary": "One-sentence summary if missing",
  "pros": ["Positive point 1", "Positive point 2", "Positive point 3"] (only if missing),
  "cons": ["Negative point 1", "Negative point 2"] (only if missing),
  "use_cases": ["Use case 1", "Use case 2"] (only if missing),
  "target_audience": ["Audience 1", "Audience 2"] (only if missing),
  "shipping_notes": "Brief shipping info" (only if missing),
  "confidence_score": 85
}

IMPORTANT: Do NOT use banned words: ${BANNED_WORDS.join(', ')}
Respond only with valid JSON. If most fields exist, return empty object {}.`;

  const aiResponse = await generateWithAI(env, prompt, 300);
  if (!aiResponse) {
    return result;
  }

  try {
    const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]) as {
        summary?: string;
        pros?: string[];
        cons?: string[];
        use_cases?: string[];
        target_audience?: string[];
        shipping_notes?: string;
        confidence_score?: number;
      };

      // Check if we got any valid completions
      const hasCompletions = parsed.summary || parsed.pros || parsed.cons ||
        parsed.use_cases || parsed.target_audience || parsed.shipping_notes;

      if (hasCompletions) {
        // Validate against banned words
        const allContent = [
          parsed.summary,
          ...(parsed.pros || []),
          ...(parsed.cons || []),
        ].filter(Boolean).join(' ');

        const validation = validateAgainstBannedWords(allContent);

        result.completed_fields = {
          summary: parsed.summary,
          pros: parsed.pros,
          cons: parsed.cons,
          use_cases: parsed.use_cases,
          target_audience: parsed.target_audience,
          shipping_notes: parsed.shipping_notes,
        };
        result.confidence_score = parsed.confidence_score;
        result.validation = {
          has_banned_words: !validation.valid,
          banned_words_found: validation.banned_word ? [validation.banned_word] : [],
        };
        result.ai_generated = true;
      }
    }
  } catch (err) {
    console.error('Failed to parse AI completion response:', err);
  }

  return result;
}

// ============================================================
// API Endpoints
// ============================================================

/**
 * POST /api/admin/ai/selection-assistance
 * F-020-01: Product selection assistance
 */
export async function aiSelectionAssistance(env: Env, request: Request): Promise<Response> {
  try {
    const body = await request.json() as SelectionAssistanceInput;

    const result = await generateSelectionAssistance(env, body);

    return new Response(JSON.stringify(jsonSuccess(result)), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('AI selection assistance error:', err);
    return new Response(JSON.stringify(jsonError(ErrorCodes.INTERNAL_ERROR, 'Failed to generate selection assistance')), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

/**
 * POST /api/admin/ai/content-generation
 * F-020-02: Content generation
 */
export async function aiContentGeneration(env: Env, request: Request): Promise<Response> {
  try {
    const body = await request.json() as ContentGenerationInput;

    const result = await generateContent(env, body);

    return new Response(JSON.stringify(jsonSuccess(result)), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('AI content generation error:', err);
    return new Response(JSON.stringify(jsonError(ErrorCodes.INTERNAL_ERROR, 'Failed to generate content')), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

/**
 * POST /api/admin/ai/social-copy
 * F-020-03: Social media copy generation
 */
export async function aiSocialCopy(env: Env, request: Request): Promise<Response> {
  try {
    const body = await request.json() as SocialCopyInput;

    if (!body.platform || !['tiktok', 'instagram', 'x'].includes(body.platform)) {
      return new Response(JSON.stringify(jsonError(ErrorCodes.INVALID_PARAMS, 'platform is required: tiktok, instagram, or x')), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const result = await generateSocialCopy(env, body);

    return new Response(JSON.stringify(jsonSuccess(result)), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('AI social copy error:', err);
    return new Response(JSON.stringify(jsonError(ErrorCodes.INTERNAL_ERROR, 'Failed to generate social copy')), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

/**
 * POST /api/admin/ai/analytics-insights
 * F-020-05: Analytics insights
 */
export async function aiAnalyticsInsights(env: Env, request: Request): Promise<Response> {
  try {
    const body = await request.json() as AnalyticsInsightInput;

    const result = await generateAnalyticsInsights(env, body);

    return new Response(JSON.stringify(jsonSuccess(result)), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('AI analytics insights error:', err);
    return new Response(JSON.stringify(jsonError(ErrorCodes.INTERNAL_ERROR, 'Failed to generate insights')), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

/**
 * POST /api/admin/ai/product-completion
 * F-020-06: Product information completion
 */
export async function aiProductCompletion(env: Env, request: Request): Promise<Response> {
  try {
    const body = await request.json() as ProductCompletionInput;

    if (!body.product_id) {
      return new Response(JSON.stringify(jsonError(ErrorCodes.INVALID_PARAMS, 'product_id is required')), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const result = await generateProductCompletion(env, body);

    return new Response(JSON.stringify(jsonSuccess(result)), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('AI product completion error:', err);
    return new Response(JSON.stringify(jsonError(ErrorCodes.INTERNAL_ERROR, 'Failed to generate completion')), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

/**
 * GET /api/admin/ai/status
 * Check AI service configuration status
 */
export async function getAIStatus(env: Env): Promise<Response> {
  const config = getAIConfig(env);

  return new Response(JSON.stringify(jsonSuccess({
    ai_configured: !!config,
    provider: config?.provider || null,
    features: {
      selection_assistance: 'F-020-01',
      content_generation: 'F-020-02',
      social_copy: 'F-020-03',
      recommendation_explanation: 'F-020-04 (see /api/explain)',
      analytics_insights: 'F-020-05',
      product_completion: 'F-020-06',
    },
    banned_words_count: BANNED_WORDS.length,
  })), {
    headers: { 'Content-Type': 'application/json' },
  });
}
