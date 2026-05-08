// AI Review Workflow - F-021
// Human review workflow for AI-generated content
//
// Implements the 5-step review process per SRS Section 5.2:
//   1. AI generates draft
//   2. Human first review (accuracy check)
//   3. High-risk category second review (medical/beauty/kids/electronics)
//   4. Tone review (brand/exaggeration check)
//   5. Publish
//
// F-021 boundaries:
//   F-021-01: Final product selection - human must confirm
//   F-021-02: Compliance judgment - human must check for violations
//   F-021-03: Brand tone control - human must approve core content
//   F-021-04: Commercial placement - human must decide ad/sponsor ranking
//   F-021-05: Exaggeration audit - banned words check (best/safest/guaranteed/etc.)
//
// High-risk categories requiring second review:
//   - medical, beauty, kids, electronics

import { Env } from '../db/schema';
import { jsonSuccess, jsonError } from '../lib/response';
import { ErrorCodes } from '../lib/errors';
import { parsePagination } from '../lib/constants';
// ST-P4修复：禁用词表统一从ai_content.ts导入（Single Source of Truth）
import { validateAgainstBannedWords, BANNED_WORDS } from './ai_content';

// ============================================================
// Types & Constants
// ============================================================

export type ReviewStatus =
  | 'draft'           // AI-generated, awaiting first review
  | 'pending_review'  // Submitted for human review
  | 'approved'        // Approved for publishing
  | 'rejected'        // Rejected, needs revision
  | 'revision_requested' // Sent back for specific changes
  | 'published';      // Actually published/live

export type ReviewStep =
  | 'ai_generation'
  | 'first_review'
  | 'high_risk_review'
  | 'tone_review'
  | 'published';

export type ContentType = 'product_title' | 'product_summary' | 'product_description' |
  'list_content' | 'social_copy' | 'recommendation_explanation';

export type HighRiskCategory = 'medical' | 'beauty' | 'kids' | 'electronics';

// High-risk categories per SRS Section 5.2
const HIGH_RISK_CATEGORIES: HighRiskCategory[] = ['medical', 'beauty', 'kids', 'electronics'];

export interface AIReviewRecord {
  id: string;
  content_type: ContentType;
  content_id: string; // product_id or list_id
  draft_content: string;
  status: ReviewStatus;
  current_step: ReviewStep;
  category?: string;
  is_high_risk: boolean;
  created_by: string; // operator who requested AI generation
  reviewed_by?: string;
  review_notes?: string;
  rejection_reason?: string;
  approved_at?: string;
  published_at?: string;
  created_at: string;
  updated_at: string;
}

export interface ReviewValidation {
  passed: boolean;
  issues: string[];
  warnings: string[];
}

// ============================================================
// Database Setup
// ============================================================

