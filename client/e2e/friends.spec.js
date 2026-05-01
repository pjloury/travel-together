import { test, expect } from '@playwright/test';
import { loginAs } from './helpers.js';

const EMAIL    = process.env.TEST_USER_EMAIL    || '';
const PASSWORD = process.env.TEST_USER_PASSWORD || '';

test.describe('Friends Page', () => {

  test.beforeEach(async ({ page }) => {
    if (!EMAIL || !PASSWORD) test.skip(true, 'TEST_USER_EMAIL/PASSWORD not set');
    await loginAs(page, EMAIL, PASSWORD);
    await page.goto('/friends');
    await page.waitForLoadState('networkidle');
  });

  test('friends page loads without error', async ({ page }) => {
    await expect(page).toHaveURL('/friends');
    // No error screen
    const errorVisible = await page.locator(':text("Something went wrong"), :text("error loading")').count();
    expect(errorVisible).toBe(0);
  });

  test('"Your Friends" section present', async ({ page }) => {
    await expect(page.locator(':text("Your Friends"), [class*="friends-section"]').first()).toBeVisible({ timeout: 8_000 });
  });

  test('"Find Friends" search bar present', async ({ page }) => {
    const searchInput = page.locator('input[placeholder*="search" i], input[placeholder*="friend" i], input[placeholder*="name" i]').first();
    await expect(searchInput).toBeVisible({ timeout: 8_000 });
  });

  test('"Invite Friends" section present', async ({ page }) => {
    await expect(page.locator(':text("Invite"), :text("invite")').first()).toBeVisible({ timeout: 8_000 });
  });

  test('generate invite link button present', async ({ page }) => {
    const btn = page.locator('button:has-text("Generate invite"), button:has-text("invite link"), button:has-text("Copy")').first();
    await expect(btn).toBeVisible({ timeout: 8_000 });
  });

  test('searching for a nonexistent user shows no-results message', async ({ page }) => {
    const searchInput = page.locator('input[placeholder*="search" i], input[placeholder*="name" i], input[placeholder*="friend" i]').first();
    if (await searchInput.count() === 0) test.skip(true, 'No search input found');

    await searchInput.fill('zzznobodyexists12345');
    // Submit search (Enter or button)
    await page.keyboard.press('Enter');
    await page.waitForTimeout(2000);
    const body = await page.content();
    expect(body.toLowerCase()).toMatch(/no users found|no results|not found/);
  });

  test('searching with email triggers invite option', async ({ page }) => {
    const searchInput = page.locator('input[placeholder*="search" i], input[placeholder*="name" i], input[placeholder*="friend" i]').first();
    if (await searchInput.count() === 0) test.skip(true, 'No search input found');

    await searchInput.fill('testinvite@example.com');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(2000);
    const body = await page.content();
    // Should show option to send invite to this email
    expect(body.toLowerCase()).toMatch(/invite|send/);
  });

});
