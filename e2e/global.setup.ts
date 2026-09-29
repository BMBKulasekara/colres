import { clerkSetup } from '@clerk/testing/playwright';

/**
 * Fetches a Clerk testing token so tests can get past Clerk's bot protection.
 *
 * Runs once before all projects. Variables it sets on `process.env` reach every
 * worker. Skipped when no Clerk keys are available, e.g. a marketing-only run.
 */
export default async function globalSetup() {
  if (!process.env.CLERK_SECRET_KEY || !process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY) return;
  await clerkSetup();
}
