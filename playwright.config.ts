import { existsSync } from 'node:fs';
import path from 'node:path';
import { defineConfig, devices, type PlaywrightTestConfig } from '@playwright/test';

/*
 * End-to-end tests for all three apps. Each app gets its own project and dev
 * server; `E2E_APPS=marketing pnpm test:e2e` limits a run to some of them.
 *
 * Locally the servers are the ordinary `next dev` ones (and any already
 * running are reused). On CI each app is built and served with `next start`,
 * so the tests exercise what actually ships.
 */

// The web app's env file holds the Clerk keys the test helpers need; the
// optional e2e/.env.local holds the test user. Neither overrides a variable
// that is already set, so CI secrets win.
for (const file of ['apps/web/.env.local', 'e2e/.env.local']) {
  const full = path.join(__dirname, file);
  if (existsSync(full)) process.loadEnvFile(full);
}

const isCI = !!process.env.CI;

type AppName = 'marketing' | 'web' | 'admin';

const apps: Record<AppName, { port: number; env?: Record<string, string> }> = {
  marketing: { port: 3002 },
  // Pinned here so a test run does not depend on each developer's .env.local.
  web: {
    port: 3000,
    env: { NEXT_PUBLIC_CLERK_SIGN_IN_URL: '/sign-in', NEXT_PUBLIC_CLERK_SIGN_UP_URL: '/sign-up' },
  },
  admin: {
    port: 3001,
    env: { NEXT_PUBLIC_CLERK_SIGN_IN_URL: '/', NEXT_PUBLIC_CLERK_SIGN_UP_URL: '/' },
  },
};

const selected = (process.env.E2E_APPS ?? 'marketing,web,admin')
  .split(',')
  .map((name) => name.trim())
  .filter((name): name is AppName => name in apps);

/** Signed-in tests run only when a Clerk test user has been configured. */
const hasTestUser = !!process.env.E2E_CLERK_USER_EMAIL && !!process.env.CLERK_SECRET_KEY;
const needsAuth = hasTestUser && selected.some((app) => app !== 'marketing');

const url = (app: AppName) => `http://localhost:${apps[app].port}`;

const projects: PlaywrightTestConfig['projects'] = [];

if (needsAuth) {
  projects.push({
    name: 'auth',
    testMatch: /auth\.setup\.ts/,
    use: { baseURL: url('web') },
  });
}

for (const app of selected) {
  projects.push({
    name: app,
    testDir: `./e2e/${app}`,
    testIgnore: /\.mobile\.spec\.ts/,
    dependencies: app !== 'marketing' && needsAuth ? ['auth'] : [],
    use: { ...devices['Desktop Chrome'], baseURL: url(app) },
  });
}

if (selected.includes('marketing')) {
  projects.push({
    name: 'marketing-mobile',
    testDir: './e2e/marketing',
    testMatch: /\.mobile\.spec\.ts/,
    use: { ...devices['Pixel 7'], baseURL: url('marketing') },
  });
}

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 2 : 0,
  workers: isCI ? 1 : undefined,
  reporter: isCI
    ? [['github'], ['html', { open: 'never' }]]
    : [['list'], ['html', { open: 'never' }]],
  globalSetup: './e2e/global.setup.ts',
  expect: { timeout: 10_000 },
  use: {
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects,
  webServer: selected.map((app) => ({
    command: isCI
      ? `pnpm --filter ${app} build && pnpm --filter ${app} exec next start --port ${apps[app].port}`
      : `pnpm --filter ${app} exec next dev --port ${apps[app].port}`,
    url: url(app),
    env: apps[app].env,
    reuseExistingServer: !isCI,
    timeout: 240_000,
    stdout: 'ignore',
    stderr: 'pipe',
  })),
});
