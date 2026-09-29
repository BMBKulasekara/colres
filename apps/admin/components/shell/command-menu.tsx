'use client';

import { useClerk } from '@clerk/nextjs';
import { api } from '@repo/convex/_generated/api';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@repo/ui/components/ui/dialog';
import { cn } from '@repo/ui/lib/utils';
import {
  type Icon,
  IconBuilding,
  IconFileText,
  IconLayoutGrid,
  IconLoader2,
  IconLogout,
  IconMoon,
  IconPlus,
  IconRefresh,
  IconSearch,
  IconUser,
} from '@tabler/icons-react';
import { useQuery } from 'convex/react';
import { useRouter } from 'next/navigation';
import { createContext, useCallback, useContext, useEffect, useId, useMemo, useState } from 'react';
import { useDebouncedValue } from '../../hooks/use-debounced-value';
import { isTypingTarget, useHotkey } from '../../hooks/use-hotkey';
import { NAV_ITEMS } from '../../lib/nav-config';
import { useTheme } from './theme-provider';

type CommandMenuState = { open: () => void };
const CommandMenuContext = createContext<CommandMenuState | null>(null);

export function useCommandMenu(): CommandMenuState {
  const value = useContext(CommandMenuContext);
  if (!value) throw new Error('useCommandMenu must be used inside <CommandMenuProvider>');
  return value;
}

type Command = {
  id: string;
  group: string;
  label: string;
  hint?: string;
  icon: Icon;
  run: () => void;
};

export function CommandMenuProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const router = useRouter();
  const open = useCallback(() => setIsOpen(true), []);

  useHotkey('mod+k', () => setIsOpen((current) => !current));

  // "g" then a letter jumps to a page, e.g. g d → Documents.
  useEffect(() => {
    let pendingUntil = 0;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey || isTypingTarget(event.target)) return;
      const key = event.key.toLowerCase();
      if (Date.now() < pendingUntil) {
        pendingUntil = 0;
        const target = NAV_ITEMS.find((item) => item.shortcut === key);
        if (target) {
          event.preventDefault();
          router.push(target.href);
        }
        return;
      }
      if (key === 'g') pendingUntil = Date.now() + 1000;
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [router]);

  const value = useMemo(() => ({ open }), [open]);

  return (
    <CommandMenuContext.Provider value={value}>
      {children}
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent
          className="top-[20%] translate-y-0 gap-0 overflow-hidden p-0 sm:max-w-xl"
          showCloseButton={false}
        >
          <DialogTitle className="sr-only">Command menu</DialogTitle>
          <DialogDescription className="sr-only">
            Search records, jump to a page, or run an action.
          </DialogDescription>
          {isOpen && <CommandPalette onClose={() => setIsOpen(false)} />}
        </DialogContent>
      </Dialog>
    </CommandMenuContext.Provider>
  );
}

