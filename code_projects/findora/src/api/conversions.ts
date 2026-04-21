// Conversions API - F-012-05
// Records conversion callbacks from affiliate networks (e.g., af_convert, AppsFlyer, etc.)
// Conversion data is logged for analytics and commission tracking
import { Env } from '../db/schema';
import { jsonSuccess, jsonError } from '../lib/response';
import { ErrorCodes } from '../lib/errors';

// Create conversions table if not exists
async function ensureConversionsTable(env: Env): Promise<void> {
  await env.DB.prepare(`
    CREATE TABLE IF NOT EXISTS conversions (
      id TEXT PRIMARY KEY,
      click_id TEXT,
      product_id TEXT,
      user_id TEXT,
      anonymous_id TEXT,
      event_type TEXT NOT NULL,
      event_data TEXT,
      revenue REAL,
      currency TEXT DEFAULT 'USD',
      partner TEXT,
      partner_event_id TEXT,
      reported_at TEXT,
      received_at TEXT NOT NULL,
      status TEXT DEFAULT 'pending',
      FOREIGN KEY (product_id) REFERENCES products(id)
    )
  `).run();

  // Create indexes
  await env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_conversions_click_id ON conversions(click_id)`).run();
  await env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_conversions_product_id ON conversions(product_id)`).run();
  await env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_conversions_status ON conversions(status)`).run();
  await env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_conversions_reported_at ON conversions(reported_at)`).run();
}