async function ensureReviewTable(env: Env): Promise<void> {
  await env.DB.prepare(`
    CREATE TABLE IF NOT EXISTS ai_review_records (
      id TEXT PRIMARY KEY,
      content_type TEXT NOT NULL,
      content_id TEXT NOT NULL,
      draft_content TEXT NOT NULL,
      status TEXT DEFAULT 'draft',
      current_step TEXT DEFAULT 'ai_generation',
      category TEXT,
      is_high_risk INTEGER DEFAULT 0,
      created_by TEXT NOT NULL,
      reviewed_by TEXT,
      review_notes TEXT,
      rejection_reason TEXT,
      approved_at TEXT,
      published_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `).run();

  await env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_review_content ON ai_review_records(content_type, content_id)`).run();
  await env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_review_status ON ai_review_records(status)`).run();
  await env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_review_high_risk ON ai_review_records(is_high_risk)`).run();
}

// ============================================================
// High-Risk Category Detection
// ============================================================

function isHighRiskCategory(category: string): boolean {
  const lower = category?.toLowerCase() || '';
  return HIGH_RISK_CATEGORIES.some(risk =>
    lower.includes(risk) || lower.includes('health') || lower.includes('supplement')
  );
}

// ============================================================
// Review Validation Functions
// ============================================================

/**
 * F-021-02: Compliance judgment validation
 * Check if content has potential compliance issues
 */
export function validateCompliance(content: string, category?: string): ReviewValidation {
  const issues: string[] = [];
  const warnings: string[] = [];

  // Check for banned words
  const bannedValidation = validateAgainstBannedWords(content);
  if (!bannedValidation.valid && bannedValidation.banned_word) {
    issues.push(`Contains banned expression: "${bannedValidation.banned_word}" (F-021-05)`);
  }

  // Check for comparison claims
  const comparisonPatterns = [
    /better than/i,
    /worse than/i,
    /most effective/i,
    /only product/i,
    /clinically proven/i,
  ];

  for (const pattern of comparisonPatterns) {
    if (pattern.test(content)) {
      warnings.push(`Contains comparison claim that may need verification: "${pattern}"`);
    }
  }

  // Check for health/medical claims in non-health categories
  const healthClaims = /treats?|cures?|prevents?|heals?|protects? against/i;
  if (healthClaims.test(content) && !isHighRiskCategory(category || '')) {
    warnings.push('Contains health-related claims - verify appropriateness for category');
  }

  // Check for absolute claims
  const absolutePatterns = [
    /\b100%\b/,
    /\bzero\b.*\brisk\b/i,
    /\bguaranteed\b/i,
    /\balways\b/,
    /\bnever\b.*\bfail\b/i,
  ];

  for (const pattern of absolutePatterns) {
    if (pattern.test(content)) {
      warnings.push(`Contains potentially exaggerated claim: "${pattern}"`);
    }
  }

  return {
    passed: issues.length === 0,
    issues,
    warnings,
  };
}

/**
 * F-021-03: Brand tone validation
 * Check if content matches Findora's brand voice
 */
export function validateBrandTone(content: string): ReviewValidation {
  const issues: string[] = [];
  const warnings: string[] = [];

  // Check for excessive enthusiasm
  const excessiveEnthusiasm = /!!!!+|!!!|\?\?\?|!!!/g;
  if (excessiveEnthusiasm.test(content)) {
    warnings.push('Excessive punctuation may harm credibility');
  }

  // Check for ALL CAPS (except acronyms)
  const capsPattern = /[A-Z]{5,}/;
  if (capsPattern.test(content)) {
    warnings.push('Excessive CAPS may appear unprofessional');
  }

  // Check for emotional manipulation
  const emotionalPatterns = [
    /you'll regret/i,
    /don't miss out/i,
    /act now/i,
    /limited time/i,
    /offer ends/i,
  ];

  for (const pattern of emotionalPatterns) {
    if (pattern.test(content)) {
      warnings.push(`Uses urgency language that may feel manipulative: "${pattern}"`);
    }
  }

  // Check for superlatives without justification
  const unjustifiedSuperlatives = /most.*\bever\b|best.*\bever\b|worst.*\bever\b/i;
  if (unjustifiedSuperlatives.test(content)) {
    issues.push('Contains unjustified superlative comparison');
  }

  return {
    passed: issues.length === 0,
    issues,
    warnings,
  };
}

/**
 * F-021-04: Commercial placement validation
 * Validate content for ad/sponsor placement rules
 */
export function validateCommercialPlacement(
  content: string,
  isSponsored: boolean = false
): ReviewValidation {
  const issues: string[] = [];
  const warnings: string[] = [];

  if (!isSponsored) {
    // Check for accidental sponsored content language
    const sponsoredPatterns = [
      /sponsored by/i,
      /paid advertisement/i,
      /advertisement:/i,
    ];

    for (const pattern of sponsoredPatterns) {
      if (pattern.test(content)) {
        issues.push('Contains sponsored content markers but not marked as sponsored');
      }
    }
  }

  // Check for competitor mentions
  const competitorPatterns = [
    /unlike.*brand/i,
    /competitor.*vs/i,
    /other.*brands.*suck/i,
  ];

  for (const pattern of competitorPatterns) {
    if (pattern.test(content)) {
      warnings.push('Contains competitor comparison - verify compliance');
    }
  }

  return {
    passed: issues.length === 0,
    issues,
    warnings,
  };
}

/**
 * F-021-05: Exaggeration audit
 * Check for banned expressions
 */
export function validateExaggeration(content: string): ReviewValidation {
  const issues: string[] = [];
  const warnings: string[] = [];

  const lower = content.toLowerCase();

  for (const expression of BANNED_WORDS) {
    if (lower.includes(expression)) {
      if (['best', 'worst', 'safest', 'guaranteed', 'proven', 'dangerous'].includes(expression)) {
        issues.push(`Contains banned expression: "${expression}" (F-021-05)`);
      } else {
        warnings.push(`Contains potentially exaggerated expression: "${expression}"`);
      }
    }
  }

  return {
    passed: issues.length === 0,
    issues,
    warnings,
  };
}

// ============================================================
// Review Workflow Functions
// ============================================================

/**
 * Create a new AI content review record
 */
export async function createReviewRecord(
  env: Env,
  params: {
    content_type: ContentType;
    content_id: string;
    draft_content: string;
    category?: string;
    created_by: string;
  }
): Promise<AIReviewRecord> {
  await ensureReviewTable(env);

  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const isHighRisk = params.category ? isHighRiskCategory(params.category) : false;

  await env.DB.prepare(`
    INSERT INTO ai_review_records
      (id, content_type, content_id, draft_content, status, current_step, category, is_high_risk, created_by, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    id,
    params.content_type,
    params.content_id,
    params.draft_content,
    'draft',
    'ai_generation',
    params.category || null,
    isHighRisk ? 1 : 0,
    params.created_by,
    now,
    now
  ).run();

  return {
    id,
    content_type: params.content_type,
    content_id: params.content_id,
    draft_content: params.draft_content,
    status: 'draft',
    current_step: 'ai_generation',
    category: params.category,
    is_high_risk: isHighRisk,
    created_by: params.created_by,
    created_at: now,
    updated_at: now,
  };
}

