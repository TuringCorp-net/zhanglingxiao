// Price Check API - F-010-05
// Handles price synchronization checking for products
//
// F-010-05: 价格同步检查
// - Since CF Workers cannot make outbound HTTP requests, this endpoint accepts
//   price check results from an external price monitoring service (e.g., a CF Worker
//   with fetch capability, or an external cron service like Cronitor/Healthchecks).
// - The external service fetches the source_url, extracts the price, and POSTs
//   the result to this endpoint.
// - Price changes are logged in a price_history table for audit and analytics.
// - Products with price changes are flagged for review.

import { Env } from '../db/schema';
import { jsonSuccess, jsonError } from '../lib/response';
import { ErrorCodes } from '../lib/errors';
import { parseLimit } from '../lib/constants';

// Ensure price_history table exists
async function ensurePriceHistoryTable(env: Env): Promise<void> {
  await env.DB.prepare(`
    CREATE TABLE IF NOT EXISTS price_history (
      id TEXT PRIMARY KEY,
      product_id TEXT NOT NULL,
      price_min REAL,
      price_max REAL,
      currency TEXT DEFAULT 'USD',
      checked_at TEXT NOT NULL,
      source_url TEXT,
      status TEXT DEFAULT 'unchanged',
      change_direction TEXT,
      change_amount REAL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (product_id) REFERENCES products(id)
    )
  `).run();

  await env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_price_history_product_id ON price_history(product_id)`).run();
  await env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_price_history_checked_at ON price_history(checked_at)`).run();
}

