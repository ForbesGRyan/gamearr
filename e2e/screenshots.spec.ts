import { test, expect } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SCREENSHOT_DIR = path.join(__dirname, '..', 'screenshots');

// Configure viewport for consistent screenshots
test.use({
  viewport: { width: 1280, height: 800 },
  colorScheme: 'dark',
});

test.describe('Release Screenshots', () => {
  // Setup for cleaner screenshots
  test.beforeEach(async ({ page }) => {
    // Hide scrollbars - runs on every navigation
    await page.addInitScript(() => {
      // Clear localStorage to ensure URL params take precedence
      localStorage.clear();

      // Hide scrollbars
      const style = document.createElement('style');
      style.textContent = `
        *::-webkit-scrollbar { display: none !important; }
        * { scrollbar-width: none !important; }
      `;
      if (document.head) {
        document.head.appendChild(style);
      } else {
        document.addEventListener('DOMContentLoaded', () => {
          document.head.appendChild(style);
        });
      }
    });
  });

  // === SETUP ===
  test('01 - Setup Wizard', async ({ page }) => {
    await page.request.post('/api/v1/system/reset-setup').catch(() => {});
    await page.goto('/setup');
    await page.waitForLoadState('networkidle');
    await page.waitForSelector('text=Welcome to Gamearr', { timeout: 5000 }).catch(() => {});

    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, '01-setup.png'),
      fullPage: false,
    });
  });

  // === LIBRARY ===
  test('02 - Library Poster View', async ({ page }) => {
    const response = await page.request.get('/api/v1/system/setup-status');
    const data = await response.json();
    if (!data.data?.isComplete) {
      await page.request.post('/api/v1/system/skip-setup');
    }

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, '02-library-posters.png'),
      fullPage: false,
    });
  });

  test('03 - Library Table View', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.click('button[title="Table View"]');
    await page.waitForSelector('table', { timeout: 5000 });

    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, '03-library-table.png'),
      fullPage: false,
    });
  });

  test('04 - Library Overview View', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.click('button[title="Overview"]');
    await page.waitForLoadState('networkidle');

    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, '04-library-overview.png'),
      fullPage: false,
    });
  });

  test('05 - Add Game Modal', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const addButton = page.locator('button:has-text("Add Game")');
    if (await addButton.isVisible()) {
      await addButton.click();
    }

    const searchInput = page.getByRole('textbox', { name: 'Search for games' });
    await searchInput.fill('gta 6');
    await searchInput.press('Enter');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, '05-add-game-modal.png'),
      fullPage: false,
    });
  });

  test('06 - Game Detail Page', async ({ page }) => {
    await page.goto('/game/pc/a-hat-in-time');
    await page.waitForLoadState('networkidle');

    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, '06-game-detail.png'),
      fullPage: true,
    });
  });

  test('07 - Library Import Tab', async ({ page }) => {
    await page.goto('/?tab=scan');
    await page.waitForLoadState('networkidle');

    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, '07-library-import.png'),
      fullPage: false,
    });
  });

  test('08 - Library Health Tab', async ({ page }) => {
    await page.goto('/?tab=health');
    await page.waitForLoadState('networkidle');

    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, '08-library-health.png'),
      fullPage: false,
    });
  });

  // === DISCOVER ===
  test('09 - Discover Page', async ({ page }) => {
    await page.goto('/discover');
    await page.waitForLoadState('networkidle');

    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, '09-discover.png'),
      fullPage: false,
    });
  });

  // === SEARCH ===
  test('10 - Search Page', async ({ page }) => {
    await page.goto('/search');
    await page.waitForLoadState('networkidle');

    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, '10-search.png'),
      fullPage: false,
    });
  });

  // === ACTIVITY ===
  test('11 - Activity Page', async ({ page }) => {
    await page.goto('/activity');
    await page.waitForLoadState('networkidle');

    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, '11-activity.png'),
      fullPage: false,
    });
  });

  // === UPDATES ===
  test('12 - Updates Page', async ({ page }) => {
    await page.goto('/updates');
    await page.waitForLoadState('networkidle');

    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, '12-updates.png'),
      fullPage: false,
    });
  });

  // === SETTINGS ===
  test('13 - Settings General', async ({ page }) => {
    await page.goto('/settings');
    await page.waitForLoadState('networkidle');

    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, '13-settings-general.png'),
      fullPage: false,
    });
  });

  test('14 - Settings Libraries', async ({ page }) => {
    await page.goto('/settings?tab=libraries');
    await page.waitForLoadState('networkidle');

    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, '14-settings-libraries.png'),
      fullPage: false,
    });
  });

  test('15 - Settings Indexers', async ({ page }) => {
    await page.goto('/settings?tab=indexers');
    await page.waitForLoadState('networkidle');

    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, '15-settings-indexers.png'),
      fullPage: false,
    });
  });

  test('16 - Settings Downloads', async ({ page }) => {
    await page.goto('/settings?tab=downloads');
    await page.waitForLoadState('networkidle');

    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, '16-settings-downloads.png'),
      fullPage: false,
    });
  });

  test('17 - Settings Metadata', async ({ page }) => {
    await page.goto('/settings?tab=metadata');
    await page.waitForLoadState('networkidle');

    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, '17-settings-metadata.png'),
      fullPage: false,
    });
  });

  test('18 - Settings Updates', async ({ page }) => {
    await page.goto('/settings?tab=updates');
    await page.waitForLoadState('networkidle');

    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, '18-settings-updates.png'),
      fullPage: false,
    });
  });
});