/**
 * Submit content for review (move from draft to pending_review)
 */
export async function submitForReview(
  env: Env,
  reviewId: string,
  operatorId: string
): Promise<AIReviewRecord | null> {
  await ensureReviewTable(env);

  const record = await env.DB.prepare(
    'SELECT * FROM ai_review_records WHERE id = ?'
  ).bind(reviewId).first<AIReviewRecord>();

  if (!record) {
    return null;
  }

  if (record.status !== 'draft' && record.status !== 'revision_requested') {
    return null;
  }

  const newStep = record.is_high_risk ? 'first_review' : 'high_risk_review';
  const newStatus: ReviewStatus = 'pending_review';

  await env.DB.prepare(`
    UPDATE ai_review_records
    SET status = ?, current_step = ?, updated_at = ?
    WHERE id = ?
  `).bind(newStatus, newStep, new Date().toISOString(), reviewId).run();

  return {
    ...record,
    status: newStatus,
    current_step: newStep,
    updated_at: new Date().toISOString(),
  };
}

/**
 * Perform first review (accuracy check)
 * F-021-01, F-021-02: Final selection and compliance judgment
 */
export async function performFirstReview(
  env: Env,
  reviewId: string,
  reviewerId: string,
  params: {
    approved: boolean;
    notes?: string;
    rejection_reason?: string;
  }
): Promise<AIReviewRecord | null> {
  await ensureReviewTable(env);

  const record = await env.DB.prepare(
    'SELECT * FROM ai_review_records WHERE id = ?'
  ).bind(reviewId).first<AIReviewRecord>();

  if (!record) {
    return null;
  }

  if (record.current_step !== 'first_review' && record.current_step !== 'high_risk_review') {
    return null;
  }

  const now = new Date().toISOString();
  let newStatus: ReviewStatus;
  let newStep: ReviewStep;

  if (params.approved) {
    // If high-risk and not yet passed high-risk review, move to tone review
    if (record.is_high_risk && record.current_step === 'first_review') {
      newStatus = 'pending_review';
      newStep = 'high_risk_review';
    } else {
      newStatus = 'pending_review';
      newStep = 'tone_review';
    }
  } else {
    newStatus = 'rejected';
    newStep = record.current_step;
  }

  await env.DB.prepare(`
    UPDATE ai_review_records
    SET status = ?, current_step = ?, reviewed_by = ?, review_notes = ?,
        rejection_reason = ?, updated_at = ?
    WHERE id = ?
  `).bind(
    newStatus,
    newStep,
    reviewerId,
    params.notes || null,
    params.rejection_reason || null,
    now,
    reviewId
  ).run();

  return {
    ...record,
    status: newStatus,
    current_step: newStep,
    reviewed_by: reviewerId,
    review_notes: params.notes,
    rejection_reason: params.rejection_reason,
    updated_at: now,
  };
}

