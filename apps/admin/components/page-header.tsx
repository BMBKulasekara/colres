'use client';

import { cn } from '@repo/ui/lib/utils';
import { usePathname } from 'next/navigation';
import { navItemForPath } from '../lib/nav-config';

/**
 * Page title block. The icon comes from the nav config for the current route,
 * so every page gets a consistent identity without passing one in. `hero`
 * renders it as a branded banner (used by the dashboard).
 */
export function PageHeader({
  title,
  description,
  actions,
  children,
  hero = false,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  children?: React.ReactNode;
  hero?: boolean;
}) {
  const item = navItemForPath(usePathname());
  const PageIcon = item?.icon;

  return (
    <div
      className={cn(
        'flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between',
        hero &&
          'relative overflow-hidden rounded-2xl border border-primary/15 bg-linear-to-br from-primary/12 via-primary/5 to-transparent p-5 md:p-6'
      )}
    >
      {hero && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-16 -right-10 size-56 rounded-full bg-primary/15 blur-3xl"
        />
      )}
      <div className="relative flex min-w-0 items-center gap-3.5">
        {PageIcon && (
          <span
            aria-hidden="true"
            className={cn(
              'grid shrink-0 place-items-center rounded-xl bg-linear-to-br from-primary to-indigo-400 text-primary-foreground shadow-md shadow-primary/25',
              hero ? 'size-12' : 'size-10'
            )}
          >
            <PageIcon size={hero ? 24 : 20} stroke={1.75} />
          </span>
        )}
        <div className="min-w-0">
          <h1
            className={cn(
              'font-semibold tracking-tight text-balance',
              hero ? 'text-2xl md:text-3xl' : 'text-2xl'
            )}
          >
            {title}
          </h1>
          {description && <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>}
          {children}
        </div>
      </div>
      {actions && (
        <div className="relative flex shrink-0 flex-wrap items-center gap-2">{actions}</div>
      )}
    </div>
  );
}

/** Standard page padding, vertical rhythm and entrance for every console page. */
export function PageBody({ children }: { children: React.ReactNode }) {
  return (
    <div className="animate-enter mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6 p-4 md:p-6 lg:p-8">
      {children}
    </div>
  );
}
