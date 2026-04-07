// Analytics API - F-017
import { Env } from '../db/schema';
import { jsonSuccess } from '../lib/response';

// GET /api/admin/analytics/overview
export async function getAnalyticsOverview(env: Env): Promise<Response> {
  const today = new Date().toISOString().split('T')[0];
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  const [dailyUV, weeklyUV, totalSubscribers, totalProducts, totalClicksToday, topCategories] = await Promise.all([
    // daily_uv: COUNT DISTINCT anonymous_id || user_id from clicks today
    env.DB.prepare(`
      SELECT COUNT(DISTINCT anonymous_id || COALESCE(user_id, '')) as uv
      FROM clicks
      WHERE DATE(clicked_at) = CURRENT_DATE
    `).first<{ uv: number }>(),

    // weekly_uv: COUNT DISTINCT from last 7 days
    env.DB.prepare(`
      SELECT COUNT(DISTINCT anonymous_id || COALESCE(user_id, '')) as uv
      FROM clicks
      WHERE DATE(clicked_at) >= DATE('now', '-7 days')
    `).first<{ uv: number }>(),

    // total_subscribers: COUNT from users where status = active
    env.DB.prepare(`
      SELECT COUNT(*) as count FROM users WHERE status = 'active'
    `).first<{ count: number }>(),

    // total_products: COUNT from products where status = active
    env.DB.prepare(`
      SELECT COUNT(*) as count FROM products WHERE status = 'active'
    `).first<{ count: number }>(),

    // total_clicks_today
    env.DB.prepare(`
      SELECT COUNT(*) as count FROM clicks WHERE DATE(clicked_at) = CURRENT_DATE
    `).first<{ count: number }>(),

    // top_categories: top 5 by click count last 7 days
    env.DB.prepare(`
      SELECT p.category, COUNT(c.id) as click_count
      FROM clicks c
      JOIN products p ON c.product_id = p.id
      WHERE DATE(c.clicked_at) >= DATE('now', '-7 days')
      GROUP BY p.category
      ORDER BY click_count DESC
      LIMIT 5
    `).all<{ category: string; click_count: number }>(),
  ]);

  return new Response(JSON.stringify(jsonSuccess({
    daily_uv: dailyUV?.uv ?? 0,
    weekly_uv: weeklyUV?.uv ?? 0,
    total_subscribers: totalSubscribers?.count ?? 0,
    total_products: totalProducts?.count ?? 0,
    total_clicks_today: totalClicksToday?.count ?? 0,
    top_categories: topCategories.results ?? [],
  })), {
    headers: { 'Content-Type': 'application/json' },
  });
}

// GET /api/admin/analytics/uv?period=daily|weekly|monthly
export async function getAnalyticsUV(env: Env, request: Request): Promise<Response> {
  const url = new URL(request.url);
  const period = url.searchParams.get('period') || 'daily';

  let result: { date: string; uv: number }[] = [];

  if (period === 'daily') {
    const row = await env.DB.prepare(`
      SELECT COUNT(DISTINCT anonymous_id || COALESCE(user_id, '')) as uv
      FROM clicks
      WHERE DATE(clicked_at) = CURRENT_DATE
    `).first<{ uv: number }>();
    result = [{ date: new Date().toISOString().split('T')[0], uv: row?.uv ?? 0 }];
  } else if (period === 'weekly') {
    const rows = await env.DB.prepare(`
      SELECT DATE(clicked_at) as date, COUNT(DISTINCT anonymous_id || COALESCE(user_id, '')) as uv
      FROM clicks
      WHERE DATE(clicked_at) >= DATE('now', '-7 days')
      GROUP BY DATE(clicked_at)
      ORDER BY date ASC
    `).all<{ date: string; uv: number }>();
    result = rows.results ?? [];
  } else if (period === 'monthly') {
    const rows = await env.DB.prepare(`
      SELECT DATE(clicked_at) as date, COUNT(DISTINCT anonymous_id || COALESCE(user_id, '')) as uv
      FROM clicks
      WHERE DATE(clicked_at) >= DATE('now', '-30 days')
      GROUP BY DATE(clicked_at)
      ORDER BY date ASC
    `).all<{ date: string; uv: number }>();
    result = rows.results ?? [];
  }

  return new Response(JSON.stringify(jsonSuccess(result)), {
    headers: { 'Content-Type': 'application/json' },
  });
}

