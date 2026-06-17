/**
 * POST /api/auth/logout — 撤销当前 Token
 * Phase 0
 */
import { Env } from '../../db/schema';
import { jsonSuccess } from '../../lib/response';
import { sha256 } from '../../lib/auth';

export async function handleLogout(env: Env, request: Request): Promise<Response> {
  const authHeader = request.headers.get('Authorization');
  const token = authHeader!.slice(7); // Bearer xxx

  const tokenHash = await sha256(token);
  await env.DB.prepare('UPDATE sessions SET revoked = 1 WHERE token_hash = ?').bind(tokenHash).run();

  return new Response(JSON.stringify(jsonSuccess({ message: 'Logged out successfully' })), {
    headers: { 'Content-Type': 'application/json' },
  });
}
