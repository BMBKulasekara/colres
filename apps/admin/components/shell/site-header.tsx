'use client';

import { Button } from '@repo/ui/components/ui/button';
import { Separator } from '@repo/ui/components/ui/separator';
import { SidebarTrigger } from '@repo/ui/components/ui/sidebar';
import { IconSearch } from '@tabler/icons-react';
import { Breadcrumbs } from './breadcrumbs';
import { useCommandMenu } from './command-menu';
import { ThemeToggle } from './theme-toggle';

/**
 * A badge naming the environment, so nobody edits production thinking it's a
 * sandbox. A Convex cloud URL doesn't say whether it is dev or prod, so it is
 * set explicitly with NEXT_PUBLIC_ENV_LABEL; a local backend is detected.
 */
function environmentLabel(): string | null {
  const explicit = process.env.NEXT_PUBLIC_ENV_LABEL;
  if (explicit) return explicit;
  const url = process.env.NEXT_PUBLIC_CONVEX_URL ?? '';
  return /localhost|127\.0\.0\.1/.test(url) ? 'local' : null;
}

export function SiteHeader() {
  const { open } = useCommandMenu();
  const env = environmentLabel();

  return (
    <header className="sticky top-0 z-30 flex h-12 shrink-0 items-center gap-2 border-b bg-background/95 px-3 backdrop-blur supports-backdrop-filter:bg-background/80 md:px-4">
      <SidebarTrigger className="-ml-1" aria-label="Toggle sidebar (⌘B)" />
      <Separator orientation="vertical" className="mx-1 data-[orientation=vertical]:h-4" />
      <Breadcrumbs />

      <div className="ml-auto flex items-center gap-1.5">
        {env && (
          <span className="hidden rounded-md border border-amber-500/30 bg-amber-500/10 px-1.5 py-0.5 font-mono text-[11px] font-medium text-amber-700 uppercase sm:inline dark:text-amber-400">
            {env}
          </span>
        )}
        <Button
          variant="outline"
          size="sm"
          onClick={open}
          className="h-8 w-8 justify-start gap-2 px-2 text-muted-foreground sm:w-56"
          aria-label="Search (⌘K)"
        >
          <IconSearch size={15} aria-hidden="true" />
          <span className="hidden flex-1 text-left sm:inline">Search…</span>
          <kbd className="hidden rounded border bg-muted px-1.5 font-mono text-[10px] sm:inline">
            ⌘K
          </kbd>
        </Button>
        <ThemeToggle />
      </div>
    </header>
  );
}
