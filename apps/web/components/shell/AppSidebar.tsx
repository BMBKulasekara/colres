'use client';

import { OrganizationSwitcher, UserButton } from '@clerk/nextjs';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  SidebarTrigger,
  useSidebar,
} from '@repo/ui/components/ui/sidebar';
import { House, LayoutTemplate } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ColresMark } from './ColresMark';

const NAV_ITEMS = [
  {
    title: 'Home',
    href: '/docs',
    icon: House,
    isActive: (pathname: string) => pathname === '/' || pathname === '/docs',
  },
  {
    title: 'Templates',
    href: '/docs/templates',
    icon: LayoutTemplate,
    isActive: (pathname: string) => pathname.startsWith('/docs/templates'),
  },
] as const;

/**
 * The app's persistent navigation: the logo that always leads home, the
 * organization switcher that used to sit in the header, the main sections and
 * the account menu. Collapses to an icon rail with ⌘\.
 */
export function AppSidebar() {
  const pathname = usePathname() ?? '/';
  const { isMobile, setOpenMobile } = useSidebar();

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="gap-3">
        <SidebarMenu>
          <SidebarMenuItem className="flex items-center gap-1">
            <SidebarMenuButton asChild size="lg" tooltip="Colres home" className="flex-1">
              <Link href="/docs">
                <ColresMark />
                <span className="font-semibold text-base">Colres</span>
              </Link>
            </SidebarMenuButton>
            <SidebarTrigger
              aria-label="Collapse sidebar (⌘\)"
              title="Collapse sidebar (⌘\)"
              className="text-muted-foreground group-data-[collapsible=icon]:hidden"
            />
          </SidebarMenuItem>
        </SidebarMenu>

        {/* Clerk's switcher cannot shrink to an icon, so the rail leaves it out. */}
        <div className="group-data-[collapsible=icon]:hidden [&_.cl-organizationSwitcherTrigger]:w-full [&_.cl-organizationSwitcherTrigger]:justify-between [&_.cl-organizationSwitcherTrigger]:rounded-md [&_.cl-organizationSwitcherTrigger]:border [&_.cl-organizationSwitcherTrigger]:border-sidebar-border [&_.cl-organizationSwitcherTrigger]:bg-card [&_.cl-organizationSwitcherTrigger]:px-2 [&_.cl-organizationSwitcherTrigger]:py-1.5 [&_.cl-rootBox]:w-full">
          <OrganizationSwitcher />
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarMenu>
            {NAV_ITEMS.map((item) => {
              const active = item.isActive(pathname);
              return (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton asChild isActive={active} tooltip={item.title}>
                    <Link
                      href={item.href}
                      aria-current={active ? 'page' : undefined}
                      onClick={() => isMobile && setOpenMobile(false)}
                    >
                      <item.icon aria-hidden="true" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              );
            })}
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem className="flex items-center px-1 py-1 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0">
            <UserButton
              showName
              appearance={{
                elements: {
                  userButtonBox: 'flex-row-reverse gap-2',
                  userButtonOuterIdentifier:
                    'text-sm font-medium text-sidebar-foreground group-data-[collapsible=icon]:hidden',
                },
              }}
            />
          </SidebarMenuItem>
        </SidebarMenu>
        {/* The rail has no room for the collapse button in the header. */}
        <SidebarTrigger
          aria-label="Expand sidebar (⌘\)"
          title="Expand sidebar (⌘\)"
          className="hidden text-muted-foreground group-data-[collapsible=icon]:flex self-center"
        />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
