import { expect, test } from '@playwright/test';
import { requiresTestUser } from '../support/auth';

test.describe('documents dashboard', () => {
  requiresTestUser();

  test('greets the signed-in user and lists their documents', async ({ page }) => {
    await page.goto('/docs');

    await expect(page.getByRole('heading', { level: 1, name: /Hello/ })).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.getByRole('button', { name: /Create Document/ })).toBeVisible();
  });

  test('the create-document wizard opens and can be dismissed', async ({ page }) => {
    await page.goto('/docs');

    await page.getByRole('button', { name: /Create Document/ }).click();
    const wizard = page.getByRole('dialog', { name: 'Start a new document' });
    await expect(wizard).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(wizard).toBeHidden();
  });
});
