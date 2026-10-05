import type { ReactNode } from 'react';
import { subPageFooterNav, subPageNav } from '../../_lib/site';
import { SiteFooter } from './site-footer';
import { SiteNav } from './site-nav';

/**
 * Frame for every page other than home: the same skip link, nav and footer,
 * with nav anchors rewritten to point back at the home page's sections.
 */
export function PageShell({ children }: { children: ReactNode }) {
  return (
    <>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-lg focus:bg-white focus:px-4 focus:py-2 focus:font-medium focus:text-indigo-700 focus:shadow-float"
      >
        Skip to content
      </a>
      <SiteNav nav={subPageNav} />
      <main id="main">{children}</main>
      <SiteFooter nav={subPageFooterNav} />
    </>
  );
}
