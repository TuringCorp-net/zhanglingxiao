// Content Management API - F-030/F-031 Content Workflow
// Implements: topic creation, product association, status workflow, publishing
import { Env, Product, List } from '../../db/schema';
import { jsonSuccess, jsonError, parseJSON } from '../../lib/response';
import { ErrorCodes } from '../../lib/errors';
import { parsePagination } from '../../lib/constants';

// Content workflow states
type WorkflowStatus = 'idea' | 'in_review' | 'approved' | 'published' | 'archived';

// === TypeScript Interfaces ===

export interface ContentTopic {
  id: string;
  title: string;
  description: string | null;
  category: string | null;
  status: WorkflowStatus;
  priority: number;
  target_week: string | null;
  created_by: string | null;
  reviewed_by: string | null;
  review_notes: string | null;
  approved_at: string | null;
  published_at: string | null;
  archived_at: string | null;
  scheduled_publish_at: string | null; // O-F030-03: Flexible publish scheduling
  weekly_output: number;
  created_at: string;
  updated_at: string;
}

export interface TopicProduct {
  id: string;
  topic_id: string;
  product_id: string;
  position: number;
  ai_score: number | null;
  ai_reason: string | null;
  human_verified: number;
  is_selected: number;
  notes: string | null;
  product_url: string | null; // O-F030-01: Enhanced structured fields
  highlight_tags: string | null; // O-F030-01: JSON array for key features
  comparison_notes: string | null; // O-F030-01: Pros/Cons summary
  created_at: string;
  updated_at: string;
}

export interface ContentProduction {
  id: string;
  topic_id: string | null;
  list_id: string | null;
  week_start: string;
  week_end: string;
  products_published: number;
  content_type: string;
  status: 'draft' | 'published' | 'archived';
  published_at: string | null;
  review_notes: string | null;
  review_completed: number;
  review_completed_at: string | null;
  version: number; // O-F030-04: Version tracking for rollback
  parent_version_id: string | null; // O-F030-04: Version chain for rollback
  created_at: string;
  updated_at: string;
}

// === Helper Functions ===

function parseTopic(row: Record<string, unknown>): ContentTopic {
  return row as unknown as ContentTopic;
}

function parseTopicProduct(row: Record<string, unknown>): TopicProduct {
  return row as unknown as TopicProduct;
}

type PublishInput = {
  topic_id: string;
  title: string;
  slug: string;
  description?: string | null;
  why_these?: string | null;
  cover_image?: string | null;
  category?: string | null;
  product_ids?: string[];
  content_type?: string;
  disclosure?: string | null;
  action: 'publish' | 'scheduled_publish';
  actor: string | null;
};

