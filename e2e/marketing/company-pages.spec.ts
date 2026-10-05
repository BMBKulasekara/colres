import { expect, test } from '@playwright/test';

test.describe('about and terms pages', () => {
  test('the footer leads to both pages', async ({ page }) => {
    await page.goto('/');
    const footer = page.getByRole('contentinfo');

    await footer.getByRole('link', { name: 'About' }).click();
    await expect(page).toHaveURL(/\/about$/);
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Research writing');

    await page.getByRole('contentinfo').getByRole('link', { name: 'Terms & Conditions' }).click();
    await expect(page).toHaveURL(/\/terms$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Terms & Conditions' })).toBeVisible();
  });

  test('the about page shows scope, the team and contact details', async ({ page }) => {
    await page.goto('/about');

    await expect(page.getByRole('heading', { name: 'What Colres covers' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Who builds Colres' })).toBeVisible();
    await expect(page.getByRole('link', { name: /support@colres\.app/ })).toHaveAttribute(
      'href',
      'mailto:support@colres.app'
    );
  });

  test('the terms contents list jumps to its section', async ({ page }) => {
    await page.goto('/terms');

    await page
      .getByRole('navigation', { name: 'On this page' })
      .getByRole('link', { name: /Deleting content/ })
      .click();
    await expect(page).toHaveURL(/#deletion$/);
    await expect(page.getByRole('heading', { name: /Deleting content/ })).toBeInViewport();
  });

  test('main navigation on a sub-page returns to home page sections', async ({ page }) => {
    await page.goto('/terms');

    await page
      .getByRole('navigation', { name: 'Main' })
      .getByRole('link', { name: 'Pricing' })
      .click();
    await expect(page).toHaveURL(/\/#pricing$/);
    await expect(page.locator('#pricing')).toBeInViewport();
  });
});
