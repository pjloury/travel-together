// Email service — sends transactional emails via Resend.
//
// Env vars:
//   RESEND_API_KEY — required (get from resend.com dashboard)
//   APP_URL        — optional, defaults to Vercel URL
//
// With a verified domain, set from address via MAIL_FROM env var.
// Without domain verification, uses Resend's onboarding@resend.dev.

const { Resend } = require('resend');

function getClient() {
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  return new Resend(key);
}

const APP_URL = process.env.FRONTEND_URL || process.env.APP_URL || 'https://travel-together.vercel.app';
const MAIL_FROM = process.env.MAIL_FROM || 'Travel Together <onboarding@resend.dev>';

/**
 * Send an invite email to a non-user.
 * @param {Object} opts
 * @param {string} opts.toEmail      - Recipient email
 * @param {string} opts.inviterName  - Display name of the person inviting
 * @param {string} opts.inviterUsername - Username for profile link
 */
async function sendInviteEmail({ toEmail, inviterName, inviterUsername }) {
  const resend = getClient();
  if (!resend) {
    console.warn('[email] RESEND_API_KEY not set — skipping invite email to', toEmail);
    return { skipped: true };
  }

  const profileUrl = inviterUsername
    ? `${APP_URL}/user/${inviterUsername}`
    : APP_URL;
  const registerUrl = `${APP_URL}/register`;

  const html = buildInviteHtml({ inviterName, profileUrl, registerUrl });

  const { error } = await resend.emails.send({
    from: MAIL_FROM,
    to: [toEmail],
    subject: `${inviterName} tagged you in a travel memory`,
    html,
    text: `${inviterName} tagged you in a travel memory on Travel Together.\n\nSee their profile: ${profileUrl}\nCreate your account: ${registerUrl}`,
  });

  if (error) {
    console.error('[email] Resend invite error:', error);
    throw new Error(error.message || 'Failed to send invite email');
  }

  console.log('[email] Invite sent to', toEmail);
  return { sent: true };
}

/**
 * Send a password reset email.
 * @param {Object} opts
 * @param {string} opts.toEmail - Recipient email
 * @param {string} opts.token   - Password reset token
 */
async function sendPasswordResetEmail({ toEmail, token }) {
  const resend = getClient();
  if (!resend) {
    console.warn('[email] RESEND_API_KEY not set — skipping password reset email to', toEmail);
    return { skipped: true };
  }

  const resetUrl = `${APP_URL}/reset-password?token=${token}`;

  const html = buildResetHtml({ resetUrl });

  const { error } = await resend.emails.send({
    from: MAIL_FROM,
    to: [toEmail],
    subject: 'Reset your Travel Together password',
    html,
    text: `You requested a password reset for your Travel Together account.\n\nReset your password: ${resetUrl}\n\nThis link expires in 1 hour. If you didn't request this, you can safely ignore this email.`,
  });

  if (error) {
    console.error('[email] Resend reset error:', error);
    throw new Error(error.message || 'Failed to send reset email');
  }

  console.log('[email] Password reset sent to', toEmail);
  return { sent: true };
}

// ── HTML templates ─────────────────────────────────────────────────────────

function emailShell(content) {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    body { margin: 0; padding: 0; background: #0A0A0A; font-family: -apple-system, 'Inter', sans-serif; }
    .wrap { max-width: 520px; margin: 0 auto; padding: 48px 24px; }
    .logo { font-size: 13px; letter-spacing: 0.3em; text-transform: uppercase;
            color: #C9A84C; margin-bottom: 48px; }
    h1 { font-size: 32px; font-weight: 300; color: #FAFAFA; margin: 0 0 20px;
         font-family: Georgia, serif; line-height: 1.2; }
    p { font-size: 15px; color: rgba(250,250,250,0.6); line-height: 1.7; margin: 0 0 24px; }
    .btn { display: inline-block; padding: 14px 28px; background: #C9A84C; color: #0A0A0A;
           text-decoration: none; font-size: 13px; font-weight: 600;
           letter-spacing: 0.1em; text-transform: uppercase; margin: 8px 8px 8px 0; }
    .btn-ghost { background: transparent; color: #FAFAFA;
                 border: 1px solid rgba(250,250,250,0.3); }
    .footer { margin-top: 48px; font-size: 11px; color: rgba(250,250,250,0.3);
              letter-spacing: 0.04em; }
    .footer a { color: inherit; }
  </style>
</head>
<body>
  <div class="wrap">
    <div class="logo">Travel Together</div>
    ${content}
  </div>
</body>
</html>`;
}

function buildInviteHtml({ inviterName, profileUrl, registerUrl }) {
  return emailShell(`
    <h1>${inviterName} tagged you in a memory.</h1>
    <p>
      ${inviterName} mentioned you while logging a trip on Travel Together &mdash;
      the app for capturing where you've been and dreaming about where you're going.
    </p>
    <p>
      See their travel memories, and create your own travel profile.
    </p>
    <a href="${profileUrl}" class="btn">View ${inviterName.split(' ')[0]}'s profile</a>
    <a href="${registerUrl}" class="btn btn-ghost">Create your account</a>
    <div class="footer">
      You received this because ${inviterName} added your email while logging a travel memory.<br>
      Travel Together &middot; <a href="${APP_URL}">${APP_URL.replace('https://', '')}</a>
    </div>`);
}

function buildResetHtml({ resetUrl }) {
  return emailShell(`
    <h1>Reset your password</h1>
    <p>
      You requested a password reset for your Travel Together account.
      Click the button below to choose a new password.
    </p>
    <a href="${resetUrl}" class="btn">Reset Password</a>
    <p style="font-size: 13px; color: rgba(250,250,250,0.35);">
      This link expires in 1 hour. If you didn't request this, you can safely ignore this email.
    </p>
    <div class="footer">
      Travel Together &middot; <a href="${APP_URL}">${APP_URL.replace('https://', '')}</a>
    </div>`);
}

module.exports = { sendInviteEmail, sendPasswordResetEmail };
