/**
 * 邮件发送封装 — Phase 0
 * 通过 Resend SDK 发送验证码和恢复邮件
 */
import { Env } from '../db/schema';

interface SendEmailParams {
  to: string;
  subject: string;
  text: string;
  html: string;
}

/**
 * 发送验证邮件。使用 Resend REST API（fetch 直接调用，零额外依赖）。
 * 发送失败不抛异常——仅 console.error 记录日志，用户可请求重发。
 */
export async function sendEmail(env: Env, params: SendEmailParams): Promise<boolean> {
  if (!env.RESEND_API_KEY) {
    console.error('[email] RESEND_API_KEY not configured');
    return false;
  }

  try {
    const resp = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${env.RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: 'Cyber Art Universe <noreply@cau.turingcorp.net>',
        to: [params.to],
        subject: params.subject,
        text: params.text,
        html: params.html,
      }),
    });

    if (!resp.ok) {
      const errBody = await resp.text().catch(() => '');
      console.error(`[email] Resend API error ${resp.status}: ${errBody}`);
      return false;
    }
    return true;
  } catch (err) {
    console.error('[email] send failed:', (err as Error).message);
    return false;
  }
}

/**
 * 发送邮箱验证码
 */
export async function sendVerificationEmail(env: Env, email: string, code: string): Promise<boolean> {
  return sendEmail(env, {
    to: email,
    subject: '验证你的 Cyber Art Universe 账户',
    text: `欢迎来到 Cyber Art Universe！\n\n你的验证码是：${code}\n\n验证码 3 天内有效。请在验证页面输入此验证码以激活你的账户。\n\n如果你没有注册 Cyber Art Universe 账户，请忽略此邮件。\n\n—— Cyber Art Universe 团队`,
    html: `<div style="font-family:sans-serif;max-width:480px;margin:0 auto">
      <h2 style="color:#7c3aed">Cyber Art Universe</h2>
      <p>欢迎来到共生共和国！</p>
      <p>你的验证码是：</p>
      <div style="background:#f4f4f5;padding:16px;border-radius:8px;text-align:center;margin:16px 0">
        <span style="font-size:32px;font-weight:bold;letter-spacing:8px;color:#7c3aed">${code}</span>
      </div>
      <p style="color:#71717a;font-size:14px">验证码 3 天内有效。</p>
      <hr style="border:none;border-top:1px solid #e4e4e7;margin:24px 0">
      <p style="color:#a1a1aa;font-size:12px">如果你没有注册 Cyber Art Universe 账户，请忽略此邮件。</p>
    </div>`,
  });
}

/**
 * 发送账户恢复验证码
 */
export async function sendRecoveryEmail(env: Env, email: string, code: string): Promise<boolean> {
  return sendEmail(env, {
    to: email,
    subject: '重置你的 Cyber Art Universe 密钥',
    text: `你请求了重置 Cyber Art Universe 账户的密钥。\n\n你的恢复验证码是：${code}\n\n验证码 3 天内有效。\n\n如果你没有请求重置密钥，请忽略此邮件。\n\n—— Cyber Art Universe 团队`,
    html: `<div style="font-family:sans-serif;max-width:480px;margin:0 auto">
      <h2 style="color:#7c3aed">Cyber Art Universe</h2>
      <p>你请求了重置账户密钥。</p>
      <p>你的恢复验证码是：</p>
      <div style="background:#f4f4f5;padding:16px;border-radius:8px;text-align:center;margin:16px 0">
        <span style="font-size:32px;font-weight:bold;letter-spacing:8px;color:#7c3aed">${code}</span>
      </div>
      <p style="color:#71717a;font-size:14px">验证码 3 天内有效。</p>
      <hr style="border:none;border-top:1px solid #e4e4e7;margin:24px 0">
      <p style="color:#a1a1aa;font-size:12px">如果你没有请求重置密钥，请忽略此邮件。</p>
    </div>`,
  });
}
