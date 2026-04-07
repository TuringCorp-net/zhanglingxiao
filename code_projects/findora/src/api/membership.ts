// F-023 Membership System API
// Based on SRS Section 5.8
import { Env } from '../db/schema';
import { jsonSuccess, jsonError } from '../lib/response';
import { ErrorCodes } from '../lib/errors';

function generateId(): string {
  return crypto.randomUUID();
}

interface SubscriptionRequest {
  user_id: string;
  tier_id: string;
  plan_interval?: 'monthly' | 'yearly';
  payment_method?: string;
  external_subscription_id?: string;
}

// === Public Endpoints ===

// GET /api/membership/tiers - List available membership tiers
export async function listMembershipTiers(env: Env): Promise<Response> {
  try {
    const result = await env.DB
      .prepare(`
        SELECT id, code, name, display_name, description, price_monthly, price_yearly, currency, features
        FROM membership_tiers
        WHERE is_active = 1
        ORDER BY sort_order
      `)
      .all();

    return new Response(JSON.stringify(jsonSuccess({
      tiers: result.results.map((t: any) => ({
        ...t,
        features: JSON.parse(t.features || '[]')
      }))
    })), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (err) {
    return new Response(JSON.stringify(jsonError(ErrorCodes.INTERNAL_ERROR, 'Failed to fetch tiers')), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// GET /api/membership/my - Get current user's membership info
export async function getMyMembership(env: Env, request: Request): Promise<Response> {
  try {
    const url = new URL(request.url);
    const userId = url.searchParams.get('user_id');
    const email = url.searchParams.get('email');
    const anonymousId = url.searchParams.get('anonymous_id');

    if (!userId && !email && !anonymousId) {
      return new Response(JSON.stringify(jsonError(ErrorCodes.INVALID_PARAMS, 'user_id, email, or anonymous_id required')), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    let userIdToUse = userId;

    // Look up user by email or anonymous_id if not directly provided
    if (!userIdToUse) {
      let query = 'SELECT id FROM users WHERE ';
      const bindings: any[] = [];

      if (email) {
        query += 'email = ?';
        bindings.push(email);
      } else if (anonymousId) {
        query += 'anonymous_id = ?';
        bindings.push(anonymousId);
      }

      const user = await env.DB.prepare(query).bind(...bindings).first();
      if (!user) {
        return new Response(JSON.stringify(jsonSuccess({
          membership: null,
          user: null,
          message: 'User not found'
        })), {
          headers: { 'Content-Type': 'application/json' }
        });
      }
      userIdToUse = (user as any).id;
    }

    // Get user's active membership
    const membership = await env.DB
      .prepare(`
        SELECT um.*, mt.code, mt.name, mt.display_name, mt.features
        FROM user_memberships um
        JOIN membership_tiers mt ON um.tier_id = mt.id
        WHERE um.user_id = ? AND um.status = 'active'
        ORDER BY um.created_at DESC
        LIMIT 1
      `)
      .bind(userIdToUse)
      .first();

    if (!membership) {
      return new Response(JSON.stringify(jsonSuccess({
        membership: null,
        user_id: userIdToUse,
        tier: 'free',
        message: 'No active subscription'
      })), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const m = membership as any;
    return new Response(JSON.stringify(jsonSuccess({
      membership: {
        id: m.id,
        status: m.status,
        plan_interval: m.plan_interval,
        current_period_start: m.current_period_start,
        current_period_end: m.current_period_end,
        started_at: m.started_at
      },
      tier: {
        code: m.code,
        name: m.name,
        display_name: m.display_name,
        features: JSON.parse(m.features || '[]')
      },
      user_id: userIdToUse
    })), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (err) {
    return new Response(JSON.stringify(jsonError(ErrorCodes.INTERNAL_ERROR, 'Failed to fetch membership')), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// POST /api/membership/check - Check if user has access to a feature
export async function checkEntitlement(env: Env, request: Request): Promise<Response> {
  try {
    const body = await request.json() as { user_id?: string; email?: string; anonymous_id?: string; feature_code?: string };
    const { user_id, email, anonymous_id, feature_code } = body;

    if (!feature_code) {
      return new Response(JSON.stringify(jsonError(ErrorCodes.INVALID_PARAMS, 'feature_code required')), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Find user
    let userIdToUse = user_id;
    if (!userIdToUse) {
      let query = 'SELECT id FROM users WHERE ';
      const bindings: any[] = [];

      if (email) {
        query += 'email = ?';
        bindings.push(email);
      } else if (anonymous_id) {
        query += 'anonymous_id = ?';
        bindings.push(anonymous_id);
      } else {
        return new Response(JSON.stringify(jsonError(ErrorCodes.INVALID_PARAMS, 'user identification required')), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      const user = await env.DB.prepare(query).bind(...bindings).first();
      if (!user) {
        return new Response(JSON.stringify(jsonSuccess({
          allowed: false,
          reason: 'user_not_found',
          message: 'User not found'
        })), {
          headers: { 'Content-Type': 'application/json' }
        });
      }
      userIdToUse = (user as any).id;
    }

    // Get user's active membership tier
    const membership = await env.DB
      .prepare(`
        SELECT mt.code, mt.name
        FROM user_memberships um
        JOIN membership_tiers mt ON um.tier_id = mt.id
        WHERE um.user_id = ? AND um.status = 'active' AND um.current_period_end > datetime('now')
        ORDER BY um.created_at DESC
        LIMIT 1
      `)
      .bind(userIdToUse)
      .first();

    // Check entitlement
    let allowed = false;
    let reason = 'free_tier';
    let tier_code = 'free';

    if (membership) {
      const m = membership as any;
      tier_code = m.code;

      const entitlement = await env.DB
      .prepare(`
        SELECT is_allowed, value FROM membership_entitlements
        WHERE tier_id = (SELECT id FROM membership_tiers WHERE code = ?)
        AND feature_code = ?
      `)
      .bind(tier_code, feature_code)
      .first();

      if (entitlement && (entitlement as any).is_allowed) {
        allowed = true;
        reason = 'tier_access';
      } else {
        reason = 'feature_not_included';
      }
    }

    return new Response(JSON.stringify(jsonSuccess({
      allowed,
      reason,
      tier_code,
      feature_code,
      upgrade_tier: allowed ? null : getNextTier(tier_code)
    })), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (err) {
    return new Response(JSON.stringify(jsonError(ErrorCodes.INTERNAL_ERROR, 'Failed to check entitlement')), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

function getNextTier(currentTier: string): string | null {
  const tierOrder = ['free', 'basic', 'pro'];
  const currentIndex = tierOrder.indexOf(currentTier);
  if (currentIndex >= 0 && currentIndex < tierOrder.length - 1) {
    return tierOrder[currentIndex + 1];
  }
  return null;
}

// === Admin Endpoints ===

// GET /api/admin/membership/tiers - List all tiers
export async function adminListTiers(env: Env): Promise<Response> {
  try {
    const result = await env.DB
      .prepare('SELECT * FROM membership_tiers ORDER BY sort_order')
      .all();

    return new Response(JSON.stringify(jsonSuccess({
      tiers: result.results.map((t: any) => ({
        ...t,
        features: JSON.parse(t.features || '[]')
      }))
    })), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (err) {
    return new Response(JSON.stringify(jsonError(ErrorCodes.INTERNAL_ERROR, 'Failed to fetch tiers')), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// POST /api/admin/membership/tiers - Create tier
export async function createTier(env: Env, request: Request): Promise<Response> {
  try {
    const body = await request.json() as { code?: string; name?: string; display_name?: string; description?: string; price_monthly?: number; price_yearly?: number; features?: string[]; sort_order?: number };
    const { code, name, display_name, description, price_monthly, price_yearly, features, sort_order } = body;

    if (!code || !name || !display_name) {
      return new Response(JSON.stringify(jsonError(ErrorCodes.INVALID_PARAMS, 'code, name, and display_name required')), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const id = generateId();
    const now = new Date().toISOString();

    await env.DB
      .prepare(`
        INSERT INTO membership_tiers (id, code, name, display_name, description, price_monthly, price_yearly, features, is_active, sort_order, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?)
      `)
      .bind(
        id, code, name, display_name,
        description || null,
        price_monthly || 0,
        price_yearly || 0,
        JSON.stringify(features || []),
        sort_order || 99,
        now, now
      )
      .run();

    return new Response(JSON.stringify(jsonSuccess({ id, code, name })), {
      status: 201,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (err: any) {
    if (err.message?.includes('UNIQUE')) {
      return new Response(JSON.stringify(jsonError(ErrorCodes.INVALID_PARAMS, 'Tier code already exists')), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    return new Response(JSON.stringify(jsonError(ErrorCodes.INTERNAL_ERROR, 'Failed to create tier')), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// PUT /api/admin/membership/tiers/:code - Update tier
export async function updateTier(env: Env, request: Request, code: string): Promise<Response> {
  try {
    const body = await request.json() as { name?: string; display_name?: string; description?: string; price_monthly?: number; price_yearly?: number; features?: string[]; is_active?: boolean; sort_order?: number };
    const { name, display_name, description, price_monthly, price_yearly, features, is_active, sort_order } = body;

    const updates: string[] = [];
    const bindings: any[] = [];

    if (name !== undefined) { updates.push('name = ?'); bindings.push(name); }
    if (display_name !== undefined) { updates.push('display_name = ?'); bindings.push(display_name); }
    if (description !== undefined) { updates.push('description = ?'); bindings.push(description); }
    if (price_monthly !== undefined) { updates.push('price_monthly = ?'); bindings.push(price_monthly); }
    if (price_yearly !== undefined) { updates.push('price_yearly = ?'); bindings.push(price_yearly); }
    if (features !== undefined) { updates.push('features = ?'); bindings.push(JSON.stringify(features)); }
    if (is_active !== undefined) { updates.push('is_active = ?'); bindings.push(is_active ? 1 : 0); }
    if (sort_order !== undefined) { updates.push('sort_order = ?'); bindings.push(sort_order); }

    if (updates.length === 0) {
      return new Response(JSON.stringify(jsonError(ErrorCodes.INVALID_PARAMS, 'No fields to update')), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    updates.push('updated_at = ?');
    bindings.push(new Date().toISOString());
    bindings.push(code);

    await env.DB
      .prepare(`UPDATE membership_tiers SET ${updates.join(', ')} WHERE code = ?`)
      .bind(...bindings)
      .run();

    return new Response(JSON.stringify(jsonSuccess({ code })), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (err) {
    return new Response(JSON.stringify(jsonError(ErrorCodes.INTERNAL_ERROR, 'Failed to update tier')), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// POST /api/admin/membership/subscribe - Create/activate subscription (F-023-02)
export async function createSubscription(env: Env, request: Request): Promise<Response> {
  try {
    const body = await request.json() as { user_id?: string; tier_id?: string; plan_interval?: string; payment_method?: string; external_subscription_id?: string };
    const { user_id, tier_id, plan_interval, payment_method, external_subscription_id } = body;

    if (!user_id || !tier_id) {
      return new Response(JSON.stringify(jsonError(ErrorCodes.INVALID_PARAMS, 'user_id and tier_id required')), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Verify user exists
    const user = await env.DB.prepare('SELECT id FROM users WHERE id = ?').bind(user_id).first();
    if (!user) {
      return new Response(JSON.stringify(jsonError(ErrorCodes.NOT_FOUND, 'User not found')), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Verify tier exists
    const tier = await env.DB.prepare('SELECT id, code, name, price_monthly, price_yearly FROM membership_tiers WHERE code = ? AND is_active = 1').bind(tier_id).first();
    if (!tier) {
      return new Response(JSON.stringify(jsonError(ErrorCodes.INVALID_PARAMS, 'Invalid tier')), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const t = tier as any;
    const interval = plan_interval || 'monthly';
    const price = interval === 'yearly' ? t.price_yearly : t.price_monthly;

    const now = new Date();
    const periodEnd = new Date(now);
    if (interval === 'monthly') {
      periodEnd.setMonth(periodEnd.getMonth() + 1);
    } else {
      periodEnd.setFullYear(periodEnd.getFullYear() + 1);
    }

    const membershipId = generateId();
    const eventId = generateId();

    // Check if user already has a membership
    const existingMembership = await env.DB
      .prepare('SELECT id, tier_id FROM user_memberships WHERE user_id = ? AND status = ?')
      .bind(user_id, 'active')
      .first();

    if (existingMembership) {
      // Cancel existing
      await env.DB
        .prepare('UPDATE user_memberships SET status = ?, cancelled_at = ?, updated_at = ? WHERE id = ?')
        .bind('cancelled', now.toISOString(), now.toISOString(), (existingMembership as any).id)
        .run();

      // Log event
      await env.DB
        .prepare(`
          INSERT INTO subscription_events (id, user_membership_id, user_id, event_type, old_tier_id, new_tier_id, old_status, new_status, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `)
        .bind(eventId, (existingMembership as any).id, user_id, 'tier_change', (existingMembership as any).tier_id, t.id, 'active', 'cancelled', now.toISOString())
        .run();
    }

    // Create new membership
    await env.DB
      .prepare(`
        INSERT INTO user_memberships (id, user_id, tier_id, status, started_at, current_period_start, current_period_end, plan_interval, payment_method, external_subscription_id, created_at, updated_at)
        VALUES (?, ?, ?, 'active', ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .bind(membershipId, user_id, t.id, now.toISOString(), now.toISOString(), periodEnd.toISOString(), interval, payment_method || null, external_subscription_id || null, now.toISOString(), now.toISOString())
      .run();

    // Log event
    await env.DB
      .prepare(`
        INSERT INTO subscription_events (id, user_membership_id, user_id, event_type, new_tier_id, new_status, reason, amount_charged, currency, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .bind(generateId(), membershipId, user_id, existingMembership ? 'upgrade' : 'new_subscription', t.id, 'active', `Subscribe to ${t.name}`, price, 'USD', now.toISOString())
      .run();

    // Record payment if there's a charge
    if (price > 0) {
      await env.DB
        .prepare(`
          INSERT INTO payments (id, user_membership_id, user_id, amount, currency, status, payment_method, external_payment_id, paid_at, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `)
        .bind(generateId(), membershipId, user_id, price, 'USD', 'completed', payment_method || 'card', external_subscription_id || null, now.toISOString(), now.toISOString())
        .run();
    }

    return new Response(JSON.stringify(jsonSuccess({
      membership_id: membershipId,
      tier: t.code,
      status: 'active',
      plan_interval: interval,
      current_period_end: periodEnd.toISOString(),
      amount_charged: price
    })), {
      status: 201,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (err) {
    return new Response(JSON.stringify(jsonError(ErrorCodes.INTERNAL_ERROR, 'Failed to create subscription')), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// GET /api/admin/membership/subscriptions - List subscriptions (F-023-04)
export async function listSubscriptions(env: Env, request: Request): Promise<Response> {
  try {
    const url = new URL(request.url);
    const status = url.searchParams.get('status');
    const tier = url.searchParams.get('tier');
    const page = parseInt(url.searchParams.get('page') || '1');
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '50'), 100);
    const offset = (page - 1) * limit;

    let conditions: string[] = [];
    const bindings: any[] = [];

    if (status) {
      conditions.push('um.status = ?');
      bindings.push(status);
    }
    if (tier) {
      conditions.push('mt.code = ?');
      bindings.push(tier);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const result = await env.DB
      .prepare(`
        SELECT um.*, mt.code as tier_code, mt.name as tier_name, mt.display_name as tier_display_name,
               u.email, u.anonymous_id
        FROM user_memberships um
        JOIN membership_tiers mt ON um.tier_id = mt.id
        LEFT JOIN users u ON um.user_id = u.id
        ${whereClause}
        ORDER BY um.created_at DESC
        LIMIT ? OFFSET ?
      `)
      .bind(...bindings, limit, offset)
      .all();

    const countResult = await env.DB
      .prepare(`SELECT COUNT(*) as total FROM user_memberships um JOIN membership_tiers mt ON um.tier_id = mt.id ${whereClause}`)
      .bind(...bindings)
      .first();

    return new Response(JSON.stringify(jsonSuccess({
      subscriptions: result.results,
      total: (countResult as any).total,
      page,
      limit,
      total_pages: Math.ceil((countResult as any).total / limit)
    })), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (err) {
    return new Response(JSON.stringify(jsonError(ErrorCodes.INTERNAL_ERROR, 'Failed to list subscriptions')), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// POST /api/admin/membership/subscriptions/:id/cancel - Cancel subscription (F-023-04)
export async function cancelSubscription(env: Env, request: Request, id: string): Promise<Response> {
  try {
    const body = await request.json() as { reason?: string };
    const { reason } = body;

    const membership = await env.DB.prepare('SELECT * FROM user_memberships WHERE id = ?').bind(id).first();
    if (!membership) {
      return new Response(JSON.stringify(jsonError(ErrorCodes.NOT_FOUND, 'Subscription not found')), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const m = membership as any;
    const now = new Date().toISOString();

    await env.DB
      .prepare('UPDATE user_memberships SET status = ?, cancelled_at = ?, updated_at = ? WHERE id = ?')
      .bind('cancelled', now, now, id)
      .run();

    await env.DB
      .prepare(`
        INSERT INTO subscription_events (id, user_membership_id, user_id, event_type, old_status, new_status, reason, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .bind(generateId(), id, m.user_id, 'cancellation', m.status, 'cancelled', reason || 'User requested cancellation', now)
      .run();

    return new Response(JSON.stringify(jsonSuccess({
      id,
      status: 'cancelled',
      cancelled_at: now
    })), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (err) {
    return new Response(JSON.stringify(jsonError(ErrorCodes.INTERNAL_ERROR, 'Failed to cancel subscription')), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// POST /api/admin/membership/subscriptions/:id/renew - Renew subscription (F-023-05)
export async function renewSubscription(env: Env, request: Request, id: string): Promise<Response> {
  try {
    const body = await request.json() as { amount?: number; payment_method?: string; external_payment_id?: string };
    const { amount, payment_method, external_payment_id } = body;

    const membership = await env.DB.prepare('SELECT * FROM user_memberships WHERE id = ?').bind(id).first();
    if (!membership) {
      return new Response(JSON.stringify(jsonError(ErrorCodes.NOT_FOUND, 'Subscription not found')), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const m = membership as any;
    const now = new Date();
    const newPeriodEnd = new Date(m.current_period_end);

    if (m.plan_interval === 'monthly') {
      newPeriodEnd.setMonth(newPeriodEnd.getMonth() + 1);
    } else {
      newPeriodEnd.setFullYear(newPeriodEnd.getFullYear() + 1);
    }

    // If subscription was cancelled, reactivate it
    const newStatus = m.status === 'cancelled' ? 'active' : m.status;
    const wasCancelled = m.status === 'cancelled';

    await env.DB
      .prepare(`
        UPDATE user_memberships
        SET status = ?, current_period_start = ?, current_period_end = ?, cancelled_at = NULL, updated_at = ?
        WHERE id = ?
      `)
      .bind(newStatus, m.current_period_end, newPeriodEnd.toISOString(), now.toISOString(), id)
      .run();

    await env.DB
      .prepare(`
        INSERT INTO subscription_events (id, user_membership_id, user_id, event_type, old_status, new_status, amount_charged, currency, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .bind(generateId(), id, m.user_id, wasCancelled ? 'reactivation' : 'renewal', m.status, newStatus, amount || 0, 'USD', now.toISOString())
      .run();

    if (amount && amount > 0) {
      await env.DB
        .prepare(`
          INSERT INTO payments (id, user_membership_id, user_id, amount, currency, status, payment_method, external_payment_id, paid_at, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `)
        .bind(generateId(), id, m.user_id, amount, 'USD', 'completed', payment_method || 'card', external_payment_id || null, now.toISOString(), now.toISOString())
        .run();
    }

    return new Response(JSON.stringify(jsonSuccess({
      id,
      status: newStatus,
      current_period_start: m.current_period_end,
      current_period_end: newPeriodEnd.toISOString()
    })), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (err) {
    return new Response(JSON.stringify(jsonError(ErrorCodes.INTERNAL_ERROR, 'Failed to renew subscription')), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// GET /api/admin/membership/subscriptions/:id - Get subscription details
export async function getSubscription(env: Env, request: Request, id: string): Promise<Response> {
  try {
    const membership = await env.DB
      .prepare(`
        SELECT um.*, mt.code as tier_code, mt.name as tier_name, mt.features as tier_features
        FROM user_memberships um
        JOIN membership_tiers mt ON um.tier_id = mt.id
        WHERE um.id = ?
      `)
      .bind(id)
      .first();

    if (!membership) {
      return new Response(JSON.stringify(jsonError(ErrorCodes.NOT_FOUND, 'Subscription not found')), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const events = await env.DB
      .prepare('SELECT * FROM subscription_events WHERE user_membership_id = ? ORDER BY created_at DESC')
      .bind(id)
      .all();

    const payments = await env.DB
      .prepare('SELECT * FROM payments WHERE user_membership_id = ? ORDER BY created_at DESC')
      .bind(id)
      .all();

    const m = membership as any;
    return new Response(JSON.stringify(jsonSuccess({
      subscription: {
        ...m,
        tier_features: JSON.parse(m.tier_features || '[]')
      },
      events: events.results,
      payments: payments.results
    })), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (err) {
    return new Response(JSON.stringify(jsonError(ErrorCodes.INTERNAL_ERROR, 'Failed to get subscription')), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// POST /api/admin/membership/exclusive-content - Mark content as exclusive (F-023-06)
export async function markExclusiveContent(env: Env, request: Request): Promise<Response> {
  try {
    const body = await request.json() as { content_type?: string; content_id?: string; required_tier_id?: string };
    const { content_type, content_id, required_tier_id } = body;

    if (!content_type || !content_id || !required_tier_id) {
      return new Response(JSON.stringify(jsonError(ErrorCodes.INVALID_PARAMS, 'content_type, content_id, and required_tier_id required')), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Check if already exists
    const existing = await env.DB
      .prepare('SELECT id FROM exclusive_content WHERE content_type = ? AND content_id = ?')
      .bind(content_type, content_id)
      .first();

    if (existing) {
      await env.DB
        .prepare('UPDATE exclusive_content SET required_tier_id = ?, updated_at = ? WHERE id = ?')
        .bind(required_tier_id, new Date().toISOString(), (existing as any).id)
        .run();

      return new Response(JSON.stringify(jsonSuccess({
        id: (existing as any).id,
        action: 'updated'
      })), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const id = generateId();
    const now = new Date().toISOString();

    await env.DB
      .prepare(`
        INSERT INTO exclusive_content (id, content_type, content_id, required_tier_id, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `)
      .bind(id, content_type, content_id, required_tier_id, now, now)
      .run();

    return new Response(JSON.stringify(jsonSuccess({
      id,
      content_type,
      content_id,
      required_tier_id
    })), {
      status: 201,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (err) {
    return new Response(JSON.stringify(jsonError(ErrorCodes.INTERNAL_ERROR, 'Failed to mark exclusive content')), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// GET /api/admin/membership/exclusive-content - List exclusive content
export async function listExclusiveContent(env: Env, request: Request): Promise<Response> {
  try {
    const url = new URL(request.url);
    const contentType = url.searchParams.get('content_type');
    const page = parseInt(url.searchParams.get('page') || '1');
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '50'), 100);
    const offset = (page - 1) * limit;

    let query = `
      SELECT ec.*, mt.code as tier_code, mt.name as tier_name
      FROM exclusive_content ec
      JOIN membership_tiers mt ON ec.required_tier_id = mt.id
    `;
    const bindings: any[] = [];

    if (contentType) {
      query += ' WHERE ec.content_type = ?';
      bindings.push(contentType);
    }

    query += ' ORDER BY ec.created_at DESC LIMIT ? OFFSET ?';
    bindings.push(limit, offset);

    const result = await env.DB.prepare(query).bind(...bindings).all();

    const countResult = await env.DB
      .prepare(`SELECT COUNT(*) as total FROM exclusive_content ${contentType ? 'WHERE content_type = ?' : ''}`)
      .bind(...(contentType ? [contentType] : []))
      .first();

    return new Response(JSON.stringify(jsonSuccess({
      items: result.results,
      total: (countResult as any).total,
      page,
      limit
    })), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (err) {
    return new Response(JSON.stringify(jsonError(ErrorCodes.INTERNAL_ERROR, 'Failed to list exclusive content')), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// GET /api/admin/membership/entitlements - List entitlements for a tier
export async function listEntitlements(env: Env, request: Request): Promise<Response> {
  try {
    const url = new URL(request.url);
    const tierCode = url.searchParams.get('tier_code');

    if (!tierCode) {
      return new Response(JSON.stringify(jsonError(ErrorCodes.INVALID_PARAMS, 'tier_code required')), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const result = await env.DB
      .prepare(`
        SELECT me.*, mt.code as tier_code, mt.name as tier_name
        FROM membership_entitlements me
        JOIN membership_tiers mt ON me.tier_id = mt.id
        WHERE mt.code = ?
        ORDER BY me.feature_code
      `)
      .bind(tierCode)
      .all();

    return new Response(JSON.stringify(jsonSuccess({
      tier_code: tierCode,
      entitlements: result.results
    })), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (err) {
    return new Response(JSON.stringify(jsonError(ErrorCodes.INTERNAL_ERROR, 'Failed to list entitlements')), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// GET /api/admin/membership/stats - Membership statistics
export async function getMembershipStats(env: Env): Promise<Response> {
  try {
    // Total by tier
    const byTier = await env.DB
      .prepare(`
        SELECT mt.code as tier, COUNT(*) as count
        FROM user_memberships um
        JOIN membership_tiers mt ON um.tier_id = mt.id
        WHERE um.status = 'active'
        GROUP BY mt.code
      `)
      .all();

    // Monthly revenue
    const revenue = await env.DB
      .prepare(`
        SELECT
          SUM(CASE WHEN p.currency = 'USD' THEN p.amount ELSE 0 END) as usd_revenue,
          COUNT(*) as transaction_count
        FROM payments p
        WHERE p.status = 'completed'
        AND p.paid_at >= datetime('now', '-30 days')
      `)
      .first();

    // Expiring soon (within 7 days)
    const expiringSoon = await env.DB
      .prepare(`
        SELECT COUNT(*) as count
        FROM user_memberships
        WHERE status = 'active'
        AND current_period_end BETWEEN datetime('now') AND datetime('now', '+7 days')
      `)
      .first();

    // Status breakdown
    const byStatus = await env.DB
      .prepare(`
        SELECT status, COUNT(*) as count
        FROM user_memberships
        GROUP BY status
      `)
      .all();

    return new Response(JSON.stringify(jsonSuccess({
      by_tier: byTier.results,
      monthly_revenue: revenue,
      expiring_soon: (expiringSoon as any).count,
      by_status: byStatus.results
    })), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (err) {
    return new Response(JSON.stringify(jsonError(ErrorCodes.INTERNAL_ERROR, 'Failed to get stats')), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
