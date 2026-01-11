import { test, expect } from '@playwright/test';
import path from 'path';

const SCREENSHOT_DIR = path.join(__dirname, '..', 'screenshots');

// Configure viewport for consistent screenshots
test.use({
  viewport: { width: 1280, height: 800 },
  colorScheme: 'dark',
});

test.describe('Release Screenshots', () => {
  test.beforeEach(async ({ page }) => {
    // Wait for app to be ready
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('01 - Setup Wizard Welcome', async ({ page }) => {
    // Reset setup state first
    await page.request.post('/api/v1/system/reset-setup').catch(() => {});

    await page.goto('/setup');
    await page.waitForLoadState('networkidle');

    // Wait for the welcome content to load
    await page.waitForSelector('text=Welcome to Gamearr', { timeout: 5000 }).catch(() => {});

    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, '01-setup-welcome.png'),
      fullPage: false,
    });
  });

  test('02 - Library Poster View', async ({ page }) => {
    // Skip setup if needed
    const response = await page.request.get('/api/v1/system/setup-status');
    const data = await response.json();
    if (!data.data?.isComplete) {
      await page.request.post('/api/v1/system/skip-setup');
    }

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Ensure poster view is selected
    const posterButton = page.locator('button[title="Poster view"]');
    if (await posterButton.isVisible()) {
      await posterButton.click();
    }

    await page.waitForTimeout(500);

    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, '02-library-posters.png'),
      fullPage: false,
    });
  });

  test('03 - Library Table View', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Switch to table view
    const tableButton = page.locator('button[title="Table view"]');
    if (await tableButton.isVisible()) {
      await tableButton.click();
    }

    await page.waitForTimeout(500);

    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, '03-library-table.png'),
      fullPage: false,
    });
  });

  test('04 - Library Overview View', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Switch to overview view
    const overviewButton = page.locator('button[title="Overview"]');
    if (await overviewButton.isVisible()) {
      await overviewButton.click();
    }

    await page.waitForTimeout(500);

    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, '04-library-overview.png'),
      fullPage: false,
    });
  });

  test('05 - Add Game Modal', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Open add game modal
    const addButton = page.locator('button:has-text("Add Game")');
    if (await addButton.isVisible()) {
      await addButton.click();
      await page.waitForTimeout(300);
    }

    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, '05-add-game-modal.png'),
      fullPage: false,
    });
  });

  test('06 - Game Detail Page', async ({ page }) => {
    // Get first game from API
    const response = await page.request.get('/api/v1/games');
    const data = await response.json();

    if (data.data && data.data.length > 0) {
      const gameId = data.data[0].id;
      await page.goto(`/game/${gameId}`);
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(500);
    } else {
      // No games, show empty library
      await page.goto('/');
    }

    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, '06-game-detail.png'),
      fullPage: false,
    });
  });

  test('07 - Activity Page', async ({ page }) => {
    await page.goto('/activity');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);

    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, '07-activity.png'),
      fullPage: false,
    });
  });

  test('08 - Discover Page', async ({ page }) => {
    await page.goto('/discover');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);

    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, '08-discover.png'),
      fullPage: false,
    });
  });

  test('09 - Settings General', async ({ page }) => {
    await page.goto('/settings');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);

    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, '09-settings-general.png'),
      fullPage: false,
    });
  });

  test('10 - Settings Libraries', async ({ page }) => {
    await page.goto('/settings?tab=libraries');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);

    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, '10-settings-libraries.png'),
      fullPage: false,
    });
  });

  test('11 - Library Import Tab', async ({ page }) => {
    await page.goto('/?tab=scan');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);

    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, '11-library-import.png'),
      fullPage: false,
    });
  });

  test('12 - Library Health Tab', async ({ page }) => {
    await page.goto('/?tab=health');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);

    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, '12-library-health.png'),
      fullPage: false,
    });
  });
});
