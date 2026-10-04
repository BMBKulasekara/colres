import path from 'node:path';
import { setupClerkTestingToken } from '@clerk/testing/playwright';
import { type Page, test } from '@playwright/test';

/** Session saved by auth.setup.ts. Gitignored. */
export const USER_STATE = path.join(__dirname, '../.auth/user.json');

/** Marks the enclosing tests as needing the Clerk E2E user, and skips them when unset. */
export function requiresTestUser() {
  test.skip(
    !process.env.E2E_CLERK_USER_EMAIL,
    'Set E2E_CLERK_USER_EMAIL (see e2e/.env.example) to run signed-in tests'
  );
  test.use({ storageState: USER_STATE });
}

/**
 * Lets Clerk's bot protection through for this page. A no-op without a testing
 * token, which is fine for pages that only render the sign-in form.
 */
export async function allowClerk(page: Page) {
  if (process.env.CLERK_TESTING_TOKEN) await setupClerkTestingToken({ page });
}