// POST /api/conversions/callback - F-012-05
// Handles conversion callbacks from affiliate networks
export async function recordConversion(env: Env, request: Request): Promise<Response> {
  try {
    // Ensure conversions table exists
    await ensureConversionsTable(env);

    const body = await request.json() as {
      click_id?: string;
      product_id?: string;
      user_id?: string;
      anonymous_id?: string;
      event_type: string;
      event_data?: Record<string, unknown>;
      revenue?: number;
      currency?: string;
      partner?: string;
      partner_event_id?: string;
      reported_at?: string;
    };

    if (!body.event_type) {
      return new Response(JSON.stringify(jsonError(ErrorCodes.INVALID_PARAMS, 'event_type is required')), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Validate event_type
    const validEventTypes = ['install', 'signup', 'purchase', 'subscription', 'lead', 'custom'];
    if (!validEventTypes.includes(body.event_type)) {
      return new Response(JSON.stringify(jsonError(ErrorCodes.INVALID_PARAMS, `event_type must be one of: ${validEventTypes.join(', ')}`)), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const id = crypto.randomUUID();
    const received_at = new Date().toISOString();

    // Determine status based on event type
    let status = 'pending';
    if (body.event_type === 'purchase' || body.event_type === 'subscription') {
      status = 'confirmed';
    }

    // Store conversion
    await env.DB.prepare(`
      INSERT INTO conversions (id, click_id, product_id, user_id, anonymous_id, event_type, event_data, revenue, currency, partner, partner_event_id, reported_at, received_at, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      id,
      body.click_id || null,
      body.product_id || null,
      body.user_id || null,
      body.anonymous_id || null,
      body.event_type,
      body.event_data ? JSON.stringify(body.event_data) : null,
      body.revenue || null,
      body.currency || 'USD',
      body.partner || null,
      body.partner_event_id || null,
      body.reported_at || null,
      received_at,
      status
    ).run();

    return new Response(JSON.stringify(jsonSuccess({
      id,
      status: 'recorded',
      received_at
    })), {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('Conversion callback error:', err);
    return new Response(JSON.stringify(jsonError(ErrorCodes.INTERNAL_ERROR, 'Failed to record conversion')), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

// GET /api/conversions - Admin endpoint to view conversion data
export async function listConversions(env: Env, request: Request): Promise<Response> {
  const url = new URL(request.url);
  const status = url.searchParams.get('status');
  const product_id = url.searchParams.get('product_id');
  const partner = url.searchParams.get('partner');
  const start_date = url.searchParams.get('start_date');
  const end_date = url.searchParams.get('end_date');
  const page = Math.max(1, parseInt(url.searchParams.get('page') || '1'));
  const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') || '50')));
  const offset = (page - 1) * limit;

  let where = 'WHERE 1=1';
  const bindings: (string | number)[] = [];

  if (status) {
    where += ' AND status = ?';
    bindings.push(status);
  }

  if (product_id) {
    where += ' AND product_id = ?';
    bindings.push(product_id);
  }

  if (partner) {
    where += ' AND partner = ?';
    bindings.push(partner);
  }

  if (start_date) {
    where += ' AND reported_at >= ?';
    bindings.push(start_date);
  }

  if (end_date) {
    where += ' AND reported_at <= ?';
    bindings.push(end_date);
  }

  const countRow = await env.DB.prepare(`SELECT COUNT(*) as total FROM conversions ${where}`).bind(...bindings).first<{ total: number }>();
  const total = countRow?.total ?? 0;

  const rows = await env.DB.prepare(`
    SELECT c.*, p.title as product_title
    FROM conversions c
    LEFT JOIN products p ON c.product_id = p.id
    ${where}
    ORDER BY c.received_at DESC
    LIMIT ? OFFSET ?
  `).bind(...bindings, limit, offset).all<Record<string, unknown>>();

  // Calculate summary stats
  const statsRow = await env.DB.prepare(`
    SELECT
      COUNT(*) as total_count,
      SUM(CASE WHEN status = 'confirmed' THEN 1 ELSE 0 END) as confirmed_count,
      SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending_count,
      SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) as rejected_count,
      SUM(CASE WHEN status = 'confirmed' THEN COALESCE(revenue, 0) ELSE 0 END) as total_revenue
    FROM conversions c
    ${where}
  `).bind(...bindings).first<{
    total_count: number;
    confirmed_count: number;
    pending_count: number;
    rejected_count: number;
    total_revenue: number;
  }>();

  return new Response(JSON.stringify(jsonSuccess({
    conversions: rows.results || [],
    stats: {
      total: statsRow?.total_count || 0,
      confirmed: statsRow?.confirmed_count || 0,
      pending: statsRow?.pending_count || 0,
      rejected: statsRow?.rejected_count || 0,
      revenue: statsRow?.total_revenue || 0,
    }
  }, { page, total, limit })), {
    headers: { 'Content-Type': 'application/json' },
  });
}

// GET /api/conversions/stats - Conversion analytics summary
export async function getConversionStats(env: Env, request: Request): Promise<Response> {
  const url = new URL(request.url);
  const days = Math.min(90, Math.max(1, parseInt(url.searchParams.get('days') || '30')));

  // Get conversion stats by event type
  const byEventType = await env.DB.prepare(`
    SELECT
      event_type,
      COUNT(*) as count,
      SUM(CASE WHEN status = 'confirmed' THEN 1 ELSE 0 END) as confirmed,
      SUM(CASE WHEN status = 'confirmed' THEN COALESCE(revenue, 0) ELSE 0 END) as revenue
    FROM conversions
    WHERE received_at >= datetime('now', '-' || ? || ' days')
    GROUP BY event_type
  `).bind(days).all<Record<string, unknown>>();

  // Get conversion stats by partner
  const byPartner = await env.DB.prepare(`
    SELECT
      partner,
      COUNT(*) as count,
      SUM(CASE WHEN status = 'confirmed' THEN 1 ELSE 0 END) as confirmed,
      SUM(CASE WHEN status = 'confirmed' THEN COALESCE(revenue, 0) ELSE 0 END) as revenue
    FROM conversions
    WHERE received_at >= datetime('now', '-' || ? || ' days')
      AND partner IS NOT NULL
    GROUP BY partner
  `).bind(days).all<Record<string, unknown>>();

  // Get daily conversion trend
  const dailyTrend = await env.DB.prepare(`
    SELECT
      date(received_at) as date,
      COUNT(*) as total,
      SUM(CASE WHEN status = 'confirmed' THEN 1 ELSE 0 END) as confirmed,
      SUM(CASE WHEN status = 'confirmed' THEN COALESCE(revenue, 0) ELSE 0 END) as revenue
    FROM conversions
    WHERE received_at >= datetime('now', '-' || ? || ' days')
    GROUP BY date(received_at)
    ORDER BY date ASC
  `).bind(days).all<Record<string, unknown>>();

  return new Response(JSON.stringify(jsonSuccess({
    period_days: days,
    by_event_type: byEventType.results || [],
    by_partner: byPartner.results || [],
    daily_trend: dailyTrend.results || [],
  })), {
    headers: { 'Content-Type': 'application/json' },
  });
}
