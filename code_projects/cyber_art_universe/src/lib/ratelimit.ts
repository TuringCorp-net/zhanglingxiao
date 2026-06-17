/**
 * IP 限流检查 — Phase 0
 * 通过 D1 email_verifications 表实现：同一 IP 1 小时内只能触发 1 次邮件发送
 */
import { Env } from '../db/schema';
import { sha256 } from './auth';

/**
 * 检查该 IP 在过去 1 小时内是否已触发过邮件发送。
 * @returns null 表示通过（可以发送），number 表示需等待的剩余秒数
 */
export async function checkEmailRateLimit(request: Request, env: Env): Promise<number | null> {
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  const ipHash = await sha256(ip);

  // 用 JS 计算 cutoff（避免 SQLite datetime() 与 ISO 8601 格式不兼容）
  const cutoff = new Date(Date.now() - 3600000).toISOString();
  const recent = await env.DB.prepare(
    `SELECT created_at FROM email_verifications
     WHERE ip_hash = ? AND created_at > ?
     ORDER BY created_at DESC LIMIT 1`
  ).bind(ipHash, cutoff).first<{ created_at: string }>();

  if (!recent) return null; // 通过

  // 计算剩余等待秒数
  const sentAt = new Date(recent.created_at).getTime();
  const now = Date.now();
  const elapsed = (now - sentAt) / 1000;
  const remaining = Math.ceil(3600 - elapsed);

  return remaining > 0 ? remaining : null;
}

/**
 * 生成 6 位数字验证码
 */
export function generateVerificationCode(): string {
  const array = new Uint8Array(4);
  crypto.getRandomValues(array);
  const num = (array[0] << 24 | array[1] << 16 | array[2] << 8 | array[3]) >>> 0;
  return String(num % 1000000).padStart(6, '0');
}

/**
 * 将验证码存储到 D1 email_verifications 表
 */
export async function storeVerificationCode(
  env: Env,
  email: string,
  code: string,
  ipHash: string,
  purpose: 'verify' | 'recover' = 'verify'
): Promise<void> {
  // 使该邮箱之前未验证的验证码失效
  await env.DB.prepare(
    'DELETE FROM email_verifications WHERE email = ? AND verified = 0'
  ).bind(email).run();

  const id = crypto.randomUUID();
  const codeHash = await sha256(code);
  const expiresAt = new Date(Date.now() + 3 * 24 * 3600 * 1000).toISOString(); // 3 天

  await env.DB.prepare(
    `INSERT INTO email_verifications (id, email, code_hash, ip_hash, purpose, attempts, verified, created_at, expires_at)
     VALUES (?, ?, ?, ?, ?, 0, 0, ?, ?)`
  ).bind(id, email, codeHash, ipHash, purpose, new Date().toISOString(), expiresAt).run();
}
