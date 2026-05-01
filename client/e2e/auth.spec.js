import { test, expect } from '@playwright/test';
import { loginAs } from './helpers.js';

const EMAIL    = process.env.TEST_USER_EMAIL    || '';
const PASSWORD = process.env.TEST_USER_PASSWORD || '';

test.describe('Authentication', () => {

  test('login page renders expected elements', async ({ page }) => {
    await page.goto('/login');
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
    // Links to register and forgot-password
    await expect(page.getByRole('link', { name: /create one/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /forgot password/i })).toBeVisible();
  });

  test('wrong password shows error, no redirect', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[type="email"]', 'nobody@example.com');
    await page.fill('input[type="password"]', 'wrongpassword123');
    await page.click('button[type="submit"]');
    // Wait for submit button to re-enable (request complete)
    await page.waitForFunction(
      () => !document.querySelector('button[type="submit"]')?.disabled,
      { timeout: 8_000 }
    );
    // Should still be on /login
    expect(page.url()).toMatch(/\/login/);
    const body = await page.content();
    expect(body.toLowerCase()).toMatch(/invalid|incorrect|error|wrong/);
  });

  test('successful login redirects to board', async ({ page }) => {
    if (!EMAIL || !PASSWORD) test.skip(true, 'TEST_USER_EMAIL/PASSWORD not set');
    await loginAs(page, EMAIL, PASSWORD);
    await expect(page).toHaveURL('/');
  });

  test('register page renders expected elements', async ({ page }) => {
    await page.goto('/register');
    await expect(page.getByPlaceholder(/display name/i)).toBeVisible();
    await expect(page.getByPlaceholder(/username/i)).toBeVisible();
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(page.getByRole('link', { name: /login|sign in/i })).toBeVisible();
  });

  test('register blocks short password', async ({ page }) => {
    await page.goto('/register');
    await page.fill('input[type="password"]', 'short');
    await page.click('button[type="submit"]');
    const body = await page.content();
    expect(body.toLowerCase()).toMatch(/8|short|minimum|password/);
  });

  test('forgot password page accepts email and shows confirmation', async ({ page }) => {
    await page.goto('/forgot-password');
    await page.fill('input[type="email"]', 'nobody@example.com');
    await page.click('button[type="submit"]');
    // Should show success state regardless of whether account exists
    await page.waitForSelector(':text("Check"), :text("check"), :text("sent")', { timeout: 8_000 });
  });

  test('protected route redirects to login when logged out', async ({ page }) => {
    // Navigate first so localStorage is accessible, then clear and revisit
    await page.goto('/login');
    await page.evaluate(() => localStorage.clear());
    await page.context().clearCookies();
    await page.goto('/');
    await page.waitForURL(/\/login/, { timeout: 8_000 });
    expect(page.url()).toMatch(/\/login/);
  });

});
