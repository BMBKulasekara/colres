import Link from 'next/link';
import { footerNav, siteConfig } from '../../_lib/site';
import { Container } from '../ui/container';
import { Logo } from '../ui/logo';

export function SiteFooter({ nav = footerNav }: { nav?: typeof footerNav }) {
  const year = new Date().getFullYear();

  return (
    <footer className="bg-slate-950 pt-16 pb-10 text-slate-400 md:pt-20">
      <Container>
        <div className="grid gap-12 sm:grid-cols-2 md:grid-cols-[2fr_repeat(4,1fr)] md:gap-8">
          <div className="max-w-xs">
            <Logo tone="light" />
            <p className="mt-4 text-[15px] leading-6">
              The collaborative editor for research papers.
            </p>
            <p className="mt-2 font-medium text-[15px] text-teal-400">
              Totally free, for everyone.
            </p>
          </div>

          {nav.map((group) => (
            <nav key={group.title} aria-label={group.title}>
              <h2 className="font-semibold text-[15px] text-white">{group.title}</h2>
              <ul className="mt-4 space-y-3">
                {group.links.map((link) => (
                  <li key={link.label}>
                    <Link
                      href={link.href}
                      className="rounded-sm text-[15px] outline-none transition-colors hover:text-white focus-visible:ring-[3px] focus-visible:ring-indigo-400/60"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        <div className="mt-14 border-slate-800 border-t pt-8 text-sm">
          © {year} {siteConfig.name}. All rights reserved.
        </div>
      </Container>
    </footer>
  );
}
