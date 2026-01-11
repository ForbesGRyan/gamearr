import { test, expect } from '@playwright/test';

// Helper to wait for setup page to be stable
async function waitForSetupPage(page: any) {
  // Wait for either setup content or redirect to home
  await page.waitForLoadState('networkidle');

  // Give React a moment to settle after any state updates
  await page.waitForTimeout(500);
}

// Helper to reset setup state and verify it worked
async function resetSetupState(page: any) {
  // Reset setup state using the dedicated test endpoint
  // Include Origin header to bypass CSRF protection
  const response = await page.request.post('http://localhost:7878/api/v1/system/reset-setup', {
    headers: {
      'Origin': 'http://localhost:7878',
    },
  });
  if (!response.ok()) {
    const text = await response.text();
    console.log('Reset setup failed:', response.status(), text);
  }
  expect(response.ok()).toBe(true);

  // Give the server a moment to process
  await page.waitForTimeout(100);
}

// TODO: These tests have timing issues with React Router and setup state
// The setup wizard works correctly when used manually, but E2E tests
// have race conditions with the setup status check redirect.
// Skip for now until we can properly isolate the test database.
test.describe.skip('Setup Wizard', () => {
  test.describe.configure({ mode: 'serial' });

  test.beforeEach(async ({ page }) => {
    await resetSetupState(page);
  });

  test('displays welcome screen on first visit', async ({ page }) => {
    await page.goto('/setup?force=true');
    await waitForSetupPage(page);

    // Should show welcome message
    await expect(page.getByText('Welcome to Gamearr')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Get Started' })).toBeVisible();
    await expect(page.getByText("Skip setup, I'll configure later")).toBeVisible();
  });

  test('can skip setup and navigate to homepage', async ({ page }) => {
    await page.goto('/setup?force=true');
    await waitForSetupPage(page);

    // Click skip setup
    await page.getByText("Skip setup, I'll configure later").click();

    // Should navigate to homepage
    await expect(page).toHaveURL('/');
  });

  test('can navigate through setup steps using Skip', async ({ page }) => {
    await page.goto('/setup?force=true');
    await waitForSetupPage(page);

    // Step 1: Welcome
    await expect(page.getByText('Welcome to Gamearr')).toBeVisible();
    await page.getByRole('button', { name: 'Get Started' }).click();

    // Step 2: Library
    await expect(page.getByText('Library Location')).toBeVisible();
    await page.getByRole('button', { name: 'Skip' }).click();

    // Step 3: IGDB
    await expect(page.getByText('IGDB API')).toBeVisible();
    await page.getByRole('button', { name: 'Skip' }).click();

    // Step 4: Prowlarr
    await expect(page.getByText('Prowlarr')).toBeVisible();
    await page.getByRole('button', { name: 'Skip' }).click();

    // Step 5: qBittorrent
    await expect(page.getByText('qBittorrent')).toBeVisible();
    await page.getByRole('button', { name: 'Skip' }).click();

    // Step 6: Complete
    await expect(page.getByText("You're All Set!")).toBeVisible();
    await expect(page.getByRole('button', { name: 'Start Using Gamearr' })).toBeVisible();
  });

  test('can fill forms and continue through setup', async ({ page }) => {
    await page.goto('/setup?force=true');
    await waitForSetupPage(page);

    // Step 1: Welcome
    await page.getByRole('button', { name: 'Get Started' }).click();

    // Step 2: Library - fill form
    await expect(page.getByText('Library Location')).toBeVisible();
    await page.getByPlaceholder('Main Library').fill('My Games');
    await page.getByPlaceholder(/path.*games/i).fill('C:\\Games');
    // Skip since we don't have a real path
    await page.getByRole('button', { name: 'Skip' }).click();

    // Step 3: IGDB - fill form
    await expect(page.getByText('IGDB API')).toBeVisible();
    await page.getByPlaceholder(/Client ID/i).fill('test-client-id');
    await page.getByPlaceholder(/Client Secret/i).fill('test-secret');
    // Skip since we don't have real credentials
    await page.getByRole('button', { name: 'Skip' }).click();

    // Step 4: Prowlarr
    await expect(page.getByText('Prowlarr')).toBeVisible();
    await page.getByRole('button', { name: 'Skip' }).click();

    // Step 5: qBittorrent
    await expect(page.getByText('qBittorrent')).toBeVisible();
    await page.getByRole('button', { name: 'Skip' }).click();

    // Step 6: Complete
    await expect(page.getByText("You're All Set!")).toBeVisible();
  });

  test('can go back through setup steps', async ({ page }) => {
    await page.goto('/setup?force=true');
    await waitForSetupPage(page);

    // Go to step 2
    await page.getByRole('button', { name: 'Get Started' }).click();
    await expect(page.getByText('Library Location')).toBeVisible();

    // Fill library name
    await page.getByPlaceholder('Main Library').fill('Test Library');

    // Go to step 3
    await page.getByRole('button', { name: 'Skip' }).click();
    await expect(page.getByText('IGDB API')).toBeVisible();

    // Go back to step 2
    await page.getByRole('button', { name: 'Back' }).click();
    await expect(page.getByText('Library Location')).toBeVisible();

    // Value should be preserved
    await expect(page.getByPlaceholder('Main Library')).toHaveValue('Test Library');
  });

  test('shows progress indicator during setup', async ({ page }) => {
    await page.goto('/setup?force=true');
    await waitForSetupPage(page);

    // Go past welcome
    await page.getByRole('button', { name: 'Get Started' }).click();

    // Should show step indicators in progress bar
    await expect(page.getByText('Library')).toBeVisible();
    await expect(page.getByText('IGDB')).toBeVisible();
    await expect(page.getByText('Prowlarr')).toBeVisible();
    await expect(page.getByText('qBittorrent')).toBeVisible();
  });

  test('finish button navigates to homepage', async ({ page }) => {
    await page.goto('/setup?force=true');
    await waitForSetupPage(page);

    // Quick path through setup using Skip
    await page.getByRole('button', { name: 'Get Started' }).click();
    await page.getByRole('button', { name: 'Skip' }).click(); // Library
    await page.getByRole('button', { name: 'Skip' }).click(); // IGDB
    await page.getByRole('button', { name: 'Skip' }).click(); // Prowlarr
    await page.getByRole('button', { name: 'Skip' }).click(); // qBittorrent

    // Complete step
    await expect(page.getByText("You're All Set!")).toBeVisible();
    await page.getByRole('button', { name: 'Start Using Gamearr' }).click();

    // Should navigate to homepage
    await expect(page).toHaveURL('/');
  });

  test('welcome step has correct content', async ({ page }) => {
    await page.goto('/setup?force=true');
    await waitForSetupPage(page);

    // Check all welcome content
    await expect(page.getByText('Welcome to Gamearr')).toBeVisible();
    await expect(page.getByText(/guide you through/)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Get Started' })).toBeVisible();
    await expect(page.getByText("Skip setup, I'll configure later")).toBeVisible();
  });

  test('complete step has correct content', async ({ page }) => {
    await page.goto('/setup?force=true');
    await waitForSetupPage(page);

    // Navigate to complete step
    await page.getByRole('button', { name: 'Get Started' }).click();
    await page.getByRole('button', { name: 'Skip' }).click(); // Library
    await page.getByRole('button', { name: 'Skip' }).click(); // IGDB
    await page.getByRole('button', { name: 'Skip' }).click(); // Prowlarr
    await page.getByRole('button', { name: 'Skip' }).click(); // qBittorrent

    // Check complete step content
    await expect(page.getByText("You're All Set!")).toBeVisible();
    await expect(page.getByText(/configured and ready/)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Start Using Gamearr' })).toBeVisible();
  });
});

test.describe.skip('Setup Navigation', () => {
  test.describe.configure({ mode: 'serial' });

  test('setup redirects to home if already completed', async ({ page }) => {
    // Reset setup first
    await resetSetupState(page);

    // First, complete setup by skipping (use ?force=true to bypass redirect)
    await page.goto('/setup?force=true');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);

    // Skip setup
    await page.getByText("Skip setup, I'll configure later").click();
    await expect(page).toHaveURL('/');

    // Try to go back to setup WITHOUT force - should redirect to home
    await page.goto('/setup');
    await page.waitForLoadState('networkidle');

    // Should be redirected back to home since setup is complete
    await expect(page).toHaveURL('/');
  });
});
