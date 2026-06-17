/**
 * POST /api/auth/verify-email — 邮箱验证
 * POST /api/auth/resend-verification — 重新发送验证码
 * Phase 0
 */
import { Env } from '../../db/schema';
import { jsonSuccess, jsonError } from '../../lib/response';
import { ErrorCodes } from '../../lib/errors';
import { sha256 } from '../../lib/auth';
import { checkEmailRateLimit, generateVerificationCode, storeVerificationCode } from '../../lib/ratelimit';
import { sendVerificationEmail } from '../../lib/email';

// POST /api/auth/verify-email
export async function handleVerifyEmail(env: Env, request: Request): Promise<Response> {
  const user = env.currentUser!;
  const body = await request.json() as Record<string, unknown>;
  const code = String(body.code || '').trim();

  if (!code || code.length !== 6) {
    return new Response(JSON.stringify(jsonError(ErrorCodes.INVALID_CODE, 'Invalid verification code')), {
      status: 400, headers: { 'Content-Type': 'application/json' },
    });
  }

  if (user.email_verified === 1) {
    return new Response(JSON.stringify(jsonError(ErrorCodes.ALREADY_VERIFIED, 'Email is already verified')), {
      status: 409, headers: { 'Content-Type': 'application/json' },
    });
  }

  // 测试模式：固定验证码 "000000" 直接通过
  const isTestMode = (env as Record<string, unknown>).TEST_MODE === 'true';
  if (isTestMode && code === '000000') {
    await env.DB.prepare('UPDATE users SET email_verified = 1, updated_at = ? WHERE id = ?').bind(new Date().toISOString(), user.id).run();
    return new Response(JSON.stringify(jsonSuccess({
      email_verified: true,
      message: 'Email verified successfully (TEST MODE)',
    })), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // 查找最新验证码记录
  const record = await env.DB.prepare(
    `SELECT * FROM email_verifications
     WHERE email = ? AND purpose = 'verify' AND verified = 0
     ORDER BY created_at DESC LIMIT 1`
  ).bind(user.email).first<Record<string, unknown>>();

  if (!record) {
    return new Response(JSON.stringify(jsonError(ErrorCodes.CODE_EXPIRED, 'No verification code found. Please request a new one')), {
      status: 400, headers: { 'Content-Type': 'application/json' },
    });
  }

  // 检查过期
  if (new Date(String(record.expires_at)) < new Date()) {
    return new Response(JSON.stringify(jsonError(ErrorCodes.CODE_EXPIRED, 'Verification code has expired (3 days). Please request a new one')), {
      status: 400, headers: { 'Content-Type': 'application/json' },
    });
  }

  // 检查尝试次数
  const attempts = Number(record.attempts);
  if (attempts >= 5) {
    // 删除该记录，要求重新发送
    await env.DB.prepare('DELETE FROM email_verifications WHERE id = ?').bind(record.id).run();
    return new Response(JSON.stringify(jsonError(ErrorCodes.TOO_MANY_ATTEMPTS, 'Too many attempts. Please request a new code')), {
      status: 400, headers: { 'Content-Type': 'application/json' },
    });
  }

  // 验证验证码
  const codeHash = await sha256(code);
  if (codeHash !== String(record.code_hash)) {
    // 增加尝试次数
    await env.DB.prepare('UPDATE email_verifications SET attempts = attempts + 1 WHERE id = ?').bind(record.id).run();
    const remaining = 5 - attempts - 1;
    return new Response(JSON.stringify(jsonError(ErrorCodes.INVALID_CODE, `Invalid code. ${remaining} attempts remaining`)), {
      status: 400, headers: { 'Content-Type': 'application/json' },
    });
  }

  // 验证成功
  await env.DB.prepare('DELETE FROM email_verifications WHERE id = ?').bind(record.id).run();
  await env.DB.prepare('UPDATE users SET email_verified = 1, updated_at = ? WHERE id = ?').bind(new Date().toISOString(), user.id).run();

  return new Response(JSON.stringify(jsonSuccess({
    email_verified: true,
    message: 'Email verified successfully',
  })), {
    headers: { 'Content-Type': 'application/json' },
  });
}

// POST /api/auth/resend-verification
export async function handleResendVerification(env: Env, request: Request): Promise<Response> {
  const user = env.currentUser!;

  if (user.email_verified === 1) {
    return new Response(JSON.stringify(jsonError(ErrorCodes.ALREADY_VERIFIED, 'Email is already verified')), {
      status: 409, headers: { 'Content-Type': 'application/json' },
    });
  }

  // IP 限流（测试模式下跳过）
  const isTestMode = (env as Record<string, unknown>).TEST_MODE === 'true';
  if (!isTestMode) {
    const rateLimitRemaining = await checkEmailRateLimit(request, env);
    if (rateLimitRemaining !== null) {
      return new Response(JSON.stringify(jsonError(ErrorCodes.RATE_LIMIT_EXCEEDED, `Please wait ${Math.ceil(rateLimitRemaining / 60)} minutes before requesting a new code`)), {
        status: 429, headers: { 'Content-Type': 'application/json' },
      });
    }
  }

  const code = generateVerificationCode();
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  const ipHash = await sha256(ip);

  await storeVerificationCode(env, user.email, code, ipHash, 'verify');
  await sendVerificationEmail(env, user.email, code);

  return new Response(JSON.stringify(jsonSuccess({
    message: `Verification code resent to ${user.email}`,
  })), {
    headers: { 'Content-Type': 'application/json' },
  });
}
