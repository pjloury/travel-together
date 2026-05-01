/**
 * Smoke tests — run without credentials; verify public-facing pages load.
 * These should always pass regardless of test account availability.
 */
import { test, expect } from '@playwright/test';

test.describe('Smoke — public pages', () => {

  test('login page loads', async ({ page }) => {
    const res = await page.goto('/login');
    expect(res.status()).toBeLessThan(400);
    await expect(page.locator('input[type="email"]')).toBeVisible({ timeout: 10_000 });
  });

  test('register page loads', async ({ page }) => {
    const res = await page.goto('/register');
    expect(res.status()).toBeLessThan(400);
    await expect(page.locator('input[type="email"]')).toBeVisible({ timeout: 10_000 });
  });

  test('forgot-password page loads', async ({ page }) => {
    const res = await page.goto('/forgot-password');
    expect(res.status()).toBeLessThan(400);
    await expect(page.locator('input[type="email"]')).toBeVisible({ timeout: 10_000 });
  });

  test('discover page loads', async ({ page }) => {
    const res = await page.goto('/discover');
    expect(res.status()).toBeLessThan(400);
    // Some content must render — tab bar or loading state
    await expect(page.locator('body')).not.toBeEmpty();
    await page.waitForTimeout(1000);
  });

  test('join page loads', async ({ page }) => {
    const res = await page.goto('/join');
    expect(res.status()).toBeLessThan(400);
    await expect(page.locator('body')).not.toBeEmpty();
  });

  test('no console errors on login page', async ({ page }) => {
    const errors = [];
    page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
    await page.goto('/login');
    await page.waitForTimeout(2000);
    // Filter out known benign errors (extension noise, etc.)
    const appErrors = errors.filter(e =>
      !e.includes('favicon') &&
      !e.includes('extension') &&
      !e.includes('net::ERR') &&
      !e.includes('FedCM')    // Google FedCM noise in non-Chrome
    );
    expect(appErrors).toHaveLength(0);
  });

  test('API base URL is not localhost in production bundle', async ({ page }) => {
    await page.goto('/login');
    // If VITE_API_URL was missing at build time, the bundle will contain localhost:3000
    const jsFiles = [];
    page.on('response', res => {
      if (res.url().includes('/assets/') && res.url().endsWith('.js')) jsFiles.push(res.url());
    });
    await page.waitForTimeout(2000);
    for (const url of jsFiles.slice(0, 2)) {
      const text = await page.evaluate(u => fetch(u).then(r => r.text()), url).catch(() => '');
      expect(text).not.toContain('localhost:3000');
    }
  });

});
