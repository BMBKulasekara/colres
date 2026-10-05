'use client';

import { ClerkProvider, OrganizationSwitcher, UserButton, useAuth } from '@clerk/nextjs';
import { SidebarInset, SidebarProvider } from '@repo/ui/components/ui/sidebar';
import { TooltipProvider } from '@repo/ui/components/ui/tooltip';
import { ConvexReactClient } from 'convex/react';
import { ConvexProviderWithClerk } from 'convex/react-clerk';
import { usePathname } from 'next/navigation';
import { useMemo } from 'react';
import { ClerkConvexSync } from './ClerkConvexSync';
import { NotificationBell } from './NotificationBell';
import { AppSidebar } from './shell/AppSidebar';

/** Paths under /docs that are pages of the app rather than a document's slug. */
const APP_PAGES_UNDER_DOCS = new Set(['templates', 'trash']);

/** Clerk's own pages, which are shown bare. */
function isAuthPath(pathname: string): boolean {
  return pathname.startsWith('/sign-in') || pathname.startsWith('/sign-up');
}

/**
 * Whether a path is a document in the editor. The editor brings its own
 * header, outline and panels, so the app sidebar steps aside for it.
 */
function isEditorPath(pathname: string): boolean {
  const match = /^\/docs\/([^/]+)/.exec(pathname);
  return match !== null && !APP_PAGES_UNDER_DOCS.has(match[1] ?? '');
}

export function AppShell({
  defaultSidebarOpen = true,
  children,
}: {
  defaultSidebarOpen?: boolean;
  children: React.ReactNode;
}) {
  const convex = useMemo(() => {
    const url = process.env.NEXT_PUBLIC_CONVEX_URL;
    if (!url) {
      if (typeof window !== 'undefined') {
        throw new Error(
          'NEXT_PUBLIC_CONVEX_URL environment variable is missing. ' +
            'Please check your .env.local file in the application directory.'
        );
      }
      return new ConvexReactClient('https://unknown-convex-url.convex.cloud');
    }
    return new ConvexReactClient(url);
  }, []);

  return (
    <ClerkProvider>
      {/* Forwards the Clerk JWT to Convex so backend functions can verify the caller. */}
      <ConvexProviderWithClerk client={convex} useAuth={useAuth}>
        <ClerkConvexSync convex={convex} />
        <TooltipProvider delayDuration={300}>
          <WorkspaceFrame defaultSidebarOpen={defaultSidebarOpen}>{children}</WorkspaceFrame>
        </TooltipProvider>
      </ConvexProviderWithClerk>
    </ClerkProvider>
  );
}

/**
 * The persistent sidebar around every signed-in page except the editor.
 *
 * The sidebar does not depend on Convex, so it is shown as soon as Clerk knows
 * who is signed in, while the page beside it is still loading its data.
 */
function WorkspaceFrame({
  defaultSidebarOpen,
  children,
}: {
  defaultSidebarOpen: boolean;
  children: React.ReactNode;
}) {
  const { isSignedIn } = useAuth();
  const pathname = usePathname() ?? '/';

  // Still-loading counts as signed in: the middleware only lets signed-in
  // people reach these pages, and the pages inside expect the sidebar's
  // context from their first render.
  if (isSignedIn === false || isAuthPath(pathname) || isEditorPath(pathname)) {
    return <>{children}</>;
  }

  return (
    // ⌘\ rather than the default ⌘B, which the editor needs for Bold.
    <SidebarProvider defaultOpen={defaultSidebarOpen} keyboardShortcut="\">
      <a
        href="#main"
        className="sr-only z-50 rounded-md bg-background px-3 py-2 focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
      >
        Skip to content
      </a>
      <AppSidebar />
      <SidebarInset>
        {/* The account corner: which organization is active, and who is signed in. */}
        <header className="flex h-14 shrink-0 items-center justify-end gap-3 border-b border-border bg-card px-4">
          <NotificationBell />
          <OrganizationSwitcher />
          <UserButton />
        </header>
        <div id="main" tabIndex={-1} className="flex flex-1 flex-col outline-none">
          {children}
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
