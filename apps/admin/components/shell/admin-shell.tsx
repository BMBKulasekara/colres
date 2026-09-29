'use client';

import { SidebarInset, SidebarProvider } from '@repo/ui/components/ui/sidebar';
import { TooltipProvider } from '@repo/ui/components/ui/tooltip';
import { Toaster } from 'sonner';
import { ConfirmProvider } from '../feedback/confirm-dialog';
import { AppSidebar } from './app-sidebar';
import { BreadcrumbProvider } from './breadcrumbs';
import { CommandMenuProvider } from './command-menu';
import { SiteHeader } from './site-header';
import { useTheme } from './theme-provider';

/**
 * The console frame, mounted once in the (admin) layout so the sidebar keeps
 * its state across navigation. Owns the single Toaster, confirm dialog and
 * command palette used by every page.
 */
export function AdminShell({
  defaultSidebarOpen,
  children,
}: {
  defaultSidebarOpen: boolean;
  children: React.ReactNode;
}) {
  const { resolvedTheme } = useTheme();

  return (
    <TooltipProvider delayDuration={300}>
      <ConfirmProvider>
        <BreadcrumbProvider>
          <CommandMenuProvider>
            <SidebarProvider defaultOpen={defaultSidebarOpen}>
              <a
                href="#main"
                className="sr-only z-50 rounded-md bg-background px-3 py-2 focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
              >
                Skip to content
              </a>
              <AppSidebar />
              <SidebarInset>
                <SiteHeader />
                <div id="main" tabIndex={-1} className="flex flex-1 flex-col outline-none">
                  {children}
                </div>
              </SidebarInset>
            </SidebarProvider>
          </CommandMenuProvider>
        </BreadcrumbProvider>
      </ConfirmProvider>
      <Toaster richColors closeButton position="bottom-right" theme={resolvedTheme} />
    </TooltipProvider>
  );
}
