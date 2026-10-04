'use client';

import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetTitle,
  SheetTrigger,
} from '@repo/ui/components/ui/sheet';
import { cn } from '@repo/ui/lib/utils';
import { ArrowRight, ChevronRight, Menu } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ctaLabels, links, mainNav, type NavLink } from '../../_lib/site';
import { useActiveSection } from '../../_lib/use-active-section';
import { useScrolled } from '../../_lib/use-scrolled';
import { Container } from '../ui/container';
import { CtaLink } from '../ui/cta-button';
import { Logo } from '../ui/logo';

const sectionIds = mainNav.filter((l) => l.href.startsWith('#')).map((l) => l.href.slice(1));

/** `nav` defaults to the home page's in-page anchors; sub-pages pass `subPageNav`. */
export function SiteNav({ nav = mainNav }: { nav?: NavLink[] }) {
  const scrolled = useScrolled(8);
  const active = useActiveSection(sectionIds);

  return (
    <header
      className={cn(
        'sticky top-0 z-40 border-b transition-[background-color,border-color,backdrop-filter] duration-200',
        scrolled
          ? 'border-slate-200 bg-white/85 backdrop-blur-md'
          : 'border-transparent bg-transparent'
      )}
    >
      <Container className="flex h-18 items-center justify-between gap-6">
        <Logo />

        <nav aria-label="Main" className="hidden lg:block">
          <ul className="flex items-center gap-9">
            {nav.map((link) => {
              const isActive = active !== null && link.href === `#${active}`;
              return (
                <li key={link.label}>
                  <Link
                    href={link.href}
                    aria-current={isActive ? 'location' : undefined}
                    className={cn(
                      'relative rounded-sm font-medium text-[15px] outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-indigo-500/50',
                      'after:-bottom-6.5 after:absolute after:inset-x-0 after:h-0.5 after:rounded-full after:bg-indigo-600 after:opacity-0 after:transition-opacity',
                      isActive
                        ? 'text-slate-900 after:opacity-100'
                        : 'text-slate-600 hover:text-slate-900'
                    )}
                  >
                    {link.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="hidden items-center gap-3 lg:flex">
          <CtaLink href={links.signIn} tone="ghost" size="sm" className="text-[15px]">
            Sign in
          </CtaLink>
          <CtaLink href={links.signUp} size="sm" className="text-[15px]">
            Start writing <ArrowRight aria-hidden />
          </CtaLink>
        </div>

        <MobileMenu nav={nav} />
      </Container>
    </header>
  );
}

function MobileMenu({ nav }: { nav: NavLink[] }) {
  const [open, setOpen] = useState(false);

  // Close the drawer if the viewport grows past the mobile breakpoint.
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)');
    const onChange = () => mq.matches && setOpen(false);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        aria-label="Open menu"
        className="-mr-2 inline-flex size-11 items-center justify-center rounded-lg text-slate-700 outline-none hover:bg-slate-100 focus-visible:ring-[3px] focus-visible:ring-indigo-500/50 lg:hidden"
      >
        <Menu className="size-6" />
      </SheetTrigger>
      <SheetContent
        side="right"
        className="w-full gap-0 border-none bg-white px-5 pb-6 sm:max-w-sm [&>button]:top-6 [&>button]:right-5"
      >
        <div className="flex h-18 items-center border-slate-200 border-b">
          <SheetTitle asChild>
            <div>
              <Logo />
            </div>
          </SheetTitle>
          <SheetDescription className="sr-only">Site navigation</SheetDescription>
        </div>

        <nav aria-label="Mobile">
          <ul>
            {nav.map((link) => (
              <li key={link.label} className="border-slate-200 border-b">
                <SheetClose asChild>
                  <Link
                    href={link.href}
                    className="flex h-16 items-center justify-between font-semibold text-lg text-slate-900 outline-none focus-visible:bg-slate-50"
                  >
                    {link.label}
                    <ChevronRight aria-hidden className="size-4 text-slate-400" />
                  </Link>
                </SheetClose>
              </li>
            ))}
          </ul>
        </nav>

        <div className="mt-auto flex flex-col gap-3">
          <CtaLink href={links.signIn} tone="secondary" size="lg" fullWidth>
            Sign in
          </CtaLink>
          <CtaLink href={links.signUp} size="lg" fullWidth>
            {ctaLabels.primary}
          </CtaLink>
        </div>
      </SheetContent>
    </Sheet>
  );
}