/**
 * Perform second review (high-risk categories)
 * F-021-02: Compliance judgment for high-risk content
 */
export async function performHighRiskReview(
  env: Env,
  reviewId: string,
  reviewerId: string,
  params: {
    approved: boolean;
    notes?: string;
    rejection_reason?: string;
  }
): Promise<AIReviewRecord | null> {
  await ensureReviewTable(env);

  const record = await env.DB.prepare(
    'SELECT * FROM ai_review_records WHERE id = ?'
  ).bind(reviewId).first<AIReviewRecord>();

  if (!record || !record.is_high_risk) {
    return null;
  }

  if (record.current_step !== 'high_risk_review') {
    return null;
  }

  const now = new Date().toISOString();
  let newStatus: ReviewStatus;
  let newStep: ReviewStep;

  if (params.approved) {
    newStatus = 'pending_review';
    newStep = 'tone_review';
  } else {
    newStatus = 'rejected';
    newStep = 'high_risk_review';
  }

  await env.DB.prepare(`
    UPDATE ai_review_records
    SET status = ?, current_step = ?, reviewed_by = ?, review_notes = ?,
        rejection_reason = ?, updated_at = ?
    WHERE id = ?
  `).bind(
    newStatus,
    newStep,
    reviewerId,
    params.notes || null,
    params.rejection_reason || null,
    now,
    reviewId
  ).run();

  return {
    ...record,
    status: newStatus,
    current_step: newStep,
    reviewed_by: reviewerId,
    review_notes: params.notes,
    rejection_reason: params.rejection_reason,
    updated_at: now,
  };
}

/**
 * Perform tone review (final approval)
 * F-021-03, F-021-04: Brand tone and commercial placement
 */
export async function performToneReview(
  env: Env,
  reviewId: string,
  reviewerId: string,
  params: {
    approved: boolean;
    notes?: string;
    rejection_reason?: string;
  }
): Promise<AIReviewRecord | null> {
  await ensureReviewTable(env);

  const record = await env.DB.prepare(
    'SELECT * FROM ai_review_records WHERE id = ?'
  ).bind(reviewId).first<AIReviewRecord>();

  if (!record) {
    return null;
  }

  if (record.current_step !== 'tone_review') {
    return null;
  }

  const now = new Date().toISOString();
  let newStatus: ReviewStatus;
  let newStep: ReviewStep;

  if (params.approved) {
    newStatus = 'approved';
    newStep = 'published';
  } else {
    newStatus = 'rejected';
    newStep = 'tone_review';
  }

  await env.DB.prepare(`
    UPDATE ai_review_records
    SET status = ?, current_step = ?, reviewed_by = ?, review_notes = ?,
        rejection_reason = ?, approved_at = ?, updated_at = ?
    WHERE id = ?
  `).bind(
    newStatus,
    newStep,
    reviewerId,
    params.notes || null,
    params.rejection_reason || null,
    params.approved ? now : null,
    now,
    reviewId
  ).run();

  return {
    ...record,
    status: newStatus,
    current_step: newStep,
    reviewed_by: reviewerId,
    review_notes: params.notes,
    rejection_reason: params.rejection_reason,
    approved_at: params.approved ? now : undefined,
    updated_at: now,
  };
}

/**
 * Request revision (send back for changes)
 */
