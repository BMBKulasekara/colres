'use client';

import { api } from '@repo/convex/_generated/api';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  useSidebar,
} from '@repo/ui/components/ui/sidebar';
import { useQuery } from 'convex/react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { formatNumber } from '../../lib/format';
import { NAV_GROUPS } from '../../lib/nav-config';
import { NavUser } from './nav-user';

export function AppSidebar() {
  const pathname = usePathname();
  const counts = useQuery(api.admin.stats.navCounts, {});
  const { isMobile, setOpenMobile } = useSidebar();

  return (
    <Sidebar collapsible="icon" variant="inset">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild size="lg" tooltip="Colres Admin">
              <Link href="/dashboard">
                <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-linear-to-br from-primary to-indigo-400 text-sm font-bold text-primary-foreground shadow-md shadow-primary/30">
                  C
                </span>
                <span className="flex flex-col leading-tight">
                  <span className="font-semibold">Colres</span>
                  <span className="text-xs text-muted-foreground">Admin console</span>
                </span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        {NAV_GROUPS.map((group) => (
          <SidebarGroup key={group.label}>
            <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
            <SidebarMenu>
              {group.items.map((item) => {
                const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
                const badge = item.badge && counts ? counts[item.badge] : undefined;
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
                    {badge !== undefined && badge > 0 && (
                      <SidebarMenuBadge
                        className="tabular-nums"
                        aria-label={
                          item.badge === 'draftTemplates'
                            ? `${badge} draft templates`
                            : `${badge} ${item.title.toLowerCase()}`
                        }
                      >
                        {formatNumber(badge)}
                      </SidebarMenuBadge>
                    )}
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter>
        <NavUser />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
