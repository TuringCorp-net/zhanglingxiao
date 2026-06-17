/**
 * POST /api/auth/connect — 统一登录/注册（用邮箱作为唯一标识）
 * Phase 0 v2：替代旧 /api/auth/register + /api/auth/login
 */
import { Env } from '../../db/schema';
import { jsonSuccess, jsonError } from '../../lib/response';
import { ErrorCodes } from '../../lib/errors';
import { sha256 } from '../../lib/auth';
import { checkEmailRateLimit, generateVerificationCode, storeVerificationCode } from '../../lib/ratelimit';
import { sendVerificationEmail } from '../../lib/email';

export async function handleConnect(env: Env, request: Request): Promise<Response> {
  const body = await request.json() as Record<string, unknown>;
  const email = String(body.email || '').trim().toLowerCase();
  const key = String(body.key || '');
  const confirm = body.confirm === true;

  // 校验
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return new Response(JSON.stringify(jsonError(ErrorCodes.INVALID_EMAIL, 'Invalid email format')), {
      status: 400, headers: { 'Content-Type': 'application/json' },
    });
  }
  if (key.length < 8 || key.length > 128) {
    return new Response(JSON.stringify(jsonError(ErrorCodes.INVALID_KEY, 'Key must be 8-128 characters')), {
      status: 400, headers: { 'Content-Type': 'application/json' },
    });
  }

  // 查找已有用户
  const existing = await env.DB.prepare('SELECT * FROM users WHERE email = ?').bind(email).first<Record<string, unknown>>();

  // ── 状态 A：已注册 + 密码正确 → 直接登录 ──
  if (existing) {
    const expectedHash = await sha256(key + String(existing.entropy_seed));
    if (expectedHash === String(existing.auth_key_hash)) {
      const token = await createSession(env, String(existing.id));
      const now = new Date().toISOString();
      await env.DB.prepare('UPDATE users SET updated_at = ? WHERE id = ?').bind(now, existing.id).run();

      return new Response(JSON.stringify(jsonSuccess({
        action: 'login',
        user: {
          id: existing.id,
          cyber_name: existing.cyber_name,
          class: existing.class,
          karma: existing.karma,
          energy: existing.energy,
          energy_cap: existing.energy_cap,
          email: existing.email,
          email_verified: existing.email_verified === 1,
          created_at: existing.created_at,
        },
        token,
        token_type: 'Bearer',
      })), { headers: { 'Content-Type': 'application/json' } });
    }

    // ── 状态 B：已注册 + 密码错误 ──
    return new Response(JSON.stringify(jsonSuccess({
      action: 'wrong_key',
      message: 'Incorrect key. Please try again or recover your account.',
    })), { status: 401, headers: { 'Content-Type': 'application/json' } });
  }

  // ── 状态 C：未注册 + 未确认 → 提示创建新账户 ──
  if (!confirm) {
    const cyberName = email; // 完整邮箱作为初始 Cyber Name
    // 检查 cyber_name 是否已被占用（极端情况：有人用 email 作为 cyber_name 注册了别的邮箱）
    const nameTaken = await env.DB.prepare('SELECT id FROM users WHERE cyber_name = ?').bind(cyberName).first();
    const suggestedName = nameTaken ? `${email}_${crypto.randomUUID().slice(0, 6)}` : cyberName;

    return new Response(JSON.stringify(jsonSuccess({
      action: 'new_account',
      message: 'No account found with this email. Confirm to create a new account.',
      suggested_cyber_name: suggestedName,
    })), { headers: { 'Content-Type': 'application/json' } });
  }

  // ── 状态 D：未注册 + 确认 → 创建账户 ──
  // IP 限流
  const isTestMode = (env as Record<string, unknown>).TEST_MODE === 'true';
  if (!isTestMode) {
    const remaining = await checkEmailRateLimit(request, env);
    if (remaining !== null) {
      const mins = Math.floor(remaining / 60);
      const secs = remaining % 60;
      return new Response(JSON.stringify(jsonError(ErrorCodes.RATE_LIMIT_EXCEEDED,
        mins > 0 ? `Please wait ${mins} min ${secs} sec before trying again`
                 : `Please wait ${secs} seconds before trying again`)), {
        status: 429, headers: { 'Content-Type': 'application/json' },
      });
    }
  }

  const cyberName = email;
  // 再次检查 cyber_name（极端并发场景）
  const nameTaken2 = await env.DB.prepare('SELECT id FROM users WHERE cyber_name = ?').bind(cyberName).first();
  const finalName = nameTaken2 ? `${email}_${crypto.randomUUID().slice(0, 6)}` : cyberName;

  const entropySeed = crypto.randomUUID();
  const userId = 'usr_' + crypto.randomUUID().replace(/-/g, '').slice(0, 12);
  const authKeyHash = await sha256(key + entropySeed);
  const now = new Date().toISOString();

  // 创建用户
  await env.DB.prepare(
    `INSERT INTO users (id, cyber_name, auth_key_hash, email, email_verified, entropy_seed, created_at, updated_at)
     VALUES (?, ?, ?, ?, 0, ?, ?, ?)`
  ).bind(userId, finalName, authKeyHash, email, entropySeed, now, now).run();

  // 生成验证码 + Token
  const code = generateVerificationCode();
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  const ipHash = await sha256(ip);

  await storeVerificationCode(env, email, code, ipHash, 'verify');
  const token = await createSession(env, userId);

  // 发送验证邮件
  if (isTestMode) {
    console.log(`[TEST_MODE] Verification code for ${email}: ${code}`);
  } else {
    const sent = await sendVerificationEmail(env, email, code);
    if (!sent) console.warn(`[connect] Verification email failed for ${email} (user ${userId})`);
  }

  const deadline = new Date(Date.now() + 3 * 24 * 3600 * 1000).toISOString();

  return new Response(JSON.stringify(jsonSuccess({
    action: 'registered',
    user: {
      id: userId,
      cyber_name: finalName,
      class: 'apprentice',
      email,
      email_verified: false,
      verification_deadline: deadline,
      created_at: now,
    },
    token,
    token_type: 'Bearer',
  })), { status: 201, headers: { 'Content-Type': 'application/json' } });
}

async function createSession(env: Env, userId: string): Promise<string> {
  const token = 'cau_' + crypto.randomUUID().replace(/-/g, '') +
    Array.from(crypto.getRandomValues(new Uint8Array(8))).map(b => b.toString(16).padStart(2, '0')).join('');
  const tokenHash = await sha256(token);
  await env.DB.prepare(
    'INSERT INTO sessions (id, user_id, token_hash, created_at) VALUES (?, ?, ?, ?)'
  ).bind(crypto.randomUUID(), userId, tokenHash, new Date().toISOString()).run();
  return token;
}