export async function requestRevision(
  env: Env,
  reviewId: string,
  reviewerId: string,
  notes: string
): Promise<AIReviewRecord | null> {
  await ensureReviewTable(env);

  const record = await env.DB.prepare(
    'SELECT * FROM ai_review_records WHERE id = ?'
  ).bind(reviewId).first<AIReviewRecord>();

  if (!record) {
    return null;
  }

  if (record.status !== 'pending_review') {
    return null;
  }

  const now = new Date().toISOString();

  await env.DB.prepare(`
    UPDATE ai_review_records
    SET status = 'revision_requested', reviewed_by = ?, review_notes = ?, updated_at = ?
    WHERE id = ?
  `).bind(reviewerId, notes, now, reviewId).run();

  return {
    ...record,
    status: 'revision_requested',
    reviewed_by: reviewerId,
    review_notes: notes,
    updated_at: now,
  };
}

/**
 * Get review record by ID
 */
export async function getReviewRecord(
  env: Env,
  reviewId: string
): Promise<AIReviewRecord | null> {
  await ensureReviewTable(env);

  const record = await env.DB.prepare(
    'SELECT * FROM ai_review_records WHERE id = ?'
  ).bind(reviewId).first<Record<string, unknown>>();

  if (!record) {
    return null;
  }

  return {
    ...record,
    is_high_risk: !!record.is_high_risk,
  } as unknown as AIReviewRecord;
}

/**
 * List review records with filtering
 */
export async function listReviewRecords(
  env: Env,
  params: {
    status?: ReviewStatus;
    content_type?: ContentType;
    category?: string;
    is_high_risk?: boolean;
    page?: number;
    limit?: number;
  }
): Promise<{ records: AIReviewRecord[]; total: number }> {
  await ensureReviewTable(env);

  const page = Math.max(1, params.page || 1);
  const limit = Math.min(100, Math.max(1, params.limit || 20));
  const offset = (page - 1) * limit;

  let where = 'WHERE 1=1';
  const bindings: (string | number)[] = [];

  if (params.status) {
    where += ' AND status = ?';
    bindings.push(params.status);
  }

  if (params.content_type) {
    where += ' AND content_type = ?';
    bindings.push(params.content_type);
  }

  if (params.category) {
    where += ' AND category = ?';
    bindings.push(params.category);
  }

  if (params.is_high_risk !== undefined) {
    where += ' AND is_high_risk = ?';
    bindings.push(params.is_high_risk ? 1 : 0);
  }

  const countRow = await env.DB.prepare(
    `SELECT COUNT(*) as total FROM ai_review_records ${where}`
  ).bind(...bindings).first<{ total: number }>();

  const rows = await env.DB.prepare(`
    SELECT * FROM ai_review_records
    ${where}
    ORDER BY updated_at DESC
    LIMIT ? OFFSET ?
  `).bind(...bindings, limit, offset).all<Record<string, unknown>>();

  return {
    records: (rows.results || []) as unknown as AIReviewRecord[],
    total: countRow?.total || 0,
  };
}

/**
 * Get pending reviews count by step
 */
export async function getPendingReviewCounts(
  env: Env
): Promise<Record<string, number>> {
  await ensureReviewTable(env);

  const rows = await env.DB.prepare(`
    SELECT current_step, COUNT(*) as count
    FROM ai_review_records
    WHERE status = 'pending_review'
    GROUP BY current_step
  `).all<{ current_step: string; count: number }>();

  const counts: Record<string, number> = {
    first_review: 0,
    high_risk_review: 0,
    tone_review: 0,
  };

  for (const row of rows.results || []) {
    counts[row.current_step] = row.count;
  }

  return counts;
}

// ============================================================
// API Endpoints
// ============================================================

/**
 * POST /api/admin/ai/review/create
 * Create a new AI content review record
 */