async function logWorkflowAudit(
  env: Env,
  entityType: string,
  entityId: string,
  action: string,
  actor: string | null,
  oldStatus: string | null,
  newStatus: string | null,
  notes: string | null = null,
  metadata: string | null = null
): Promise<void> {
  await env.DB.prepare(`
    INSERT INTO workflow_audit_log (id, entity_type, entity_id, action, actor, old_status, new_status, notes, metadata, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    crypto.randomUUID(),
    entityType,
    entityId,
    action,
    actor,
    oldStatus,
    newStatus,
    notes,
    metadata,
    new Date().toISOString()
  ).run();
}

async function executePublish(env: Env, input: PublishInput): Promise<{ list_id: string; products_published: number }> {
  const contentType = input.content_type || 'organic';
  if ((contentType === 'affiliate' || contentType === 'sponsored') && !input.disclosure) {
    throw new Error('Disclosure declaration is required for affiliate or sponsored content (O-F030-06)');
  }

  const topicResult = await env.DB.prepare('SELECT * FROM content_topics WHERE id = ?').bind(input.topic_id).first<Record<string, unknown>>();
  if (!topicResult) {
    throw new Error('Topic not found');
  }
  const topic = parseTopic(topicResult);
  if (topic.status !== 'approved') {
    throw new Error(`Topic must be in 'approved' status to publish. Current status: '${topic.status}'`);
  }

  let productsToAdd = input.product_ids || [];
  if (productsToAdd.length === 0) {
    const selectedProducts = await env.DB.prepare(
      'SELECT product_id FROM topic_products WHERE topic_id = ? AND is_selected = 1'
    ).bind(input.topic_id).all<Record<string, unknown>>();
    productsToAdd = (selectedProducts.results || []).map((r) => (r as Record<string, unknown>).product_id as string);
  }
  if (productsToAdd.length === 0) {
    throw new Error('No selected products to publish');
  }

  const now = new Date().toISOString();
  const listId = crypto.randomUUID();

  await env.DB.prepare(`
    INSERT INTO lists (id, slug, title, description, why_these, cover_image, category, status, content_type, disclosure, published_at, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    listId,
    input.slug,
    input.title,
    input.description || null,
    input.why_these || null,
    input.cover_image || null,
    input.category || input.topic_id || null,
    'published',
    contentType,
    input.disclosure || null,
    now,
    now,
    now
  ).run();

  let position = 0;
  for (const productId of productsToAdd) {
    await env.DB.prepare(`
      INSERT INTO list_products (id, list_id, product_id, position, created_at)
      VALUES (?, ?, ?, ?, ?)
    `).bind(crypto.randomUUID(), listId, productId, position++, now).run();
  }

  await env.DB.prepare(`
    UPDATE content_topics SET status = 'published', published_at = ?, updated_at = ?, weekly_output = weekly_output + 1
    WHERE id = ?
  `).bind(now, now, input.topic_id).run();

  const weekStart = getWeekStart(new Date());
  const weekEnd = getWeekEnd(new Date());
  const latestVersion = await env.DB.prepare(
    'SELECT MAX(version) as max_version FROM content_production WHERE topic_id = ?'
  ).bind(input.topic_id).first<{ max_version: number | null }>();
  const newVersion = (latestVersion?.max_version || 0) + 1;
  const parentVersion = await env.DB.prepare(
    'SELECT id FROM content_production WHERE topic_id = ? AND version = ?'
  ).bind(input.topic_id, latestVersion?.max_version || 1).first<{ id: string }>();

  await env.DB.prepare(`
    INSERT INTO content_production (id, topic_id, list_id, week_start, week_end, products_published, content_type, status, published_at, version, parent_version_id, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    crypto.randomUUID(),
    input.topic_id,
    listId,
    weekStart,
    weekEnd,
    productsToAdd.length,
    'list',
    'published',
    now,
    newVersion,
    parentVersion?.id || null,
    now,
    now
  ).run();

  await logWorkflowAudit(
    env,
    'content_topic',
    input.topic_id,
    input.action,
    input.actor,
    'approved',
    'published',
    `Published as list ${listId}`
  );

  return { list_id: listId, products_published: productsToAdd.length };
}

// === API Handlers ===

// POST /api/admin/content/topics - Create a new topic (选题)
export async function createTopic(env: Env, request: Request): Promise<Response> {
  const body = await request.json() as Partial<ContentTopic>;

  if (!body.title) {
    return new Response(JSON.stringify(jsonError(ErrorCodes.INVALID_PARAMS, 'title is required')), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const status: WorkflowStatus = 'idea';

  await env.DB.prepare(`
    INSERT INTO content_topics (id, title, description, category, status, priority, target_week, created_by, weekly_output, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    id,
    body.title,
    body.description || null,
    body.category || null,
    status,
    body.priority || 3,
    body.target_week || null,
    body.created_by || null,
    0,
    now,
    now
  ).run();

  await logWorkflowAudit(env, 'content_topic', id, 'create', body.created_by || null, null, status, 'Topic created');

  return new Response(JSON.stringify(jsonSuccess({ id, status })), {
    status: 201,
    headers: { 'Content-Type': 'application/json' },
  });
}

// GET /api/admin/content/topics - List topics (选题列表)
export async function listTopics(env: Env, request: Request): Promise<Response> {
  const url = new URL(request.url);
  const status = url.searchParams.get('status') as WorkflowStatus | null;
  const { page, limit, offset } = parsePagination(url, 20);

  let query = 'SELECT * FROM content_topics WHERE 1=1';
  const bindings: (string | number)[] = [];

  if (status) {
    query += ' AND status = ?';
    bindings.push(status);
  }

  // Count query
  const countQuery = query.replace('SELECT *', 'SELECT COUNT(*) as total');
  const countResult = await env.DB.prepare(countQuery).bind(...bindings).first<{ total: number }>();
  const total = countResult?.total || 0;

  query += ' ORDER BY priority DESC, created_at DESC LIMIT ? OFFSET ?';
  bindings.push(limit, offset);

  const result = await env.DB.prepare(query).bind(...bindings).all<Record<string, unknown>>();
  const topics = (result.results || []).map(parseTopic);

  // Get product counts for each topic
  const topicsWithCounts = await Promise.all(topics.map(async (topic) => {
    const countResult = await env.DB.prepare(
      'SELECT COUNT(*) as count FROM topic_products WHERE topic_id = ?'
    ).bind(topic.id).first<{ count: number }>();

    return {
      ...topic,
      product_count: countResult?.count || 0,
    };
  }));

  return new Response(JSON.stringify(jsonSuccess(topicsWithCounts, { page, total })), {
    headers: { 'Content-Type': 'application/json' },
  });
}

// GET /api/admin/content/topics/:id - Get topic details (选题详情)
export async function getTopic(env: Env, request: Request, id: string): Promise<Response> {
  const result = await env.DB.prepare('SELECT * FROM content_topics WHERE id = ?').bind(id).first<Record<string, unknown>>();

  if (!result) {
    return new Response(JSON.stringify(jsonError(ErrorCodes.NOT_FOUND, 'Topic not found')), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const topic = parseTopic(result);

  // Get associated products
  const productsResult = await env.DB.prepare(`
    SELECT tp.*, p.original_title, p.title, p.category, p.price_min, p.price_max, p.images
    FROM topic_products tp
    INNER JOIN products p ON tp.product_id = p.id
    WHERE tp.topic_id = ?
    ORDER BY tp.position ASC
  `).bind(id).all<Record<string, unknown>>();

  const products = (productsResult.results || []).map((row) => {
    const tp = parseTopicProduct(row);
    return {
      ...tp,
      product: {
        id: (row as Record<string, unknown>).product_id,
        original_title: (row as Record<string, unknown>).original_title,
        title: (row as Record<string, unknown>).title,
        category: (row as Record<string, unknown>).category,
        price_min: (row as Record<string, unknown>).price_min,
        price_max: (row as Record<string, unknown>).price_max,
        images: parseJSON<string[]>((row as Record<string, unknown>).images as string || '[]', []),
      },
    };
  });

  return new Response(JSON.stringify(jsonSuccess({
    ...topic,
    products,
  })), {
    headers: { 'Content-Type': 'application/json' },
  });
}

// PATCH /api/admin/content/topics/:id - Update topic status (更新选题状态)
export async function updateTopicStatus(
  env: Env,
  request: Request,
  id: string
): Promise<Response> {
  const body = await request.json() as Partial<ContentTopic>;

  // Get current topic
  const current = await env.DB.prepare('SELECT * FROM content_topics WHERE id = ?').bind(id).first<Record<string, unknown>>();

  if (!current) {
    return new Response(JSON.stringify(jsonError(ErrorCodes.NOT_FOUND, 'Topic not found')), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const currentTopic = parseTopic(current);
  const now = new Date().toISOString();

  // Validate status transition
  const validTransitions: Record<WorkflowStatus, WorkflowStatus[]> = {
    'idea': ['in_review', 'archived'],
    'in_review': ['approved', 'idea', 'archived'],
    'approved': ['published', 'in_review', 'archived'],
    'published': ['archived'],
    'archived': ['idea'],
  };

  const newStatus = body.status as WorkflowStatus;
  if (newStatus && !validTransitions[currentTopic.status].includes(newStatus)) {
    return new Response(JSON.stringify(jsonError(
      ErrorCodes.INVALID_PARAMS,
      `Invalid status transition from '${currentTopic.status}' to '${newStatus}'`
    )), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Build update query
  const updates: string[] = ['updated_at = ?'];
  const bindings: (string | number | null)[] = [now];

  if (body.status) {
    updates.push('status = ?');
    bindings.push(body.status);

    // Set timestamps based on status
    if (body.status === 'approved') {
      updates.push('approved_at = ?');
      bindings.push(now);
    } else if (body.status === 'published') {
      updates.push('published_at = ?');
      bindings.push(now);
    } else if (body.status === 'archived') {
      updates.push('archived_at = ?');
      bindings.push(now);
    }
  }

  if (body.reviewed_by) {
    updates.push('reviewed_by = ?');
    bindings.push(body.reviewed_by);
  }

  if (body.review_notes !== undefined) {
    updates.push('review_notes = ?');
    bindings.push(body.review_notes);
  }

  if (body.priority !== undefined) {
    updates.push('priority = ?');
    bindings.push(body.priority);
  }

  // O-F030-03: Support scheduled publishing
  if (body.scheduled_publish_at !== undefined) {
    updates.push('scheduled_publish_at = ?');
    bindings.push(body.scheduled_publish_at);
  }

  bindings.push(id);

  await env.DB.prepare(`UPDATE content_topics SET ${updates.join(', ')} WHERE id = ?`).bind(...bindings).run();

  await logWorkflowAudit(
    env,
    'content_topic',
    id,
    'status_change',
    body.reviewed_by || null,
    currentTopic.status,
    newStatus || currentTopic.status,
    body.review_notes
  );

  return new Response(JSON.stringify(jsonSuccess({ id, status: newStatus || currentTopic.status })), {
    headers: { 'Content-Type': 'application/json' },
  });
}

// POST /api/admin/content/topics/:id/products - Add products to topic (为选题添加候选商品)
export async function addTopicProducts(
  env: Env,
  request: Request,
  id: string
): Promise<Response> {
  const body = await request.json() as {
    product_ids: string[];
    ai_scores?: Record<string, number>;
    ai_reasons?: Record<string, string>;
  };

  if (!body.product_ids || !Array.isArray(body.product_ids) || body.product_ids.length === 0) {
    return new Response(JSON.stringify(jsonError(ErrorCodes.INVALID_PARAMS, 'product_ids array is required')), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Verify topic exists
  const topic = await env.DB.prepare('SELECT * FROM content_topics WHERE id = ?').bind(id).first<Record<string, unknown>>();
  if (!topic) {
    return new Response(JSON.stringify(jsonError(ErrorCodes.NOT_FOUND, 'Topic not found')), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Get current max position
  const maxPos = await env.DB.prepare(
    'SELECT COALESCE(MAX(position), 0) as max_pos FROM topic_products WHERE topic_id = ?'
  ).bind(id).first<{ max_pos: number }>();

  const now = new Date().toISOString();
  let position = (maxPos?.max_pos || 0) + 1;
  const addedIds: string[] = [];

  // Insert products
  for (const productId of body.product_ids) {
    // Check if product exists
    const productExists = await env.DB.prepare('SELECT id FROM products WHERE id = ?').bind(productId).first();
    if (!productExists) continue;

    // Check if already associated
    const existing = await env.DB.prepare(
      'SELECT id FROM topic_products WHERE topic_id = ? AND product_id = ?'
    ).bind(id, productId).first();

    if (existing) continue;

    const tpId = crypto.randomUUID();
    await env.DB.prepare(`
      INSERT INTO topic_products (id, topic_id, product_id, position, ai_score, ai_reason, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      tpId,
      id,
      productId,
      position,
      body.ai_scores?.[productId] || null,
      body.ai_reasons?.[productId] || null,
      now,
      now
    ).run();

    addedIds.push(tpId);
    position++;
  }

  return new Response(JSON.stringify(jsonSuccess({
    added_count: addedIds.length,
    added_ids: addedIds,
  })), {
    status: 201,
    headers: { 'Content-Type': 'application/json' },
  });
}

// POST /api/admin/content/publish - Publish content (发布内容)
export async function publishContent(env: Env, request: Request): Promise<Response> {
  const body = await request.json() as {
    topic_id: string;
    title: string;
    slug: string;
    description?: string;
    why_these?: string;
    cover_image?: string;
    category?: string;
    product_ids?: string[];
    content_type?: string; // 'organic' | 'affiliate' | 'sponsored'
    disclosure?: string; // Required for affiliate/sponsored content
  };

  if (!body.topic_id || !body.title || !body.slug) {
    return new Response(JSON.stringify(jsonError(ErrorCodes.INVALID_PARAMS, 'topic_id, title, and slug are required')), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const result = await executePublish(env, {
      topic_id: body.topic_id,
      title: body.title,
      slug: body.slug,
      description: body.description || null,
      why_these: body.why_these || null,
      cover_image: body.cover_image || null,
      category: body.category || null,
      product_ids: body.product_ids,
      content_type: body.content_type || 'organic',
      disclosure: body.disclosure || null,
      action: 'publish',
      actor: null
    });
    return new Response(JSON.stringify(jsonSuccess({
      list_id: result.list_id,
      topic_id: body.topic_id,
      products_published: result.products_published,
    })), {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Publish failed';
    const status = message === 'Topic not found' ? 404 : 400;
    return new Response(JSON.stringify(jsonError(
      status === 404 ? ErrorCodes.NOT_FOUND : ErrorCodes.INVALID_PARAMS,
      message
    )), {
      status,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

// GET /api/admin/content/publish/schedule - Get publish schedule (发布排期)
export async function getPublishSchedule(env: Env, request: Request): Promise<Response> {
  const url = new URL(request.url);
  const weeks = parseInt(url.searchParams.get('weeks') || '4');

  // Get topics that are approved or in_review (schedulable)
  const scheduleResult = await env.DB.prepare(`
    SELECT ct.*,
           (SELECT COUNT(*) FROM topic_products WHERE topic_id = ct.id) as product_count,
           (SELECT COUNT(*) FROM topic_products WHERE topic_id = ct.id AND is_selected = 1) as selected_count
    FROM content_topics ct
    WHERE ct.status IN ('approved', 'in_review')
    ORDER BY ct.priority DESC, ct.target_week ASC, ct.created_at ASC
    LIMIT ?
  `).bind(weeks * 5).all<Record<string, unknown>>();

  // Get weekly output stats
  const weekStart = getWeekStart(new Date());
  const weekEnd = getWeekEnd(new Date());

  const statsResult = await env.DB.prepare(`
    SELECT
      COUNT(CASE WHEN status = 'published' THEN 1 END) as published_count,
      SUM(products_published) as total_products
    FROM content_production
    WHERE week_start >= ? AND week_end <= ?
  `).bind(weekStart, weekEnd).first<{ published_count: number; total_products: number }>();

  return new Response(JSON.stringify(jsonSuccess({
    schedule: (scheduleResult.results || []).map(row => ({
      ...parseTopic(row as Record<string, unknown>),
      product_count: (row as Record<string, unknown>).product_count,
      selected_count: (row as Record<string, unknown>).selected_count,
    })),
    weekly_stats: {
      week_start: weekStart,
      week_end: weekEnd,
      lists_published: statsResult?.published_count || 0,
      products_published: statsResult?.total_products || 0,
    },
  })), {
    headers: { 'Content-Type': 'application/json' },
  });
}

// GET /api/admin/content/production/stats - Get production statistics
export async function getProductionStats(env: Env, request: Request): Promise<Response> {
  const url = new URL(request.url);
  const weeks = parseInt(url.searchParams.get('weeks') || '8');

  // Get weekly production data
  const weeklyResult = await env.DB.prepare(`
    SELECT
      week_start,
      week_end,
      COUNT(CASE WHEN status = 'published' THEN 1 END) as lists_published,
      SUM(products_published) as products_published,
      COUNT(CASE WHEN review_completed = 1 THEN 1 END) as reviews_completed
    FROM content_production
    WHERE week_start >= date('now', '-' || ? || ' days')
    GROUP BY week_start
    ORDER BY week_start DESC
  `).bind(weeks * 7).all<Record<string, unknown>>();

  // Calculate averages
  const totals = await env.DB.prepare(`
    SELECT
      COUNT(*) as total_lists,
      SUM(products_published) as total_products,
      AVG(products_published) as avg_products_per_list
    FROM content_production
    WHERE week_start >= date('now', '-' || ? || ' days')
  `).bind(weeks * 7).first<{ total_lists: number; total_products: number; avg_products_per_list: number }>();

  // O-F030-08: TOP3/BOTTOM3 automation for weekly review
  const topBottomResult = await env.DB.prepare(`
    SELECT
      cp.topic_id,
      ct.title as topic_title,
      ct.status,
      SUM(cp.products_published) as total_products,
      COUNT(*) as version_count,
      MAX(cp.published_at) as last_published
    FROM content_production cp
    INNER JOIN content_topics ct ON cp.topic_id = ct.id
    WHERE cp.week_start >= date('now', '-' || ? || ' days') AND cp.status = 'published'
    GROUP BY cp.topic_id
    ORDER BY total_products DESC
  `).bind(weeks * 7).all<Record<string, unknown>>();

  const top3 = (topBottomResult.results || []).slice(0, 3);
  const bottom3 = (topBottomResult.results || []).slice(-3).reverse();

  return new Response(JSON.stringify(jsonSuccess({
    weekly_data: weeklyResult.results || [],
    totals: {
      weeks,
      total_lists: totals?.total_lists || 0,
      total_products: totals?.total_products || 0,
      avg_products_per_list: Math.round((totals?.avg_products_per_list || 0) * 10) / 10,
    },
    // O-F030-08: TOP3/BOTTOM3 for weekly review automation
    top3_performers: top3.map((r: Record<string, unknown>) => ({
      topic_id: r.topic_id,
      topic_title: r.topic_title,
      total_products: r.total_products,
      version_count: r.version_count,
      last_published: r.last_published,
    })),
    bottom3_performers: bottom3.map((r: Record<string, unknown>) => ({
      topic_id: r.topic_id,
      topic_title: r.topic_title,
      total_products: r.total_products,
      version_count: r.version_count,
      last_published: r.last_published,
    })),
  })), {
    headers: { 'Content-Type': 'application/json' },
  });
}

// Helper functions for week calculations
function getWeekStart(date: Date): string {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d.toISOString().split('T')[0];
}

function getWeekEnd(date: Date): string {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? 0 : 7);
  d.setDate(diff);
  d.setHours(23, 59, 59, 999);
  return d.toISOString().split('T')[0];
}

// O-F030-07: Cron handler for weekly scheduled publishing
// Triggered every Thursday at 9am UTC via wrangler.toml cron trigger
export async function handleScheduledPublishing(env: Env): Promise<{ published: number; errors: string[] }> {
  const now = new Date();
  const errors: string[] = [];
  let published = 0;

  // Find topics with scheduled_publish_at <= now that are in 'approved' status
  const scheduledTopics = await env.DB.prepare(`
    SELECT id, title, description, category, target_week
    FROM content_topics
    WHERE status = 'approved'
      AND scheduled_publish_at IS NOT NULL
      AND scheduled_publish_at <= ?
    ORDER BY priority DESC, scheduled_publish_at ASC
  `).bind(now.toISOString()).all<Record<string, unknown>>();

  for (const row of scheduledTopics.results || []) {
    const topicId = row.id as string;
    const topicTitle = row.title as string;
    const topicDescription = (row as Record<string, unknown>).description as string | null;
    const topicCategory = (row as Record<string, unknown>).category as string | null;

    try {
      const slug = `${topicTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')}-${topicId.slice(0, 8)}`;
      await executePublish(env, {
        topic_id: topicId,
        title: topicTitle,
        slug,
        description: topicDescription,
        category: topicCategory,
        content_type: 'organic',
        action: 'scheduled_publish',
        actor: 'cron'
      });

      published++;
    } catch (err) {
      errors.push(`Failed to publish topic ${topicId} (${topicTitle}): ${err}`);
    }
  }

  return { published, errors };
}
