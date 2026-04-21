// Email Service API - F-013-07
// Email triggering logic for subscription confirmation, weekly newsletters, unsubscription, and re-engagement
// Integrates with Resend/SendGrid for email delivery
import { Env } from '../db/schema';
import { jsonSuccess, jsonError, parseJSON } from '../lib/response';
import { ErrorCodes } from '../lib/errors';

// Email configuration interface
interface EmailConfig {
  provider: 'resend' | 'sendgrid';
  apiKey: string;
  fromEmail: string;
  fromName: string;
}

interface EmailRecipient {
  email: string;
  name?: string;
}

interface EmailPayload {
  to: EmailRecipient[];
  subject: string;
  html: string;
  text?: string;
  unsubscribe_url?: string;
  tracking_tags?: string[];
}

// Email log for tracking sent emails
async function ensureEmailLogTable(env: Env): Promise<void> {
  await env.DB.prepare(`
    CREATE TABLE IF NOT EXISTS email_logs (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      email TEXT NOT NULL,
      event_type TEXT NOT NULL,
      subject TEXT,
      status TEXT DEFAULT 'pending',
      provider_response TEXT,
      sent_at TEXT,
      opened_at TEXT,
      clicked_at TEXT,
      bounced_at TEXT,
      created_at TEXT NOT NULL
    )
  `).run();

  await env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_email_logs_user_id ON email_logs(user_id)`).run();
  await env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_email_logs_status ON email_logs(status)`).run();
  await env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_email_logs_event_type ON email_logs(event_type)`).run();
}

// Build email HTML template
function buildEmailTemplate(content: {
  title: string;
  body: string;
  cta_text?: string;
  cta_url?: string;
  unsubscribe_url?: string;
  footer_text?: string;
}): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${content.title}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { text-align: center; margin-bottom: 30px; }
    .logo { font-size: 24px; font-weight: bold; color: #4F46E5; }
    .content { background: #f9fafb; padding: 30px; border-radius: 12px; }
    .cta { display: inline-block; background: #4F46E5; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; margin: 20px 0; }
    .footer { text-align: center; margin-top: 30px; font-size: 12px; color: #6b7280; }
    .unsubscribe { color: #6b7280; font-size: 12px; }
  </style>
</head>
<body>
  <div class="header">
    <div class="logo">Findora</div>
  </div>
  <div class="content">
    <h2>${content.title}</h2>
    <p>${content.body}</p>
    ${content.cta_text && content.cta_url ? `<a href="${content.cta_url}" class="cta">${content.cta_text}</a>` : ''}
  </div>
  <div class="footer">
    ${content.footer_text || '© 2026 Findora. All rights reserved.'}
    ${content.unsubscribe_url ? `<br><a href="${content.unsubscribe_url}" class="unsubscribe">Unsubscribe</a>` : ''}
  </div>
</body>
</html>
  `.trim();
}

// Send email via Resend API
async function sendViaResend(config: EmailConfig, payload: EmailPayload): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: `${config.fromName} <${config.fromEmail}>`,
        to: payload.to.map(t => `${t.name ? `${t.name} <${t.email}>` : t.email}`),
        subject: payload.subject,
        html: payload.html,
        text: payload.text,
        tags: payload.tracking_tags,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      return { success: false, error: `Resend API error: ${error}` };
    }

    const result = await response.json() as { id: string };
    return { success: true, messageId: result.id };
  } catch (err) {
    return { success: false, error: `Network error: ${err}` };
  }
}

// Send email via SendGrid API
async function sendViaSendGrid(config: EmailConfig, payload: EmailPayload): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: { email: config.fromEmail, name: config.fromName },
        personalizations: payload.to.map(t => ({
          to: [{ email: t.email, name: t.name }],
          dynamic_template_data: { subject: payload.subject },
        })),
        subject: payload.subject,
        content: [
          { type: 'text/html', value: payload.html },
          ...(payload.text ? [{ type: 'text/plain', value: payload.text }] : []),
        ],
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      return { success: false, error: `SendGrid API error: ${error}` };
    }

    const messageId = response.headers.get('X-Message-Id') || 'unknown';
    return { success: true, messageId };
  } catch (err) {
    return { success: false, error: `Network error: ${err}` };
  }
}