// GET /api/admin/analytics/ctr
export async function getAnalyticsCTR(env: Env): Promise<Response> {
  const [productPV, homePV, ctaClicks] = await Promise.all([
    // product_page_pv: clicks with source = product (last 7 days)
    env.DB.prepare(`
      SELECT COUNT(*) as count FROM clicks
      WHERE source = 'product' AND DATE(clicked_at) >= DATE('now', '-7 days')
    `).first<{ count: number }>(),

    // homepage_pv: clicks with source = home (last 7 days)
    env.DB.prepare(`
      SELECT COUNT(*) as count FROM clicks
      WHERE source = 'home' AND DATE(clicked_at) >= DATE('now', '-7 days')
    `).first<{ count: number }>(),

    // cta_click_count: clicks to affiliate (last 7 days) - source = 'cta' or 'affiliate'
    env.DB.prepare(`
      SELECT COUNT(*) as count FROM clicks
      WHERE (source = 'cta' OR source = 'affiliate') AND DATE(clicked_at) >= DATE('now', '-7 days')
    `).first<{ count: number }>(),
  ]);

  const productPagePV = productPV?.count ?? 0;
  const homepagePV = homePV?.count ?? 0;
  const ctaClickCount = ctaClicks?.count ?? 0;
  const pageCTR = homepagePV > 0 ? (productPagePV / homepagePV) * 100 : 0;
  const ctaCTR = productPagePV > 0 ? (ctaClickCount / productPagePV) * 100 : 0;

  return new Response(JSON.stringify(jsonSuccess({
    product_page_pv: productPagePV,
    homepage_pv: homepagePV,
    page_ctr: Math.round(pageCTR * 100) / 100,
    cta_click_count: ctaClickCount,
    cta_ctr: Math.round(ctaCTR * 100) / 100,
  })), {
    headers: { 'Content-Type': 'application/json' },
  });
}

// GET /api/admin/analytics/conversion
export async function getAnalyticsConversion(env: Env): Promise<Response> {
  const [favoritesResult, uniqueVisitors, returnVisitors, totalVisitors] = await Promise.all([
    // favorites_added: count via saved_items changes in users (last 7 days)
    // We approximate by counting favorites operations - since we don't have a dedicated table,
    // we estimate by checking users with saved_items updated in last 7 days
    env.DB.prepare(`
      SELECT COUNT(*) as count FROM users
      WHERE status = 'active' AND saved_items != '[]'
    `).first<{ count: number }>(),

    // unique_product_visitors: distinct anonymous_id || user_id with clicks to product source
    env.DB.prepare(`
      SELECT COUNT(DISTINCT anonymous_id || COALESCE(user_id, '')) as count
      FROM clicks
      WHERE source = 'product' AND DATE(clicked_at) >= DATE('now', '-7 days')
    `).first<{ count: number }>(),

    // return_visitors: anonymous_id with >1 distinct day of clicks in last 7 days
    env.DB.prepare(`
      SELECT COUNT(*) as count FROM (
        SELECT anonymous_id
        FROM clicks
        WHERE DATE(clicked_at) >= DATE('now', '-7 days') AND anonymous_id IS NOT NULL
        GROUP BY anonymous_id
        HAVING COUNT(DISTINCT DATE(clicked_at)) > 1
      )
    `).first<{ count: number }>(),

    // total_visitors: total distinct anonymous_id || user_id in last 7 days
    env.DB.prepare(`
      SELECT COUNT(DISTINCT anonymous_id || COALESCE(user_id, '')) as count
      FROM clicks
      WHERE DATE(clicked_at) >= DATE('now', '-7 days')
    `).first<{ count: number }>(),
  ]);

  const favoritesAdded = favoritesResult?.count ?? 0;
  const uniqueProductVisitors = uniqueVisitors?.count ?? 0;
  const returnVisitorsCount = returnVisitors?.count ?? 0;
  const totalVisitorsCount = totalVisitors?.count ?? 0;

  const favoritesRate = uniqueProductVisitors > 0 ? (favoritesAdded / uniqueProductVisitors) * 100 : 0;
  const returnRate = totalVisitorsCount > 0 ? (returnVisitorsCount / totalVisitorsCount) * 100 : 0;

  return new Response(JSON.stringify(jsonSuccess({
    favorites_added: favoritesAdded,
    favorites_rate: Math.round(favoritesRate * 100) / 100,
    return_visitors: returnVisitorsCount,
    return_rate: Math.round(returnRate * 100) / 100,
  })), {
    headers: { 'Content-Type': 'application/json' },
  });
}

