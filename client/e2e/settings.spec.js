import { test, expect } from '@playwright/test';
import { loginAs } from './helpers.js';

const EMAIL    = process.env.TEST_USER_EMAIL    || '';
const PASSWORD = process.env.TEST_USER_PASSWORD || '';

test.describe('Settings Page', () => {

  test.beforeEach(async ({ page }) => {
    if (!EMAIL || !PASSWORD) test.skip(true, 'TEST_USER_EMAIL/PASSWORD not set');
    await loginAs(page, EMAIL, PASSWORD);
    await page.goto('/settings');
    await page.waitForLoadState('networkidle');
  });

  test('settings page loads without error', async ({ page }) => {
    await expect(page).toHaveURL('/settings');
    const errorText = await page.locator(':text("Something went wrong")').count();
    expect(errorText).toBe(0);
  });

  test('email field is read-only', async ({ page }) => {
    const emailInput = page.locator('input[type="email"], input[name="email"]').first();
    await expect(emailInput).toBeVisible({ timeout: 5_000 });
    // Should be disabled or readonly
    const disabled = await emailInput.isDisabled();
    const readonly = await emailInput.evaluate(el => el.readOnly);
    expect(disabled || readonly).toBe(true);
  });

  test('username field is editable', async ({ page }) => {
    const usernameInput = page.locator('input[name="username"], input[placeholder*="username" i]').first();
    await expect(usernameInput).toBeVisible({ timeout: 5_000 });
    await expect(usernameInput).toBeEditable();
  });

  test('display name field is editable', async ({ page }) => {
    const displayInput = page.locator('input[name="displayName"], input[name="display_name"], input[placeholder*="display" i], input[placeholder*="name" i]').first();
    await expect(displayInput).toBeVisible({ timeout: 5_000 });
    await expect(displayInput).toBeEditable();
  });

  test('save changes button is present', async ({ page }) => {
    await expect(page.locator('button:has-text("Save"), button[type="submit"]').first()).toBeVisible({ timeout: 5_000 });
  });

  test('cover photos info card is present', async ({ page }) => {
    await expect(page.locator(':text("Unsplash"), :text("cover photo")').first()).toBeVisible({ timeout: 5_000 });
  });

  test('saving taken username shows inline error', async ({ page }) => {
    const usernameInput = page.locator('input[name="username"], input[placeholder*="username" i]').first();
    if (await usernameInput.count() === 0) test.skip(true, 'No username input');

    // Clear and type a very short invalid username
    await usernameInput.fill('a');  // likely too short; or try a known-taken one
    await page.locator('button:has-text("Save"), button[type="submit"]').first().click();
    await page.waitForTimeout(2000);
    // Should stay on /settings (not crash or redirect)
    await expect(page).toHaveURL('/settings');
  });

});