// POST /api/admin/price-check
// Submit price check results from external price monitoring service
// Body: { product_id, price_min?, price_max?, currency?, source_url?, checked_at? }
export async function submitPriceCheck(env: Env, request: Request): Promise<Response> {
  try {
    await ensurePriceHistoryTable(env);

    const body = await request.json() as {
      product_id: string;
      price_min?: number | null;
      price_max?: number | null;
      currency?: string;
      source_url?: string;
      checked_at?: string;
    };

    if (!body.product_id) {
      return new Response(JSON.stringify(jsonError(ErrorCodes.INVALID_PARAMS, 'product_id is required')), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Verify product exists
    const product = await env.DB.prepare('SELECT * FROM products WHERE id = ?').bind(body.product_id).first<Record<string, unknown>>();
    if (!product) {
      return new Response(JSON.stringify(jsonError(ErrorCodes.NOT_FOUND, 'Product not found')), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const checkedAt = body.checked_at || new Date().toISOString();
    const currency = body.currency || 'USD';
    const id = crypto.randomUUID();
    const createdAt = new Date().toISOString();

    // Determine price change status
    const oldPriceMin = product.price_min as number | null;
    const oldPriceMax = product.price_max as number | null;
    const newPriceMin = body.price_min ?? null;
    const newPriceMax = body.price_max ?? null;

    let status = 'unchanged';
    let changeDirection: string | null = null;
    let changeAmount: number | null = null;

    if (newPriceMin !== null || newPriceMax !== null) {
      const oldAvg = oldPriceMin !== null && oldPriceMax !== null
        ? (oldPriceMin + oldPriceMax) / 2
        : (oldPriceMin !== null ? oldPriceMin : (oldPriceMax !== null ? oldPriceMax : null));
      const newAvg = newPriceMin !== null && newPriceMax !== null
        ? (newPriceMin + newPriceMax) / 2
        : (newPriceMin !== null ? newPriceMin : (newPriceMax !== null ? newPriceMax : null));

      if (oldAvg !== null && newAvg !== null) {
        if (newAvg > oldAvg) {
          status = 'increased';
          changeDirection = 'up';
          changeAmount = newAvg - oldAvg;
        } else if (newAvg < oldAvg) {
          status = 'decreased';
          changeDirection = 'down';
          changeAmount = oldAvg - newAvg;
        }
      } else if (newAvg !== null && oldAvg === null) {
        status = 'new_price';
        changeDirection = 'new';
        changeAmount = newAvg;
      }
    }

    // Insert price history record
    await env.DB.prepare(`
      INSERT INTO price_history (id, product_id, price_min, price_max, currency, checked_at, source_url, status, change_direction, change_amount, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      id,
      body.product_id,
      newPriceMin,
      newPriceMax,
      currency,
      checkedAt,
      body.source_url || null,
      status,
      changeDirection,
      changeAmount,
      createdAt
    ).run();

    // Update product's last_checked_at
    const now = new Date().toISOString();
    const updateFields = ['last_checked_at = ?'];
    const updateBindings: (string | number | null)[] = [now];

    // Update prices if provided
    if (newPriceMin !== null) {
      updateFields.push('price_min = ?');
      updateBindings.push(newPriceMin);
    }
    if (newPriceMax !== null) {
      updateFields.push('price_max = ?');
      updateBindings.push(newPriceMax);
    }
    if (body.currency) {
      updateFields.push('currency = ?');
      updateBindings.push(body.currency);
    }

    updateBindings.push(body.product_id);
    await env.DB.prepare(`UPDATE products SET ${updateFields.join(', ')} WHERE id = ?`).bind(...updateBindings).run();

    return new Response(JSON.stringify(jsonSuccess({
      id,
      product_id: body.product_id,
      status,
      change_direction: changeDirection,
      change_amount: changeAmount,
      checked_at: checkedAt,
    })), {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('Price check error:', err);
    return new Response(JSON.stringify(jsonError(ErrorCodes.INTERNAL_ERROR, 'Failed to process price check')), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

// POST /api/admin/price-check/batch
// Submit batch price check results (from external service for multiple products)
export async function submitBatchPriceCheck(env: Env, request: Request): Promise<Response> {
  try {
    await ensurePriceHistoryTable(env);

    const body = await request.json() as {
      checks: Array<{
        product_id: string;
        price_min?: number | null;
        price_max?: number | null;
        currency?: string;
        source_url?: string;
        checked_at?: string;
      }>;
    };

    if (!Array.isArray(body.checks) || body.checks.length === 0) {
      return new Response(JSON.stringify(jsonError(ErrorCodes.INVALID_PARAMS, 'checks must be a non-empty array')), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const results: { product_id: string; status: string; change_direction?: string | null; change_amount?: number | null; error?: string }[] = [];
    const now = new Date().toISOString();

    for (const check of body.checks) {
      try {
        // Get current product price
        const product = await env.DB.prepare('SELECT price_min, price_max FROM products WHERE id = ?').bind(check.product_id).first<{ price_min: number | null; price_max: number | null }>();

        if (!product) {
          results.push({ product_id: check.product_id, status: 'error', error: 'Product not found' });
          continue;
        }

        const checkedAt = check.checked_at || now;
        const currency = check.currency || 'USD';
        const id = crypto.randomUUID();
        const newPriceMin = check.price_min ?? null;
        const newPriceMax = check.price_max ?? null;

        // Determine change status
        const oldAvg = product.price_min !== null && product.price_max !== null
          ? (product.price_min + product.price_max) / 2
          : (product.price_min !== null ? product.price_min : (product.price_max !== null ? product.price_max : null));
        const newAvg = newPriceMin !== null && newPriceMax !== null
          ? (newPriceMin + newPriceMax) / 2
          : (newPriceMin !== null ? newPriceMin : (newPriceMax !== null ? newPriceMax : null));

        let status = 'unchanged';
        let changeDirection: string | null = null;
        let changeAmount: number | null = null;

        if (newAvg !== null && oldAvg !== null) {
          if (newAvg > oldAvg) {
            status = 'increased';
            changeDirection = 'up';
            changeAmount = newAvg - oldAvg;
          } else if (newAvg < oldAvg) {
            status = 'decreased';
            changeDirection = 'down';
            changeAmount = oldAvg - newAvg;
          }
        } else if (newAvg !== null && oldAvg === null) {
          status = 'new_price';
          changeDirection = 'new';
          changeAmount = newAvg;
        }

        // Insert history
        await env.DB.prepare(`
          INSERT INTO price_history (id, product_id, price_min, price_max, currency, checked_at, source_url, status, change_direction, change_amount, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(id, check.product_id, newPriceMin, newPriceMax, currency, checkedAt, check.source_url || null, status, changeDirection, changeAmount, now).run();

        // Update product
        const updateFields = ['last_checked_at = ?'];
        const updateBindings: (string | number | null)[] = [now];
        if (newPriceMin !== null) { updateFields.push('price_min = ?'); updateBindings.push(newPriceMin); }
        if (newPriceMax !== null) { updateFields.push('price_max = ?'); updateBindings.push(newPriceMax); }
        updateBindings.push(check.product_id);
        await env.DB.prepare(`UPDATE products SET ${updateFields.join(', ')} WHERE id = ?`).bind(...updateBindings).run();

        results.push({ product_id: check.product_id, status, change_direction: changeDirection, change_amount: changeAmount });
      } catch (err) {
        results.push({ product_id: check.product_id, status: 'error', error: String(err) });
      }
    }

    const changed = results.filter(r => r.status === 'increased' || r.status === 'decreased' || r.status === 'new_price').length;

    return new Response(JSON.stringify(jsonSuccess({
      total: body.checks.length,
      changed,
      results,
    })), {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('Batch price check error:', err);
    return new Response(JSON.stringify(jsonError(ErrorCodes.INTERNAL_ERROR, 'Failed to process batch price check')), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

// GET /api/admin/price-check/:product_id
// Get price history for a product
export async function getPriceHistory(env: Env, request: Request, productId: string): Promise<Response> {
  try {
    await ensurePriceHistoryTable(env);

    const url = new URL(request.url);
    const days = Math.min(365, Math.max(1, parseInt(url.searchParams.get('days') || '30')));
    const limit = parseLimit(url, 30);

    // Get price history
    const history = await env.DB.prepare(`
      SELECT * FROM price_history
      WHERE product_id = ? AND checked_at >= datetime('now', '-' || ? || ' days')
      ORDER BY checked_at DESC
      LIMIT ?
    `).bind(productId, days, limit).all<Record<string, unknown>>();

    // Get product current price
    const product = await env.DB.prepare('SELECT id, price_min, price_max, currency, last_checked_at FROM products WHERE id = ?').bind(productId).first<Record<string, unknown>>();

    if (!product) {
      return new Response(JSON.stringify(jsonError(ErrorCodes.NOT_FOUND, 'Product not found')), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Get change summary
    const summary = await env.DB.prepare(`
      SELECT
        COUNT(*) as total_checks,
        SUM(CASE WHEN status = 'increased' THEN 1 ELSE 0 END) as increased_count,
        SUM(CASE WHEN status = 'decreased' THEN 1 ELSE 0 END) as decreased_count,
        SUM(CASE WHEN status = 'new_price' THEN 1 ELSE 0 END) as new_price_count,
        SUM(CASE WHEN change_amount IS NOT NULL THEN change_amount ELSE 0 END) as total_change_amount
      FROM price_history
      WHERE product_id = ? AND checked_at >= datetime('now', '-' || ? || ' days')
    `).bind(productId, days).first<{
      total_checks: number;
      increased_count: number;
      decreased_count: number;
      new_price_count: number;
      total_change_amount: number;
    }>();

    return new Response(JSON.stringify(jsonSuccess({
      product: {
        id: product.id,
        price_min: product.price_min,
        price_max: product.price_max,
        currency: product.currency,
        last_checked_at: product.last_checked_at,
      },
      history: history.results || [],
      summary: {
        period_days: days,
        total_checks: summary?.total_checks || 0,
        increased_count: summary?.increased_count || 0,
        decreased_count: summary?.decreased_count || 0,
        new_price_count: summary?.new_price_count || 0,
        total_change_amount: summary?.total_change_amount || 0,
      },
    })), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('Get price history error:', err);
    return new Response(JSON.stringify(jsonError(ErrorCodes.INTERNAL_ERROR, 'Failed to get price history')), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

// GET /api/admin/price-check
// Get products with recent price changes (admin overview)
export async function listPriceChanges(env: Env, request: Request): Promise<Response> {
  try {
    await ensurePriceHistoryTable(env);

    const url = new URL(request.url);
    const days = Math.min(90, Math.max(1, parseInt(url.searchParams.get('days') || '7')));
    const status = url.searchParams.get('status'); // increased, decreased, new_price, unchanged
    const limit = parseLimit(url, 50);
    const offset = Math.max(0, parseInt(url.searchParams.get('offset') || '0'));

    let where = `WHERE ph.checked_at >= datetime('now', '-' || ? || ' days')`;
    const bindings: (string | number)[] = [days];

    if (status && ['increased', 'decreased', 'new_price', 'unchanged'].includes(status)) {
      where += ' AND ph.status = ?';
      bindings.push(status);
    }

    // Get price changes with product info
    const rows = await env.DB.prepare(`
      SELECT
        ph.*,
        p.title,
        p.category,
        p.price_min as current_price_min,
        p.price_max as current_price_max,
        p.currency as current_currency
      FROM price_history ph
      JOIN products p ON ph.product_id = p.id
      ${where}
      ORDER BY ph.checked_at DESC
      LIMIT ? OFFSET ?
    `).bind(...bindings, limit, offset).all<Record<string, unknown>>();

    // Get total count
    const countRow = await env.DB.prepare(`
      SELECT COUNT(*) as total FROM price_history ph ${where}
    `).bind(...bindings).first<{ total: number }>();

    return new Response(JSON.stringify(jsonSuccess({
      changes: rows.results || [],
      meta: {
        period_days: days,
        total: countRow?.total || 0,
        limit,
        offset,
      },
    })), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('List price changes error:', err);
    return new Response(JSON.stringify(jsonError(ErrorCodes.INTERNAL_ERROR, 'Failed to list price changes')), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
