// Admin Subscribers API - F-013-06, F-013-08, F-013-09
import { Env, User } from '../../db/schema';
import { jsonSuccess, jsonError, parseJSON } from '../../lib/response';
import { ErrorCodes } from '../../lib/errors';
import { parsePagination } from '../../lib/constants';

function parseUser(row: Record<string, unknown>) {
  const u = row as unknown as User;
  return {
    ...u,
    subscribed_categories: parseJSON<string[]>(u.subscribed_categories || '[]', []),
    liked_tags: parseJSON<string[]>(u.liked_tags || '[]', []),
    disliked_tags: parseJSON<string[]>(u.disliked_tags || '[]', []),
    click_history: parseJSON<string[]>(u.click_history || '[]', []),
    saved_items: parseJSON<string[]>(u.saved_items || '[]', []),
  };
}

// GET /api/admin/subscribers/segments - F-013-06
// User segmentation based on subscription preferences
export async function getSubscriberSegments(env: Env, request: Request): Promise<Response> {
  const url = new URL(request.url);

  // Segment by subscribed_categories
  const byCategory = await env.DB.prepare(`
    SELECT
      t.name as category_name,
      t.slug as category_slug,
      COUNT(*) as subscriber_count,
      SUM(CASE WHEN u.status = 'active' THEN 1 ELSE 0 END) as active_count,
      SUM(CASE WHEN u.status = 'unsubscribed' THEN 1 ELSE 0 END) as unsubscribed_count,
      SUM(CASE WHEN u.status = 'dormant' THEN 1 ELSE 0 END) as dormant_count
    FROM users u, json_each(u.subscribed_categories) as cat
    LEFT JOIN tags t ON t.slug = cat.value
    GROUP BY cat.value
    ORDER BY subscriber_count DESC
  `).all<Record<string, unknown>>();

  // Segment by price_preference
  const byPricePreference = await env.DB.prepare(`
    SELECT
      COALESCE(price_preference, 'not_set') as price_preference,
      COUNT(*) as subscriber_count,
      SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active_count
    FROM users
    GROUP BY price_preference
    ORDER BY subscriber_count DESC
  `).all<Record<string, unknown>>();

  // Segment by frequency_preference
  const byFrequency = await env.DB.prepare(`
    SELECT
      COALESCE(frequency_preference, 'not_set') as frequency_preference,
      COUNT(*) as subscriber_count,
      SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active_count
    FROM users
    GROUP BY frequency_preference
    ORDER BY subscriber_count DESC
  `).all<Record<string, unknown>>();

  // Segment by activity (has click_history vs no click_history)
  const byActivity = await env.DB.prepare(`
    SELECT
      CASE
        WHEN click_history = '[]' OR click_history IS NULL THEN 'inactive'
        ELSE 'active'
      END as activity_status,
      COUNT(*) as subscriber_count
    FROM users
    GROUP BY activity_status
  `).all<Record<string, unknown>>();

  // Segment by engagement level (based on click history length)
  const byEngagement = await env.DB.prepare(`
    SELECT
      CASE
        WHEN click_history = '[]' OR click_history IS NULL THEN 'none'
        WHEN json_array_length(click_history) <= 5 THEN 'low'
        WHEN json_array_length(click_history) <= 15 THEN 'medium'
        ELSE 'high'
      END as engagement_level,
      COUNT(*) as subscriber_count,
      SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active_count
    FROM users
    GROUP BY engagement_level
    ORDER BY
      CASE engagement_level
        WHEN 'high' THEN 4
        WHEN 'medium' THEN 3
        WHEN 'low' THEN 2
        ELSE 1
      END DESC
  `).all<Record<string, unknown>>();

  // Segment by locale
  const byLocale = await env.DB.prepare(`
    SELECT
      COALESCE(locale, 'unknown') as locale,
      COUNT(*) as subscriber_count,
      SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active_count
    FROM users
    GROUP BY locale
    ORDER BY subscriber_count DESC
    LIMIT 20
  `).all<Record<string, unknown>>();

  // Top tags across all users (from liked_tags)
  const topTags = await env.DB.prepare(`
    SELECT
      je.value as tag_slug,
      COUNT(*) as user_count
    FROM users u, json_each(u.liked_tags) as je
    WHERE u.status = 'active' AND u.liked_tags != '[]'
    GROUP BY je.value
    ORDER BY user_count DESC
    LIMIT 20
  `).all<Record<string, unknown>>();

  // Overall summary
  const summary = await env.DB.prepare(`
    SELECT
      COUNT(*) as total_subscribers,
      SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active_subscribers,
      SUM(CASE WHEN status = 'unsubscribed' THEN 1 ELSE 0 END) as unsubscribed,
      SUM(CASE WHEN status = 'dormant' THEN 1 ELSE 0 END) as dormant,
      SUM(CASE WHEN subscribed_at >= datetime('now', '-7 days') THEN 1 ELSE 0 END) as new_this_week,
      SUM(CASE WHEN subscribed_at >= datetime('now', '-30 days') THEN 1 ELSE 0 END) as new_this_month
    FROM users
  `).first<Record<string, unknown>>();

  return new Response(JSON.stringify(jsonSuccess({
    summary,
    segments: {
      by_category: byCategory.results || [],
      by_price_preference: byPricePreference.results || [],
      by_frequency: byFrequency.results || [],
      by_activity: byActivity.results || [],
      by_engagement: byEngagement.results || [],
      by_locale: byLocale.results || [],
      top_tags: topTags.results || [],
    }
  })), {
    headers: { 'Content-Type': 'application/json' },
  });
}

