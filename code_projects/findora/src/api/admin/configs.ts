// Global Configs Admin Handler - F-040-24/25
// Admin endpoints for managing global configuration
import { Env } from '../../db/schema';
import { jsonSuccess, jsonError } from '../../lib/response';
import { ErrorCodes } from '../../lib/errors';

interface ConfigRow {
  key: string;
  value: string;
  description: string | null;
  updated_at: string;
  updated_by: string | null;
}

interface ConfigResult {
  key: string;
  value: string;
  description?: string | null;
  updated_at?: string;
  updated_by?: string | null;
  id?: string;
}

export async function listGlobalConfigs(env: Env): Promise<Response> {
  try {
    const { results } = await env.DB.prepare(
      'SELECT key, value, description, updated_at FROM global_configs ORDER BY key'
    ).all<ConfigRow>();

    return new Response(JSON.stringify(jsonSuccess(results)), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify(jsonError(ErrorCodes.INTERNAL_ERROR, 'Failed to fetch configs')), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

export async function updateGlobalConfig(env: Env, key: string, request: Request): Promise<Response> {
  try {
    const body = await request.json() as { value?: string; updated_by?: string };

    if (!body.value) {
      return new Response(JSON.stringify(jsonError(ErrorCodes.INVALID_PARAMS, 'Value is required')), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Check if config exists
    const existing = await env.DB.prepare(
      'SELECT id FROM global_configs WHERE key = ?'
    ).bind(key).first();

    if (!existing) {
      return new Response(JSON.stringify(jsonError(ErrorCodes.NOT_FOUND, 'Config key not found')), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    await env.DB.prepare(
      'UPDATE global_configs SET value = ?, updated_at = datetime("now"), updated_by = ? WHERE key = ?'
    ).bind(body.value, body.updated_by || null, key).run();

    const result: ConfigResult = { key, value: body.value, updated_at: new Date().toISOString() };
    return new Response(JSON.stringify(jsonSuccess(result)), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify(jsonError(ErrorCodes.INTERNAL_ERROR, 'Failed to update config')), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

export async function createGlobalConfig(env: Env, request: Request): Promise<Response> {
  try {
    const body = await request.json() as { key?: string; value?: string; description?: string; created_by?: string };

    if (!body.key || !body.value) {
      return new Response(JSON.stringify(jsonError(ErrorCodes.INVALID_PARAMS, 'Key and value are required')), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Check if already exists
    const existing = await env.DB.prepare(
      'SELECT id FROM global_configs WHERE key = ?'
    ).bind(body.key).first();

    if (existing) {
      return new Response(JSON.stringify(jsonError(ErrorCodes.INVALID_PARAMS, 'Config key already exists')), {
        status: 409,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const id = crypto.randomUUID();
    await env.DB.prepare(
      'INSERT INTO global_configs (id, key, value, description, updated_at, updated_by, created_at) VALUES (?, ?, ?, ?, datetime("now"), ?, datetime("now"))'
    ).bind(id, body.key, body.value, body.description || null, body.created_by || null).run();

    const result: ConfigResult = { id, key: body.key, value: body.value };
    return new Response(JSON.stringify(jsonSuccess(result)), {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify(jsonError(ErrorCodes.INTERNAL_ERROR, 'Failed to create config')), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
