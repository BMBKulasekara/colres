import {
  type Icon,
  IconActivity,
  IconBuilding,
  IconFileText,
  IconLayoutDashboard,
  IconLayoutGrid,
  IconSettings,
  IconUsers,
} from '@tabler/icons-react';

/** Keys of `admin.stats.navCounts` that can be shown beside an item. */
export type NavBadgeKey = 'documents' | 'users' | 'organizations' | 'draftTemplates';

export type NavItem = {
  title: string;
  href: string;
  icon: Icon;
  badge?: NavBadgeKey;
  /** Single key pressed after "g" to jump here. */
  shortcut?: string;
  keywords?: string[];
};

export type NavGroup = { label: string; items: NavItem[] };

/**
 * The console's information architecture. Sidebar, breadcrumbs and the command
 * palette all read from here, so adding a page is a one-line change.
 */
export const NAV_GROUPS: NavGroup[] = [
  {
    label: 'Overview',
    items: [
      {
        title: 'Dashboard',
        href: '/dashboard',
        icon: IconLayoutDashboard,
        shortcut: 'h',
        keywords: ['home'],
      },
      {
        title: 'Activity',
        href: '/activity',
        icon: IconActivity,
        shortcut: 'a',
        keywords: ['audit', 'log'],
      },
    ],
  },
  {
    label: 'Content',
    items: [
      {
        title: 'Documents',
        href: '/documents',
        icon: IconFileText,
        badge: 'documents',
        shortcut: 'd',
      },
      {
        title: 'Templates',
        href: '/templates',
        icon: IconLayoutGrid,
        badge: 'draftTemplates',
        shortcut: 't',
      },
    ],
  },
  {
    label: 'People',
    items: [
      {
        title: 'Users',
        href: '/users',
        icon: IconUsers,
        badge: 'users',
        shortcut: 'u',
        keywords: ['admins', 'roles'],
      },
      {
        title: 'Organizations',
        href: '/organizations',
        icon: IconBuilding,
        badge: 'organizations',
        shortcut: 'o',
        keywords: ['teams'],
      },
    ],
  },
  {
    label: 'System',
    items: [
      {
        title: 'Settings',
        href: '/settings',
        icon: IconSettings,
        shortcut: 's',
        keywords: ['theme', 'catalog'],
      },
    ],
  },
];

export const NAV_ITEMS: (NavItem & { group: string })[] = NAV_GROUPS.flatMap((group) =>
  group.items.map((item) => ({ ...item, group: group.label }))
);

/** The nav item a path belongs to, matching nested routes (/templates/abc → Templates). */
export function navItemForPath(pathname: string) {
  return NAV_ITEMS.find((item) => pathname === item.href || pathname.startsWith(`${item.href}/`));
}
