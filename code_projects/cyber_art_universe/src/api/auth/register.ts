/**
 * POST /api/auth/register — 注册新账户
 * Phase 0
 */
import { Env } from '../../db/schema';
import { jsonSuccess, jsonError } from '../../lib/response';
import { ErrorCodes } from '../../lib/errors';
import { sha256 } from '../../lib/auth';
import { checkEmailRateLimit, generateVerificationCode, storeVerificationCode } from '../../lib/ratelimit';
import { sendVerificationEmail } from '../../lib/email';

export async function handleRegister(env: Env, request: Request): Promise<Response> {
  const body = await request.json() as Record<string, unknown>;
  const cyberName = String(body.cyber_name || '').trim();
  const key = String(body.key || '');
  const email = String(body.email || '').trim().toLowerCase();

  // 校验 cyber_name 格式：3-30 字符，字母/数字/中文/下划线/连字符
  if (!/^[\w一-鿿-]{3,30}$/.test(cyberName)) {
    return new Response(JSON.stringify(jsonError(ErrorCodes.INVALID_CYBER_NAME, 'Cyber Name must be 3-30 characters (letters, digits, Chinese, underscores, hyphens)')), {
      status: 400, headers: { 'Content-Type': 'application/json' },
    });
  }

  // 校验密钥：8-128 字符
  if (key.length < 8 || key.length > 128) {
    return new Response(JSON.stringify(jsonError(ErrorCodes.INVALID_KEY, 'Key must be 8-128 characters')), {
      status: 400, headers: { 'Content-Type': 'application/json' },
    });
  }

  // 校验邮箱
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return new Response(JSON.stringify(jsonError(ErrorCodes.INVALID_EMAIL, 'Invalid email format')), {
      status: 400, headers: { 'Content-Type': 'application/json' },
    });
  }

  // 先检查唯一性（避免浪费 IP 限流配额在重复注册上）
  const existingName = await env.DB.prepare('SELECT id FROM users WHERE cyber_name = ?').bind(cyberName).first();
  if (existingName) {
    return new Response(JSON.stringify(jsonError(ErrorCodes.CYBER_NAME_TAKEN, 'Cyber Name is already taken')), {
      status: 409, headers: { 'Content-Type': 'application/json' },
    });
  }

  const existingEmail = await env.DB.prepare('SELECT id FROM users WHERE email = ?').bind(email).first();
  if (existingEmail) {
    return new Response(JSON.stringify(jsonError(ErrorCodes.EMAIL_ALREADY_REGISTERED, 'Email is already registered')), {
      status: 409, headers: { 'Content-Type': 'application/json' },
    });
  }

  // IP 限流（测试模式下跳过）
  // 放在唯一性检查之后——如果名字/邮箱已占用，不应扣限流额度
  const isTestMode = (env as Record<string, unknown>).TEST_MODE === 'true';
  if (!isTestMode) {
    const rateLimitRemaining = await checkEmailRateLimit(request, env);
    if (rateLimitRemaining !== null) {
      return new Response(JSON.stringify(jsonError(ErrorCodes.RATE_LIMIT_EXCEEDED, `Please wait ${Math.ceil(rateLimitRemaining / 60)} minutes before sending again`)), {
        status: 429, headers: { 'Content-Type': 'application/json' },
      });
    }
  }

  // 生成 entropy_seed 和 user_id
  const entropySeed = crypto.randomUUID();
  const userId = 'usr_' + crypto.randomUUID().replace(/-/g, '').slice(0, 12);

  // 计算 auth_key_hash = SHA-256(key + entropy_seed)
  const authKeyHash = await sha256(key + entropySeed);

  // 生成验证码
  const code = generateVerificationCode();
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  const ipHash = await sha256(ip);

  // 存储验证码到 D1
  await storeVerificationCode(env, email, code, ipHash, 'verify');

  // 写入 users 表
  const now = new Date().toISOString();
  await env.DB.prepare(
    `INSERT INTO users (id, cyber_name, auth_key_hash, email, email_verified, entropy_seed, created_at, updated_at)
     VALUES (?, ?, ?, ?, 0, ?, ?, ?)`
  ).bind(userId, cyberName, authKeyHash, email, entropySeed, now, now).run();

  // 生成 Bearer Token
  const token = 'cau_' + crypto.randomUUID().replace(/-/g, '') + Array.from(crypto.getRandomValues(new Uint8Array(8))).map(b => b.toString(16).padStart(2, '0')).join('');
  const tokenHash = await sha256(token);
  const sessionId = crypto.randomUUID();

  await env.DB.prepare(
    'INSERT INTO sessions (id, user_id, token_hash, created_at) VALUES (?, ?, ?, ?)'
  ).bind(sessionId, userId, tokenHash, now).run();

  // 发送验证邮件（测试模式下跳过，直接打印验证码到日志）
  if (isTestMode) {
    console.log(`[TEST_MODE] Verification code for ${email}: ${code}`);
  } else {
    const emailSent = await sendVerificationEmail(env, email, code);
    if (!emailSent) {
      console.warn(`[register] Verification email failed to send to ${email} (user ${userId})`);
    }
  }

  const verificationDeadline = new Date(Date.now() + 3 * 24 * 3600 * 1000).toISOString();

  return new Response(JSON.stringify(jsonSuccess({
    user: {
      id: userId,
      cyber_name: cyberName,
      class: 'apprentice',
      email: email,
      email_verified: false,
      verification_deadline: verificationDeadline,
      created_at: now,
    },
    token: token,
    token_type: 'Bearer',
  })), {
    status: 201, headers: { 'Content-Type': 'application/json' },
  });
}
