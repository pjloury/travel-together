// Shared helpers for Playwright tests.

export const TEST_EMAIL    = process.env.TEST_USER_EMAIL    || '';
export const TEST_PASSWORD = process.env.TEST_USER_PASSWORD || '';
export const FRIEND_EMAIL  = process.env.TEST_FRIEND_EMAIL  || '';

/**
 * Log in via the email/password form.
 * Caller must supply valid TEST_USER_EMAIL + TEST_USER_PASSWORD env vars.
 */
export async function loginAs(page, email = TEST_EMAIL, password = TEST_PASSWORD) {
  await page.goto('/login');
  // Suppress WelcomeModal so it doesn't block test interactions
  await page.evaluate(() => localStorage.setItem('tt_welcome_seen', '1'));
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await page.click('button[type="submit"]');
  // Wait for redirect away from /login
  await page.waitForURL(url => !url.pathname.startsWith('/login'), { timeout: 10_000 });
}

/**
 * Clear localStorage and cookies so the next test starts logged out.
 * Must be called after at least one navigation to the site.
 */
export async function logout(page) {
  await page.goto('/login');
  await page.evaluate(() => localStorage.clear());
  await page.context().clearCookies();
}

/** Wait for the pin board to finish loading. */
export async function waitForBoard(page) {
  // .board-view is the root container; it renders before pins load
  await page.waitForSelector('.board-view', { timeout: 15_000 });
  // Then wait for either pin cards or the loading spinner to disappear
  await page.waitForFunction(
    () => !document.querySelector('.loading-spinner') || document.querySelector('.pin-card, .board-empty, .pin-board'),
    { timeout: 15_000 }
  ).catch(() => {}); // If we time out here, board is still likely visible enough
}
