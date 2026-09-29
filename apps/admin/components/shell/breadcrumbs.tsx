'use client';

import { cn } from '@repo/ui/lib/utils';
import { IconChevronRight } from '@tabler/icons-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { createContext, useContext, useEffect, useState } from 'react';
import { navItemForPath } from '../../lib/nav-config';

type BreadcrumbState = { label: string | null; setLabel: (label: string | null) => void };

const BreadcrumbContext = createContext<BreadcrumbState | null>(null);

export function BreadcrumbProvider({ children }: { children: React.ReactNode }) {
  const [label, setLabel] = useState<string | null>(null);
  return (
    <BreadcrumbContext.Provider value={{ label, setLabel }}>{children}</BreadcrumbContext.Provider>
  );
}

/**
 * Lets a detail page name the last crumb ("IEEE Conference Paper") instead of
 * showing an id. Cleared when the page unmounts.
 */
export function useBreadcrumbLabel(label: string | null | undefined) {
  const context = useContext(BreadcrumbContext);
  const setLabel = context?.setLabel;
  useEffect(() => {
    if (!setLabel) return;
    setLabel(label ?? null);
    return () => setLabel(null);
  }, [label, setLabel]);
}

export function Breadcrumbs() {
  const pathname = usePathname();
  const context = useContext(BreadcrumbContext);
  const item = navItemForPath(pathname);
  if (!item) return null;

  const isNested = pathname !== item.href;
  const crumbs: { label: string; href?: string }[] = [
    { label: item.group },
    { label: item.title, href: isNested ? item.href : undefined },
  ];
  if (isNested) crumbs.push({ label: context?.label ?? '…' });

  return (
    <nav aria-label="Breadcrumb" className="min-w-0">
      <ol className="flex min-w-0 items-center gap-1 text-sm">
        {crumbs.map((crumb, index) => {
          const last = index === crumbs.length - 1;
          return (
            <li
              key={`${crumb.label}-${index}`}
              className={cn('flex min-w-0 items-center gap-1', index === 0 && 'hidden sm:flex')}
            >
              {crumb.href ? (
                <Link
                  href={crumb.href}
                  className="truncate text-muted-foreground hover:text-foreground"
                >
                  {crumb.label}
                </Link>
              ) : (
                <span
                  className={cn(
                    'truncate',
                    last ? 'font-medium text-foreground' : 'text-muted-foreground'
                  )}
                  aria-current={last ? 'page' : undefined}
                >
                  {crumb.label}
                </span>
              )}
              {!last && (
                <IconChevronRight
                  size={14}
                  className="shrink-0 text-muted-foreground/60"
                  aria-hidden="true"
                />
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
