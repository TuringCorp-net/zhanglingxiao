// Global Configs Public Handler - F-040-26
// Public endpoint for reading global configuration
import { Env } from '../db/schema';
import { jsonSuccess, jsonError } from '../lib/response';
import { ErrorCodes } from '../lib/errors';

export async function getGlobalConfig(env: Env, key: string): Promise<Response> {
  try {
    const result = await env.DB.prepare(
      'SELECT key, value FROM global_configs WHERE key = ?'
    ).bind(key).first();

    if (!result) {
      return new Response(JSON.stringify(jsonError(ErrorCodes.NOT_FOUND, 'Config not found')), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify(jsonSuccess(result)), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify(jsonError(ErrorCodes.INTERNAL_ERROR, 'Failed to fetch config')), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
