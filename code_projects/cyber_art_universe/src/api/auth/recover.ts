/**
 * POST /api/auth/recover — 发起账户恢复（发送验证码）
 * POST /api/auth/recover-confirm — 确认恢复（验证码 + 新密钥）
 * Phase 0
 */
import { Env } from '../../db/schema';
import { jsonSuccess, jsonError } from '../../lib/response';
import { ErrorCodes } from '../../lib/errors';
import { sha256 } from '../../lib/auth';
import { checkEmailRateLimit, generateVerificationCode, storeVerificationCode } from '../../lib/ratelimit';
import { sendRecoveryEmail } from '../../lib/email';

// POST /api/auth/recover
export async function handleRecover(env: Env, request: Request): Promise<Response> {
  const body = await request.json() as Record<string, unknown>;
  const email = String(body.email || '').trim().toLowerCase();

  if (!email) {
    return new Response(JSON.stringify(jsonError(ErrorCodes.INVALID_EMAIL, 'Email is required')), {
      status: 400, headers: { 'Content-Type': 'application/json' },
    });
  }

  // IP 限流
  const rateLimitRemaining = await checkEmailRateLimit(request, env);
  if (rateLimitRemaining !== null) {
    return new Response(JSON.stringify(jsonSuccess({ message: 'If the email is registered, a verification code has been sent' })), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // 检查邮箱是否注册
  const user = await env.DB.prepare('SELECT id FROM users WHERE email = ?').bind(email).first();
  if (!user) {
    // 不泄露邮箱是否已注册
    return new Response(JSON.stringify(jsonSuccess({ message: 'If the email is registered, a verification code has been sent' })), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const code = generateVerificationCode();
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  const ipHash = await sha256(ip);

  await storeVerificationCode(env, email, code, ipHash, 'recover');
  await sendRecoveryEmail(env, email, code);

  return new Response(JSON.stringify(jsonSuccess({ message: 'If the email is registered, a verification code has been sent' })), {
    headers: { 'Content-Type': 'application/json' },
  });
}

// POST /api/auth/recover-confirm
export async function handleRecoverConfirm(env: Env, request: Request): Promise<Response> {
  const body = await request.json() as Record<string, unknown>;
  const email = String(body.email || '').trim().toLowerCase();
  const code = String(body.code || '').trim();
  const newKey = String(body.new_key || '');

  if (!email || !code || !newKey) {
    return new Response(JSON.stringify(jsonError(ErrorCodes.MISSING_REQUIRED_FIELD, 'email, code, and new_key are required')), {
      status: 400, headers: { 'Content-Type': 'application/json' },
    });
  }

  if (newKey.length < 8 || newKey.length > 128) {
    return new Response(JSON.stringify(jsonError(ErrorCodes.INVALID_KEY, 'Key must be 8-128 characters')), {
      status: 400, headers: { 'Content-Type': 'application/json' },
    });
  }

  // 查找恢复验证码
  const record = await env.DB.prepare(
    `SELECT * FROM email_verifications
     WHERE email = ? AND purpose = 'recover' AND verified = 0
     ORDER BY created_at DESC LIMIT 1`
  ).bind(email).first<Record<string, unknown>>();

  if (!record) {
    return new Response(JSON.stringify(jsonError(ErrorCodes.CODE_EXPIRED, 'No recovery code found')), {
      status: 400, headers: { 'Content-Type': 'application/json' },
    });
  }

  if (new Date(String(record.expires_at)) < new Date()) {
    return new Response(JSON.stringify(jsonError(ErrorCodes.CODE_EXPIRED, 'Recovery code has expired')), {
      status: 400, headers: { 'Content-Type': 'application/json' },
    });
  }

  // 验证验证码
  const codeHash = await sha256(code);
  if (codeHash !== String(record.code_hash)) {
    await env.DB.prepare('UPDATE email_verifications SET attempts = attempts + 1 WHERE id = ?').bind(record.id).run();
    return new Response(JSON.stringify(jsonError(ErrorCodes.INVALID_CODE, 'Invalid recovery code')), {
      status: 400, headers: { 'Content-Type': 'application/json' },
    });
  }

  // 查找用户
  const user = await env.DB.prepare('SELECT * FROM users WHERE email = ?').bind(email).first<Record<string, unknown>>();
  if (!user) {
    return new Response(JSON.stringify(jsonError(ErrorCodes.USER_NOT_FOUND, 'User not found')), {
      status: 404, headers: { 'Content-Type': 'application/json' },
    });
  }

  // 更新密钥（用新密钥 + 原 entropy_seed 重新哈希）
  const newAuthKeyHash = await sha256(newKey + String(user.entropy_seed));
  const now = new Date().toISOString();

  await env.DB.prepare('UPDATE users SET auth_key_hash = ?, updated_at = ? WHERE id = ?').bind(newAuthKeyHash, now, user.id).run();

  // 撤销所有现有 sessions
  await env.DB.prepare('UPDATE sessions SET revoked = 1 WHERE user_id = ? AND revoked = 0').bind(user.id).run();

  // 清除验证码
  await env.DB.prepare('DELETE FROM email_verifications WHERE id = ?').bind(record.id).run();

  return new Response(JSON.stringify(jsonSuccess({
    message: 'Key has been reset. All existing sessions have been revoked. Please login with your new key.',
  })), {
    headers: { 'Content-Type': 'application/json' },
  });
}
