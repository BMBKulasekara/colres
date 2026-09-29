import { expect, test } from '@playwright/test';
import { allowClerk, requiresTestUser } from '../support/auth';

test.describe('admin console when signed out', () => {
  test.beforeEach(async ({ page }) => {
    await allowClerk(page);
  });

  test('the root redirects to the dashboard', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveURL(/\/dashboard$/);
  });

  test('the dashboard shows a sign-in form instead of any data', async ({ page }) => {
    await page.goto('/dashboard');

    await expect(page.getByRole('textbox', { name: /email/i })).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole('heading', { name: 'Access denied' })).toBeHidden();
  });
});

test.describe('admin console for a regular user', () => {
  requiresTestUser();

  test('is refused with an explanation and a way out', async ({ page }) => {
    await page.goto('/dashboard');

    await expect(page.getByRole('heading', { name: 'Access denied' })).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.getByRole('button', { name: 'Switch account' })).toBeVisible();
    await expect(page.getByRole('link', { name: /Go to the Colres app/ })).toBeVisible();
  });
});