// Send email (abstracted provider)
async function sendEmail(
  config: EmailConfig,
  payload: EmailPayload,
  env: Env
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const result = config.provider === 'resend'
    ? await sendViaResend(config, payload)
    : await sendViaSendGrid(config, payload);

  return result;
}

// Log email to database
async function logEmail(
  env: Env,
  params: {
    user_id?: string;
    email: string;
    event_type: string;
    subject: string;
    status: string;
    provider_response?: string;
  }
): Promise<void> {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  await env.DB.prepare(`
    INSERT INTO email_logs (id, user_id, email, event_type, subject, status, provider_response, sent_at, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    id,
    params.user_id || null,
    params.email,
    params.event_type,
    params.subject,
    params.status,
    params.provider_response || null,
    params.status === 'sent' ? now : null,
    now
  ).run();
}

// POST /api/email/send-confirmation - F-013-07 (subscription confirmation)
export async function sendSubscriptionConfirmation(env: Env, request: Request): Promise<Response> {
  try {
    await ensureEmailLogTable(env);

    const body = await request.json() as {
      email: string;
      user_id?: string;
      subscribed_categories?: string[];
      unsubscribe_url?: string;
    };

    if (!body.email) {
      return new Response(JSON.stringify(jsonError(ErrorCodes.INVALID_PARAMS, 'email is required')), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const categories = (body.subscribed_categories || []).join(', ');
    const unsubUrl = body.unsubscribe_url || `${new URL(request.url).origin}/unsubscribe?email=${encodeURIComponent(body.email)}`;

    const config: EmailConfig = {
      provider: (env.EMAIL_PROVIDER as EmailConfig['provider']) || 'resend',
      apiKey: env.EMAIL_API_KEY || '',
      fromEmail: env.EMAIL_FROM || 'hello@findora.example.com',
      fromName: 'Findora',
    };

    if (!config.apiKey) {
      // Log locally if no email provider configured
      await logEmail(env, {
        user_id: body.user_id,
        email: body.email,
        event_type: 'subscription_confirmation',
        subject: 'Welcome to Findora!',
        status: 'pending',
        provider_response: 'Email provider not configured',
      });

      return new Response(JSON.stringify(jsonSuccess({
        message: 'Email not sent - provider not configured',
        logged: true,
      })), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const html = buildEmailTemplate({
      title: 'Welcome to Findora! 🎉',
      body: `Thanks for subscribing! You'll receive curated product recommendations${categories ? ` in ${categories}` : ''}.<br><br>We're excited to help you discover amazing products tailored to your interests.`,
      cta_text: 'Explore Products',
      cta_url: `${new URL(request.url).origin}/`,
      unsubscribe_url: unsubUrl,
    });

    const result = await sendEmail(config, {
      to: [{ email: body.email }],
      subject: 'Welcome to Findora!',
      html,
      unsubscribe_url: unsubUrl,
      tracking_tags: ['subscription', 'welcome'],
    }, env);

    const status = result.success ? 'sent' : 'failed';
    await logEmail(env, {
      user_id: body.user_id,
      email: body.email,
      event_type: 'subscription_confirmation',
      subject: 'Welcome to Findora!',
      status,
      provider_response: result.success ? result.messageId : result.error,
    });

    if (!result.success) {
      return new Response(JSON.stringify(jsonError(ErrorCodes.INTERNAL_ERROR, `Failed to send email: ${result.error}`)), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify(jsonSuccess({
      message: 'Confirmation email sent',
      messageId: result.messageId,
    })), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('Send confirmation error:', err);
    return new Response(JSON.stringify(jsonError(ErrorCodes.INTERNAL_ERROR, 'Failed to send confirmation')), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

// POST /api/email/send-weekly - F-013-07 (weekly newsletter trigger)
export async function sendWeeklyNewsletter(env: Env, request: Request): Promise<Response> {
  try {
    await ensureEmailLogTable(env);

    const body = await request.json() as {
      category?: string;
      product_ids?: string[];
      max_products?: number;
    };

    const maxProducts = Math.min(body.max_products || 10, 20);

    // Get products for the newsletter
    let productsQuery = `
      SELECT * FROM products
      WHERE status = 'active'
        AND created_at >= datetime('now', '-7 days')
    `;
    const bindings: string[] = [];

    if (body.category) {
      productsQuery += ' AND category = ?';
      bindings.push(body.category);
    }

    productsQuery += ' ORDER BY created_at DESC LIMIT ?';
    bindings.push(String(maxProducts));

    const products = await env.DB.prepare(productsQuery).bind(...bindings).all<Record<string, unknown>>();

    if (!products.results || products.results.length === 0) {
      return new Response(JSON.stringify(jsonSuccess({
        message: 'No products to send this week',
        recipient_count: 0,
      })), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Get active subscribers (optionally filtered by category)
    let subscribersQuery = 'SELECT * FROM users WHERE status = ?';
    const subscriberBindings: string[] = ['active'];

    if (body.category) {
      subscribersQuery += ' AND subscribed_categories LIKE ?';
      subscriberBindings.push(`%"${body.category}"%`);
    }

    subscribersQuery += ' LIMIT 1000';
    const subscribers = await env.DB.prepare(subscribersQuery).bind(...subscriberBindings).all<Record<string, unknown>>();

    if (!subscribers.results || subscribers.results.length === 0) {
      return new Response(JSON.stringify(jsonSuccess({
        message: 'No subscribers to target',
        product_count: products.results.length,
      })), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const config: EmailConfig = {
      provider: (env.EMAIL_PROVIDER as EmailConfig['provider']) || 'resend',
      apiKey: env.EMAIL_API_KEY || '',
      fromEmail: env.EMAIL_FROM || 'hello@findora.example.com',
      fromName: 'Findora',
    };

    const baseUrl = new URL(request.url).origin;
    let sentCount = 0;
    let failedCount = 0;

    for (const subscriber of subscribers.results!) {
      const email = subscriber.email as string;
      const unsubUrl = `${baseUrl}/unsubscribe?email=${encodeURIComponent(email)}`;

      const productList = products.results!.map((p: Record<string, unknown>) => {
        const images = parseJSON<string[]>(p.images as string || '[]', []);
        const image = images[0] || `${baseUrl}/placeholder.png`;
        return `
          <div style="margin-bottom: 20px; padding: 15px; background: white; border-radius: 8px;">
            <img src="${image}" alt="${p.title || p.original_title}" style="width: 100%; max-width: 200px; border-radius: 8px;">
            <h3 style="margin: 10px 0 5px;">${p.title || p.original_title}</h3>
            <p style="color: #4F46E5; font-weight: bold;">
              ${p.price_min ? `$${p.price_min}` : ''}${p.price_max ? ` - $${p.price_max}` : ''}
            </p>
            <a href="${baseUrl}/product/${p.id}" style="color: #4F46E5;">View Details →</a>
          </div>
        `;
      }).join('');

      const html = buildEmailTemplate({
        title: 'Your Weekly Picks 📦',
        body: `Here's what's new on Findora this week:<br><br>${productList}`,
        cta_text: 'View All New Products',
        cta_url: body.category ? `${baseUrl}/category/${body.category}` : baseUrl,
        unsubscribe_url: unsubUrl,
      });

      if (config.apiKey) {
        const result = await sendEmail(config, {
          to: [{ email }],
          subject: 'Your Weekly Picks from Findora',
          html,
          unsubscribe_url: unsubUrl,
          tracking_tags: ['newsletter', 'weekly'],
        }, env);

        await logEmail(env, {
          user_id: subscriber.id as string,
          email,
          event_type: 'weekly_newsletter',
          subject: 'Your Weekly Picks from Findora',
          status: result.success ? 'sent' : 'failed',
          provider_response: result.success ? result.messageId : result.error,
        });

        if (result.success) sentCount++;
        else failedCount++;
      } else {
        await logEmail(env, {
          user_id: subscriber.id as string,
          email,
          event_type: 'weekly_newsletter',
          subject: 'Your Weekly Picks from Findora',
          status: 'pending',
          provider_response: 'Email provider not configured',
        });
      }
    }

    return new Response(JSON.stringify(jsonSuccess({
      message: 'Weekly newsletter processed',
      product_count: products.results.length,
      recipient_count: subscribers.results.length,
      sent_count: sentCount,
      failed_count: failedCount,
    })), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('Send weekly newsletter error:', err);
    return new Response(JSON.stringify(jsonError(ErrorCodes.INTERNAL_ERROR, 'Failed to send weekly newsletter')), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

// POST /api/email/send-unsubscription-confirmation - F-013-07
export async function sendUnsubscriptionConfirmation(env: Env, request: Request): Promise<Response> {
  try {
    await ensureEmailLogTable(env);

    const body = await request.json() as {
      email: string;
      user_id?: string;
    };

    if (!body.email) {
      return new Response(JSON.stringify(jsonError(ErrorCodes.INVALID_PARAMS, 'email is required')), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const config: EmailConfig = {
      provider: (env.EMAIL_PROVIDER as EmailConfig['provider']) || 'resend',
      apiKey: env.EMAIL_API_KEY || '',
      fromEmail: env.EMAIL_FROM || 'hello@findora.example.com',
      fromName: 'Findora',
    };

    const html = buildEmailTemplate({
      title: 'You\'ve Been Unsubscribed',
      body: `We've received your request to unsubscribe from Findora.<br><br>We're sorry to see you go! If you change your mind, you can always resubscribe to start receiving recommendations again.<br><br>Your subscription has been deactivated.`,
      cta_text: 'Resubscribe',
      cta_url: `${new URL(request.url).origin}/subscribe`,
    });

    if (config.apiKey) {
      const result = await sendEmail(config, {
        to: [{ email: body.email }],
        subject: 'You\'ve Been Unsubscribed - Findora',
        html,
        tracking_tags: ['unsubscription', 'confirmation'],
      }, env);

      await logEmail(env, {
        user_id: body.user_id,
        email: body.email,
        event_type: 'unsubscription_confirmation',
        subject: 'You\'ve Been Unsubscribed',
        status: result.success ? 'sent' : 'failed',
        provider_response: result.success ? result.messageId : result.error,
      });

      return new Response(JSON.stringify(jsonSuccess({
        message: result.success ? 'Unsubscription email sent' : 'Failed to send email',
        messageId: result.messageId,
      })), {
        headers: { 'Content-Type': 'application/json' },
      });
    } else {
      await logEmail(env, {
        user_id: body.user_id,
        email: body.email,
        event_type: 'unsubscription_confirmation',
        subject: 'You\'ve Been Unsubscribed',
        status: 'pending',
        provider_response: 'Email provider not configured',
      });

      return new Response(JSON.stringify(jsonSuccess({
        message: 'Email logged but not sent - provider not configured',
        logged: true,
      })), {
        headers: { 'Content-Type': 'application/json' },
      });
    }
  } catch (err) {
    console.error('Send unsubscription confirmation error:', err);
    return new Response(JSON.stringify(jsonError(ErrorCodes.INTERNAL_ERROR, 'Failed to send confirmation')), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

// POST /api/email/send-reengagement - F-013-07 (recall email for dormant users)
export async function sendReengagementEmail(env: Env, request: Request): Promise<Response> {
  try {
    await ensureEmailLogTable(env);

    const body = await request.json() as {
      days_inactive?: number;
      max_recipients?: number;
    };

    const daysInactive = body.days_inactive || 30;
    const maxRecipients = Math.min(body.max_recipients || 100, 500);

    // Get dormant/inactive users who unsubscribed more than 30 days ago
    const dormantUsers = await env.DB.prepare(`
      SELECT * FROM users
      WHERE status = 'unsubscribed'
        AND unsubscribed_at <= datetime('now', '-' || ? || ' days')
        AND unsubscribed_at >= datetime('now', '-90 days')
      LIMIT ?
    `).bind(daysInactive, maxRecipients).all<Record<string, unknown>>();

    if (!dormantUsers.results || dormantUsers.results.length === 0) {
      return new Response(JSON.stringify(jsonSuccess({
        message: 'No dormant users to re-engage',
        recipient_count: 0,
      })), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const config: EmailConfig = {
      provider: (env.EMAIL_PROVIDER as EmailConfig['provider']) || 'resend',
      apiKey: env.EMAIL_API_KEY || '',
      fromEmail: env.EMAIL_FROM || 'hello@findora.example.com',
      fromName: 'Findora',
    };

    const baseUrl = new URL(request.url).origin;
    let sentCount = 0;

    for (const user of dormantUsers.results!) {
      const email = user.email as string;
      const unsubUrl = `${baseUrl}/unsubscribe?email=${encodeURIComponent(email)}`;

      const html = buildEmailTemplate({
        title: 'We Miss You! 😢',
        body: `It's been a while since you visited Findora. We've added lots of new products since then!<br><br>Here's a quick recap of what's new:<br>
          • New product categories<br>
          • Better recommendations<br>
          • Exclusive deals<br><br>
          Come back and see what's new!`,
        cta_text: 'Explore New Products',
        cta_url: baseUrl,
        unsubscribe_url: unsubUrl,
        footer_text: 'You received this email because you previously subscribed to Findora.',
      });

      if (config.apiKey) {
        const result = await sendEmail(config, {
          to: [{ email }],
          subject: 'We Miss You! Check Out What\'s New on Findora',
          html,
          unsubscribe_url: unsubUrl,
          tracking_tags: ['reengagement', 'recall'],
        }, env);

        await logEmail(env, {
          user_id: user.id as string,
          email,
          event_type: 'reengagement',
          subject: 'We Miss You! Check Out What\'s New',
          status: result.success ? 'sent' : 'failed',
          provider_response: result.success ? result.messageId : result.error,
        });

        if (result.success) sentCount++;
      } else {
        await logEmail(env, {
          user_id: user.id as string,
          email,
          event_type: 'reengagement',
          subject: 'We Miss You! Check Out What\'s New',
          status: 'pending',
          provider_response: 'Email provider not configured',
        });
      }
    }

    return new Response(JSON.stringify(jsonSuccess({
      message: 'Re-engagement campaign processed',
      recipient_count: dormantUsers.results.length,
      sent_count: sentCount,
    })), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('Send re-engagement email error:', err);
    return new Response(JSON.stringify(jsonError(ErrorCodes.INTERNAL_ERROR, 'Failed to send re-engagement email')), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

// GET /api/email/logs - Admin endpoint to view email logs
export async function getEmailLogs(env: Env, request: Request): Promise<Response> {
  const url = new URL(request.url);
  const event_type = url.searchParams.get('event_type');
  const status = url.searchParams.get('status');
  const page = Math.max(1, parseInt(url.searchParams.get('page') || '1'));
  const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') || '50')));
  const offset = (page - 1) * limit;

  let where = 'WHERE 1=1';
  const bindings: (string | number)[] = [];

  if (event_type) {
    where += ' AND event_type = ?';
    bindings.push(event_type);
  }

  if (status) {
    where += ' AND status = ?';
    bindings.push(status);
  }

  const countRow = await env.DB.prepare(`SELECT COUNT(*) as total FROM email_logs ${where}`).bind(...bindings).first<{ total: number }>();
  const total = countRow?.total ?? 0;

  const rows = await env.DB.prepare(`
    SELECT el.*, u.subscribed_categories
    FROM email_logs el
    LEFT JOIN users u ON el.user_id = u.id
    ${where}
    ORDER BY el.created_at DESC
    LIMIT ? OFFSET ?
  `).bind(...bindings, limit, offset).all<Record<string, unknown>>();

  // Get stats by event type
  const statsByType = await env.DB.prepare(`
    SELECT
      event_type,
      COUNT(*) as total,
      SUM(CASE WHEN status = 'sent' THEN 1 ELSE 0 END) as sent,
      SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed,
      SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending
    FROM email_logs
    GROUP BY event_type
  `).all<Record<string, unknown>>();

  return new Response(JSON.stringify(jsonSuccess({
    logs: rows.results || [],
    stats_by_type: statsByType.results || [],
    pagination: { page, total, limit, pages: Math.ceil(total / limit) },
  })), {
    headers: { 'Content-Type': 'application/json' },
  });
}