// GET /api/admin/analytics/categories
export async function getAnalyticsCategories(env: Env): Promise<Response> {
  const rows = await env.DB.prepare(`
    SELECT
      p.category,
      COUNT(DISTINCT c.anonymous_id || COALESCE(c.user_id, '')) as uv,
      COUNT(c.id) as clicks,
      SUM(CASE WHEN c.source = 'cta' OR c.source = 'affiliate' THEN 1 ELSE 0 END) as cta_clicks,
      0 as favorites_added,
      0 as avg_position
    FROM clicks c
    JOIN products p ON c.product_id = p.id
    WHERE DATE(c.clicked_at) >= DATE('now', '-7 days')
    GROUP BY p.category
    ORDER BY clicks DESC
  `).all<{
    category: string;
    uv: number;
    clicks: number;
    cta_clicks: number;
    favorites_added: number;
    avg_position: number;
  }>();

  return new Response(JSON.stringify(jsonSuccess(rows.results ?? [])), {
    headers: { 'Content-Type': 'application/json' },
  });
}

// GET /api/admin/analytics/lists
export async function getAnalyticsLists(env: Env): Promise<Response> {
  const rows = await env.DB.prepare(`
    SELECT
      l.id as list_id,
      l.title,
      l.slug,
      COUNT(c.id) as views,
      0 as avg_time_on_page,
      SUM(CASE WHEN c.source = 'cta' OR c.source = 'affiliate' THEN 1 ELSE 0 END) as cta_clicks
    FROM lists l
    LEFT JOIN clicks c ON l.id = c.source AND c.source = 'list'
    WHERE l.status = 'active'
    GROUP BY l.id, l.title, l.slug
    ORDER BY views DESC
  `).all<{
    list_id: string;
    title: string;
    slug: string;
    views: number;
    avg_time_on_page: number;
    cta_clicks: number;
  }>();

  return new Response(JSON.stringify(jsonSuccess(rows.results ?? [])), {
    headers: { 'Content-Type': 'application/json' },
  });
}

// GET /api/admin/analytics/trends?days=7|30
export async function getAnalyticsTrends(env: Env, request: Request): Promise<Response> {
  const url = new URL(request.url);
  const days = parseInt(url.searchParams.get('days') || '7');

  const rows = await env.DB.prepare(`
    SELECT
      DATE(c.clicked_at) as date,
      COUNT(DISTINCT c.anonymous_id || COALESCE(c.user_id, '')) as uv,
      COUNT(c.id) as clicks,
      SUM(CASE WHEN c.source = 'cta' OR c.source = 'affiliate' THEN 1 ELSE 0 END) as cta_clicks,
      0 as favorites_added,
      0 as new_subscribers
    FROM clicks c
    WHERE DATE(c.clicked_at) >= DATE('now', ? || ' days')
    GROUP BY DATE(c.clicked_at)
    ORDER BY date ASC
  `).bind(days.toString()).all<{
    date: string;
    uv: number;
    clicks: number;
    cta_clicks: number;
    favorites_added: number;
    new_subscribers: number;
  }>();

  return new Response(JSON.stringify(jsonSuccess(rows.results ?? [])), {
    headers: { 'Content-Type': 'application/json' },
  });
}