export async function createAIReviewRecord(env: Env, request: Request): Promise<Response> {
  try {
    const body = await request.json() as {
      content_type: ContentType;
      content_id: string;
      draft_content: string;
      category?: string;
      created_by: string;
    };

    if (!body.content_type || !body.content_id || !body.draft_content || !body.created_by) {
      return new Response(JSON.stringify(jsonError(ErrorCodes.INVALID_PARAMS, 'Missing required fields')), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const record = await createReviewRecord(env, {
      content_type: body.content_type,
      content_id: body.content_id,
      draft_content: body.draft_content,
      category: body.category,
      created_by: body.created_by,
    });

    return new Response(JSON.stringify(jsonSuccess(record)), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('Create review record error:', err);
    return new Response(JSON.stringify(jsonError(ErrorCodes.INTERNAL_ERROR, 'Failed to create review record')), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

/**
 * POST /api/admin/ai/review/:id/submit
 * Submit content for review
 */
export async function submitContentForReview(env: Env, request: Request, reviewId: string): Promise<Response> {
  try {
    const body = await request.json() as { operator_id: string };

    const record = await submitForReview(env, reviewId, body.operator_id || 'system');

    if (!record) {
      return new Response(JSON.stringify(jsonError(ErrorCodes.NOT_FOUND, 'Review record not found or not in submittable state')), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify(jsonSuccess(record)), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('Submit for review error:', err);
    return new Response(JSON.stringify(jsonError(ErrorCodes.INTERNAL_ERROR, 'Failed to submit for review')), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

/**
 * POST /api/admin/ai/review/:id/review
 * Perform first review (accuracy + compliance check)
 */
export async function reviewContent(env: Env, request: Request, reviewId: string): Promise<Response> {
  try {
    const body = await request.json() as {
      reviewer_id: string;
      approved: boolean;
      notes?: string;
      rejection_reason?: string;
    };

    if (!body.reviewer_id) {
      return new Response(JSON.stringify(jsonError(ErrorCodes.INVALID_PARAMS, 'reviewer_id is required')), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const record = await performFirstReview(env, reviewId, body.reviewer_id, {
      approved: body.approved,
      notes: body.notes,
      rejection_reason: body.rejection_reason,
    });

    if (!record) {
      return new Response(JSON.stringify(jsonError(ErrorCodes.NOT_FOUND, 'Review record not found or not in reviewable state')), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify(jsonSuccess(record)), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('Review content error:', err);
    return new Response(JSON.stringify(jsonError(ErrorCodes.INTERNAL_ERROR, 'Failed to review content')), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

/**
 * POST /api/admin/ai/review/:id/high-risk-review
 * Perform high-risk second review
 */
export async function reviewHighRiskContent(env: Env, request: Request, reviewId: string): Promise<Response> {
  try {
    const body = await request.json() as {
      reviewer_id: string;
      approved: boolean;
      notes?: string;
      rejection_reason?: string;
    };

    if (!body.reviewer_id) {
      return new Response(JSON.stringify(jsonError(ErrorCodes.INVALID_PARAMS, 'reviewer_id is required')), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const record = await performHighRiskReview(env, reviewId, body.reviewer_id, {
      approved: body.approved,
      notes: body.notes,
      rejection_reason: body.rejection_reason,
    });

    if (!record) {
      return new Response(JSON.stringify(jsonError(ErrorCodes.NOT_FOUND, 'Review record not found or not high-risk')), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify(jsonSuccess(record)), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('High-risk review error:', err);
    return new Response(JSON.stringify(jsonError(ErrorCodes.INTERNAL_ERROR, 'Failed to perform high-risk review')), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

/**
 * POST /api/admin/ai/review/:id/tone-review
 * Perform tone review (final approval)
 */
export async function reviewTone(env: Env, request: Request, reviewId: string): Promise<Response> {
  try {
    const body = await request.json() as {
      reviewer_id: string;
      approved: boolean;
      notes?: string;
      rejection_reason?: string;
    };

    if (!body.reviewer_id) {
      return new Response(JSON.stringify(jsonError(ErrorCodes.INVALID_PARAMS, 'reviewer_id is required')), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const record = await performToneReview(env, reviewId, body.reviewer_id, {
      approved: body.approved,
      notes: body.notes,
      rejection_reason: body.rejection_reason,
    });

    if (!record) {
      return new Response(JSON.stringify(jsonError(ErrorCodes.NOT_FOUND, 'Review record not found or not in tone review state')), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify(jsonSuccess(record)), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('Tone review error:', err);
    return new Response(JSON.stringify(jsonError(ErrorCodes.INTERNAL_ERROR, 'Failed to perform tone review')), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

/**
 * POST /api/admin/ai/review/:id/revision
 * Request revision (send back for changes)
 */
export async function requestContentRevision(env: Env, request: Request, reviewId: string): Promise<Response> {
  try {
    const body = await request.json() as {
      reviewer_id: string;
      notes: string;
    };

    if (!body.reviewer_id || !body.notes) {
      return new Response(JSON.stringify(jsonError(ErrorCodes.INVALID_PARAMS, 'reviewer_id and notes are required')), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const record = await requestRevision(env, reviewId, body.reviewer_id, body.notes);

    if (!record) {
      return new Response(JSON.stringify(jsonError(ErrorCodes.NOT_FOUND, 'Review record not found or not in pending state')), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify(jsonSuccess(record)), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('Request revision error:', err);
    return new Response(JSON.stringify(jsonError(ErrorCodes.INTERNAL_ERROR, 'Failed to request revision')), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

/**
 * GET /api/admin/ai/review/:id
 * Get a specific review record
 */
export async function getReviewRecordById(env: Env, request: Request, reviewId: string): Promise<Response> {
  const record = await getReviewRecord(env, reviewId);

  if (!record) {
    return new Response(JSON.stringify(jsonError(ErrorCodes.NOT_FOUND, 'Review record not found')), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify(jsonSuccess(record)), {
    headers: { 'Content-Type': 'application/json' },
  });
}

/**
 * GET /api/admin/ai/review
 * List review records
 */
export async function listAIReviewRecords(env: Env, request: Request): Promise<Response> {
  const url = new URL(request.url);

  const { page, limit } = parsePagination(url, 20);

  const params = {
    status: (url.searchParams.get('status') || undefined) as ReviewStatus | undefined,
    content_type: (url.searchParams.get('content_type') || undefined) as ContentType | undefined,
    category: url.searchParams.get('category') || undefined,
    is_high_risk: url.searchParams.get('is_high_risk') === 'true' ? true :
                 url.searchParams.get('is_high_risk') === 'false' ? false : undefined,
    page,
    limit,
  };

  const result = await listReviewRecords(env, params);

  return new Response(JSON.stringify(jsonSuccess({
    records: result.records,
    pagination: {
      page: params.page,
      limit: params.limit,
      total: result.total,
      pages: Math.ceil(result.total / params.limit),
    },
  })), {
    headers: { 'Content-Type': 'application/json' },
  });
}

/**
 * GET /api/admin/ai/review/pending-counts
 * Get pending review counts by step
 */
export async function getPendingCounts(env: Env): Promise<Response> {
  const counts = await getPendingReviewCounts(env);

  return new Response(JSON.stringify(jsonSuccess(counts)), {
    headers: { 'Content-Type': 'application/json' },
  });
}

/**
 * POST /api/admin/ai/review/validate
 * Validate content against review criteria
 */
export async function validateContent(env: Env, request: Request): Promise<Response> {
  try {
    const body = await request.json() as {
      content: string;
      category?: string;
      is_sponsored?: boolean;
    };

    if (!body.content) {
      return new Response(JSON.stringify(jsonError(ErrorCodes.INVALID_PARAMS, 'content is required')), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const compliance = validateCompliance(body.content, body.category);
    const brandTone = validateBrandTone(body.content);
    const exaggeration = validateExaggeration(body.content);
    const commercial = validateCommercialPlacement(body.content, body.is_sponsored);

    const allIssues = [
      ...compliance.issues,
      ...brandTone.issues,
      ...exaggeration.issues,
      ...commercial.issues,
    ];

    const allWarnings = [
      ...compliance.warnings,
      ...brandTone.warnings,
      ...exaggeration.warnings,
      ...commercial.warnings,
    ];

    return new Response(JSON.stringify(jsonSuccess({
      passed: allIssues.length === 0,
      issues: allIssues,
      warnings: allWarnings,
      details: {
        compliance,
        brand_tone: brandTone,
        exaggeration,
        commercial_placement: commercial,
      },
      banned_words_list: BANNED_WORDS,
    })), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('Validate content error:', err);
    return new Response(JSON.stringify(jsonError(ErrorCodes.INTERNAL_ERROR, 'Failed to validate content')), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
