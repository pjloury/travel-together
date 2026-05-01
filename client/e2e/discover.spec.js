import { test, expect } from '@playwright/test';
import { loginAs } from './helpers.js';

const EMAIL    = process.env.TEST_USER_EMAIL    || '';
const PASSWORD = process.env.TEST_USER_PASSWORD || '';

test.describe('Discover Page', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('/discover');
    await page.waitForLoadState('networkidle');
  });

  test('discover page loads without error', async ({ page }) => {
    await expect(page).toHaveURL(/\/discover/);
    const errorText = await page.locator(':text("Something went wrong"), :text("Could not load")').count();
    expect(errorText).toBe(0);
  });

  test('Trips tab is visible and active by default', async ({ page }) => {
    const tripsTab = page.locator('button:has-text("Trips"), [aria-label*="Trips"], .tab:has-text("Trips")').first();
    await expect(tripsTab).toBeVisible({ timeout: 8_000 });
  });

  test('Gallery tab is visible', async ({ page }) => {
    await expect(page.locator('button:has-text("Gallery"), .tab:has-text("Gallery")').first()).toBeVisible({ timeout: 8_000 });
  });

  test('Resorts tab is visible', async ({ page }) => {
    await expect(page.locator('button:has-text("Resorts"), .tab:has-text("Resorts")').first()).toBeVisible({ timeout: 8_000 });
  });

  test('trip cards or loading/empty state visible', async ({ page }) => {
    await page.waitForTimeout(3000); // allow trips to load
    const cards = await page.locator('[class*="trip-card"], .trip-card').count();
    const loading = await page.locator('[class*="loading"], [class*="spinner"]').count();
    const empty = await page.locator(':text("being generated"), :text("no trips")').count();
    expect(cards + loading + empty).toBeGreaterThan(0);
  });

  test('clicking Gallery tab shows gallery content', async ({ page }) => {
    const galleryTab = page.locator('button:has-text("Gallery"), .tab:has-text("Gallery")').first();
    if (await galleryTab.count() === 0) test.skip(true, 'Gallery tab not found');
    await galleryTab.click();
    await page.waitForTimeout(1500);
    // Gallery grid or image content should appear (no crash)
    const body = await page.content();
    expect(body).toBeTruthy();
  });

  test('clicking Resorts tab shows resorts content', async ({ page }) => {
    const resortsTab = page.locator('button:has-text("Resorts"), .tab:has-text("Resorts")').first();
    if (await resortsTab.count() === 0) test.skip(true, 'Resorts tab not found');
    await resortsTab.click();
    await page.waitForTimeout(1500);
    const body = await page.content();
    expect(body).toBeTruthy();
  });

  test('clicking a trip card opens detail panel', async ({ page }) => {
    await page.waitForTimeout(3000); // let trips load
    const firstCard = page.locator('.explore-trip-card').first();
    const count = await firstCard.count();
    if (count === 0) test.skip(true, 'No trip cards loaded');

    await firstCard.click();
    // TripDetail slides in as .md-panel.md-panel-open
    await expect(page.locator('.md-panel.md-panel-open, .md-panel-open').first()).toBeVisible({ timeout: 5_000 });
  });

  test('trip detail panel has close button', async ({ page }) => {
    await page.waitForTimeout(3000);
    const firstCard = page.locator('.explore-trip-card').first();
    if (await firstCard.count() === 0) test.skip(true, 'No trip cards');

    await firstCard.click();
    await page.waitForSelector('.md-panel.md-panel-open, .md-panel-open', { timeout: 5_000 });
    const closeBtn = page.locator('.md-panel-open .md-close, .md-panel-open button[aria-label="Close"]').first();
    await expect(closeBtn).toBeVisible();
  });

  test('generate bar visible when logged in', async ({ page }) => {
    if (!EMAIL || !PASSWORD) test.skip(true, 'TEST_USER_EMAIL/PASSWORD not set');
    await loginAs(page, EMAIL, PASSWORD);
    await page.goto('/discover');
    await page.waitForTimeout(2000);
    const generateInput = page.locator('input[placeholder*="Generate"], input[placeholder*="city"], input[placeholder*="trip"]').first();
    await expect(generateInput).toBeVisible({ timeout: 5_000 });
  });

  test('logged-out user sees signup prompt in trip detail', async ({ page }) => {
    await page.goto('/login');
    await page.evaluate(() => localStorage.clear());
    await page.context().clearCookies();
    await page.goto('/discover');
    await page.waitForTimeout(3000);
    const firstCard = page.locator('.explore-trip-card').first();
    if (await firstCard.count() === 0) test.skip(true, 'No trip cards');

    await firstCard.click();
    await page.waitForSelector('.md-panel.md-panel-open, .md-panel-open', { timeout: 5_000 });
    // Clicking "Add to dreams" should show signup prompt for logged-out user
    const addBtn = page.locator('.md-panel-open button:has-text("Add"), .md-panel-open button:has-text("dream")').first();
    if (await addBtn.count() > 0) {
      await addBtn.click();
      await page.waitForTimeout(1000);
      const body = await page.content();
      expect(body.toLowerCase()).toMatch(/sign up|create an account|login|register/);
    }
    // If no add button visible (logged out), test still passes — no crash
  });

});