function CommandPalette({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const { signOut } = useClerk();
  const { resolvedTheme, setTheme } = useTheme();
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const debounced = useDebouncedValue(query.trim(), 200);
  const results = useQuery(
    api.admin.search.global,
    debounced.length >= 2 ? { q: debounced } : 'skip'
  );
  const listId = useId();

  const go = useCallback(
    (href: string) => {
      onClose();
      router.push(href);
    },
    [onClose, router]
  );

  const commands = useMemo<Command[]>(() => {
    const needle = query.trim().toLowerCase();
    const matches = (text: string) => !needle || text.toLowerCase().includes(needle);

    const records: Command[] = results
      ? [
          ...results.documents.map((d) => ({
            id: `doc-${d._id}`,
            group: 'Documents',
            label: d.title,
            hint: d.status ? 'Active' : 'Draft',
            icon: IconFileText,
            run: () => go(`/documents?open=${d._id}`),
          })),
          ...results.templates.map((t) => ({
            id: `tpl-${t._id}`,
            group: 'Templates',
            label: t.name,
            hint: t.status === 'published' ? 'Published' : 'Draft',
            icon: IconLayoutGrid,
            run: () => go(`/templates/${t._id}`),
          })),
          ...results.users.map((u) => ({
            id: `usr-${u._id}`,
            group: 'Users',
            label: u.name || u.email,
            hint: u.email,
            icon: IconUser,
            run: () => go(`/users?open=${u._id}`),
          })),
          ...results.organizations.map((o) => ({
            id: `org-${o._id}`,
            group: 'Organizations',
            label: o.name,
            hint: `/${o.slug}`,
            icon: IconBuilding,
            run: () => go(`/organizations?open=${o._id}`),
          })),
        ]
      : [];

    const pages: Command[] = NAV_ITEMS.filter((item) =>
      matches([item.title, item.group, ...(item.keywords ?? [])].join(' '))
    ).map((item) => ({
      id: `nav-${item.href}`,
      group: 'Go to',
      label: item.title,
      hint: item.shortcut ? `G ${item.shortcut.toUpperCase()}` : undefined,
      icon: item.icon,
      run: () => go(item.href),
    }));

    const actions: Command[] = [
      {
        id: 'act-create',
        group: 'Actions',
        label: 'Create template',
        icon: IconPlus,
        run: () => go('/templates?create=1'),
      },
      {
        id: 'act-sync',
        group: 'Actions',
        label: 'Sync template catalog',
        icon: IconRefresh,
        run: () => go('/settings#catalog'),
      },
      {
        id: 'act-theme',
        group: 'Actions',
        label: `Switch to ${resolvedTheme === 'dark' ? 'light' : 'dark'} theme`,
        icon: IconMoon,
        run: () => {
          setTheme(resolvedTheme === 'dark' ? 'light' : 'dark');
          onClose();
        },
      },
      {
        id: 'act-signout',
        group: 'Actions',
        label: 'Sign out',
        icon: IconLogout,
        run: () => void signOut(),
      },
    ].filter((action) => matches(action.label));

    return [...records, ...pages, ...actions];
  }, [query, results, go, resolvedTheme, setTheme, onClose, signOut]);

  // Results can shrink under the highlight as a search resolves.
  const safeIndex = Math.min(activeIndex, Math.max(commands.length - 1, 0));
  const activeCommand = commands[safeIndex];
  const activeId = activeCommand ? `${listId}-${activeCommand.id}` : undefined;

  useEffect(() => {
    if (activeId) document.getElementById(activeId)?.scrollIntoView({ block: 'nearest' });
  }, [activeId]);

  const searching = debounced.length >= 2 && results === undefined;

  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex(commands.length ? (safeIndex + 1) % commands.length : 0);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex(commands.length ? (safeIndex - 1 + commands.length) % commands.length : 0);
    } else if (event.key === 'Enter' && activeCommand) {
      event.preventDefault();
      activeCommand.run();
    }
  };

  let lastGroup = '';

  return (
    <div className="flex flex-col">
      <div className="flex items-center gap-2 border-b px-3">
        {searching ? (
          <IconLoader2
            size={17}
            className="animate-spin text-muted-foreground"
            aria-hidden="true"
          />
        ) : (
          <IconSearch size={17} className="text-muted-foreground" aria-hidden="true" />
        )}
        <input
          role="combobox"
          aria-expanded="true"
          aria-controls={listId}
          aria-activedescendant={activeId}
          aria-label="Search records, pages and actions"
          placeholder="Search documents, templates, people… or type a command"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setActiveIndex(0);
          }}
          onKeyDown={onKeyDown}
          className="h-12 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        />
        <kbd className="rounded border bg-muted px-1.5 font-mono text-[10px] text-muted-foreground">
          ESC
        </kbd>
      </div>

      <div
        id={listId}
        role="listbox"
        aria-label="Results"
        className="max-h-96 overflow-y-auto p-1.5"
      >
        {commands.length === 0 ? (
          <p className="px-3 py-8 text-center text-sm text-muted-foreground">
            {searching ? 'Searching…' : 'No matches.'}
          </p>
        ) : (
          commands.map((command, index) => {
            const showGroup = command.group !== lastGroup;
            lastGroup = command.group;
            const CommandIcon = command.icon;
            return (
              <div key={command.id}>
                {showGroup && (
                  <div
                    className="px-2.5 pt-2 pb-1 text-xs font-medium text-muted-foreground"
                    aria-hidden="true"
                  >
                    {command.group}
                  </div>
                )}
                <div
                  id={`${listId}-${command.id}`}
                  role="option"
                  tabIndex={-1}
                  aria-selected={index === safeIndex}
                  data-active={index === safeIndex}
                  onMouseMove={() => setActiveIndex(index)}
                  onClick={() => command.run()}
                  onKeyDown={(event) => event.key === 'Enter' && command.run()}
                  className={cn(
                    'flex cursor-pointer items-center gap-2.5 rounded-md px-2.5 py-2 text-sm',
                    index === safeIndex && 'bg-accent text-accent-foreground'
                  )}
                >
                  <CommandIcon
                    size={16}
                    className="shrink-0 text-muted-foreground"
                    aria-hidden="true"
                  />
                  <span className="flex-1 truncate">{command.label}</span>
                  {command.hint && (
                    <span className="shrink-0 truncate text-xs text-muted-foreground">
                      {command.hint}
                    </span>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
