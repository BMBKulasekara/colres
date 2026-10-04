import { expect, test } from '@playwright/test';

test.describe('marketing navigation on a phone', () => {
  test('the menu opens as a drawer and closes after choosing a section', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByRole('navigation', { name: 'Main' })).toBeHidden();
    await page.getByRole('button', { name: 'Open menu' }).click();

    const drawer = page.getByRole('dialog');
    await expect(drawer).toBeVisible();
    await expect(drawer.getByRole('link', { name: "Start writing, it's free" })).toBeVisible();

    await drawer
      .getByRole('navigation', { name: 'Mobile' })
      .getByRole('link', { name: 'Pricing' })
      .click();

    await expect(drawer).toBeHidden();
    await expect(page).toHaveURL(/#pricing$/);
  });
});
