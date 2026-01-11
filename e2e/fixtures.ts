import { test as base, expect, Page } from '@playwright/test';

// Extend base test with custom fixtures
export const test = base.extend<{
  freshSetup: void;
}>({
  // Fixture to ensure fresh setup state
  freshSetup: async ({ request }, use) => {
    // Note: In a real scenario, you'd reset the database here
    // For now, we rely on the setup being skippable
    await use();
  },
});

export { expect };

// Helper to skip through setup quickly
export async function skipSetup(page: Page) {
  await page.goto('/setup');

  // Check if we're already past setup
  const url = page.url();
  if (!url.includes('/setup')) {
    return;
  }

  // Try to skip
  const skipButton = page.locator("text=Skip setup, I'll configure later");
  if (await skipButton.isVisible({ timeout: 2000 }).catch(() => false)) {
    await skipButton.click();
    await expect(page).toHaveURL('/');
  }
}

// Helper to navigate through setup to a specific step
export async function goToSetupStep(
  page: Page,
  step: 'welcome' | 'library' | 'igdb' | 'prowlarr' | 'qbittorrent' | 'complete'
) {
  await page.goto('/setup');

  if (step === 'welcome') return;

  await page.click('text=Get Started');
  if (step === 'library') return;

  await page.click('button:has-text("Skip")');
  if (step === 'igdb') return;

  await page.click('button:has-text("Skip")');
  if (step === 'prowlarr') return;

  await page.click('button:has-text("Skip")');
  if (step === 'qbittorrent') return;

  await page.click('button:has-text("Skip")');
  // Now at complete step
}

// Setup form helpers
export const setupForms = {
  async fillLibrary(page: Page, name = 'Test Library', path = 'C:\\Games') {
    await page.fill('input[placeholder="Main Library"]', name);
    await page.fill('input[placeholder*="path/to/games"]', path);
  },

  async fillIGDB(page: Page, clientId = 'test-id', clientSecret = 'test-secret') {
    await page.fill('input[placeholder*="Client ID"]', clientId);
    await page.fill('input[placeholder*="Client Secret"]', clientSecret);
  },

  async fillProwlarr(page: Page, url = 'http://localhost:9696', apiKey = 'test-key') {
    await page.fill('input[placeholder*="localhost:9696"]', url);
    await page.fill('input[placeholder*="API Key"]', apiKey);
  },

  async fillQBittorrent(
    page: Page,
    host = 'http://localhost:8080',
    username = 'admin',
    password = 'password'
  ) {
    await page.fill('input[placeholder*="localhost:8080"]', host);
    await page.fill('input[placeholder*="Username"]', username);
    await page.fill('input[placeholder*="Password"]', password);
  },
};
