'use client';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@repo/ui/components/ui/dropdown-menu';
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
import { House, LayoutTemplate, Monitor, Moon, Sun, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { THEME_OPTIONS, type ThemePreference, useTheme } from '../../lib/useTheme';
import { ColresMark } from './ColresMark';

const THEME_ICONS = { system: Monitor, light: Sun, dark: Moon } as const;

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
  {
    title: 'Bin',
    href: '/docs/trash',
    icon: Trash2,
    isActive: (pathname: string) => pathname.startsWith('/docs/trash'),
  },
] as const;

/**
 * The app's persistent navigation: the logo that always leads home, the main
 * sections and the theme. The organization switcher and account menu sit in
 * the top bar beside the page. Collapses to an icon rail with ⌘\.
 */
export function AppSidebar() {
  const pathname = usePathname() ?? '/';
  const { isMobile, setOpenMobile } = useSidebar();
  const [theme, setTheme] = useTheme();
  const ThemeIcon = THEME_ICONS[theme];

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
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton tooltip="Theme">
                  <ThemeIcon aria-hidden="true" />
                  <span>Theme</span>
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent side="right" align="end">
                <DropdownMenuLabel className="text-xs text-muted-foreground">
                  Theme
                </DropdownMenuLabel>
                <DropdownMenuRadioGroup
                  value={theme}
                  onValueChange={(value) => setTheme(value as ThemePreference)}
                >
                  {THEME_OPTIONS.map((option) => (
                    <DropdownMenuRadioItem key={option.value} value={option.value}>
                      {option.label}
                    </DropdownMenuRadioItem>
                  ))}
                </DropdownMenuRadioGroup>
              </DropdownMenuContent>
            </DropdownMenu>
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
