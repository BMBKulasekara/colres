import { expect, test } from '@playwright/test';

test.describe('marketing home page', () => {
  test('loads without runtime errors and shows the hero', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));

    await page.goto('/');

    await expect(page).toHaveTitle('Colres · Collaborative research writing');
    await expect(
      page.getByRole('heading', { level: 1, name: /Write research papers together/ })
    ).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('calls to action lead into the web app', async ({ page }) => {
    await page.goto('/');
    const hero = page.getByRole('region', { name: /Write research papers together/ });

    await expect(hero.getByRole('link', { name: /Start writing, it's free/ })).toHaveAttribute(
      'href',
      /\/sign-up$/
    );
    await expect(
      page.getByRole('banner').getByRole('link', { name: 'Sign in', exact: true })
    ).toHaveAttribute('href', /\/sign-in$/);
  });

  test('main navigation jumps to the FAQ section', async ({ page }) => {
    await page.goto('/');

    await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'FAQ' }).click();

    await expect(page).toHaveURL(/#faq$/);
    await expect(page.getByRole('heading', { name: 'Questions, answered' })).toBeInViewport();
  });

  test('FAQ answers expand one at a time', async ({ page }) => {
    await page.goto('/#faq');
    const first = page.getByRole('button', { name: 'Do I need to know LaTeX?' });
    const second = page.getByRole('button', { name: 'Is Colres really free?' });

    await expect(first).toHaveAttribute('aria-expanded', 'true');
    await second.click();

    await expect(second).toHaveAttribute('aria-expanded', 'true');
    await expect(first).toHaveAttribute('aria-expanded', 'false');
    await expect(page.getByText(/Colres is totally free for everyone/)).toBeVisible();
  });

  test('keyboard users can skip straight to the content', async ({ page }) => {
    await page.goto('/');

    await page.keyboard.press('Tab');
    const skip = page.getByRole('link', { name: 'Skip to content' });
    await expect(skip).toBeFocused();

    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/#main$/);
  });
});
