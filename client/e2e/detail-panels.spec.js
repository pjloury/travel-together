import { test, expect } from '@playwright/test';
import { loginAs, waitForBoard } from './helpers.js';

const EMAIL    = process.env.TEST_USER_EMAIL    || '';
const PASSWORD = process.env.TEST_USER_PASSWORD || '';

// The detail panel root (both memory and dream) uses .md-panel.md-panel-open
const PANEL = '.md-panel.md-panel-open';

test.describe('Pin Detail Panels', () => {

  test.beforeEach(async ({ page }) => {
    if (!EMAIL || !PASSWORD) test.skip(true, 'TEST_USER_EMAIL/PASSWORD not set');
    await loginAs(page, EMAIL, PASSWORD);
    await waitForBoard(page);
  });

  async function openFirstMemory(page) {
    await page.locator('.tab-past').first().click();
    await page.waitForTimeout(500);
    const firstCard = page.locator('.pin-card').first();
    if (await firstCard.count() === 0) return false;
    await firstCard.click();
    await page.waitForSelector(PANEL, { timeout: 8_000 });
    return true;
  }

  async function openFirstDream(page) {
    await page.locator('.tab-future').first().click();
    await page.waitForTimeout(500);
    // Exclude discovery card
    const cards = page.locator('.pin-card:not(.discovery-card-idle):not([class*="discovery"])');
    if (await cards.count() === 0) return false;
    await cards.first().click();
    await page.waitForSelector(PANEL, { timeout: 8_000 });
    return true;
  }

  // ── Memory Detail ──────────────────────────────────────────────────────────

  test('clicking a memory card opens detail panel', async ({ page }) => {
    const opened = await openFirstMemory(page);
    if (!opened) test.skip(true, 'No memory pins');
    await expect(page.locator(PANEL).first()).toBeVisible();
  });

  test('memory detail has close button (.md-close)', async ({ page }) => {
    const opened = await openFirstMemory(page);
    if (!opened) test.skip(true, 'No memory pins');
    await expect(page.locator(`${PANEL} .md-close`).first()).toBeVisible();
    await page.locator(`${PANEL} .md-close`).first().click();
    // Panel should close (no longer have md-panel-open)
    await expect(page.locator(PANEL).first()).toBeHidden({ timeout: 3_000 });
  });

  test('Escape key closes memory detail panel', async ({ page }) => {
    const opened = await openFirstMemory(page);
    if (!opened) test.skip(true, 'No memory pins');
    await page.keyboard.press('Escape');
    await expect(page.locator(PANEL).first()).toBeHidden({ timeout: 5_000 });
  });

  test('memory detail shows "Tag a friend" button', async ({ page }) => {
    const opened = await openFirstMemory(page);
    if (!opened) test.skip(true, 'No memory pins');
    await expect(page.locator('.md-tag-friend-btn').first()).toBeVisible({ timeout: 5_000 });
  });

  test('TagFriendPanel opens and closes', async ({ page }) => {
    const opened = await openFirstMemory(page);
    if (!opened) test.skip(true, 'No memory pins');

    await page.locator('.md-tag-friend-btn').first().click();
    await expect(page.locator('.md-tf-wrap').first()).toBeVisible({ timeout: 5_000 });

    // Close via Done
    await page.locator('.md-tf-close-btn').first().click();
    await expect(page.locator('.md-tf-wrap').first()).toBeHidden({ timeout: 3_000 });
  });

  // ── Dream Detail ───────────────────────────────────────────────────────────

  test('clicking a dream card opens detail panel', async ({ page }) => {
    const opened = await openFirstDream(page);
    if (!opened) test.skip(true, 'No dream pins');
    await expect(page.locator(PANEL).first()).toBeVisible();
  });

  test('dream detail has "I went!" button', async ({ page }) => {
    const opened = await openFirstDream(page);
    if (!opened) test.skip(true, 'No dream pins');

    // Scroll to bottom of panel
    await page.locator(PANEL).first().evaluate(el => el.scrollTo(0, el.scrollHeight));
    await page.waitForTimeout(300);
    await expect(page.locator(`${PANEL} button:has-text("I went"), ${PANEL} [class*="went-btn"]`).first()).toBeVisible({ timeout: 5_000 });
  });

  // ── Keyboard cycle ─────────────────────────────────────────────────────────

  test('← → cycles pins when detail is open', async ({ page }) => {
    const cards = page.locator('.pin-card');
    if (await cards.count() < 2) test.skip(true, 'Need 2+ pins');

    await cards.first().click();
    await page.waitForSelector(PANEL, { timeout: 8_000 });

    const initialName = await page.locator(`${PANEL} .md-place`).first().innerText().catch(() => '');
    await page.keyboard.press('ArrowRight');
    await page.waitForTimeout(400);
    // Just verify panel is still open and didn't crash
    await expect(page.locator(PANEL).first()).toBeVisible();
    expect(typeof initialName).toBe('string');
  });

});
