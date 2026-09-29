import { clerk } from '@clerk/testing/playwright';
import { expect, test as setup } from '@playwright/test';
import { USER_STATE } from './support/auth';

/**
 * Signs the E2E user in once and saves the session for the signed-in tests.
 *
 * Clerk mints a one-time sign-in token for this address through its backend
 * API, so the account needs no password and no email code. Use a dedicated,
 * non-admin user in the Clerk development instance.
 */
setup('sign in the E2E user', async ({ page }) => {
  // The helper needs a page where Clerk has loaded; the sign-in page is public.
  await page.goto('/sign-in');
  await clerk.signIn({ page, emailAddress: process.env.E2E_CLERK_USER_EMAIL as string });

  await page.goto('/docs');
  await expect(page.getByRole('heading', { level: 1, name: /Hello/ })).toBeVisible({
    timeout: 30_000,
  });

  await page.context().storageState({ path: USER_STATE });
});
