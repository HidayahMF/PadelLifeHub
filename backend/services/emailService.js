// Email service — wraps the Resend API. When RESEND_API_KEY is not set the
// service degrades to console logging so development and tests keep working
// without a provider.

const { Resend } = require('resend');

const FROM =
  process.env.EMAIL_FROM || 'LifeHub <onboarding@resend.dev>';

let resend = null;
try {
  if (process.env.RESEND_API_KEY) {
    resend = new Resend(process.env.RESEND_API_KEY);
  }
} catch (err) {
  console.error(`[email] failed to init Resend: ${err.message}`);
}

/** Whether an email provider is configured. */
function isConfigured() {
  return !!resend;
}

/** Base template — dark on-brand colors, works across clients. */
function layout(subject, bodyHtml) {
  return `<!doctype html>
<html>
  <body style="margin:0;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;background:#f4f4f4;color:#1a1a1a">
    <div style="max-width:520px;margin:32px auto;background:#ffffff;border-radius:12px;overflow:hidden;border:2px solid #1a1a1a;box-shadow:4px 4px 0 #1a1a1a">
      <div style="background:#5b8cff;padding:16px 24px;color:#ffffff;font-weight:800;font-size:18px;border-bottom:2px solid #1a1a1a">LifeHub</div>
      <div style="padding:24px">
        <h2 style="margin:0 0 12px;font-size:18px">${subject}</h2>
        ${bodyHtml}
        <p style="margin-top:24px;font-size:12px;color:#888;border-top:1px solid #eee;padding-top:12px">
          LifeHub — personal productivity &amp; finance. If you didn't expect this email, you can ignore it.
        </p>
      </div>
    </div>
  </body>
</html>`;
}

/**
 * Send an email. Returns true when the provider accepted it, false otherwise
 * (including when email is not configured — the caller decides whether to log).
 */
async function sendMail({ to, subject, html, text }) {
  if (!resend) {
    console.log(`[email] (not configured) would send to ${to}: ${subject}`);
    return false;
  }
  try {
    await resend.emails.send({ from: FROM, to, subject, html, text });
    return true;
  } catch (err) {
    console.error(`[email] send failed to ${to}: ${err.message}`);
    return false;
  }
}

/** Password reset email with the frontend reset URL. */
async function sendPasswordReset(to, resetUrl) {
  return sendMail({
    to,
    subject: 'Reset your LifeHub password',
    text: `Use this link to reset your password (valid for 1 hour): ${resetUrl}`,
    html: layout('Reset your LifeHub password', `
      <p>We received a request to reset your password.</p>
      <p style="margin:20px 0">
        <a href="${resetUrl}" style="display:inline-block;background:#1a1a1a;color:#fff;text-decoration:none;padding:12px 20px;border-radius:8px;font-weight:700">Reset password</a>
      </p>
      <p>Or copy this link: <a href="${resetUrl}">${resetUrl}</a></p>
      <p>This link expires in <strong>1 hour</strong>. If you didn't request this, you can safely ignore this email.</p>
    `),
  });
}

/** Reminder / notification email. */
async function sendNotification(to, { subject, message }) {
  return sendMail({
    to,
    subject,
    text: message,
    html: layout(subject, `<p>${message}</p>`),
  });
}

module.exports = { isConfigured, sendMail, sendPasswordReset, sendNotification };