// GET /api/admin/subscribers - F-013-08
export async function listSubscribers(env: Env, request: Request): Promise<Response> {
  const url = new URL(request.url);
  const status = url.searchParams.get('status');
  const category = url.searchParams.get('category');
  const { page, limit, offset } = parsePagination(url, 50);

  let where = 'WHERE 1=1';
  const bindings: (string | number)[] = [];

  if (status) {
    where += ' AND status = ?';
    bindings.push(status);
  }

  if (category) {
    where += ` AND subscribed_categories LIKE ?`;
    bindings.push(`%"${category}"%`);
  }

  const countRow = await env.DB.prepare(`SELECT COUNT(*) as total FROM users ${where}`).bind(...bindings).first<{ total: number }>();
  const total = countRow?.total ?? 0;

  const rows = await env.DB.prepare(`
    SELECT * FROM users ${where}
    ORDER BY created_at DESC
    LIMIT ? OFFSET ?
  `).bind(...bindings, limit, offset).all<Record<string, unknown>>();

  const data = (rows.results || []).map(parseUser);

  return new Response(JSON.stringify(jsonSuccess(data, { page, total, limit })), {
    headers: { 'Content-Type': 'application/json' },
  });
}

// GET /api/admin/subscribers/export - F-013-09
export async function exportSubscribers(env: Env, request: Request): Promise<Response> {
  const url = new URL(request.url);
  const category = url.searchParams.get('category');
  const status = url.searchParams.get('status');
  const fmt = url.searchParams.get('format') || 'csv';

  let where = 'WHERE 1=1';
  const bindings: string[] = [];

  if (status) {
    where += ' AND status = ?';
    bindings.push(status);
  }

  if (category) {
    where += ` AND subscribed_categories LIKE ?`;
    bindings.push(`%"${category}"%`);
  }

  const rows = await env.DB.prepare(`
    SELECT email, subscribed_categories, status, subscribed_at, frequency_preference
    FROM users ${where}
    ORDER BY created_at DESC
    LIMIT 10000
  `).bind(...bindings).all<Record<string, unknown>>();

  if (fmt === 'json') {
    return new Response(JSON.stringify(jsonSuccess(rows.results ?? [])), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // CSV export
  const header = 'email,subscribed_categories,status,subscribed_at,frequency_preference\n';
  const csv = (rows.results ?? []).map((r: Record<string, unknown>) => {
    const cats = parseJSON<string[]>(r.subscribed_categories as string || '[]', []);
    const email = String(r.email || '').replace(/"/g, '""');
    return [
      email,
      `"${cats.join(',')}"`,
      String(r.status || ''),
      String(r.subscribed_at || ''),
      String(r.frequency_preference || ''),
    ].join(',');
  }).join('\n');

  const filename = `subscribers_${new Date().toISOString().split('T')[0]}.csv`;
  return new Response(header + csv, {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
}
