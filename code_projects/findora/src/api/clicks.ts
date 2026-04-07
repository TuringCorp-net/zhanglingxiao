// Clicks API - F-040-12 + F-012-03 + F-012-04
import { Env } from '../db/schema';
import { jsonSuccess, jsonError } from '../lib/response';
import { ErrorCodes } from '../lib/errors';

// POST /api/clicks - F-040-12
export async function recordClick(env: Env, request: Request): Promise<Response> {
  const body = await request.json() as {
    product_id: string;
    user_id?: string;
    anonymous_id?: string;
    source?: string;
    utm_source?: string;
    utm_medium?: string;
    utm_campaign?: string;
    referer?: string;
  };

  if (!body.product_id) {
    return new Response(JSON.stringify(jsonError(ErrorCodes.INVALID_PARAMS, 'product_id is required')), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Check product exists
  const product = await env.DB.prepare('SELECT id FROM products WHERE id = ?').bind(body.product_id).first();
  if (!product) {
    return new Response(JSON.stringify(jsonError(ErrorCodes.NOT_FOUND, 'Product not found')), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const clicked_at = new Date().toISOString();

  // Auto-infer source from referer if utm_source not provided - F-012-03
  let utmSource = body.utm_source || null;
  if (!utmSource && body.referer) {
    const ref = body.referer.toLowerCase();
    if (ref.includes('tiktok') || ref.includes('instagram') || ref.includes('pinterest') ||
        ref.includes('youtube') || ref.includes('facebook') || ref.includes('twitter')) {
      utmSource = 'social';
    } else if (ref.includes('google') || ref.includes('bing') || ref.includes('yahoo') || ref.includes('duckduckgo')) {
      utmSource = 'organic';
    } else {
      utmSource = 'direct';
    }
  } else if (!utmSource) {
    utmSource = 'direct';
  }

  // Get IP country from CF headers if available
  const ipCountry = request.headers.get('CF-IPCountry') || null;

  // F-012-04: Click deduplication
  // Check if same user already clicked same product within 5 minutes
  // Time window: 5 minutes = 300 seconds
  const userValue = body.user_id || body.anonymous_id;
  if (userValue) {
    const userField = body.user_id ? 'user_id' : 'anonymous_id';
    const recentClick = await env.DB.prepare(`
      SELECT id, clicked_at FROM clicks
      WHERE product_id = ?
        AND ${userField} = ?
        AND clicked_at >= datetime(?, '-5 minutes')
      ORDER BY clicked_at DESC
      LIMIT 1
    `).bind(body.product_id, userValue, clicked_at).first<{ id: string; clicked_at: string }>();

    if (recentClick) {
      // Duplicate click within 5 minutes - return existing click, don't insert
      return new Response(JSON.stringify(jsonSuccess({
        id: recentClick.id,
        clicked_at: recentClick.clicked_at,
        deduplicated: true,
        message: 'Click already recorded within deduplication window'
      })), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  }

  // Insert new click
  const id = crypto.randomUUID();
  await env.DB.prepare(`
    INSERT INTO clicks (id, product_id, user_id, anonymous_id, source, utm_source, utm_medium, utm_campaign, referer, ip_country, clicked_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    id, body.product_id, body.user_id || null, body.anonymous_id || null,
    body.source || null, utmSource, body.utm_medium || null,
    body.utm_campaign || null, body.referer || null, ipCountry, clicked_at
  ).run();

  // Update user's click_history
  if (body.user_id || body.anonymous_id) {
    const userField = body.user_id ? 'id' : 'anonymous_id';
    const userValue = body.user_id || body.anonymous_id!;
    const userResult = await env.DB.prepare(`SELECT click_history FROM users WHERE ${userField} = ?`).bind(userValue).first<{ click_history: string }>();
    if (userResult) {
      const history: string[] = JSON.parse(userResult.click_history || '[]');
      history.push(body.product_id);
      const updatedHistory = history.slice(-50); // Keep last 50
      await env.DB.prepare('UPDATE users SET click_history = ?, updated_at = ? WHERE ' + userField + ' = ?')
        .bind(JSON.stringify(updatedHistory), clicked_at, userValue).run();
    }
  }

  return new Response(JSON.stringify(jsonSuccess({ id, clicked_at, deduplicated: false })), {
    status: 201,
    headers: { 'Content-Type': 'application/json' },
  });
}
