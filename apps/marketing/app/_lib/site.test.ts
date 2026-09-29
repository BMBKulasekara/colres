import { afterEach, describe, expect, test, vi } from 'vitest';

/** `site.ts` reads the environment at import time, so each case re-imports it. */
async function loadSite() {
  vi.resetModules();
  return await import('./site');
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('site links', () => {
  test('point at the local web app when no URL is configured', async () => {
    vi.stubEnv('NEXT_PUBLIC_APP_URL', undefined);
    const { links } = await loadSite();

    expect(links.signUp).toBe('http://localhost:3000/sign-up');
    expect(links.signIn).toBe('http://localhost:3000/sign-in');
  });

  test('use the configured app URL without doubling a trailing slash', async () => {
    vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://app.colres.dev/');
    const { links, siteConfig } = await loadSite();

    expect(siteConfig.appUrl).toBe('https://app.colres.dev');
    expect(links.docs).toBe('https://app.colres.dev/docs');
  });

  test('every in-page nav link targets a section id', async () => {
    const { mainNav } = await loadSite();
    const anchors = mainNav.filter((link) => link.href.startsWith('#'));

    expect(anchors.map((link) => link.href)).toEqual([
      '#features',
      '#templates',
      '#pricing',
      '#faq',
    ]);
  });
});
