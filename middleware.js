// Vercel Edge Middleware — intercepts /join/:code for bot crawlers
// Serves dynamic OG meta tags for link previews (iMessage, WhatsApp, Slack)
// Real browsers pass through to the SPA

const API_URL = process.env.VITE_API_URL || 'https://travel-together-jsgy.onrender.com/api';
const FRONTEND_URL = 'https://travel-together.pjloury.com';

export const config = {
  matcher: '/join/:code*',
};

export default async function middleware(req) {
  const ua = (req.headers.get('user-agent') || '').toLowerCase();
  const isBot = /bot|crawl|spider|preview|facebookexternalhit|whatsapp|telegrambot|twitterbot|slackbot|linkedinbot|discordbot|applebot/i.test(ua);

  if (!isBot) {
    // Real browser — let it through to the SPA
    return;
  }

  // Extract code from URL
  const url = new URL(req.url);
  const code = url.pathname.split('/join/')[1]?.split('/')[0]?.split('?')[0];
  if (!code) return;

  // Fetch inviter info
  let inviterName = 'A friend';
  let memoryCount = 0;
  let dreamCount = 0;

  try {
    const apiRes = await fetch(`${API_URL}/invites/info/${code}`);
    if (apiRes.ok) {
      const data = await apiRes.json();
      const inviter = data.inviter || {};
      inviterName = inviter.displayName || 'A friend';
      memoryCount = inviter.memoryCount || 0;
      dreamCount = inviter.dreamCount || 0;
    }
  } catch {
    // Fall back to generic
  }

  const title = `${inviterName} invited you to Travel Together`;
  const description = `${inviterName} has ${memoryCount} travel memor${memoryCount === 1 ? 'y' : 'ies'} and ${dreamCount} dream destination${dreamCount === 1 ? '' : 's'}. Join to share yours and plan trips together.`;
  const pageUrl = `${FRONTEND_URL}/join/${code}`;

  return new Response(
    `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${title}</title>
  <meta property="og:title" content="${title}" />
  <meta property="og:description" content="${description}" />
  <meta property="og:image" content="${FRONTEND_URL}/hero-bg.jpg" />
  <meta property="og:image:width" content="2560" />
  <meta property="og:image:height" content="1706" />
  <meta property="og:type" content="website" />
  <meta property="og:site_name" content="Travel Together" />
  <meta property="og:url" content="${pageUrl}" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${title}" />
  <meta name="twitter:description" content="${description}" />
  <meta name="twitter:image" content="${FRONTEND_URL}/hero-bg.jpg" />
  <meta name="description" content="${description}" />
  <meta http-equiv="refresh" content="0;url=${pageUrl}" />
</head>
<body>
  <p>Redirecting to <a href="${pageUrl}">Travel Together</a>...</p>
</body>
</html>`,
    { headers: { 'Content-Type': 'text/html; charset=utf-8' } }
  );
}
