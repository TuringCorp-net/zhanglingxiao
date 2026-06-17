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
    subject: 'Verify your Cyber Art Universe account',
    text: `Cyber Art Universe\n\nYour verification code is: ${code}\n\nThis code is valid for 3 days. Enter it on the verification page to activate your account.\n\nIf you did not register for a Cyber Art Universe account, please ignore this email.\n\n—— Cyber Art Universe Team`,
    html: `<div style="font-family:system-ui,-apple-system,sans-serif;max-width:480px;margin:0 auto;padding:32px">
      <p style="font-size:1.25rem;margin:0 0 24px;color:#18181b">Cyber <span style="color:#7c3aed">Art</span> Universe</p>
      <p style="color:#52525b;font-size:0.9375rem;margin:0 0 16px">Your verification code is:</p>
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 24px">
        <tr><td bgcolor="#1e1b2e" style="padding:20px;border-radius:8px;text-align:center;background-image:linear-gradient(135deg, #252033, #1e1b2e)">
          <span style="font-size:32px;font-weight:700;letter-spacing:10px;color:#7c3aed;font-family:monospace">${code}</span>
        </td></tr>
      </table>
      <p style="color:#71717a;font-size:0.8125rem;margin:0 0 24px">This code is valid for 3 days.</p>
      <hr style="border:none;border-top:1px solid #d4d4d8;margin:0 0 16px">
      <p style="color:#a1a1aa;font-size:0.75rem;margin:0">If you did not register for a Cyber Art Universe account, please ignore this email.</p>
    </div>`,
  });
}

/**
 * 发送账户恢复验证码
 */
export async function sendRecoveryEmail(env: Env, email: string, code: string): Promise<boolean> {
  return sendEmail(env, {
    to: email,
    subject: 'Reset your Cyber Art Universe key',
    text: `You requested to reset your Cyber Art Universe account key.\n\nYour recovery code is: ${code}\n\nThis code is valid for 3 days.\n\nIf you did not request a key reset, please ignore this email.\n\n—— Cyber Art Universe Team`,
    html: `<div style="font-family:system-ui,-apple-system,sans-serif;max-width:480px;margin:0 auto;padding:32px">
      <p style="font-size:1.25rem;margin:0 0 24px;color:#18181b">Cyber <span style="color:#7c3aed">Art</span> Universe</p>
      <p style="color:#52525b;font-size:0.9375rem;margin:0 0 16px">Your recovery code is:</p>
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 24px">
        <tr><td bgcolor="#1e1b2e" style="padding:20px;border-radius:8px;text-align:center;background-image:linear-gradient(135deg, #252033, #1e1b2e)">
          <span style="font-size:32px;font-weight:700;letter-spacing:10px;color:#7c3aed;font-family:monospace">${code}</span>
        </td></tr>
      </table>
      <p style="color:#71717a;font-size:0.8125rem;margin:0 0 24px">This code is valid for 3 days.</p>
      <hr style="border:none;border-top:1px solid #d4d4d8;margin:0 0 16px">
      <p style="color:#a1a1aa;font-size:0.75rem;margin:0">If you did not request a key reset, please ignore this email.</p>
    </div>`,
  });
}
