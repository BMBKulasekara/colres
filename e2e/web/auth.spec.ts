import { expect, test } from '@playwright/test';
import { allowClerk } from '../support/auth';

test.describe('web app when signed out', () => {
  test.beforeEach(async ({ page }) => {
    await allowClerk(page);
  });

  test('a protected page redirects to sign-in and remembers where you were going', async ({
    page,
  }) => {
    await page.goto('/docs');

    await expect(page).toHaveURL(/\/sign-in/);
    expect(new URL(page.url()).searchParams.get('redirect_url')).toContain('/docs');
  });

  test('the sign-in page renders the Clerk form', async ({ page }) => {
    await page.goto('/sign-in');

    await expect(page.getByRole('textbox', { name: /email/i })).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole('button', { name: 'Continue', exact: true })).toBeVisible();
  });

  test('the sign-up page is public', async ({ page }) => {
    await page.goto('/sign-up');

    await expect(page).toHaveURL(/\/sign-up/);
    await expect(page.getByRole('textbox', { name: /email/i })).toBeVisible({ timeout: 20_000 });
  });
});
