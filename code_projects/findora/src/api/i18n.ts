// F-022 Multi-language Support API
// Based on SRS Section 5.7
import { Env } from '../db/schema';
import { jsonSuccess, jsonError } from '../lib/response';
import { ErrorCodes } from '../lib/errors';
import { parsePagination } from '../lib/constants';

function generateId(): string {
  return crypto.randomUUID();
}

// === Public Endpoints ===

// GET /api/i18n/locales - Get supported locales
export async function getSupportedLocales(env: Env): Promise<Response> {
  try {
    const result = await env.DB
      .prepare('SELECT code, name, native_name, is_rtl, is_default FROM supported_locales WHERE is_active = 1 ORDER BY sort_order')
      .all();

    return new Response(JSON.stringify(jsonSuccess({
      locales: result.results,
      default_locale: 'en'
    })), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (err) {
    return new Response(JSON.stringify(jsonError(ErrorCodes.INTERNAL_ERROR, 'Failed to fetch locales')), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// GET /api/i18n/translations/:locale - Get translations for locale
export async function getTranslations(env: Env, request: Request, locale: string): Promise<Response> {
  try {
    const url = new URL(request.url);
    const module = url.searchParams.get('module') || 'common';

    // Validate locale
    const localeCheck = await env.DB
      .prepare('SELECT code FROM supported_locales WHERE code = ? AND is_active = 1')
      .bind(locale)
      .first();

    if (!localeCheck) {
      return new Response(JSON.stringify(jsonError(ErrorCodes.INVALID_PARAMS, 'Unsupported locale')), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Get translations
    const result = await env.DB
      .prepare(`
        SELECT tk.key_name, tk.module, t.translated_text
        FROM translation_keys tk
        LEFT JOIN translations t ON tk.id = t.translation_key_id
          AND t.locale = ?
          AND t.status = 'approved'
        WHERE tk.module = ? OR tk.module = 'common'
      `)
      .bind(locale, module)
      .all();

    const translations: Record<string, string> = {};
    for (const row of result.results as { key_name: string; module: string; translated_text: string | null }[]) {
      if (row.translated_text) {
        translations[row.key_name] = row.translated_text;
      }
    }

    return new Response(JSON.stringify(jsonSuccess({
      locale,
      module,
      translations,
      total: Object.keys(translations).length
    })), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (err) {
    return new Response(JSON.stringify(jsonError(ErrorCodes.INTERNAL_ERROR, 'Failed to fetch translations')), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// GET /api/i18n/content/:type/:id/:locale/:field - Get translated content
export async function getContentTranslation(
  env: Env,
  contentType: string,
  contentId: string,
  locale: string,
  fieldName: string
): Promise<Response> {
  try {
    const result = await env.DB
      .prepare(`
        SELECT original_text, translated_text, status
        FROM content_translations
        WHERE content_type = ? AND content_id = ? AND locale = ? AND field_name = ?
      `)
      .bind(contentType, contentId, locale, fieldName)
      .first();

    if (!result) {
      return new Response(JSON.stringify(jsonError(ErrorCodes.NOT_FOUND, 'Translation not found')), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify(jsonSuccess({
      content_type: contentType,
      content_id: contentId,
      locale,
      field_name: fieldName,
      original_text: result.original_text,
      translated_text: result.translated_text,
      status: result.status
    })), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (err) {
    return new Response(JSON.stringify(jsonError(ErrorCodes.INTERNAL_ERROR, 'Failed to fetch content translation')), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// === Admin Endpoints ===

// POST /api/admin/i18n/keys - Create translation key
export async function createTranslationKey(env: Env, request: Request): Promise<Response> {
  try {
    const body = await request.json() as { key_name?: string; module?: string; description?: string; source_locale?: string };
    const { key_name, module, description, source_locale } = body;

    if (!key_name) {
      return new Response(JSON.stringify(jsonError(ErrorCodes.INVALID_PARAMS, 'key_name is required')), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const id = generateId();
    const now = new Date().toISOString();

    await env.DB
      .prepare(`
        INSERT INTO translation_keys (id, key_name, module, description, source_locale, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `)
      .bind(id, key_name, module || 'common', description || null, source_locale || 'en', now, now)
      .run();

    return new Response(JSON.stringify(jsonSuccess({
      id,
      key_name,
      module: module || 'common'
    })), {
      status: 201,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (err: any) {
    if (err.message?.includes('UNIQUE')) {
      return new Response(JSON.stringify(jsonError(ErrorCodes.INVALID_PARAMS, 'Key name already exists')), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    return new Response(JSON.stringify(jsonError(ErrorCodes.INTERNAL_ERROR, 'Failed to create translation key')), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// GET /api/admin/i18n/keys - List translation keys
export async function listTranslationKeys(env: Env, request: Request): Promise<Response> {
  try {
    const url = new URL(request.url);
    const module = url.searchParams.get('module');
    const { page, limit, offset } = parsePagination(url, 50);

    let query = 'SELECT * FROM translation_keys';
    const bindings: any[] = [];

    if (module) {
      query += ' WHERE module = ?';
      bindings.push(module);
    }

    query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    bindings.push(limit, offset);

    const result = await env.DB.prepare(query).bind(...bindings).all();

    // Get total count
    let countQuery = 'SELECT COUNT(*) as total FROM translation_keys';
    if (module) {
      countQuery += ' WHERE module = ?';
    }
    const countResult = module
      ? await env.DB.prepare(countQuery).bind(module).first()
      : await env.DB.prepare(countQuery).first();

    return new Response(JSON.stringify(jsonSuccess({
      keys: result.results,
      total: (countResult as any).total,
      page,
      limit,
      total_pages: Math.ceil((countResult as any).total / limit)
    })), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (err) {
    return new Response(JSON.stringify(jsonError(ErrorCodes.INTERNAL_ERROR, 'Failed to list translation keys')), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// POST /api/admin/i18n/translations - Create/update translation
export async function saveTranslation(env: Env, request: Request): Promise<Response> {
  try {
    const body = await request.json() as { translation_key_id?: string; locale?: string; translated_text?: string; status?: string };
    const { translation_key_id, locale, translated_text, status } = body;

    if (!translation_key_id || !locale || !translated_text) {
      return new Response(JSON.stringify(jsonError(ErrorCodes.INVALID_PARAMS, 'translation_key_id, locale, and translated_text are required')), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Check if translation exists
    const existing = await env.DB
      .prepare('SELECT id FROM translations WHERE translation_key_id = ? AND locale = ?')
      .bind(translation_key_id, locale)
      .first();

    const now = new Date().toISOString();

    if (existing) {
      // Update
      await env.DB
        .prepare(`
          UPDATE translations
          SET translated_text = ?, status = ?, updated_at = ?
          WHERE id = ?
        `)
        .bind(translated_text, status || 'draft', now, (existing as any).id)
        .run();

      return new Response(JSON.stringify(jsonSuccess({
        id: (existing as any).id,
        action: 'updated'
      })), {
        headers: { 'Content-Type': 'application/json' }
      });
    } else {
      // Insert
      const id = generateId();
      await env.DB
        .prepare(`
          INSERT INTO translations (id, translation_key_id, locale, translated_text, status, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `)
        .bind(id, translation_key_id, locale, translated_text, status || 'draft', now, now)
        .run();

      return new Response(JSON.stringify(jsonSuccess({
        id,
        action: 'created'
      })), {
        status: 201,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  } catch (err) {
    return new Response(JSON.stringify(jsonError(ErrorCodes.INTERNAL_ERROR, 'Failed to save translation')), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// POST /api/admin/i18n/content - Create/update content translation
export async function saveContentTranslation(env: Env, request: Request): Promise<Response> {
  try {
    const body = await request.json() as { content_type?: string; content_id?: string; locale?: string; field_name?: string; original_text?: string; translated_text?: string; status?: string };
    const { content_type, content_id, locale, field_name, original_text, translated_text, status } = body;

    if (!content_type || !content_id || !locale || !field_name) {
      return new Response(JSON.stringify(jsonError(ErrorCodes.INVALID_PARAMS, 'content_type, content_id, locale, and field_name are required')), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Check if translation exists
    const existing = await env.DB
      .prepare(`
        SELECT id FROM content_translations
        WHERE content_type = ? AND content_id = ? AND locale = ? AND field_name = ?
      `)
      .bind(content_type, content_id, locale, field_name)
      .first();

    const now = new Date().toISOString();

    if (existing) {
      await env.DB
        .prepare(`
          UPDATE content_translations
          SET original_text = ?, translated_text = ?, status = ?, updated_at = ?
          WHERE id = ?
        `)
        .bind(original_text || null, translated_text || null, status || 'draft', now, (existing as any).id)
        .run();

      return new Response(JSON.stringify(jsonSuccess({
        id: (existing as any).id,
        action: 'updated'
      })), {
        headers: { 'Content-Type': 'application/json' }
      });
    } else {
      const id = generateId();
      await env.DB
        .prepare(`
          INSERT INTO content_translations
          (id, content_type, content_id, locale, field_name, original_text, translated_text, status, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `)
        .bind(id, content_type, content_id, locale, field_name, original_text || null, translated_text || null, status || 'draft', now, now)
        .run();

      return new Response(JSON.stringify(jsonSuccess({
        id,
        action: 'created'
      })), {
        status: 201,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  } catch (err) {
    return new Response(JSON.stringify(jsonError(ErrorCodes.INTERNAL_ERROR, 'Failed to save content translation')), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// POST /api/admin/i18n/sync - Queue content for re-translation
export async function queueTranslationSync(env: Env, request: Request): Promise<Response> {
  try {
    const body = await request.json() as { content_type?: string; content_id?: string; field_name?: string; old_value?: string; new_value?: string; priority?: string };
    const { content_type, content_id, field_name, old_value, new_value, priority } = body;

    if (!content_type || !content_id || !field_name) {
      return new Response(JSON.stringify(jsonError(ErrorCodes.INVALID_PARAMS, 'content_type, content_id, and field_name are required')), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const id = generateId();
    const now = new Date().toISOString();

    await env.DB
      .prepare(`
        INSERT INTO translation_sync_queue (id, content_type, content_id, field_name, old_value, new_value, priority, status, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?)
      `)
      .bind(id, content_type, content_id, field_name, old_value || null, new_value || null, priority || 'normal', now)
      .run();

    return new Response(JSON.stringify(jsonSuccess({
      id,
      status: 'queued'
    })), {
      status: 201,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (err) {
    return new Response(JSON.stringify(jsonError(ErrorCodes.INTERNAL_ERROR, 'Failed to queue translation sync')), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// GET /api/admin/i18n/sync - Get sync queue
export async function getSyncQueue(env: Env, request: Request): Promise<Response> {
  try {
    const url = new URL(request.url);
    const status = url.searchParams.get('status') || 'pending';
    const { page, limit, offset } = parsePagination(url, 50);

    const result = await env.DB
      .prepare(`
        SELECT * FROM translation_sync_queue
        WHERE status = ?
        ORDER BY
          CASE priority
            WHEN 'high' THEN 1
            WHEN 'normal' THEN 2
            WHEN 'low' THEN 3
          END,
          created_at ASC
        LIMIT ? OFFSET ?
      `)
      .bind(status, limit, offset)
      .all();

    const countResult = await env.DB
      .prepare('SELECT COUNT(*) as total FROM translation_sync_queue WHERE status = ?')
      .bind(status)
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
    return new Response(JSON.stringify(jsonError(ErrorCodes.INTERNAL_ERROR, 'Failed to get sync queue')), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// PUT /api/admin/i18n/sync/:id - Mark sync item as processed
export async function updateSyncItem(env: Env, request: Request, id: string): Promise<Response> {
  try {
    const body = await request.json() as { status?: string };
    const { status } = body;

    if (!status || !['pending', 'processing', 'completed', 'failed'].includes(status)) {
      return new Response(JSON.stringify(jsonError(ErrorCodes.INVALID_PARAMS, 'Invalid status')), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const processed_at = status === 'completed' || status === 'failed' ? new Date().toISOString() : null;

    await env.DB
      .prepare('UPDATE translation_sync_queue SET status = ?, processed_at = ? WHERE id = ?')
      .bind(status, processed_at, id)
      .run();

    return new Response(JSON.stringify(jsonSuccess({ id, status })), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (err) {
    return new Response(JSON.stringify(jsonError(ErrorCodes.INTERNAL_ERROR, 'Failed to update sync item')), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// GET /api/admin/i18n/locales - List all locales (including inactive)
export async function listLocales(env: Env): Promise<Response> {
  try {
    const result = await env.DB
      .prepare('SELECT * FROM supported_locales ORDER BY sort_order')
      .all();

    return new Response(JSON.stringify(jsonSuccess({
      locales: result.results
    })), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (err) {
    return new Response(JSON.stringify(jsonError(ErrorCodes.INTERNAL_ERROR, 'Failed to list locales')), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// POST /api/admin/i18n/locales - Add new locale
export async function addLocale(env: Env, request: Request): Promise<Response> {
  try {
    const body = await request.json() as { code?: string; name?: string; native_name?: string; is_rtl?: boolean; sort_order?: number };
    const { code, name, native_name, is_rtl, sort_order } = body;

    if (!code || !name || !native_name) {
      return new Response(JSON.stringify(jsonError(ErrorCodes.INVALID_PARAMS, 'code, name, and native_name are required')), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Get max sort_order if not provided
    let order = sort_order;
    if (!order) {
      const maxOrder = await env.DB.prepare('SELECT MAX(sort_order) as max_order FROM supported_locales').first();
      order = ((maxOrder as any)?.max_order || 0) + 1;
    }

    const now = new Date().toISOString();
    await env.DB
      .prepare(`
        INSERT INTO supported_locales (code, name, native_name, is_rtl, is_active, sort_order, created_at)
        VALUES (?, ?, ?, ?, 1, ?, ?)
      `)
      .bind(code, name, native_name, is_rtl ? 1 : 0, order, now)
      .run();

    return new Response(JSON.stringify(jsonSuccess({
      code,
      name,
      native_name,
      is_rtl: !!is_rtl
    })), {
      status: 201,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (err: any) {
    if (err.message?.includes('UNIQUE')) {
      return new Response(JSON.stringify(jsonError(ErrorCodes.INVALID_PARAMS, 'Locale code already exists')), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    return new Response(JSON.stringify(jsonError(ErrorCodes.INTERNAL_ERROR, 'Failed to add locale')), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// PUT /api/admin/i18n/locales/:code - Update locale
export async function updateLocale(env: Env, request: Request, code: string): Promise<Response> {
  try {
    const body = await request.json() as { name?: string; native_name?: string; is_rtl?: boolean; is_active?: boolean; sort_order?: number };
    const { name, native_name, is_rtl, is_active, sort_order } = body;

    const updates: string[] = [];
    const bindings: any[] = [];

    if (name !== undefined) {
      updates.push('name = ?');
      bindings.push(name);
    }
    if (native_name !== undefined) {
      updates.push('native_name = ?');
      bindings.push(native_name);
    }
    if (is_rtl !== undefined) {
      updates.push('is_rtl = ?');
      bindings.push(is_rtl ? 1 : 0);
    }
    if (is_active !== undefined) {
      updates.push('is_active = ?');
      bindings.push(is_active ? 1 : 0);
    }
    if (sort_order !== undefined) {
      updates.push('sort_order = ?');
      bindings.push(sort_order);
    }

    if (updates.length === 0) {
      return new Response(JSON.stringify(jsonError(ErrorCodes.INVALID_PARAMS, 'No fields to update')), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    bindings.push(code);
    await env.DB
      .prepare(`UPDATE supported_locales SET ${updates.join(', ')} WHERE code = ?`)
      .bind(...bindings)
      .run();

    return new Response(JSON.stringify(jsonSuccess({ code })), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (err) {
    return new Response(JSON.stringify(jsonError(ErrorCodes.INTERNAL_ERROR, 'Failed to update locale')), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
