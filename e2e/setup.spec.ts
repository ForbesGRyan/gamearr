import { test, expect } from '@playwright/test';

test.describe('Setup Wizard', () => {
  test('displays welcome screen on first visit', async ({ page }) => {
    await page.goto('/setup');

    // Should show welcome message
    await expect(page.locator('text=Welcome to Gamearr')).toBeVisible();
    await expect(page.locator('text=Get Started')).toBeVisible();
    await expect(page.locator("text=Skip setup, I'll configure later")).toBeVisible();
  });

  test('can skip setup and navigate to homepage', async ({ page }) => {
    await page.goto('/setup');

    // Click skip setup
    await page.click("text=Skip setup, I'll configure later");

    // Should navigate to homepage
    await expect(page).toHaveURL('/');
  });

  test('can navigate through setup steps using Skip', async ({ page }) => {
    await page.goto('/setup');

    // Step 1: Welcome
    await expect(page.locator('text=Welcome to Gamearr')).toBeVisible();
    await page.click('text=Get Started');

    // Step 2: Library
    await expect(page.locator('text=Library Location')).toBeVisible();
    await page.click('button:has-text("Skip")');

    // Step 3: IGDB
    await expect(page.locator('text=IGDB API')).toBeVisible();
    await page.click('button:has-text("Skip")');

    // Step 4: Prowlarr
    await expect(page.locator('text=Prowlarr')).toBeVisible();
    await page.click('button:has-text("Skip")');

    // Step 5: qBittorrent
    await expect(page.locator('text=qBittorrent')).toBeVisible();
    await page.click('button:has-text("Skip")');

    // Step 6: Complete
    await expect(page.locator("text=You're All Set!")).toBeVisible();
    await expect(page.locator('text=Start Using Gamearr')).toBeVisible();
  });

  test('can fill forms and continue through setup', async ({ page }) => {
    await page.goto('/setup');

    // Step 1: Welcome
    await page.click('text=Get Started');

    // Step 2: Library - fill form
    await expect(page.locator('text=Library Location')).toBeVisible();
    await page.fill('input[placeholder="Main Library"]', 'My Games');
    await page.fill('input[placeholder*="path/to/games"]', 'C:\\Games');
    // Skip since we don't have a real path
    await page.click('button:has-text("Skip")');

    // Step 3: IGDB - fill form
    await expect(page.locator('text=IGDB API')).toBeVisible();
    await page.fill('input[placeholder*="Client ID"]', 'test-client-id');
    await page.fill('input[placeholder*="Client Secret"]', 'test-secret');
    // Skip since we don't have real credentials
    await page.click('button:has-text("Skip")');

    // Step 4: Prowlarr
    await expect(page.locator('text=Prowlarr')).toBeVisible();
    await page.click('button:has-text("Skip")');

    // Step 5: qBittorrent
    await expect(page.locator('text=qBittorrent')).toBeVisible();
    await page.click('button:has-text("Skip")');

    // Step 6: Complete
    await expect(page.locator("text=You're All Set!")).toBeVisible();
  });

  test('can go back through setup steps', async ({ page }) => {
    await page.goto('/setup');

    // Go to step 2
    await page.click('text=Get Started');
    await expect(page.locator('text=Library Location')).toBeVisible();

    // Fill library name
    await page.fill('input[placeholder="Main Library"]', 'Test Library');

    // Go to step 3
    await page.click('button:has-text("Skip")');
    await expect(page.locator('text=IGDB API')).toBeVisible();

    // Go back to step 2
    await page.click('button:has-text("Back")');
    await expect(page.locator('text=Library Location')).toBeVisible();

    // Value should be preserved
    await expect(page.locator('input[placeholder="Main Library"]')).toHaveValue('Test Library');
  });

  test('shows progress indicator during setup', async ({ page }) => {
    await page.goto('/setup');

    // No progress on welcome
    await page.click('text=Get Started');

    // Should show step indicators
    await expect(page.locator('text=Library')).toBeVisible();
    await expect(page.locator('text=IGDB')).toBeVisible();
    await expect(page.locator('text=Prowlarr')).toBeVisible();
    await expect(page.locator('text=qBittorrent')).toBeVisible();
  });

  test('finish button navigates to homepage', async ({ page }) => {
    await page.goto('/setup');

    // Quick path through setup using Skip
    await page.click('text=Get Started');
    await page.click('button:has-text("Skip")'); // Library
    await page.click('button:has-text("Skip")'); // IGDB
    await page.click('button:has-text("Skip")'); // Prowlarr
    await page.click('button:has-text("Skip")'); // qBittorrent

    // Complete step
    await expect(page.locator("text=You're All Set!")).toBeVisible();
    await page.click('text=Start Using Gamearr');

    // Should navigate to homepage
    await expect(page).toHaveURL('/');
  });

  test('welcome step has correct content', async ({ page }) => {
    await page.goto('/setup');

    // Check all welcome content
    await expect(page.locator('text=Welcome to Gamearr')).toBeVisible();
    await expect(page.locator('text=guide you through')).toBeVisible();
    await expect(page.locator('button:has-text("Get Started")')).toBeVisible();
    await expect(page.locator("text=Skip setup, I'll configure later")).toBeVisible();
  });

  test('complete step has correct content', async ({ page }) => {
    await page.goto('/setup');

    // Navigate to complete step
    await page.click('text=Get Started');
    await page.click('button:has-text("Skip")'); // Library
    await page.click('button:has-text("Skip")'); // IGDB
    await page.click('button:has-text("Skip")'); // Prowlarr
    await page.click('button:has-text("Skip")'); // qBittorrent

    // Check complete step content
    await expect(page.locator("text=You're All Set!")).toBeVisible();
    await expect(page.locator('text=configured and ready')).toBeVisible();
    await expect(page.locator('button:has-text("Start Using Gamearr")')).toBeVisible();
  });
});

test.describe('Setup Navigation', () => {
  test('setup redirects to home if already completed', async ({ page }) => {
    // First, complete setup
    await page.goto('/setup');
    await page.click("text=Skip setup, I'll configure later");
    await expect(page).toHaveURL('/');

    // Try to go back to setup
    await page.goto('/setup');

    // Should redirect back to home since setup is complete
    await expect(page).toHaveURL('/');
  });
});
