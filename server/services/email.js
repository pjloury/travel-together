// Email service — sends transactional emails via SMTP (nodemailer).
// Configure via env vars: SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM

const nodemailer = require('nodemailer');

function getTransporter() {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) return null;
  return nodemailer.createTransport({
    host: SMTP_HOST,
    port: parseInt(SMTP_PORT || '587'),
    secure: parseInt(SMTP_PORT || '587') === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });
}

const FROM = process.env.SMTP_FROM || process.env.SMTP_USER || 'noreply@traveltogether.app';
const APP_URL = process.env.APP_URL || 'https://travel-together.vercel.app';

/**
 * Send an invite email to a non-user.
 * @param {Object} opts
 * @param {string} opts.toEmail      - Recipient email
 * @param {string} opts.inviterName  - Display name of the person inviting
 * @param {string} opts.inviterUsername - Username for profile link
 */
async function sendInviteEmail({ toEmail, inviterName, inviterUsername }) {
  const transporter = getTransporter();
  if (!transporter) {
    console.warn('Email not configured — skipping invite email to', toEmail);
    return { skipped: true };
  }

  const profileUrl = inviterUsername
    ? `${APP_URL}/u/${inviterUsername}`
    : APP_URL;
  const registerUrl = `${APP_URL}/register`;

  const html = `
<!DOCTYPE html>
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
  </style>
</head>
<body>
  <div class="wrap">
    <div class="logo">Travel Together</div>
    <h1>${inviterName} tagged you in a memory.</h1>
    <p>
      ${inviterName} mentioned you while logging a trip on Travel Together —
      the app for capturing where you've been and dreaming about where you're going.
    </p>
    <p>
      See their travel memories, and create your own travel profile.
    </p>
    <a href="${profileUrl}" class="btn">View ${inviterName.split(' ')[0]}'s profile</a>
    <a href="${registerUrl}" class="btn btn-ghost">Create your account</a>
    <div class="footer">
      You received this because ${inviterName} added your email while logging a travel memory.<br>
      Travel Together · <a href="${APP_URL}" style="color:inherit">${APP_URL.replace('https://', '')}</a>
    </div>
  </div>
</body>
</html>`;

  await transporter.sendMail({
    from: `Travel Together <${FROM}>`,
    to: toEmail,
    subject: `${inviterName} tagged you in a travel memory`,
    html,
    text: `${inviterName} tagged you in a travel memory on Travel Together.\n\nSee their profile: ${profileUrl}\nCreate your account: ${registerUrl}`,
  });

  return { sent: true };
}

module.exports = { sendInviteEmail };
